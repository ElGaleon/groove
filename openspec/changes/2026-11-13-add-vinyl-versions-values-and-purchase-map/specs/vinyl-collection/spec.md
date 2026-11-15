# Spec Delta

## Purpose

Definisce il vinile come elemento della collezione, identificato da titolo, artista e **versione** (pressaggio), così che lo stesso album in pressaggi diversi sia distinguibile, aggiungibile e ricercabile.

## ADDED Requirements

### Requirement: Vinyl has a version
Il sistema SHALL associare a ogni vinile una versione composta da: etichetta, numero di catalogo, anno, paese, formato e descrizione libera (es. "180g", "vinile colorato", "ristampa"). Titolo e artista SHALL essere obbligatori; i campi della versione SHALL essere facoltativi ma incoraggiati.

#### Scenario: Stesso album, due versioni
- **WHEN** l'utente aggiunge "Abbey Road" prima come originale UK 1969 e poi come ristampa 180g 2019
- **THEN** il sistema salva due vinili distinti, ciascuno con la propria versione

#### Scenario: Versione incompleta
- **WHEN** l'utente salva un vinile indicando solo titolo e artista
- **THEN** il sistema lo salva e lo contrassegna come "versione da completare"

### Requirement: Add a vinyl by version
Il sistema SHALL permettere di aggiungere un vinile da un modulo che richiede titolo e artista e poi la versione, validando i campi prima del salvataggio e mostrando l'errore accanto al campo non valido.

#### Scenario: Aggiunta valida
- **WHEN** l'utente compila titolo, artista e versione e conferma
- **THEN** il vinile compare nella collezione senza ricaricare la pagina

#### Scenario: Dati non validi
- **WHEN** l'utente conferma senza titolo oppure con un anno non numerico
- **THEN** il sistema non salva e indica quale campo correggere

### Requirement: Warn about duplicate versions
Il sistema SHALL avvisare l'utente quando sta aggiungendo un vinile con stessa combinazione di artista, titolo e numero di catalogo già presente, lasciando la scelta se salvare comunque.

#### Scenario: Duplicato rilevato
- **WHEN** l'utente salva un vinile identico per artista, titolo e numero di catalogo a uno esistente
- **THEN** il sistema chiede conferma indicando il vinile già presente

### Requirement: Search and filter by version
Il sistema SHALL permettere di cercare per titolo, artista e numero di catalogo e di filtrare per etichetta, paese, anno e formato, combinando i filtri. Il numero di risultati SHALL essere sempre visibile.

#### Scenario: Ricerca per numero di catalogo
- **WHEN** l'utente digita un numero di catalogo
- **THEN** sono mostrati solo i vinili con quel numero

#### Scenario: Filtri combinati
- **WHEN** l'utente seleziona paese "UK" e formato "LP"
- **THEN** sono mostrati solo i vinili che rispettano entrambi i criteri

#### Scenario: Nessun risultato
- **WHEN** nessun vinile soddisfa i filtri
- **THEN** il sistema mostra uno stato vuoto con l'azione per azzerare i filtri

### Requirement: Edit and delete a vinyl
Il sistema SHALL permettere di modificare ogni campo di un vinile e di eliminarlo previa conferma esplicita.

#### Scenario: Eliminazione confermata
- **WHEN** l'utente conferma l'eliminazione di un vinile
- **THEN** il vinile e i dati ad esso associati (prezzi, luogo di acquisto) non compaiono più nella collezione e nella mappa

### Requirement: Version visible in every view
Il sistema SHALL mostrare la versione (almeno etichetta, anno e paese) nella lista, nella griglia e nella scheda dettaglio, in modo leggibile anche su mobile.

#### Scenario: Vista mobile
- **WHEN** l'utente apre la lista su uno schermo largo 375px
- **THEN** ogni riga mostra titolo, artista e un riepilogo della versione senza troncare il titolo
