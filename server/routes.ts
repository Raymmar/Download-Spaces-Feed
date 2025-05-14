import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { webhooks, insertWebhookSchema } from "@db/schema";
import { desc, sql } from "drizzle-orm";
import express from "express";
import cors from "cors";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  const clients = new Set<any>();

  // Production-ready CORS configuration
  app.use(cors({
    origin: true, // Allows all origins in production
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 86400 // CORS preflight cache for 24 hours
  }));

  // Increased JSON body limit for production
  app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      // Store raw body for webhook signature verification if needed
      (req as any).rawBody = buf;
    }
  }));

  // Enhanced request logging for production
  app.use((req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    // Log request
    console.log(`[${timestamp}] Incoming ${req.method} ${req.url}`, {
      headers: req.headers,
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
      query: req.query
    });

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${timestamp}] Completed ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });

    next();
  });

  // Health check endpoint for production monitoring
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Enhanced webhook endpoint with improved error handling
  app.post("/api/webhook", async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] Processing webhook request`);

    try {
      // Validate request body against schema
      const validatedData = insertWebhookSchema.parse(req.body);
      console.log(`[${requestId}] Webhook data validated successfully`);

      try {
        // Attempt to insert the webhook
        const [webhook] = await db
          .insert(webhooks)
          .values(validatedData)
          .returning();

        console.log(`[${requestId}] Webhook stored successfully:`, webhook.id);

        // Notify connected clients
        const eventData = `data: ${JSON.stringify(webhook)}\n\n`;
        clients.forEach((client) => client.write(eventData));

        res.status(201).json(webhook);
      } catch (error: any) {
        // Handle duplicate entry error
        if (error.code === '23505') {
          console.log(`[${requestId}] Duplicate webhook detected`);
          return res.status(409).json({
            error: "Duplicate webhook",
            message: "This webhook has already been processed"
          });
        }
        throw error;
      }
    } catch (error: any) {
      console.error(`[${requestId}] Error processing webhook:`, error);
      res.status(error.errors ? 400 : 500).json({
        error: error.errors ? "Invalid webhook data" : "Failed to store webhook",
        message: error.errors || (error instanceof Error ? error.message : "Unknown error"),
        requestId
      });
    }
  });

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
      // Force fresh count with no cache
      res.setHeader('Cache-Control', 'no-cache');
      const result = await db.select({ 
        count: sql<number>`count(id)::int` 
      }).from(webhooks);
      
      if (!result[0]?.count && result[0]?.count !== 0) {
        throw new Error("Invalid count result");
      }
      
      res.json(result[0].count);
    } catch (error) {
      console.error("Error counting webhooks:", error);
      res.status(500).json({ error: "Failed to count webhooks" });
    }
  });
  
  // Get webhook counts for different time periods with comparisons
  app.get("/api/webhooks/stats", async (req, res) => {
    try {
      // Force fresh results with no cache
      res.setHeader('Cache-Control', 'no-cache');
      
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 6); // Last 7 days including today
      
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      
      const monthStart = new Date(todayStart);
      monthStart.setDate(monthStart.getDate() - 29); // Last 30 days including today
      
      const prevMonthStart = new Date(monthStart);
      prevMonthStart.setDate(prevMonthStart.getDate() - 30);
      
      // Today's count
      const todayResult = await db.select({ 
        count: sql<number>`count(id)::int` 
      })
      .from(webhooks)
      .where(sql`created_at >= ${todayStart.toISOString()}`);
      
      // Yesterday's count
      const yesterdayResult = await db.select({ 
        count: sql<number>`count(id)::int` 
      })
      .from(webhooks)
      .where(sql`created_at >= ${yesterdayStart.toISOString()} AND created_at < ${todayStart.toISOString()}`);
      
      // Last 7 days count
      const weekResult = await db.select({ 
        count: sql<number>`count(id)::int` 
      })
      .from(webhooks)
      .where(sql`created_at >= ${weekStart.toISOString()}`);
      
      // Previous 7 days count
      const prevWeekResult = await db.select({ 
        count: sql<number>`count(id)::int` 
      })
      .from(webhooks)
      .where(sql`created_at >= ${prevWeekStart.toISOString()} AND created_at < ${weekStart.toISOString()}`);
      
      // Last 30 days count
      const monthResult = await db.select({ 
        count: sql<number>`count(id)::int` 
      })
      .from(webhooks)
      .where(sql`created_at >= ${monthStart.toISOString()}`);
      
      // Previous 30 days count
      const prevMonthResult = await db.select({ 
        count: sql<number>`count(id)::int` 
      })
      .from(webhooks)
      .where(sql`created_at >= ${prevMonthStart.toISOString()} AND created_at < ${monthStart.toISOString()}`);
      
      // Calculate percentage changes
      const todayCount = todayResult[0]?.count || 0;
      const yesterdayCount = yesterdayResult[0]?.count || 0;
      const todayChange = yesterdayCount > 0 
        ? ((todayCount - yesterdayCount) / yesterdayCount) * 100 
        : null;
      
      const weekCount = weekResult[0]?.count || 0;
      const prevWeekCount = prevWeekResult[0]?.count || 0;
      const weekChange = prevWeekCount > 0 
        ? ((weekCount - prevWeekCount) / prevWeekCount) * 100 
        : null;
      
      const monthCount = monthResult[0]?.count || 0;
      const prevMonthCount = prevMonthResult[0]?.count || 0;
      const monthChange = prevMonthCount > 0 
        ? ((monthCount - prevMonthCount) / prevMonthCount) * 100 
        : null;
      
      res.json({
        today: {
          count: todayCount,
          previous: yesterdayCount,
          change: todayChange
        },
        week: {
          count: weekCount,
          previous: prevWeekCount,
          change: weekChange
        },
        month: {
          count: monthCount,
          previous: prevMonthCount,
          change: monthChange
        }
      });
    } catch (error) {
      console.error("Error fetching webhook stats:", error);
      res.status(500).json({ error: "Failed to fetch webhook stats" });
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

  // Daily cleanup task
  const runDailyCleanup = async () => {
    try {
      console.log('[Cleanup] Starting daily webhook cleanup...');

      // Begin transaction
      await db.transaction(async (tx) => {
        // Delete duplicates keeping the most recent entry
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

  // Schedule daily cleanup
  setInterval(runDailyCleanup, 24 * 60 * 60 * 1000); // Run every 24 hours
  // Also run immediately on startup
  runDailyCleanup();

  return httpServer;
}