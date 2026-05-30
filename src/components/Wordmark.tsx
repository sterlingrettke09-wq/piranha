import { useState } from 'react'
import { Link } from 'react-router-dom'

const WORDMARK_SRC = '/logo/the-piranha-project-horizontal-cut.png'

export function Wordmark({ light = false }: { light?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <Link to="/" className="inline-flex items-center" aria-label="The Piranha Project home">
      {imgFailed ? (
        <span
          className={`font-serif font-bold text-lg sm:text-xl tracking-tight ${
            light ? 'text-piranha-bone' : 'text-piranha-burgundy'
          }`}
        >
          THE PIRANHA PROJECT
        </span>
      ) : (
        <img
          src={WORDMARK_SRC}
          alt="The Piranha Project"
          className={`h-10 sm:h-12 w-auto ${light ? 'brightness-0 invert' : ''}`}
          onError={() => setImgFailed(true)}
        />
      )}
    </Link>
  )
}
