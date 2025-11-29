import { sql } from "drizzle-orm";
import { mysqlTable, text, varchar, int, timestamp, json, boolean } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  credits: int("credits").notNull().default(10),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Generations table - stores AI image generation requests
export const generations = mysqlTable("generations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  prompt: text("prompt").notNull(),
  style: varchar("style", { length: 50 }).notNull(),
  quality: varchar("quality", { length: 20 }).notNull().default("medium"),
  imageUrl: text("image_url"),
  creditsUsed: int("credits_used").notNull().default(1),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
});

export const generationSchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  style: z.enum(["portrait", "fashion", "editorial", "commercial"]),
  quality: z.enum(["low", "medium", "high"]).optional(),
});

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type InsertGeneration = typeof generations.$inferInsert;
