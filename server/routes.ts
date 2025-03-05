import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { webhooks } from "@db/schema";
import { desc, and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import express from "express";

const webhookItemSchema = z.object({
  userId: z.string(),
  mediaUrl: z.string().url(),
  mediaType: z.string(),
  spaceName: z.string(),
  tweetUrl: z.string(),
  ip: z.string(),
  city: z.string(),
  region: z.string(),
  country: z.string(),
});

// Schema that accepts either a single webhook or an array of webhooks
const webhookSchema = z.union([
  webhookItemSchema,
  z.array(webhookItemSchema)
]);

// Type for sanitized webhook data
type SanitizedWebhook = {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: string;
  spaceName: string;
  tweetUrl: string;
  city: string;
  country: string;
  createdAt: Date;
};

// Function to sanitize webhook data
function sanitizeWebhook(webhook: any): SanitizedWebhook {
  return {
    id: webhook.id,
    userId: webhook.userId,
    mediaUrl: webhook.mediaUrl,
    mediaType: webhook.mediaType,
    spaceName: webhook.spaceName,
    tweetUrl: webhook.tweetUrl,
    city: webhook.city,
    country: webhook.country,
    createdAt: webhook.createdAt,
  };
}

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  const clients = new Set<any>();

  // Configure raw body parsing for webhooks
  app.use(express.raw({ type: "application/json" }));
  app.use(express.text());

  // Add CORS headers middleware for webhook endpoint
  app.use((req, res, next) => {
    // Allow both production and development environments
    const allowedOrigins = [
      'https://download-spaces.replit.app',
      'http://localhost:5000',
      'http://localhost:3000'
    ];

    const origin = req.headers.origin;
    if (origin) {
      // Allow any Replit preview URL
      if (origin.endsWith('.replit.dev') || allowedOrigins.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
      }
    }

    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  app.get("/api/webhooks/count", async (_req, res) => {
    try {
      const result = await db
        .select({
          count: sql<number>`COUNT(DISTINCT (${webhooks.tweetUrl}, ${webhooks.spaceName}, ${webhooks.ip}))`,
        })
        .from(webhooks);

      res.json(result[0].count);
    } catch (error) {
      console.error("Error fetching unique webhook count:", error);
      res.status(500).json({ error: "Failed to fetch unique webhook count" });
    }
  });

  app.get("/api/webhooks", async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;

      // Get webhooks filtered by userId if specified
      const recentWebhooks = await db.query.webhooks.findMany({
        where: userId ? eq(webhooks.userId, userId) : undefined,
        orderBy: [desc(webhooks.createdAt)],
        limit: 200,
      });

      // Create a Map to store unique entries, prioritizing most recent
      const uniqueMap = new Map<string, typeof recentWebhooks[0]>();

      // Process webhooks to ensure uniqueness
      recentWebhooks.forEach((webhook) => {
        const key = `${webhook.ip}-${webhook.spaceName}-${webhook.tweetUrl}`;
        if (!uniqueMap.has(key) || new Date(webhook.createdAt) > new Date(uniqueMap.get(key)!.createdAt)) {
          uniqueMap.set(key, webhook);
        }
      });

      // Convert Map values back to array and sort by createdAt
      const uniqueWebhooks = Array.from(uniqueMap.values())
        .map(sanitizeWebhook)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(uniqueWebhooks);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ error: "Failed to fetch webhooks" });
    }
  });

  app.post("/api/webhook", async (req, res) => {
    console.log("[Webhook] Received incoming webhook request", {
      url: req.url,
      method: req.method,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      origin: req.headers['origin'],
      host: req.headers['host'],
      userAgent: req.headers['user-agent'],
      rawBody: typeof req.body === 'string' ? req.body : (Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body))
    });

    try {
      // Parse body based on content type
      let parsedBody;
      try {
        if (typeof req.body === "string") {
          parsedBody = JSON.parse(req.body);
        } else if (Buffer.isBuffer(req.body)) {
          parsedBody = JSON.parse(req.body.toString());
        } else {
          parsedBody = req.body;
        }
        console.log("[Webhook] Successfully parsed request body:", {
          count: Array.isArray(parsedBody) ? parsedBody.length : 1,
          sample: Array.isArray(parsedBody) ? 
            { userId: parsedBody[0]?.userId, spaceName: parsedBody[0]?.spaceName } :
            { userId: parsedBody?.userId, spaceName: parsedBody?.spaceName }
        });
      } catch (parseError) {
        console.error("[Webhook] Failed to parse request body:", parseError, {
          receivedBody: typeof req.body === 'string' ? req.body : (Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body))
        });
        return res.status(400).json({ 
          error: "Invalid JSON in request body",
          details: (parseError as Error).message,
          receivedContentType: req.headers['content-type']
        });
      }

      // Validate webhook data
      let validatedData;
      try {
        validatedData = webhookSchema.parse(parsedBody);
        console.log("[Webhook] Data validation successful", {
          isArray: Array.isArray(validatedData),
          count: Array.isArray(validatedData) ? validatedData.length : 1
        });
      } catch (validationError) {
        console.error("[Webhook] Schema validation failed:", validationError);
        return res.status(400).json({
          error: "Invalid webhook data structure",
          details: (validationError as Error).message
        });
      }

      // Convert to array if single object
      const webhooksToProcess = Array.isArray(validatedData) ? validatedData : [validatedData];
      const results = [];

      for (const webhookData of webhooksToProcess) {
        // Check for recent duplicates using the indexed fields
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const existingEntry = await db.query.webhooks.findFirst({
          where: and(
            eq(webhooks.ip, webhookData.ip),
            eq(webhooks.spaceName, webhookData.spaceName),
            eq(webhooks.tweetUrl, webhookData.tweetUrl),
            sql`${webhooks.createdAt} > ${twentyFourHoursAgo}`,
          ),
          orderBy: [desc(webhooks.createdAt)],
        });

        if (existingEntry) {
          console.log("[Webhook] Duplicate webhook detected", {
            ip: webhookData.ip,
            spaceName: webhookData.spaceName,
            tweetUrl: webhookData.tweetUrl
          });
          results.push({
            status: "duplicate",
            webhook: sanitizeWebhook(existingEntry),
          });
          continue;
        }

        // If no duplicate found, proceed with insertion
        const [insertedWebhook] = await db
          .insert(webhooks)
          .values(webhookData)
          .returning();

        console.log("[Webhook] Successfully inserted new webhook", {
          id: insertedWebhook.id,
          userId: insertedWebhook.userId,
          spaceName: insertedWebhook.spaceName
        });

        // Notify connected clients with sanitized data
        const sanitizedWebhook = sanitizeWebhook(insertedWebhook);
        const eventData = `data: ${JSON.stringify(sanitizedWebhook)}\n\n`;
        clients.forEach((client) => client.write(eventData));

        results.push({
          status: "created",
          webhook: sanitizedWebhook,
        });
      }

      res.status(201).json(results);
    } catch (error) {
      console.error("[Webhook] Error processing webhook:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to process webhook",
        message: errorMessage,
      });
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