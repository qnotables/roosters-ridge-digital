import Image from 'next/image'
import { cn } from '@/lib/utils'

import type { CoverFit, CoverPosition } from '@/lib/portfolio-types'

type PortfolioCoverImageProps = {
  src: string
  alt: string
  priority?: boolean
  sizes?: string
  className?: string
  imageClassName?: string
  fit?: CoverFit
  position?: CoverPosition
}

const focalClasses: Record<CoverPosition, string> = {
  center: 'object-center',
  top: 'object-top',
  bottom: 'object-bottom',
  left: 'object-left',
  right: 'object-right',
}

export function PortfolioCoverImage({
  src,
  alt,
  priority = false,
  sizes = '100vw',
  className,
  imageClassName,
  fit = 'cover',
  position = 'center',
}: PortfolioCoverImageProps) {
  return (
    <div className={cn('relative aspect-[16/9] w-full overflow-hidden border border-border/70 bg-muted', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={cn(fit === 'contain' ? 'object-contain' : 'object-cover', focalClasses[position], imageClassName)}
      />
    </div>
  )
}
