# purchase-locations Specification

## Purpose
Permette di indicare dove è stato acquistato ogni vinile, in un luogo fisico, online o entrambi, riusando i luoghi tra più acquisti e abilitando la mappa degli acquisti.

## Requirements

### Requirement: Location types
Il sistema SHALL gestire luoghi di acquisto di tipo **fisico**, **online** o **entrambi**. Un luogo fisico SHALL avere nome e posizione (indirizzo e coordinate); un luogo online SHALL avere nome e URL. Un luogo "entrambi" SHALL avere tutti i dati richiesti dai due tipi.

#### Scenario: Negozio fisico
- **WHEN** l'utente crea "Disco Club" come luogo fisico con indirizzo a Milano
- **THEN** il luogo è salvato con le coordinate ricavate dall'indirizzo

#### Scenario: Negozio online
- **WHEN** l'utente crea "Bandcamp" come luogo online con URL
- **THEN** il luogo è salvato senza coordinate

#### Scenario: URL non valido
- **WHEN** l'utente inserisce un URL non valido per un luogo online
- **THEN** il sistema rifiuta il salvataggio e segnala il campo

### Requirement: Geocoding with manual correction
Il sistema SHALL ricavare le coordinate dall'indirizzo e permettere all'utente di verificarle e correggerle prima del salvataggio, ad esempio selezionando il punto sulla mappa. Se la geocodifica fallisce SHALL permettere di salvare il luogo senza coordinate.

#### Scenario: Indirizzo non trovato
- **WHEN** la geocodifica non trova l'indirizzo
- **THEN** il sistema lo comunica e permette di indicare il punto sulla mappa o di salvare senza coordinate

#### Scenario: Luogo senza coordinate
- **WHEN** un luogo fisico è salvato senza coordinate
- **THEN** non compare sulla mappa ma compare in un elenco "senza posizione"

### Requirement: Reuse locations
Il sistema SHALL proporre i luoghi già inseriti (con ricerca per nome) quando si registra un acquisto, evitando duplicati, e SHALL permettere di crearne uno nuovo dallo stesso modulo.

#### Scenario: Luogo esistente
- **WHEN** l'utente digita "Disco" e il luogo "Disco Club" esiste
- **THEN** il sistema lo propone e, se scelto, non crea un duplicato

### Requirement: Link purchase to location
Il sistema SHALL permettere di associare a un vinile un luogo di acquisto, anche un luogo "entrambi" scegliendo se l'acquisto è avvenuto in negozio o online, e SHALL mostrare il luogo nella scheda dettaglio con collegamento al sito o alla mappa.

#### Scenario: Acquisto online presso negozio con sede fisica
- **WHEN** l'utente associa un luogo "entrambi" scegliendo "online"
- **THEN** l'acquisto è conteggiato tra gli acquisti online e non sulla mappa fisica

### Requirement: Edit and delete locations
Il sistema SHALL permettere di modificare un luogo e SHALL impedire l'eliminazione di un luogo usato da almeno un acquisto, offrendo di spostare gli acquisti su un altro luogo.

#### Scenario: Eliminazione di luogo in uso
- **WHEN** l'utente elimina un luogo con 3 acquisti
- **THEN** il sistema blocca l'eliminazione e propone di riassegnare i 3 acquisti a un altro luogo
