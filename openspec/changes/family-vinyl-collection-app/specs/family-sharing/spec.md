# Spec Delta

## Purpose

Lets one family keep a single shared vinyl collection: members join by invitation, sign in with email and password, and all have equal rights to view and change the collection. Nobody outside the family can see it.

## ADDED Requirements

### Requirement: First household
The system SHALL let the first person who registers create the household, which owns exactly one collection. That person becomes its first member.

#### Scenario: Create the household
- **WHEN** a person registers on a new installation and chooses a household name
- **THEN** the system creates an empty household and shows its empty collection

#### Scenario: Registration without invitation once a household exists
- **WHEN** a person tries to register without an invitation after the household exists
- **THEN** the system refuses the registration

### Requirement: Invite by link
The system SHALL let any member generate an invite link that lets one person join the household. An invite link MUST expire after 7 days and MUST be usable only once.

#### Scenario: Joining with a valid invite
- **WHEN** a person opens a valid invite link and registers with an email and a password
- **THEN** they become a member and see the household's collection

#### Scenario: Expired or used invite
- **WHEN** a person opens an invite link that has expired or was already used
- **THEN** the system shows a clear message and does not add them to the household

#### Scenario: Member revokes an unused invite
- **WHEN** a member revokes an invite that has not been used
- **THEN** the link stops working immediately

### Requirement: Sign-in with email and password
The system SHALL let members sign in with their email address and a password, and sign out. Passwords MUST be at least 10 characters and MUST NOT be stored in a recoverable form.

#### Scenario: Successful sign-in
- **WHEN** a member enters the correct email and password
- **THEN** they are signed in and see the collection

#### Scenario: Wrong credentials
- **WHEN** a person enters an unknown email or a wrong password
- **THEN** the system shows the same generic error in both cases and does not sign them in

#### Scenario: Repeated failures
- **WHEN** more than 5 sign-in attempts for the same email fail within 10 minutes
- **THEN** the system temporarily refuses further attempts for that email

#### Scenario: Password too short
- **WHEN** a person chooses a password shorter than 10 characters
- **THEN** the system rejects it and states the minimum length

### Requirement: Change password
The system SHALL let a signed-in member change their own password by giving the current one.

#### Scenario: Change with the current password
- **WHEN** a member enters the correct current password and a valid new one
- **THEN** the password is changed and other sessions of that member are signed out

### Requirement: Private to the household
The system MUST let only members of the household read or change its collection. Anyone else, signed in or not, SHALL NOT be able to read any record of it, including cover images.

#### Scenario: Anonymous visitor
- **WHEN** a person who is not signed in opens the app or requests a record or a cover
- **THEN** they see only the sign-in screen and receive no collection data

### Requirement: Equal rights for all members
The system SHALL give every member the same rights: view the collection, add, edit and remove any record, connect their own Discogs account, and invite others. Any member SHALL be able to leave the household.

#### Scenario: Member edits another member's record
- **WHEN** a member edits a record that another member added
- **THEN** the change is saved

#### Scenario: Last member leaves
- **WHEN** the only remaining member asks to leave
- **THEN** the system warns that the collection will be deleted and deletes it only after explicit confirmation

### Requirement: Leaving does not orphan records
The system SHALL, when a member leaves, keep their records in the collection and turn them into shared records.

#### Scenario: Member with owned records leaves
- **WHEN** a member who owns 12 records leaves the household
- **THEN** the 12 records remain in the collection with no owner, so they are shared
