// api/_lib/pit/engines/evidenceEngine.js
// Evidence Engine
// Creates consistent evidence objects so every PIT conclusion can explain why it exists.

export function evidence({ source = 'PIT', type = 'fact', label, value = null, confidence = 'Confirmed', detail = null }) {
  return {
    source,
    type,
    label,
    value,
    confidence,
    detail
  };
}

export function ruleEvidence(ruleId, label, detail = null) {
  return evidence({
    source: 'PIT rulebook',
    type: 'rule',
    label,
    value: ruleId,
    confidence: 'Confirmed',
    detail
  });
}

export function factEvidence(label, value, confidence = 'Confirmed') {
  return evidence({
    source: 'Statement / questionnaire',
    type: 'fact',
    label,
    value,
    confidence
  });
}

export function metricEvidence(label, value, confidence = 'Estimated') {
  return evidence({
    source: 'PIT metrics engine',
    type: 'metric',
    label,
    value,
    confidence
  });
}

export function kbEvidence(label, detail = null) {
  return evidence({
    source: 'acceptorIQ payments knowledge base',
    type: 'knowledge',
    label,
    value: null,
    confidence: 'Confirmed',
    detail
  });
}

export function createEvidenceGraph(observations = [], understandings = [], priorities = []) {
  return {
    observations: observations.map(o => ({
      id: o.id,
      title: o.title,
      evidence: o.evidence || []
    })),
    understandings: understandings.map(u => ({
      id: u.id,
      title: u.title,
      dependsOn: u.dependsOn || [],
      evidence: u.evidence || []
    })),
    priorities: priorities.map(p => ({
      id: p.id,
      title: p.title,
      dependsOn: p.dependsOn || [],
      evidence: p.evidence || []
    }))
  };
}
