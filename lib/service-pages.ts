import type { LucideIcon } from 'lucide-react'
import { Bot, Brush, Code2, Compass, Gauge, Wrench } from 'lucide-react'

export type ServicePage = {
  slug: string
  title: string
  description: string
  h1: string
  intro: string
  icon: LucideIcon
  audience: string
  problems: string[]
  included: string[]
  sections: { heading: string; body: string; items?: string[] }[]
  faqs: { question: string; answer: string }[]
  workLink: string
  workLabel: string
}

export const servicePages: ServicePage[] = [
  {
    slug: 'web-design',
    title: 'Small Business Web Design | Rooster Ridge Digital',
    description: 'Small business web design and website development that is responsive, clear, useful, and ready to grow with your organization.',
    h1: 'Web Design Built Around Your Business',
    intro: 'Rooster Ridge Digital builds modern, responsive websites designed around the actual needs of the business. Whether the goal is generating leads, presenting services, selling products, publishing content, or replacing an outdated site, the focus is on building something useful, fast, clear, and easy to maintain.',
    icon: Code2,
    audience: 'Small businesses, professionals, nonprofits, churches, and organizations that need a credible website or a better version of the one they have.',
    problems: ['An outdated site no longer reflects the quality of your work.', 'Visitors cannot quickly understand what you offer or what to do next.', 'Your website is difficult to use on a phone or difficult to update.', 'Forms, analytics, scheduling, payments, or other tools need to connect cleanly.'],
    included: ['Responsive page structure and visual design', 'Clear service, about, work, and contact content structure', 'Lead forms and practical calls to action', 'SEO-ready headings, metadata, and technical foundations', 'Performance-minded implementation and handoff guidance'],
    sections: [
      { heading: 'Website redesigns', body: 'A redesign does not need to throw away everything that is working. We can preserve useful content, clarify the navigation, improve the mobile experience, and rebuild the parts that are holding the site back.' },
      { heading: 'More than a pretty interface', body: 'The site should support a real business task. That can mean making services easier to understand, creating a focused lead funnel, publishing content, selling online, or giving an existing team a simpler way to manage information.' },
      { heading: 'Technology and integrations', body: 'The right technology depends on the project. We can work with an existing domain and connected tools, or recommend a practical approach for forms, email, scheduling, payments, APIs, and content management.' },
      { heading: 'A remote process', body: 'Rooster Ridge Digital works with businesses and organizations remotely across the United States. Projects are scoped through clear conversations, shared materials, review points, and a documented handoff.' },
    ],
    faqs: [
      { question: 'Can you redesign my existing website?', answer: 'Yes. We can assess what should stay, what needs to change, and whether a focused redesign or a fuller rebuild makes more sense.' },
      { question: 'Do you build mobile-friendly websites?', answer: 'Yes. Responsive behavior is considered from the beginning so the site remains usable across phones, tablets, and larger screens.' },
      { question: 'Can you work with my current domain?', answer: 'Yes. An existing domain can usually remain in place while the site is improved or replaced. Access and migration details are handled during project planning.' },
      { question: 'Can you maintain the site after launch?', answer: 'Ongoing support can be scoped when it is useful, including updates, troubleshooting, content changes, and future improvements.' },
    ],
    workLink: '/work',
    workLabel: 'View web development work',
  },
  {
    slug: 'automation',
    title: 'AI & Business Automation | Rooster Ridge Digital',
    description: 'Practical AI, workflow, email, webhook, and API automation for small businesses and organizations.',
    h1: "Automate the Work That Shouldn't Be Manual",
    intro: 'Rooster Ridge Digital helps identify repetitive digital tasks and build practical automations around the tools you already use. The goal is not to add complexity or replace people; it is to make routine work more consistent, visible, and manageable.',
    icon: Bot,
    audience: 'Teams spending too much time moving information between forms, email, spreadsheets, CRMs, websites, and other business tools.',
    problems: ['Leads sit in inboxes waiting for a manual response.', 'The same information is copied into multiple tools.', 'Notifications and follow-ups depend on someone remembering.', 'Important data is trapped between systems that do not communicate.'],
    included: ['Workflow mapping and automation recommendations', 'Form processing and lead routing', 'Email and notification workflows', 'API integrations, webhooks, and data movement', 'AI-assisted steps where they are reliable and appropriate'],
    sections: [
      { heading: 'What automation can look like', body: 'A useful workflow might route a new inquiry, send an internal notification, create a task, update a CRM, prepare an email draft, or move approved information between systems.', items: ['Lead routing', 'Form processing', 'Email workflows', 'Notifications', 'CRM connections', 'Content workflows'] },
      { heading: 'AI versus traditional automation', body: 'Not every process needs AI. Straightforward rules are often more predictable for notifications, data transfers, and status changes. AI can be useful when a workflow needs classification, drafting, summarization, or another judgment-assisted step.' },
      { heading: 'Scoping an automation project', body: 'We start with the current process, the systems involved, the exceptions that need human review, and the outcome that would make the work better. That keeps the build focused and makes maintenance easier.' },
      { heading: 'Remote and tool-friendly', body: 'Rooster Ridge Digital works remotely and can evaluate the tools your business already depends on before recommending replacements. Integrations are planned around real access, permissions, and ownership.' },
    ],
    faqs: [
      { question: 'What kinds of business tasks can be automated?', answer: 'Common examples include lead routing, form processing, email notifications, recurring reports, content workflows, and moving approved data between systems.' },
      { question: 'Can you connect tools I already use?', answer: 'Often, yes. The available API, webhook, export, or integration support determines the best approach.' },
      { question: 'Do I need AI for automation?', answer: 'No. Many reliable automations use clear rules. AI is considered only when it adds value to a specific step.' },
      { question: 'What is an API integration?', answer: 'It is a structured connection that lets two software systems exchange information or trigger actions without repeated manual entry.' },
    ],
    workLink: '/work',
    workLabel: 'View the automation and systems work',
  },
  {
    slug: 'digital-strategy',
    title: 'Digital Strategy Consulting | Rooster Ridge Digital',
    description: 'Digital strategy consulting for businesses that need a clearer website, technology, workflow, or platform plan.',
    h1: 'Choose the Right Technology Before You Build',
    intro: 'Some projects begin with a problem rather than a preferred platform. Digital strategy helps clarify what needs to happen, which tools fit, what should connect, and what can wait before time and budget are committed to a build.',
    icon: Compass,
    audience: 'Businesses and organizations that know something digital needs to improve but do not yet know which platform, tool, or approach makes sense.',
    problems: ['A website, platform, or tool decision feels expensive and unclear.', 'Existing systems overlap, create duplicate work, or no longer fit.', 'A new project is being planned without a shared scope or priority.', 'The team needs a practical path from current state to next step.'],
    included: ['Discovery and current-state review', 'Website and platform planning', 'Technology and software evaluation', 'Workflow and integration planning', 'A prioritized recommendation and next steps'],
    sections: [
      { heading: 'Technology evaluation', body: 'We can compare practical options based on your goals, team, budget, content needs, integrations, and future maintenance—not just the feature list on a vendor website.' },
      { heading: 'Website and platform planning', body: 'A useful plan identifies audiences, content, key actions, technical constraints, ownership, and what the first version actually needs to accomplish.' },
      { heading: 'Workflow and AI opportunities', body: 'Strategy can surface repetitive work worth automating, integrations worth prioritizing, and AI-assisted opportunities that fit the organization instead of creating another disconnected experiment.' },
      { heading: 'Existing system audits', body: 'A review of the current stack can reveal duplicated tools, broken handoffs, unclear ownership, and small improvements that should happen before a larger rebuild.' },
    ],
    faqs: [
      { question: 'What happens during a digital strategy consultation?', answer: 'We discuss the business goal, current tools, constraints, audiences, and desired next step, then identify a practical path forward.' },
      { question: 'Can you recommend which website platform I should use?', answer: 'Yes. Recommendations are based on how the site will be managed, updated, integrated, and maintained—not on a one-size-fits-all preference.' },
      { question: 'Can you review my existing technology stack?', answer: 'Yes. A focused review can map the current systems, identify friction, and prioritize changes.' },
    ],
    workLink: '/quote',
    workLabel: 'Talk through your digital project',
  },
  {
    slug: 'branding',
    title: 'Branding & Digital Creative | Rooster Ridge Digital',
    description: 'Small business branding and digital creative services for consistent websites, social graphics, campaigns, and marketing materials.',
    h1: 'A Consistent Digital Identity Across Every Platform',
    intro: 'Rooster Ridge Digital helps small businesses and organizations create a more consistent visual presence across websites, social channels, promotions, and everyday digital materials.',
    icon: Brush,
    audience: 'Organizations with an identity that feels inconsistent, outdated, difficult to use, or disconnected across the places customers encounter it.',
    problems: ['Logo, colors, and typography change from one asset to the next.', 'Marketing graphics look like one-off pieces instead of part of a system.', 'The website and social presence do not feel like the same organization.', 'A campaign needs clear, reusable visuals without a full agency engagement.'],
    included: ['Brand direction and visual consistency', 'Logo refinement where appropriate', 'Digital graphics and social media assets', 'Website visuals and campaign materials', 'Reusable files sized for the intended platforms'],
    sections: [
      { heading: 'Brand development', body: 'Brand work can begin with a focused refinement or a clearer visual direction. The goal is a system your team can recognize and use, not an elaborate rulebook that never leaves a presentation.' },
      { heading: 'Digital-first creative', body: 'Assets can be shaped for websites, social channels, email, campaigns, presentations, menus, flyers, and other real uses your organization depends on.' },
      { heading: 'Brand consistency', body: 'A consistent identity helps people recognize your organization as they move between a website, social post, email, promotion, or printed piece.' },
      { heading: 'Right-sized support', body: 'Rooster Ridge Digital provides practical branding and creative support without positioning every project as a full traditional advertising engagement.' },
    ],
    faqs: [
      { question: 'Do you create a full brand identity?', answer: 'Projects can range from logo and visual refinements to a more complete identity system, depending on what the organization actually needs.' },
      { question: 'Can you create social media graphics?', answer: 'Yes. Graphics can be designed around the platforms, formats, campaigns, and reusable patterns you use most.' },
      { question: 'Can branding support a website project?', answer: 'Yes. Brand direction and website design can be scoped together when the digital presence needs a more consistent foundation.' },
    ],
    workLink: '/work',
    workLabel: 'Explore branding and creative work',
  },
  {
    slug: 'website-troubleshooting',
    title: 'Website Troubleshooting & Optimization | Rooster Ridge Digital',
    description: 'Website troubleshooting, repairs, performance improvements, mobile fixes, integration support, and practical website optimization.',
    h1: "When Your Website Isn't Working the Way It Should",
    intro: 'A website can be online and still create problems. Rooster Ridge Digital helps investigate broken layouts, slow pages, forms, integrations, deployments, mobile issues, and other friction that keeps a site from doing its job.',
    icon: Wrench,
    audience: 'Business owners and teams with an existing website that is unreliable, confusing, slow, difficult to update, or not producing a clear next step for visitors.',
    problems: ['A layout breaks on certain screens or after a content update.', 'Forms, email notifications, analytics, or integrations stopped working.', 'Pages load slowly or feel difficult to use on mobile.', 'A deployment, domain, or content change introduced an issue.'],
    included: ['Focused issue investigation', 'Mobile and layout review', 'Form and integration troubleshooting', 'Performance and technical checks', 'A clear explanation of findings and recommended next steps'],
    sections: [
      { heading: 'Common website problems', body: 'Troubleshooting may involve responsive layout issues, broken links, form delivery, missing content, deployment errors, domain configuration, slow-loading assets, or an unclear user path.' },
      { heading: 'Existing website audits', body: 'A focused review can separate a quick fix from a deeper structural problem. If a repair is not the right long-term answer, you will get a clear explanation of what a rebuild would address.' },
      { heading: 'Performance and user experience', body: 'Optimization looks at practical experience: what loads first, what shifts, what is difficult to tap, what prevents a visitor from understanding the offer, and what creates unnecessary friction.' },
      { heading: 'Start with the free checkup', body: 'If you are not sure where the problem is, the free website checkup can identify obvious issues across mobile usability, messaging, calls to action, layout, forms, basic SEO, and technical signals.' },
    ],
    faqs: [
      { question: 'Can you fix a website you did not build?', answer: 'Often, yes. The available access, platform, code quality, and scope of the issue determine the best path.' },
      { question: 'Can you troubleshoot forms and integrations?', answer: 'Yes. We can inspect the form flow, notifications, connected services, permissions, and handoffs involved.' },
      { question: 'Should I request the free website checkup first?', answer: 'It is a good starting point when you want a practical review before deciding whether a focused fix or a larger project is needed.' },
    ],
    workLink: '/promo/free-website-checkup',
    workLabel: 'Get the free website checkup',
  },
  {
    slug: 'custom-solutions',
    title: 'Custom Digital Solutions | Rooster Ridge Digital',
    description: 'Custom digital solutions including web applications, internal tools, dashboards, publishing systems, and API-connected platforms.',
    h1: "When an Off-the-Shelf Solution Doesn't Fit",
    intro: 'Some projects do not fit neatly into a standard website, automation, or branding package. Rooster Ridge Digital builds custom digital solutions around the specific workflow, audience, content, or system the project requires.',
    icon: Gauge,
    audience: 'Organizations with a specialized process, platform idea, internal tool, or connected system that standard software does not handle well.',
    problems: ['A team is forcing an important process into a tool that was not designed for it.', 'A public website needs a specialized publishing or community experience.', 'Internal information is hard to manage, search, or share.', 'Several systems need to work together around a custom workflow.'],
    included: ['Discovery and technical direction', 'Custom web application or platform development', 'Internal dashboards and business tools', 'API-connected workflows and specialized integrations', 'A maintainable handoff with clear next steps'],
    sections: [
      { heading: 'Examples of custom work', body: 'Depending on the project, custom work may include a publishing tool, internal dashboard, community system, specialized workflow, API-connected interface, or custom web application.' },
      { heading: 'Build around the actual process', body: 'The first step is understanding the people, information, decisions, and handoffs involved. That keeps a custom build grounded in the work it needs to support.' },
      { heading: 'Start focused', body: 'A custom project does not have to begin as a giant platform. A useful first version can address the most important workflow and leave room for later improvements.' },
      { heading: 'Related capabilities', body: 'Custom solutions often combine web development, automation, digital strategy, and troubleshooting. The project scope is shaped around the system rather than a fixed package.' },
    ],
    faqs: [
      { question: 'What makes a project a custom solution?', answer: 'It usually involves a workflow, audience, data model, or integration need that standard site builders and off-the-shelf tools cannot handle cleanly.' },
      { question: 'Can you build an internal business tool?', answer: 'Yes. Internal dashboards, publishing tools, data views, and specialized workflows can be considered when the use case and access needs are clear.' },
      { question: 'How do custom projects get started?', answer: 'Start with the goal, the current process, the people involved, and the constraints. From there we can identify a useful first scope.' },
    ],
    workLink: '/work',
    workLabel: 'Explore custom platform work',
  },
]

export function getServicePage(slug: string) {
  return servicePages.find((service) => service.slug === slug)
}
