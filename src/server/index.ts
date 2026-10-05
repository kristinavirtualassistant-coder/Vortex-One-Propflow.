import { Router } from 'express';
import { contactsRouter } from './contacts.js';
import { propertiesRouter } from './properties.js';
import { leadsRouter } from './leads.js';
import { tasksRouter } from './tasks.js';
import { campaignsRouter } from './campaigns.js';
import { dialerRouter } from './dialer.js';
import { workflowsRouter } from './workflows.js';
import { agentsRouter } from './agents.js';
import { dashboardRouter } from './dashboard.js';
import { orgRouter } from './org.js';
import { demoRouter } from './demo.js';

/**
 * All authenticated CRM/platform routes. Mounted behind requireAuth in server.ts; every handler
 * additionally enforces a permission and scopes every query to the caller's organization.
 * Route order matters: static paths (/leads/pipeline, /properties/import) precede /:id routes.
 */
export const apiRouter = Router();
apiRouter.use(propertiesRouter);
apiRouter.use(contactsRouter);
apiRouter.use(leadsRouter);
apiRouter.use(tasksRouter);
apiRouter.use(campaignsRouter);
apiRouter.use(dialerRouter);
apiRouter.use(workflowsRouter);
apiRouter.use(agentsRouter);
apiRouter.use(dashboardRouter);
apiRouter.use(orgRouter);
apiRouter.use(demoRouter);
