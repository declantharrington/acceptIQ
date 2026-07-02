// api/_lib/pit/rules/transactionRules.js
// Observation rules for per-transaction fee structures and their interaction
// with average transaction value (ATV).
//
// A flat per-transaction fee that is competitive for a $200 ATV merchant
// can be highly punitive for a $15 ATV merchant. The PIT assesses whether
// the merchant's pricing structure is appropriate for their transaction profile.

import { factEvidence, metricEvidence, ruleEvidence, kbEvidence } from '../engines/evidenceEngine.js';

const GATEWAY_FEE_LABELS = /gateway.*transaction|transaction.*fee|authorisation.*fee|auth.*fee/i;
const PCI_FEE_LABELS     = /pci|compliance fee/i;
const BATCH_FEE_LABELS   = /batch|settlement.*fee/i;
const REFUND_FEE_LABELS  = /refund.*fee|refund.*processing/i;

function findTransactionFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f => GATEWAY_FEE_LABELS.test(f.label || ''));
}

function findPCIFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f => PCI_FEE_LABELS.test(f.label || ''));
}

function findBatchFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f => BATCH_FEE_LABELS.test(f.label || ''));
}

function findRefundFees(feeBreakdown) {
  return (feeBreakdown || []).filter(f => REFUND_FEE_LABELS.test(f.label || ''));
}

