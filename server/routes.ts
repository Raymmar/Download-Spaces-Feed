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

  // Add CORS headers middleware for webhook endpoint and logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - Incoming ${req.method} request to ${req.path}`);
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
      console.log("Raw webhook request body:", req.body);

      // Parse and validate the webhook data
      let validatedData;
      try {
        validatedData = webhookSchema.parse(req.body);
        console.log("Webhook data validated successfully:", validatedData);
      } catch (validationError) {
        console.error("Webhook validation failed:", validationError);
        throw validationError;
      }

      // Attempt to insert into database
      let insertedWebhook;
      try {
        const webhook = await db.insert(webhooks).values(validatedData).returning();
        insertedWebhook = webhook[0];
        console.log("Webhook stored successfully:", insertedWebhook);
      } catch (dbError) {
        console.error("Database insertion failed:", dbError);
        throw dbError;
      }

      // Notify connected clients
      const eventData = `data: ${JSON.stringify(insertedWebhook)}\n\n`;
      console.log("Broadcasting to SSE clients:", eventData);
      clients.forEach(client => client.write(eventData));

      res.status(201).json(insertedWebhook);
    } catch (error) {
      console.error("Webhook processing error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: "Invalid webhook data", 
          details: error.errors 
        });
      } else {
        res.status(500).json({ 
          error: "Failed to process webhook",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
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
    console.log("New client connected to SSE");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    clients.add(res);
    console.log("Total SSE clients:", clients.size);

    req.on("close", () => {
      clients.delete(res);
      console.log("Client disconnected from SSE. Remaining clients:", clients.size);
    });
  });

  return httpServer;
}