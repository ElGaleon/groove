import type { InfiniteData, QueryClient } from '@tanstack/react-query'

const KEYS = ['records', 'record', 'records-options', 'records-summary', 'places', 'locations']

/** Beyond this many loaded blocks, a refresh restarts the grid instead of reloading each block in turn. */
const MAX_REFETCH_BLOCKS = 5

/** A long infinite list is cut back to its first block, so refreshing it costs one request, not dozens. */
function trimLongGrids(queryClient: QueryClient) {
  queryClient.setQueriesData<InfiniteData<unknown, number>>({ queryKey: ['records', 'infinite'] }, (data) =>
    data && data.pages.length > MAX_REFETCH_BLOCKS
      ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) }
      : data,
  )
}

/** After any change to records or locations, everything that shows them is refreshed. */
export const invalidateCollection = (queryClient: QueryClient) => {
  trimLongGrids(queryClient)
  return queryClient.invalidateQueries({ predicate: (q) => KEYS.includes(String(q.queryKey[0])) })
}

/** Only the record lists (grid and table) are refreshed, e.g. after an undo. */
export const invalidateRecords = (queryClient: QueryClient) => {
  trimLongGrids(queryClient)
  return queryClient.invalidateQueries({ queryKey: ['records'] })
}
