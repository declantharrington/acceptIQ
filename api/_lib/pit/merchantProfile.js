// api/_lib/pit/merchantProfile.js
// Merchant Intelligence: understands the merchant, audience, profile, goals and context.

import { lower } from './utils.js';

export function buildMerchantProfile(facts) {
  const ctx = facts.context || {};
  const profile = {
    name: ctx.company || 'Merchant',
    contactName: ctx.contactName || null,
    contactEmail: ctx.email || null,
    industry: ctx.industry || inferIndustry(ctx.raw || ''),
    businessModel: inferBusinessModel(ctx, facts),
    channelProfile: inferChannelProfile(ctx, facts),
    monthlyCardVolumeBand: ctx.monthlyCardVolume || inferVolumeBand(facts.volume),
    sizeSegment: inferSizeSegment(ctx.monthlyCardVolume, facts.volume),
    objectives: inferObjectives(ctx),
    riskProfile: inferMerchantRiskProfile(ctx, facts),
    evidence: [],
  };
  if (ctx.company) profile.evidence.push(`Company name provided: ${ctx.company}`);
  if (profile.industry) profile.evidence.push(`Industry/profile: ${profile.industry}`);
  if (profile.channelProfile) profile.evidence.push(`Channels/profile: ${profile.channelProfile}`);
  return profile;
}

function inferIndustry(text) {
  const t = lower(text);
  if (/hospitality|restaurant|cafe|bar|pub/.test(t)) return 'Hospitality';
  if (/retail|store|shop|ecommerce|e-commerce/.test(t)) return 'Retail';
  if (/health|medical|clinic|dental/.test(t)) return 'Health';
  if (/travel|tourism|hotel|accommodation/.test(t)) return 'Travel / tourism';
  if (/education|school|training/.test(t)) return 'Education';
  return null;
}
function inferBusinessModel(ctx, facts) {
  const t = lower([ctx.businessType, ctx.channels, ctx.raw, facts.observations?.join(' ')].join(' '));
  if (/both|omni|multi-channel/.test(t)) return 'Omnichannel';
  if (/online|ecommerce|e-commerce|card-not-present|cnp/.test(t)) return 'Online / card-not-present';
  if (/in-store|instore|terminal|eftpos|card present|card-present/.test(t)) return 'Card-present';
  return 'Not fully determined';
}
function inferChannelProfile(ctx, facts) {
  const t = lower([ctx.channels, ctx.raw, facts.setup?.map(s => `${s.label} ${s.value}`).join(' ')].join(' '));
  const channels = [];
  if (/online|ecommerce|e-commerce|gateway|cnp|card-not-present/.test(t)) channels.push('Online');
  if (/terminal|eftpos|pos|in-store|instore|card present|card-present/.test(t)) channels.push('Card-present');
  if (/mobile wallet|apple pay|google pay|wallet/.test(t)) channels.push('Wallets');
  return channels.length ? channels.join(' + ') : 'Not fully determined';
}
function inferVolumeBand(v) { v=Number(v)||0; if(v>=5000000)return'$5M+ visible in statement period'; if(v>=1000000)return'$1M-$5M visible in statement period'; if(v>=250000)return'$250k-$1M visible in statement period'; if(v>0)return'Under $250k visible in statement period'; return'Unknown'; }
function inferSizeSegment(band, v) { const t=lower(band||''); v=Number(v)||0; if(/50m|5m|\$5m|enterprise/.test(t)||v>=5000000)return'Enterprise / large merchant'; if(/1m|5m|mid|500k/.test(t)||v>=500000)return'Mid-market'; if(v>0)return'SMB'; return'Unknown'; }
function inferObjectives(ctx) { const t=lower([ctx.goals, ctx.raw].join(' ')); const o=[]; if(/cost|fee|save|saving|margin|overpay/.test(t))o.push('Reduce cost of acceptance'); if(/visibility|understand|reporting|benchmark/.test(t))o.push('Improve visibility and benchmarking'); if(/provider|switch|compare|review/.test(t))o.push('Validate provider value'); if(/compliance|surcharge|reform/.test(t))o.push('Prepare for regulatory change'); return o.length?o:['Understand payments costs and opportunities']; }
function inferMerchantRiskProfile(ctx, facts) { const t=lower([ctx.raw, facts.observations?.join(' ')].join(' ')); const r=[]; if(/online|ecommerce|cnp|card-not-present/.test(t))r.push('Online acceptance increases chargeback/fraud visibility importance'); if(/surcharge/.test(t))r.push('Surcharging creates October 2026 planning exposure'); if(facts.cardMix?.foreign > 5)r.push('Foreign card exposure may increase cost volatility'); return r; }
