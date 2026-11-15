import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { VinylRecord } from '@/features/records/records'
import { RecordDialog } from './RecordDialog'

interface Ctx {
  openAdd: () => void
  openEdit: (record: VinylRecord, onSaved?: (record: VinylRecord) => void) => void
}
const RecordDialogContext = createContext<Ctx | null>(null)

/** One add/edit dialog for the whole app, opened from the header, the shelf, the detail page... */
export function RecordDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; record?: VinylRecord; onSaved?: (record: VinylRecord) => void }>({
    open: false,
  })
  const openAdd = useCallback(() => setState({ open: true }), [])
  const openEdit = useCallback(
    (record: VinylRecord, onSaved?: (record: VinylRecord) => void) => setState({ open: true, record, onSaved }),
    [],
  )
  const value = useMemo(() => ({ openAdd, openEdit }), [openAdd, openEdit])
  return (
    <RecordDialogContext.Provider value={value}>
      {children}
      <RecordDialog
        open={state.open}
        record={state.record}
        onSaved={state.onSaved}
        onOpenChange={(open) => setState((s) => ({ ...s, open }))}
      />
    </RecordDialogContext.Provider>
  )
}

export function useRecordDialog(): Ctx {
  const c = useContext(RecordDialogContext)
  if (!c) throw new Error('useRecordDialog must be used inside RecordDialogProvider')
  return c
}
