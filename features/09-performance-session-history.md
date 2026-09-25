# Feature 09: Performance Session History

## Overview
Archives completed sessions, providing organizers and players with historical logs, game-by-game breakdowns, and exportable session reports.

## User Stories
- **As an Organizer**, I want to browse past sessions and export summary reports so that club records and attendance logs are archived permanently.
- **As a Player**, I want to review my past match history to see scores, partners, opponents, and Elo rating changes from previous weeks.

## Key Functional Specifications

### 1. Session History Directory
- **Session List View**: Displays all concluded sessions sorted chronologically by date.
- **Metadata Cards**: Shows Session Name, Date, Total Games Played, Total Attendees, and Game Type.

### 2. Detailed Session Log View
- **Match Breakdown**: List of all completed matches in the session (Match #, Court, Team A players & score vs Team B players & score).
- **Elo Delta Inspection**: Shows rating gain/loss for each player per match.

### 3. Report Export
- **PDF Export**: Generate printable PDF summary report of session results and standings.
- **Light Mode 10% Grey Styling**: Header containers styled with `.light-10-grey-tile` (`#e6e8ec`) and high-contrast dark text (`#000000`) in light mode.

### 4. Player Search Filtering
- **Search Bar**: Positioned on top of the detailed session view.
- **Scope**: Filters both Match Records (matching player name in Team A or Team B) and Session Leaderboard rows.

### 5. Score Audit Logs Tab
- **Tab Placement**: Available under **Performance -> Session History** as the **third subtab** next to Session Leaderboard (`Match Records` | `Session Leaderboard` | `Audit Logs`).
- **Audit Details Display**:
  - Lists all score corrections performed during that session instance.
  - Displays **Updater Credentials**: Name (`updatedByName`), Email (`updatedByEmail`), User ID (`updatedByUid`), Manager Role (`updatedByRole`).
  - Displays **Score Changes**: Old score & winner vs New score & winner, formatted change summary.
  - Displays **Match & Session Context**: Match #, Court Name, Team A & Team B player names, Session Name, Weekly Session template info (if applicable), Session Date, and Timestamp.

### 6. Session Deletion Governance, Deleted Sessions Directory & Ranking Exclusion
- **RBAC Delete Restriction**: Concluded session deletion from Performance -> Session History is strictly restricted to **Primary Club Manager** (`CLUB_MANAGER`). Secondary Club Managers and Session Managers do not have rights to delete sessions.
- **Soft Deletion & Preservation**: Deleting a session marks it with `isDeleted: true`, recording deletion metadata (`deletedAt`, `deletedBy`) rather than hard purging records.
- **Deleted Sessions Directory**:
  - Soft-deleted sessions are listed in a dedicated **"Deleted Sessions"** collapsible directory under Performance -> Session History.
  - Displays deleted session cards with deletion timestamp, deleter credentials, and a `Deleted` badge.
  - Selecting a deleted session displays its historical matches in read-only mode with a prominent **Deleted Session Notice** banner.
- **Player Ranking Exclusion**: All matches, scores, and rating changes from soft-deleted sessions are strictly excluded from Player Rankings, Session Leaderboards, Lifetime Leaderboards, and Team Pair Rankings.



