import type { CSSProperties } from 'react'
import { brandingStyle, type BrandingConfiguration, type EmailKind } from '@/modules/scheduling/branding'
import { sampleBrandedEmail } from '@/modules/scheduling/branding-email'
import { colorForeground } from '@/modules/scheduling/installation'
import { IntakeFields } from '@/modules/scheduling/ui/intake-fields'
import type { IntakeQuestion } from '@/modules/scheduling/intake'
export function BrandingPreview({ config, surface = 'booking', kind = 'confirmed', questions = [] }: { config: BrandingConfiguration; surface?: 'booking' | 'form' | 'confirmation' | 'email'; kind?: EmailKind; questions?: IntakeQuestion[] }) {
  const { brand: b, page: p } = config
  if (surface === 'email') return <iframe title="Sample email preview — no customer data or secret links" sandbox="" srcDoc={sampleBrandedEmail(config, kind).html} className="h-[600px] w-full border-0" />
  return <section style={brandingStyle(config) as CSSProperties} className="@container min-h-[540px] bg-background p-6 text-foreground sm:p-8" aria-label="Sample booking preview">
    {b.headerUrl && <img src={b.headerUrl} alt="" className="mb-6 h-32 w-full rounded-lg object-cover" />}
    <header className="flex flex-col gap-3" style={{ alignItems: p.logoPlacement === 'center' ? 'center' : 'flex-start' }}>{b.logoUrl && <img src={b.logoUrl} alt={`${b.displayName} logo`} className="h-12 max-w-48 object-contain" />}<p className="text-sm font-medium">{b.displayName}</p><h2 className="text-3xl font-semibold tracking-tight">{p.title}</h2><p className="text-sm leading-relaxed">{p.welcome}</p>{b.tagline && <p className="text-sm">{b.tagline}</p>}</header>
    {surface === 'booking' && <div className={p.layout === 'modern' ? 'mt-8 grid gap-4 @lg:grid-cols-2' : 'mt-8 flex flex-col gap-4'}>{['Introductory consultation', 'Follow-up appointment'].map((name, index) => <article key={name} className={p.layout === 'compact' ? 'rounded-md border p-3' : 'rounded-xl border p-6'} style={{ background: p.cardStyle === 'soft' ? b.secondaryColor : b.backgroundColor }}><p className="font-semibold">{name}</p><p className="mt-2 text-sm">{index ? 'Continue the conversation.' : 'A focused conversation about your goals.'}</p><p className="mt-4 text-xs">30 minutes · Online</p></article>)}</div>}
    {surface === 'form' && <div className="mt-8 flex flex-col gap-4"><p>{p.formIntroduction}</p><fieldset disabled><IntakeFields questions={questions} answers={{}} onChange={() => {}} /></fieldset><p className="text-xs">Your details are used to arrange your appointment. Privacy policy and booking consent remain required.</p></div>}
    {surface === 'confirmation' && <div className="mt-8 flex flex-col gap-4 rounded-xl border p-6"><h3 className="text-xl font-semibold">Your appointment is booked.</h3><p>{p.confirmation}</p><p>Tuesday, May 14 · 2:00 PM UTC</p><p className="text-sm">Sample reference: PREVIEW-ONLY</p><p className="text-xs">No appointment was created. No management tokens are generated in previews.</p></div>}
    <button type="button" disabled className="mt-6 min-h-11 rounded-md px-5 text-sm font-semibold" style={{ background: b.buttonColor, color: colorForeground(b.buttonColor) }}>{p.buttonText}</button>
    <footer className="mt-8 flex flex-col gap-2 border-t pt-4 text-xs"><p>{p.footer}</p><p>{b.contactEmail} {b.contactPhone}</p><p>Privacy · Cancellation policy · Accessible booking</p>{p.visibility !== 'white_label' && <p>{p.visibility === 'co_branded' ? `${b.displayName} · ` : ''}Powered by Roosters Ridge Digital</p>}</footer>
  </section>
}
