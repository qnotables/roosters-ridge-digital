import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'

const capabilities = [
  ['Lead Generation', 'Turn website traffic into qualified inquiries with focused forms and conversion flows.', '/industries/solar'],
  ['CRM & Lead Management', 'Keep leads organized and move them through a clear sales process.', '/industries/roofing'],
  ['Business Automation', 'Reduce repetitive work with routing, notifications, and follow-up.', '/industries/hvac'],
  ['Appointment Scheduling', 'Make it easier for customers to book the right next step.', '/industries/hvac'],
  ['Payment Integration', 'Connect the customer journey to secure, practical payment steps.', '/services/custom-solutions'],
  ['Custom Dashboards', 'See the information your team needs without digging through tools.', '/industries/solar'],
  ['Customer Portals', 'Give customers a clearer place to access updates, files, and next steps.', '/industries/professional-services'],
  ['Email Automation', 'Stay helpful and consistent after a form fill, booking, or purchase.', '/industries/roofing'],
  ['Analytics & Reporting', 'Understand what is working and where customers are getting stuck.', '/services/digital-strategy'],
  ['Ecommerce', 'Create a smoother path from product discovery to checkout and repeat business.', '/industries/ecommerce'],
  ['API Integrations', 'Connect the systems your business already depends on.', '/services/custom-solutions'],
  ['AI-Assisted Business Tools', 'Use practical AI support to make everyday work faster and more consistent.', '/services/automation'],
] as const

export function ServicesOverview() {
  return (
    <section id="services" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
      <SectionHeading
        eyebrow="Connected systems"
        title="More Than a Website"
        description="The right digital system helps your business attract, manage, and convert customers — not just look good online."
      />

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {capabilities.map(([title, description, href]) => (
          <li key={title}>
            <Link href={href} className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex items-center gap-1.5 text-lg font-semibold">{title}<ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" /></span>
              <span className="text-sm leading-relaxed text-muted-foreground">{description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
