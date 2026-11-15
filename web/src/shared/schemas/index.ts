/**
 * The shapes the API speaks, as zod schemas (generated from its OpenAPI document, see
 * `npm run schemas`) with the TypeScript types derived from them. Nothing here is typed by hand.
 */
import { z } from 'zod'
import * as g from './generated/zod.gen'

/**
 * A list whose rows are checked one by one: a row with a wrong shape is dropped and reported
 * (endpoint-free, no values: they can be personal data) instead of blocking the whole screen.
 */
export function listOf<T extends z.ZodType>(item: T) {
  return z.array(z.unknown()).transform((rows) =>
    rows.flatMap((row, index) => {
      const parsed = item.safeParse(row)
      if (parsed.success) return [parsed.data]
      console.error(
        `[schema] list row ${index} dropped: ${parsed.error.issues[0]?.path.join('.') ?? ''} ${parsed.error.issues[0]?.code ?? ''}`,
      )
      return []
    }),
  ) as unknown as z.ZodType<z.output<T>[]>
}

// --- what the forms send (their limits are the server's) ------------------------------------------
export const LoginInSchema = g.zLoginIn
export const RegisterInSchema = g.zRegisterIn
export const ChangePasswordInSchema = g.zChangePasswordIn
export const PasswordResetInSchema = g.zPasswordResetIn
export const RecordCreateSchema = g.zRecordCreate

// --- accounts ---------------------------------------------------------------------------------
export const UserSchema = g.zUserOut
export type User = z.infer<typeof UserSchema>
export const SetupStatusSchema = g.zSetupStatus
export const HouseholdSchema = g.zHouseholdDetail
export type Member = z.infer<typeof g.zMemberOut>
export const InviteListSchema = z.array(g.zInviteOut)
export const InviteCreatedSchema = g.zInviteCreated
export const InviteCheckSchema = g.zInviteCheck
export const PasswordResetCreatedSchema = g.zPasswordResetCreated
export const PasswordResetCheckSchema = g.zPasswordResetCheck

// --- records ----------------------------------------------------------------------------------
export const RecordSchema = g.zRecordOut
export type VinylRecord = z.infer<typeof RecordSchema>
export type Purchase = z.infer<typeof g.zPurchaseOut>
export type RecordValue = z.infer<typeof g.zValueOut>
export const RecordListSchema = z.object({
  items: listOf(g.zRecordOut),
  total: z.number().int(),
  offset: z.number().int(),
  limit: z.number().int(),
})
export type RecordList = { items: VinylRecord[]; total: number; offset: number; limit: number }
export const RecordArraySchema = listOf(g.zRecordOut)
export const RecordSummarySchema = g.zRecordSummary
export type RecordSummary = z.infer<typeof RecordSummarySchema>
export const RecordOptionsSchema = g.zRecordOptions
export type RecordOptions = z.infer<typeof RecordOptionsSchema>
export const RefreshOutSchema = g.zRefreshOut

// --- locations and places -----------------------------------------------------------------------
export const LocationSchema = g.zLocationOut
export type Location = z.infer<typeof LocationSchema>
export type LocationKind = Location['kind']
export const LocationListSchema = z.array(g.zLocationOut)
export const PlacesSchema = g.zPlacesOut
export type Places = z.infer<typeof PlacesSchema>
export type PlaceStats = z.infer<typeof g.zPlaceStats>
export type PlaceRecord = z.infer<typeof g.zPlaceRecord>

// --- Discogs and backup ---------------------------------------------------------------------------
export const DiscogsStatusSchema = g.zDiscogsStatus
export type DiscogsStatus = z.infer<typeof DiscogsStatusSchema>
export const ImportJobSchema = g.zImportJobOut
export type ImportJob = z.infer<typeof ImportJobSchema>
export const SearchPageSchema = g.zSearchOut
export type SearchPage = z.infer<typeof SearchPageSchema>
export type SearchResult = z.infer<typeof g.zSearchResult>
export const ReleaseValueSchema = g.zReleaseValue
export type ReleaseValue = z.infer<typeof ReleaseValueSchema>
export const ConnectSchema = g.zConnectOut
export const ImportResultSchema = g.zImportResult

export { z }
