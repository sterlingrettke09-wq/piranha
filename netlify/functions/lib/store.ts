// One Netlify Blobs accessor, shared by every store this app keeps.
//
// Extracted from searchLog.ts rather than copied: that file carries the explicit
// siteID/token configuration for deploys where Netlify does not inject the Blobs
// environment (MissingBlobsEnvironmentError), and a second hand-written copy of
// that logic would work until the day one of them was updated.
//
// ⚠️ NO LOCAL-FILE FALLBACK HERE, deliberately, and it is the opposite choice
// from the search log's. That log is a fire-and-forget beacon where losing a row
// costs a statistic. These stores hold ACCOUNTS and WATCHLISTS: a write that
// silently lands in /tmp is a row the user believes exists and which vanishes on
// the next cold start. A store that cannot reach Blobs must fail loudly.

import { getStore, type Store } from '@netlify/blobs'

export function blobStore(name: string): Store {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID
  const token = process.env.NETLIFY_BLOBS_TOKEN
  return siteID && token ? getStore({ name, siteID, token }) : getStore(name)
}
