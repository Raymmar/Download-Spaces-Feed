import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { webhooks, insertWebhookSchema } from "@db/schema";
import { desc, sql } from "drizzle-orm";
import express from "express";
import cors from "cors";
import rateLimit from 'express-rate-limit';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Configure rate limiting for production
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'production' ? 60 : 0, // 60 requests per minute in production
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Enable CORS for webhook endpoint with proper production configuration
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? [
      'https://*.replit.app',
      'https://*.repl.co'
    ] : true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }));

  // Increase JSON payload limit and add proper error handling
  app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        throw new Error('Invalid JSON');
      }
    }
  }));

  // Enhanced request logging for production
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      method: req.method,
      url: req.url,
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
      headers: req.headers,
      ip: req.ip
    };

    if (process.env.NODE_ENV === 'production') {
      // In production, log to a proper logging service or file
      console.log('[Production]', JSON.stringify(logData));
    } else {
      console.log(`[${timestamp}] Request:`, {
        method: req.method,
        url: req.url,
        body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
      });
    }
    next();
  });

  // Daily cleanup task with proper error handling
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
      // In production, you might want to notify an error tracking service
      if (process.env.NODE_ENV === 'production') {
        console.error('[Production Error] Cleanup failed:', error);
      }
    }
  };

  // Schedule daily cleanup with error handling
  const cleanupInterval = setInterval(runDailyCleanup, 24 * 60 * 60 * 1000);
  if (process.env.NODE_ENV === 'production') {
    // Ensure cleanup task is properly handled in production
    process.on('SIGTERM', () => {
      clearInterval(cleanupInterval);
      console.log('Cleanup task terminated gracefully');
    });
  }
  runDailyCleanup();

  // Production-ready endpoints with enhanced error handling
  app.get("/api/webhooks", async (req, res) => {
    try {
      const recentWebhooks = await db.query.webhooks.findMany({
        orderBy: [desc(webhooks.createdAt)],
        limit: 200
      });
      res.json(recentWebhooks);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' 
          ? "Internal server error" 
          : "Failed to fetch webhooks",
        code: 'FETCH_ERROR'
      });
    }
  });

  app.get("/api/webhooks/count", async (req, res) => {
    try {
      const result = await db.select({ 
        count: sql<number>`count(*)::int` 
      }).from(webhooks);
      res.json(result[0].count);
    } catch (error) {
      console.error("Error counting webhooks:", error);
      res.status(500).json({ 
        error: process.env.NODE_ENV === 'production'
          ? "Internal server error"
          : "Failed to count webhooks",
        code: 'COUNT_ERROR'
      });
    }
  });

  // Production-ready webhook endpoint with enhanced error handling
  app.post("/api/webhook", limiter, async (req, res) => {
    try {
      const validatedData = insertWebhookSchema.parse(req.body);

      try {
        const [webhook] = await db
          .insert(webhooks)
          .values(validatedData)
          .returning();

        res.status(201).json(webhook);
      } catch (error: any) {
        if (error.code === '23505') {
          return res.status(409).json({
            error: "Duplicate webhook",
            message: "This webhook has already been processed",
            code: 'DUPLICATE_ERROR'
          });
        }
        throw error;
      }
    } catch (error: any) {
      console.error("Error processing webhook:", error);
      res.status(error.errors ? 400 : 500).json({
        error: process.env.NODE_ENV === 'production'
          ? "Internal server error"
          : "Failed to store webhook",
        message: process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.errors || (error instanceof Error ? error.message : "Unknown error"),
        code: error.errors ? 'VALIDATION_ERROR' : 'SERVER_ERROR'
      });
    }
  });

  return httpServer;
}