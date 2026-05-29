import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { handler } from '../ask'

type Ev = Parameters<typeof handler>[0]
type Ctx = Parameters<typeof handler>[1]

const call = (init: Partial<Ev>) =>
  handler(
    { httpMethod: 'POST', headers: {}, body: '{}', ...init } as unknown as Ev,
    {} as Ctx,
    () => undefined,
  ) as Promise<{ statusCode: number; body: string }>

describe('ask handler — request gating (no API call)', () => {
  const original = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })
  afterEach(() => {
    if (original === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = original
  })

  it('rejects non-POST with 405', async () => {
    const res = await call({ httpMethod: 'GET' })
    expect(res.statusCode).toBe(405)
    expect(JSON.parse(res.body).code).toBe('METHOD_NOT_ALLOWED')
  })

  it('returns 503 NOT_CONFIGURED when the API key is absent', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = await call({ body: JSON.stringify({ question: 'Can I build here?' }) })
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body).code).toBe('NOT_CONFIGURED')
  })

  it('rejects an empty question with 400', async () => {
    const res = await call({ body: JSON.stringify({ question: '   ' }) })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('BAD_INPUT')
  })

  it('rejects a missing question with 400', async () => {
    const res = await call({ body: JSON.stringify({}) })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('BAD_INPUT')
  })

  it('rejects malformed JSON with 400', async () => {
    const res = await call({ body: 'not json' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('BAD_INPUT')
  })

  it('rejects an over-long question with 400', async () => {
    const res = await call({ body: JSON.stringify({ question: 'a'.repeat(1001) }) })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('BAD_INPUT')
  })
})
