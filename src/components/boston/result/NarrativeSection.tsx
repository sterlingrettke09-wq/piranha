/** The plain-English read on the project — sits as the lede under the verdict. */
export function NarrativeSection({ narrative }: { narrative: string }) {
  return (
    <p className="max-w-2xl whitespace-pre-line text-lg leading-relaxed text-piranha-charcoal/80">
      {narrative}
    </p>
  )
}
