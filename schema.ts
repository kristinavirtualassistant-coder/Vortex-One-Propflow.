// src/db/schema.ts
import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Define the 'users' table.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const financialMetrics = pgTable('financial_metrics', {
  id: serial('id').primaryKey(),
  month: text('month').notNull(),
  revenue: integer('revenue').notNull(),
  occupancyRate: integer('occupancy_rate').notNull(),
});

export const properties = pgTable('properties', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  units: integer('units').notNull(),
  status: text('status').notNull(),
});
