// api/_lib/pit/rules/recurringBillingRules.js
// Observation rules for recurring billing and stored credential payment models.
//
// Merchants using stored credentials for recurring billing (subscriptions,
// memberships, instalment plans) have specific compliance obligations under
// Visa and Mastercard Merchant Initiated Transaction (MIT) frameworks.
// Non-compliant implementations result in:
//   1. Higher interchange rates (card-present liability shift doesn't apply)
//   2. Higher chargeback rates (customers don't recognise transactions)
//   3. Involuntary churn from expired/replaced cards without Account Updater
//   4. Potential scheme fines for non-compliant stored credential usage
//
// This rule also assesses whether the merchant is using appropriate
// tools (Account Updater, network tokenisation) to manage credential currency.

import { factEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

const RECURRING_INDICATORS = /recurring|subscription|membership|instalment|installment|standing order|auto.?pay|auto.?bill|auto.?charge|periodic/i;
const MIT_INDICATORS       = /merchant.initiated|mit\b|stored.credent/i;

function isRecurringMerchant(facts) {
  const text = [
    (facts.observations || []).join(' '),
    (facts.setup || []).map(s => `${s.label} ${s.value}`).join(' '),
    facts.context?.businessType || '',
    facts.context?.channels || '',
    facts.context?.raw || ''
  ].join(' ');
  return RECURRING_INDICATORS.test(text) || MIT_INDICATORS.test(text);
}

function hasAccountUpdater(facts) {
  return (facts.feeBreakdown || []).some(f =>
    /account.updater|card.updater|credential.updater/i.test(f.label || '')
  );
}

function hasNetworkTokenisation(facts) {
  return (facts.feeBreakdown || []).some(f =>
    /network.token|tokenisation|tokenization/i.test(f.label || '')
  );
}

function hasHighDeclineRate(facts) {
  const text = (facts.observations || []).join(' ');
  const match = text.match(/(?:auth|authoris|decline).*?rate[:\s]+([\d.]+)%/i);
  if (!match) return false;
  return Number(match[1]) < 95;
}

export function recurringBillingObservationRules(ctx) {
  const { facts = {}, metrics = {} } = ctx;
  const rules = [];

  // ── Rule 1: Recurring billing detected — compliance and churn assessment ──
  rules.push(() => {
    if (!isRecurringMerchant(facts)) return null;

    const accountUpdater = hasAccountUpdater(facts);
    const networkToken   = hasNetworkTokenisation(facts);
    const lowAuthRate    = hasHighDeclineRate(facts);
    const chargebacks    = facts.chargebacks;

    const gaps = [];
    if (!accountUpdater && !networkToken) {
      gaps.push('No Account Updater or network tokenisation visible — credential currency not actively managed');
    } else if (!accountUpdater) {
      gaps.push('Network tokenisation active, but no Account Updater visible — card expiry updates may be missed for non-tokenised stored credentials');
    }
    if (lowAuthRate) {
      gaps.push('Below-benchmark authorisation rate may indicate stale stored credentials or high involuntary decline rate');
    }
    if (chargebacks && chargebacks.ratio > 0.3) {
      gaps.push('Elevated chargeback ratio in a recurring billing context may include "transaction not recognised" disputes');
    }

    let severity = gaps.length >= 2 ? 'High' : gaps.length === 1 ? 'Medium' : 'Low';
    let observation = 'Recurring billing or stored credential acceptance is indicated.';
    if (gaps.length) {
      observation += ` ${gaps.length} gap${gaps.length > 1 ? 's' : ''} identified: ${gaps.join('; ')}.`;
    } else {
      observation += ' Account Updater or network tokenisation is active, which is appropriate for managing credential currency.';
    }

    return {
      id: 'OBS-RECURRING-001',
      category: 'Recurring billing',
      title: `Recurring billing detected${gaps.length ? ` — ${gaps.length} compliance/operational gap${gaps.length > 1 ? 's' : ''}` : ' — credential management appears active'}`,
      observation,
      confidence: 'Likely',
      severity,
      evidence: [
        factEvidence('Recurring billing signals', 'Detected from questionnaire/observations'),
        factEvidence('Account Updater', accountUpdater ? 'Active' : 'Not visible'),
        factEvidence('Network tokenisation', networkToken ? 'Active' : 'Not visible'),
        chargebacks ? factEvidence('Chargeback ratio', `${chargebacks.ratio}%`) : null,
        kbEvidence('Visa and Mastercard Merchant Initiated Transaction (MIT) frameworks require specific compliance for stored credential usage. Non-compliance results in liability shifts and higher interchange.'),
        kbEvidence('Account Updater and network tokenisation reduce involuntary churn by maintaining credential currency when cards are replaced or expire.'),
        ruleEvidence('recurring-billing-compliance', 'Recurring billing flagged for MIT compliance and credential management assessment')
      ].filter(Boolean),
      commercialImplication: gaps.length
        ? 'Recurring billing without proper credential management creates compounding costs: involuntary churn (lost revenue), higher decline rates (lost transactions), and potentially elevated chargebacks ("transaction not recognised" disputes). Implementing Account Updater or network tokenisation typically pays for itself within 2–3 months through recovered revenue.'
        : 'Recurring billing credential management appears to be in place. Validate MIT transaction flagging compliance with the acquirer to ensure correct interchange rates are being applied.'
    };
  });

  // ── Rule 2: High per-transaction fee + recurring model = structural concern─
  rules.push(() => {
    if (!isRecurringMerchant(facts)) return null;
    if (!facts.perTransactionFee || Number(facts.perTransactionFee) <= 0) return null;
    if (!metrics.averageTransactionValue) return null;

    const perTxnCents = Number(facts.perTransactionFee);
    const atv = Number(metrics.averageTransactionValue);
    const perTxnAsPct = (perTxnCents / 100 / atv) * 100;

    // Flag if per-transaction fee >0.3% of ATV for a recurring merchant
    if (perTxnAsPct < 0.3) return null;

    return {
      id: 'OBS-RECURRING-002',
      category: 'Recurring billing',
      title: `Per-transaction fee of ${perTxnCents}¢ is disproportionate for a recurring billing merchant`,
      observation: `Recurring billing merchants typically have high transaction volumes with lower average ticket values. A per-transaction fee of ${perTxnCents}¢ represents ${perTxnAsPct.toFixed(2)}% of the average transaction value of $${atv.toFixed(2)}, compounding significantly across high-volume billing cycles.`,
      confidence: 'Likely',
      severity: perTxnAsPct > 0.5 ? 'High' : 'Medium',
      evidence: [
        factEvidence('Per-transaction fee', `${perTxnCents}¢`),
        factEvidence('Average transaction value', `$${atv.toFixed(2)}`),
        factEvidence('Per-transaction fee as % of ATV', `${perTxnAsPct.toFixed(2)}%`),
        ruleEvidence('recurring-pertxn-atv-fit', 'Per-transaction fee assessed against ATV in recurring billing context')
      ],
      commercialImplication: 'Recurring billing merchants with high transaction volumes and lower ATVs often benefit from negotiating a percentage-only rate rather than a percentage plus per-transaction structure. The per-transaction component becomes the dominant cost at low ATVs.'
    };
  });

  return rules;
}
