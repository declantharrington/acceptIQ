// api/_lib/pit/normaliseFacts.js
// Normalises analyser output and admin overrides into a stable PIT input shape.

import { toNumber, round } from './utils.js';

export function normaliseFacts(report = {}, programContext = '') {
  const cardMix = report.cardMix || {};
  const chargebacks = report.chargebacks || null;

  const facts = {
    provider: clean(report.provider),
    period: clean(report.period),
    volume: toNumber(report.volume),
    totalFees: toNumber(report.totalFees),
    effectiveRate: toNumber(report.effectiveRate),
    transactions: toNumber(report.transactions),
    averageTransactionValue: toNumber(report.averageTransactionValue),
    monthlyFee: toNumber(report.monthlyFee),
    terminalFees: toNumber(report.terminalFees),
    perTransactionFee: toNumber(report.perTransactionFee),
    pricingModel: clean(report.pricingModel),
    providerRate: clean(report.providerRate),
    lcrStatus: clean(report.lcrStatus) || 'Unknown',
    cardMix: {
      debit: toNumber(cardMix.debit), credit: toNumber(cardMix.credit),
      amex: toNumber(cardMix.amex), foreign: toNumber(cardMix.foreign),
    },
    feeBreakdown: Array.isArray(report.feeBreakdown) ? report.feeBreakdown.map(x => ({ label: clean(x.label), amount: toNumber(x.amount) })).filter(x => x.label) : [],
    setup: Array.isArray(report.setup) ? report.setup.map(x => ({ label: clean(x.label), value: clean(x.value) })).filter(x => x.label || x.value) : [],
    chargebacks: chargebacks ? { count: toNumber(chargebacks.count), amount: toNumber(chargebacks.amount), fees: toNumber(chargebacks.fees), ratio: toNumber(chargebacks.ratio) } : null,
    observations: Array.isArray(report.observations) ? report.observations.map(clean).filter(Boolean) : [],
    context: parseProgramContext(programContext),
    raw: report,
  };

  if ((!facts.effectiveRate || facts.effectiveRate <= 0) && facts.volume && facts.totalFees) facts.effectiveRate = round((facts.totalFees / facts.volume) * 100, 3);
  if ((!facts.averageTransactionValue || facts.averageTransactionValue <= 0) && facts.volume && facts.transactions) facts.averageTransactionValue = round(facts.volume / facts.transactions, 2);
  return facts;
}

function clean(v) { const s = String(v ?? '').trim(); return s || null; }

export function parseProgramContext(programContext = '') {
  const text = String(programContext || '');
  const get = label => text.match(new RegExp(`${label}:\s*([^\n]+)`, 'i'))?.[1]?.trim() || null;
  return {
    company: get('Company'), contactName: get('Name') || get('Contact'), email: get('Email'), phone: get('Phone'),
    industry: get('Industry'), businessType: get('Business type') || get('Business Type'),
    monthlyCardVolume: get('Monthly card volume') || get('Monthly Card Volume'),
    currentProvider: get('Current provider') || get('Current Provider'),
    channels: get('Channels') || get('Payment channels') || get('Payment Channels'),
    surcharge: get('Surcharge') || get('Surcharging'), goals: get('Goals') || get('Priorities'), raw: text,
  };
}
