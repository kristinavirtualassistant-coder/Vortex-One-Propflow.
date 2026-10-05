/**
 * Transparent, rule-based lead scoring from property/owner record fields.
 * Every point comes from a named factor so the score can be explained in the UI;
 * nothing here calls an external service or invents data.
 */
export interface ScoringProperty {
  taxDelinquent?: boolean | null;
  isAbsenteeOwner?: boolean | null;
  isCorporateOwned?: boolean | null;
  estimatedValue?: number | null;
  estimatedEquity?: number | null;
  mortgageBalance?: number | null;
  lastSaleDate?: string | Date | null;
  state?: string | null;
}
export interface ScoringOwner {
  mailingState?: string | null;
  propertiesOwnedCount?: number | null;
}

export interface ScoreFactor { key: string; label: string; points: number }
export interface ScoreResult { score: number; classification: 'hot' | 'warm' | 'nurture'; factors: ScoreFactor[] }

export const classify = (score: number): ScoreResult['classification'] =>
  score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'nurture';

export const scoreProperty = (p: ScoringProperty, owner?: ScoringOwner | null, now = new Date()): ScoreResult => {
  const factors: ScoreFactor[] = [];
  const add = (key: string, label: string, points: number) => factors.push({ key, label, points });

  if (p.taxDelinquent) add('tax_delinquent', 'Tax delinquent', 30);
  if (p.isAbsenteeOwner) add('absentee_owner', 'Absentee owner', 15);

  const value = Number(p.estimatedValue ?? 0);
  const equity = Number(p.estimatedEquity ?? 0);
  if (value > 0 && equity / value >= 0.5) add('high_equity', 'Equity of 50% or more', 20);
  if (value > 0 && Number(p.mortgageBalance ?? 0) === 0) add('free_and_clear', 'No mortgage balance on record', 10);

  if (p.lastSaleDate) {
    const sold = new Date(p.lastSaleDate);
    const years = (now.getTime() - sold.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (Number.isFinite(years) && years >= 10) add('long_tenure', 'Owned 10+ years', 10);
  }

  if (owner?.mailingState && p.state && owner.mailingState.toUpperCase() !== p.state.toUpperCase()) {
    add('out_of_state_owner', 'Owner mails out of state', 10);
  }
  if ((owner?.propertiesOwnedCount ?? 0) >= 3) add('portfolio_owner', 'Owns 3+ properties', 5);

  const score = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));
  return { score, classification: classify(score), factors };
};
