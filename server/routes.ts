import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { webhooks } from "@db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

const webhookSchema = z.object({
  userId: z.string(),
  playlistUrl: z.string().url(),
  spaceName: z.string(),
  tweetUrl: z.string().url(),
  ip: z.string(),
  city: z.string(),
  region: z.string(),
  country: z.string()
});

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  const clients = new Set<any>();

  // Add CORS headers middleware for webhook endpoint
  app.use('/api/webhook', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  app.post("/api/webhook", async (req, res) => {
    try {
      console.log("Received webhook data:", req.body);
      const data = webhookSchema.parse(req.body);
      const webhook = await db.insert(webhooks).values(data).returning();

      // Notify all connected clients
      const eventData = `data: ${JSON.stringify(webhook[0])}\n\n`;
      clients.forEach(client => client.write(eventData));

      res.status(201).json(webhook[0]);
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).json({ error: "Invalid webhook data" });
    }
  });

  app.get("/api/webhooks", async (_req, res) => {
    try {
      const results = await db.query.webhooks.findMany({
        orderBy: [desc(webhooks.createdAt)],
        limit: 100
      });
      res.json(results);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ error: "Failed to fetch webhooks" });
    }
  });

  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    clients.add(res);

    req.on("close", () => {
      clients.delete(res);
    });
  });

  return httpServer;
}