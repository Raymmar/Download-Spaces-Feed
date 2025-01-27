import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { webhooks } from "@db/schema";
import { desc, and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import express from "express";

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

  // Configure raw body parsing for webhooks
  app.use(express.raw({ type: 'application/json' }));
  app.use(express.text());

  // Add CORS headers middleware for webhook endpoint and logging
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - Incoming ${req.method} request to ${req.path}`);
    console.log('Request headers:', req.headers);
    console.log('Raw body:', req.body);
    console.log('Content type:', req.get('content-type'));

    // More permissive CORS settings
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      console.log(`${timestamp} - Responding to OPTIONS request`);
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Update webhook count endpoint to count unique entries
  app.get("/api/webhooks/count", async (_req, res) => {
    try {
      // Use a subquery to get distinct combinations first
      const result = await db.select({
        count: sql<number>`COUNT(DISTINCT (${webhooks.tweetUrl}, ${webhooks.spaceName}, ${webhooks.ip}))`
      }).from(webhooks);

      res.json(result[0].count);
    } catch (error) {
      console.error("Error fetching unique webhook count:", error);
      res.status(500).json({ error: "Failed to fetch unique webhook count" });
    }
  });

  app.post("/api/webhook", async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - Processing webhook request`);

    try {
      // Parse body based on content type
      let parsedBody;
      try {
        if (typeof req.body === 'string') {
          parsedBody = JSON.parse(req.body);
        } else if (Buffer.isBuffer(req.body)) {
          parsedBody = JSON.parse(req.body.toString());
        } else {
          parsedBody = req.body;
        }
        console.log(`${timestamp} - Parsed webhook data:`, parsedBody);
      } catch (parseError) {
        console.error(`${timestamp} - Body parsing failed:`, parseError);
        return res.status(400).json({ error: "Invalid JSON in request body" });
      }

      // Validate webhook data
      const validatedData = webhookSchema.parse(parsedBody);
      console.log(`${timestamp} - Webhook data validated`);

      // Check for recent duplicates using the indexed fields
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const duplicates = await db.select({
        count: sql<number>`count(*)`,
        latestEntry: webhooks.createdAt
      })
      .from(webhooks)
      .where(
        and(
          eq(webhooks.ip, validatedData.ip),
          eq(webhooks.spaceName, validatedData.spaceName),
          eq(webhooks.tweetUrl, validatedData.tweetUrl),
          sql`${webhooks.createdAt} > ${twentyFourHoursAgo}`
        )
      )
      .groupBy(webhooks.createdAt)
      .orderBy(desc(webhooks.createdAt))
      .limit(1);

      if (duplicates.length > 0 && duplicates[0].count > 0) {
        console.log(`${timestamp} - Duplicate webhook detected within 24 hours`);

        // Get the most recent duplicate entry
        const existingEntry = await db.query.webhooks.findFirst({
          where: and(
            eq(webhooks.ip, validatedData.ip),
            eq(webhooks.spaceName, validatedData.spaceName),
            eq(webhooks.tweetUrl, validatedData.tweetUrl),
            sql`${webhooks.createdAt} > ${twentyFourHoursAgo}`
          ),
          orderBy: [desc(webhooks.createdAt)]
        });

        return res.status(200).json({
          message: "Duplicate webhook detected",
          webhook: existingEntry
        });
      }

      // If no duplicate found, proceed with insertion
      const [insertedWebhook] = await db.insert(webhooks)
        .values(validatedData)
        .returning();

      console.log(`${timestamp} - New webhook stored successfully`);

      // Notify connected clients
      const eventData = `data: ${JSON.stringify(insertedWebhook)}\n\n`;
      clients.forEach(client => client.write(eventData));

      res.status(201).json(insertedWebhook);
    } catch (error) {
      console.error(`${timestamp} - Webhook processing error:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to process webhook",
        message: errorMessage
      });
    }
  });

  // Cleanup duplicates endpoint with proper type handling
  app.post("/api/cleanup-duplicates", async (_req, res) => {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      console.log("Starting cleanup for webhooks since:", oneWeekAgo);

      const allWebhooks = await db.query.webhooks.findMany({
        where: sql`${webhooks.createdAt} > ${oneWeekAgo}`,
        orderBy: [desc(webhooks.createdAt)]
      });
      console.log("Found total webhooks:", allWebhooks.length);

      const uniqueKeys = new Set<string>();
      const duplicateIds: string[] = [];

      allWebhooks.forEach((webhook) => {
        const key = `${webhook.ip}-${webhook.spaceName}-${webhook.tweetUrl}`;
        if (uniqueKeys.has(key)) {
          duplicateIds.push(webhook.id);
        } else {
          uniqueKeys.add(key);
        }
      });
      console.log("Found duplicate IDs:", duplicateIds.length);

      if (duplicateIds.length > 0) {
        const deletePromises = duplicateIds.map(id => 
          db.delete(webhooks)
            .where(eq(webhooks.id, id))
            .returning()
        );

        const results = await Promise.all(deletePromises);
        console.log("Deleted webhooks results:", results);
      }

      res.json({ 
        message: "Cleanup completed", 
        removedCount: duplicateIds.length 
      });
    } catch (error) {
      console.error("Error during cleanup:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ 
        error: "Failed to cleanup duplicates", 
        message: errorMessage 
      });
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