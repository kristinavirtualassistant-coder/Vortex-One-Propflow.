import { Router } from 'express';
import { camelRows, getDb, route } from './core.js';

export const dashboardRouter = Router();

/** Every figure is an aggregate over stored records for the caller's organization. */
dashboardRouter.get('/dashboard', route('crm:read', async (_req, _res, ctx) => {
  const db = getDb();
  const o = ctx.orgId;
  const [counts, pipeline, callStats, callsByDay, hotLeads, tasks, activity, runs, outcomes] = await Promise.all([
    db.query(
      `SELECT
         (SELECT count(*)::int FROM contacts WHERE organization_id=$1 AND archived_at IS NULL) AS contacts,
         (SELECT count(*)::int FROM leads WHERE organization_id=$1 AND archived_at IS NULL AND stage NOT IN ('won','lost')) AS open_leads,
         (SELECT count(*)::int FROM leads WHERE organization_id=$1 AND archived_at IS NULL AND stage='won') AS won_leads,
         (SELECT count(*)::int FROM properties WHERE organization_id=$1 AND archived_at IS NULL) AS properties,
         (SELECT count(*)::int FROM property_owners WHERE organization_id=$1 AND archived_at IS NULL) AS owners,
         (SELECT count(*)::int FROM campaigns WHERE organization_id=$1 AND status='active') AS active_campaigns,
         (SELECT count(*)::int FROM tasks WHERE organization_id=$1 AND status='open') AS open_tasks,
         (SELECT count(*)::int FROM tasks WHERE organization_id=$1 AND status='open' AND due_at < now()) AS overdue_tasks,
         (SELECT COALESCE(sum(value),0) FROM leads WHERE organization_id=$1 AND archived_at IS NULL AND stage NOT IN ('won','lost')) AS pipeline_value`, [o]),
    db.query(`SELECT stage, count(*)::int AS count, COALESCE(sum(value),0) AS value FROM leads WHERE organization_id=$1 AND archived_at IS NULL GROUP BY stage`, [o]),
    db.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE answered_at IS NOT NULL)::int AS connected,
              count(*) FILTER (WHERE outcome='appointment_set')::int AS appointments,
              COALESCE(round(avg(duration_seconds) FILTER (WHERE answered_at IS NOT NULL))::int,0) AS avg_duration
         FROM calls WHERE organization_id=$1 AND started_at > now() - interval '30 days'`, [o]),
    db.query(
      `SELECT d::date AS day, count(c.id)::int AS calls, count(c.id) FILTER (WHERE c.answered_at IS NOT NULL)::int AS connected
         FROM generate_series(now()::date - 6, now()::date, interval '1 day') d
         LEFT JOIN calls c ON c.organization_id=$1 AND c.started_at::date = d::date
        GROUP BY d ORDER BY d`, [o]),
    db.query(
      `SELECT l.id, l.title, l.lead_score, l.classification, l.stage, p.address AS property_address
         FROM leads l LEFT JOIN properties p ON p.id=l.primary_property_id
        WHERE l.organization_id=$1 AND l.archived_at IS NULL AND l.stage NOT IN ('won','lost') ORDER BY l.lead_score DESC, l.updated_at DESC LIMIT 5`, [o]),
    db.query(
      `SELECT t.id, t.title, t.due_at, t.priority, t.lead_id, t.contact_id FROM tasks t
        WHERE t.organization_id=$1 AND t.status='open' ORDER BY t.due_at NULLS LAST LIMIT 6`, [o]),
    db.query(`SELECT a.*, u.name AS actor_name FROM activities a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.organization_id=$1 ORDER BY a.created_at DESC LIMIT 10`, [o]),
    db.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE status='completed')::int AS completed,
              count(*) FILTER (WHERE status='failed')::int AS failed
         FROM workflow_runs WHERE organization_id=$1 AND created_at > now() - interval '30 days'`, [o]),
    db.query(`SELECT outcome, count(*)::int AS n FROM calls WHERE organization_id=$1 AND outcome IS NOT NULL AND started_at > now() - interval '30 days' GROUP BY outcome ORDER BY n DESC`, [o]),
  ]);
  const c = counts.rows[0];
  const k = callStats.rows[0];
  return {
    counts: {
      contacts: c.contacts, openLeads: c.open_leads, wonLeads: c.won_leads, properties: c.properties, owners: c.owners,
      activeCampaigns: c.active_campaigns, openTasks: c.open_tasks, overdueTasks: c.overdue_tasks, pipelineValue: Number(c.pipeline_value),
    },
    pipeline: pipeline.rows.map((r: any) => ({ stage: r.stage, count: r.count, value: Number(r.value) })),
    calls: {
      last30Days: k.total, connected: k.connected, appointments: k.appointments, avgDurationSeconds: k.avg_duration,
      connectRate: k.total ? Math.round((k.connected / k.total) * 100) : 0,
      byDay: callsByDay.rows.map((r: any) => ({ day: new Date(r.day).toISOString().slice(0, 10), calls: r.calls, connected: r.connected })),
      byOutcome: outcomes.rows.map((r: any) => ({ outcome: r.outcome, count: r.n })),
    },
    hotLeads: camelRows(hotLeads.rows),
    upcomingTasks: camelRows(tasks.rows),
    recentActivity: camelRows(activity.rows),
    workflows: { runs30Days: runs.rows[0].total, completed: runs.rows[0].completed, failed: runs.rows[0].failed },
  };
}));
