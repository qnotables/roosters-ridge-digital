import { Hero } from '@/components/home/hero'
import { ServicesOverview } from '@/components/home/services-overview'
import { ValueProps } from '@/components/home/value-props'
import { SelectedWork } from '@/components/home/selected-work'
import { Process } from '@/components/home/process'
import { CheckupTeaser } from '@/components/home/checkup-teaser'
import { CtaBand } from '@/components/cta-band'

export default function HomePage() {
  return (
    <>
      <Hero />
      <ServicesOverview />
      <SelectedWork />
      <ValueProps />
      <Process />
      <CheckupTeaser />
      <CtaBand />
    </>
  )
}
