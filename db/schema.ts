import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const webhooks = pgTable("webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  playlistUrl: text("playlist_url").notNull(),
  spaceName: text("space_name").notNull(),
  tweetUrl: text("tweet_url").notNull(),
  ip: text("ip").notNull(),
  city: text("city").notNull(),
  region: text("region").notNull(),
  country: text("country").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertWebhookSchema = createInsertSchema(webhooks);
export const selectWebhookSchema = createSelectSchema(webhooks);
export type InsertWebhook = typeof webhooks.$inferInsert;
export type SelectWebhook = typeof webhooks.$inferSelect;
