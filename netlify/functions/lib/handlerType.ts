import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions'

/**
 * Netlify's own `Handler` type is deliberately permissive: it returns
 * `void | Promise<HandlerResponse>` and takes up to three arguments, because it
 * has to describe callback-style and fire-and-forget functions too.
 *
 * Every function in this repo is the same narrower thing: it takes the event,
 * ignores `context`, and always resolves to a response. Annotating them
 * `Handler` threw that away — callers (the tests above all) then could not read
 * `res.statusCode` without a cast, and a cast is exactly the kind of
 * suppression that has hidden real defects here before.
 *
 * `SatisfiesHandler` is the compile-time proof that the narrowing is safe: if
 * `JsonHandler` ever stops being assignable to Netlify's `Handler`, this file
 * stops compiling. No cast, and no assertion that has to be trusted.
 */
type SatisfiesHandler<T extends Handler> = T

/**
 * `HandlerResponse.body` is optional because Netlify permits a bodiless
 * response. Every return path in this repo writes one (204s write `''`), so we
 * say so — which is what lets a test read `JSON.parse(res.body)` without a
 * non-null assertion, and makes tsc reject the first handler return that
 * forgets the body.
 */
export interface JsonResponse extends HandlerResponse {
  body: string
}

export type JsonHandler = SatisfiesHandler<(event: HandlerEvent) => Promise<JsonResponse>>
