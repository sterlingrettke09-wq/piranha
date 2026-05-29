import type { Handler } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'

// Swap to 'claude-haiku-4-5' (cheapest) or 'claude-sonnet-4-6' (mid) to cut
// cost on a public box. claude-opus-4-8 is the most capable (and priciest).
const MODEL = 'claude-opus-4-8'
const MAX_TOKENS = 800
const MAX_QUESTION_CHARS = 1000

const SYSTEM_PROMPT = `You are the assistant for The Piranha Project, a tool that helps real-estate builders and investors understand the regulatory hurdles to building in U.S. cities — zoning, land use, permitting, development feasibility, cost, and timeline.

Answer questions about building regulation and real-estate development in clear, plain English for a non-lawyer audience. Keep answers concise — a few short paragraphs at most. When a question is city-specific, note that rules vary by jurisdiction and that the user should verify with the local building or zoning department.

You do not have access to the user's specific parcel data or any live analysis. If asked about a specific address or parcel, explain that they should run it through the Boston map tool, and give only general guidance.

Boundaries: You provide general regulatory information, not legal, engineering, or financial advice. If a question falls outside building or development regulation, briefly say it is outside your scope. Never invent specific statute or code-section numbers, fee amounts, or deadlines — if you are not certain, tell the user to verify with the city.

Respond only with your final answer in plain prose. Do not include exploratory reasoning, meta-commentary, or markdown headings.`

// Best-effort, per-warm-instance rate limit. Serverless instances are
// ephemeral, so this is a soft guard, NOT a durable limiter — a real cap
// needs a shared store (Netlify KV / Upstash). Documented intentionally.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 8
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > MAX_PER_WINDOW
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(503, {
      code: 'NOT_CONFIGURED',
      message: 'The assistant is not available yet.',
    })
  }

  let question: unknown
  try {
    question = JSON.parse(event.body ?? '{}').question
  } catch {
    return json(400, { code: 'BAD_INPUT', message: 'Invalid request body.' })
  }

  if (typeof question !== 'string' || question.trim() === '') {
    return json(400, { code: 'BAD_INPUT', message: 'Ask a question to get started.' })
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return json(400, {
      code: 'BAD_INPUT',
      message: `Please keep your question under ${MAX_QUESTION_CHARS} characters.`,
    })
  }

  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for'] ||
    'unknown'
  if (rateLimited(ip)) {
    return json(429, {
      code: 'RATE_LIMITED',
      message: 'Too many questions in a short time — please wait a moment and try again.',
    })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: question.trim() }],
    })

    const answer = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    if (answer === '') {
      return json(502, {
        code: 'EMPTY',
        message: 'The assistant could not produce an answer. Please rephrase and try again.',
      })
    }

    return json(200, { answer })
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json(429, { code: 'RATE_LIMITED', message: 'The assistant is busy — try again shortly.' })
    }
    if (err instanceof Anthropic.APIError) {
      console.log({ event: 'ask.upstream_error', status: err.status, type: err.type })
      return json(502, { code: 'UPSTREAM_ERROR', message: 'The assistant is temporarily unavailable.' })
    }
    console.log({ event: 'ask.error', message: err instanceof Error ? err.message : 'unknown' })
    return json(500, { code: 'INTERNAL', message: 'Something went wrong. Please try again.' })
  }
}
