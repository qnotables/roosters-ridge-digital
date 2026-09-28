import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { CoverFit, CoverPosition } from '@/lib/portfolio-types'

type ProjectMediaPanelProps = {
  src: string
  alt: string
  fit?: CoverFit
  position?: CoverPosition
  priority?: boolean
  sizes?: string
  className?: string
}

const positionClasses: Record<CoverPosition, string> = {
  center: 'object-center',
  top: 'object-top',
  bottom: 'object-bottom',
  left: 'object-left',
  right: 'object-right',
}

export function ProjectMediaPanel({
  src,
  alt,
  fit = 'contain',
  position = 'center',
  priority = false,
  sizes = '(min-width: 1024px) 50vw, 100vw',
  className,
}: ProjectMediaPanelProps) {
  const foregroundFit = fit === 'contain' ? 'object-contain p-6 sm:p-8 lg:p-10' : 'object-cover'

  return (
    <div className={cn('relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-muted', className)}>
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        aria-hidden="true"
        className="scale-110 object-cover opacity-35 blur-xl"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-background/55" />
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={cn('relative z-[1] h-full w-full', foregroundFit, positionClasses[position])}
      />
    </div>
  )
}
