const env = require('../config/env');
const logger = require('../config/logger');

function buildSystemPrompt({ userProfileText }) {
  return [
    'You are Meddie, MedMap’s AI health assistant.',
    '',
    'Safety policy (must follow):',
    '- You provide medical information and support, not a final diagnosis.',
    '- If symptoms may be urgent (chest pain, difficulty breathing, severe bleeding, confusion, stroke signs, suicidal thoughts, pregnancy emergencies), advise seeking emergency care immediately.',
    '- Encourage seeing a licensed clinician for diagnosis and treatment decisions.',
    '- Be clear about uncertainty and ask clarifying questions.',
    '- Do not provide dosing for prescription-only meds; you may provide general info and suggest consulting a clinician/pharmacist.',
    '',
    'Patient context (use when relevant):',
    userProfileText || '(none provided)',
  ].join('\n');
}

function profileToText(profile) {
  if (!profile) return '';
  const vitals = profile.vitals || {};
  const lines = [];
  if (vitals.heightCm) lines.push(`Height: ${vitals.heightCm} cm`);
  if (vitals.weightKg) lines.push(`Weight: ${vitals.weightKg} kg`);
  if (vitals.bloodGroup) lines.push(`Blood group: ${vitals.bloodGroup}`);
  if (profile.allergies?.length) lines.push(`Allergies: ${profile.allergies.join(', ')}`);
  if (profile.conditions?.length) lines.push(`Conditions: ${profile.conditions.join(', ')}`);
  if (profile.medications?.length) lines.push(`Medications: ${profile.medications.join(', ')}`);
  return lines.join('\n');
}

async function callOpenAiCompatibleChat({ messages }) {
  const apiKey = env.meddie?.openaiApiKey || '';
  const baseUrl = String(env.meddie?.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = env.meddie?.openaiModel || 'gpt-4o-mini';

  if (!apiKey) {
    return {
      ok: false,
      content:
        "I can help, but AI is not configured on this server yet. Please enable Meddie in settings or chat with a provider.",
    };
  }

  const url = `${baseUrl}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error('Meddie LLM error', { status: res.status, data });
    return { ok: false, content: data?.error?.message || 'AI request failed' };
  }
  const content = data?.choices?.[0]?.message?.content;
  return { ok: true, content: String(content || '').trim() };
}

async function generateMeddieReply({ userMessage, medicalProfile, recentTimeline }) {
  const userProfileText = profileToText(medicalProfile);
  const timelineText =
    Array.isArray(recentTimeline) && recentTimeline.length
      ? recentTimeline
          .slice(0, 10)
          .map((t) => {
            const when = t.at ? new Date(t.at).toISOString().slice(0, 10) : '';
            const prov = t.provider?.name ? ` with ${t.provider.name}` : '';
            const note = t.providerNote ? ` | Summary: ${t.providerNote}` : '';
            return `- ${when} ${t.kind || 'event'} ${t.status || ''}${prov}${note}`.trim();
          })
          .join('\n')
      : '';

  const system = buildSystemPrompt({
    userProfileText:
      userProfileText +
      (timelineText ? `\n\nRecent timeline:\n${timelineText}` : ''),
  });

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: String(userMessage || '').slice(0, 4000) },
  ];

  // Use global fetch (Node 18+), fallback to node-fetch v2 if needed.
  const f = global.fetch || require('node-fetch');
  global.fetch = f;

  const r = await callOpenAiCompatibleChat({ messages });
  if (r.ok && r.content) return r.content;

  return (
    r.content ||
    "I’m here to help. Please tell me your symptoms, how long they’ve lasted, your age, and any red flags (severe pain, breathing difficulty, fainting). If this feels urgent, seek emergency care."
  );
}

module.exports = {
  generateMeddieReply,
};

