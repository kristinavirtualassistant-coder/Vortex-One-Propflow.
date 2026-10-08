import { BUSINESS_ADDRESS, CONTACT_EMAIL, LEGAL_ENTITY, LEGAL_UPDATED, PRIVACY_CONTACT_EMAIL } from '../config';

export interface LegalSection {
  h: string;
  p?: string[];
  li?: string[];
}

export interface LegalDoc {
  slug: string;
  navLabel: string;
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
}

const E = LEGAL_ENTITY;
const MAIL = CONTACT_EMAIL;
const PRIVACY = PRIVACY_CONTACT_EMAIL;
const ADDRESS = BUSINESS_ADDRESS;
const ADDRESS = BUSINESS_ADDRESS;

/*
 * Drafts reflecting how the product works today (simulated dialer, rule-based agents,
 * no email/SMS sending, no billing). Not legal advice: have counsel review before launch.
 */
export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'privacy',
    navLabel: 'Privacy policy',
    title: 'Privacy policy',
    updated: LEGAL_UPDATED,
    sections: [
      { h: 'Who we are', p: [
        `Vortex One is a property intelligence, CRM and dialer platform operated by ${E} ("we", "us"). This policy explains what personal information we handle, why, and the choices you have.`,
        'It covers customers who create an account, and the property owners and other contacts whose information our customers add to their workspace.',
      ] },
      { h: 'Information we collect', p: ['Depending on how you use Vortex One:'], li: [
        'Account information: your name, email, role, company and other profile details you provide, and a hashed password. If you sign in with Google or Microsoft, we receive your name, email and profile picture from that provider.',
        'Workspace data you add or generate: properties, owners, contacts, leads, notes, tags, tasks, campaigns, workflows and the activity log.',
        'Call records: numbers, call state, outcome, notes and follow-up tasks. Calls in Vortex One are currently simulated, so no calls are placed and no audio is recorded.',
        'Assistant and analysis requests: if you use the optional AI assistant, the text you submit is sent to our AI model provider to produce a response.',
        'Usage and device data: log data, IP address, browser type and the session cookie needed to keep you signed in.',
        'Messages you send us, such as support or demo requests.',
      ] },
      { h: 'How we use information', li: [
        'Provide, maintain and secure Vortex One, including scoring, CRM, dialing simulation and workflow features.',
        'Honor do-not-call and removal requests and keep suppression lists current.',
        'Provide support, send service notices and respond to requests.',
        'Improve reliability and features, and detect fraud and abuse.',
        'Meet legal obligations and enforce our terms.',
      ] },
      { h: 'Customer data and property owner data', p: [
        "Customers decide which owner and contact records to add and who to contact. For that data we act on the customer's instructions, and each customer is responsible for having a lawful basis to hold and contact those people.",
        `If you are a property owner or contact and want your information removed or no longer want to be contacted, tell the customer who contacted you or email ${MAIL}. We will honor do-not-call requests promptly and pass access and deletion requests to the relevant customer where required.`,
      ] },
      { h: 'Demo workspaces', p: ['The live demo creates an isolated workspace filled with fictional data. It cannot place real calls or send messages, and it expires after 24 hours.'] },
      { h: 'How we share information', p: ['We share information only as needed to run the service:'], li: [
        'Service providers acting for us: hosting, database, authentication providers, AI model provider, and integrations you choose to enable such as mapping or webhook partners.',
        'Legal and safety: when required by law, or to protect rights, safety and the integrity of the service.',
        'Business transfers: if we are involved in a merger, acquisition or asset sale, with notice where required.',
        'With your direction, for example when you connect another tool.',
      ] },
      { h: 'Retention', p: ['Active account/workspace data is retained while active. After closure, we intend to delete or irreversibly de-identify it within 90 days, except where a longer period is reasonably necessary for legal, accounting, fraud-prevention, dispute-resolution or security purposes. Do-not-contact suppression records are retained as long as reasonably necessary to honor the request and prevent re-contact. Security logs are generally retained for up to 12 months and backups generally rotate out within 90 days after primary deletion, subject to technical and legal constraints.'] },
      { h: 'Security and incident response', p: ['We use access controls, hashed passwords, HTTP-only session cookies, rate limiting, tenant isolation and other safeguards appropriate to the service. If a security incident creates a legal obligation to notify affected people, customers, regulators or other parties, we will provide notice as required by applicable law and, where appropriate, without undue delay.'] },
      { h: 'Your choices and rights', p: [`Depending on where you live, you may have the right to access, correct, delete or export your personal information, to object to or restrict certain processing, and to opt out of marketing. Email ${MAIL} to exercise a right. We may need to verify your identity first.`] },
      { h: 'Cookies', p: ['See our Cookie policy.'] },
      { h: 'California privacy notice', p: ['We do not intend to sell or share personal information for cross-context behavioral advertising from this early-access marketing site. Where Vortex One handles customer workspace data on behalf of a customer, the customer may determine the purposes of that processing and California service-provider/contractor rules may apply. California-specific disclosures will be expanded before any paid or large-scale California data operation where required.'] },
      { h: 'Children', p: ['Vortex One is a business service and is not directed to children under 18. We do not knowingly collect information from children.'] },
      { h: 'International use', p: ['We may process and store information in countries other than your own. Where required, we use appropriate safeguards for those transfers.'] },
      { h: 'Changes to this policy', p: ['We may update this policy. We will change the date above and, for material changes, notify account holders. If we add live calling, recording or email and SMS sending, we will update this policy before those features launch.'] },
      { h: 'Contact us', p: [`${E} · ${ADDRESS} · ${MAIL}`] },
    ],
  },
  {
    slug: 'terms',
    navLabel: 'Terms of service',
    title: 'Terms of service',
    updated: LEGAL_UPDATED,
    sections: [
      { h: 'Agreement', p: [`These terms are a contract between you and ${E} ("we", "us") for your use of Vortex One, including the website, the application and related services. By creating an account or using Vortex One you agree to them. If you use Vortex One for an organization, you confirm you can bind that organization.`] },
      { h: 'Accounts', p: ['You must give accurate information, keep your credentials secure and be at least 18. You are responsible for activity under your account and for the users you invite. Tell us promptly if you suspect unauthorized access.'] },
      { h: 'Early access and plans', p: ['Vortex One is currently offered free during early access. Features can change, be limited or be removed. We will announce paid plans, prices and usage limits before they apply to you, and nothing will be charged without your agreement.'] },
      { h: 'Your data', p: ['You keep your rights in the data you add to Vortex One. You give us a limited license to host, process and display it to provide the service, including sending it to our service providers. You are responsible for having the rights and legal basis to add it and to contact the people in it. Our Privacy policy explains how we handle personal information.'] },
      { h: 'Acceptable use and communications compliance', p: ['You must follow our Acceptable use policy and Communications and do-not-call policy. You are responsible for compliance with the laws that apply to your outreach, including telemarketing, consent, call-recording and do-not-call rules.'] },
      { h: 'Simulated and automated features', p: ['The dialer in Vortex One is currently simulated and does not place real calls. Agents and scoring are rule-based. Any assistant output can be inaccurate or incomplete and is not legal, financial, tax, real estate or property-management advice. You are responsible for reviewing outputs and for decisions you make using them.'] },
      { h: 'Third-party data and services', p: ['Property, owner and contact data can come from third-party sources and imports you provide, and some features depend on third-party services. We do not guarantee that data is complete, current or accurate, or that third-party services will be uninterrupted.'] },
      { h: 'Our property', p: ['We and our licensors own Vortex One, including its software, scoring rules, design and branding. These terms give you a limited, non-exclusive, non-transferable right to use the service. You may not copy, resell, reverse engineer or build a competing product from it.'] },
      { h: 'Suspension and termination', p: ['You can stop using Vortex One at any time. We may suspend or end access if you breach these terms, create legal or security risk, or misuse the service. After termination we will make your workspace data available for export for a reasonable period unless the law or an investigation requires otherwise, then delete it as described in our Privacy policy.'] },
      { h: 'Disclaimers', p: ['Vortex One is provided "as is" and "as available". To the fullest extent the law allows, we disclaim all warranties, including merchantability, fitness for a particular purpose and non-infringement. We do not promise any particular business result, lead volume, contact rate or revenue.'] },
      { h: 'Limitation of liability', p: ['To the fullest extent the law allows, we are not liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue, data or goodwill. Our total liability for all claims relating to the service is limited to the greater of the amount you paid us in the 12 months before the claim arose and one hundred US dollars. Some jurisdictions do not allow certain limits, so parts of this section may not apply to you.'] },
      { h: 'Indemnity', p: ['You will defend and indemnify us against claims arising from your data, your outreach and communications, or your breach of these terms or the law.'] },
      { h: 'Changes, law and disputes', p: [`We may update these terms and will change the date above and give notice of material changes. Continued use after a change means you accept it. These terms are governed by the laws of the jurisdiction in which ${E} is organized, without regard to conflict-of-law rules, and disputes will be handled in the courts of that jurisdiction unless the law requires otherwise.`] },
      { h: 'Contact', p: [`${E} · ${ADDRESS} · ${MAIL}`] },
    ],
  },
  {
    slug: 'ai-disclosure',
    navLabel: 'AI disclosure',
    title: 'AI disclosure',
    updated: LEGAL_UPDATED,
    intro: 'What is automated in Vortex One today, and what we commit to if we add live AI calling.',
    sections: [
      { h: 'What exists today', li: [
        'Lead scoring is rule-based. Scores show the reasons behind them.',
        'Agents are rule-based. Each has a stated purpose, permissions, typed inputs and outputs, and a run history.',
        'The dialer is simulated. No real phone calls are placed and no AI voice is connected.',
        'An optional assistant can answer questions about your workspace. When used, your question is processed by an AI model provider, and its answers can be wrong.',
      ] },
      { h: 'Our commitments for live AI calling', p: ['If we add live calling with an AI voice, we commit that the AI caller will:'], li: [
        'Identify itself as an AI assistant in its opening statement and on request, and never claim or imply it is human.',
        'State the business it is calling for.',
        'Stop and mark the contact as do-not-call immediately when asked.',
        'Hand over to a person when asked or when a conversation goes beyond its limits.',
        'Not give legal, financial, tax, real estate or property-management advice.',
        'Not negotiate price or terms, make offers, or guarantee outcomes.',
      ] },
      { h: 'Recording', p: ['No call audio is recorded today. If we add recording, we will publish a call recording notice and update our Privacy policy before it launches, and callers will be told when recording is happening where the law requires.'] },
      { h: 'Accuracy and human review', p: ['Scores, summaries and assistant answers can contain errors. Review them before acting, and do not rely on them alone to make decisions about a person.'] },
      { h: 'Questions or concerns', p: [`Email ${MAIL}.`] },
    ],
  },
  {
    slug: 'communications-policy',
    navLabel: 'Communications and do-not-call',
    title: 'Communications and do-not-call policy',
    updated: LEGAL_UPDATED,
    sections: [
      { h: 'Purpose', p: ['Vortex One helps customers manage outreach to property owners. This policy explains how the platform supports respectful, lawful outreach and what we require of customers. It is not legal advice.'] },
      { h: 'Do-not-call in Vortex One', li: [
        'A contact marked do-not-call is flagged everywhere the contact appears in the workspace.',
        'Do-not-call contacts are excluded from the dialing queue and campaigns.',
        'A request to stop being contacted is recorded and honored immediately.',
      ] },
      { h: 'Customer responsibilities', p: ['Each customer is responsible for the lawfulness of its own outreach. Depending on where you and the people you contact are located, the law that applies can include:'], li: [
        'The Telephone Consumer Protection Act and the Telemarketing Sales Rule, including National Do Not Call Registry rules and your own internal do-not-call list.',
        'Consent requirements for automated or artificial-voice calls and for text messages. AI-generated voices can count as artificial voices under U.S. rules, so confirm your consent position before using any automated calling.',
        "Calling-time limits, which in the U.S. generally run from 8 a.m. to 9 p.m. in the recipient's local time, plus any stricter state rules.",
        'State and local telemarketing registration, caller identification and call-recording consent laws.',
        'Anti-discrimination and fair housing laws when choosing who to contact.',
      ] },
      { h: 'Registry and list checks', p: ["Customers are responsible for checking their lists against the registries and rules that apply to them before launching a campaign. Tools in Vortex One help, but they do not replace the customer's own compliance obligations."] },
      { h: 'How to ask not to be contacted', p: [`Tell the person contacting you, or email ${MAIL} with your phone number and we will make sure it is suppressed and forward your request to the customer.`] },
      { h: 'Complaints and enforcement', p: [`We investigate complaints about outreach made with Vortex One. We may pause campaigns, limit features or suspend accounts that breach this policy, our Acceptable use policy or the law. Contact ${MAIL} to report a concern.`] },
    ],
  },
  {
    slug: 'acceptable-use',
    navLabel: 'Acceptable use',
    title: 'Acceptable use policy',
    updated: LEGAL_UPDATED,
    sections: [
      { h: 'Scope', p: ['This policy applies to everyone who uses Vortex One and supports our Terms of service.'] },
      { h: 'You may not use Vortex One to', li: [
        'Break any law or regulation, including telemarketing, consent, do-not-call, call-recording, privacy and anti-discrimination laws.',
        'Contact anyone who asked not to be contacted, or bypass or ignore do-not-call flags and suppression lists.',
        'Impersonate a person or organization, hide that a caller is an AI, or use misleading or spoofed caller identification.',
        'Threaten, harass, pressure or deceive the people you contact, or make false claims about a property, an offer or an outcome.',
        'Select or exclude people in a way that discriminates on a protected characteristic, including under fair housing law.',
        'Add personal information you have no right to use, or data obtained unlawfully.',
        'Run scams, fraud or schemes that target owners in financial or legal distress.',
      ] },
      { h: 'Protecting the service', li: [
        "Do not probe, scan or test the service for weaknesses without our written permission, or attempt to access another customer's workspace.",
        'Do not scrape or bulk-export data beyond what the product allows.',
        'Do not upload malware or interfere with the operation of the service.',
        'Do not use the service or its outputs to build a competing product.',
      ] },
      { h: 'Reporting and enforcement', p: [`Report abuse to ${MAIL}. If we find or reasonably suspect a violation, we may remove content, pause campaigns, limit features, suspend or terminate accounts, and cooperate with authorities. Where reasonable we will warn you first, but we may act immediately to protect people or the service.`] },
    ],
  },
  {
    slug: 'cookies',
    navLabel: 'Cookie policy',
    title: 'Cookie policy',
    updated: LEGAL_UPDATED,
    sections: [
      { h: 'What cookies are', p: ['Cookies are small text files a website stores in your browser. Similar technologies, such as local storage, do the same kind of job.'] },
      { h: 'This website', p: ['This marketing website does not set analytics or advertising cookies. If that changes, we will update this policy and ask for your consent where the law requires it.'] },
      { h: 'The Vortex One application', p: ['The application uses a strictly necessary, HTTP-only session cookie to keep you signed in and protect your session, and may store preferences such as your theme. These are needed to run the service and cannot be switched off in our systems.'] },
      { h: 'Your choices', p: ['You can block or delete cookies in your browser. Blocking the session cookie will stop sign-in from working.'] },
      { h: 'Contact', p: [`Questions about cookies: ${MAIL}.`] },
    ],
  },
  {
    slug: 'data-sources',
    navLabel: 'Data sources',
    title: 'Data sources and enrichment',
    updated: LEGAL_UPDATED,
    sections: [
      { h: 'What this page explains', p: ['Vortex One shows property and owner information. This page explains the kinds of data involved, where it comes from, how reliable it is and what you can do if something is wrong. It complements our Privacy policy.'] },
      { h: 'The kinds of data', li: [
        'Property data: address, parcel number (APN), characteristics, valuation, coordinates and similar attributes.',
        'Owner data: owner name, owner type (individual or entity), mailing address and derived portfolio values.',
        'Signals: indicators such as estimated equity, ownership length, absentee status or recorded filings, used by transparent rule-based scoring.',
        'Customer-supplied data: records and notes that customers import or create in their own workspace.',
      ] },
      { h: 'Where the data comes from', li: [
        'Public records and imports, including import by APN.',
        'Data our customers provide in their own workspace.',
        'Information generated in Vortex One itself, such as scores and call outcomes.',
        'Integrations a customer chooses to enable.',
      ] },
      { h: 'Accuracy and freshness', p: ['Property and owner data can be incomplete, out of date or wrong. Public records lag behind real events and different sources can disagree. We do not guarantee the accuracy, completeness or timeliness of any data. Scores and signals are estimates, not facts about a person. Verify important details before relying on them.'] },
      { h: 'Correcting or removing data', p: [`Email ${MAIL} with your name, the address or number concerned and what you want changed. We will correct or suppress the information where we can verify the request and pass it to the relevant customer or provider where required. Do-not-call requests are honored immediately.`] },
      { h: 'Responsible use', li: [
        'Customers are responsible for using data lawfully, including telemarketing, consent, privacy and anti-discrimination rules.',
        'Data must not be used to discriminate, to harass, or to target people in distress with deceptive offers.',
      ] },
      { h: 'Not a credit or eligibility report', p: ["Vortex One is not a consumer reporting agency. Its data and scores must not be used to decide a person's eligibility for credit, insurance, employment, housing or any other purpose covered by consumer reporting laws."] },
      { h: 'Contact', p: [`${E} · ${ADDRESS} · ${MAIL}`] },
    ],
  },
  {
    slug: 'dpa',
    navLabel: 'Data processing addendum',
    title: 'Data processing addendum',
    updated: LEGAL_UPDATED,
    intro: 'Baseline processor/service-provider terms for customer-controlled personal data.',
    sections: [
      { h: 'Scope and roles', p: [`This DPA applies when a customer uses Vortex One to process personal data on the customer’s behalf. For customer-controlled data, the customer is generally the controller/business and ${E} is the processor/service provider. For account administration, security, legal compliance and similar purposes, ${E} may act as an independent controller/business.`] },
      { h: 'Processing instructions', p: ['We will process customer-controlled personal data only to provide, secure, maintain and support Vortex One, follow documented customer instructions, and comply with law. The customer is responsible for the legality of its instructions, notices and permissions.'] },
      { h: 'Subprocessors', p: ['We may use subprocessors necessary to provide the service, subject to contractual protections. We will maintain a list of material subprocessors and provide notice of material additions or replacements where required by applicable law or agreement.'] },
      { h: 'Security and incidents', p: ['We maintain reasonable technical and organizational safeguards appropriate to the service. We will notify customers of confirmed personal-data security incidents affecting customer-controlled data as required by applicable law or agreement.'] },
      { h: 'Requests, deletion and transfers', p: ['Where we receive a request relating to customer-controlled data, we will reasonably assist the customer, subject to verification and legal restrictions. On termination or request, we will delete or return data subject to legal holds and backup cycles. Where cross-border transfer restrictions apply, the parties will use legally recognized safeguards.'] },
      { h: 'Contact', p: [`${E} · ${ADDRESS} · ${PRIVACY}`] },
    ],
  },
  {
    slug: 'subprocessors',
    navLabel: 'Subprocessors',
    title: 'Subprocessors',
    updated: LEGAL_UPDATED,
    intro: 'Material third-party providers that may process information for Vortex One.',
    sections: [
      { h: 'Early-access disclosure', p: ['Vortex One may use hosting, authentication, database, AI-model and integration providers to operate the service. Before commercial launch or material expansion of processing, this page will identify each material provider, its purpose, categories of data processed and relevant processing location.'] },
      { h: 'Customer notice', p: ['Where a contract or law requires notice of a material subprocessor change, we will provide that notice through the service, this page or another agreed channel.'] },
      { h: 'Contact', p: [`Questions about subprocessors: ${E} · ${ADDRESS} · ${PRIVACY}.`] },
    ],
  },
  {
    slug: 'security',
    navLabel: 'Security and privacy',
    title: 'Security and privacy',
    updated: LEGAL_UPDATED,
    sections: [
      { h: 'Security approach', p: ['Vortex One uses layered controls intended to protect account and workspace data, including authentication safeguards, HTTP-only sessions, access controls, tenant isolation, rate limiting, logging and security monitoring.'] },
      { h: 'Data minimization', p: ['Customers should avoid uploading sensitive information that is not needed for a legitimate business purpose.'] },
      { h: 'Incident response', p: ['Security incidents are investigated and contained using operational procedures. Where notification is legally required, affected parties will be informed as required by law.'] },
      { h: 'Vulnerability reporting', p: [`Report suspected vulnerabilities or security issues to ${PRIVACY}. Do not include passwords, authentication tokens or unnecessary personal data.`] },
      { h: 'Contact', p: [`${E} · ${ADDRESS} · ${PRIVACY}`] },
    ],
  },
  {
    slug: 'refunds',
    navLabel: 'Refunds and cancellation',
    title: 'Refund and cancellation policy',
    updated: LEGAL_UPDATED,
    sections: [
      { h: 'Summary', p: ['Vortex One is free during early access, so there is nothing to refund today. This page sets out how cancellation works now and the rules we intend to apply when paid plans launch.'] },
      { h: 'Closing your free account', p: [`You can stop using Vortex One at any time. To close your account and request deletion of your data, email ${MAIL} from the address on the account.`] },
      { h: 'Paid plans', p: ['Paid plans are not available yet. Before any paid plan applies to you we will publish its price, usage limits and this policy in final form, and nothing will be charged without your agreement. We expect to offer cancellation at any time, effective at the end of the paid period, and a refund window for first-time paid subscribers.'] },
      { h: 'Your legal rights', p: ['This policy does not limit rights you may have under consumer protection law where you live.'] },
      { h: 'Contact', p: [`${E} · ${ADDRESS} · ${MAIL}`] },
    ],
  },
];

export function findDoc(slug: string | undefined): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
