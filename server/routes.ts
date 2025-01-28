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
  country: z.string(),
});

// Type for sanitized webhook data
type SanitizedWebhook = {
  id: string;
  userId: string;
  playlistUrl: string;
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
    playlistUrl: webhook.playlistUrl,
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
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");

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

  app.post("/api/webhook", async (req, res) => {
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
      } catch (parseError) {
        return res.status(400).json({ error: "Invalid JSON in request body" });
      }

      // Validate webhook data
      const validatedData = webhookSchema.parse(parsedBody);

      // Check for recent duplicates using the indexed fields
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const existingEntry = await db.query.webhooks.findFirst({
        where: and(
          eq(webhooks.ip, validatedData.ip),
          eq(webhooks.spaceName, validatedData.spaceName),
          eq(webhooks.tweetUrl, validatedData.tweetUrl),
          sql`${webhooks.createdAt} > ${twentyFourHoursAgo}`,
        ),
        orderBy: [desc(webhooks.createdAt)],
      });

      if (existingEntry) {
        return res.status(200).json({
          message: "Duplicate webhook detected",
          webhook: sanitizeWebhook(existingEntry),
        });
      }

      // If no duplicate found, proceed with insertion
      const [insertedWebhook] = await db
        .insert(webhooks)
        .values(validatedData)
        .returning();

      // Notify connected clients with sanitized data
      const sanitizedWebhook = sanitizeWebhook(insertedWebhook);
      const eventData = `data: ${JSON.stringify(sanitizedWebhook)}\n\n`;
      clients.forEach((client) => client.write(eventData));

      res.status(201).json(sanitizedWebhook);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to process webhook",
        message: errorMessage,
      });
    }
  });

  app.get("/api/webhooks", async (_req, res) => {
    try {
      // Get the most recent 200 webhooks
      const recentWebhooks = await db.query.webhooks.findMany({
        orderBy: [desc(webhooks.createdAt)],
        limit: 200,
      });

      // Use a Map to keep track of unique combinations and their most recent entries
      const uniqueMap = new Map<string, (typeof recentWebhooks)[0]>();

      recentWebhooks.forEach((webhook) => {
        const key = `${webhook.ip}-${webhook.spaceName}-${webhook.tweetUrl}`;

        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, webhook);
        } else {
          const existing = uniqueMap.get(key)!;
          if (new Date(webhook.createdAt) > new Date(existing.createdAt)) {
            uniqueMap.set(key, webhook);
          }
        }
      });

      // Convert Map values back to array, sanitize, and sort by createdAt
      const uniqueWebhooks = Array.from(uniqueMap.values())
        .map(sanitizeWebhook)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

      res.json(uniqueWebhooks);
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