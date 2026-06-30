// api/_lib/pit/paymentsStack.js
// Payments Stack Intelligence: maps visible providers, components and missing visibility.

import { lower } from './utils.js';

export function buildPaymentsStack(facts, merchantProfile) {
  const allText = lower([(facts.setup||[]).map(s=>`${s.label} ${s.value}`).join(' '), (facts.observations||[]).join(' '), facts.context?.raw || ''].join(' '));
  const stack = {
    acquirerOrProvider: facts.provider || facts.context?.currentProvider || null,
    pricingModel: facts.pricingModel || 'Unknown',
    providerMargin: facts.providerRate || null,
    gateway: detectGateway(allText), pos: detectPOS(allText), terminal: detectTerminal(allText),
    channels: merchantProfile.channelProfile, lcrStatus: facts.lcrStatus || 'Unknown',
    surchargeStatus: detectSurchargeStatus(allText), chargebackVisibility: facts.chargebacks ? 'Visible' : 'Not visible',
    visibleComponents: [], missingComponents: [], stackGaps: [],
  };
  if (stack.acquirerOrProvider) stack.visibleComponents.push('Acquirer / merchant facility');
  if (stack.gateway) stack.visibleComponents.push('Gateway');
  if (stack.pos) stack.visibleComponents.push('POS');
  if (stack.terminal) stack.visibleComponents.push('Terminal estate');
  if (facts.feeBreakdown?.length) stack.visibleComponents.push('Fee breakdown');
  if (facts.chargebacks) stack.visibleComponents.push('Chargeback data');
  if (!stack.gateway && /online|card-not-present|cnp|ecommerce|e-commerce/i.test(merchantProfile.businessModel || merchantProfile.channelProfile || '')) {
    stack.missingComponents.push('Gateway fee invoice / gateway reporting');
    stack.stackGaps.push({ id:'gateway-visibility', severity:'Medium', finding:'Gateway costs are not visible in the acquirer statement.', implication:'True cost of acceptance may be understated if gateway fees are billed separately.' });
  }
  if (!facts.chargebacks) stack.missingComponents.push('Chargeback/dispute reporting');
  if (!facts.lcrStatus || facts.lcrStatus === 'Unknown') stack.missingComponents.push('Debit routing configuration');
  stack.completeness = stack.visibleComponents.length >= 5 && stack.missingComponents.length <= 1 ? 'High' : stack.visibleComponents.length >= 3 ? 'Medium' : 'Low';
  return stack;
}
function detectGateway(t){ return /\b(fat zebra|securepay|stripe|adyen|braintree|pin payments|gateway)\b/.test(t) ? 'Gateway indicated' : null; }
function detectPOS(t){ return /\b(pos|vend|lightspeed|shopify|woocommerce|magento|square)\b/.test(t) ? 'POS/eCommerce platform indicated' : null; }
function detectTerminal(t){ return /\b(terminal|eftpos|ingenico|verifone|pax|card present|card-present)\b/.test(t) ? 'Terminal estate indicated' : null; }
function detectSurchargeStatus(t){ if(/sometimes.*surcharge|surcharge.*sometimes/.test(t))return'Sometimes applied'; if(/\b(surcharge|surcharging)\b/.test(t))return'Relevant / indicated'; return'Not indicated'; }
