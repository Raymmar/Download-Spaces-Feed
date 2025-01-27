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
    try {
      // Log raw request details
      console.log(`${timestamp} - Raw request body:`, typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2));
      console.log(`${timestamp} - Content-Type:`, req.headers['content-type']);

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
        console.log(`${timestamp} - Parsed body:`, parsedBody);
      } catch (parseError) {
        console.error(`${timestamp} - Body parsing failed:`, parseError);
        return res.status(400).json({ error: "Invalid JSON in request body" });
      }

      // Ensure we have a body
      if (!parsedBody || Object.keys(parsedBody).length === 0) {
        console.error(`${timestamp} - Empty request body received`);
        return res.status(400).json({ error: "Request body is empty" });
      }

      // Parse and validate the webhook data
      let validatedData;
      try {
        validatedData = webhookSchema.parse(parsedBody);
        console.log(`${timestamp} - Webhook data validated successfully:`, validatedData);
      } catch (validationError) {
        console.error(`${timestamp} - Webhook validation failed:`, validationError);
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({
            error: "Invalid webhook data",
            details: validationError.errors
          });
        }
        throw validationError;
      }

      // Check for recent duplicates (within last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const recentDuplicates = await db.query.webhooks.findMany({
        where: and(
          eq(webhooks.ip, validatedData.ip),
          eq(webhooks.spaceName, validatedData.spaceName),
          eq(webhooks.tweetUrl, validatedData.tweetUrl),
          sql`${webhooks.createdAt} > ${twentyFourHoursAgo}`
        ),
        orderBy: [desc(webhooks.createdAt)],
      });

      // If a duplicate exists, return the most recent one
      if (recentDuplicates.length > 0) {
        console.log(`${timestamp} - Duplicate webhook detected within 24 hours, skipping insertion`);
        return res.status(200).json({
          message: "Duplicate webhook detected",
          webhook: recentDuplicates[0]
        });
      }

      // If no duplicate found, proceed with insertion
      let insertedWebhook;
      try {
        const webhook = await db.insert(webhooks).values(validatedData).returning();
        insertedWebhook = webhook[0];
        console.log(`${timestamp} - Webhook stored successfully:`, insertedWebhook);
      } catch (dbError) {
        console.error(`${timestamp} - Database insertion failed:`, dbError);
        throw dbError;
      }

      // Notify connected clients

      const eventData = `data: ${JSON.stringify(insertedWebhook)}\n\n`;
      console.log(`${timestamp} - Broadcasting to SSE clients:`, eventData);
      clients.forEach(client => client.write(eventData));

      res.status(201).json(insertedWebhook);
    } catch (error) {
      console.error(`${timestamp} - Webhook processing error:`, error);
      res.status(500).json({
        error: "Failed to process webhook",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Fix TypeScript errors by properly typing the duplicateIds array
  app.post("/api/cleanup-duplicates", async (_req, res) => {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const allWebhooks = await db.query.webhooks.findMany({
        where: sql`${webhooks.createdAt} > ${oneWeekAgo}`,
        orderBy: [desc(webhooks.createdAt)]
      });

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

      if (duplicateIds.length > 0) {
        await db.delete(webhooks).where(sql`id = ANY(${duplicateIds})`);
      }

      res.json({ 
        message: "Cleanup completed", 
        removedCount: duplicateIds.length 
      });
    } catch (error) {
      console.error("Error during cleanup:", error);
      res.status(500).json({ error: "Failed to cleanup duplicates" });
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