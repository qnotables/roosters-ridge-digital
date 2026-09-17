import { BadgeCheck, Clock, HandCoins, MessagesSquare } from 'lucide-react'

const props = [
  {
    icon: BadgeCheck,
    title: 'Credibility first',
    description: 'Everything we make is designed to make a small business look established and trustworthy.',
  },
  {
    icon: HandCoins,
    title: 'Honest scope & pricing',
    description: 'Clear estimates and realistic scope. No jargon, no surprise invoices, no pressure.',
  },
  {
    icon: Clock,
    title: 'Practical turnarounds',
    description: 'Focused deliverables you can actually use — sized right for the platform and the deadline.',
  },
  {
    icon: MessagesSquare,
    title: 'Straightforward communication',
    description: 'You talk to the person doing the work. Questions get answered in plain language.',
  },
]

export function ValueProps() {
  return (
    <section className="border-y border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {props.map((prop) => (
          <div key={prop.title} className="flex flex-col gap-3">
            <span className="flex size-10 items-center justify-center rounded-md border border-border text-primary">
              <prop.icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="text-base font-semibold">{prop.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{prop.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
