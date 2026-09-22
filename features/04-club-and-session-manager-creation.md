# Feature 04: Club & Session Manager Creation (RBAC Governance)

## Overview
Enforces strict Role-Based Access Control (RBAC) governance for managing administrative accounts, inviting Session Managers, and controlling administrative permissions.

## User Stories
- **As a Club Manager**, I want to invite and create Session Manager accounts so that assistants can run specific weekly sessions without compromising full club settings.
- **As a System Administrator**, I want non-destructive identity reuse so that re-inviting a previously removed Session Manager re-links their existing credentials seamlessly.

## Key Functional Specifications

### 1. RBAC Governance Matrix
- **`CLUB_MANAGER` (Primary)**:
  - Full read/write access to Club Settings, Financials, Member Directory, Weekly Sessions, and Manager Directory.
  - Authorized to add, edit, or remove Session Managers and Secondary Club Managers.
- **`SECONDARY_CLUB_MANAGER`**:
  - Holds administrative rights similar to Primary Club Manager (full access to manage sessions, court settings, member directory, and manager directory).
  - Provisioned with an account on Firebase Authentication and automatically sent a password reset email upon creation.
- **`SESSION_MANAGER`**:
  - Authorized to run assigned weekly sessions, adhoc sessions, and court scorekeeping.
  - Restricted from creating or deleting weekly sessions, adding/removing other session managers, or altering root club profile credentials.

### 2. Manager Creation, Firebase Authentication & Identity Reuse
- **Invitation & Creation Flow**: Enter Manager Name, Email Address, and select role (`Secondary Club Manager` vs `Session Manager`).
- **Firebase Authentication Entry & Password Reset Email**:
  - For new managers, an entry is added to Firebase Authentication.
  - A password reset email is automatically dispatched to the manager's email address so they can set their password and sign in.
- **Identity Registry Check**: System checks `/auth_users/{sanitizedEmail}` in Firebase Realtime Database.
  - If the user account already exists in Firebase Auth, the system reuses the existing UID without crashing.
  - If new, the system creates the authentication credentials and links the manager profile under `/clubs/{clubId}/session_managers/`.
- **De-provisioning**: Deleting a Manager revokes their permissions in the current club while preserving global authentication credentials for potential future re-assignment.

### 3. Multi-Club User Discovery & Role Resolution
- **Multi-Club Account Switcher**: When a single user email is associated with multiple clubs (e.g. Primary Manager of Club A and Session Manager of Club B), sign-in queries `user_club_index` and owned clubs (`club_{uid}`) to present a Multi-Club Selection dialog.
- **Tenant & Role Isolation**: Selecting a specific club initializes the session in `sessionStorage` with that club's ID, role (`CLUB_MANAGER`, `SECONDARY_CLUB_MANAGER`, or `SESSION_MANAGER`), and manager ID.
- **State Transition**: Selecting any associated club in the selection dialog transitions `activeTab` to `CLUB` view and loads that club's Realtime Database node without falling back to sign-in screen.

