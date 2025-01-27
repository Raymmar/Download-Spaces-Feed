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

      // Get the most recent duplicate entry if it exists
      const existingEntry = await db.query.webhooks.findFirst({
        where: and(
          eq(webhooks.ip, validatedData.ip),
          eq(webhooks.spaceName, validatedData.spaceName),
          eq(webhooks.tweetUrl, validatedData.tweetUrl),
          sql`${webhooks.createdAt} > ${twentyFourHoursAgo}`
        ),
        orderBy: [desc(webhooks.createdAt)]
      });

      if (existingEntry) {
        console.log(`${timestamp} - Duplicate webhook detected within 24 hours`);
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

  app.get("/api/webhooks", async (_req, res) => {
    try {
      // Get the most recent unique webhooks using a similar approach to the count endpoint
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // First, get the distinct combinations with their latest timestamp
      const distinctWebhooks = await db
        .select({
          tweetUrl: webhooks.tweetUrl,
          spaceName: webhooks.spaceName,
          ip: webhooks.ip,
          maxCreatedAt: sql<Date>`MAX(${webhooks.createdAt})`
        })
        .from(webhooks)
        .where(sql`${webhooks.createdAt} > ${twentyFourHoursAgo}`)
        .groupBy(webhooks.tweetUrl, webhooks.spaceName, webhooks.ip)
        .orderBy(sql`MAX(${webhooks.createdAt}) DESC`)
        .limit(200);

      // Then get the full webhook details for these distinct combinations
      const uniqueWebhooks = await Promise.all(
        distinctWebhooks.map(async (distinct) => {
          const webhook = await db.query.webhooks.findFirst({
            where: and(
              eq(webhooks.tweetUrl, distinct.tweetUrl),
              eq(webhooks.spaceName, distinct.spaceName),
              eq(webhooks.ip, distinct.ip),
              eq(webhooks.createdAt, distinct.maxCreatedAt)
            )
          });
          return webhook;
        })
      );

      // Filter out any null values and send response
      res.json(uniqueWebhooks.filter(Boolean));
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