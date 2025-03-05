import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { webhooks } from "@db/schema";
import { desc, sql } from "drizzle-orm";
import express from "express";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  const clients = new Set<any>();

  // Simple JSON body parsing
  app.use(express.json({ 
    limit: '10mb'
  }));

  // Basic request logging
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Request:`, {
      method: req.method,
      url: req.url,
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
    });
    next();
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
          WHERE a.ip = b.ip 
          AND a.space_name = b.space_name 
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

  // Simple webhook endpoint - just store and notify
  app.post("/api/webhook", async (req, res) => {
    try {
      const [webhook] = await db
        .insert(webhooks)
        .values(req.body)
        .returning();

      // Notify connected clients
      const eventData = `data: ${JSON.stringify(webhook)}\n\n`;
      clients.forEach((client) => client.write(eventData));

      res.status(201).json(webhook);
    } catch (error) {
      console.error("Error storing webhook:", error);
      res.status(500).json({
        error: "Failed to store webhook",
        message: error instanceof Error ? error.message : "Unknown error"
      });
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

  return httpServer;
}