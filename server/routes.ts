import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { webhooks, insertWebhookSchema } from "@db/schema";
import { desc, sql } from "drizzle-orm";
import express from "express";
import cors from "cors";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  const clients = new Set<any>();

  // Production-ready CORS configuration
  app.use(cors({
    origin: true, // Allows all origins in production
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 86400 // CORS preflight cache for 24 hours
  }));

  // Increased JSON body limit for production
  app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      // Store raw body for webhook signature verification if needed
      (req as any).rawBody = buf;
    }
  }));

  // Enhanced request logging for production
  app.use((req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    // Log request
    console.log(`[${timestamp}] Incoming ${req.method} ${req.url}`, {
      headers: req.headers,
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
      query: req.query
    });

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${timestamp}] Completed ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });

    next();
  });

  // Health check endpoint for production monitoring
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Enhanced webhook endpoint with improved error handling
  app.post("/api/webhook", async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] Processing webhook request`);

    try {
      // Validate request body against schema
      const validatedData = insertWebhookSchema.parse(req.body);
      console.log(`[${requestId}] Webhook data validated successfully`);

      try {
        // Attempt to insert the webhook
        const [webhook] = await db
          .insert(webhooks)
          .values(validatedData)
          .returning();

        console.log(`[${requestId}] Webhook stored successfully:`, webhook.id);

        // Notify connected clients
        const eventData = `data: ${JSON.stringify(webhook)}\n\n`;
        clients.forEach((client) => client.write(eventData));

        res.status(201).json(webhook);
      } catch (error: any) {
        // Handle duplicate entry error
        if (error.code === '23505') {
          console.log(`[${requestId}] Duplicate webhook detected`);
          return res.status(409).json({
            error: "Duplicate webhook",
            message: "This webhook has already been processed"
          });
        }
        throw error;
      }
    } catch (error: any) {
      console.error(`[${requestId}] Error processing webhook:`, error);
      res.status(error.errors ? 400 : 500).json({
        error: error.errors ? "Invalid webhook data" : "Failed to store webhook",
        message: error.errors || (error instanceof Error ? error.message : "Unknown error"),
        requestId
      });
    }
  });

  // Get historical webhooks
  app.get("/api/webhooks", async (req, res) => {
    try {
      const recentWebhooks = await db.query.webhooks.findMany({
        orderBy: [desc(webhooks.createdAt)],
        limit: 200
      });
      res.json(recentWebhooks);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ error: "Failed to fetch webhooks" });
    }
  });

  // Webhook count endpoint
  app.get("/api/webhooks/count", async (req, res) => {
    try {
      // Force fresh count with no cache
      res.setHeader('Cache-Control', 'no-cache');
      const result = await db.select({ 
        count: sql<number>`count(id)::int` 
      }).from(webhooks);
      
      if (!result[0]?.count && result[0]?.count !== 0) {
        throw new Error("Invalid count result");
      }
      
      res.json(result[0].count);
    } catch (error) {
      console.error("Error counting webhooks:", error);
      res.status(500).json({ error: "Failed to count webhooks" });
    }
  });
  
  // Get webhook counts for different time periods with comparisons
  app.get("/api/webhooks/stats", async (req, res) => {
    try {
      // Set simple no-cache headers
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const now = new Date();
      
      // Today calculations
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      
      // Current month calculations (1st of current month to now)
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Previous month calculations (1st to last day of previous month)
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      
      // Current week calculations (using Monday as first day of week)
      const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - daysFromMonday);
      currentWeekStart.setHours(0, 0, 0, 0);
      
      // Previous week calculations
      const previousWeekStart = new Date(currentWeekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      
      const previousWeekEnd = new Date(currentWeekStart);
      previousWeekEnd.setMilliseconds(previousWeekEnd.getMilliseconds() - 1);
      
      // Get total count
      const totalResult = await db.select({ 
        count: sql<number>`count(id)::int` 
      })
      .from(webhooks);
      
      // Today's count
      const todayResult = await db.select({ 
        count: sql<number>`count(id)::int` 
      })
      .from(webhooks)
      .where(sql`created_at >= ${todayStart.toISOString()}`);
      
      // Yesterday's count
      const yesterdayResult = await db.select({ 
        count: sql<number>`count(id)::int` 
      })
      .from(webhooks)
      .where(sql`created_at >= ${yesterdayStart.toISOString()} AND created_at < ${todayStart.toISOString()}`);
      
      // Current week's count (Monday to now)
      const currentWeekResult = await db.select({ 
        count: sql<number>`count(id)::int` 
      })
      .from(webhooks)
      .where(sql`created_at >= ${currentWeekStart.toISOString()}`);
      
      // Previous week's count (previous Monday to previous Sunday)
      const previousWeekResult = await db.select({ 
        count: sql<number>`count(id)::int` 
      })
      .from(webhooks)
      .where(sql`created_at >= ${previousWeekStart.toISOString()} AND created_at <= ${previousWeekEnd.toISOString()}`);
      
      // Current month's count (1st of month to now)
      const currentMonthResult = await db.select({ 
        count: sql<number>`count(id)::int` 
      })
      .from(webhooks)
      .where(sql`created_at >= ${currentMonthStart.toISOString()}`);
      
      // Previous month's count (1st to last day of previous month)
      const previousMonthResult = await db.select({ 
        count: sql<number>`count(id)::int` 
      })
      .from(webhooks)
      .where(sql`created_at >= ${previousMonthStart.toISOString()} AND created_at <= ${previousMonthEnd.toISOString()}`);
      
      // Calculate percentage changes
      const totalCount = totalResult[0]?.count || 0;
      const todayCount = todayResult[0]?.count || 0;
      const yesterdayCount = yesterdayResult[0]?.count || 0;
      const todayChange = yesterdayCount > 0 
        ? ((todayCount - yesterdayCount) / yesterdayCount) * 100 
        : null;
      
      const currentWeekCount = currentWeekResult[0]?.count || 0;
      const previousWeekCount = previousWeekResult[0]?.count || 0;
      const weekChange = previousWeekCount > 0 
        ? ((currentWeekCount - previousWeekCount) / previousWeekCount) * 100 
        : null;
      
      const currentMonthCount = currentMonthResult[0]?.count || 0;
      const previousMonthCount = previousMonthResult[0]?.count || 0;
      const monthChange = previousMonthCount > 0 
        ? ((currentMonthCount - previousMonthCount) / previousMonthCount) * 100 
        : null;
      
      // Generate period labels for UI
      const currentMonthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentMonthStart);
      const previousMonthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(previousMonthStart);
      
      res.json({
        total: totalCount,
        today: {
          count: todayCount,
          previous: yesterdayCount,
          change: todayChange,
          label: "Today",
          comparisonLabel: "vs Yesterday"
        },
        week: {
          count: currentWeekCount,
          previous: previousWeekCount,
          change: weekChange,
          label: "This Week",
          comparisonLabel: "vs Last Week"
        },
        month: {
          count: currentMonthCount,
          previous: previousMonthCount,
          change: monthChange,
          label: currentMonthName,
          comparisonLabel: `vs ${previousMonthName}`
        }
      });
    } catch (error) {
      console.error("Error fetching webhook stats:", error);
      res.status(500).json({ error: "Failed to fetch webhook stats" });
    }
  });

  // SSE endpoint for real-time updates
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    clients.add(res);
    req.on("close", () => clients.delete(res));
  });
  
  // Location data for globe visualization
  app.get("/api/webhooks/locations", async (req, res) => {
    try {
      const timeframe = req.query.timeframe as string || 'month';
      const now = new Date();
      let startDate: Date;
      
      // Set timeframe based on query parameter
      if (timeframe === 'day') {
        // Last 24 hours
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
      } else if (timeframe === 'week') {
        // Last 7 days
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
      } else {
        // Last 30 days (default)
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
      }
      
      // Get location data grouped by city
      const locationData = await db
        .select({
          city: webhooks.city,
          region: webhooks.region,
          country: webhooks.country,
          count: sql<number>`count(*)::int`
        })
        .from(webhooks)
        .where(sql`created_at >= ${startDate.toISOString()}`)
        .groupBy(webhooks.city, webhooks.region, webhooks.country)
        .orderBy(sql`count(*) desc`);
      
      res.json(locationData);
    } catch (error) {
      console.error("Error fetching location data:", error);
      res.status(500).json({ error: "Failed to fetch location data" });
    }
  });

  // Daily cleanup task
  const runDailyCleanup = async () => {
    try {
      console.log('[Cleanup] Starting daily webhook cleanup...');

      // Begin transaction
      await db.transaction(async (tx) => {
        // Delete duplicates keeping the most recent entry
        const deleteResult = await tx.execute(sql`
          DELETE FROM webhooks a
          USING webhooks b
          WHERE a.media_url = b.media_url 
          AND a.tweet_url = b.tweet_url
          AND a.created_at < b.created_at;
        `);

        console.log(`[Cleanup] Removed ${deleteResult.rowCount} duplicate webhooks`);
      });
    } catch (error) {
      console.error('[Cleanup] Error during webhook cleanup:', error);
    }
  };

  // Schedule daily cleanup
  setInterval(runDailyCleanup, 24 * 60 * 60 * 1000); // Run every 24 hours
  // Also run immediately on startup
  runDailyCleanup();

  return httpServer;
}