import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function Field({
  id,
  label,
  error,
  required,
  hint,
  children,
  className,
}: {
  id: string
  label: string
  error?: string
  required?: boolean
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)} data-invalid={error ? '' : undefined}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
        {!required && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
