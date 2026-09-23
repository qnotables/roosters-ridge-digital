import Image from 'next/image'
import { cn } from '@/lib/utils'

type FocalPosition = 'center' | 'top' | 'bottom' | 'left' | 'right'

type PortfolioCoverImageProps = {
  src: string
  alt: string
  priority?: boolean
  sizes?: string
  className?: string
  imageClassName?: string
  focalPosition?: FocalPosition
  fillContainer?: boolean
}

const focalClasses: Record<FocalPosition, string> = {
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
  focalPosition = 'center',
  fillContainer = false,
}: PortfolioCoverImageProps) {
  return (
    <div className={cn('relative overflow-hidden bg-muted', fillContainer ? 'h-full min-h-0' : 'aspect-[16/10]', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={cn('object-cover', focalClasses[focalPosition], imageClassName)}
      />
    </div>
  )
}
