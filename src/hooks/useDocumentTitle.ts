import { useEffect } from 'react'

const BASE = 'The Piranha Project'

/** Sets the browser tab title for the current route. Pass the page-specific
 *  part; the brand suffix is appended. Pass null/empty for the bare brand, or
 *  `false` to leave the title untouched (so a route can own its own title). */
export function useDocumentTitle(title?: string | null | false): void {
  useEffect(() => {
    if (title === false) return
    document.title = title ? `${title} · ${BASE}` : BASE
    return () => {
      document.title = BASE
    }
  }, [title])
}
