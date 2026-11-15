# Design

## Context

L'app (`prototypes/editions-app`, Vite + React + Tailwind + shadcn/ui basato su Base UI) ha oggi un array statico `EDITIONS` in `src/lib/editions.ts` (anno, stagione, nome, tagline) e le copertine sono disegnate a codice in `src/lib/covers.ts`. Non esistono backend, persistenza, form né una nozione di collezione dell'utente. Le viste (scaffale 3D solo desktop, griglia, lista) e il dettaglio (Dialog su desktop, Drawer su mobile) leggono direttamente quell'array. Vincoli: solo componenti shadcn/ui per l'interfaccia, mobile-first, testi in italiano. Motivazione in `proposal.md`; requisiti in `specs/`.

## Goals / Non-Goals

**Goals:**
- Un modello dati unico (vinile + versione + acquisto + luogo) da cui derivano viste, filtri, totali e mappa.
- Funzionamento completo **offline e senza Discogs**; Discogs come arricchimento opzionale.
- Importi e valute trattati senza errori di arrotondamento.
- Confine netto verso i servizi esterni (Discogs, geocodifica, tile) così da poterli sostituire o portare dietro un backend.

**Non-Goals:**
- Backend, account multiutente, sincronizzazione tra dispositivi.
- Conversione di valuta con cambi storici; confronto tra valute diverse.
- Importo massivo della collezione Discogs; marketplace.
- Sostituire la scena 3D: continua a mostrare le copertine, non è fonte dei dati.

## Decisions

### 1. Persistenza locale dietro un'interfaccia repository
I dati stanno in IndexedDB (libreria Dexie) con tabelle `vinyls`, `locations`, `settings`; l'accesso passa da un modulo `repository` con metodi asincroni. 
*Perché*: nessun backend richiesto, dati strutturati e ricercabili, migrazione futura a un'API cambiando solo il repository. 
*Alternative*: `localStorage` (limiti di dimensione, nessun indice, sincrono); backend subito (fuori scopo, aggiunge auth e hosting).

### 2. Modello dati: versione e acquisto dentro il vinile, luogo come entità
`Vinyl { id, title, artist, version{label,catalogNo,year,country,format,notes}, discogs{releaseId?}, purchase{amountMinor,currency,date,locationId,channel:'physical'|'online'}, value{amountMinor,currency,source:'discogs'|'manual',measure,fetchedAt,numForSale?}, coverRef }`; `Location { id, name, kind:'physical'|'online'|'both', address?, lat?, lng?, url? }`. 
*Perché*: un acquisto appartiene a un solo vinile (1:1), il luogo è condiviso (1:N) e consente totali e mappa per luogo; `channel` nell'acquisto risolve il caso "luogo entrambi" (specifica `purchase-locations`). 
*Alternative*: tabella `purchases` separata (utile solo se un vinile potesse avere più acquisti: non richiesto); luogo copiato nell'acquisto (duplicati e totali incoerenti).

### 3. Importi in unità minori intere con valuta esplicita
Gli importi sono salvati come interi (centesimi) + codice ISO 4217; formattazione con `Intl.NumberFormat`; differenze e totali calcolati solo tra importi della stessa valuta. 
*Perché*: niente errori floating point e comportamento "n/d" coerente con la specifica `vinyl-valuation`. 
*Alternative*: float (errori di arrotondamento); conversione automatica (cambi storici fuori ambito).

