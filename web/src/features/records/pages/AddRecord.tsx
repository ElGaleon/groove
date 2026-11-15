import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecordDialog } from '@/features/records/components/RecordDialogProvider'

/** The old "add a record" address: opens the add dialog over the collection. */
export function AddRecord() {
  const navigate = useNavigate()
  const { openAdd } = useRecordDialog()
  useEffect(() => {
    openAdd()
    navigate('/', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
