import { z } from 'zod'
import { RecordCreateSchema } from '@/shared/schemas'

/** The part of the record form checked by its schema (the server's limits); amounts follow the currency and are read separately. */
export const recordForm = z.object({
  title: z.string().trim().pipe(RecordCreateSchema.shape.title),
  artist: z.string().trim().pipe(RecordCreateSchema.shape.artist),
  year: RecordCreateSchema.shape.year,
})
