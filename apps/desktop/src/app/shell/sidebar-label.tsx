import type * as React from 'react'

import { cn } from '@/lib/utils'

interface SidebarPanelLabelProps extends React.ComponentProps<'span'> {
  dotClassName?: string
}

export function SidebarPanelLabel({ children, className, dotClassName, ...props }: SidebarPanelLabelProps) {
  return (
    <span
      className={cn(
        // 0.6875rem / 0.08em, up from 0.64rem / 0.16em: at the old size the wide
        // tracking was doing the work of separating letters that were already too
        // small to read as words. Bigger type needs less of it.
        'flex min-w-0 items-center gap-2 pl-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-(--theme-primary)',
        className
      )}
      {...props}
    >
      <span aria-hidden="true" className={cn('dither inline-block size-2 shrink-0 rounded-[1px]', dotClassName)} />
      <span className="min-w-0 truncate leading-none">{children}</span>
    </span>
  )
}
