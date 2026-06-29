// api/_lib/pit/paymentsStack.js
// Creates a factual view of the merchant's current payments stack.

import { lower } from './utils.js';

export function buildPaymentsStack({ facts, merchantProfile }) {
  const setupText = [
    ...(facts.setup || []).map(s => `${s.label}: ${s.value}`),
    ...(facts.observations || []),
    merchantProfile.rawProgramContext || ''
  ].join('\n');
  const s = lower(setupText);

  const providers = new Set();
  if (facts.provider) providers.add(facts.provider);
  for (const name of ['fat zebra', 'stripe', 'adyen', 'westpac', 'cba', 'commonwealth', 'nab', 'anz', 'worldline', 'tyro', 'square', 'zeller', 'fiserv', 'paypal', 'braintree']) {
    if (s.includes(name)) providers.add(titleCaseProvider(name));
  }

  return {
    acquirer: facts.provider || null,
    providers: [...providers],
    gatewayDetected: /gateway|fat zebra|stripe|adyen|braintree|paypal/.test(s),
    terminalDetected: /terminal|eftpos|pos|card present|in-store/.test(s),
    pricingModel: facts.pricingModel || 'Unknown',
    providerRate: facts.providerRate || null,
    lcrStatus: facts.lcrStatus || 'Unknown',
    paymentChannels: [merchantProfile.channel].filter(Boolean),
    cardMix: facts.cardMix || {},
    feeBreakdownAvailable: Array.isArray(facts.feeBreakdown) && facts.feeBreakdown.length > 0,
    chargebackDataVisible: Boolean(facts.chargebacks),
    sourceCoverage: {
      acquiringStatement: true,
      gatewayInvoice: /gateway fee|gateway invoice|per transaction fee|monthly gateway/i.test(setupText),
      contracts: false,
      transactionLevelData: false
    }
  };
}

function titleCaseProvider(name) {
  const map = { 'fat zebra': 'Fat Zebra', 'commonwealth': 'CBA', 'worldline': 'ANZ Worldline' };
  return map[name] || name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
