import { pgTable, text, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const webhooks = pgTable("webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").notNull(),
  spaceName: text("space_name").notNull(),
  tweetUrl: text("tweet_url").notNull(),
  ip: text("ip").notNull(),
  city: text("city").notNull(),
  region: text("region").notNull(),
  country: text("country").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => {
  return {
    // Change to uniqueIndex to prevent duplicates
    duplicateCheckIdx: uniqueIndex("duplicate_check_idx").on(
      table.ip,
      table.spaceName,
      table.tweetUrl,
      table.createdAt
    )
  };
});

export const insertWebhookSchema = createInsertSchema(webhooks);
export const selectWebhookSchema = createSelectSchema(webhooks);
export type InsertWebhook = typeof webhooks.$inferInsert;
export type SelectWebhook = typeof webhooks.$inferSelect;