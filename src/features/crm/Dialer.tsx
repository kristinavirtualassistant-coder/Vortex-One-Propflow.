import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Phone, PhoneCall, PhoneOff, SkipForward } from 'lucide-react';
import { api, errorMessage, qs } from './api';
import { duration, fmtDateTime, fullName, titleCase } from './format';
import { RecordLink } from './shared';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, PageHeader, RecordPicker, Select, Spinner, StatusBadge, Textarea, useFetch, useToast } from './ui';

const OUTCOMES = [
  ['connected_interested', 'Interested'], ['appointment_set', 'Appointment set'], ['callback', 'Call back later'], ['not_interested', 'Not interested'],
  ['voicemail', 'Left voicemail'], ['wrong_number', 'Wrong number'], ['do_not_call', 'Do Not Call'],
] as const;

type Target = { contact: { id: string; firstName: string; lastName: string; phone: string | null; company?: string | null }; lead: any | null; script?: string | null; campaignId: string | null };

const STEP_MS = { dialing: 1400, ringing: 2400 };

export default function Dialer() {
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const status = useFetch<any>(() => api.get('/dialer/status'), []);
  const campaigns = useFetch<any>(() => api.get('/campaigns?limit=100'), []);
  const history = useFetch<any>(() => api.get('/calls?limit=12'), []);

  const [campaignId, setCampaignId] = useState(params.get('campaign') ?? '');
  const [single, setSingle] = useState<string | null>(params.get('contact'));
  const [target, setTarget] = useState<Target | null>(null);
  const [call, setCall] = useState<any>(null);
  const [wrapup, setWrapup] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const callRef = useRef<any>(null);
  callRef.current = call;

  // Cancel an unanswered call if the agent leaves the page; connected calls are left for the server to reap.
  useEffect(() => () => {
    const c = callRef.current;
    if (c && (c.status === 'dialing' || c.status === 'ringing')) void api.post(`/calls/${c.id}/cancel`).catch(() => undefined);
  }, []);

  const loadSingle = useCallback(async (contactId: string, leadId?: string | null) => {
    setError(null);
    try {
      const d = await api.get(`/contacts/${contactId}`);
      const lead = (leadId && d.leads.find((l: any) => l.id === leadId)) || d.leads.find((l: any) => !['won', 'lost'].includes(l.stage)) || null;
      setTarget({ contact: d.contact, lead, script: null, campaignId: null });
    } catch (e) { setError(errorMessage(e)); setTarget(null); }
  }, []);

  useEffect(() => { if (single && !call) void loadSingle(single, params.get('lead')); }, [single]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextInCampaign = async () => {
    if (!campaignId) return;
    setBusy('next'); setError(null); setMessage(null); setResult(null); setCall(null); setWrapup(false);
    try {
      const r = await api.post(`/campaigns/${campaignId}/next`);
      if (!r.next) { setTarget(null); setMessage(r.message ?? 'No callable contacts remain.'); }
      else setTarget({ contact: r.next.contact, lead: r.next.lead, script: r.next.script, campaignId });
    } catch (e) { setError(errorMessage(e)); setTarget(null); } finally { setBusy(null); }
  };

  const dial = async () => {
    if (!target) return;
    setBusy('dial'); setError(null); setResult(null); setWrapup(false);
    try {
      const r = await api.post('/calls', { contactId: target.contact.id, campaignId: target.campaignId ?? undefined, leadId: target.lead?.id });
      setCall(r.call); setSeconds(0);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  };

  const advance = useCallback(async (id: string) => {
    try { const r = await api.post(`/calls/${id}/advance`); setCall(r.call); }
    catch (e) { setError(errorMessage(e)); }
  }, []);

  // Drive the simulated call through its states (the server owns the transitions and the plan).
  useEffect(() => {
    if (!call) return;
    if (call.status === 'dialing' || call.status === 'ringing') {
      const t = setTimeout(() => void advance(call.id), STEP_MS[call.status as 'dialing' | 'ringing']);
      return () => clearTimeout(t);
    }
    if (['no_answer', 'busy', 'failed', 'canceled'].includes(call.status)) history.reload();
  }, [call?.status, call?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (call?.status !== 'connected') return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [call?.status]);

  const cancel = async () => {
    if (!call) return;
    setBusy('cancel');
    try { const r = await api.post(`/calls/${call.id}/cancel`); setCall(r.call); } catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  };

  const finish = async (v: { outcome: string; notes: string; followTitle: string; followDue: string }) => {
    setBusy('complete'); setError(null);
    try {
      const body: any = { outcome: v.outcome, notes: v.notes || undefined, durationSeconds: seconds };
      if (v.followTitle.trim()) body.followUp = { title: v.followTitle.trim(), dueAt: v.followDue ? new Date(`${v.followDue}T17:00:00`).toISOString() : undefined, priority: 'normal' };
      const r = await api.post(`/calls/${call.id}/complete`, body);
      setCall(r.call); setResult(r); setWrapup(false); toast.success('Call logged'); history.reload();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  };

  const live = call && ['dialing', 'ringing', 'connected'].includes(call.status);
  const ended = call && !live && !wrapup;
  const eligible = (campaigns.data?.items ?? []).filter((c: any) => c.status === 'active');

  return (
    <div>
      <PageHeader title="Dialer" subtitle="Power dialer for campaigns and single contacts." />
      <div role="note" className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
        <PhoneCall className="h-5 w-5 mt-0.5 shrink-0" />
        <div><b>Simulated dialer.</b> No real phone calls, texts or charges are made. {status.data?.simulationRules ?? ''}
          {status.data?.note && status.data.note.includes('not implemented') && <> {status.data.note}</>}</div>
      </div>
      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {!live && !wrapup && (
            <Card title="Who to call">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Campaign queue" help="Dials contacts one at a time from an active campaign.">{(id) => (
                  <Select id={id} value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setSingle(null); setTarget(null); setCall(null); setResult(null); setMessage(null); }}>
                    <option value="">— Choose an active campaign —</option>{eligible.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>)}</Field>
                <Field label="Or a single contact">{(id) => <RecordPicker id={id} kind="contacts" value={single} onChange={(v) => { setSingle(v); setCampaignId(''); setTarget(null); setCall(null); setResult(null); setMessage(null); }} />}</Field>
              </div>
              {campaigns.data && eligible.length === 0 && <p className="mt-3 text-sm text-slate-500">No active campaigns. Activate one from <button type="button" className="text-indigo-600 underline" onClick={() => nav('/dashboard/campaigns')}>Campaigns</button>, or pick a single contact.</p>}
              {campaignId && !target && <Button className="mt-4" variant="primary" loading={busy === 'next'} onClick={nextInCampaign}><SkipForward className="h-4 w-4" /> Get next contact</Button>}
              {message && <p role="status" className="mt-3 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
            </Card>
          )}

          {target && !live && !wrapup && !ended && (
            <Card title="Ready to dial">
              <ContactBlock target={target} />
              <div className="mt-4 flex gap-2">
                <Button variant="primary" loading={busy === 'dial'} disabled={!target.contact.phone} onClick={dial}><Phone className="h-4 w-4" /> Dial (simulated)</Button>
                {campaignId && <Button loading={busy === 'next'} onClick={nextInCampaign}><SkipForward className="h-4 w-4" /> Skip</Button>}
              </div>
              {!target.contact.phone && <p className="mt-2 text-sm text-red-600">This contact has no phone number.</p>}
            </Card>
          )}

          {call && live && (
            <Card title={call.status === 'connected' ? 'On a call' : 'Calling…'}>
              <ContactBlock target={target!} />
              <div className="mt-5 flex flex-wrap items-center gap-4" role="status" aria-live="polite">
                <StatusBadge value={call.status} />
                <Badge tone="amber">Simulated</Badge>
                {call.status === 'connected' ? <span className="text-2xl font-mono font-bold">{duration(seconds)}</span> : <span className="text-sm text-slate-500">{call.status === 'dialing' ? 'Dialing…' : 'Ringing…'}</span>}
              </div>
              <div className="mt-4 flex gap-2">
                {call.status === 'connected'
                  ? <Button variant="danger" onClick={() => setWrapup(true)}><PhoneOff className="h-4 w-4" /> End call & log outcome</Button>
                  : <Button loading={busy === 'cancel'} onClick={cancel}><PhoneOff className="h-4 w-4" /> Cancel call</Button>}
              </div>
            </Card>
          )}

          {call && wrapup && <WrapUp busy={busy === 'complete'} seconds={seconds} target={target!} onSubmit={finish} />}

          {ended && call && (
            <Card title="Call ended">
              <div className="space-y-3" role="status">
                <div className="flex items-center gap-2"><StatusBadge value={call.outcome ?? call.status} /><Badge tone="amber">Simulated</Badge></div>
                {call.status === 'completed' && result ? (
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Logged: {titleCase(call.outcome)} · {duration(call.durationSeconds)}</p>
                    {result.followUp && <p>Follow-up created: <b>{result.followUp.title}</b></p>}
                    {result.leadStageChanged && <p>Lead stage advanced.{target?.lead && <> <RecordLink type="lead" id={target.lead.id}>View lead</RecordLink></>}</p>}
                  </div>
                ) : <p className="text-sm text-slate-600 dark:text-slate-300">{call.status === 'no_answer' ? 'No answer.' : call.status === 'busy' ? 'Line busy.' : call.status === 'failed' ? (call.failureReason ?? 'The call failed.') : 'Call canceled.'} The attempt was recorded.</p>}
                <div className="flex gap-2 pt-1">
                  {campaignId ? <Button variant="primary" loading={busy === 'next'} onClick={nextInCampaign}><SkipForward className="h-4 w-4" /> Next contact</Button>
                    : <Button variant="primary" onClick={() => { setCall(null); setResult(null); }}>Done</Button>}
                  {!campaignId && call.status !== 'completed' && call.status !== 'canceled' && <Button onClick={() => { setCall(null); setResult(null); }}>Redial later</Button>}
                </div>
              </div>
            </Card>
          )}
        </div>

        <div>
          <Card title="Recent calls">
            {history.loading && !history.data ? <Spinner /> : history.data?.items.length ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">{history.data.items.map((c: any) => (
                <li key={c.id} className="py-2"><div className="flex items-center justify-between gap-2"><span className="font-medium">{c.contactName ?? c.toNumber}</span><StatusBadge value={c.outcome ?? c.status} /></div>
                  <div className="text-xs text-slate-500">{fmtDateTime(c.startedAt)} · {duration(c.durationSeconds)} · simulated{c.campaignName ? ` · ${c.campaignName}` : ''}</div></li>))}</ul>
            ) : <EmptyState title="No calls yet" hint="Calls you make appear here." />}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ContactBlock({ target }: { target: Target }) {
  const { contact, lead } = target;
  return (
    <div className="grid sm:grid-cols-2 gap-4 text-sm">
      <div>
        <div className="text-lg font-bold text-slate-900 dark:text-white"><RecordLink type="contact" id={contact.id}>{fullName(contact)}</RecordLink></div>
        <div className="text-slate-600 dark:text-slate-300">{contact.phone ?? 'No phone'}{contact.company && ` · ${contact.company}`}</div>
        {lead && <div className="mt-2"><RecordLink type="lead" id={lead.id}>{lead.title}</RecordLink> <StatusBadge value={lead.stage} /></div>}
      </div>
      {target.script && <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-slate-700 dark:text-slate-300 whitespace-pre-wrap"><div className="text-xs font-semibold text-slate-500 mb-1">Script</div>{target.script}</div>}
    </div>
  );
}

function WrapUp({ busy, seconds, target, onSubmit }: { busy: boolean; seconds: number; target: Target; onSubmit: (v: { outcome: string; notes: string; followTitle: string; followDue: string }) => void }) {
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [followTitle, setFollowTitle] = useState('');
  const [followDue, setFollowDue] = useState('');
  const [touched, setTouched] = useState(false);
  return (
    <Card title={`Log outcome · ${fullName(target.contact)} · ${duration(seconds)}`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setTouched(true); if (outcome) onSubmit({ outcome, notes, followTitle, followDue }); }} noValidate>
        <fieldset>
          <legend className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Outcome <span className="text-red-500">*</span></legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {OUTCOMES.map(([v, label]) => (
              <label key={v} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${outcome === v ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 font-semibold' : 'border-slate-300 dark:border-slate-700'}`}>
                <input type="radio" name="outcome" value={v} checked={outcome === v} onChange={() => setOutcome(v)} className="sr-only" />{label}
              </label>))}
          </div>
          {touched && !outcome && <p role="alert" className="text-xs text-red-600 mt-1">Choose an outcome to finish the call.</p>}
          {outcome === 'do_not_call' && <p className="text-xs text-red-600 mt-1">This contact will be added to the Do Not Call list and removed from active campaigns.</p>}
        </fieldset>
        <Field label="Call notes">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed?" />}</Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Follow-up task" help={outcome === 'callback' ? 'A callback task is created automatically if left blank.' : undefined}>{(id) => <Input id={id} value={followTitle} onChange={(e) => setFollowTitle(e.target.value)} placeholder="e.g. Send valuation" />}</Field>
          <Field label="Due">{(id) => <Input id={id} type="date" value={followDue} onChange={(e) => setFollowDue(e.target.value)} />}</Field>
        </div>
        <Button type="submit" variant="primary" loading={busy}>Save call</Button>
      </form>
    </Card>
  );
}
void qs;
