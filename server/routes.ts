import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { webhooks } from "@db/schema";
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

  app.post("/api/webhook", async (req, res) => {
    try {
      // Insert webhook data directly
      const [insertedWebhook] = await db
        .insert(webhooks)
        .values(req.body)
        .returning();

      console.log(`Webhook received:`, {
        id: insertedWebhook.id,
        userId: insertedWebhook.userId,
        spaceName: insertedWebhook.spaceName
      });

      // Notify connected clients
      const eventData = `data: ${JSON.stringify(insertedWebhook)}\n\n`;
      clients.forEach((client) => client.write(eventData));

      res.status(201).json({
        status: "created",
        webhook: insertedWebhook
      });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({
        error: "Failed to process webhook",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Keep SSE endpoint for real-time updates
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    clients.add(res);
    req.on("close", () => clients.delete(res));
  });

  return httpServer;
}