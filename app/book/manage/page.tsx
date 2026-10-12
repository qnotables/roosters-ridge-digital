import type { Metadata } from 'next'
import { CustomerLinkExchange } from '@/modules/scheduling/ui/customer-link-exchange'
export const metadata: Metadata = { title:'Manage your appointment | Roosters Ridge Digital',description:'Open your protected appointment link.',robots:{ index:false,follow:false },referrer:'no-referrer' }
export default function ManagePage() { return <main><CustomerLinkExchange /></main> }
