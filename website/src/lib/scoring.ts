export type Signal = 'none' | 'probate' | 'taxlien' | 'prefc';

export interface LeadInput {
  equity: number; // percent, 0-100
  years: number; // years owned
  absentee: boolean;
  signal: Signal;
}

export interface LeadScore {
  total: number;
  band: 'Hot' | 'Warm' | 'Cold';
  reasons: string[];
}

const SIGNAL_POINTS: Record<Signal, number> = { none: 0, probate: 20, taxlien: 25, prefc: 30 };
export const SIGNAL_LABEL: Record<Signal, string> = {
  none: 'None found',
  probate: 'Probate filing',
  taxlien: 'Tax lien',
  prefc: 'Pre-foreclosure notice',
};

/**
 * Transparent, illustrative scoring used by the website demos only.
 * It is not the production scoring ruleset.
 */
export function scoreLead(i: LeadInput): LeadScore {
  const equityPts = Math.round(i.equity * 0.35);
  const yearsPts = Math.round((Math.min(i.years, 20) / 20) * 20);
  const absenteePts = i.absentee ? 15 : 0;
  const total = Math.min(100, equityPts + yearsPts + absenteePts + SIGNAL_POINTS[i.signal]);

  const reasons: string[] = [];
  if (i.equity >= 50) reasons.push('High equity');
  if (i.years >= 10) reasons.push('Long ownership');
  if (i.absentee) reasons.push('Absentee owner');
  if (i.signal !== 'none') reasons.push(SIGNAL_LABEL[i.signal]);

  return { total, band: total >= 75 ? 'Hot' : total < 40 ? 'Cold' : 'Warm', reasons };
}
