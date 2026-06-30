// api/_lib/report/narrative/generateNarrative.js
// Calls Claude and returns parsed report narrative JSON.

import { buildSystemPrompt } from '../prompt/reportSystemPrompt.js';
import { buildUserMessage } from './buildUserMessage.js';

export async function generateNarrative({
  anthropicKey,
  model,
  paymentsKb,
  toneGuide,
  selectedModules,
  report,
  metrics,
  priorityOpportunities,
  programContext,
  adminNotes,
  pit
}) {
  const systemPrompt = buildSystemPrompt({ paymentsKb, toneGuide, selectedModules });
  const userMessage = buildUserMessage({
    report,
    metrics,
    selectedModules,
    priorityOpportunities,
    programContext,
    adminNotes,
    pit
  });

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 12000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  if (!claudeRes.ok) {
    const detail = await claudeRes.text();
    throw new Error(`Claude error: ${claudeRes.status} ${detail}`);
  }

  const claudeData = await claudeRes.json();
  if (claudeData.stop_reason === 'max_tokens') {
    console.warn('generate-report: narrative hit max_tokens - JSON may be truncated. Raise max_tokens.');
  }

const rawText = claudeData.content?.find(b => b.type === 'text')?.text || '';

  // Primary path: strip markdown fences if present, then parse the whole
  // trimmed response. This is the most reliable path when the model returns
  // clean JSON (the expected case, per the system prompt's "no markdown
  // fences" instruction) - it avoids the failure mode where a legitimate
  // '{' or '}' inside a narrative string confuses bracket-slicing below.
  const fenceStripped = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(fenceStripped);
  } catch (primaryErr) {
    // Fallback path: naive outer-bracket slicing, for cases where the model
    // added preamble/trailing text around the JSON object despite instructions.
    try {
      const jsonStart = rawText.indexOf('{');
      const jsonEnd = rawText.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('no JSON object found');
      return JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));
    } catch (parseErr) {
      console.error('generate-report: failed to parse narrative JSON:', parseErr.message);
      console.error('Raw model output (first 500 chars):', rawText.slice(0, 500));
      throw new Error('Failed to parse narrative from model output');
    }
  }
}
