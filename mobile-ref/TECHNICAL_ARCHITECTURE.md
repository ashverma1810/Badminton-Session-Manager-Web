# 🏗️ Technical Architecture & System Design
## Badminton Club & Session Management System

---

## 1. Architectural Overview

The application follows modern Android development practices using **Clean Architecture** and **MVVM (Model-View-ViewModel)** with an **Offline-First Hybrid Persistence Model**.

```text
┌───────────────────────────────────────────────────────────────────┐
│                           UI Layer                                │
│  Jetpack Compose Screens & Components (Material Design 3 - M3)   │
│  SetupScreen | SessionRunnerScreen | ClubManagementScreen | etc.  │
└─────────────────────────────────▲─────────────────────────────────┘
                                  │ Observes StateFlow / Dispatches Intents
┌─────────────────────────────────▼─────────────────────────────────┐
│                        ViewModel Layer                            │
│                      BadmintonViewModel                           │
│   • Manages UI state, court queues, and user session flow        │
│   • Handles async coroutines with viewModelScope                 │
└─────────────────────────────────▲─────────────────────────────────┘
                                  │ Calls Use Cases / Repository API
┌─────────────────────────────────▼─────────────────────────────────┐
│                       Repository Layer                            │
│                     BadmintonRepository                           │
│   • Single source of truth mediator                               │
│   • Orchestrates Room Local DB & Cloud Sync Services             │
│   ├── FirebaseAuthRepository                                      │
│   ├── RealtimeDatabaseRepository                                  │
│   └── FirestoreRepository                                         │
└───────────────────▲─────────────────────────────▲─────────────────┘
                    │ Reads / Writes (Room)       │ Syncs / Queries (Firebase)
┌───────────────────▼──────────────┐   ┌──────────▼─────────────────┐
│        Local Data Layer          │   │      Cloud Data Layer      │
│      Room SQLite Database        │   │  Firebase RTDB & Firestore │
│   • Club, Players, Courts        │   │  • /user_club_index        │
│   • Sessions, Matches, Join Tbl  │   │  • /clubs/{clubId}/...     │
│   • Session Managers             │   │  • Multi-tenant Isolation  │
└──────────────────────────────────┘   └────────────────────────────┘
```

---

## 2. Layers & Component Breakdown

### 2.1 UI Layer (Jetpack Compose)
- **Declarative UI**: Built entirely with Jetpack Compose and Material 3 components (`Scaffold`, `LazyColumn`, `Card`, `ModalBottomSheet`, `AlertDialog`, `TopAppBar`).
- **State Collection**: UI consumes state via `collectAsStateWithLifecycle()` or `collectAsState()` on `StateFlow` primitives.
- **Adaptive Layouts**: Adapts seamlessly between handheld compact views and expanded screen formats (foldables/tablets) via responsive column arrangements and navigation rails.

### 2.2 ViewModel Layer (`BadmintonViewModel`)
- **Lifecycle Awareness**: Scoped to the activity/navigation lifecycle using `viewModelScope`.
- **Reactive State Flow**: Exposes immutable `StateFlow` streams for all master entities (`allMasterPlayers`, `allMasterCourts`, `allWeeklySessions`, `allSessionManagers`, `clubDetails`, `availableClubsForLogin`).
- **Encapsulated Business Operations**: Executes fair play match creation, score submissions, manager provisioning, and sync coordination asynchronously.

### 2.3 Repository Layer (`BadmintonRepository`)
- **Single Source of Truth**: The local Room Database is immediately updated for zero-latency UI responses.
- **Cloud Coordination**: Synchronizes changes across Firebase Authentication, Firebase Realtime Database, and Cloud Firestore.
- **Error Handling & Isolation**: Network and cloud operations fail gracefully without interrupting local offline operations.

---

## 3. Data Persistence Architecture

### 3.1 Local Room Database (`badminton_database`)

#### Core Tables & Entities
1. **`club_details` (`ClubEntity`)**: Active club configuration, venue, default match type, target score, and theme color.
2. **`players` (`PlayerEntity`)**: Master player pool (name, gender, skill level, membership status, balance).
3. **`court_master` (`CourtMasterEntity`)**: Venue courts and operational availability.
4. **`session_managers` (`SessionManagerEntity`)**: Secondary managers with email, name, and invite status.
5. **`weekly_sessions` (`WeeklySessionEntity`)**: Recurring weekly schedule templates.
6. **`sessions` (`SessionEntity`)**: Active and historical session instances.
7. **`session_players` (`SessionPlayerJoinEntity`)**: Join table tracking check-in status, games played, games waiting, adjusted games, pause checkpoints, and fee payments.
8. **`session_courts` (`SessionCourtEntity`)**: Courts assigned to a specific session.
9. **`matches` (`MatchEntity`)**: Match records containing player IDs, live scores, completion status, and winning score thresholds.

