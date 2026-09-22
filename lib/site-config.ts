/**
 * CENTRALIZED BUSINESS CONTENT & CONFIGURATION
 * ============================================
 * This is the single place to edit public business information, copy,
 * services, packages, budget/timeline options, and social links.
 *
 * Nothing here is secret. Do NOT put API keys or private data in this file —
 * it is imported by client components. Secrets live in environment variables
 * and are only read on the server (see lib/email.ts and app/actions/*).
 */

export type IconName =
  | 'globe'
  | 'share'
  | 'palette'
  | 'search'
  | 'flyer'
  | 'image'
  | 'mail'
  | 'card'
  | 'refresh'
  | 'layers'
  | 'tag'
  | 'map'
  | 'presentation'

export type Service = {
  slug: string
  name: string
  icon: IconName
  /** One-line outcome used on the homepage overview. */
  summary: string
  /** The client problem this solves. */
  problem: string
  /** What the client actually receives. */
  deliverables: string[]
  /** Who this is useful for. */
  suitableFor: string
  /** Example real-world uses. */
  exampleUses: string[]
}

export type Package = {
  slug: string
  name: string
  tagline: string
  description: string
  deliverables: string[]
}

export type PromoCategory = {
  id: string
  label: string
}

export type PromoItem = {
  title: string
  category: string
  description: string
  platform: string
  dimensions: string
  /** Local preview image path, or null for an intentional empty/sample state. */
  image: string | null
  /** Optional downloadable file or external link. */
  href?: string | null
}

export type WorkItem = {
  name: string
  category: string
  challenge: string
  work: string
  result: string
  image: string | null
  href?: string | null
}

export type SocialLink = {
  platform: 'facebook' | 'instagram' | 'linkedin' | 'x'
  label: string
  /** Leave empty ('') to hide the icon until a real URL is configured. */
  url: string
}

export const siteConfig = {
  name: "Rooster's Ridge Digital",
  shortName: "Rooster's Ridge",
  tagline: 'Websites • Branding • Content • Creative Services',
  domain: 'roostersridgedigital.com',
  description:
    'Rooster Ridge Digital helps businesses with web design, AI automation, digital strategy, branding, and custom technology solutions.',

  /* Public contact settings — edit freely. Leave blank to hide. */
  contact: {
    email: 'rooster@roostersridgedigital.com',
    phone: '', // e.g. '(555) 123-4567' — hidden until set
  },

  /* Social links. Empty url ('') hides the icon until configured. */
  socials: [
    { platform: 'facebook', label: 'Facebook', url: '' },
    { platform: 'instagram', label: 'Instagram', url: '' },
    { platform: 'linkedin', label: 'LinkedIn', url: '' },
    { platform: 'x', label: 'X', url: '' },
  ] as SocialLink[],

  /* Calls to action reused across the site. */
  cta: {
    primary: 'Start a Project',
    secondary: 'View My Work',
    estimate: 'Start a Project',
    checkup: 'Get My Free Website Checkup',
    start: 'Start a Project',
  },
} as const

/** Canonical production origin. Never derive public metadata from request or preview hosts. */
export const siteUrl = `https://${siteConfig.domain}`

