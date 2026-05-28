import { useState } from 'react'
import { Link } from 'react-router-dom'

const WORDMARK_SRC = '/logo/piranha-wordmark.svg'

export function Wordmark() {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <Link to="/" className="inline-flex items-center" aria-label="Piranha home">
      {imgFailed ? (
        <span className="font-serif font-bold text-2xl tracking-tight text-piranha-burgundy">
          PIRANHA
        </span>
      ) : (
        <img
          src={WORDMARK_SRC}
          alt="Piranha"
          className="h-7 w-auto"
          onError={() => setImgFailed(true)}
        />
      )}
    </Link>
  )
}
