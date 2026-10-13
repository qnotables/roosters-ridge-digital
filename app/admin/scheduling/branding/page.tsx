import type { Metadata } from 'next'
import { BrandingPage } from '@/modules/scheduling/branding-page'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Brand studio | Scheduling', description: 'Private tenant white-label branding, drafts and publishing.', robots: { index: false, follow: false } }
export default async function Page({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) { return <BrandingPage tenant={(await searchParams).tenant} /> }
