import { SectionHeading } from '@/components/section-heading'

const steps = [
  {
    step: '01',
    title: 'Tell us what you need',
    description: 'Share your goals through a quick form or the free checkup. No commitment, no sales pressure.',
  },
  {
    step: '02',
    title: 'Get a clear plan',
    description: 'We reply with honest scope, a recommended approach, and a free project estimate.',
  },
  {
    step: '03',
    title: 'We build it',
    description: 'You review drafts and give feedback. We refine until it is right and ready to use.',
  },
  {
    step: '04',
    title: 'Launch and grow',
    description: 'Files are prepared for handoff, and ongoing support is available whenever you need it.',
  },
]

export function Process() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
      <SectionHeading
        eyebrow="How it works"
        title="A simple, transparent process"
        description="From first message to finished work, you always know what happens next."
      />
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <li key={step.step} className="relative flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
            <span className="font-mono text-sm font-semibold text-primary">{step.step}</span>
            <h3 className="text-base font-semibold">{step.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
