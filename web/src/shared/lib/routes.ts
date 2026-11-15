/** Every browser address of the app, in one place. Components never write path literals. */
export const routes = {
  home: '/',
  signIn: '/sign-in',
  register: '/register',
  invite: (token: string) => `/invite/${token}`,
  resetPassword: (token: string) => `/reset-password/${token}`,
  newRecord: '/records/new',
  record: (id: string) => `/records/${id}`,
  map: '/map',
  family: '/family',
  settings: '/settings',
  import: '/import',
} as const

/** Route patterns for the router table. */
export const patterns = {
  invite: '/invite/:token',
  resetPassword: '/reset-password/:token',
  record: '/records/:id',
} as const

/** Former Italian addresses, kept so shared links and bookmarks still work. */
export const legacyRedirects: { from: string; to: string }[] = [
  { from: '/accedi', to: '/sign-in' },
  { from: '/registrati', to: '/register' },
  { from: '/invito/:token', to: '/invite/:token' },
  { from: '/dischi/nuovo', to: '/records/new' },
  { from: '/dischi/:id', to: '/records/:id' },
  { from: '/mappa', to: '/map' },
  { from: '/famiglia', to: '/family' },
  { from: '/impostazioni', to: '/settings' },
  { from: '/importa', to: '/import' },
]
