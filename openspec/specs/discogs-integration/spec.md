# discogs-integration Specification

## Purpose
Permette all'utente di collegare Discogs per trovare la versione esatta di un vinile, importarne i metadati e ottenere il valore di mercato attuale, restando pienamente utilizzabile senza collegamento.

## Requirements

### Requirement: Optional connection
Il sistema SHALL funzionare completamente senza Discogs. Le funzioni Discogs SHALL essere disponibili solo quando l'account è collegato; altrimenti SHALL mostrare un invito a collegarlo.

#### Scenario: Account non collegato
- **WHEN** l'utente apre il modulo di aggiunta senza aver collegato Discogs
- **THEN** può inserire tutti i dati a mano e vede l'invito a collegare Discogs

### Requirement: Connect and disconnect account
Il sistema SHALL permettere di collegare e scollegare l'account Discogs dalle impostazioni, mostrando lo stato della connessione. Alla disconnessione le credenziali SHALL essere eliminate; i dati già importati SHALL restare.

#### Scenario: Collegamento riuscito
- **WHEN** l'utente completa l'autorizzazione su Discogs
- **THEN** le impostazioni mostrano "Collegato" con il nome utente Discogs

#### Scenario: Collegamento fallito
- **WHEN** l'autorizzazione è rifiutata o le credenziali non sono valide
- **THEN** il sistema mostra un errore comprensibile e lo stato resta "Non collegato"

#### Scenario: Disconnessione
- **WHEN** l'utente scollega l'account
- **THEN** le credenziali sono rimosse e i vinili già importati restano nella collezione

### Requirement: Search releases and choose a version
Il sistema SHALL permettere di cercare su Discogs per artista, titolo o numero di catalogo/barcode e di scegliere, tra i risultati, la **release** corrispondente alla versione posseduta, mostrando per ciascuna etichetta, anno, paese, formato e copertina.

#### Scenario: Selezione della versione
- **WHEN** l'utente cerca "Abbey Road" e sceglie la release UK 1969
- **THEN** il modulo è precompilato con la versione di quella release e conserva l'identificativo Discogs

#### Scenario: Nessun risultato
- **WHEN** la ricerca non restituisce risultati
- **THEN** il sistema lo comunica e permette di inserire la versione a mano

### Requirement: Import current market value
Il sistema SHALL importare da Discogs il valore di mercato attuale della release scelta, indicando quale misura è usata (es. prezzo più basso in vendita) e il numero di copie in vendita, e SHALL salvarlo come valore attuale con fonte "Discogs".

#### Scenario: Valore importato
- **WHEN** l'utente seleziona una release con copie in vendita
- **THEN** il valore attuale è compilato con la misura Discogs, la valuta e la data

#### Scenario: Nessuna copia in vendita
- **WHEN** la release non ha copie in vendita
- **THEN** il sistema non inventa un valore e lascia il campo da compilare a mano

### Requirement: Refresh values on demand
Il sistema SHALL permettere di aggiornare il valore di un singolo vinile o di tutti i vinili con identificativo Discogs, mostrando l'avanzamento e il riepilogo di aggiornati, invariati e falliti.

#### Scenario: Aggiornamento completo parziale
- **WHEN** l'utente aggiorna tutti i valori e per 2 vinili Discogs risponde con errore
- **THEN** gli altri sono aggiornati e il riepilogo indica i 2 falliti con possibilità di riprovare

### Requirement: Respect rate limits and outages
Il sistema SHALL rispettare i limiti di richieste di Discogs e, in caso di limite superato o servizio non raggiungibile, SHALL mantenere i dati esistenti, informare l'utente e permettere di riprovare.

#### Scenario: Limite superato
- **WHEN** Discogs risponde che il limite di richieste è stato superato
- **THEN** il sistema sospende le richieste, mostra un messaggio e non perde i valori già salvati

### Requirement: Credentials stay private
Il sistema SHALL NOT salvare né registrare nei log token o segreti Discogs in chiaro nel codice sorgente, nel repository o nei messaggi di errore mostrati.

