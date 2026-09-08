# 🏸 Badminton Session Manager

A modern, full-featured, real-time web application for badminton clubs, organizers, and session managers. The application streamlines member registration, court assignment, automated fair doubles/singles team allocation, live court scoring with audio feedback, and advanced performance analytics powered by a Doubles-Aware Ranking Model and Team Synergy Index.

Synchronized in real time across web and mobile using Firebase, with full offline-first multi-tier caching (LocalStorage + Firebase RTDB + Firestore).

---

## 🌟 Key Features

### 1. 🏢 Club & Member Setup
- **Club Configuration**: Venue, default game type (Doubles, Singles, Mixed, Multi-Type), target winning score (15, 21, etc.), contact person, and custom brand theme color.
- **Member Roster**: Add/edit players with gender tags, Pay-As-You-Go (PAYG) indicators, and quick CSV/bulk actions.
- **Court Master List**: Manage court inventory (e.g. Court 1, Court 2, etc.) available for weekly sessions and live play.
- **Session Manager Directory**: Invite and designate session managers with strict Role-Based Access Control (RBAC).

### 2. 📅 Weekly Sessions & Scheduling
- **Weekly Templates**: Create recurring weekly sessions with specified day of the week, start time, target score, assigned courts, and up to two designated Session Managers.
- **Member Assignment**: Assign regular members to specific weekly sessions for quick one-click live session initialization.
- **One-Click Launch**: Instantiate a live playable session directly from a weekly template with all pre-configured courts and players.

### 3. 🎯 Intelligent Live Match Session
- **Real-Time Court Monitoring**: Visual court status (Active Game, Finished, Waiting for Players) with live scoreboards.
- **Fair Match Allocation Algorithm**:
  - Automatically balances games played across all players.
  - Accommodates late arrivals and paused players with fair adjusted game counters.
  - Minimizes repeat partnerships and repeat opponents.
  - Enforces court restrictions (e.g., beginner-only or advanced-only courts).
  - Penalizes back-to-back games to allow physical rest intervals.
  - Enforces gender constraints for Mixed Doubles (1 male + 1 female per team).
- **Interactive Live Scoring**:
  - Point increment/decrement buttons for Team A and Team B.
  - Audio whistle and point beeps synthesized via the HTML5 Web Audio API (no external sound files required).
  - Undo match capabilities and immediate court reallocation upon match completion.
- **Player Bench & Controls**: Pause/resume players, toggle PAYG status, adjust game count handicaps, and filter court eligibility on the fly.
- **Fullscreen Court Monitor (TV Mode)**: Designed for gym TV displays and projectors with oversized court numbers, real-time scores, and active player names.
- **Mobile QR Code Link**: QR code modal allowing players and spectators to open the live session on their mobile devices.

### 4. 📊 Performance Analytics & Leaderboards
- **Doubles-Aware Ranking Model**:
  - Base rating starting at 1,000 points.
  - **Opponent Strength (40%)**: Elo expectation based on opponent pair strength.
  - **Winning Margin (20%)**: Multiplier scaling from 1.00x (close 1-2 pt games) to 1.15x (blowouts).
  - **Consistency (15%)**: Point differential standard deviation over past matches.
  - **Recent Form (10%)**: Momentum over the last 5 matches.
  - **Partner Rating Gap Adjustment (10%)**: Underdog partners earn greater rating gains on victory; stronger partners shoulder greater drops on defeat.
  - **Activity Status (5%)**: Automatic inactivity flag and rating decay after 4 weeks (28 days) of absence.
