import { siteConfig, type SocialLink } from '@/lib/site-config'

// Brand icons are not part of the icon set — use small inline marks.
type MarkProps = { className?: string }

function FacebookMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
    </svg>
  )
}

function InstagramMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <line x1="17.5" y1="6.5" x2="17.5" y2="6.5" />
    </svg>
  )
}

function LinkedinMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0ZM3.4 8.4h3.1V21H3.4V8.4Zm5.28 0h2.97v1.72h.04c.41-.78 1.43-1.6 2.94-1.6 3.14 0 3.72 2.07 3.72 4.76V21h-3.1v-5.55c0-1.32-.02-3.02-1.84-3.02-1.84 0-2.12 1.44-2.12 2.92V21h-3.1V8.4Z" />
    </svg>
  )
}

function XMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.9 2H22l-7 8 8.2 12H16l-5-7.3L5.3 22H2l7.5-8.6L1.5 2H8.7l4.6 6.7L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.4L17.8 20Z" />
    </svg>
  )
}

const icons: Record<SocialLink['platform'], (props: MarkProps) => React.JSX.Element> = {
  facebook: FacebookMark,
  instagram: InstagramMark,
  linkedin: LinkedinMark,
  x: XMark,
}

/** Renders only social links that have a configured URL. */
export function SocialLinks({ className }: { className?: string }) {
  const configured = siteConfig.socials.filter((s) => s.url.trim().length > 0)
  if (configured.length === 0) return null

  return (
    <ul className={className}>
      {configured.map((social) => {
        const Icon = icons[social.platform]
        return (
          <li key={social.platform}>
            <a
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-9 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="size-4" />
              <span className="sr-only">{social.label}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
