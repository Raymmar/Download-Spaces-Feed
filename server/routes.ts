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

  app.post("/api/webhook", async (req, res) => {
    try {
      const data = webhookSchema.parse(req.body);
      const webhook = await db.insert(webhooks).values(data).returning();
      
      // Notify all connected clients
      const eventData = `data: ${JSON.stringify(webhook[0])}\n\n`;
      clients.forEach(client => client.write(eventData));
      
      res.status(201).json(webhook[0]);
    } catch (error) {
      res.status(400).json({ error: "Invalid webhook data" });
    }
  });

  app.get("/api/webhooks", async (_req, res) => {
    const results = await db.query.webhooks.findMany({
      orderBy: [desc(webhooks.createdAt)],
      limit: 100
    });
    res.json(results);
  });

  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    clients.add(res);

    req.on("close", () => {
      clients.delete(res);
    });
  });

  return httpServer;
}
