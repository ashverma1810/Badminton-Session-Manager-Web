# 📋 Requirements and Functional Specification

**Project:** Badminton Session Manager  
**Application Type:** Progressive Web Application (SPA) with Cloud Real-time Synchronization  
**Document Version:** 2.4.0  
**Target Audience:** Club Organizers, Session Managers, Players, and Developers  

---

## 1. Executive Summary & Product Vision

The **Badminton Session Manager** is an enterprise-grade, real-time web application tailored specifically for recreational, social, and competitive badminton clubs. The platform resolves the universal challenges of session administration: chaotic court queues, unfair game distributions, biased doubles pairings, cumbersome manual pen-and-paper scorekeeping, and subjective player rankings.

By pairing an intelligent **Fair Match Allocation Algorithm** with an advanced **Doubles-Aware Ranking Model (1,000 baseline)** and real-time cloud data propagation via Firebase, the system provides organizers with effortless session control and players with transparent, data-driven ratings and synergy statistics.

---

## 2. Requirements Chronology & Prompt Evolution

This specification incorporates the sequential functional enhancements, governance rules, and user experience directives established during product evolution:

### 2.1 Governance & RBAC Directive
- **Prompt Directive:** *"Session managers does not have rights to add new session manager, only club manager can do this activity - make these changes."*
- **Specification:**
  - Strict hierarchical Role-Based Access Control (RBAC).
  - The "Add Session Manager" button, email invitation dispatch, and manager deletion controls must be visible and executable **only** by authenticated Club Managers (`CLUB_MANAGER`).
  - Session Managers (`SESSION_MANAGER`) are restricted to viewing the manager directory in read-only mode and may only manage weekly sessions and live play assigned specifically to them.

### 2.2 Light Mode Color System Directive
- **Prompt Directive:** *"Use below light mode colour scheme to build light mode screen, don't make any changes for dark mode colour scheme and design."*
- **Specification:** Strict dual-theme architecture preserving high-contrast neon/slate dark mode while implementing the precise light-mode color token translation:

| Dark Mode Token | Light Mode Replacement Token | Functional Target |
|---|---|---|
| `bg-slate-950` | `bg-slate-50` | Page background canvas |
| `bg-slate-900` | `bg-white` | Primary surface cards & tables |
| `bg-slate-800` | `bg-slate-50` / `bg-slate-100` | Secondary wells, badges & inner boxes |
| `text-white` | `text-slate-950` | Primary headings & active text |
| `text-slate-200` | `text-slate-800` | Secondary body text & high-contrast labels |
| `text-slate-400` | `text-slate-500` | Subtitles, helper text & metadata |
| `text-slate-500` | `text-slate-400` | Subtle timestamps, dividers & icons |
| `border-slate-800` | `border-slate-200` | Primary element borders & dividers |
| `border-slate-700` | `border-slate-300` | Elevated inputs & active tab borders |
| `text-sky-400` | `text-sky-700` | Primary accent typography & win % |
| `bg-sky-950/40` | `bg-sky-50` | Info pills & Men's Doubles category chips |
| `text-emerald-400` | `text-emerald-700` | Victory indicators & positive diffs |
| `bg-emerald-950/30` | `bg-emerald-50` | Success badges & live status pills |
| `text-rose-400` | `text-rose-700` | Defeat indicators & negative diffs |
| `bg-rose-950/30` | `bg-rose-50` | Loss badges & PAYG status chips |

