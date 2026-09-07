# Badminton Session Manager - Requirements & System Specification

## 1. System Overview & Architecture Principles

### 1.1 Core Purpose
**Badminton Session Manager** is an Android application designed to streamline the organization of badminton clubs, automate fair player rotation across courts, track live match scores, manage session managers and member fees, and generate detailed performance analytics and leaderboards.

The system ensures **fair play allocation** among all participants—accounting for variable court counts, late arrivals, temporary player pauses during a session, and player rest intervals.

### 1.2 User Roles & Access Control Matrix

| Feature / Action | Club Manager (Owner) | Session Manager | Guest / Player |
| :--- | :---: | :---: | :---: |
| Register / Create New Club | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| Edit Club Name, Theme, Billing Defaults | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| Delete Club / Reset Club Database | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| Add / Delete / Provision Session Managers | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| Create / Edit Master Players & Members | ✅ Full Access | ✅ Full Access | ❌ Forbidden |
| Create / Edit Master Courts | ✅ Full Access | ✅ Full Access | ❌ Forbidden |
| Create / Schedule Weekly Recurring Sessions | ✅ Full Access | ✅ Full Access | ❌ Forbidden |
| Create / Run / Score Live Matches in Sessions | ✅ Full Access | ✅ Assigned Sessions (or all) | 👁️ View Only |
| Record Player Attendance & Fees | ✅ Full Access | ✅ Full Access | ❌ Forbidden |
| Trigger Cloud Sync (Backup & Restore) | ✅ Full Access | ✅ Full Access | ❌ Forbidden |

---

## 2. Core Functional Requirements

