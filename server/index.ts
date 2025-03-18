import express from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Trust proxy settings for IP handling
app.set("trust proxy", true);

// Enhanced request logging for production
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);

  // Log request details in production for debugging
  if (process.env.NODE_ENV === 'production') {
    console.log('Request Headers:', req.headers);
    if (req.method === 'POST') {
      console.log('Request Body:', JSON.stringify(req.body));
    }
  }

  next();
});

(async () => {
  const server = registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error details in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[Error]', {
        status,
        message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
    }

    res.status(status).json({ message });
  });

  // Setup middleware based on environment
  if (process.env.NODE_ENV === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use port from environment or default to 5000
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, "0.0.0.0", () => {
    log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
})();