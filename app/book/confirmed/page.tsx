import type { Metadata } from 'next'
import { CustomerManagement } from '@/modules/scheduling/ui/customer-management'
export const metadata: Metadata = { title:'Your appointment | Roosters Ridge Digital',description:'Securely view and manage your appointment.',robots:{ index:false,follow:false },referrer:'no-referrer' }
export default function ConfirmationPage() { return <main><CustomerManagement /></main> }