export const services: Service[] = [
  {
    slug: 'websites',
    name: 'Websites',
    icon: 'globe',
    summary: 'Fast, mobile-ready websites that make small businesses look credible.',
    problem:
      'Your current site is outdated, hard to update, or you do not have one — and customers judge credibility in seconds.',
    deliverables: [
      'Mobile-first responsive design',
      'Clear service and contact sections',
      'Contact and inquiry forms',
      'Basic on-page SEO setup',
      'Files and access prepared for handoff',
    ],
    suitableFor: 'Local businesses, professionals, churches, and organizations needing a trustworthy web presence.',
    exampleUses: ['A new business launch site', 'A refreshed brochure site', 'A single-page service landing page'],
  },
  {
    slug: 'social-media-graphics',
    name: 'Social Media Graphics',
    icon: 'share',
    summary: 'Scroll-stopping posts and announcements sized for every platform.',
    problem: 'Inconsistent or low-effort social graphics make a business look less established than it is.',
    deliverables: [
      'Platform-sized post and story graphics',
      'Announcement and promotion templates',
      'Editable brand-consistent layouts',
      'Export files ready to publish',
    ],
    suitableFor: 'Shops, restaurants, creators, and organizations posting regularly.',
    exampleUses: ['Weekly promotions', 'Event announcements', 'Seasonal campaigns'],
  },
  {
    slug: 'logos-branding',
    name: 'Logos & Branding',
    icon: 'palette',
    summary: 'A cohesive visual identity that is instantly recognizable.',
    problem: 'A weak or inconsistent brand makes it hard for customers to remember and trust you.',
    deliverables: [
      'Primary logo and simple variations',
      'Color palette and type choices',
      'Basic usage guidance',
      'Files prepared for print and screen',
    ],
    suitableFor: 'New businesses and those overdue for a refresh.',
    exampleUses: ['A brand-new logo', 'A brand refresh', 'Consistent assets across channels'],
  },
  {
    slug: 'seo-content',
    name: 'SEO & Content',
    icon: 'search',
    summary: 'Clear, searchable content that helps the right people find you.',
    problem: 'Great businesses stay invisible when their content is thin or hard to find.',
    deliverables: [
      'Keyword-aware page copy',
      'Metadata and structured headings',
      'Google Business Profile content',
      'Practical content recommendations',
    ],
    suitableFor: 'Businesses that want to be found in local and organic search.',
    exampleUses: ['Service page copy', 'Blog or update posts', 'Profile and listing content'],
  },
  {
    slug: 'digital-flyers',
    name: 'Digital Flyers',
    icon: 'flyer',
    summary: 'Promotional flyers ready to post, print, or send.',
    problem: 'Promotions fall flat without a clear, professional-looking flyer.',
    deliverables: [
      'Print- and screen-ready flyer designs',
      'Editable layouts for future promotions',
      'Correct sizing for the intended use',
    ],
    suitableFor: 'Restaurants, shops, events, and service providers running promotions.',
    exampleUses: ['A weekend special', 'An event handout', 'A printable in-store sign'],
  },
  {
    slug: 'photo-editing',
    name: 'Photo Editing & Product Images',
    icon: 'image',
    summary: 'Clean, consistent product and location images that sell.',
    problem: 'Inconsistent or unpolished images undercut otherwise great products.',
    deliverables: [
      'Color and lighting correction',
      'Background cleanup or removal',
      'Consistent cropping and sizing',
      'Web-optimized exports',
    ],
    suitableFor: 'Retailers, restaurants, and product-based businesses.',
    exampleUses: ['Online store product shots', 'Menu photography cleanup', 'Consistent listing images'],
  },
]

export const secondaryServices: string[] = [
  'Email and newsletter design',
  'Business cards and digital menus',
  'Website copy refreshes',
  'Social content packages',
  'Product descriptions',
  'Google Business Profile content',
  'Presentations and media kits',
]

export const packages: Package[] = [
  {
    slug: 'quick-start',
    name: 'Quick Start',
    tagline: 'For one focused promotional need.',
    description: 'A single, well-executed deliverable to get something out the door quickly.',
    deliverables: ['One promotional flyer or graphic', 'One round of revisions', 'Files prepared for the intended use'],
  },
  {
    slug: 'business-builder',
    name: 'Business Builder',
    tagline: 'For businesses needing several coordinated digital assets.',
    description: 'A coordinated set of materials that share one consistent look.',
    deliverables: [
      'Multiple coordinated graphics',
      'Basic brand consistency across assets',
      'A simple website or landing page',
      'Files prepared for print and screen',
    ],
  },
  {
    slug: 'ongoing-growth',
    name: 'Ongoing Growth',
    tagline: 'For recurring content and creative support.',
    description: 'Regular creative support for businesses publishing on an ongoing basis.',
    deliverables: [
      'Recurring social and promotional graphics',
      'Content and posting recommendations',
      'Priority creative support',
      'Reusable editable templates',
    ],
  },
]