#### Scenario: Errore con credenziali
- **WHEN** una richiesta a Discogs fallisce
- **THEN** il messaggio e i log non contengono il token

### Requirement: Search-first add flow when connected
Quando Discogs è collegato, il sistema SHALL aprire l'aggiunta di un vinile direttamente su una ricerca Discogs con il campo già selezionato, senza passare prima dal modulo manuale. Scelta una release, il sistema SHALL mostrare il modulo già compilato con versione e valore, lasciando da inserire solo i dati di acquisto.

#### Scenario: Aggiunta con Discogs collegato
- **WHEN** l'utente collegato a Discogs sceglie "Aggiungi"
- **THEN** compare subito il campo di ricerca Discogs pronto a ricevere testo

#### Scenario: Release scelta
- **WHEN** l'utente seleziona una release dai risultati
- **THEN** si apre il modulo con titolo, artista, versione e valore già compilati e la copertina Discogs associata

### Requirement: Manual entry always available
Il sistema SHALL offrire in ogni momento un'azione esplicita "Inserisci a mano" che apre il modulo vuoto, e SHALL permettere dal modulo di tornare alla ricerca Discogs senza perdere i dati già inseriti.

#### Scenario: Inserimento manuale con Discogs collegato
- **WHEN** l'utente collegato a Discogs sceglie "Inserisci a mano"
- **THEN** si apre il modulo manuale senza versione collegata e il vinile si può salvare senza Discogs

#### Scenario: Ritorno alla ricerca
- **WHEN** l'utente dal modulo sceglie di cercare su Discogs
- **THEN** torna alla ricerca e, scelta una release, i campi di acquisto già compilati restano invariati

### Requirement: Live search while typing
Il sistema SHALL avviare la ricerca mentre l'utente digita, dopo una breve pausa e con almeno tre caratteri, annullando le richieste superate da una ricerca più recente e mostrando sempre i risultati dell'ultima query digitata.

#### Scenario: Digitazione continua
- **WHEN** l'utente digita "abbey road" lettera per lettera
- **THEN** il sistema interroga Discogs solo dopo la pausa e mostra i risultati dell'ultimo testo, non di quelli intermedi

#### Scenario: Testo troppo corto
- **WHEN** l'utente ha digitato meno di tre caratteri
- **THEN** il sistema non interroga Discogs e mostra un suggerimento su cosa cercare

### Requirement: Search by barcode and catalogue number
Il sistema SHALL riconoscere un testo composto da 8-14 cifre come barcode e cercare per barcode; negli altri casi SHALL cercare per testo libero, che include artista, titolo e numero di catalogo.

#### Scenario: Barcode
- **WHEN** l'utente digita un codice di 12 cifre
- **THEN** la ricerca avviene per barcode e restituisce le release con quel codice

### Requirement: Results are readable and extendable
Il sistema SHALL mostrare per ogni risultato copertina, artista, titolo ed etichetta, numero di catalogo, paese, anno e formato, e SHALL permettere di caricare ulteriori risultati quando disponibili. Le release già presenti in collezione SHALL essere contrassegnate.

#### Scenario: Release già posseduta
- **WHEN** un risultato corrisponde a un vinile già in collezione
- **THEN** il risultato riporta l'indicazione "Già in collezione"

#### Scenario: Altri risultati
- **WHEN** Discogs ha più pagine di risultati
- **THEN** l'utente può caricare i successivi senza perdere quelli già visibili

### Requirement: Search errors keep the user moving
In caso di errore, limite di richieste o assenza di risultati durante la ricerca, il sistema SHALL mostrare un messaggio chiaro con l'azione per riprovare e quella per inserire a mano.

#### Scenario: Discogs non raggiungibile
- **WHEN** la ricerca fallisce per un errore di rete
- **THEN** compaiono il messaggio d'errore, "Riprova" e "Inserisci a mano"