export function transactionObservationRules(ctx) {
  const { facts = {}, metrics = {} } = ctx;
  const rules = [];

  // ── Rule 1: Per-transaction fee impact relative to ATV ───────────────────
  rules.push(() => {
    const txnFees = findTransactionFees(facts.feeBreakdown);
    if (!txnFees.length) return null;

    const totalTxnFeeAmount = txnFees.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const txnCount = facts.transactions || metrics.transactions;
    if (!txnCount || txnCount <= 0) return null;

    const unitCost = totalTxnFeeAmount / txnCount;
    const atv = metrics.averageTransactionValue || facts.averageTransactionValue;

    // Express per-transaction fees as a % of ATV to assess structural fit
    const unitCostAsPct = atv && atv > 0 ? (unitCost / atv) * 100 : null;

    let severity = 'Low';
    let implication = 'Per-transaction fees appear proportionate to average transaction value.';
    let atvComment = '';

    if (unitCostAsPct !== null) {
      atvComment = ` At an average ticket of $${atv.toFixed(2)}, per-transaction fees represent approximately ${unitCostAsPct.toFixed(3)}% of each transaction.`;
      if (unitCostAsPct > 0.5) {
        severity = 'High';
        implication = `Per-transaction fees represent ${unitCostAsPct.toFixed(2)}% of average ticket value — a structurally punitive rate for this ATV. A percentage-only or lower fixed-fee structure may be more appropriate.`;
      } else if (unitCostAsPct > 0.15) {
        severity = 'Medium';
        implication = `Per-transaction fees represent ${unitCostAsPct.toFixed(2)}% of average ticket. This is manageable at current ATV but would compound significantly if average ticket decreases.`;
      }
    }

    return {
      id: 'OBS-TXN-001',
      category: 'Transaction cost structure',
      title: `Per-transaction fees: $${unitCost.toFixed(4)} per transaction across ${txnCount.toLocaleString('en-AU')} transactions`,
      observation: `Per-transaction fee lines total $${totalTxnFeeAmount.toFixed(2)} across ${txnCount.toLocaleString('en-AU')} transactions (~$${unitCost.toFixed(4)}/transaction).${atvComment}`,
      confidence: 'Confirmed',
      severity,
      evidence: [
        ...txnFees.map(f => factEvidence(f.label, `$${f.amount}`)),
        atv ? metricEvidence('Average transaction value', `$${atv.toFixed(2)}`, 'Confirmed') : null,
        unitCostAsPct ? metricEvidence('Per-transaction cost as % of ATV', `${unitCostAsPct.toFixed(3)}%`, 'Estimated') : null,
        ruleEvidence('per-txn-atv-fit', 'Per-transaction fee assessed against average ticket value')
      ].filter(Boolean),
      commercialImplication: implication
    };
  });

  // ── Rule 2: PCI compliance fee ────────────────────────────────────────────
  rules.push(() => {
    const pciFees = findPCIFees(facts.feeBreakdown);
    if (!pciFees.length) return null;

    const pciTotal = pciFees.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const isOnline = /online|cnp|e-commerce|gateway/i.test(
      (facts.observations || []).join(' ') + (facts.setup || []).map(s => s.value).join(' ')
    );

    return {
      id: 'OBS-TXN-002',
      category: 'Transaction cost structure',
      title: `PCI compliance fee of $${pciTotal.toFixed(2)}/month is visible`,
      observation: `A PCI compliance fee of $${pciTotal.toFixed(2)} per month ($${(pciTotal * 12).toFixed(2)}/yr) is charged.${isOnline ? ' The merchant accepts online payments, which determines PCI scope.' : ''}`,
      confidence: 'Confirmed',
      severity: pciTotal > 200 ? 'Medium' : 'Low',
      evidence: [
        ...pciFees.map(f => factEvidence(f.label, `$${f.amount}`)),
        kbEvidence('PCI DSS compliance fees vary by SAQ type. Gateway tokenisation can reduce PCI scope for some merchants.'),
        ruleEvidence('pci-fee-assessment', 'PCI compliance fee noted for stack cost completeness')
      ],
      commercialImplication: pciTotal > 200
        ? 'PCI compliance fee is elevated. Validate that the fee reflects the correct SAQ type for this merchant. Gateway tokenisation or point-to-point encryption may reduce scope and cost.'
        : 'PCI fee is within a typical range. Confirm compliance is current and SAQ type is appropriate for the merchant\'s acceptance channels.'
    };
  });

  // ── Rule 3: Batch settlement fee ─────────────────────────────────────────
  rules.push(() => {
    const batchFees = findBatchFees(facts.feeBreakdown);
    if (!batchFees.length) return null;

    const batchTotal = batchFees.reduce((s, f) => s + (Number(f.amount) || 0), 0);

    return {
      id: 'OBS-TXN-003',
      category: 'Transaction cost structure',
      title: `Batch settlement fee of $${batchTotal.toFixed(2)} is visible`,
      observation: `A batch settlement fee of $${batchTotal.toFixed(2)} per month is charged. This fee appears on legacy acquirer pricing schedules and is not present on modern flat-fee or fully bundled plans.`,
      confidence: 'Confirmed',
      severity: 'Low',
      evidence: [
        ...batchFees.map(f => factEvidence(f.label, `$${f.amount}`)),
        ruleEvidence('batch-fee-legacy', 'Batch settlement fees indicate a legacy-structured pricing schedule')
      ],
      commercialImplication: 'Batch settlement fees are a legacy pricing artefact. Their presence may indicate the merchant is on an older pricing schedule that has not been reviewed recently.'
    };
  });

  // ── Rule 4: Refund processing fees ───────────────────────────────────────
  rules.push(() => {
    const refundFees = findRefundFees(facts.feeBreakdown);
    if (!refundFees.length) return null;

    const refundFeeTotal = refundFees.reduce((s, f) => s + (Number(f.amount) || 0), 0);

    return {
      id: 'OBS-TXN-004',
      category: 'Transaction cost structure',
      title: `Refund processing fees of $${refundFeeTotal.toFixed(2)} are visible`,
      observation: `Refund processing fees total $${refundFeeTotal.toFixed(2)} this period. Not all acquirers charge refund fees — their presence indicates a pricing schedule with itemised operational charges.`,
      confidence: 'Confirmed',
      severity: 'Low',
      evidence: [
        ...refundFees.map(f => factEvidence(f.label, `$${f.amount}`)),
        ruleEvidence('refund-fee-presence', 'Refund fees noted as pricing schedule indicator')
      ],
      commercialImplication: 'Refund fees are avoidable on many modern acquirer schedules. If the merchant has a high refund rate, these fees compound and should be included in any total cost comparison.'
    };
  });

  return rules;
}
