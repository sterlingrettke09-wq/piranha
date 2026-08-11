import type { HandlerEvent } from '@netlify/functions'
import type { JsonHandler, JsonResponse } from '../handlerType'

/**
 * Test-side support for invoking the repo's Netlify functions.
 *
 * The point of building a REAL `HandlerEvent` here, rather than casting a
 * partial object, is that the override is still checked: `handlerEvent({
 * queryStringParamters: {} })` is a compile error, where
 * `{ ... } as unknown as HandlerEvent` silently accepts it.
 */
const BASE_EVENT: HandlerEvent = {
  rawUrl: 'https://piranha.test/',
  rawQuery: '',
  path: '/',
  httpMethod: 'GET',
  headers: {},
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: null,
  isBase64Encoded: false,
}

export function handlerEvent(over: Partial<HandlerEvent> = {}): HandlerEvent {
  return { ...BASE_EVENT, ...over }
}

/** Invoke a function handler with a fully-formed event and read its response. */
export function invokeHandler(
  handler: JsonHandler,
  over: Partial<HandlerEvent> = {},
): Promise<JsonResponse> {
  return handler(handlerEvent(over))
}

/** Shorthand for the common case: a GET with query-string parameters. */
export function invokeWithQuery(
  handler: JsonHandler,
  queryStringParameters: Record<string, string | undefined>,
): Promise<JsonResponse> {
  return invokeHandler(handler, { queryStringParameters })
}
