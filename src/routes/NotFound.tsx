import { Link } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'

export default function NotFound() {
  return (
    <PageContainer>
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="font-serif text-6xl tracking-tight text-piranha-burgundy">404</p>
        <h1 className="mt-4 font-serif text-3xl tracking-tight">This page swam off</h1>
        <p className="mt-3 text-piranha-charcoal/70">
          The page you’re looking for doesn’t exist. Let’s get you back to solid ground.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="rounded-md bg-piranha-burgundy px-5 py-2.5 text-sm font-medium text-piranha-bone hover:bg-piranha-burgundy/90"
          >
            Go home
          </Link>
          <Link
            to="/map"
            className="rounded-md border border-piranha-charcoal/20 px-5 py-2.5 text-sm font-medium text-piranha-charcoal hover:border-piranha-charcoal/40"
          >
            Analyze a parcel
          </Link>
        </div>
      </div>
    </PageContainer>
  )
}
