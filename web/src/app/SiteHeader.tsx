import { CheckIcon, ChevronDownIcon, LogOutIcon, MenuIcon, RefreshCwIcon, SettingsIcon, UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth, useLanguageSetting } from '@/features/auth'
import { useDiscogsStatus } from '@/features/discogs'
import { LANGUAGES, t } from '@/i18n'
import { BrandMark } from '@/shared/components/BrandMark'
import { languageName } from '@/shared/components/LanguageSelect'
import { RefreshDialog } from '@/features/records'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { NavigationMenu, NavigationMenuItem, NavigationMenuList, navigationMenuTriggerStyle } from '@/shared/ui/navigation-menu'
import { Separator } from '@/shared/ui/separator'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/ui/sheet'
import { cn } from '@/shared/lib/utils'
import { routes } from '@/shared/lib/routes'

const SECTIONS = [
  { to: '/', label: t.nav.home, end: true },
  { to: routes.map, label: t.nav.map, end: false },
] as const

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?'

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
      <BrandMark />
      {t.appName}
    </Link>
  )
}

function AccountMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [language, setLanguage] = useLanguageSetting()
  const discogs = useDiscogsStatus()
  const [refreshing, setRefreshing] = useState(false)
  const canRefresh = discogs.data?.connected && discogs.data.status === 'active'
  if (!user) return null
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="h-11 gap-2 rounded-full px-1.5 sm:h-10" aria-label={t.nav.account} />}>
          <Avatar className="size-8"><AvatarFallback>{initials(user.display_name)}</AvatarFallback></Avatar>
          <ChevronDownIcon className="mr-1 hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user.display_name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className="min-h-11 sm:min-h-0" onClick={() => navigate(routes.settings)}><SettingsIcon /> {t.nav.settings}</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {canRefresh && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuItem className="min-h-11 sm:min-h-0" onClick={() => setRefreshing(true)}><RefreshCwIcon /> {t.nav.refresh}</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuGroup>
            <DropdownMenuItem className="min-h-11 sm:min-h-0" onClick={() => navigate(routes.family)}><UsersIcon /> {t.nav.family}</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t.nav.language}</DropdownMenuLabel>
            {LANGUAGES.map((l) => (
              <DropdownMenuItem key={l} className="min-h-11 sm:min-h-0" aria-current={l === language ? 'true' : undefined} onClick={() => void setLanguage(l)}>
                <CheckIcon className={l === language ? '' : 'invisible'} /> {languageName(l)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="min-h-11 sm:min-h-0" onClick={async () => { await signOut(); navigate(routes.signIn) }}>
            <LogOutIcon /> {t.nav.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RefreshDialog open={refreshing} onOpenChange={setRefreshing} />
    </>
  )
}

export function SiteHeader() {
  const { user } = useAuth()
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-5">
        <div className="flex items-center">
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="size-11 md:hidden" aria-label={t.nav.menu} />}>
              <MenuIcon className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-sm">
              <SheetHeader className="text-left">
                <SheetTitle>{t.appName}</SheetTitle>
                <SheetDescription>{t.nav.tagline}</SheetDescription>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label={t.nav.sections}>
                {SECTIONS.map((s) => (
                  <SheetClose key={s.to} render={<NavLink to={s.to} end={s.end} className={({ isActive }) => cn('flex h-12 items-center rounded-md px-3 text-base', isActive ? 'bg-secondary font-medium' : 'hover:bg-accent')} />}>
                    {s.label}
                  </SheetClose>
                ))}
              </nav>
              <Separator className="my-2" />
              {user && <div className="px-4 pb-4 text-sm text-muted-foreground">{user.display_name} · {user.email}</div>}
            </SheetContent>
          </Sheet>
          <div className="hidden md:block"><Brand /></div>
        </div>

        <div className="md:hidden"><Brand /></div>
        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            {SECTIONS.map((s) => (
              <NavigationMenuItem key={s.to}>
                <NavLink to={s.to} end={s.end} className={({ isActive }) => cn(navigationMenuTriggerStyle(), isActive && 'bg-accent')}>{s.label}</NavLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex justify-end"><AccountMenu /></div>
      </div>
    </header>
  )
}