### 2.1 Club & Master Data Management
* **Club Profiling**: Club name, venue, default session type (`DOUBLES` or `SINGLES`), target winning score, contact details, description, and UI theme color palette.
* **Master Member / Player Roster**:
  * Player profile: Name, gender (`MALE`, `FEMALE`, `OTHER`), skill level (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`), membership type (`MEMBER`, `GUEST`, `VISITOR` / `PAYG`), phone number, email address, and financial account balance.
  * Search, filtering, and direct balance adjustments.
* **Master Court Management**:
  * Court number, court label/name, and operational availability toggle.
* **Session Manager Roster**:
  * Manager name, email, status (`ACTIVE`, `PENDING`, `INVITED`), and creation timestamp.
  * Role-based access control and credential management.

---

### 2.2 Weekly Recurring Schedule & Session Lifecycle

#### 2.2.1 Weekly Session Templates
* Support recurring weekly sessions defined by:
  * Day of week (`MONDAY` through `SUNDAY`)
  * Start time and end time (24-hour format `HH:mm`)
  * Session game type (`DOUBLES` / `SINGLES`)
  * Default fees (`memberFee` and `guestFee` / `PAYG`)
  * Target score (default 21)
  * Default assigned courts (comma-separated court ID list)
  * Assigned Session Managers (primary `managerId`/`managerName` and secondary `manager2Id`/`manager2Name`)
  * Active status toggle
* **One-Click Session Generation**: Ability to instantiate an active session directly from a weekly template.

#### 2.2.2 Session Lifecycle States
* `Setting Up`: Initial setup phase before matches begin; court assignments, fee adjustments, and player check-in.
* `Active` / `IN_PROGRESS`: Live session in progress; automated court match generation, scoreboard tracking, and queue management enabled.
* `End` / `COMPLETED`: Finalized session with financial settlements and historical record retention.

#### 2.2.3 Attendance, Check-In & Financial Tracking
* Player attendance check-in / check-out per session.
* Session fee assignment based on membership tier (`memberFee` for Members, `guestFee` for Guests/Visitors/PAYG).
* Payment tracking: Mark fee as paid, amount collected, payment method (Cash vs Online), and outstanding balance calculations.

---

### 2.3 Fair Match Allocation Algorithm & Queue Engine

#### 2.3.1 Court Match Generation
When a court becomes free or a new match is generated:
1. Identify all eligible and non-busy players for that court.
2. Filter out paused players (`isPaused == true`).
3. Sort candidate players by dynamic priority weighting:
   $$\text{Priority} = (\text{Games Waiting} \times 2.0) - (\text{Effective Total Games} \times 1.5)$$
   where $\text{Effective Total Games} = \text{Actual Games Played} + \text{Adjusted Games}$.
4. Factor in rest periods (last match number played) to avoid consecutive back-to-back plays when possible.
5. Form balanced pairs for Singles or Doubles matches, balancing combined skill ratings where applicable (`ADVANCED = 3`, `INTERMEDIATE = 2`, `BEGINNER = 1`).

#### 2.3.2 Late Arrival Game Adjustment
* When a player joins an ongoing session late, they receive an initial `adjustedGames` count equal to the average number of matches played per court prior to their join time:
  $$\text{Adjusted Games} = \text{round}\left(\frac{\text{Total Matches Played}}{\text{Active Court Count}}\right)$$
* This prevents late arrivals from monopolizing court availability due to having 0 actual games.

#### 2.3.3 Paused Player Game Adjustment
* **Pause Trigger**: Players can be paused at the start of a session, during a session, or towards the end.
* **Pause Recording**: When a player is paused, the system records the match checkpoint (`pausedAtMatchCount`).
* **Dynamic Average Calculation**: During the period a player is paused:
  $$\text{Pause Adjustment} = \text{round}\left(\frac{\max(0, \text{Total Matches} - \text{Paused At Match Count})}{\text{Court Count}}\right)$$
* **Unpause Checkpoint**: When a player is unpaused, `Pause Adjustment` is added into `adjustedGames`, and `pausedAtMatchCount` is cleared.
* **Allocation Weighting**: While paused (and after unpausing), the player's total game count for allocation priority considers $\text{Actual Games} + \text{Effective Adjusted Games}$. This ensures players returning from a pause are not unfairly prioritized for consecutive games simply because of a lower actual game count.

---

### 2.4 Scoring Rules & Match Execution
* **Target Score**: Default 21 points (configurable between 11 and 30).
* **Winning Score Calculation (Deuce / Sudden Death Rules)**:
  ```kotlin
  fun calculateWinningScore(leadingScore: Int, targetScore: Int = 21): Int {
      if (leadingScore < targetScore) return targetScore
      // Must win by 2 clear points once reaching targetScore, capped at 30
      return minOf(leadingScore + (if (leadingScore % 2 == 0) 1 else 2), 30)
  }
  ```
* **Match Completion**: A match completes when a side reaches the calculated winning score. Scores and match duration are recorded, and winning/losing players are rotated back into the waiting queue (`gamesPlayed += 1`, `gamesWaiting = 0`).

---

### 2.5 Statistics & Display Specifications

#### 2.5.1 Display Format
* **Actual & Adjusted Games Display**: In all player listings, leaderboards, and session views:
  * If $\text{Adjusted Games} > 0$: Display as `Actual (Adjusted)`, e.g., **Ashish: 8 (2)** (8 actual games played, 2 adjusted games due to pause/late arrival).
  * If $\text{Adjusted Games} == 0$: Display as `Actual`, e.g., **Pravat: 10** (10 actual games played, 0 adjusted).

#### 2.5.2 Leaderboard Metrics
* **Games Played**: Actual matches completed.
* **Adjusted Games**: Assumed games added due to late arrival or pause periods.
* **Win Count / Loss Count**: Total matches won/lost.
* **Win Rate**: $\frac{\text{Games Won}}{\text{Games Played}} \times 100\%$.
* **Points Differential**: $\text{Points Scored} - \text{Points Conceded}$.

---

## 3. Authentication, Cloud Indexing & Multi-Club Discovery

### 3.1 Global User-to-Club Index (`/user_club_index`)
To allow Session Managers to log in on any device without being erroneously routed to a "Register New Club" screen, the system maintains a global cloud index in Firebase Realtime Database.

* **Index Path**: `/user_club_index/{sanitized_email}/{clubId}`
* **Sanitization Rule**:
  `sanitizeEmailKey(email) = email.lowercase().trim().replace(".", "_").replace("@", "_at_").replace("[^a-z0-9_]".toRegex(), "_")`
* **Index Data Schema**:
  ```json
  {
    "email": "ashish.verma.uk@gmail.com",
    "clubId": "club_abcdef123456",
    "clubName": "Springfield Badminton Club",
    "role": "CLUB_MANAGER",
    "managerId": null,
    "managerName": null,
    "ownerUid": "firebase_auth_uid",
    "venue": "Springfield Sports Centre, Court 1-4",
    "updatedAt": 1740570000000
  }
  ```

### 3.2 Session Manager Provisioning & Deletion Workflows

#### 3.2.1 Provisioning Workflow
1. Club Manager adds a Session Manager with Name and Email.
2. System provisions a secondary Firebase Auth user profile (or updates existing).
3. System indexes the manager under `/user_club_index/{sanitized_email}/{clubId}` with `role = "SESSION_MANAGER"`.
4. Stored in the local database and club's `/clubs/{clubId}/session_managers/manager_{id}` node.

#### 3.2.2 Deletion & Revocation Workflow
1. **Immediate Local Removal**: Instantly deletes the manager from Room database (`id` and `email`), immediately updating UI tabs and manager count badges.
2. **Cascade Disassociation**: Clears any active assignments (`managerId = NULL`, `manager2Id = NULL`) across `weekly_sessions` and `sessions`.
3. **Cloud Node & Index Pruning**: Deletes `/clubs/{clubId}/session_managers/manager_{id}` and `/user_club_index/{sanitized_email}/{clubId}`.
4. **Auth Credential Revocation**: Purges the secondary Firebase Authentication user account and session.

### 3.3 Post-Login Discovery Workflow
* **Login Flow**:
  1. User authenticates via email & password (`signInWithEmail`).
  2. System queries `/user_club_index/{sanitized_email}`.
  3. **Outcome Routing**:
     * **1 Club Found**: Automatically downloads and restores club data into local Room database; navigates directly into the Club Dashboard with assigned role capabilities.
     * **>1 Clubs Found**: Opens the **Multi-Club Selection Dialog** listing all associated clubs with name, venue, and role badges (**Club Manager** vs **Session Manager**). Selecting a club downloads and restores that club's data.
     * **0 Clubs Found**: If local data exists on the device, it retains and syncs the existing club; if no local data exists, it presents a clear prompt stating no club was found with an option to register a new club.

---

## 4. Database Schemas & Data Models

### 4.1 Local Room Database (`badminton_database`)

#### 1. `ClubEntity` (`club_details`)
* `id`: Int = 1 (Primary Key, active club record)
* `name`: String
* `venue`: String
* `defaultSessionType`: String (`"DOUBLES"` / `"SINGLES"`)
* `themeColorHex`: String (Default `#0284C7`)
* `targetScore`: Int (Default `21`)
* `contactPerson`: String
* `description`: String

#### 2. `PlayerEntity` (`players`)
* `id`: Int (Auto-generate Primary Key)
* `name`: String
* `gender`: String (`"MALE"`, `"FEMALE"`, `"OTHER"`)
* `skillLevel`: String (`"BEGINNER"`, `"INTERMEDIATE"`, `"ADVANCED"`)
* `membershipType`: String (`"MEMBER"`, `"GUEST"`, `"VISITOR"`)
* `phoneNumber`: String
* `email`: String
* `balance`: Double (Default `0.0`)
* `isActive`: Boolean (Default `true`)

#### 3. `CourtMasterEntity` (`court_master`)
* `id`: Int (Auto-generate Primary Key)
* `courtNumber`: Int
* `courtName`: String
* `isAvailable`: Boolean (Default `true`)

#### 4. `SessionManagerEntity` (`session_managers`)
* `id`: Int (Auto-generate Primary Key)
* `name`: String
* `email`: String
* `inviteStatus`: String (`"ACTIVE"`, `"PENDING"`, `"INVITED"`)
* `createdAt`: Long

#### 5. `WeeklySessionEntity` (`weekly_sessions`)
* `id`: Int (Auto-generate Primary Key)
* `dayOfWeek`: String (`"MONDAY"` .. `"SUNDAY"`)
* `startTime`: String (`"HH:mm"`)
* `endTime`: String (`"HH:mm"`)
* `sessionType`: String (`"DOUBLES"` / `"SINGLES"`)
* `memberFee`: Double
* `guestFee`: Double
* `targetScore`: Int
* `defaultCourtIds`: String (Comma-separated IDs)
* `managerId`: Int?
* `managerName`: String?
* `manager2Id`: Int?
* `manager2Name`: String?
* `isActive`: Boolean

#### 6. `SessionEntity` (`sessions`)
* `id`: Int (Auto-generate Primary Key)
* `name`: String
* `date`: Long
* `startTime`: String
* `endTime`: String
* `type`: String (`"DOUBLES"` / `"SINGLES"`)
* `status`: String (`"Setting Up"`, `"Active"` / `"IN_PROGRESS"`, `"End"` / `"COMPLETED"`)
* `targetScore`: Int
* `memberFee`: Double
* `guestFee`: Double
* `managerId`: Int?
* `managerName`: String?
* `manager2Id`: Int?
* `manager2Name`: String?
* `weeklySessionId`: Int?

#### 7. `SessionPlayerJoinEntity` (`session_players`)
* `id`: Int (Auto-generate Primary Key)
* `sessionId`: Int
* `playerId`: Int
* `isCheckedIn`: Boolean
* `isPaused`: Boolean
* `eligibleCourtIds`: String? (Comma-separated court IDs or null for ALL)
* `isPAYG`: Boolean
* `gamesPlayed`: Int
* `gamesWaiting`: Int
* `adjustedGames`: Int
* `pausedAtMatchCount`: Int?
* `feePaid`: Boolean
* `amountPaid`: Double
* `paidOnline`: Boolean

#### 8. `SessionCourtEntity` (`session_courts` / `courts`)
* `id`: Int (Auto-generate Primary Key)
* `sessionId`: Int
* `courtNumber`: Int
* `courtName`: String
* `status`: String (`"AVAILABLE"`, `"IN_USE"`, `"DISABLED"`)
* `currentMatchId`: Int?

#### 9. `MatchEntity` (`matches`)
* `id`: Int (Auto-generate Primary Key)
* `sessionId`: Int
* `courtId`: Int
* `matchNumber`: Int
* `team1Player1Id`: Int
* `team1Player2Id`: Int?
* `team2Player1Id`: Int
* `team2Player2Id`: Int?
* `team1Score`: Int
* `team2Score`: Int
* `isCompleted`: Boolean
* `startTime`: Long
* `endTime`: Long?
* `winningScore`: Int

---

### 4.2 Cloud Realtime Database & Multi-Tenant Firestore Schema Hierarchy

```text
/
├── user_club_index/
│   └── {sanitized_email}/
│       └── {clubId}/
│           ├── email: String
│           ├── clubId: String
│           ├── clubName: String
│           ├── role: "CLUB_MANAGER" | "SESSION_MANAGER"
│           ├── managerId: Int?
│           ├── managerName: String?
│           ├── ownerUid: String?
│           ├── venue: String
│           └── updatedAt: Long
│
└── clubs/
    └── {clubId}/
        ├── details/
        │   ├── name: String
        │   ├── venue: String
        │   ├── defaultSessionType: String
        │   ├── themeColorHex: String
        │   ├── targetScore: Int
        │   ├── contactPerson: String
        │   └── description: String
        │
        ├── members/ (or /players/)
        │   └── player_{id}/
        │       ├── id: Int
        │       ├── name: String
        │       ├── gender: String
        │       ├── skillLevel: String
        │       ├── membershipType: String
        │       ├── isPAYG: Boolean
        │       ├── phoneNumber: String
        │       ├── email: String
        │       └── balance: Double
        │
        ├── courts/ (or /court_master/)
        │   └── court_{id}/
        │       ├── id: Int
        │       ├── courtNumber: Int
        │       ├── courtName: String
        │       └── isAvailable: Boolean
        │
        ├── session_managers/
        │   └── manager_{id}/
        │       ├── id: Int
        │       ├── name: String
        │       ├── email: String
        │       ├── inviteStatus: String
        │       └── createdAt: Long
        │
        ├── weekly_sessions/
        │   └── weekly_{id}/
        │       ├── id: Int
        │       ├── dayOfWeek: String
        │       ├── startTime: String
        │       ├── endTime: String
        │       ├── sessionType: String
        │       ├── memberFee: Double
        │       ├── guestFee: Double
        │       ├── targetScore: Int
        │       ├── defaultCourtIds: String
        │       ├── managerId: Int?
        │       ├── managerName: String?
        │       ├── manager2Id: Int?
        │       ├── manager2Name: String?
        │       └── isActive: Boolean
        │
        └── sessions/
            └── session_{id}/
                ├── id: Int
                ├── name: String
                ├── date: Long
                ├── startTime: String
                ├── endTime: String
                ├── type: String
                ├── status: String
                ├── targetScore: Int
                ├── memberFee: Double
                ├── guestFee: Double
                ├── managerId: Int?
                ├── managerName: String?
                ├── manager2Id: Int?
                ├── manager2Name: String?
                ├── weeklySessionId: Int?
                │
                ├── session_players/
                │   └── player_{id}/
                │       ├── playerId: Int
                │       ├── isCheckedIn: Boolean
                │       ├── isPaused: Boolean
                │       ├── eligibleCourtIds: String?
                │       ├── isPAYG: Boolean
                │       ├── gamesPlayed: Int
                │       ├── gamesWaiting: Int
                │       ├── adjustedGames: Int
                │       ├── pausedAtMatchCount: Int?
                │       ├── feePaid: Boolean
                │       ├── amountPaid: Double
                │       └── paidOnline: Boolean
                │
                ├── courts/
                │   └── court_{id}/
                │       ├── id: Int
                │       ├── courtNumber: Int
                │       ├── courtName: String
                │       ├── status: String
                │       └── currentMatchId: Int?
                │
                └── matches/
                    └── match_{id}/
                        ├── id: Int
                        ├── matchNumber: Int
                        ├── courtId: Int
                        ├── team1Player1Id: Int
                        ├── team1Player2Id: Int?
                        ├── team2Player1Id: Int
                        ├── team2Player2Id: Int?
                        ├── team1Score: Int
                        ├── team2Score: Int
                        ├── isCompleted: Boolean
                        ├── startTime: Long
                        ├── endTime: Long?
                        └── winningScore: Int
```

---

## 5. UI/UX Architecture & Layout Specifications

### 5.1 Primary Navigation Hierarchy
The app uses a 5-tab Material 3 Navigation Bar (or Navigation Rail on Tablets / Expanded screens):

1. **🏸 Sessions (Live Hub)**:
   - Today's active sessions, live court board, quick match creator, court allocation carousel.
2. **📅 Schedule (Weekly / Ad-hoc)**:
   - Calendar & weekly timetable view, recurring session generator, manager assignment tags.
3. **👥 Members**:
   - Searchable member list, skill badges, attendance logs, balance statement, Add/Edit dialogs.
4. **🏟️ Courts**:
   - Court master inventory, operational status toggles, maintenance indicators.
5. **⚙️ Club Management & Settings**:
   - Club profile, Theme color picker, Session Managers invitation tab, Cloud sync status, Sign out.

### 5.2 Responsive & Adaptive Layout Rules
* Mobile-first design with adaptive window size class handling (`Compact`, `Medium`, `Expanded`).
* Material 3 dynamic color scheme with primary theme color customization.
* Touch target sizing: Minimum 48dp on all interactive elements.
* Visual indicators for game adjustments `Actual (Adjusted)`, pause states, and manager role chips.

---

## 6. Technical Stack & Engineering Specifications

* **Language**: Kotlin 100%
* **UI Framework**: Jetpack Compose with Material Design 3 (M3)
* **Architecture Pattern**: MVVM with Repository Pattern, StateFlow, and Kotlin Coroutines
* **Local Persistence**: Room Database (`badminton_database`) with explicit version migrations
* **Cloud Infrastructure**:
  * **Firebase Authentication**: User accounts, secondary credential provisioning, and session state.
  * **Firebase Realtime Database**: Global indexing (`user_club_index`), fast live data sync, and multi-tenant club tree.
  * **Cloud Firestore**: Document mirroring for extended multi-tenant cloud storage.
* **Synchronization Strategy**:
  * Offline-First: Room DB serves as the immediate source of truth.
  * Atomic Cloud Push: Full club payloads and delta updates synchronized with graceful timeout handling and error recovery.
  * Secure Scope Isolation: All cloud reads/writes scoped to authenticated club tenant ID (`club_{ownerUid}` or active club ID).


