import { SliderInput } from './SliderInput'

interface Props {
  stories: string
  heightFt: string
  onStories: (v: string) => void
  onHeight: (v: string) => void
}

export function StepHeight({ stories, heightFt, onStories, onHeight }: Props) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-2xl tracking-tight text-piranha-charcoal">How tall?</h2>
      <p className="text-sm text-piranha-charcoal/60">
        Set height in feet, stories, or both. Feet is used when both are provided.
      </p>
      <SliderInput label="Height" value={heightFt} onChange={onHeight} min={0} max={700} step={5} unit="ft" />
      <SliderInput label="Stories" value={stories} onChange={onStories} min={0} max={60} step={1} unit="stories" />
    </div>
  )
}
