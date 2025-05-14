import { pgTable, text, uuid, timestamp, uniqueIndex, date, integer } from "drizzle-orm/pg-core";
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
    // Update unique index to include mediaUrl and remove createdAt
    duplicateCheckIdx: uniqueIndex("duplicate_check_idx").on(
      table.mediaUrl,
      table.tweetUrl
    )
  };
});

export const activeUsers = pgTable("active_users", {
  date: date("date").primaryKey(),
  userCount: integer("user_count").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertWebhookSchema = createInsertSchema(webhooks);
export const selectWebhookSchema = createSelectSchema(webhooks);
export type InsertWebhook = typeof webhooks.$inferInsert;
export type SelectWebhook = typeof webhooks.$inferSelect;

export const insertActiveUserSchema = createInsertSchema(activeUsers);
export const selectActiveUserSchema = createSelectSchema(activeUsers);
export type InsertActiveUser = typeof activeUsers.$inferInsert;
export type SelectActiveUser = typeof activeUsers.$inferSelect;