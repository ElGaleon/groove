import { useQueryClient } from '@tanstack/react-query'
import { DownloadIcon, UploadIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { api, errorMessage } from '@/shared/lib/api'
import { ImportResultSchema } from '@/shared/schemas'
import { backupFile } from '../schemas'
import { t } from '@/i18n'
import { Button } from '@/shared/ui/button'
import { FieldDescription, FieldLegend, FieldSet } from '@/shared/ui/field'
import { Label } from '@/shared/ui/label'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group'

/** Download the collection as JSON, or add the records of a backup file (also the prototype's). */
export function BackupSection() {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [shared, setShared] = useState(false)
  const [busy, setBusy] = useState(false)

  async function download() {
    try {
      const res = await fetch('/api/backup', { credentials: 'same-origin' })
      if (!res.ok) throw new Error(String(res.status))
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `collezione-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t.backup.exportFailed)
    }
  }

  async function upload(file: File) {
    setBusy(true)
    try {
      let data: unknown
      try {
        data = JSON.parse(await file.text())
      } catch {
        toast.error(t.backup.notJson)
        return
      }
      const checked = backupFile.safeParse(data)
      if (!checked.success) {
        toast.error(t.backup.notJson)
        return
      }
      const r = await api(`/api/backup/import?shared=${shared}`, { method: 'POST', body: data, schema: ImportResultSchema })
      toast.success(t.backup.result(r.records_added, r.records_skipped, r.locations_added))
      await queryClient.invalidateQueries()
    } catch (e) {
      toast.error(errorMessage(e, t.errors.generic))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FieldSet>
      <FieldLegend>{t.backup.title}</FieldLegend>
      <FieldDescription>{t.backup.intro}</FieldDescription>
      <RadioGroup value={shared ? 'shared' : 'mine'} onValueChange={(v) => setShared(v === 'shared')}>
        <div className="flex items-center gap-2"><RadioGroupItem value="mine" id="bk-mine" /><Label htmlFor="bk-mine">{t.backup.ownerMine}</Label></div>
        <div className="flex items-center gap-2"><RadioGroupItem value="shared" id="bk-shared" /><Label htmlFor="bk-shared">{t.backup.ownerShared}</Label></div>
      </RadioGroup>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11 md:h-9" onClick={() => void download()}><DownloadIcon /> {t.backup.export}</Button>
        <Button variant="outline" className="h-11 md:h-9" disabled={busy} onClick={() => input.current?.click()}><UploadIcon /> {busy ? t.backup.importing : t.backup.importButton}</Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          aria-label={t.backup.importLabel}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }}
        />
      </div>
    </FieldSet>
  )
}
