# Feature 03: Weekly Session Creation & Schedule Management

## Overview
Allows organizers to configure recurring weekly sessions (e.g., Every Tuesday 7:00 PM - 9:00 PM) pre-populated with assigned courts, default session managers, and permanent member rosters.

## User Stories
- **As a Club Manager**, I want to set up recurring weekly sessions with pre-assigned courts and permanent members so that launching weekly play requires just a single click.
- **As a Session Manager**, I want to load my assigned weekly session into the Live Session view in paused/setting up mode on the Session Tab so that I can edit the attendee roster before starting the game.

## Key Functional Specifications

### 1. Weekly Session Attributes & RBAC Governance
- **RBAC Creation & Deletion Restriction**: Weekly session creation (`New Weekly`) and deletion (`Delete Session`) are strictly restricted to Primary (`CLUB_MANAGER`) and Secondary (`SECONDARY_CLUB_MANAGER`) Club Managers. `SESSION_MANAGER` accounts do not have rights to create or delete weekly sessions.
- **Session Name**: (e.g. "Tuesday Night Social")
- **Day of Week**: `Monday` through `Sunday`
- **Start Time & End Time**: (e.g. `19:00` to `21:00`)
- **Default Game Type**: `DOUBLES`, `SINGLES`, `MIXED_DOUBLES`, `MULTI_TYPE`
- **Default Target Score**: e.g., 21 points
- **Assigned Courts**: List of court names (e.g., "Court 1", "Court 2", "Court 3")
- **Assigned Session Managers**: Selected from registered Session Managers
- **Permanent Member Roster**: Pre-selected list of regular club members assigned to this weekly schedule

### 2. Loading Weekly Sessions into Live Play & Pre-Match Editing Workflow
When a weekly session is loaded into the Live Session view:

- **Default Tab on Load**:
  - The system displays the **Session Tab** (not the Games tab) upon loading.
- **Paused / Setting Up Mode**:
  - The session loads in `Setting Up` (paused) mode (`status: 'Setting Up'`).
  - Matches are **NOT** generated automatically on load.
- **Roster Editing Scenarios**:
  - **Removing Absent Permanent Players**: Managers can delete/remove absent permanent players from the live session roster under the Session tab.
  - **Adding PAYG Guests**: Managers can add guest/PAYG members from the member directory or via `Manage Pool -> Create New` (tagged as `PAYG` for this session).
- **Starting Session & Match Generation**:
  - After completing all member edits, the manager clicks **Start Session** in the top header.
  - Clicking **Start Session** sets status to `Active`, auto-generates matches for all specified courts, and automatically switches the view to the **Games Tab**.
