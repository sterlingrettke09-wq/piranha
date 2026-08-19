// Transactional email, for exactly one message: the login link.
//
// ⚠️ AN UNCONFIGURED SENDER IS ITS OWN STATE, NOT A FAILURE AND NOT A SUCCESS.
// This is CLAUDE.md rule 5 applied to a side effect. If a missing API key
// returned `false` alongside a real delivery failure, the deploy where nobody
// set the key would look identical to the deploy where the provider was down —
// and the visible symptom of both ("no email arrived") is the same, so the log
// is the only place they can be told apart. If it returned `true`, the login
// endpoint would report success for a message that was never sent.

export type SendResult =
  | { status: 'sent'; id: string | null }
  | { status: 'not-configured'; detail: string }
  | { status: 'failed'; detail: string }

const API = 'https://api.resend.com/emails'

export function senderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM)
}

export async function sendLoginEmail(to: string, link: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.AUTH_EMAIL_FROM
  if (!key || !from) {
    return {
      status: 'not-configured',
      detail: `set ${!key ? 'RESEND_API_KEY' : ''}${!key && !from ? ' and ' : ''}${!from ? 'AUTH_EMAIL_FROM' : ''}`,
    }
  }
  // The link is the credential, so the body is deliberately plain: no tracking
  // pixel, no click-wrapping redirect. A provider that rewrites links would turn
  // every login into a redemption by the scanner that opened the mail first.
  const text = [
    'Sign in to The Piranha Project.',
    '',
    link,
    '',
    'This link works once and expires in 15 minutes.',
    'If you did not ask to sign in, you can ignore this — nothing has changed.',
  ].join('\n')

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to, subject: 'Your sign-in link', text }),
    })
    if (!res.ok) {
      // The provider's body can echo the address; keep the status, drop the body.
      return { status: 'failed', detail: `provider returned HTTP ${res.status}` }
    }
    const j = (await res.json().catch(() => null)) as { id?: string } | null
    return { status: 'sent', id: j?.id ?? null }
  } catch (e) {
    return { status: 'failed', detail: e instanceof Error ? e.message : String(e) }
  }
}
