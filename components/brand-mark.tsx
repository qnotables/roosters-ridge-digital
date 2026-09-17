import { cn } from '@/lib/utils'

/**
 * Simple geometric brand mark: a ridge line with a rooster-comb crest.
 * Placeholder until a final logo is provided — intentionally abstract.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('size-7', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="30" height="30" rx="3" className="fill-primary" />
      {/* Rooster comb crest */}
      <path d="M9 11c1.4-2 2.8-2 3.2 0 .8-2.2 2.2-2.2 3 0 .8-2 2.2-2 2.8.4" className="stroke-primary-foreground" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* Ridge line */}
      <path d="M6 23l5-6 4 3.5L20 13l6 10" className="stroke-primary-foreground" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
