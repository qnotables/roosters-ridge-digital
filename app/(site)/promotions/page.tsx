import type { Metadata } from 'next'
import { SectionHeading } from '@/components/section-heading'
import { PromotionsGallery } from '@/components/promotions-gallery'
import { CtaBand } from '@/components/cta-band'

export const metadata: Metadata = {
  title: 'Promotional Materials',
  description:
    'Browse sample promotional materials — social posts, Facebook flyers, service sheets, event graphics, and more — sized for every platform.',
}

export default function PromotionsPage() {
  return (
    <>
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeading
            eyebrow="Promotional materials"
            title="Promo-ready designs for every platform"
            description="From square Facebook flyers to service sheets and event graphics, here is a growing library of sample materials. Filter by format to see what fits your next promotion."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <PromotionsGallery />
      </section>

      <CtaBand
        title="Need a flyer or graphic this week?"
        description="Tell us what you're promoting and we'll turn around a polished, platform-ready design."
        primaryLabel="Request a design"
      />
    </>
  )
}
