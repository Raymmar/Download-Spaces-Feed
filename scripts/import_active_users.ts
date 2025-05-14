import { readFileSync } from 'fs';
import path from 'path';
import { db } from '../db';
import { activeUsers } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Script to import active user data from a CSV file into the database
 * Handles data deduplication by using upserts
 * 
 * Usage:
 *   npm run import-users -- path/to/your/csv/file.csv
 * 
 * The CSV file should have:
 * 1. A header row with "Date,Weekly users" format
 * 2. Data rows with dates in MM/DD/YY format and user counts
 */

async function importActiveUsers(filePath: string) {
  try {
    console.log(`Loading CSV from: ${filePath}`);
    const fileContent = readFileSync(filePath, 'utf-8');
    
    // Parse CSV content
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    // Skip the header lines (first two lines in the CSV format from Chrome Web Store)
    const headerLine = lines[0];
    if (!headerLine.includes('Weekly users over time')) {
      console.warn('Warning: CSV may not be in the expected format. First line should contain "Weekly users over time"');
    }
    
    // Data starts from line 2 (index 1)
    const dataRows = lines.slice(2);
    console.log(`Found ${dataRows.length} data rows`);
    
    // Parse each row and prepare data for import
    const records = dataRows.map(row => {
      const [dateStr, userCountStr] = row.split(',');
      
      // Parse date (MM/DD/YY format)
      const parts = dateStr.split('/');
      if (parts.length !== 3) {
        throw new Error(`Invalid date format: ${dateStr}`);
      }
      
      const month = parseInt(parts[0]);
      const day = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      
      // Standardize the date format for database (YYYY-MM-DD)
      // Chrome store data uses 2-digit years, so we add 2000 to get the full year
      const fullYear = year >= 100 ? year : 2000 + year;
      const formattedDate = `${fullYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      
      // Parse user count
      const userCount = parseInt(userCountStr);
      if (isNaN(userCount)) {
        throw new Error(`Invalid user count: ${userCountStr}`);
      }
      
      return {
        date: formattedDate,
        userCount,
      };
    })
    // Filter out entries with 0 users as requested
    .filter(record => record.userCount > 0);
    
    // Using a transaction to ensure data consistency
    await db.transaction(async (tx) => {
      // Process rows in batches to avoid statement size limits
      const batchSize = 100;
      
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        // Upsert the records (insert or update if exists)
        const result = await tx.insert(activeUsers)
          .values(batch)
          .onConflictDoUpdate({
            target: activeUsers.date,
            set: {
              userCount: sql`excluded.user_count`,
              updatedAt: new Date()
            }
          });
        
        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
      }
    });
    
    console.log('Import completed successfully');
    
    // Log some statistics for verification
    const countResult = await db.select({
      count: sql<number>`count(*)`
    }).from(activeUsers);
    
    console.log(`Total active user records in database: ${countResult[0].count}`);
    
    // Get most recent record for verification
    const latestRecord = await db.select().from(activeUsers).orderBy(sql`date desc`).limit(1);
    if (latestRecord.length > 0) {
      console.log(`Most recent record: ${latestRecord[0].date} - ${latestRecord[0].userCount} users`);
    }
    
  } catch (error) {
    console.error('Error importing active users:', error);
    process.exit(1);
  }
}

// Get the file path from command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Please provide a path to the CSV file');
  console.error('Usage: npm run import-users -- path/to/your/csv/file.csv');
  process.exit(1);
}

const filePath = path.resolve(args[0]);
importActiveUsers(filePath).then(() => process.exit(0));