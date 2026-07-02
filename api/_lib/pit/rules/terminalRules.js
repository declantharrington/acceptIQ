// api/_lib/pit/rules/terminalRules.js
// Observation rules for terminal cost efficiency.
//
// Terminal rental is one of the most overlooked cost lines on a merchant
// statement. Many merchants have been renting terminals for years and have
// never considered whether purchase, lease, or a different terminal model
// would be more cost-effective. For merchants with multiple terminals,
// rental costs compound significantly.
//
// Key assessments:
//   - Per-terminal monthly cost (extract from setup if itemised)
//   - Terminal count vs transaction volume (over-terminalised?)
//   - Rental vs purchase economics (break-even analysis)
//   - Terminal model appropriateness for transaction profile

import { factEvidence, metricEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

const TERMINAL_RENTAL_LABELS = /terminal.*rent|rent.*terminal|terminal.*hire|hire.*terminal|eftpos.*rent|terminal.*lease/i;
const TERMINAL_FEE_LABELS    = /terminal fee|terminal charge|device fee|terminal.*monthly/i;

function extractTerminalCount(setup) {
  for (const s of (setup || [])) {
    const match = String(s.value || '').match(/(\d+)\s*(?:x|×)?\s*terminal/i) ||
                  String(s.label || '').match(/(\d+)\s*terminal/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function extractPerTerminalRate(setup, terminalFees) {
  // Try to find rate from setup observations like "12 terminals @ $35/month"
  for (const s of (setup || [])) {
    const match = String(s.value || '').match(/@\s*\$?([\d.]+)\s*(?:\/month|per month|pm)/i);
    if (match) return Number(match[1]);
  }
  return null;
}

// Terminal purchase price ranges (approximate, mid-range units)
const TERMINAL_PURCHASE_ESTIMATE = {
  low: 250,    // Basic EFTPOS terminal
  mid: 500,    // Standard countertop terminal
  high: 800    // Smart terminal / Android POS device
};

export function terminalObservationRules(ctx) {
  const { facts = {}, metrics = {} } = ctx;
  const rules = [];

  // ── Rule 1: Terminal rental costs assessed for efficiency ─────────────────
  rules.push(() => {
    if (!facts.terminalFees || Number(facts.terminalFees) <= 0) return null;

    const totalMonthly = Number(facts.terminalFees);
    const annualCost = totalMonthly * 12;
    const terminalCount = extractTerminalCount(facts.setup);
    const perTerminalRate = terminalCount
      ? totalMonthly / terminalCount
      : extractPerTerminalRate(facts.setup, facts.terminalFees);

    // Break-even analysis: at what point would purchasing be cheaper?
    const breakEvenMonths = perTerminalRate
      ? Math.round(TERMINAL_PURCHASE_ESTIMATE.mid / perTerminalRate)
      : null;

    let severity = 'Low';
    let implication = 'Terminal rental costs are visible. A purchase vs rent analysis is worth conducting at lease renewal.';
    let observation = `Terminal rental fees: $${totalMonthly.toFixed(2)}/month ($${Math.round(annualCost).toLocaleString('en-AU')}/yr).`;

    if (terminalCount) {
      observation += ` ${terminalCount} terminal${terminalCount > 1 ? 's' : ''}.`;
    }
    if (perTerminalRate) {
      observation += ` ~$${perTerminalRate.toFixed(2)}/terminal/month.`;
      if (perTerminalRate > 50) {
        severity = 'Medium';
        implication = `At $${perTerminalRate.toFixed(2)}/terminal/month, the rental rate is above the typical range of $20–$45/month. Validate whether the hardware model justifies this rate or whether a purchase option would be more cost-effective.`;
      }
    }
    if (breakEvenMonths) {
      observation += ` Break-even vs purchase (~$${TERMINAL_PURCHASE_ESTIMATE.mid}/unit): ~${breakEvenMonths} months.`;
      if (breakEvenMonths <= 18) {
        severity = 'Medium';
        implication = `Purchase break-even at current rental rate is ~${breakEvenMonths} months. For terminals the merchant expects to use long-term, outright purchase is likely more cost-effective.`;
      }
    }
    if (annualCost > 5000) {
      severity = 'Medium';
    }

    return {
      id: 'OBS-TERMINAL-001',
      category: 'Terminal costs',
      title: `Terminal rental: $${totalMonthly.toFixed(2)}/month ($${Math.round(annualCost).toLocaleString('en-AU')}/yr)${terminalCount ? ` across ${terminalCount} terminal${terminalCount > 1 ? 's' : ''}` : ''}`,
      observation,
      confidence: 'Confirmed',
      severity,
      evidence: [
        factEvidence('Terminal fees', `$${totalMonthly.toFixed(2)}/month`),
        terminalCount ? factEvidence('Terminal count', terminalCount) : null,
        perTerminalRate ? metricEvidence('Per-terminal monthly cost', `$${perTerminalRate.toFixed(2)}`, 'Estimated') : null,
        breakEvenMonths ? metricEvidence('Break-even vs purchase', `~${breakEvenMonths} months`, 'Estimated') : null,
        kbEvidence('Terminal purchase prices range ~$250–$800 for standard units. Rental is typically $20–$45/month for basic terminals, more for smart terminals.'),
        ruleEvidence('terminal-rental-efficiency', 'Terminal rental cost assessed against purchase economics and typical market rates')
      ].filter(Boolean),
      commercialImplication: implication
    };
  });

  // ── Rule 2: Terminal count relative to transaction volume ─────────────────
  rules.push(() => {
    const terminalCount = extractTerminalCount(facts.setup);
    if (!terminalCount || !metrics.transactions) return null;

    const txnPerTerminal = Math.round(metrics.transactions / terminalCount);
    const volumePerTerminal = metrics.volume ? Math.round(metrics.volume / terminalCount) : null;

    // Benchmarks: a typical retail terminal handles ~3,000–8,000 transactions/month
    const underutilised = txnPerTerminal < 1000;
    const highUtilisation = txnPerTerminal > 10000;

    if (!underutilised && !highUtilisation) return null; // In normal range — no observation needed

    let title, observation, severity, implication;

    if (underutilised) {
      title = `Terminal estate may be oversized: ${txnPerTerminal} transactions/terminal/month`;
      observation = `${terminalCount} terminals processing ${metrics.transactions.toLocaleString('en-AU')} transactions/month = ~${txnPerTerminal} transactions per terminal. This is below the typical active terminal utilisation range of 1,000–8,000 transactions/month.`;
      severity = 'Medium';
      implication = `The merchant may be renting more terminals than their transaction volume justifies. Reducing terminal count could lower hardware costs without impacting throughput.${volumePerTerminal ? ` Each terminal handles ~$${volumePerTerminal.toLocaleString('en-AU')}/month in volume.` : ''}`;
    } else {
      title = `Terminal estate may be under-resourced: ${txnPerTerminal} transactions/terminal/month`;
      observation = `${terminalCount} terminals processing ${metrics.transactions.toLocaleString('en-AU')} transactions/month = ~${txnPerTerminal} transactions per terminal. High utilisation may create queue times or terminal availability issues.`;
      severity = 'Low';
      implication = 'High terminal utilisation is operationally efficient but may create customer experience issues at peak times. Monitor queue data if available.';
    }

    return {
      id: 'OBS-TERMINAL-002',
      category: 'Terminal costs',
      title,
      observation,
      confidence: 'Estimated',
      severity,
      evidence: [
        factEvidence('Terminal count', terminalCount),
        metricEvidence('Transactions/terminal/month', txnPerTerminal, 'Estimated'),
        volumePerTerminal ? metricEvidence('Volume/terminal/month', `$${volumePerTerminal.toLocaleString('en-AU')}`, 'Estimated') : null,
        ruleEvidence('terminal-utilisation', 'Terminal count assessed against transaction volume and typical utilisation benchmarks')
      ].filter(Boolean),
      commercialImplication: implication
    };
  });

  return rules;
}
