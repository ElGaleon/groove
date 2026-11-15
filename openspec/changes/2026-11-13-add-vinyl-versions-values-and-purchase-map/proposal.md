# Proposal

## Why

Oggi l'app mostra 10 "edizioni" statiche (anno, stagione, nome, tagline) definite nel codice: non esiste un vero modello di vinile né una collezione dell'utente. Lo stesso titolo esce in più pressaggi (paese, anno, etichetta, colore, ristampa) e ciascuno ha un valore di mercato diverso, quindi senza la **versione** non si può né aggiungere né cercare il disco giusto, né stimare quanto vale la collezione. Mancano inoltre prezzo di acquisto e luogo di acquisto, necessari per capire quanto si è speso, quanto si è guadagnato e dove si compra.

## What Changes

- Introdurre l'entità **vinile** con **versione** (pressaggio/release): etichetta, numero di catalogo, anno, paese, formato e descrizione (es. 180g, colorato, picture disc, ristampa).
- Aggiungere e cercare un vinile **per versione**: filtri e ricerca per etichetta, paese, anno, formato e numero di catalogo, oltre a titolo e artista.
- Registrare **prezzo di acquisto** (importo, valuta, data) e **valore attuale**, con calcolo di differenza assoluta e percentuale.
- Integrare **Discogs** (se l'utente collega l'account): ricerca della release, selezione della versione, importo dei metadati e del valore di mercato attuale, aggiornamento del valore su richiesta. Senza collegamento resta possibile inserire tutto a mano, valore incluso.
- Registrare il **luogo di acquisto**, **fisico** (negozio, mercatino, fiera, con indirizzo e coordinate), **online** (sito/venditore con URL) o entrambi, riusabile tra più acquisti.
- Aggiungere una **mappa degli acquisti** con i luoghi fisici e il numero di dischi/spesa per luogo; gli acquisti online compaiono in un elenco separato.
- Aggiornare scheda dettaglio, griglia, lista e filtri (già basati su componenti shadcn/ui) per mostrare versione, prezzi e luogo.

Nessuna modifica distruttiva: le 10 edizioni statiche restano come dati di esempio (seed) e vengono mappate sul nuovo modello.

## Capabilities

### New Capabilities

- `vinyl-collection`: modello del vinile con versione, aggiunta, modifica, ricerca e filtri per versione.
- `vinyl-valuation`: prezzo di acquisto, valore attuale (manuale o Discogs) e calcolo di guadagno/perdita, singolo e a livello di collezione.
- `discogs-integration`: collegamento/scollegamento account Discogs, ricerca release e versioni, importo dati, aggiornamento del valore di mercato.
- `purchase-locations`: luoghi di acquisto fisici e/o online, creazione, riuso e associazione agli acquisti.
- `purchase-map`: mappa geografica degli acquisti presso luoghi fisici ed elenco degli acquisti online.

### Modified Capabilities

<!-- Nessuna: non esistono ancora specifiche in openspec/specs/. -->

## Impact

- **Codice**: `src/lib/editions.ts` (dati statici → modello vinile + seed), `src/App.tsx`, `src/components/{edition-views,edition-detail,filters,site-header}.tsx`, nuove viste (form di aggiunta, mappa, impostazioni Discogs), scena 3D `shelf-scene.ts` solo per le copertine mostrate.
- **UI**: solo componenti shadcn/ui (Form/Field, Input, Select, Combobox/Command, Popover, Tabs, Table, Card, Dialog/Drawer, Badge, Sonner, Skeleton, Switch); nessun componente base creato da zero. La mappa usa una libreria esterna incapsulata in un wrapper.
- **Dipendenze nuove**: libreria mappa (Leaflet o MapLibre) e validazione form (react-hook-form + zod).
- **Sistemi esterni**: API Discogs (OAuth/token personale, rate limit), servizio di geocodifica degli indirizzi (OpenStreetMap Nominatim) e tile mappa.
- **Dati personali/privacy**: la collezione, i prezzi e i luoghi frequentati sono dati personali; token Discogs mai nel repository né nei log.
- **Fuori ambito**: login/account multiutente, sincronizzazione cloud, import massivo dell'intera collezione Discogs, marketplace/vendita, valute con conversione storica dei cambi.
