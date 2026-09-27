import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  profileComplete: integer('profile_complete').notNull().default(0),
  authProvider: text('auth_provider').notNull().default('password'),
  authProviderSubject: text('auth_provider_subject'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow(),
});


export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const financialMetrics = pgTable('financial_metrics', {
  id: serial('id').primaryKey(),
  month: text('month').notNull(),
  revenue: integer('revenue').notNull(),
  occupancyRate: integer('occupancy_rate').notNull(),
});
