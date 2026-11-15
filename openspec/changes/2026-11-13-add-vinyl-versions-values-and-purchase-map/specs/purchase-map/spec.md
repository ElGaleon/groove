# Spec Delta

## Purpose

Mostra su una mappa dove sono stati fatti gli acquisti di vinili, con il dettaglio per luogo, e raccoglie gli acquisti online in un elenco dedicato.

## ADDED Requirements

### Requirement: Map of physical purchases
Il sistema SHALL mostrare una mappa con un marcatore per ogni luogo fisico che ha almeno un acquisto e coordinate, e SHALL adattare automaticamente l'inquadratura per includere tutti i marcatori.

#### Scenario: Mappa popolata
- **WHEN** l'utente apre la mappa con acquisti in tre negozi in città diverse
- **THEN** sono visibili tre marcatori e l'inquadratura li comprende tutti

#### Scenario: Nessun acquisto geolocalizzato
- **WHEN** non esiste alcun acquisto con luogo fisico geolocalizzato
- **THEN** il sistema mostra uno stato vuoto che spiega come aggiungere un luogo

### Requirement: Location detail
Il sistema SHALL mostrare, selezionando un marcatore o un luogo dell'elenco, il nome, l'indirizzo, il numero di vinili acquistati, la spesa totale e l'elenco dei vinili con collegamento alla scheda.

#### Scenario: Selezione marcatore
- **WHEN** l'utente seleziona il marcatore di "Disco Club"
- **THEN** compaiono nome, indirizzo, numero di vinili, spesa totale e i vinili acquistati

### Requirement: Online purchases list
Il sistema SHALL mostrare gli acquisti online in un elenco separato dalla mappa, raggruppati per luogo con numero di vinili e spesa totale.

#### Scenario: Acquisti online
- **WHEN** esistono acquisti presso "Bandcamp" e "Discogs Marketplace"
- **THEN** l'elenco online mostra i due luoghi con numero di vinili e spesa

### Requirement: Filter map by period and amount
Il sistema SHALL permettere di filtrare mappa ed elenco per periodo di acquisto e SHALL aggiornare marcatori e totali di conseguenza.

#### Scenario: Filtro per anno
- **WHEN** l'utente seleziona l'anno 2024
- **THEN** compaiono solo i luoghi con acquisti nel 2024 e i totali riflettono solo quel periodo

### Requirement: Map usable on mobile and by keyboard
Il sistema SHALL rendere la mappa utilizzabile su mobile (gesti di zoom e trascinamento senza bloccare lo scorrimento della pagina) e offrire un elenco dei luoghi equivalente ai marcatori, accessibile da tastiera e da screen reader.

#### Scenario: Schermo stretto
- **WHEN** l'utente apre la mappa su uno schermo largo 375px
- **THEN** mappa ed elenco dei luoghi sono entrambi raggiungibili e il dettaglio si apre in un pannello a schermo intero o dal basso

### Requirement: Privacy of location data
Il sistema SHALL mantenere i dati dei luoghi di acquisto nella collezione dell'utente e SHALL NOT inviarli a servizi esterni oltre all'indirizzo necessario alla geocodifica e alle richieste dei tile della mappa.

#### Scenario: Uso della mappa
- **WHEN** l'utente consulta la mappa
- **THEN** i prezzi e i titoli dei vinili non sono inviati ai servizi di mappa o geocodifica
