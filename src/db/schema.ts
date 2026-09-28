import { integer, pgTable, serial, text, timestamp, numeric, boolean, doublePrecision, jsonb } from 'drizzle-orm/pg-core';

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

export const owners = pgTable('property_owners', {
  id: serial('id').primaryKey(),
  canonicalName: text('canonical_name').notNull(),
  ownerType: text('owner_type').notNull().default('person'),
  normalizedName: text('normalized_name'),
  mailingAddress: text('mailing_address'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  source: text('source'),
  sourceRecordId: text('source_record_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const properties = pgTable('properties', {
  id: serial('id').primaryKey(),
  apn: text('apn'),
  fips: text('fips'),
  state: text('state'),
  county: text('county'),
  addressLine1: text('address_line1'),
  city: text('city'),
  postalCode: text('postal_code'),
  propertyType: text('property_type'),
  bedrooms: numeric('bedrooms'),
  bathrooms: numeric('bathrooms'),
  livingSqft: integer('living_sqft'),
  lotSqft: integer('lot_sqft'),
  yearBuilt: integer('year_built'),
  assessedValue: numeric('assessed_value'),
  estimatedValue: numeric('estimated_value'),
  estimatedRent: numeric('estimated_rent'),
  lastSalePrice: numeric('last_sale_price'),
  lastSaleDate: timestamp('last_sale_date'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  vacancyStatus: text('vacancy_status'),
  ownerOccupied: boolean('owner_occupied'),
  taxDelinquent: boolean('tax_delinquent').notNull().default(false),
  preForeclosure: boolean('pre_foreclosure').notNull().default(false),
  foreclosure: boolean('foreclosure').notNull().default(false),
  probate: boolean('probate').notNull().default(false),
  lienCount: integer('lien_count').notNull().default(0),
  mortgageBalance: numeric('mortgage_balance'),
  rawData: jsonb('raw_data').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const propertyOwners = pgTable('property_owner_links', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id').notNull(),
  ownerId: integer('owner_id').notNull(),
  ownershipPercent: numeric('ownership_percent'),
  role: text('role').notNull().default('owner'),
  source: text('source'),
});

export const propertySources = pgTable('property_sources', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id'),
  source: text('source').notNull(),
  sourceRecordId: text('source_record_id'),
  retrievedAt: timestamp('retrieved_at').defaultNow(),
  effectiveDate: timestamp('effective_date'),
  confidence: numeric('confidence'),
  recordHash: text('record_hash'),
});

export const propertyLeads = pgTable('property_leads', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  propertyId: integer('property_id').notNull(),
  score: integer('score').notNull().default(0),
  reasons: jsonb('reasons').notNull().default([]),
  status: text('status').notNull().default('new'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const savedPropertySearches = pgTable('saved_property_searches', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  name: text('name').notNull(),
  filters: jsonb('filters').notNull().default({}),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});