### 4. Discogs: token personale, client isolato, valore = prezzo più basso in vendita
Il collegamento usa un **token personale** inserito dall'utente nelle impostazioni (header `Authorization: Discogs token=…`), memorizzato in locale e mai nel repository né nei log; il client sta in un modulo unico (`discogs-client`) con ricerca (`/database/search`), dettaglio release e statistiche di mercato (`/marketplace/stats/{release_id}`, `lowest_price` e `num_for_sale`). Il valore importato SHALL dichiarare la misura usata. Richieste serializzate con coda e ritardo per rispettare il limite; su 429 si sospende e si informa l'utente. 
*Perché*: l'OAuth 1.0a di Discogs richiede un consumer secret che non può stare in un'app solo browser; il token personale evita backend e segreti nel codice. Il prezzo più basso in vendita è disponibile senza essere venditori, a differenza di `price_suggestions`. 
*Alternative*: OAuth con proxy (più sicuro ma richiede backend: previsto come evoluzione dietro lo stesso client); mediana delle vendite (non esposta dall'API pubblica).

### 5. Mappa con Leaflet e geocodifica Nominatim
Mappa con Leaflet/react-leaflet (tile OpenStreetMap con attribuzione), incapsulata in un componente `PurchaseMap`; geocodifica con Nominatim, una richiesta per volta con debounce, solo sull'indirizzo del luogo. Pannelli, elenco, filtri e dettaglio usano shadcn (Card, Tabs, Table, Sheet/Drawer, Select). 
*Perché*: libreria leggera, nessuna chiave API, nessun costo; shadcn non offre una mappa, quindi si usa una libreria esterna senza reinventare l'interfaccia circostante. 
*Alternative*: MapLibre/Mapbox (più pesanti, tile con chiave o hosting); Google Maps (chiave, costi, privacy).

### 6. Form con shadcn Form/Field, react-hook-form e zod
Validazione con schema zod condiviso tra modulo e repository; selezione luogo con Combobox (Command + Popover), selezione versione/ricerca Discogs in Dialog/Drawer a passi. 
*Perché*: errori accanto ai campi, riuso di componenti shadcn, un solo schema come fonte delle regole. 
*Alternative*: validazione manuale (duplica regole, più errori).

### 7. Migrazione dei dati di esempio
Le 10 `EDITIONS` diventano seed caricato al primo avvio solo se la collezione è vuota, con versione "da completare". 
*Perché*: nessuna rottura delle viste esistenti e dati dimostrativi per mappa e totali.

## Risks / Trade-offs

- [Token Discogs in locale esposto a script/estensioni] → conservarlo solo nelle impostazioni locali, mostrarlo mascherato, offrire "Scollega" che lo cancella; evoluzione con proxy documentata.
- [CORS o requisiti di User-Agent dell'API Discogs dal browser] → verificare presto con una richiesta reale (task dedicato); se bloccati, introdurre un proxy minimo senza cambiare il client.
- [Valore Discogs = prezzo più basso, non valore reale di vendita] → mostrare sempre misura e numero di copie in vendita; permettere valore manuale.
- [Limiti e policy di Nominatim e dei tile OSM] → richieste a basso volume con debounce, attribuzione visibile, cache dei risultati di geocodifica nei luoghi salvati.
- [Perdita dati se il browser cancella IndexedDB] → funzione di esportazione/importazione JSON della collezione (task incluso).
- [Mappa e scena 3D pesanti su mobile] → caricare la mappa in lazy load solo nella sua schermata.
- [Privacy: luoghi frequentati e spese] → dati solo locali, nessun invio oltre a indirizzo (geocodifica) e tile; conferma nelle specifiche.

## Esito verifica Discogs/CORS (task 6.1)

Verificato con richieste reali (senza token valido, che non è disponibile in questo ambiente):
- Il preflight `OPTIONS` ammette l'header `Authorization` e `User-Agent`, con `Access-Control-Allow-Origin: *`: **nessun proxy necessario**.
- `GET /marketplace/stats/{id}` risponde 200 con CORS aperto anche senza token (limite più basso: 25 richieste/min senza token, 60 con token).
- Con un token **non valido** Discogs risponde 401 **senza** header CORS: il browser lo vede come errore di rete. L'interfaccia lo traduce in "Non riesco a verificare il token".
- Nominatim risponde con `Access-Control-Allow-Origin: *`.
Non verificato: il comportamento con un token personale valido (ricerca, identità, statistiche autenticate) va provato dall'utente.

## Migration Plan

1. Introdurre repository e seed senza cambiare l'interfaccia (le viste leggono dal repository).
2. Aggiungere versione e filtri, poi prezzi e valore, poi luoghi e mappa, infine Discogs.
3. Rollback: ogni passo è additivo; rimuovere le tabelle nuove di IndexedDB e tornare ai dati statici non richiede migrazioni distruttive. Versionare lo schema Dexie per aggiornamenti futuri.

## Open Questions

- Valuta predefinita (EUR proposta) e se renderla modificabile nelle impostazioni.
- Tile della mappa: OpenStreetMap standard o provider alternativo, se il traffico crescesse.
