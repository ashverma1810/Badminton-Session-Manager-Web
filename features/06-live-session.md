# Feature 06: Live Session Management

## Overview
Serves as the real-time command center for managing active badminton sessions, court statuses, player queues, attendance states, and match allocations.

## User Stories
- **As a Session Manager**, I want a live interactive control board that loads in paused mode on the Session Tab so I can adjust attendee rosters before starting play and generating games.

## Key Functional Specifications

### 1. Session Load & Pre-Match Roster Editing Workflow
When loading any session (weekly template or adhoc):

1. **Session Tab Default & Paused Mode**:
   - The session initializes in **`Setting Up` / Paused mode** (`status: 'Setting Up'`).
   - The UI automatically opens on the **Session Tab** (showing court list and player pool).
   - Games are **NOT** generated automatically upon load.
2. **Deleting Absent Permanent Players**:
   - Managers can delete/remove absent permanent players from the live session roster under the Session tab.
   - This action applies strictly to the current active session instance without modifying the master weekly session setup or member directory.
3. **Adding PAYG Members**:
   - Managers can add guest/PAYG members to the live session by selecting from the club member directory or using `Manage Pool -> Create New`.
   - Players added to the session in this manner are tagged with a **`PAYG`** badge for this session.
4. **Start Session & Match Generation**:
   - When member list adjustments are complete, the manager clicks **Start Session** in the header.
   - Starting the session transitions status to `Active`, auto-generates matches for all specified active courts, and automatically switches the active view to the **Games Tab**.

### 2. Court Management Controls
- **Court Cards**: Displays real-time status for each court (`Active Game`, `Setting Up`, `Paused`, `Ended`).
- **Dynamic Court Addition / Removal**: Add new courts on the fly or disable specific courts.
- **Custom Court Naming**: Rename courts (e.g. "Court 1", "Court 2").

### 3. Player Attendance & Status Drawer
- **Player States**:
  - `Present / Available`: Eligible for match allocation.
  - `Resting / Paused`: Temporarily skipped during auto-allocation.
  - `Left Session`: Removed from active rotation.
- **PAYG Tagging**: Visual `PAYG` chip displayed next to guest players in the session player list.

### 4. Fair Match Allocation Engine Integration
- **Trigger**: Executed when the manager clicks **Start Session** (generates initial games for all courts) or when court matches conclude.
- **Algorithm Constraints**:
  - Equalizes games played per member.
  - Maximizes rest-time balance.
  - Minimizes repetitive partner/opponent pairings.
  - Balanced skill matching based on Elo ratings.
