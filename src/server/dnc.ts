/**
 * Do Not Call enforcement: the single place that decides whether a contact may be dialed or queued.
 *
 * Every path that places a call or puts a contact in a dial queue (start call, add to campaign, the
 * power-dialer "next" query, the add_to_campaign workflow action, the call-assistant agent) uses this
 * module instead of its own copy of the rule.
 *
 * The rule is by number, not only by contact: a contact is not callable if ANY contact in the same
 * organization with the same phone number is on the Do Not Call list. Otherwise a duplicate record of
 * an opted-out number could still be dialed.
 */
import { HttpError, type Db } from './core.js';

export type NotCallableCode = 'contact_archived' | 'do_not_call' | 'no_phone';

export interface NotCallable { code: NotCallableCode; message: string }

export interface CallableContact {
  id: string;
  phone?: string | null;
  do_not_call?: boolean | null;
  archived_at?: unknown;
}

/** Digits only; the last 10 digits when there are at least 10, so "(555) 555-0101" and "+1 555-555-0101" match. */
export const phoneKey = (phone: string | null | undefined): string | null => {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

/** SQL expression equivalent to {@link phoneKey} for a column reference. */
const keySql = (column: string) => `right(regexp_replace(${column}, '\\D', '', 'g'), 10)`;

/**
 * SQL predicate for queue queries: true when no OTHER contact with the same number is on the Do Not Call list.
 * `contactAlias` is the alias of the contacts row being tested; `orgParam` is a placeholder such as "$1".
 */
export const notOnDncNumberSql = (contactAlias: string, orgParam: string) =>
  `NOT EXISTS (SELECT 1 FROM contacts dnc
                WHERE dnc.organization_id=${orgParam} AND dnc.do_not_call=true AND dnc.id<>${contactAlias}.id
                  AND dnc.phone IS NOT NULL AND ${keySql('dnc.phone')}=${keySql(`${contactAlias}.phone`)})`;

/** Returns why a contact may not be called or queued, or null when it is callable. */
export const checkCallable = async (db: Db, orgId: string, contact: CallableContact): Promise<NotCallable | null> => {
  if (contact.archived_at) return { code: 'contact_archived', message: 'This contact is archived' };
  if (contact.do_not_call) return { code: 'do_not_call', message: 'This contact is on the Do Not Call list' };
  if (!contact.phone) return { code: 'no_phone', message: 'This contact has no phone number' };
  const key = phoneKey(contact.phone);
  if (key) {
    const match = await db.query(
      `SELECT 1 FROM contacts WHERE organization_id=$1 AND do_not_call=true AND id<>$2 AND phone IS NOT NULL
          AND ${keySql('phone')}=$3 LIMIT 1`, [orgId, contact.id, key]);
    if (match.rows.length) {
      return { code: 'do_not_call', message: 'This number is on the Do Not Call list (another contact with the same number opted out)' };
    }
  }
  return null;
};

/** Throws a 422 with the same error codes the dialer already returns. */
export const assertCallable = async (db: Db, orgId: string, contact: CallableContact) => {
  const blocked = await checkCallable(db, orgId, contact);
  if (blocked) throw new HttpError(422, blocked.message, blocked.code);
};
