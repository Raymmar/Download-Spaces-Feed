import { db } from "../db";
import { webhooks } from "../db/schema";
import { sql } from "drizzle-orm";

/**
 * Script to clean up old/invalid webhook data
 * This will remove all records from before March 18, 2025
 */
async function cleanupOldData() {
  console.log("Starting data cleanup...");
  
  // Get count before deletion
  const beforeCount = await db.select({
    count: sql<number>`count(id)::int`
  }).from(webhooks);
  
  console.log(`Total records before cleanup: ${beforeCount[0]?.count || 0}`);
  
  // Count records to be deleted (before March 18, 2025)
  const toDeleteCount = await db.select({
    count: sql<number>`count(id)::int`
  })
  .from(webhooks)
  .where(sql`created_at < '2025-03-18'`);
  
  console.log(`Records to be deleted: ${toDeleteCount[0]?.count || 0}`);
  
  // Execute deletion
  const deleteResult = await db.delete(webhooks)
    .where(sql`created_at < '2025-03-18'`);
  
  // Get count after deletion
  const afterCount = await db.select({
    count: sql<number>`count(id)::int`
  }).from(webhooks);
  
  console.log(`Total records after cleanup: ${afterCount[0]?.count || 0}`);
  console.log(`Deleted ${beforeCount[0]?.count - afterCount[0]?.count} records`);
  console.log("Cleanup completed successfully");
}

// Run the cleanup function
cleanupOldData()
  .then(() => {
    console.log("Script execution completed, exiting...");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error during cleanup:", error);
    process.exit(1);
  });