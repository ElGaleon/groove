import { useState } from 'react'
import { CheckIcon, ChevronsUpDownIcon, GlobeIcon, MapPinIcon, PlusIcon } from 'lucide-react'
import { KIND_LABEL, type Location } from '@/features/places/locations'
import { t } from '@/i18n'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/shared/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

/** Combobox (Popover + Command): reuse an existing place or create a new one. */
export function LocationPicker({
  locations,
  value,
  onChange,
  onCreate,
  id,
}: {
  locations: Location[]
  value?: string
  onChange: (id: string | undefined) => void
  onCreate: () => void
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const current = locations.find((l) => l.id === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-11 w-full justify-between font-normal md:h-9"
          />
        }
      >
        <span className="truncate">
          {current ? current.name : <span className="text-muted-foreground">{t.money.placePick}</span>}
        </span>
        <ChevronsUpDownIcon className="size-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder={t.money.placeSearch} />
          <CommandList>
            <CommandEmpty>{t.money.placeNone}</CommandEmpty>
            <CommandGroup>
              {locations.map((l) => (
                <CommandItem
                  key={l.id}
                  value={l.name}
                  className="min-h-11 md:min-h-0"
                  onSelect={() => {
                    onChange(l.id === value ? undefined : l.id)
                    setOpen(false)
                  }}
                >
                  {l.kind === 'online' ? <GlobeIcon /> : <MapPinIcon />}
                  <span className="flex-1 truncate">{l.name}</span>
                  <Badge variant="secondary">{KIND_LABEL[l.kind]}</Badge>
                  {l.id === value && <CheckIcon />}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__new"
                className="min-h-11 md:min-h-0"
                onSelect={() => {
                  setOpen(false)
                  onCreate()
                }}
              >
                <PlusIcon /> {t.money.placeNew}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