### 2.3 Light Mode 10% Grey Tile & High-Contrast Typography Directive
- **Prompt Directive:** *"When used in light mode - In Team Pair Ranking sub menu use light 10% grey shade for tiles - Team Player Ranking & Synergy Analysis and for tiles under top performing pairs podium and contrast colours for text like Black or Dark Grey and other items in these tiles. Also use same colour scheme and contrast colour for text in Session History & Leaderboard tile."*
- **Specification:**
  - Dedicated utility class `.light-10-grey-tile` with background `#e6e8ec` (10% grey value with 90% lightness).
  - Applied to:
    1. **Team Player Ranking & Synergy Analysis** header overview banner.
    2. **Top Performing Pairs Podium Tiles** (#1 Gold, #2 Silver, #3 Bronze cards).
    3. **Session History & Leaderboard** top navigation header tile.
  - High-contrast visual tokens:
    - Primary titles and player names: Pure Black (`#000000`, `text-black font-black`).
    - Subtitles, descriptions, and labels: Deep Slate/Dark Grey (`#1e293b` / `text-slate-800 font-bold`).
    - Metric wells and badges: Elevated crisp White (`#ffffff`) surfaces with explicit borders (`#cbd5e1`).

### 2.4 Unauthenticated Landing & Session Security Directive
- On initial website load, the application must **not** default to any preset user account or club. It must initialize cleanly to the Club page with authentication controls, requiring the user to explicitly log in.
- Real-time connection indicator in top navigation:
  - **Pulsing Green**: Authenticated and synchronized with Firebase Realtime Database.
  - **Solid Red**: Logged out or disconnected from the cloud.

### 2.5 Session Manager User Lifecycle & UID Reuse Directive
- **Prompt Directive:** *"Review and fix the Session Manager user lifecycle between Firebase Authentication and Firebase Realtime Database. Currently, when a Session Manager is created, the application correctly creates the user in Firebase Authentication and stores the corresponding Session Manager record in Realtime Database. However, when the Session Manager is deleted, only the Realtime Database record is removed while the Firebase Authentication user remains. If the same Session Manager is later recreated using the same email address, the application should detect that the Firebase Authentication account already exists and reuse its existing UID instead of attempting to create a new Authentication user/account."*
- **Specification:**
  - Non-destructive account creation and de-provisioning.
  - Persistent identity registry maintained at `/auth_users/{sanitizedEmail}`.
  - Upon adding a Session Manager, the system queries the identity registry and Firebase Auth.
  - If the user account already exists, the application reuses the existing UID without crashing or attempting a conflicting account creation.
  - Deleting a Session Manager removes only their club-specific permissions and record in `/clubs/{clubId}/session_managers/`, preserving the underlying Firebase Auth credentials for future re-linking or other club duties.

### 2.6 Strict Multi-Tenant Data Isolation Directive
- **Prompt Directive:** *"When registering or creating a new club, enforce strict data isolation between clubs. All club-specific data — including members, sessions, leaderboards, session managers, weekly sessions, and any other club-related records — must be loaded only for the currently selected/registered Club ID. If the new club has no existing data, the relevant screens and collections must remain empty/blank. Do not populate them with default, fallback, cached, previously loaded, or existing data belonging to another club. Under no circumstances should the application assume that, because data does not exist for the current club, it should retrieve or display data from another club. Each club must be treated as a completely separate entity/tenant, with all reads, writes, updates, deletes, real-time listeners, local/offline cache, and synchronization operations scoped to the correct Club ID. Also ensure that when switching between clubs, any previously loaded club data and active listeners are cleared before loading the newly selected club's data."*
- **Specification:**
  - Strict tenant scoping: all data queries, writes, and real-time synchronization strictly bound to `currentClubId`.
  - Zero cross-club data leakage: all collections (`players`, `courtMasters`, `sessionManagers`, `weeklySessions`, `sessions`, `activeCourts`, `activeJoins`, `activeMatches`, and lookup maps) are completely flushed and reset synchronously before any new club is loaded.
  - Blank initial state: newly created clubs or clubs without records initialize with 100% empty collections; no sample or fallback data is ever injected.
  - Isolated local storage: cache keys are strictly scoped (`badminton_club_state_${clubId}`) and validated against the active `clubId`. Mismatched cached entries are discarded.
  - Active listener cancellation: prior Firebase Realtime Database listeners are systematically detached upon club switch or logout to prevent stale updates.

---

## 3. User Roles & Permission Matrix (RBAC)

```
                       [ Unauthenticated User ]
                                  │
                                  ▼
                        [ Authentication ]
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                 ▼
         [ CLUB_MANAGER ]                  [ SESSION_MANAGER ]
   (Club Owner / Master Admin)         (Assigned Weekly Manager)
```

### Detailed Permission Matrix

| Feature / Action | Unauthenticated | Session Manager | Club Manager |
|---|:---:|:---:|:---:|
| **Club Setup & Profile Configuration** | ❌ | ❌ (Read-Only) | ✅ Full CRUD |
| **Add / Edit / Remove Club Players** | ❌ | ❌ (Read-Only) | ✅ Full CRUD |
| **Add / Invite New Session Managers** | ❌ | ❌ **Strictly Forbidden** | ✅ Full CRUD |
| **Delete Session Managers** | ❌ | ❌ **Strictly Forbidden** | ✅ Full CRUD |
| **Create Weekly Session Templates** | ❌ | ❌ | ✅ Full CRUD |
| **Modify Assigned Weekly Sessions** | ❌ | ✅ (Assigned only) | ✅ All Sessions |
| **Launch Live Session from Template** | ❌ | ✅ (Assigned only) | ✅ All Sessions |
| **Scorekeeping & Match Allocation** | ❌ | ✅ | ✅ |
| **Pause / Resume Players in Live Play** | ❌ | ✅ | ✅ |
| **View Match History & Leaderboards** | ✅ (If club loaded)| ✅ | ✅ |
| **Generate & Export PDF Reports** | ❌ | ✅ | ✅ |
| **Access Fullscreen Gym Court Display**| ✅ | ✅ | ✅ |

---

## 4. Detailed Functional Requirements

### Module 1: Club Setup & Administrative Roster
- **FR-1.1 Club Profile**: Configure club name, venue address, contact person, contact email, default target score (e.g., 21 points), and brand theme hex code.
- **FR-1.2 Court Master Inventory**: Create, rename, and retire physical courts (e.g. "Court 1", "Court 2", "Main Hall Court A").
- **FR-1.3 Member Directory**:
  - Name, gender (Male / Female for doubles categorization).
  - Pay-As-You-Go (PAYG) flag vs. season subscription member.
  - Search filter and member count metrics.
- **FR-1.4 Session Manager Administration & Lifecycle**:
  - Email, display name, invitation status (`INVITED`, `ACTIVE`, `EMAIL_SENT`), and linked Authentication UID (`authUid`).
  - Automated Firebase Auth user creation on a secondary app instance or password reset dispatch.
  - **Account Lifecycle & UID Reuse**:
    - When a Session Manager is deleted, only the club's Realtime Database record (`/clubs/{clubId}/session_managers/manager_{id}`) and user club index (`/user_club_index/{sanitizedEmail}/{clubId}`) are removed. The Firebase Authentication user and the persistent `/auth_users/{sanitizedEmail}` registry entry remain intact.
    - When a Session Manager is subsequently recreated with the same email address, the system automatically detects the existing Firebase Authentication account from `/auth_users` or authentication scan, and **reuses the existing UID** instead of attempting a duplicate user creation.
    - A password reset link is re-dispatched to the manager, ensuring immediate access to the club without duplicate account generation.
  - Hard constraint: Session managers cannot add or delete other session managers.

### Module 2: Weekly Session Templates & Scheduling
- **FR-2.1 Recurring Templates**: Schedule recurring weekly sessions specifying day of week (Monday–Sunday), start time (e.g., 19:00), game type, and target winning score.
- **FR-2.2 Court & Manager Allocation**: Select which courts from the Court Master belong to this weekly session and assign up to two designated Session Managers.
- **FR-2.3 Member Pre-Registration**: Check off regular weekly attendees from the club roster.
- **FR-2.4 Session Launcher**: A single "Start Live Session" button that instantiates an active session with players, courts, and session joins pre-populated.

### Module 3: Live Session Management & Fair Match Engine
- **FR-3.1 Interactive Court Cards**:
  - Displays Court Name, Game Type (Doubles / Singles / Mixed), Match Number, Team A and Team B player names.
  - Current score with + and - score adjustment buttons.
  - Active / Finished / Waiting status badges.
- **FR-3.2 Fair Match Allocation Engine**:
  - Automatically selects 4 players (Doubles) or 2 players (Singles).
  - Normalizes games played across all attendees.
  - Incorporates late arrival handicaps (`adjustedGames`).
  - Compensates paused players during their break.
  - Respects player-specific court restrictions (`eligibleCourtIds`).
  - Enforces minimum rest periods by penalizing players who just completed a match.
  - Minimizes partner repeats and opponent repeats.
  - Gender balancing for Mixed Doubles (ensuring exactly 1 male and 1 female per team).
- **FR-3.3 Audio Feedback System**:
  - Point Beep: 880 Hz sine wave tone on point score change.
  - Whistle Sound: Triangle oscillator frequency-swept from 2200 Hz to 2800 Hz to simulate an umpire whistle on game finish.
  - Mute/Unmute audio toggle.
- **FR-3.4 Player Bench & Controls**:
  - Player search and live stats (Games Played, Win %, Rating).
  - Pause / Resume toggle for resting or injured players.
  - Add walk-in players on the fly with automatic game count handicap adjustment.
- **FR-3.5 Fullscreen Gymnasium Court Monitor (TV Mode)**:
  - Widescreen, high-contrast display designed for gym projectors and wall TVs.
  - Massive court numbers, player names, and real-time scores visible from 30+ meters.
- **FR-3.6 Mobile QR Code Sharing**:
  - Generates an on-screen QR code pointing directly to the club session URL.
  - Enables players to track live scores and court callouts on their personal smartphones.

### Module 4: Analytics, Leaderboards & Rankings
- **FR-4.1 Doubles-Aware Ranking Model**:
  - Starting rating: 1,000 points.
  - Recalculates dynamically after every completed match using 6 core factors:
    1. *Opponent Strength (40%)*: Elo expected outcome.
    2. *Margin of Victory (20%)*: Multiplier for decisive wins (1.00x for 1-2 pts, up to 1.15x for 11+ pt blowouts).
    3. *Consistency (15%)*: Standard deviation of point differential over past 30 games.
    4. *Recent Form (10%)*: Win rate across last 5 matches.
    5. *Partner Balance Adjustment (10%)*: Asymmetric rating delta rewarding underdog partners.
    6. *Activity Status (5%)*: Automatic inactive status and rating decay after 28 days of absence.
- **FR-4.2 Team Pair Ranking & Synergy Analysis**:
  - Evaluates all unique doubles partnerships.
  - Top Performing Pairs Podium (#1 Gold, #2 Silver, #3 Bronze).
  - Tracks Matches Played, Won, Lost, Win %, Point Diff, Synergy Score, and Recent Form.
  - Expandable game history row displaying all historical matches played together, opponents faced, dates, and final scores.
- **FR-4.3 Leaderboards**:
  - *Session Leaderboard*: Standings for a specific session date.
  - *Lifetime Leaderboard*: Cumulative club standings across all sessions.
- **FR-4.4 Member Performance Trajectory Modal**:
  - Modal displaying a member's rating curve, match history, win rates by game type, and partner synergies.
- **FR-4.5 PDF Scorecard Export**:
  - Generates branded PDF documents containing session summary, match logs, and leaderboard standings via `jspdf` and `jspdf-autotable`.

---

## 5. Non-Functional Requirements

| Category | Requirement | Verification Method |
|---|---|---|
| **Performance** | Page initial load < 1.5s; match allocation < 50ms | Chrome Lighthouse / Performance Profiler |
| **Real-time Latency** | Match score update propagates to all clients in < 300ms | Firebase RTDB WebSocket benchmarks |
| **Offline Resilience** | Full local storage state caching for session continuity if internet drops | LocalStorage Tier 1 cache verification |
| **Accessibility** | All text meets WCAG AA contrast ratio (≥ 4.5:1 for body text, ≥ 3.0:1 for large text) | Chrome Accessibility Audit / WebAIM |
| **Cross-Platform** | Fully responsive across mobile (375px+), tablet (768px+), and desktop (1280px+) | Viewport testing & device emulation |
| **Data Integrity** | Zero data loss on accidental browser reload or tab closure | LocalStorage state backup hook |
| **Audio Compliance** | Web Audio API gracefully handles browser autoplay restriction policies | AudioContext lazy initialization |

---

## 6. Data Architecture & Entity Schemas

```
ClubEntity (1)
  ├── PlayerEntity (N)
  ├── CourtMasterEntity (N)
  ├── SessionManagerEntity (N)
  ├── WeeklySessionEntity (N)
  │     ├── WeeklySessionCourtEntity (N)
  │     └── WeeklySessionMemberEntity (N)
  └── SessionEntity (N)
        ├── CourtEntity (N)
        ├── SessionPlayerJoinEntity (N)
        └── MatchEntity (N)
```

### Entity Definitions
1. **ClubEntity**: `id`, `name`, `venue`, `defaultSessionType`, `themeColorHex`, `targetScore`, `contactPerson`, `description`, `createdAt`.
2. **PlayerEntity**: `id`, `name`, `gender` ('MALE' | 'FEMALE'), `isPAYG`, `createdAt`.
3. **SessionManagerEntity**: `id`, `name`, `email`, `inviteStatus`, `createdAt`.
4. **WeeklySessionEntity**: `id`, `name`, `dayOfWeek`, `time`, `type`, `managerId`, `managerName`, `manager2Id`, `manager2Name`, `targetScore`, `createdAt`.
5. **SessionEntity**: `id`, `name`, `type`, `status` ('Setting Up' | 'Active' | 'End'), `isActive`, `startTime`, `endTime`, `weeklySessionId`, `managerId`, `manager2Id`.
6. **SessionPlayerJoinEntity**: `sessionId`, `playerId`, `isPaused`, `eligibleCourtIds`, `isPAYG`, `adjustedGames`, `pausedAtMatchCount`.
7. **MatchEntity**: `id`, `sessionId`, `courtId`, `matchNumber`, `teamAPlayer1Id`, `teamAPlayer2Id`, `teamBPlayer1Id`, `teamBPlayer2Id`, `teamAScore`, `teamBScore`, `winnerTeam`, `startTime`, `endTime`.

---

## 7. Compliance & Sign-Off Checklist

- [x] Session Managers restricted from adding/deleting session managers.
- [x] Complete light mode color scheme implemented per specification table.
- [x] 10% grey `#e6e8ec` tiles with Black and Dark Grey high-contrast text implemented for Team Pair Ranking & Session History.
- [x] Session Manager user lifecycle with persistent UID registry and duplicate creation prevention.
- [x] Strict multi-tenant data isolation, synchronous state flushing, and zero cross-club leakage.
- [x] New club blank-state initialization with no fallback or unsolicited sample data.
- [x] Real-time Firebase synchronization with green/red connectivity indicator.
- [x] Doubles-Aware Ranking Model and Fair Match Allocation operational.
- [x] PDF export and Web Audio synthesizer functioning without external assets.
- [x] Dark mode visual aesthetics preserved and verified.
