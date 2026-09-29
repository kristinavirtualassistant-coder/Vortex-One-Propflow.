import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
  date,
} from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
  slug: varchar('slug').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: varchar('id').primaryKey(),
  organizationId: varchar('organization_id').notNull(),
  email: varchar('email').notNull(),
  name: varchar('name').notNull(),
  role: varchar('role').notNull().default('member'),
  passwordHash: text('password_hash'),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authSessions = pgTable('auth_sessions', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  tokenHash: varchar('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const properties = pgTable('properties', {
  id: varchar('id').primaryKey(),
  organizationId: varchar('organization_id').notNull(),
  ownerId: varchar('owner_id'),
  address: varchar('address').notNull(),
  city: varchar('city').notNull(),
  state: varchar('state').notNull(),
  zip: varchar('zip').notNull(),
  county: varchar('county').notNull(),
  apn: varchar('apn').notNull(),
  propertyType: varchar('property_type').notNull(),
  unitsCount: integer('units_count').notNull().default(1),
  squareFeet: integer('square_feet').notNull().default(0),
  yearBuilt: integer('year_built'),
  estimatedValue: numeric('estimated_value').notNull().default('0'),
  assessedTaxValue: numeric('assessed_tax_value').notNull().default('0'),
  estimatedEquity: numeric('estimated_equity').notNull().default('0'),
  mortgageBalance: numeric('mortgage_balance').notNull().default('0'),
  isAbsenteeOwner: boolean('is_absentee_owner').notNull().default(false),
  isCorporateOwned: boolean('is_corporate_owned').notNull().default(false),
  taxDelinquent: boolean('tax_delinquent').notNull().default(false),
  lastSaleDate: date('last_sale_date'),
  lastSalePrice: numeric('last_sale_price'),
  provenance: jsonb('provenance').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const propertyOwners = pgTable('property_owners', {
  id: varchar('id').primaryKey(),
  organizationId: varchar('organization_id').notNull(),
  name: varchar('name').notNull(),
  entityType: varchar('entity_type').notNull().default('individual'),
  mailingAddress: varchar('mailing_address'),
  mailingCity: varchar('mailing_city'),
  mailingState: varchar('mailing_state'),
  mailingZip: varchar('mailing_zip'),
  phoneNumbers: jsonb('phone_numbers').notNull().default([]),
  emailAddresses: jsonb('email_addresses').notNull().default([]),
  propertiesOwnedCount: integer('properties_owned_count').notNull().default(1),
  totalPortfolioValue: numeric('total_portfolio_value').notNull().default('0'),
  totalPortfolioEquity: numeric('total_portfolio_equity').notNull().default('0'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const leads = pgTable('leads', {
  id: varchar('id').primaryKey(),
  organizationId: varchar('organization_id').notNull(),
  ownerId: varchar('owner_id'),
  primaryPropertyId: varchar('primary_property_id'),
  leadScore: integer('lead_score').notNull().default(0),
  classification: varchar('classification').notNull().default('nurture'),
  factors: jsonb('factors').notNull().default([]),
  stage: varchar('stage').notNull().default('identified'),
  assignedAgent: varchar('assigned_agent').notNull().default('sub_agent_2'),
  dncCompliant: boolean('dnc_compliant').notNull().default(true),
  lastActivityDate: timestamp('last_activity_date', { withTimezone: true }).notNull().defaultNow(),
  nextRecommendedAction: text('next_recommended_action'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
