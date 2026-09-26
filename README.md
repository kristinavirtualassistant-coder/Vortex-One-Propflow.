# PropFlow — Next-Gen Property Management Platform

**PropFlow** is an all-in-one property management ecosystem uniting Property Managers, Landlords, Tenants, and Field Contractors into a unified, real-time operating platform.

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
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Motion, Lucide Icons, Recharts |
| **Backend / API** | Node.js, Express, tsx, esbuild |
| **Authentication & Realtime** | Firebase Auth & Firestore, with built-in instant demo simulation fallback |
| **AI Integration** | Google GenAI SDK (`@google/genai`) with Gemini models |
| **Database** | PostgreSQL / Drizzle ORM |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **npm** or **bun**

### 2. Installation

Clone the repository and install dependencies:

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file based on `.env.example`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=postgresql://user:password@localhost:5432/propflow
```

### 4. Running the Development Server

Start the full-stack dev server (Express + Vite):

```bash
npm run dev
```

The app will be accessible at `http://localhost:3000`.

### 5. Production Build

Compile both frontend assets and backend server bundle:

```bash
npm run build
npm start
```

---

## 🔑 Demo Personas & Instant Sign-In

For testing and demonstration, you can log in with one click as any of the built-in personas directly from the landing page or login modal:

- **Property Manager**: `alex.pm@propflow.io`
- **Landlord**: `sarah.landlord@propflow.io`
- **Tenant**: `david.tenant@propflow.io`
- **Technician**: `marcus.tech@propflow.io`
- **Admin**: `admin@propflow.io`

---

## 🔒 Security & Best Practices
- **Server-Side API Keys**: All AI and third-party API credentials remain strictly server-side.
- **Role-Based Access**: Granular permission checks ensure users access only their authorized portals.
- **Parameterized Queries**: Secure SQL queries through Drizzle ORM prevent injection vulnerabilities.
