# Feature 01: Club Sign-in and Registration

## Overview
Provides secure, multi-tenant onboarding and authentication for Badminton Club Organizers. Manages club profile creation, authentication credentials, venue defaults, and tenant data isolation.

## User Stories
- **As a Club Manager**, I want to register a new badminton club with default settings so that I can manage my club's sessions, courts, and members in an isolated cloud environment.
- **As an Existing Manager**, I want to sign in with my registered email and password so that I can access my club's private data dashboard.

## Key Functional Specifications

### 1. Unauthenticated Initial State
- Upon initial load, the application does not default to any pre-existing or sample club data.
- The top navbar displays a **Solid Red** indicator when disconnected or unauthenticated.

### 2. Club Registration
- **Fields Required**:
  - Club Name (max 100 chars)
  - Venue Location (max 200 chars)
  - Target Winning Score (default 21 points)
  - Organiser Name (max 100 chars)
  - Default Game Type (`DOUBLES`, `SINGLES`, `MIXED_DOUBLES`, `MULTI_TYPE`)
  - Theme Color Hex (`#0284C7` Sky Blue default, Emerald, Violet, Amber, Rose, Royal Blue)
  - Club Email Address
  - Password & Verify Password
- **Tenant Isolation**: Upon successful registration, the system initializes a new isolated record at `/clubs/{clubId}/`. All member directories, session logs, and court rules are strictly isolated to this `clubId`.

### 3. Club Sign-in
- Authenticates via Firebase Auth with email and password.
- Updates the top navigation indicator to **Pulsing Green** ("SYNC") upon successful authentication.
- Automatically loads the club settings, active sessions, and member roster for the authenticated `clubId`.

### 4. Data Safety & Clear On Logout
- Signing out synchronously clears all in-memory club state, cancels active Firebase Realtime Database listeners, and resets local storage caches.
