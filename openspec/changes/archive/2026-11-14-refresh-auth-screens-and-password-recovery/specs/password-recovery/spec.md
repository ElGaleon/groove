# password-recovery Specification

## Purpose
Defines how a family member who forgot the password gets back into the app without email: another member generates a one-time link that lets them set a new password.

## ADDED Requirements

### Requirement: A member can create a reset link for another member
The system SHALL let a signed-in member create a one-time password reset link for any other member of the same household. The link SHALL be shown once to the member who created it, SHALL be valid for 24 hours, and the server SHALL store only a hash of its token. A member MUST NOT be able to create a link for a member of another household or for themselves.

#### Scenario: Create the link
- **WHEN** Anna opens the family screen and asks for a reset link for Bob
- **THEN** a link of the form `/reset-password/<token>` is shown with a copy button and its expiry

#### Scenario: Not allowed
- **WHEN** a member asks for a reset link for themselves or for someone outside their household
- **THEN** the system refuses with a coded error and creates nothing

### Requirement: The link sets a new password once
The system SHALL let anyone who holds a valid link set a new password for the member it was created for, applying the same password rules as registration. On success the system SHALL sign the member in, end all their other sessions, and mark the link as used so it cannot be used again. A newer link for the same member SHALL replace the earlier unused ones.

#### Scenario: Reset
- **WHEN** Bob opens his link and sets a valid new password
- **THEN** Bob is signed in with the new password, his old password no longer works and his other devices are signed out

#### Scenario: Used, expired or invalid link
- **WHEN** a link is used a second time, has expired, was replaced by a newer one or never existed
- **THEN** the page says the link cannot be used and asks to request another from a family member, and no password changes

#### Scenario: Password too short
- **WHEN** the new password is shorter than the minimum length
- **THEN** the system answers with the coded error `password_too_short` and the link stays valid

### Requirement: The sign-in screen explains how to recover access
The system SHALL show on the sign-in screen, near the password field, a "forgot your password?" hint that explains that a family member can generate a reset link, and SHALL NOT reveal whether an email address is registered.

#### Scenario: Forgot password
- **WHEN** a visitor reads the hint under the sign-in form
- **THEN** it tells them to ask a family member for a reset link and offers no email form
