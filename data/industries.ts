import type { LucideIcon } from 'lucide-react'
import {
  BriefcaseBusiness,
  Building2,
  Cable,
  CreditCard,
  Flower2,
  Flame,
  HeartHandshake,
  Home,
  ShoppingBag,
  Snowflake,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react'

export type IndustryLayout = 'solar' | 'roofing' | 'hvac' | 'electrical' | 'landscaping' | 'nonprofit' | 'ecommerce' | 'professional-services'

export type Industry = {
  slug: IndustryLayout
  name: string
  shortName: string
  icon: LucideIcon
  accent: string
  description: string
  hero: string
  heroDescription: string
  cta: string
  services: string[]
  capabilities: string[]
  proof: string[]
  demoLabel: string
  formTitle: string
  formFields: string[]
  workflow: { label: string; value: string; detail: string }[]
  faqs: { question: string; answer: string }[]
}

export const industries: Industry[] = [
  {
    slug: 'solar', name: 'Solar', shortName: 'Solar', icon: Sun, accent: 'from-amber-400/25 via-orange-500/10 to-background',
    description: 'Turn curiosity about solar into qualified consultations, savings conversations, and booked appointments.',
    hero: 'Make the next energy decision feel simple.',
    heroDescription: 'A conversion-focused solar system that helps homeowners and commercial buyers understand their options, estimate savings, and take the next step without guesswork.',
    cta: 'See If Your Home Qualifies', services: ['Residential solar', 'Commercial solar', 'Battery storage', 'EV charger integration'],
    capabilities: ['Savings estimate interface', 'Electric bill upload', 'Residential / commercial routing', 'Financing and battery education', 'Service-area lookup', 'Automated follow-up'],
    proof: ['Lead capture built around utility costs', 'Appointment booking connected to qualification', 'Referral partner intake for local growth'],
    demoLabel: 'Interactive solar demo', formTitle: 'See what your solar lead flow could look like', formFields: ['Street address', 'Monthly electric bill', 'Residential or commercial'],
    workflow: [{ label: 'New inquiry', value: '18', detail: 'This week' }, { label: 'Qualified', value: '62%', detail: 'After bill review' }, { label: 'Appointments', value: '11', detail: 'Booked automatically' }],
    faqs: [{ question: 'Can this connect to an existing CRM?', answer: 'Yes. The qualification flow can send structured lead data to the CRM, calendar, email, or reporting system you already use.' }, { question: 'Can commercial and residential leads be separated?', answer: 'Yes. The selector can route each lead into different forms, pipelines, follow-up sequences, and sales owners.' }],
  },
  {
    slug: 'roofing', name: 'Roofing', shortName: 'Roofing', icon: Home, accent: 'from-slate-400/25 via-red-500/10 to-background',
    description: 'Build trust after the storm with fast inspection requests, photo intake, financing, and claim-ready follow-up.',
    hero: 'When the roof is urgent, the next step should be obvious.',
    heroDescription: 'A storm-restoration experience designed for homeowners who need answers quickly and contractors who need a clean path from damage photo to scheduled inspection.',
    cta: 'Request Free Roof Inspection', services: ['Storm damage inspections', 'Roof replacement', 'Insurance claim assistance', 'Emergency repairs'],
    capabilities: ['Photo upload intake', 'Residential / commercial routing', 'Before-and-after proof gallery', 'Insurance claim education', 'Emergency repair CTA', 'Inspection scheduling'],
    proof: ['Mobile-first storm lead capture', 'Project photos organized before the first call', 'Financing and service-area content in context'],
    demoLabel: 'Interactive roofing demo', formTitle: 'Request a free roof inspection', formFields: ['Property address', 'Upload damage photos', 'Type of help needed'],
    workflow: [{ label: 'New storm lead', value: '24', detail: 'Last 7 days' }, { label: 'Photos received', value: '79%', detail: 'Before first call' }, { label: 'Inspections', value: '14', detail: 'On the calendar' }],
    faqs: [{ question: 'Can customers upload photos from their phone?', answer: 'Yes. The form can accept multiple photos and route the request with the property address and urgency level.' }, { question: 'Can the site explain insurance claims?', answer: 'Yes. Educational content can be placed beside the request flow without promising coverage or outcomes.' }],
  },
  {
    slug: 'hvac', name: 'HVAC', shortName: 'HVAC', icon: Snowflake, accent: 'from-sky-400/25 via-cyan-500/10 to-background',
    description: 'Give homeowners a faster path to emergency service, maintenance plans, replacements, and seasonal offers.',
    hero: 'Comfort starts with a faster service request.',
    heroDescription: 'An HVAC experience built around urgency and repeat business: route the emergency call, book the maintenance visit, and make the replacement decision easier.',
    cta: 'Schedule HVAC Service', services: ['Heating service', 'Cooling service', 'Equipment replacement', 'Maintenance plans'],
    capabilities: ['Emergency service banner', 'Service and replacement routing', 'Seasonal promotion blocks', 'Maintenance plan enrollment', 'Service-area lookup', 'Appointment booking'],
    proof: ['Urgency-aware contact paths', 'Seasonal campaigns without rebuilding the site', 'Repeat-service reminders and plan visibility'],
    demoLabel: 'Interactive HVAC demo', formTitle: 'Schedule service or request a replacement quote', formFields: ['Service address', 'Heating or cooling', 'Preferred appointment window'],
    workflow: [{ label: 'Open requests', value: '32', detail: 'Today' }, { label: 'Maintenance plans', value: '+18%', detail: 'This season' }, { label: 'Booked slots', value: '86%', detail: 'Calendar fill' }],
    faqs: [{ question: 'Can emergency and routine requests be separated?', answer: 'Yes. The first action can route emergency service to a call-first path and routine work to scheduling.' }, { question: 'Can seasonal promotions be updated?', answer: 'Yes. Promotions are structured content blocks that can be swapped without redesigning the core experience.' }],
  },
  {
    slug: 'electrical', name: 'Electrical', shortName: 'Electrical', icon: Zap, accent: 'from-yellow-300/25 via-violet-500/10 to-background',
    description: 'Turn technical services into clear next steps for panels, generators, EV chargers, and urgent repairs.',
    hero: 'Make complex electrical work easier to understand.',
    heroDescription: 'A focused electrical contractor experience that separates emergencies from planned upgrades and turns technical questions into qualified quote requests.',
    cta: 'Request Electrical Service', services: ['Electrical repairs', 'EV charger installation', 'Generator installation', 'Panel upgrades'],
    capabilities: ['Emergency electrical CTA', 'Panel upgrade assessment', 'EV charger education', 'Generator quote flow', 'Residential / commercial routing', 'Financing prompts'],
    proof: ['Service-specific qualification', 'Clear explanations for high-consideration work', 'Appointment and quote paths that share one lead record'],
    demoLabel: 'Interactive electrical demo', formTitle: 'Tell us what you need help with', formFields: ['Project address', 'Service type', 'Describe the issue'],
    workflow: [{ label: 'Service requests', value: '41', detail: 'This month' }, { label: 'Quote-ready', value: '54%', detail: 'Qualified leads' }, { label: 'EV inquiries', value: '23', detail: 'New demand' }],
    faqs: [{ question: 'Can a form handle multiple service types?', answer: 'Yes. The request path can adapt based on whether the visitor needs emergency service, an upgrade, or a new installation.' }, { question: 'Can visitors book online?', answer: 'Yes. Booking can be limited to the service types and areas your team is ready to schedule.' }],
  },
  {
    slug: 'landscaping', name: 'Landscaping', shortName: 'Landscaping', icon: Flower2, accent: 'from-emerald-300/25 via-lime-500/10 to-background',
    description: 'Show the work, capture the vision, and turn seasonal interest into qualified outdoor projects.',
    hero: 'Let the work sell the next outdoor project.',
    heroDescription: 'A visual landscaping experience that pairs project galleries and before-and-after proof with a quote request flow built for photos, service areas, and seasonal demand.',
    cta: 'Request a Landscape Quote', services: ['Landscape design', 'Lawn care', 'Outdoor living', 'Seasonal services'],
    capabilities: ['Before-and-after gallery', 'Project photo uploads', 'Maintenance plan options', 'Seasonal service campaigns', 'Design consultation booking', 'Service-area display'],
    proof: ['Visual proof before the first conversation', 'Photo-led project qualification', 'Recurring maintenance opportunities surfaced naturally'],
    demoLabel: 'Interactive landscaping demo', formTitle: 'Start your outdoor project', formFields: ['Project address', 'What are you imagining?', 'Upload project photos'],
    workflow: [{ label: 'Quote requests', value: '27', detail: 'This month' }, { label: 'Design consults', value: '9', detail: 'Booked' }, { label: 'Maintenance plans', value: '34%', detail: 'Of new clients' }],
    faqs: [{ question: 'Can visitors send photos of the space?', answer: 'Yes. Photo intake helps the team understand the property before the consultation and creates a better first conversation.' }, { question: 'Can recurring services be promoted?', answer: 'Yes. Maintenance plans and seasonal services can be displayed as clear options alongside project work.' }],
  },
  {
    slug: 'nonprofit', name: 'Nonprofit', shortName: 'Nonprofit', icon: HeartHandshake, accent: 'from-rose-300/25 via-fuchsia-500/10 to-background',
    description: 'Connect mission, programs, volunteers, donors, and community stories in one welcoming digital front door.',
    hero: 'Make it easier for people to join the mission.',
    heroDescription: 'A mission-driven platform that helps supporters donate, volunteer, register for events, find resources, and understand the impact of their involvement.',
    cta: 'See the Nonprofit Demo', services: ['Donation journeys', 'Volunteer signup', 'Program directories', 'Events and newsletters'],
    capabilities: ['Impact statistics', 'Donation and payment integration', 'Volunteer intake', 'Event registration', 'Resource directory', 'Partner and sponsor area'],
    proof: ['Mission-first storytelling', 'Supporter actions connected to follow-up', 'Program content structured for easy updates'],
    demoLabel: 'Interactive nonprofit demo', formTitle: 'Find your way to help', formFields: ['I want to', 'Name and email', 'How can we connect?'],
    workflow: [{ label: 'New supporters', value: '126', detail: 'This quarter' }, { label: 'Volunteer forms', value: '43', detail: 'Ready to match' }, { label: 'Events', value: '6', detail: 'Upcoming' }],
    faqs: [{ question: 'Can donations and volunteer signups live together?', answer: 'Yes. Different supporter actions can share one consistent experience while routing to the right follow-up.' }, { question: 'Can staff update programs?', answer: 'The platform can be structured with editable program, event, story, and resource content for future administration.' }],
  },
  {
    slug: 'ecommerce', name: 'Ecommerce', shortName: 'Ecommerce', icon: ShoppingBag, accent: 'from-purple-300/25 via-indigo-500/10 to-background',
    description: 'Create a storefront that makes products easy to discover, buy, reorder, and recommend.',
    hero: 'Turn product discovery into a better buying experience.',
    heroDescription: 'A mobile-first ecommerce storefront concept with collections, variants, cart flows, upsells, reviews, inventory visibility, and automated customer follow-up.',
    cta: 'Explore the Storefront Demo', services: ['Product storefronts', 'Collections and variants', 'Checkout flows', 'Retention automation'],
    capabilities: ['Product showcase', 'Cart and checkout preview', 'Upsell sections', 'Subscription examples', 'Inventory preview', 'Abandoned-cart workflow'],
    proof: ['Mobile-first shopping patterns', 'Product data built for growth', 'Customer communication connected to purchase behavior'],
    demoLabel: 'Interactive ecommerce demo', formTitle: 'See how a storefront can work harder', formFields: ['What do you sell?', 'Current platform', 'Growth goal'],
    workflow: [{ label: 'Products', value: '248', detail: 'In catalog' }, { label: 'Cart recovery', value: '31%', detail: 'Automation target' }, { label: 'Repeat buyers', value: '42%', detail: 'Retention view' }],
    faqs: [{ question: 'Can this connect to an existing catalog?', answer: 'Yes. The storefront can be designed around an existing ecommerce platform or a custom product system.' }, { question: 'Can subscriptions be supported?', answer: 'Subscription and recurring purchase flows can be included when they fit the product and platform.' }],
  },
  {
    slug: 'professional-services', name: 'Professional Services', shortName: 'Professional Services', icon: BriefcaseBusiness, accent: 'from-blue-300/25 via-slate-500/10 to-background',
    description: 'Turn expertise into a clear consultation path with proof, team visibility, client intake, and organized follow-up.',
    hero: 'Make expertise easier to trust and easier to hire.',
    heroDescription: 'A professional services platform for consultants, accountants, attorneys, agencies, and other experts who need a credible path from first question to qualified consultation.',
    cta: 'Book a Consultation', services: ['Consultation booking', 'Service positioning', 'Client portals', 'Lead and document intake'],
    capabilities: ['Services and team profiles', 'Case study cards', 'Consultation booking', 'Document upload', 'Client portal preview', 'CRM automation'],
    proof: ['Trust-building content hierarchy', 'Lead intake that respects expertise and time', 'Client communications organized around the relationship'],
    demoLabel: 'Interactive professional services demo', formTitle: 'Start with the right conversation', formFields: ['What do you need help with?', 'Preferred consultation type', 'Brief project context'],
    workflow: [{ label: 'Consultation requests', value: '19', detail: 'This week' }, { label: 'Qualified leads', value: '71%', detail: 'After intake' }, { label: 'Portal users', value: '84', detail: 'Active clients' }],
    faqs: [{ question: 'Can different services have different intake forms?', answer: 'Yes. The site can ask only the questions relevant to the service selected and route the request to the right person.' }, { question: 'Can clients access documents securely?', answer: 'A client portal can be designed as part of a larger authenticated platform with role-based access.' }],
  },
]

export const industryBySlug = Object.fromEntries(industries.map((industry) => [industry.slug, industry])) as Record<IndustryLayout, Industry>

export const industryIconMap: Record<string, LucideIcon> = { Sun, Home, Snowflake, Zap, Flower2, HeartHandshake, ShoppingBag, BriefcaseBusiness, Building2, Cable, CreditCard, Flame, Sparkles }

export function getIndustry(slug: string) {
  return industries.find((industry) => industry.slug === slug)
}

export function getIndustryMetadata(industry: Industry) {
  return {
    title: `${industry.name} Website & Business Systems Demo | Rooster's Ridge Digital`,
    description: `${industry.heroDescription} Explore an interactive ${industry.name.toLowerCase()} industry demo from Rooster's Ridge Digital.`,
  }
}

export function getIndustryHref(slug: IndustryLayout) {
  return `/industries/${slug}`
}

export function getIndustryIcon(name: string) {
  return industryIconMap[name] ?? Sparkles
}

export const industryDemoNotice = 'This is an interactive demonstration created by Rooster's Ridge Digital.'
export const industryIndexIcons = [Sun, Home, Snowflake, Zap, Flower2, HeartHandshake, ShoppingBag, BriefcaseBusiness]
export const industryCategoryIcons = { service: Cable, workflow: CreditCard, demo: Sparkles, urgent: Flame }
export type IndustryIconName = keyof typeof industryCategoryIcons
export type IndustryAccent = Industry['accent']
export type IndustryFeature = { title: string; detail: string; icon?: LucideIcon }
export type IndustrySection = { heading: string; description: string; features: IndustryFeature[] }
export type IndustryNavigation = { label: string; href: string }
export type IndustryContent = Industry
