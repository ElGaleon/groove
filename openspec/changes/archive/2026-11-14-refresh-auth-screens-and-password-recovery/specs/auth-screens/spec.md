# auth-screens Specification

## Purpose
Defines how the sign-in, registration, invitation and password-reset screens look and behave on phones and wide screens: layout, password field, loading state, keyboard handling, theme and brand mark.

## ADDED Requirements

### Requirement: The form is centred on the screen
The system SHALL show the form of an auth screen in the vertical middle of the viewport on every screen size, with the title and subtitle centred on phones and left-aligned from tablet width up. On wide screens (1024 px and more) the screen SHALL be split in two columns: the form on one side, a dark panel with a record on the other.

#### Scenario: Phone
- **WHEN** the sign-in screen is opened on a 375 x 812 viewport
- **THEN** the vertical centre of the form is within 2 px of the vertical centre of the viewport and there is no horizontal scroll

#### Scenario: Wide screen
- **WHEN** the sign-in screen is opened on a 1280 x 800 viewport
- **THEN** the form sits in the left column, centred vertically, and a dark panel with the record fills the right column

### Requirement: Password fields can be revealed
The system SHALL give every password field on the auth screens a control that shows or hides the typed text, labelled in the member's language and reachable by keyboard, and SHALL keep the field hidden by default. Email fields SHALL turn off automatic capitalisation and correction, and the submit key of the form SHALL submit it.

#### Scenario: Reveal and hide
- **WHEN** a member activates the show-password control
- **THEN** the typed text becomes readable and the control is announced as pressed; activating it again hides the text

### Requirement: A record shows that the form is being sent
The system SHALL show a small spinning record in the submit button while a sign-in, registration or reset request is in progress, SHALL keep the button label readable and SHALL disable the button until the request ends. When the system asks for reduced motion the record SHALL NOT rotate.

#### Scenario: Slow sign-in
- **WHEN** a member submits the sign-in form and the server has not answered yet
- **THEN** the button is disabled and shows a spinning record next to its label

#### Scenario: Reduced motion
- **WHEN** the system asks for reduced motion
- **THEN** the record in the button and the one on the page do not rotate

### Requirement: The hero band gives way to the keyboard
The system SHALL collapse the dark band above the form on phones while a field has focus, so that the form stays in view when the on-screen keyboard is open.

#### Scenario: Focus on a field
- **WHEN** a member taps a field on a phone
- **THEN** the band shrinks to a thin bar with the brand name and returns to full size when focus leaves the form

### Requirement: Auth screens follow the system theme
The system SHALL show the auth screens with the dark colours when the operating system prefers a dark theme, and with the light colours otherwise. The dark panel and band SHALL look the same in both themes.

#### Scenario: Dark system theme
- **WHEN** a visitor whose system prefers a dark theme opens the sign-in screen
- **THEN** the form side uses the dark background and text colours with sufficient contrast

### Requirement: The app has a brand mark
The system SHALL use the same record mark as favicon, in the header of the signed-in app and on the auth screens, and SHALL serve the favicon file referenced by the page.

#### Scenario: Favicon
- **WHEN** a browser requests the favicon of the page
- **THEN** the server answers with an image and not with an error

### Requirement: Fonts for the shelf covers load only for the shelf
The system SHALL NOT download the fonts used by the covers of the 3D shelf on pages other than the shelf.

#### Scenario: Sign-in screen
- **WHEN** the sign-in screen is loaded
- **THEN** no request is made to the font hosts for the shelf cover fonts
