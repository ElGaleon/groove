# vinyl-valuation Specification

## Purpose
Gestisce gli aspetti economici di un vinile: prezzo di acquisto, valore attuale della specifica versione e differenza tra i due, per singolo disco e per l'intera collezione.

## Requirements

### Requirement: Purchase price
Il sistema SHALL permettere di registrare per ogni vinile il prezzo di acquisto con importo, valuta e data. Il prezzo SHALL essere facoltativo e non negativo.

#### Scenario: Prezzo registrato
- **WHEN** l'utente inserisce 24,90 EUR e la data di acquisto
- **THEN** il prezzo appare nella scheda dettaglio formattato secondo la valuta

#### Scenario: Importo negativo
- **WHEN** l'utente inserisce un importo negativo
- **THEN** il sistema rifiuta il valore e mostra un errore sul campo

### Requirement: Current value is per version
Il sistema SHALL associare il valore attuale alla versione del vinile e non al solo titolo, indicando la **fonte** (Discogs o manuale), la valuta e la data dell'ultimo aggiornamento.

#### Scenario: Valore manuale
- **WHEN** l'utente inserisce a mano un valore attuale
- **THEN** il sistema lo salva con fonte "manuale" e la data odierna

#### Scenario: Valore da Discogs
- **WHEN** il valore proviene da Discogs
- **THEN** la scheda mostra fonte "Discogs" e la data di aggiornamento

### Requirement: Manual value is not overwritten silently
Il sistema SHALL NOT sovrascrivere un valore inserito manualmente con un valore di Discogs senza che l'utente lo scelga esplicitamente.

#### Scenario: Aggiornamento con valore manuale presente
- **WHEN** l'utente aggiorna i valori da Discogs e un vinile ha un valore manuale
- **THEN** il sistema mostra il valore Discogs come proposta e mantiene quello manuale finché l'utente non conferma

### Requirement: Gain and loss
Il sistema SHALL calcolare e mostrare per ogni vinile la differenza tra valore attuale e prezzo di acquisto in importo e in percentuale, evidenziando guadagno e perdita non solo con il colore. Se manca uno dei due valori o le valute sono diverse, SHALL mostrare "n/d" senza stimare.

#### Scenario: Guadagno
- **WHEN** il prezzo è 20 EUR e il valore attuale 35 EUR
- **THEN** il sistema mostra +15 EUR (+75%) con un indicatore testuale di guadagno

#### Scenario: Dato mancante
- **WHEN** il vinile non ha un prezzo di acquisto
- **THEN** la differenza è mostrata come "n/d"

#### Scenario: Valute diverse
- **WHEN** prezzo in USD e valore in EUR
- **THEN** il sistema non confronta gli importi e mostra "n/d"

### Requirement: Collection totals
Il sistema SHALL mostrare il totale speso, il valore attuale totale e la differenza complessiva per valuta, considerando solo i vinili che hanno i dati necessari e indicando quanti sono stati esclusi.

#### Scenario: Totali con esclusi
- **WHEN** 8 vinili su 10 hanno prezzo e valore nella stessa valuta
- **THEN** i totali sono calcolati su 8 e il sistema indica "2 esclusi per dati mancanti"

### Requirement: Totals ignore paging
I totali della collezione SHALL essere calcolati su tutti i vinili che rispettano ricerca e filtri correnti, indipendentemente dalla pagina della tabella, dai blocchi caricati in griglia e dalla dimensione scelta.

#### Scenario: Totali con 10 per pagina
- **WHEN** 30 vinili in EUR rispettano i filtri e la tabella ne mostra 10
- **THEN** il riepilogo somma prezzo e valore di tutti i 30 vinili

#### Scenario: Cambio pagina
- **WHEN** l'utente passa da pagina 1 a pagina 2 senza cambiare filtri
- **THEN** i totali del riepilogo non cambiano e non vengono richiesti di nuovo
