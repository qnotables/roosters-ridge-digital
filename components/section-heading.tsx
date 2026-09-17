import { cn } from '@/lib/utils'

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  as = 'h2',
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
  as?: 'h1' | 'h2'
  className?: string
}) {
  const Heading = as

  return (
    <div className={cn('flex flex-col gap-3', align === 'center' && 'items-center text-center', className)}>
      {eyebrow && (
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          <span className="h-px w-6 bg-primary" aria-hidden="true" />
          {eyebrow}
        </span>
      )}
      <Heading className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</Heading>
      {description && (
        <p className={cn('max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground', align === 'center' && 'mx-auto')}>
          {description}
        </p>
      )}
    </div>
  )
}
