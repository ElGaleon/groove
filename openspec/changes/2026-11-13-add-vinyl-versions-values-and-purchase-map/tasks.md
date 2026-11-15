# Tasks

## 1. Data model and persistence

- [x] 1.1 Installare Dexie, zod e react-hook-form e verificare che `npm run build` passi
- [x] 1.2 Definire tipi e schemi zod di `Vinyl`, `Version`, `Purchase`, `Value`, `Location` con importi in unità minori; verificare con test unitari su importi negativi, anno non valido e URL non valido (spec `vinyl-collection`, `vinyl-valuation`, `purchase-locations`)
- [x] 1.3 Implementare il modulo `repository` su IndexedDB (CRUD vinili e luoghi, query per filtri) e verificare con test che aggiunta, modifica ed eliminazione siano persistenti dopo ricarica
- [x] 1.4 Caricare le 10 `EDITIONS` come seed alla prima apertura con versione "da completare" e verificare che le viste esistenti mostrino gli stessi 10 elementi

## 2. Vinyl and version in the UI

- [x] 2.1 Creare il form di aggiunta/modifica (shadcn Form/Field, Input, Select, Dialog su desktop e Drawer su mobile) con campi versione e validazione; verificare gli scenari di errore accanto ai campi
- [x] 2.2 Implementare l'avviso di duplicato (artista + titolo + numero di catalogo) e verificarlo con un test
- [x] 2.3 Estendere ricerca e filtri (etichetta, paese, anno, formato, numero di catalogo) in `filters.tsx`, con conteggio risultati e stato vuoto; verificare i filtri combinati con test
- [x] 2.4 Mostrare la versione in griglia, lista e dettaglio e verificare a 375px che il titolo non venga troncato
- [x] 2.5 Aggiungere modifica ed eliminazione con conferma (AlertDialog shadcn) e verificare che l'eliminazione rimuova anche acquisto e valore dalla mappa

## 3. Prices and value

- [x] 3.1 Aggiungere nel form prezzo di acquisto (importo, valuta, data) e valore attuale manuale con fonte e data; verificare la formattazione per valuta
- [x] 3.2 Implementare il calcolo di differenza assoluta e percentuale con "n/d" per dati mancanti o valute diverse; verificare con test unitari sugli scenari della spec
- [x] 3.3 Mostrare guadagno/perdita con icona e testo oltre al colore nella scheda dettaglio, griglia e lista
- [x] 3.4 Creare il riepilogo di collezione (totale speso, valore, differenza per valuta, esclusi) con componenti Card; verificare con un dataset di 10 vinili di cui 2 incompleti

## 4. Purchase locations

- [x] 4.1 Implementare l'entità luogo con tipo fisico/online/entrambi e il form relativo; verificare la validazione di nome, indirizzo e URL
- [x] 4.2 Creare il selettore luogo con Combobox (Command + Popover) che riusa i luoghi esistenti e permette di crearne uno nuovo; verificare che non si creino duplicati
- [x] 4.3 Implementare la geocodifica Nominatim con debounce e coda, correzione manuale del punto e salvataggio senza coordinate; verificare gli scenari "indirizzo non trovato" e "senza posizione"
- [x] 4.4 Gestire il canale d'acquisto (negozio/online) per i luoghi "entrambi" e verificare che l'acquisto online non compaia sulla mappa fisica
- [x] 4.5 Bloccare l'eliminazione di luoghi in uso con riassegnazione degli acquisti; verificare con test

## 5. Purchase map

- [x] 5.1 Installare Leaflet/react-leaflet e creare `PurchaseMap` in lazy load con attribuzione OSM; verificare che la mappa si carichi solo aprendo la schermata
- [x] 5.2 Aggiungere marcatori per i luoghi fisici con adattamento automatico dell'inquadratura e stato vuoto; verificare con tre luoghi in città diverse
- [x] 5.3 Creare il dettaglio luogo (nome, indirizzo, numero vinili, spesa, elenco con link alla scheda) in Sheet/Drawer shadcn e verificarlo su 375px
- [x] 5.4 Aggiungere elenco acquisti online raggruppato per luogo e filtro per periodo (Tabs/Select); verificare che totali e marcatori si aggiornino
- [x] 5.5 Garantire l'equivalente accessibile della mappa (elenco luoghi navigabile da tastiera) e gesti mobili senza blocco dello scroll; verificare manualmente su mobile
- [x] 5.6 Aggiungere la voce "Mappa" nell'header (menu e hamburger) e verificare la navigazione

## 6. Discogs integration

- [x] 6.1 Verificare con una richiesta reale CORS, User-Agent e autenticazione col token personale; documentare l'esito in `design.md` e, se bloccato, decidere il proxy prima di proseguire
- [x] 6.2 Implementare `discogs-client` (ricerca, dettaglio release, marketplace stats) con coda, ritardo e gestione 429/errori di rete; verificare con test su risposte simulate
- [x] 6.3 Creare nelle impostazioni (menu account) il collegamento/scollegamento con token mascherato e stato "Collegato"; verificare che il token non compaia in log e messaggi
- [x] 6.4 Aggiungere nel form la ricerca Discogs per artista/titolo/catalogo/barcode con scelta della release e precompilazione della versione; verificare "nessun risultato" con inserimento manuale
- [x] 6.5 Importare il valore di mercato (misura, valuta, copie in vendita) come valore con fonte "Discogs", senza inventare valori se non ci sono copie; verificare con test
- [x] 6.6 Implementare l'aggiornamento singolo e totale con riepilogo (aggiornati, invariati, falliti) e proposta di conferma quando esiste un valore manuale; verificare lo scenario di fallimento parziale
- [x] 6.7 Verificare che l'app sia pienamente utilizzabile con Discogs non collegato (invito a collegare, nessuna funzione bloccata)

## 7. Backup and docs

- [x] 7.1 Aggiungere esportazione/importazione JSON della collezione e verificare un ciclo esporta → svuota → importa senza perdite
- [x] 7.2 Documentare in `../../../README.md` modello dati, collegamento Discogs e limiti dei servizi esterni, e verificare che i comandi indicati funzionino
- [x] 7.3 Eseguire una verifica d'insieme su desktop e a 375px (aggiunta con Discogs, aggiunta manuale, filtri, mappa, totali) e `npm run build`

## 8. Ricerca Discogs come primo passo dell'aggiunta

- [x] 8.1 Estendere il client Discogs con paginazione, ricerca per barcode e annullamento delle richieste in coda (`AbortSignal`); verificare con test che una richiesta annullata non chiami la rete e che un codice di 12 cifre usi il parametro barcode
- [x] 8.2 Creare l'hook di ricerca live (pausa, minimo 3 caratteri, ultima query vincente, carica altri, riprova); verificare con test su digitazione rapida e risposte fuori ordine
- [x] 8.3 Creare il passo "Cerca su Discogs" (campo in focus, risultati con copertina e dettagli, "Già in collezione", "Mostra altri", errori con Riprova e Inserisci a mano) usando solo componenti shadcn; verificarlo nel browser a desktop e 375px
- [x] 8.4 Far partire l'aggiunta dalla ricerca quando Discogs è collegato, con "Inserisci a mano" sempre disponibile e ritorno alla ricerca dal modulo senza perdere i dati; verificare entrambi i percorsi nel browser e che senza Discogs si apra il modulo manuale
- [x] 8.5 Aggiornare il README con il nuovo flusso e verificare `npm test` e `npm run build`

## Workflow follow-up

- Archiviare la change dopo la revisione.
- Verificare le specifiche principali generate in `../../specs` dopo l'archiviazione.
