// api/_lib/pit/rules/routingRules.js
// Observation rules for debit mix, least-cost routing and routing visibility.

import { factEvidence, metricEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

export function routingObservationRules(ctx) {
  const { facts = {}, metrics = {} } = ctx;
  const rules = [];

  rules.push(() => {
    const debitPct = metrics.cardMix?.debitPct ?? facts.cardMix?.debit;
    if (debitPct == null || Number.isNaN(Number(debitPct))) return null;
    const n = Number(debitPct);
    let title = 'Debit mix is low';
    let severity = 'Low';
    let implication = 'Debit routing is unlikely to be the primary commercial lever based on visible card mix.';
    if (n >= 50) {
      title = 'Debit mix is highly material';
      severity = 'High';
      implication = 'Debit routing can materially influence total cost of acceptance and should be validated before focusing on smaller pricing levers.';
    } else if (n >= 20) {
      title = 'Debit mix is commercially relevant';
      severity = 'Medium';
      implication = 'Least-cost routing may be relevant and should be validated if not already confirmed.';
    }
    return {
      id: 'OBS-ROUTING-001',
      category: 'Routing',
      title,
      observation: `Debit represents ${n}% of visible card volume.`,
      confidence: 'Confirmed',
      severity,
      evidence: [
        metricEvidence('Debit mix', `${n}%`, 'Confirmed'),
        ruleEvidence('debit-materiality-bands', 'Debit materiality determined from card mix')
      ],
      commercialImplication: implication
    };
  });

  rules.push(() => {
    const debitPct = metrics.cardMix?.debitPct ?? facts.cardMix?.debit ?? 0;
    const lcrStatus = facts.lcrStatus || 'Unknown';
    if (Number(debitPct) <= 0) return null;
    const confirmedOn = /^(on|enabled|active|yes)$/i.test(lcrStatus);
    if (confirmedOn) {
      return {
        id: 'OBS-ROUTING-002',
        category: 'Routing',
        title: 'Least-cost routing appears active',
        observation: 'LCR status is reported as active/on.',
        confidence: 'Confirmed',
        severity: 'Positive',
        evidence: [
          factEvidence('LCR status', lcrStatus),
          kbEvidence('LCR can reduce debit acceptance cost where applicable')
        ],
        commercialImplication: 'The routing opportunity may already be partially captured, although configuration by channel can still be validated.'
      };
    }
    return {
      id: 'OBS-ROUTING-002',
      category: 'Routing',
      title: 'Least-cost routing cannot be verified',
      observation: `LCR status is ${lcrStatus || 'Unknown'} while debit volume is present.`,
      confidence: lcrStatus === 'Off' ? 'Likely' : 'Needs validation',
      severity: Number(debitPct) >= 20 ? 'High' : 'Medium',
      evidence: [
        factEvidence('LCR status', lcrStatus || 'Unknown', lcrStatus === 'Off' ? 'Likely' : 'Needs validation'),
        metricEvidence('Debit mix', `${debitPct}%`, 'Confirmed'),
        kbEvidence('Least-cost routing can reduce debit acceptance cost', 'LCR relevance depends on channel and configuration')
      ],
      commercialImplication: 'Routing configuration should be validated before concluding whether debit acceptance is optimised.'
    };
  });

  return rules;
}
