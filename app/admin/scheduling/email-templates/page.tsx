import type { Metadata } from 'next'
import { BrandingPage } from '@/modules/scheduling/branding-page'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Email templates | Scheduling', description: 'Private tenant scheduling email branding and safe template previews.', robots: { index: false, follow: false } }
export default async function Page({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) { return <BrandingPage tenant={(await searchParams).tenant} email /> }
