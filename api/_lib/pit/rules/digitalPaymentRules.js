// api/_lib/pit/rules/digitalPaymentRules.js
// Observation rules for network tokenisation, digital wallet fees,
// account updater fees, and other digital payment infrastructure costs.
//
// These fees appear in the "Value Added Services & Network Fees" section
// of modern IC++ statements. They reflect the cost of maintaining
// credential currency, supporting digital wallets, and reducing involuntary
// churn from expired cards.

import { factEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

const TOKEN_LABELS         = /network token|token transaction|tokenisation/i;
const WALLET_LABELS        = /digital wallet|wallet token|apple pay|google pay/i;
const ACCOUNT_UPDATER_LABELS = /account updater|card updater|credential updater/i;

function findTokenFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f =>
    TOKEN_LABELS.test(f.label || '') || WALLET_LABELS.test(f.label || '')
  );
}

function findAccountUpdaterFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f => ACCOUNT_UPDATER_LABELS.test(f.label || ''));
}

export function digitalPaymentObservationRules(ctx) {
  const { facts = {}, metrics = {} } = ctx;
  const rules = [];

  // ── Rule 1: Network tokenisation and digital wallet fee cost assessment ───
  rules.push(() => {
    const tokenFees = findTokenFees(facts.feeBreakdown);
    if (!tokenFees.length) return null;

    const totalTokenCost = tokenFees.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const annualised = totalTokenCost * 12;
    const txnCount = facts.transactions || metrics.transactions;

    // Estimate token volume from fee amounts and typical unit rates
    const walletFee = tokenFees.find(f => WALLET_LABELS.test(f.label || ''));
    const networkTokenFee = tokenFees.find(f => TOKEN_LABELS.test(f.label || '') && !WALLET_LABELS.test(f.label || ''));

    const parts = [];
    if (networkTokenFee) parts.push(`Network tokenisation: $${networkTokenFee.amount}`);
    if (walletFee) parts.push(`Digital wallet tokens: $${walletFee.amount}`);

    return {
      id: 'OBS-DIGITAL-001',
      category: 'Digital payments',
      title: `Network tokenisation and digital wallet fees total $${totalTokenCost.toFixed(2)}/month`,
      observation: `${parts.join('. ')}. Total digital credential fees: $${totalTokenCost.toFixed(2)}/month ($${Math.round(annualised).toLocaleString('en-AU')}/yr annualised).`,
      confidence: 'Confirmed',
      severity: annualised > 5000 ? 'Medium' : 'Low',
      evidence: [
        ...tokenFees.map(f => factEvidence(f.label, `$${f.amount}`)),
        kbEvidence('Network tokenisation reduces fraud and involuntary decline rates; wallet tokenisation supports Apple Pay, Google Pay and similar.'),
        ruleEvidence('digital-token-fees', 'Tokenisation fees assessed for cost and strategic value')
      ],
      commercialImplication: annualised > 5000
        ? `Digital credential fees of $${Math.round(annualised).toLocaleString('en-AU')}/yr are material. Validate that unit rates are consistent with the provider pricing schedule and that tokenisation coverage is appropriately configured.`
        : 'Tokenisation fees are proportionate. These costs are generally accepted as a trade-off for lower decline rates and fraud exposure. Verify unit rates are per schedule.'
    };
  });

  // ── Rule 2: Account updater fees ─────────────────────────────────────────
  rules.push(() => {
    const auFees = findAccountUpdaterFees(facts.feeBreakdown);
    if (!auFees.length) return null;

    const auTotal = auFees.reduce((s, f) => s + (Number(f.amount) || 0), 0);

    return {
      id: 'OBS-DIGITAL-002',
      category: 'Digital payments',
      title: `Account Updater fees of $${auTotal.toFixed(2)} are visible`,
      observation: `Account Updater fees total $${auTotal.toFixed(2)}. This service automatically refreshes stored card credentials when cards are re-issued, reducing involuntary payment failures for recurring billing merchants.`,
      confidence: 'Confirmed',
      severity: 'Low',
      evidence: [
        ...auFees.map(f => factEvidence(f.label, `$${f.amount}`)),
        kbEvidence('Account Updater is most valuable for merchants with recurring or subscription billing, where stale credentials cause involuntary churn.'),
        ruleEvidence('account-updater-presence', 'Account Updater noted as a recurring-billing relevant service')
      ],
      commercialImplication: 'Account Updater is a positive indicator that credential currency is being actively managed. Most valuable for subscription or recurring billing models where involuntary churn from expired cards is a revenue risk.'
    };
  });

  // ── Rule 3: Digital wallet presence without tokenisation fees (gap) ───────
  rules.push(() => {
    const hasWalletObservation = (facts.observations || []).some(o =>
      /apple pay|google pay|digital wallet|tap.*pay/i.test(o)
    );
    const hasWalletFees = facts.feeBreakdown?.some(f => WALLET_LABELS.test(f.label || ''));
    const hasTokenFees  = facts.feeBreakdown?.some(f => TOKEN_LABELS.test(f.label || ''));

    // Only flag if digital wallets are mentioned but no token fees visible
    if (!hasWalletObservation || hasWalletFees || hasTokenFees) return null;

    return {
      id: 'OBS-DIGITAL-003',
      category: 'Digital payments',
      title: 'Digital wallet acceptance noted but tokenisation fees are not visible',
      observation: 'Digital wallet acceptance appears relevant from questionnaire context, but no tokenisation or digital wallet fees are visible on this statement.',
      confidence: 'Needs validation',
      severity: 'Low',
      evidence: [
        factEvidence('Digital wallet context', 'Mentioned in questionnaire'),
        factEvidence('Tokenisation fees', 'Not visible on statement'),
        ruleEvidence('digital-wallet-fee-gap', 'Wallet acceptance without visible token fees may indicate bundled or excluded fees')
      ],
      commercialImplication: 'Tokenisation fees may be bundled into the MSF or gateway fee, or may not be charged separately. Clarify with the provider whether digital wallet processing costs are explicitly itemised.'
    };
  });

  return rules;
}
