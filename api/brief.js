// Vercel serverless function: AI-assisted policy brief (EarthSignal Policy v2).
// POST /api/brief  { mode: "brief" | "ask", question?, facts, code? }
// Claude writes ONLY from the facts the page computed (issues, alerts, sources), citing their IDs.
// Env: ANTHROPIC_API_KEY (required), CLAUDE_MODEL (optional), ACCESS_CODE (optional shared passcode).

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
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
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'not_configured', message: 'AI is not configured: add ANTHROPIC_API_KEY in Vercel → Project → Settings → Environment Variables, then redeploy.' });
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

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: mode === 'brief' ? 1400 : 600,
        temperature: 0.2,
        system: SYSTEM,
        messages: [{ role: 'user', content: `FACTS:\n${facts}\n\nTASK:\n${task}` }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'upstream', message: data?.error?.message || `Claude API error ${r.status}` });
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    return res.status(200).json({ text, model: data.model || MODEL, usage: data.usage || null });
  } catch (e) {
    return res.status(502).json({ error: 'network', message: String(e.message || e) });
  }
}
