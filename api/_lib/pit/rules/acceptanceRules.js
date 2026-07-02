// api/_lib/pit/rules/acceptanceRules.js
// Observation rules for card acceptance performance metrics:
//   - Contactless / tap acceptance rate
//   - MOTO (Mail Order / Telephone Order) liability exposure
//   - CNP without 3DS authentication gap
//   - Authorisation rate and decline analysis
//
// These are operational indicators that appear in observations and setup
// data extracted by the analyser. They don't directly appear as line items
// but are commercially significant — particularly for online/CNP merchants.

import { factEvidence, metricEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

function extractRate(observations, patterns) {
  const text = (observations || []).join(' ');
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function isMOTO(facts) {
  const text = [
    (facts.observations || []).join(' '),
    (facts.setup || []).map(s => `${s.label} ${s.value}`).join(' '),
    facts.context?.raw || ''
  ].join(' ').toLowerCase();
  return /moto|mail order|telephone order|phone order|call centre|card not present.*phone|cnp.*phone/i.test(text);
}

function isCNPMerchant(facts) {
  const text = [
    (facts.observations || []).join(' '),
    facts.context?.channels || '',
    facts.context?.raw || ''
  ].join(' ').toLowerCase();
  return /online|ecommerce|e-commerce|card.not.present|cnp|website/i.test(text);
}

export function acceptanceObservationRules(ctx) {
  const { facts = {}, metrics = {}, merchantProfile = {} } = ctx;
  const rules = [];

  // ── Rule 1: Authorisation rate analysis ───────────────────────────────────
  rules.push(() => {
    const authRate = extractRate(facts.observations, [
      /auth(?:orisation|orization)?\s*(?:rate|%)?[:\s]+([\d.]+)%/i,
      /approval\s*rate[:\s]+([\d.]+)%/i,
      /([\d.]+)%\s*auth(?:orisation|orization)/i,
      /acceptance\s*rate[:\s]+([\d.]+)%/i
    ]);

    if (authRate === null) return null;

    // Benchmarks: 98%+ = excellent, 96–98% = acceptable, <96% = investigate
    let severity = 'Low';
    let implication = 'Authorisation rate is healthy.';
    let title = `Authorisation rate: ${authRate}%`;

    if (authRate < 94) {
      severity = 'High';
      title = `Authorisation rate of ${authRate}% is materially below benchmark`;
      implication = `An authorisation rate of ${authRate}% represents significant lost revenue. For every 100 attempted transactions, ~${(100 - authRate).toFixed(1)} are declined. At this merchant's volume, that equates to approximately $${metrics.volume ? Math.round(metrics.volume * ((100 - authRate) / 100)).toLocaleString('en-AU') : '?'} in declined volume per period. Decline reason analysis and issuer optimisation are warranted.`;
    } else if (authRate < 97) {
      severity = 'Medium';
      title = `Authorisation rate of ${authRate}% warrants monitoring`;
      implication = `An authorisation rate below 97% may indicate friction in the payment flow, card issuer friction, or network routing issues. Reviewing decline codes with the acquirer or gateway is recommended.`;
    } else {
      implication = `Authorisation rate of ${authRate}% is within the strong range (98%+ is typical for well-optimised merchants). No action required.`;
    }

    return {
      id: 'OBS-ACCEPTANCE-001',
      category: 'Acceptance performance',
      title,
      observation: `Transaction authorisation rate: ${authRate}%. ${authRate >= 98 ? 'This is within the healthy benchmark range.' : authRate >= 96 ? 'This is slightly below the 98%+ benchmark for well-optimised merchants.' : 'This is materially below the 98%+ benchmark — revenue is being lost to preventable declines.'}`,
      confidence: 'Confirmed',
      severity,
      evidence: [
        factEvidence('Authorisation rate', `${authRate}%`),
        metrics.volume ? metricEvidence('Card volume', `$${Number(metrics.volume).toLocaleString('en-AU')}`, 'Confirmed') : null,
        kbEvidence('Industry benchmark: 98%+ authorisation rate for well-optimised merchants. Rates below 96% typically indicate systemic issues with payment routing, 3DS configuration, or card issuer friction.'),
        ruleEvidence('auth-rate-benchmark', 'Authorisation rate benchmarked against industry standard')
      ].filter(Boolean),
      commercialImplication: implication
    };
  });

  // ── Rule 2: Contactless / tap rate ────────────────────────────────────────
  rules.push(() => {
    const contactlessRate = extractRate(facts.observations, [
      /contactless[:\s]+([\d.]+)%/i,
      /tap[:\s]+([\d.]+)%/i,
      /([\d.]+)%\s*contactless/i,
      /([\d.]+)%\s*tap/i
    ]);

    if (contactlessRate === null) return null;

    const isHighContactless = contactlessRate >= 85;
    const isLowContactless  = contactlessRate < 40;

    let severity = 'Low';
    let observation = `Contactless/tap transactions represent ${contactlessRate}% of card-present volume.`;
    let implication = 'Contactless acceptance is within a normal range.';

    if (isHighContactless) {
      observation += ' Contactless is the dominant acceptance method.';
      implication = 'High contactless dominance is operationally efficient and reduces card-read errors. Ensure LCR routing is configured for contactless dual-network debit where applicable, as contactless routing choices affect scheme fee exposure.';
    } else if (isLowContactless) {
      severity = 'Low';
      observation += ' Chip/swipe transactions represent a significant portion of volume.';
      implication = 'Lower contactless adoption may reflect older terminal hardware, customer demographic, or merchant configuration. Modern terminals default to contactless-first and it is the preferred experience for most customers.';
    }

    return {
      id: 'OBS-ACCEPTANCE-002',
      category: 'Acceptance performance',
      title: `Contactless acceptance rate: ${contactlessRate}%`,
      observation,
      confidence: 'Confirmed',
      severity,
      evidence: [
        factEvidence('Contactless rate', `${contactlessRate}%`),
        ruleEvidence('contactless-rate-assessment', 'Contactless rate noted for routing and terminal configuration context')
      ],
      commercialImplication: implication
    };
  });

  // ── Rule 3: MOTO transactions — liability exposure ────────────────────────
  rules.push(() => {
    if (!isMOTO(facts)) return null;

    const hasChargebacks = !!facts.chargebacks;
    const hasThreeDS = (facts.observations || []).some(o => /3ds|3d.secure|authentication/i.test(o));

    return {
      id: 'OBS-ACCEPTANCE-003',
      category: 'Acceptance performance',
      title: 'MOTO (Mail Order / Telephone Order) acceptance carries full fraud liability',
      observation: `The merchant appears to accept MOTO or phone-order payments. MOTO transactions are card-not-present, cannot be authenticated via 3DS, and result in the merchant bearing 100% of fraud-related chargeback liability with no shift to the card issuer.${hasChargebacks ? ' Chargeback data is visible on this statement.' : ' Chargeback data is not visible, making fraud exposure difficult to assess.'}`,
      confidence: 'Likely',
      severity: 'High',
      evidence: [
        factEvidence('MOTO acceptance', 'Detected from questionnaire/observations'),
        factEvidence('3DS authentication', hasThreeDS ? 'Present' : 'Not applicable for MOTO'),
        factEvidence('Chargeback data', hasChargebacks ? 'Visible' : 'Not visible'),
        kbEvidence('MOTO transactions are excluded from 3DS authentication. The merchant bears 100% of fraud liability on MOTO disputes — there is no liability shift available.'),
        ruleEvidence('moto-liability-gap', 'MOTO acceptance flagged for fraud liability and chargeback risk')
      ],
      commercialImplication: 'MOTO fraud risk should be actively managed through order verification procedures, AVS (Address Verification), and call-back protocols. The merchant should understand that disputed MOTO transactions are extremely difficult to win as chargebacks — the chargeback exposure is a direct cost of this acceptance channel.'
    };
  });

  // ── Rule 4: CNP acceptance without confirmed 3DS ─────────────────────────
  rules.push(() => {
    if (!isCNPMerchant(facts)) return null;
    if (isMOTO(facts)) return null; // Already covered by Rule 3

    const has3DS = (facts.observations || []).some(o =>
      /3ds|3d.secure|authentication rate|challenge rate/i.test(o)
    );
    const has3DSFee = (facts.feeBreakdown || []).some(f =>
      /3d.?secure|3ds|authentication fee/i.test(f.label || '')
    );
    const confirmed3DS = has3DS || has3DSFee;

    if (confirmed3DS) return null; // 3DS is active — no gap

    return {
      id: 'OBS-ACCEPTANCE-004',
      category: 'Acceptance performance',
      title: 'CNP/online acceptance visible but 3DS authentication not confirmed',
      observation: 'The merchant appears to accept card-not-present payments, but 3DS authentication fees or data are not visible on this statement. Without 3DS, the merchant bears full liability for all CNP fraud chargebacks.',
      confidence: 'Likely',
      severity: 'High',
      evidence: [
        factEvidence('CNP/online acceptance', 'Detected'),
        factEvidence('3DS authentication evidence', 'Not visible on statement'),
        kbEvidence('3DS authentication (Visa Secure / Mastercard Identity Check) shifts liability for CNP fraud from the merchant to the card issuer when authentication is successful. Without 3DS, the merchant bears 100% of CNP fraud liability.'),
        ruleEvidence('cnp-3ds-gap', 'CNP acceptance without 3DS confirmation is a material liability gap')
      ],
      commercialImplication: 'Implementing 3DS2 authentication should be treated as a priority for any merchant accepting online card payments. The liability shift from issuer to merchant on unauthenticated CNP transactions is a significant and avoidable cost exposure, particularly as online fraud continues to grow.'
    };
  });

  return rules;
}
