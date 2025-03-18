import type { Express } from "express";
import { createServer, type Server } from "http";
import { db, pool } from "@db";
import { webhooks, insertWebhookSchema } from "@db/schema";
import { desc, sql } from "drizzle-orm";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  const clients = new Set<any>();

  // Configure CORS for webhook endpoint with specific origins
  const allowedOrigins = [
    'https://download-spaces.replit.app',
    'https://7114d5ac-a855-4723-bf77-ff79f4f28037-00-ffhh8owu34jh.spock.replit.dev',
    // Allow Chrome extension origin
    'chrome-extension://hjgpigfbmdlajibmebhndhjiiohodgfi'
  ];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.replit.dev')) {
        callback(null, true);
      } else {
        console.log(`Blocked request from unauthorized origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }));

  // Health check endpoint
  app.get("/health", async (req, res) => {
    try {
      // Test database connection
      await db.select({ count: sql<number>`1` }).from(webhooks);
      res.status(200).json({ status: "healthy" });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({ status: "unhealthy", error: "Database connection failed" });
    }
  });

  // Configure rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
  });

  // Apply rate limiting to webhook endpoint
  app.use('/api/webhook', limiter);

  // Simple JSON body parsing with increased limit
  app.use(express.json({ 
    limit: '10mb'
  }));

  // Enhanced request logging
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Request:`, {
      method: req.method,
      url: req.url,
      origin: req.headers.origin,
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
    });
    next();
  });

  // Daily cleanup task (keep existing code)
  const runDailyCleanup = async () => {
    try {
      console.log('[Cleanup] Starting daily webhook cleanup...');

      await db.transaction(async (tx) => {
        const deleteResult = await tx.execute(sql`
          DELETE FROM webhooks a
          USING webhooks b
          WHERE a.media_url = b.media_url 
          AND a.tweet_url = b.tweet_url
          AND a.created_at < b.created_at;
        `);

        console.log(`[Cleanup] Removed ${deleteResult.rowCount} duplicate webhooks`);
      });
    } catch (error) {
      console.error('[Cleanup] Error during webhook cleanup:', error);
    }
  };

  setInterval(runDailyCleanup, 24 * 60 * 60 * 1000);
  runDailyCleanup();

  // Get historical webhooks
  app.get("/api/webhooks", async (req, res) => {
    try {
      const recentWebhooks = await db.query.webhooks.findMany({
        orderBy: [desc(webhooks.createdAt)],
        limit: 200
      });
      res.json(recentWebhooks);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ error: "Failed to fetch webhooks" });
    }
  });

  // Webhook count endpoint
  app.get("/api/webhooks/count", async (req, res) => {
    try {
      const result = await db.select({ 
        count: sql<number>`count(*)::int` 
      }).from(webhooks);
      res.json(result[0].count);
    } catch (error) {
      console.error("Error counting webhooks:", error);
      res.status(500).json({ error: "Failed to count webhooks" });
    }
  });

  // Enhanced webhook endpoint with validation, duplicate handling, and better error handling
  app.post("/api/webhook", async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Webhook received from origin:`, req.headers.origin);

    try {
      // Validate request body against schema
      const validatedData = insertWebhookSchema.parse(req.body);

      try {
        // Attempt to insert the webhook
        const [webhook] = await db
          .insert(webhooks)
          .values(validatedData)
          .returning();

        console.log(`[${timestamp}] Successfully processed webhook:`, {
          id: webhook.id,
          userId: webhook.userId,
          spaceName: webhook.spaceName
        });

        // Notify connected clients
        const eventData = `data: ${JSON.stringify(webhook)}\n\n`;
        clients.forEach((client) => client.write(eventData));

        res.status(201).json(webhook);
      } catch (error: any) {
        // Check if this is a duplicate entry error
        if (error.code === '23505') {
          console.log(`[${timestamp}] Duplicate webhook detected:`, {
            mediaUrl: validatedData.mediaUrl,
            tweetUrl: validatedData.tweetUrl
          });

          return res.status(409).json({
            error: "Duplicate webhook",
            message: "This webhook has already been processed"
          });
        }
        throw error; // Re-throw other errors
      }
    } catch (error: any) {
      console.error(`[${timestamp}] Error processing webhook:`, error);

      const errorResponse = {
        error: error.errors ? "Invalid webhook data" : "Failed to store webhook",
        message: error.errors || (error instanceof Error ? error.message : "Unknown error"),
        timestamp
      };

      res.status(error.errors ? 400 : 500).json(errorResponse);
    }
  });

  // SSE endpoint for real-time updates
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    clients.add(res);
    req.on("close", () => clients.delete(res));
  });

  // Add graceful shutdown handler
  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    try {
      await pool.end();
      console.log('Database connections closed.');
    } catch (err) {
      console.error('Error during shutdown:', err);
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return httpServer;
}