import { integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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
