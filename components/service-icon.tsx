import {
  Globe,
  Share2,
  Palette,
  Search,
  FileImage,
  ImageIcon,
  Mail,
  CreditCard,
  RefreshCw,
  Layers,
  Tag,
  MapPin,
  Presentation,
  type LucideIcon,
} from 'lucide-react'
import type { IconName } from '@/lib/site-config'

const map: Record<IconName, LucideIcon> = {
  globe: Globe,
  share: Share2,
  palette: Palette,
  search: Search,
  flyer: FileImage,
  image: ImageIcon,
  mail: Mail,
  card: CreditCard,
  refresh: RefreshCw,
  layers: Layers,
  tag: Tag,
  map: MapPin,
  presentation: Presentation,
}

export function ServiceIcon({ name, className }: { name: IconName; className?: string }) {
  const Icon = map[name] ?? Globe
  return <Icon className={className} aria-hidden="true" />
}
