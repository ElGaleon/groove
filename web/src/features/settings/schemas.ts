import { z } from 'zod'

/**
 * The shape of a backup file, as far as it can be told in the browser. The server checks every
 * field in depth (its `BackupFile` model is not part of the OpenAPI document, so this one is
 * written by hand): this catches a file that is not a backup at all, before anything is sent.
 */
export const backupFile = z.object({
  version: z.number().int(),
  vinyls: z.array(z.object({ id: z.string(), title: z.string().min(1), artist: z.string().min(1) }).loose()).max(20000),
  locations: z.array(z.object({ id: z.string(), name: z.string(), kind: z.enum(['physical', 'online', 'both']) }).loose()).max(20000),
}).loose()
