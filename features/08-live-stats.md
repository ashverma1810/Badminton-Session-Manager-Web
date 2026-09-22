# Feature 08: Live Session Statistics & Realtime Metrics

## Overview
Provides real-time metric tracking during active sessions, showing live session standings, court utilization rates, and attendance analytics.

## User Stories
- **As a Player**, I want to view live session statistics during rests so that I can track my games played, win rate, and point differential in the current session.
- **As an Organizer**, I want real-time cloud synchronization so that scores entered on court tablets immediately update all connected spectator devices.

## Key Functional Specifications

### 1. Live Session Metrics
- **Games Played Counter**: Real-time count of completed games per player in the current session.
- **Session Standings Table**:
  - Player Name
  - Matches Played (MP)
  - Wins (W) & Losses (L)
  - Win Percentage (%)
  - Total Points For (PF) & Points Against (PA)
  - Net Point Differential (+/-)
- **Court Utilization Meter**: Displays active percentage of available courts vs idle courts.

### 2. Realtime Firebase Cloud Sync
- All live stats automatically synchronize across connected clients via Firebase Realtime Database.
- Zero manual refresh required; UI updates instantly upon match completion.

### 3. Player Search Filtering
- **Player Name Search Input**: Search bar on top of Stats & Standings panel allows filtering by player name.
- **Scope**: Filters both Session Standings (matching player name) and Match Records (matching any player in Team A or Team B).
- **Clear Button**: Interactive `✕` icon clears active search text instantly.

### 4. Completed Match Score Editing & Audit Logging
- **Score Correction Before Session End**:
  - Session managers can edit completed match scores under **Live Session -> Stats & Standing -> Match Records** before a session is ended (`status !== 'End'`).
  - **Validation Rules**:
    - Non-negative whole numbers only.
    - Max score limits enforced (max 20 for 15-point target, max 30 for 21-point target).
    - Tied scores are disallowed.
  - **Dynamic Recalculation**: Saving a score correction instantly updates session standings, win rates, net point differentials, and player rankings.
  - **Visual Indicator**: Edited matches display an **`Edited`** badge.
- **Audit Logging**:
  - Every score edit generates an immutable audit log entry in Realtime Database under `clubs/{clubId}/sessions/session_{sessionId}/audit_logs/{logId}`.
  - **Information Captured**:
    - **Updater Credentials**: Name (`updatedByName`), Email (`updatedByEmail`), User ID (`updatedByUid`), Manager Role (`updatedByRole`).
    - **Score Changes**: Old score & winner vs. New score & winner, formatted change summary string.
    - **Match Context**: Match #, Court Name, Team A & Team B player names.
    - **Session Context**: Session Name, Weekly Session template details (if applicable), and Session Date.
    - **Timestamp**: Exact ISO/timestamp of edit.
- **Audit Logs View**:
  - Dedicated **`Audit Logs`** sub-toggle tab under **Stats & Standing** allows managers to inspect full score correction history.

### 5. 4-Hour Session Auto-End Engine
- **Max Duration Limit**: Any session active or running for more than 4 hours (14,400 seconds) is automatically ended (`status: 'End'`).
- **History Preservation**: Upon auto-ending, all completed games are persisted to session history.