#### Data Access Objects (`Daos.kt`)
- All database queries return Kotlin `Flow<List<T>>` for real-time reactivity.
- Coroutine-based `suspend` functions for transactional inserts, updates, and cascading deletions.

---

## 4. Cloud Synchronization & Multi-Tenancy Design

### 4.1 Global User-to-Club Discovery Index
To ensure Session Managers and multi-club organizers can log in on any device without losing their club mapping, a global cloud index is maintained at the root of the Firebase Realtime Database:

```text
/user_club_index/{sanitized_email}/{clubId}
```

#### Email Sanitization Algorithm
```kotlin
fun sanitizeEmailKey(email: String): String {
    return email.lowercase().trim()
        .replace(".", "_")
        .replace("@", "_at_")
        .replace("[^a-z0-9_]".toRegex(), "_")
}
```

#### Discovery & Routing Flow on Login
1. **Authenticate**: User signs in with Firebase Auth.
2. **Lookup**: Query `/user_club_index/{sanitized_email}` in Firebase Realtime Database.
3. **Handle Results**:
   - **1 Association**: Automatically fetch and restore club snapshot into Room DB.
   - **>1 Associations**: Open `availableClubsForLogin` multi-club picker dialog in Compose UI.
   - **0 Associations (Legacy Fallback)**: Scan database or prompt the user if no club exists.

```text
[User Logs In] ──► [Query /user_club_index/{email}]
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          [1 Club]     [>1 Clubs]    [0 Clubs]
             │             │             │
             ▼             ▼             ▼
       [Auto-Restore] [Show Modal]  [Prompt New Club]
             │             │
             └──────►──────┴────────► [Enter App Dashboard]
```

### 4.2 Cloud Realtime Database Schema Hierarchy

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
│           ├── venue: String
│           └── updatedAt: Long
│
└── clubs/
    └── {clubId}/
        ├── details/
        ├── players/
        ├── courts/
        ├── session_managers/
        ├── weekly_sessions/
        └── sessions/
            └── session_{id}/
                ├── session_players/
                ├── courts/
                └── matches/
```

### 4.3 Session Manager Deletion & Revocation Lifecycle
When a manager is deleted:
1. **Local Room DB**: Immediate deletion of record and disassociation from `weekly_sessions` and `sessions` (`managerId = NULL`).
2. **Cloud Index & Nodes**: Prunes `/clubs/{clubId}/session_managers/manager_{id}` and `/user_club_index/{sanitized_email}/{clubId}`.
3. **Firebase Auth**: Deletes the secondary auth session and revokes credentials.

---

## 5. Algorithms & Mathematical Models

### 5.1 Fair Play Queue & Court Allocation Algorithm
When a court becomes available, player selection priority is computed dynamically:

$$\text{Priority} = (\text{Games Waiting} \times 2.0) - (\text{Effective Total Games} \times 1.5)$$

Where:
$$\text{Effective Total Games} = \text{Actual Games Played} + \text{Adjusted Games}$$

- Players with the highest priority score are allocated first.
- If match format is Doubles, players are paired to balance aggregate skill ratings (`ADVANCED = 3`, `INTERMEDIATE = 2`, `BEGINNER = 1`).

### 5.2 Late Arrival Game Adjustment
To prevent latecomers from having an unfair game count advantage:

$$\text{Adjusted Games}_{\text{late}} = \text{round}\left(\frac{\text{Total Matches Played Before Arrival}}{\text{Active Court Count}}\right)$$

### 5.3 Paused Player Rest Adjustment
When a player unpauses:

$$\text{Adjusted Games}_{\text{pause}} = \text{round}\left(\frac{\text{Matches Played During Pause}}{\text{Active Court Count}}\right)$$

### 5.4 Badminton Winning Score Calculation
Enforces standard international deuce and sudden-death rules:

```kotlin
fun calculateWinningScore(leadingScore: Int, targetScore: Int = 21): Int {
    if (leadingScore < targetScore) return targetScore
    // 2-point lead required after reaching targetScore, capped at 30
    return minOf(leadingScore + (if (leadingScore % 2 == 0) 1 else 2), 30)
}
```

---

## 6. Security, Testing & Verification

### 6.1 Security & Access Isolation
- **Tenant Scoping**: All cloud operations strictly require a valid `clubId`.
- **Credential Storage**: Sensitive API keys and Firebase configurations are injected via Android `BuildConfig` and `.env` properties.
- **Secondary App Instances**: Secondary manager creation uses an isolated `FirebaseApp` instance to avoid overriding the logged-in administrator's primary session.

### 6.2 Testing Strategy
- **Unit Testing**: JUnit tests verifying algorithms (`calculateWinningScore`, `sanitizeEmailKey`, priority calculations).
- **Robolectric Local Testing**: Fast JVM-based testing of ViewModels, DAOs, and UI interactions without requiring physical devices.
- **Roborazzi Screenshot Tests**: Visual regression verification of critical Composables.
