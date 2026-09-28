import { AirVent, Calculator, CircuitBoard, Flower2, HeartHandshake, House, ShoppingBag, UserRound, type LucideIcon } from 'lucide-react'

export type IndustryIconName = 'calculator' | 'house' | 'air-vent' | 'circuit-board' | 'flower-2' | 'heart-handshake' | 'shopping-bag' | 'user-round'
export const industryIconMap: Record<IndustryIconName, LucideIcon> = { calculator: Calculator, house: House, 'air-vent': AirVent, 'circuit-board': CircuitBoard, 'flower-2': Flower2, 'heart-handshake': HeartHandshake, 'shopping-bag': ShoppingBag, 'user-round': UserRound }

export type IndustryVariant = 'solar' | 'roofing' | 'hvac' | 'electrical' | 'landscaping' | 'nonprofit' | 'ecommerce' | 'professional-services'

export type Industry = {
  slug: IndustryVariant
  name: string
  iconName: IndustryIconName
  description: string
  hero: string
  subhead: string
  cta: string
  services: string[]
  features: string[]
  proof: string[]
  variant: IndustryVariant
  formLabel: string
  workflow: string[]
}

export const industries: Industry[] = [
  { slug: 'solar', name: 'Solar & Energy', iconName: 'calculator', description: 'Qualification, savings estimates, financing, and follow-up built into one clean journey.', hero: 'Turn curiosity into qualified solar conversations.', subhead: 'A conversion-focused solar experience that helps homeowners understand savings, storage, and the next step before a sales call.', cta: 'See If You Qualify', services: ['Residential solar', 'Battery storage', 'EV charging', 'Commercial energy'], features: ['Savings estimate', 'Bill upload', 'Financing paths', 'Lead dashboard'], proof: ['Qualification form', 'Automated follow-up', 'Service area lookup'], variant: 'solar', formLabel: 'See what your home could save', workflow: ['New inquiry captured', 'Bill and address reviewed', 'Appointment invitation sent'] },
  { slug: 'roofing', name: 'Roofing & Restoration', iconName: 'house', description: 'Storm-ready lead capture, inspection scheduling, photo intake, and claim support.', hero: 'Own the moment after the storm.', subhead: 'A roofing demo designed around urgency, trust, and the details crews need before the first inspection.', cta: 'Request a Free Inspection', services: ['Roof replacement', 'Storm restoration', 'Emergency repair', 'Insurance support'], features: ['Photo upload', 'Inspection scheduler', 'Before & after gallery', 'Financing options'], proof: ['Residential / commercial switch', 'Service area finder', 'Claim intake workflow'], variant: 'roofing', formLabel: 'Start your roof inspection request', workflow: ['Damage request received', 'Photos routed to the team', 'Inspection time confirmed'] },
  { slug: 'hvac', name: 'HVAC', iconName: 'air-vent', description: 'Fast service booking, maintenance plans, replacement quotes, and seasonal campaigns.', hero: 'Make comfort easier to schedule.', subhead: 'A practical HVAC experience that routes emergencies quickly and turns seasonal demand into recurring service.', cta: 'Schedule HVAC Service', services: ['Heating repair', 'AC installation', 'Maintenance plans', 'Indoor air quality'], features: ['Emergency banner', 'Service selector', 'Maintenance plan cards', 'Seasonal offer'], proof: ['Appointment booking', 'Replacement quote', 'Residential / commercial switch'], variant: 'hvac', formLabel: 'Find the right HVAC next step', workflow: ['Service need selected', 'Availability matched', 'Confirmation and reminders sent'] },
  { slug: 'electrical', name: 'Electrical', iconName: 'circuit-board', description: 'Quote requests for panels, generators, EV chargers, and everyday electrical work.', hero: 'Make complex electrical work feel clear.', subhead: 'A confident electrical contractor demo that turns technical services into understandable choices and booked estimates.', cta: 'Request an Electrical Quote', services: ['Panel upgrades', 'Generators', 'EV chargers', 'Electrical repairs'], features: ['Project assessment', 'Emergency CTA', 'Financing section', 'Service area lookup'], proof: ['Residential / commercial switch', 'Quote workflow', 'Review capture'], variant: 'electrical', formLabel: 'Tell us what you need powered', workflow: ['Project details submitted', 'Scope reviewed by the team', 'Quote appointment offered'] },
  { slug: 'landscaping', name: 'Landscaping', iconName: 'flower-2', description: 'Visual project intake for lawn care, outdoor design, seasonal work, and maintenance.', hero: 'Show the transformation before the estimate.', subhead: 'A visual landscaping experience that makes it easy to share a project idea, browse services, and book a design conversation.', cta: 'Plan Your Outdoor Space', services: ['Landscape design', 'Lawn care', 'Hardscaping', 'Seasonal cleanup'], features: ['Project photo upload', 'Before & after gallery', 'Maintenance plans', 'Design consultation'], proof: ['Visual portfolio', 'Seasonal services', 'Quote request'], variant: 'landscaping', formLabel: 'Start a project conversation', workflow: ['Project photos received', 'Scope and style reviewed', 'Design consultation booked'] },
  { slug: 'nonprofit', name: 'Nonprofit', iconName: 'heart-handshake', description: 'Mission storytelling, donations, volunteers, events, and community resources in one place.', hero: 'Give your mission more ways to move people.', subhead: 'A mission-first platform that makes impact visible and gives supporters a clear way to donate, volunteer, or show up.', cta: 'Explore the Mission Flow', services: ['Programs', 'Events', 'Volunteer intake', 'Donations'], features: ['Impact statistics', 'Story cards', 'Event registration', 'Resource directory'], proof: ['Donor journey', 'Partner area', 'Newsletter capture'], variant: 'nonprofit', formLabel: 'Connect with the organization', workflow: ['Supporter chooses a path', 'Interest is routed', 'Follow-up keeps the relationship moving'] },
  { slug: 'ecommerce', name: 'Ecommerce', iconName: 'shopping-bag', description: 'A focused storefront system for products, subscriptions, checkout, retention, and inventory.', hero: 'Make the path from browse to buy feel inevitable.', subhead: 'A storefront demo that treats merchandising, checkout, retention, and operations as one connected experience.', cta: 'Shop the Demo Store', services: ['Product catalog', 'Subscriptions', 'Upsells', 'Inventory'], features: ['Variant selector', 'Cart preview', 'Review rail', 'Abandoned cart flow'], proof: ['Mobile-first storefront', 'Checkout preview', 'Inventory view'], variant: 'ecommerce', formLabel: 'Join the product list', workflow: ['Product viewed', 'Cart intent recognized', 'Helpful follow-up delivered'] },
  { slug: 'professional-services', name: 'Professional Services', iconName: 'user-round', description: 'Consultation booking, case studies, team expertise, client portals, and document workflows.', hero: 'Turn expertise into a clearer client journey.', subhead: 'A composed professional services experience that builds trust early and makes it simple to book the right conversation.', cta: 'Book a Consultation', services: ['Consulting', 'Advisory', 'Legal', 'Accounting'], features: ['Consultation booking', 'Team profiles', 'Client portal preview', 'Document intake'], proof: ['Case study cards', 'FAQ', 'CRM workflow'], variant: 'professional-services', formLabel: 'Find the right conversation', workflow: ['Inquiry categorized', 'Consultation matched', 'Documents and reminders organized'] },
]

export function getIndustry(slug: string) {
  return industries.find((industry) => industry.slug === slug)
}

export const industrySlugs = industries.map(({ slug }) => ({ slug }))

export const serviceCategories = ['Website Design & Development', 'Lead Generation Systems', 'CRM & Lead Management', 'Business Automation', 'Appointment & Scheduling Systems', 'Ecommerce', 'Payment Integration', 'Custom Dashboards', 'Client Portals', 'SEO & Local Search', 'Email Automation', 'API Integrations', 'AI-Assisted Business Tools', 'Analytics & Reporting']
