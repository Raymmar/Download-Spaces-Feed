import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { webhooks } from "@db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";
import express from "express";

const webhookSchema = z.object({
  userId: z.string().min(1, "User ID is required and cannot be empty"),
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
        return res.status(400).json({ 
          error: "Invalid JSON in request body",
          details: "Please ensure the request body is valid JSON and includes a non-empty userId"
        });
      }

      // Ensure we have a body
      if (!parsedBody || Object.keys(parsedBody).length === 0) {
        console.error(`${timestamp} - Empty request body received`);
        return res.status(400).json({ error: "Request body is empty" });
      }

      // Specifically check for userId
      if (!parsedBody.userId || parsedBody.userId === "unknown" || parsedBody.userId.trim() === "") {
        console.error(`${timestamp} - Invalid or missing userId in request`);
        return res.status(400).json({ 
          error: "Invalid webhook data",
          details: "userId is required and cannot be 'unknown' or empty"
        });
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

      // Attempt to insert into database
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