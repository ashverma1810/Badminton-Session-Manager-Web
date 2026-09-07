# 🏸 Badminton Club & Session Manager

An offline-first Android application designed for badminton clubs, organizers, and session managers. The app automates fair player rotations across courts, tracks live match scores, manages master player rosters, configures weekly recurring sessions, provisions session manager accounts, and seamlessly synchronizes data with Firebase Realtime Database and Cloud Firestore.

---

## 🌟 Key Features

### 1. 🏢 Club & Member Management
- **Club Profiling**: Configure club identity (name, venue, default game format, target winning scores, contact person, and custom Material 3 theme palette).
- **Master Player Roster**: Manage members with attributes such as skill level (Beginner, Intermediate, Advanced), gender, membership tier (Member, Guest, Visitor / PAYG), contact details, and prepaid/due balances.
- **Master Court Inventory**: Define and toggle availability for venue courts.
- **Session Managers Delegation**: Provision and manage secondary session managers with email invitations and granular role permissions.

### 2. 📅 Weekly Recurring Schedule & Ad-hoc Sessions
- **Weekly Schedule Templates**: Define recurring weekly sessions with predefined day-of-week slots, start/end times, default courts, fee structures (`memberFee` vs `guestFee`), and assigned session managers.
- **Instant Session Generation**: Generate an active, configured session directly from a weekly template with a single click.
- **Ad-hoc Sessions**: Create custom one-off sessions on demand.

### 3. ⚖️ Fair Play Court Rotation & Scoring Engine
- **Balanced Queuing Algorithm**: Automatically queues and rotates players into matches based on wait times, matches completed, and skill balance.
- **Late Arrival & Pause Adjustments**: Mathematically balances games for late-arriving or temporarily paused players so courts are not monopolized:
  - **Late Arrival**: Initial adjusted games equal to average matches played per court prior to joining.
  - **Paused Players**: Adjusted games awarded based on match rounds completed while resting.
- **Standard Badminton Rules**: Enforces target scores (11 to 30) with deuce rules (2-point lead required) capped at 30 points.
- **Live Match Runner**: Real-time score counting, court status badges (Available, In Use, Disabled), and instant match completion.

### 4. 💰 Attendance & Financial Settlement
- **Session Check-In**: Mark members as checked-in, paused, or checked-out.
- **Fee Settlement**: Auto-calculates fees based on membership status, tracking cash/online collections, outstanding balances, and total session revenue.

### 5. ☁️ Multi-Tenant Cloud Sync & Global User Index
- **Offline-First Architecture**: Instant local updates via Room Database with background bidirectional synchronization.
- **Global User-to-Club Index (`/user_club_index`)**: Session managers and club owners are mapped by sanitized email to their respective club IDs, enabling seamless logins across multiple devices.
- **Multi-Club Discovery**: If an account is associated with multiple clubs, an intuitive Material 3 selection modal presents available clubs and user roles (**Club Manager** vs **Session Manager**).
- **Clean Account Provisioning & Deletion**: Fully synchronized lifecycle across local Room DB, Firebase Realtime Database, Cloud Firestore, and Firebase Authentication.

---

## 📱 Navigation Structure

The application provides a 5-tab Material 3 navigation experience (with adaptive Navigation Rail on tablets and foldables):

1. **🏸 Sessions (Live Hub)**: View active sessions, monitor live courts, update scores, and run fair play rotations.
2. **📅 Schedule**: View recurring weekly templates and schedule upcoming ad-hoc sessions.
3. **👥 Members**: Searchable member directory, skill ratings, attendance records, and account balances.
4. **🏟️ Courts**: Manage venue court setups and operational availability.
5. **⚙️ Club Management**: Club settings, theme selection, session manager delegation, and cloud sync controls.

---

## 🛠️ Technology Stack

- **Language**: 100% Kotlin
- **UI Framework**: Jetpack Compose with Material Design 3 (M3)
- **Architecture**: MVVM (Model-View-ViewModel) + Repository Pattern + Kotlin StateFlows & Coroutines
- **Local Persistence**: Android Room Database (`badminton_database`)
- **Cloud Infrastructure**:
  - **Firebase Authentication**: User identity & multi-account provisioning
  - **Firebase Realtime Database**: Global user indexing (`/user_club_index`) & high-performance club state synchronization
  - **Cloud Firestore**: Multi-tenant document mirroring & backup
- **Testing**: JUnit, Robolectric local JVM testing, and Roborazzi screenshot verification

---

## 🚀 Getting Started

### Prerequisites
- Android Studio Ladybug | 2024.2.1 or newer
- JDK 17 or higher
- Android SDK 34 (Android 14) or higher

### Building and Running
1. Clone the repository:
   ```bash
   git clone <repository_url>
   ```
2. Open the project in Android Studio.
3. Add your `google-services.json` to the `app/` directory (or use pre-configured AI Studio Firebase settings).
4. Build and run the app on an Android device or emulator:
   ```bash
   ./gradlew installDebug
   ```

### Running Tests
- **Unit & Robolectric Tests**:
  ```bash
  ./gradlew :app:testDebugUnitTest
  ```
- **Screenshot Verification (Roborazzi)**:
  ```bash
  ./gradlew :app:verifyRoborazziDebug
  ```

---

## 📄 License & Documentation
For full architectural details, consult `TECHNICAL_ARCHITECTURE.md`. For comprehensive functional requirements, data models, and business logic, see `REQUIREMENTS_AND_SPECIFICATION.md`.
