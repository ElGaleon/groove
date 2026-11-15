# localization Specification

## Purpose
Defines the languages the app is offered in, how a member's language is chosen and remembered, and how text, dates, numbers and money are shown in it.

## Requirements


### Requirement: Italian and English are offered
The system SHALL show every screen, message, button label and notification in Italian or in English. Italian MUST be the default when nothing else is known.

#### Scenario: Switch to English
- **WHEN** a member chooses English in Settings
- **THEN** all texts of the app are shown in English without reloading the page

#### Scenario: Missing English text
- **WHEN** a text exists in Italian but has no English translation
- **THEN** the Italian text is shown, never an empty label or a key name

### Requirement: The member's language is remembered
The system SHALL store the language chosen by a member on the server so it applies on every device where they sign in. Before sign-in, it SHALL use the browser language when it is Italian or English, and Italian otherwise.

#### Scenario: Same language on another device
- **WHEN** a member who chose English signs in from a new phone
- **THEN** the app opens in English

#### Scenario: Sign-in screen
- **WHEN** a visitor whose browser is set to English opens the sign-in screen
- **THEN** it is shown in English

### Requirement: The language can be changed from the menu and from Settings
The system SHALL let a signed-in member change the language both from the account menu and from the Settings screen, showing the current language in each place, and SHALL keep the two in step. A visitor who is not signed in SHALL be able to change it from the sign-in, registration and invitation screens.

#### Scenario: Change from the account menu
- **WHEN** a member opens the account menu and picks English
- **THEN** the app switches to English at once and Settings shows English as the current language

#### Scenario: Change from Settings
- **WHEN** a member picks Italian in Settings
- **THEN** the account menu and every screen are shown in Italian, and the choice is saved for their other devices

#### Scenario: Visitor changes language
- **WHEN** a visitor on the sign-in screen picks English
- **THEN** the screen is shown in English and the choice is remembered in the browser until they sign in

### Requirement: Dates, numbers and money follow the language
The system SHALL format dates, numbers and amounts of money according to the active language (for example `1.234,50 €` in Italian and `€1,234.50` in English), without changing the stored values or currencies.

#### Scenario: A price in both languages
- **WHEN** the same record with a price of 2500 minor units in euro is shown in Italian and then in English
- **THEN** the amount is written with each language's conventions and denotes the same value

### Requirement: No hard-coded user-facing text
The system MUST keep user-facing text in translation catalogs, one per language, and MUST NOT hard-code it in components, so adding a language does not require touching components.

#### Scenario: Source check
- **WHEN** the source is searched for literal words in component text or visible attributes
- **THEN** none is found outside the catalogs
