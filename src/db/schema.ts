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
  phone: text('phone'),
  companyName: text('company_name'),
  portfolioSize: text('portfolio_size'),
  primaryMarket: text('primary_market'),
  currentAddress: text('current_address'),
  monthlyIncome: text('monthly_income'),
  employmentStatus: text('employment_status'),
  moveInDate: text('move_in_date'),
  occupantsCount: integer('occupants_count'),
  hasPets: text('has_pets'),
  tradeSpecialty: text('trade_specialty'),
  hourlyRate: text('hourly_rate'),
  propertyTypes: text('property_types'),
  managementFee: text('management_fee'),
  serviceRadius: text('service_radius'),
  emergencyDispatch: text('emergency_dispatch'),
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
