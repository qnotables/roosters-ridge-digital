import type { Metadata } from 'next'
import { siteConfig, siteUrl } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `Terms for using the ${siteConfig.name} website and submitting a project inquiry.`,
  alternates: { canonical: `${siteUrl}/terms` },
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
      <div className="flex flex-col gap-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Terms of Service</h1>
        <p className="text-muted-foreground">The terms that apply when you use this website or submit an inquiry.</p>
      </div>

      <div className="mt-10 flex flex-col gap-8">
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Website use</h2>
          <p className="leading-relaxed text-muted-foreground">Use this website for lawful purposes and provide information that is accurate to the best of your knowledge. Information submitted through an inquiry form is a request to start a conversation; it is not an estimate, agreement, or commitment to provide services.</p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Communications</h2>
          <p className="leading-relaxed text-muted-foreground">We may use the contact information you provide to respond to your inquiry. SMS/MMS messages are optional and require a separate affirmative checkbox. A phone number, form submission, or general contact consent does not itself authorize SMS/MMS messages.</p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Questions</h2>
          <p className="leading-relaxed text-muted-foreground">Questions about these terms can be sent to {siteConfig.contact.email}.</p>
        </section>
      </div>
    </div>
  )
}