export const budgetOptions: string[] = [
  'Not sure yet',
  'Under $500',
  '$500 – $1,500',
  '$1,500 – $5,000',
  '$5,000+',
]

export const timelineOptions: string[] = [
  'As soon as possible',
  'Within a few weeks',
  'Within a couple of months',
  'Flexible / no set date',
]

export const contactMethods: string[] = ['Email', 'Phone', 'Either']

export const concernOptions: string[] = [
  'Website',
  'Branding & logo',
  'Search visibility (SEO)',
  'Social media presence',
  'Promotional materials',
  'Not sure — need guidance',
]

export const promoCategories: PromoCategory[] = [
  { id: 'all', label: 'All materials' },
  { id: 'social-post', label: 'Social post' },
  { id: 'facebook-flyer', label: 'Square Facebook flyer' },
  { id: 'website-banner', label: 'Website banner' },
  { id: 'service-sheet', label: 'Service sheet' },
  { id: 'event-flyer', label: 'Event flyer' },
  { id: 'product-promotion', label: 'Product promotion' },
  { id: 'digital-menu', label: 'Digital menu' },
  { id: 'email-header', label: 'Email header' },
]

/**
 * Promotional-material samples. These are clearly-marked design samples, not
 * real client work. Add real entries here as they become available.
 */
export const promoItems: PromoItem[] = [
  {
    title: 'Weekend Special — Coffee Shop',
    category: 'facebook-flyer',
    description: 'A square promotional flyer sample sized for a Facebook post.',
    platform: 'Facebook / Instagram',
    dimensions: '1080 × 1080',
    image: '/images/sample-facebook-flyer.png',
  },
  {
    title: 'Landscaping Service Sheet',
    category: 'service-sheet',
    description: 'A one-page service sheet sample outlining offerings and contact details.',
    platform: 'Print / PDF',
    dimensions: '8.5 × 11 in',
    image: '/images/sample-service-sheet.png',
  },
  {
    title: 'Community Farmers Market',
    category: 'event-flyer',
    description: 'An event announcement graphic sample with date and location blocks.',
    platform: 'Social / Print',
    dimensions: '1080 × 1350',
    image: '/images/sample-event-graphic.png',
  },
]

/**
 * Portfolio / case-study items. Intentionally empty — real, verifiable work
 * will be added here. The /work page shows an honest introductory state while
 * this is empty. Do NOT add fabricated projects or results.
 */
export const workItems: WorkItem[] = []

export const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/work', label: 'Work' },
  { href: '/about', label: 'About' },
  { href: '/quote', label: 'Start a Project' },
]

export const leadStatuses = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Closed'] as const

export const digitalCheckup: { title: string; points: { heading: string; detail: string }[] } = {
  title: '10-Point Digital Presence Checklist',
  points: [
    { heading: 'Mobile-first', detail: 'Your site loads fast and reads well on a phone.' },
    { heading: 'Clear offer', detail: 'A first-time visitor understands what you do within seconds.' },
    { heading: 'Easy contact', detail: 'Phone, email, or a form is visible without scrolling far.' },
    { heading: 'Consistent branding', detail: 'Logo, colors, and fonts match across every channel.' },
    { heading: 'Findable in search', detail: 'Your business name and services appear in local search.' },
    { heading: 'Google Business Profile', detail: 'Your profile is claimed, complete, and current.' },
    { heading: 'Active social presence', detail: 'Your top channel has recent, on-brand posts.' },
    { heading: 'Quality images', detail: 'Photos are clear, well-lit, and consistently sized.' },
    { heading: 'Trust signals', detail: 'Real hours, location, and a way to verify you are legitimate.' },
    { heading: 'A clear next step', detail: 'Every page invites the visitor to take one obvious action.' },
  ],
}