- **Team Pair Ranking & Synergy Analysis**:
  - Tracks pair partnerships across Men's Doubles (MD), Women's Doubles (WD), and Mixed Doubles (XD).
  - Dedicated **Top Performing Pairs Podium** (#1 Gold, #2 Silver, #3 Bronze).
  - Detailed pair metrics: Matches Played, Won, Lost, Win %, Point Differential, Synergy Score, Recent Form (W/L), and expandable head-to-head match histories.
- **Session & Lifetime Leaderboards**: Sort by rank, matches played, win rate, point differential, and current rating.
- **Member Performance Trajectory Modal**: Deep-dive trajectory modal with interactive charts, match logs, partner synergy, and PDF report export.
- **PDF Export Engine**: High-resolution, professional PDF report generation for session scorecards and lifetime standings via `jspdf` and `jspdf-autotable`.

### 5. 🎨 Design System & Accessibility
- **Dual Theme Support**: Light Mode and Dark Mode with seamless instant toggling.
- **High-Contrast 10% Grey Scheme**: Distinct `#e6e8ec` 10% grey tone for core analytical tiles with WCAG AA compliant pure black (`#000000`) and dark grey (`#1e293b`) typography.
- **Responsive Layout**: Engineered for phones, tablets, desktop workstations, and widescreen gymnasium monitors.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 19 (TypeScript) |
| **Build Tool** | Vite 6 |
| **Styling** | Tailwind CSS v4 |
| **Backend & Realtime** | Firebase Realtime Database & Firebase Authentication |
| **State & Caching** | Multi-Tier (LocalStorage Cache + RTDB + Firestore) |
| **Audio** | HTML5 Web Audio API (Synthesized oscillators) |
| **Icons** | Lucide React |
| **Document Generation** | jsPDF & jsPDF-Autotable |
| **Visual Effects** | Canvas Confetti & Motion |
| **QR Code** | qrcode |

---

## 🚀 Quick Start & Installation

### Prerequisites
- Node.js (v18.0.0 or higher recommended)
- npm or bun

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone <repository-url>
cd badminton-session-manager

# Install project dependencies
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory based on `.env.example`:
```env
# Optional Firebase configuration overrides
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```
*(Note: The application defaults to pre-configured Firebase project credentials in `firebase.ts` if environment variables are not supplied).*

### 3. Start Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000` (or `0.0.0.0:3000`).

### 4. Build for Production
```bash
npm run build
```
Generates production-ready static assets in the `dist/` directory.

### 5. Code Quality & Type Checking
```bash
npm run lint
```

---

## 👥 Roles & Permissions (RBAC)

| Capability | Club Manager | Session Manager |
|---|:---:|:---:|
| Create / Edit Club Profile | ✅ | ❌ |
| Add / Edit / Delete Players in Club Master Roster | ✅ | ❌ |
| Add / Invite New Session Managers | ✅ | ❌ |
| Create / Modify Weekly Sessions | ✅ | Only Assigned Sessions |
| Start Live Session from Template | ✅ | Only Assigned Sessions |
| Live Match Scorekeeping & Allocation | ✅ | ✅ |
| View Leaderboards & Analytics | ✅ | ✅ |
| Export Session & Lifetime Reports (PDF) | ✅ | ✅ |

*Note: Session managers are strictly restricted from creating or modifying other session managers; only the Club Manager has administrative rights to add or invite managers.*

---

## 📁 Project Structure

```
├── .env.example                       # Environment variable templates
├── firestore.rules                    # Firebase Firestore security rules
├── index.html                         # Application HTML entry point
├── metadata.json                      # AI Studio application metadata
├── package.json                       # Dependencies and build scripts
├── src/
│   ├── App.tsx                        # Master container, state sync, auth & routing
│   ├── main.tsx                       # React application bootstrap
│   ├── types.ts                       # Shared TypeScript types, interfaces & enums
│   ├── index.css                      # Global Tailwind CSS and custom tile styles
│   ├── lib/
│   │   └── firebase.ts                # Firebase Auth, RTDB & local storage sync layer
│   ├── utils/
│   │   └── badmintonLogic.ts          # Allocation engine, rating algorithm & sound
│   └── components/
│       ├── Navbar.tsx                 # Navigation header, sync indicator & theme toggle
│       ├── ClubSetupScreen.tsx        # Club profile, player roster & manager directory
│       ├── SessionsManagementScreen.tsx # Weekly session templates & session launcher
│       ├── LiveSessionScreen.tsx      # Interactive courts, live scoring & player bench
│       ├── HistoryScreen.tsx          # Match records, weekly & lifetime leaderboards
│       ├── TeamPairRankingView.tsx    # Pair podium, synergy table & match histories
│       ├── MemberPerformanceModal.tsx # Trajectory modal, stats chart & PDF export
│       ├── FullscreenCourtMonitor.tsx # Gymnasium TV / projector widescreen scoreboard
│       ├── MobileQRModal.tsx          # QR code modal for mobile spectator access
│       └── ErrorBoundary.tsx          # Component error recovery wrapper
├── ReadMe.md                          # Application documentation (this file)
├── Requirement_AND_SEPCIFICATION.md  # Detailed requirements & functional specification
└── TECHNICAL_ARCHITECTURE.md          # In-depth architectural & algorithmic design
```

---

## 📄 License
Private and confidential. Built for badminton club management and live tournament operations.
