import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("active"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow(),
  lastActive: timestamp("last_active"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  senderId: integer("sender_id").notNull(),
  channelId: text("channel_id"),
  recipientId: integer("recipient_id"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const files = pgTable("files", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  uploaderId: integer("uploader_id").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  channel: text("channel"),
  sharedWith: text("shared_with").array(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  path: text("path").notNull(),
});

export const logs = pgTable("logs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  action: text("action").notNull(),
  userId: integer("user_id"),
  details: text("details").notNull(),
  ip: text("ip").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  severity: text("severity").notNull().default("info"),
});

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
