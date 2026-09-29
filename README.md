# Vortex One PropFlow — Property Intelligence Platform

**Vortex One PropFlow** is a multi-tenant property intelligence platform for authenticated users, property data, owner intelligence, lead scoring, search, and AI-assisted workflows.

---

## 🌟 Key Features & Role-Based Portals

### 🏢 1. Property Manager Portal
- **Portfolio Oversight**: Real-time occupancy rates, lease renewals, and rent collection health.
- **Tenant Screening & Leases**: Automated application processing, lease generation, and verification tracking.
- **Vendor & Maintenance Dispatch**: Unified ticket triage, priority assignment, and contractor dispatching.
- **Document Management**: Secure file vault for leases, inspection sheets, and compliance docs.

### 🏠 2. Landlord / Owner Portal
- **Financial Performance & Analytics**: Net Operating Income (NOI), cap rate tracking, and payout schedules.
- **Unit Breakdown**: Property valuation summaries, expense categorization, and tax documentation.
- **Direct Manager Sync**: Transparency into active work orders and tenant turnover.

### 🛋️ 3. Tenant Resident Portal
- **Online Rent Payments**: Automated recurring payments, receipt generation, and transaction history.
- **Maintenance Ticketing**: Instant request submission with photo attachments, status updates, and emergency flags.
- **Community & Amenities**: Resident announcements, utility tracking, and direct landlord communication.

### 🔧 4. Contractor & Technician Portal
- **Mobile-First Work Orders**: Field ticket status updates (Pending, In Progress, Resolved).
- **Job Costing & Time Logs**: Material tracking, labor hours, and invoice submissions.
- **Priority Filtering**: Emergency dispatch alerts with location details.

### 🛡️ 5. System Admin & Operations
- **Security & Governance**: Role-based access control (RBAC), authentication audit logs, and session management.
- **Global Search & Directory**: Fast lookup across all properties, tenants, and contractor rosters.

### 🤖 6. AI Assistant & Intelligence Layer
- **Gemini-Powered Assistant**: Server-side AI assistant for property analysis, lease drafting, and triage.
- **Grounding Support**: Google Search and Maps capabilities for location insights and market research.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Recharts |
| **Backend / API** | Node.js, Express, tsx |
| **Authentication & Realtime** | Supabase PostgreSQL-backed sessions and canonical multi-tenant application data, without fabricated demo data |
| **AI Integration** | Google GenAI SDK (`@google/genai`) with Gemini models |
| **Database** | PostgreSQL / Drizzle ORM |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **npm 10+**

### 2. Installation

Clone the repository and install dependencies:

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file based on `.env.example`.

For hosted deployments, set `DATABASE_URL`, `APP_URL`, and the OAuth/AI secrets in the deployment environment. Do not commit real credentials. Do not commit real credentials.


### 4. Database contract

Vortex One PropFlow uses the canonical Supabase production schema. The application verifies the required tables on startup and does not run schema-changing SQL during requests or cold starts. Database changes must be tracked as Supabase migrations.

Property, owner, lead, and user records are organization-scoped.

### 5. Running the Development Server

Start the full-stack dev server (Express + Vite):

```bash
npm run dev
```

The app will be accessible at `http://localhost:3000`.

### 6. Production Build

Build the frontend assets:

```bash
npm run build
```

---

## 🔐 Authentication

PropFlow does not ship with fabricated user accounts, demo personas, sample properties, or seeded portfolio records. User and property data must be created by authenticated users or loaded from connected production data sources.


## 🔒 Security & Best Practices
- **Server-Side API Keys**: All AI and third-party API credentials remain strictly server-side.
- **Role-Based Access**: Granular permission checks ensure users access only their authorized portals.
- **Parameterized Queries**: Secure SQL queries through Drizzle ORM prevent injection vulnerabilities.


## Validation

The repository uses npm as its package manager. CI runs:

```bash
npm ci
npm run typecheck
npm run build
```

There is currently no application test suite wired into CI. Adding one is tracked as engineering follow-up work.

## Database migrations

The repository contains legacy property-intelligence migrations alongside the newer organization-scoped PostgreSQL schema. These histories are not interchangeable. Do not apply `db/migrations/001_property_intelligence.sql` and `002_postgis_property_spatial.sql` blindly to production until they are reconciled with the canonical schema in `src/db/schema.ts`.

### 3Min API integration

PropFlow can receive integration events from 3Min API at `POST /api/integrations/3min/webhook`. The receiver requires an organization-scoped `organization_id` and supports HMAC or bearer/token authentication. Duplicate deliveries can be suppressed with an `idempotency_key`.

Set `THREEMIN_WEBHOOK_SECRET` or `THREEMIN_WEBHOOK_TOKEN` in the deployment environment. Keep webhook credentials server-side and configure the matching value in 3Min API.
