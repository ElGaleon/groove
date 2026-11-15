import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/shared/ui/drawer'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'

/** Dialog su desktop, Drawer dal basso su mobile. Il corpo scorre, header e footer restano visibili. */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const mobile = useIsMobile()
  const body = <div className="min-h-0 flex-1 select-text overflow-y-auto px-4 pb-2 sm:px-0">{children}</div>
  const foot = footer && (
    <div className="grid grid-cols-2 gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:flex sm:justify-end sm:px-0 sm:pb-0">
      {footer}
    </div>
  )
  return mobile ? (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="text-left!">
          <DrawerTitle className="text-left">{title}</DrawerTitle>
          {description && <DrawerDescription className="text-left">{description}</DrawerDescription>}
        </DrawerHeader>
        {body}
        {foot}
      </DrawerContent>
    </Drawer>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('flex max-h-[90dvh] flex-col', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {body}
        {foot}
      </DialogContent>
    </Dialog>
  )
}
