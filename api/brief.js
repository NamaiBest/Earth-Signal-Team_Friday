// Vercel serverless function: AI-assisted policy brief (EarthSignal Policy v2).
// POST /api/brief  { mode: "brief" | "ask", question?, facts, code? }
// The model writes ONLY from the facts the page computed (issues, alerts, sources), citing their IDs.
// Env (one key is enough):
//   GEMINI_API_KEY  Google AI Studio key -> Gemini (used first)    GEMINI_MODEL (default gemini-3.8-flash)
//   ANTHROPIC_API_KEY                    -> Claude (fallback)       CLAUDE_MODEL (default claude-sonnet-5-5)
//   ACCESS_CODE (optional shared passcode)

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const MAX_FACTS_BYTES = 60_000;
const hits = new Map(); // light per-instance rate limit: 20 requests / 10 min / IP

const SYSTEM = `You are EarthSignal's analyst. You help Indian government officials read NASA satellite trend evidence for their jurisdiction.

You receive FACTS as JSON. Each fact has an ID: I# = a statistically significant worsening trend (Mann-Kendall test, Sen's slope per decade with 95% confidence interval, Benjamini-Hochberg q-value), A# = a current anomaly (now vs normal), S# = an emission source (Climate TRACE 2024 estimate) with what satellites see at its location.

Hard rules:
1. Use only numbers that appear in FACTS, written exactly as given (you may round to the same or fewer decimals). Never compute new statistics, totals, rankings or percentages.
2. Cite the fact ID in square brackets right after every claim that uses a fact, e.g. "NO2 is rising 49% per decade in Jharsuguda [I1]".
3. Never say a source caused, is responsible for, or is the main contributor to a trend. Say "is located in", "sits in an area where", "is near". Satellite cells are 25-100 km and mix many sources.
4. A trend is change over the record, not a current concentration or a health-limit exceedance. Do not mention health limits unless asked, and then say this data cannot assess them.
5. Anything not from FACTS (for example policy instruments used elsewhere in India) must go under a heading "Context (not from EarthSignal data)" and be phrased as options to examine, not as facts about this jurisdiction. Do not invent laws, deadlines, budgets or numbers there.
6. Prefer verification steps first (ground monitors, inspections, stack data) before enforcement.
7. Plain, short sentences. Markdown with ## headings and - bullets. No tables. No preamble.`;

const BRIEF = `Write a policy evidence brief for the jurisdiction in FACTS, about 350-450 words, with these sections:
## Summary (3 bullets: the most important things the official should know)
## Priority issues (the strongest worsening trends; say where, which season, how fast, how certain)
## Now vs normal (current alerts, or say there are none)
## Sources to verify (which listed sources sit in the affected areas and what satellites see there; co-location only)
## Options to consider (verification first, then measures; each tied to fact IDs)
## Context (not from EarthSignal data) (optional, 2-3 bullets max)
## What this evidence cannot tell you (2-3 bullets)`;

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'not_configured', message: 'AI is not configured: add GEMINI_API_KEY (Google AI Studio) in Vercel → Project → Settings → Environment Variables, then redeploy.' });
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (process.env.ACCESS_CODE && body.code !== process.env.ACCESS_CODE) return res.status(401).json({ error: 'access_code', message: 'Access code required.' });

  const ip = clientIp(req), now = Date.now(), recent = (hits.get(ip) || []).filter((t) => now - t < 600_000);
  if (recent.length >= 20) return res.status(429).json({ error: 'rate_limited', message: 'Too many requests. Try again in a few minutes.' });
  hits.set(ip, [...recent, now]);

  const mode = body.mode === 'ask' ? 'ask' : 'brief';
  const facts = JSON.stringify(body.facts || {});
  if (facts.length > MAX_FACTS_BYTES) return res.status(413).json({ error: 'too_large' });
  const question = String(body.question || '').slice(0, 500);
  if (mode === 'ask' && !question.trim()) return res.status(400).json({ error: 'empty_question' });

  const task = mode === 'brief' ? BRIEF
    : `Answer the official's question in at most 200 words using the rules. If FACTS cannot answer it, say so and say what data would. Question: ${question}`;

  const prompt = `FACTS:\n${facts}\n\nTASK:\n${task}`;
  try {
    const out = process.env.GEMINI_API_KEY ? await gemini(prompt, mode) : await claude(prompt, mode);
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: 'upstream', message: String(e.message || e) });
  }
}

async function gemini(prompt, mode) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: mode === 'brief' ? 4096 : 2048 },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `Gemini API error ${r.status}`);
  const cand = (data.candidates || [])[0];
  const text = (cand?.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();
  if (!text) throw new Error(`Gemini returned no text (${cand?.finishReason || data?.promptFeedback?.blockReason || 'unknown reason'})`);
  return { text, model: data.modelVersion || GEMINI_MODEL, usage: data.usageMetadata || null };
}

async function claude(prompt, mode) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: mode === 'brief' ? 1400 : 600, temperature: 0.2, system: SYSTEM,
      messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `Claude API error ${r.status}`);
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  return { text, model: data.model || CLAUDE_MODEL, usage: data.usage || null };
}
