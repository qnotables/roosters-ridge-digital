import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How Rooster&apos;s Ridge Digital handles the information you share.',
}

const sections = [
  {
    heading: 'What we collect',
    body: 'When you submit the estimate or free checkup form, we collect the details you provide — such as your name, business name, email, phone, current website, and a description of your project. We also record basic referral information (like which campaign or link brought you to the site) to understand how people find us.',
  },
  {
    heading: 'How we use it',
    body: 'We use your information solely to respond to your request, prepare an estimate or checkup, and communicate with you about your project. We do not sell your information.',
  },
  {
    heading: 'Email',
    body: 'We send a confirmation of your request and follow-up messages related to your inquiry. Transactional emails are sent through our email provider.',
  },
  {
    heading: 'Analytics',
    body: 'We use privacy-friendly, aggregate analytics to understand which pages and calls to action are useful. This helps us improve the site.',
  },
  {
    heading: 'Data retention',
    body: 'We keep inquiry records for as long as needed to serve you and for reasonable business record-keeping. You can ask us to remove your information at any time.',
  },
  {
    heading: 'Contact',
    body: `Questions about your information? Email ${siteConfig.contact.email}.`,
  },
]

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
      <div className="flex flex-col gap-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Privacy</h1>
        <p className="text-muted-foreground">
          A plain-language summary of how we handle the information you share. This is not legal advice.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{section.heading}</h2>
            <p className="leading-relaxed text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
