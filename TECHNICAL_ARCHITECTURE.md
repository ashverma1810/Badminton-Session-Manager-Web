# 🏛️ Technical Architecture Documentation

**Application:** Badminton Session Manager  
**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS v4, Vite 6, Firebase Realtime Database & Auth  
**Document Version:** 2.4.0  

---

## 1. Architectural Paradigm & System Overview

The **Badminton Session Manager** is constructed as an offline-resilient, event-driven Single Page Application (SPA). It combines client-side compute efficiency with real-time cloud data propagation.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Browser / PWA                          │
│                                                                         │
│  ┌─────────────────────────┐       ┌─────────────────────────────────┐  │
│  │   UI Presentation Layer │       │    Core Algorithmic Engines     │  │
│  │  - ClubSetupScreen      │       │  - FairMatchAllocation          │  │
│  │  - SessionsManagement   │◄─────►│  - Doubles-Aware Ranking Model  │  │
│  │  - LiveSessionScreen    │       │  - TeamPair Synergy Model       │  │
│  │  - HistoryScreen        │       │  - Web Audio SoundEngine        │  │
│  │  - FullscreenMonitor    │       │  - jsPDF Export Pipeline        │  │
│  └────────────┬────────────┘       └─────────────────────────────────┘  │
│               │                                                         │
│  ┌────────────▼──────────────────────────────────────────────────────┐  │
│  │                  State Management & Multi-Tier Store              │  │
│  │                                                                   │  │
│  │   [Tier 1] LocalStorage Cache (Instant Warm-Start & Offline)      │  │
│  │      ▲                                                            │  │
│  │      │ Sync / Hydrate                                             │  │
│  │      ▼                                                            │  │
│  │   [Tier 2] Memory State (React Hooks: useState, useMemo, useRef)  │  │
│  └────────────┬──────────────────────────────────────────────────────┘  │
└───────────────┼─────────────────────────────────────────────────────────┘
                │ WebSocket / TLS (Bidirectional Event Stream)
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             Cloud Backend                               │
│                                                                         │
│  ┌───────────────────────────┐         ┌─────────────────────────────┐  │
│  │  Firebase Authentication  │         │  Firebase Realtime Database │  │
│  │  - Email / Password       │         │  - clubs/{clubId}/*         │  │
│  │  - Session Storage Auth   │         │  - user_clubs/{userHash}/*  │  │
│  └───────────────────────────┘         └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Tier Data Synchronization & Persistence

The application employs a 4-tier data pipeline designed to guarantee instantaneous UI responsiveness, zero data loss, and sub-300ms multi-device synchronization.

### Tier 1: LocalStorage Cache (Instant Bootstrap & Offline)
- Whenever any club state mutation occurs, `saveClubStateToLocal(clubId, state)` serializes the complete club object graph into browser `localStorage`.
- On application boot or page refresh, `loadClubStateFromLocal(clubId)` hydrates the entire UI synchronously in < 10ms, eliminating loading spinners.

### Tier 2: Realtime Database Initial Fetch
- Immediately after local hydration, `loadClubFromRealtime(clubId)` performs an atomic snapshot fetch via `getRtdb()` to reconcile any changes made on other devices while the client was offline.

### Tier 3: Realtime Database Active Subscription
- An active `onValue(ref(rtdb, 'clubs/${clubId}'))` listener establishes a persistent WebSocket connection.
- Incoming delta payloads are parsed through `parseRtdbClubData()` to update React state reactively without requiring manual re-fetching.

### Tier 4: Optimistic Mutations with Background Cloud Sync
- Local UI state updates immediately upon user actions (e.g., scoring a point, pausing a player).
- Asynchronous sync helpers (`syncMatchToRealtime`, `syncSessionPlayerToRealtime`, `syncSessionStateToRealtime`) dispatch atomic delta updates to Firebase Realtime Database in the background.

---

## 3. Core Algorithmic Architecture

### 3.1 Fair Match Allocation Algorithm (`FairMatchAllocation`)

Located in `src/utils/badmintonLogic.ts`, this engine determines optimal court pairings for doubles and singles without human bias.

#### Step 1: Candidate Player Filtering
```typescript
const candidatePlayers = allPlayers.filter((p) => {
  if (!sessionPlayerIds.includes(p.id)) return false; // Must be in session
  if (activePlayingPlayerIds.has(p.id)) return false;  // Cannot already be on court
  if (join.isPaused) return false;                    // Cannot be paused/injured
  if (join.eligibleCourtIds && !isCourtEligible(p, courtId)) return false;
  return true;
});
```

#### Step 2: Games Count Normalization & Handicap Calculation
To ensure fair court time across players arriving at different times or taking rests:
$$\text{EffectiveGames}(p) = \text{CompletedGames}(p) + \text{AdjustedGames}(p) + \text{PausedCompensation}(p)$$
Where:
$$\text{PausedCompensation}(p) = \left\lfloor \frac{\text{SessionMatchesElapsed} - \text{PausedAtMatchCount}}{\text{ActiveCourtsCount}} \right\rfloor$$

#### Step 3: Cost-Function Optimization Matrix
For candidate 4-player groupings, the algorithm evaluates all permutations $(p_1, p_2) \text{ vs } (p_3, p_4)$ against a cost function:
$$\text{Cost} = W_{\text{playCount}} + W_{\text{rest}} + W_{\text{partner}} + W_{\text{opponent}} + W_{\text{ratingGap}}$$

1. **Play Count Penalty ($W_{\text{playCount}}$)**: Prioritizes players with the lowest $\text{EffectiveGames}$.
2. **Rest Interval Penalty ($W_{\text{rest}}$)**: Heavily penalizes players who just finished the immediately preceding match ($M - 1$).
3. **Partner Repeat Penalty ($W_{\text{partner}}$)**: Exponentially penalizes pairings that have already partnered in the current session ($10 \times N_{\text{partnered}}^2$).
4. **Opponent Repeat Penalty ($W_{\text{opponent}}$)**: Penalizes facing the same opponent ($3 \times N_{\text{opposed}}$).
5. **Mixed Doubles Constraint**: For Mixed Doubles courts, verifies that each team consists of exactly 1 Male and 1 Female player.

---

### 3.2 Doubles-Aware Ranking Model (`StatsCalculator`)

A customized multi-factor rating system specifically designed for badminton doubles dynamics, addressing the shortcoming of standard singles Elo ratings.

$$\Delta R = K \times (S - E) \times M \times P_{\text{adj}}$$

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Doubles-Aware Ranking Model (Base: 1,000)            │
├───────────────────────────────────┬────────────────────────────────────┤
│ Component                         │ Weight & Influence                 │
├───────────────────────────────────┼────────────────────────────────────┤
│ 1. Opponent Strength (Elo)        │ 40% Weight                         │
│ 2. Margin of Victory (Points)     │ 20% Weight (Multiplier 1.00x-1.15x)│
│ 3. Consistency (Standard Dev)     │ 15% Weight (Score 0-100%)          │
│ 4. Recent Form (Last 5 Games)     │ 10% Weight (Momentum factor)       │
│ 5. Partner Gap Adjustment         │ 10% Weight (Asymmetric share)      │
│ 6. Inactivity / Attendance Decay  │ 5% Weight (Starts after 28 days)   │
└───────────────────────────────────┴────────────────────────────────────┘
```

#### Detailed Calculations:
1. **Team Elo Expectation ($E$)**:
   $$R_{\text{TeamA}} = \frac{R(p_{A1}) + R(p_{A2})}{2}, \quad R_{\text{TeamB}} = \frac{R(p_{B1}) + R(p_{B2})}{2}$$
   $$E_A = \frac{1}{1 + 10^{(R_{\text{TeamB}} - R_{\text{TeamA}}) / 400}}$$

2. **Winning Margin Multiplier ($M$)**:
   $$M = \begin{cases} 
   1.00 & \text{if } |\text{Score}_A - \text{Score}_B| \le 2 \\
   1.05 & \text{if } 3 \le |\text{Score}_A - \text{Score}_B| \le 5 \\
   1.10 & \text{if } 6 \le |\text{Score}_A - \text{Score}_B| \le 10 \\
   1.15 & \text{if } |\text{Score}_A - \text{Score}_B| \ge 11 
   \end{cases}$$

3. **Asymmetric Partner Rating Gap Adjustment ($P_{\text{adj}}$)**:
   In doubles, if Player 1 (Rating 1200) pairs with Player 2 (Rating 800) and they win, Player 2 contributed significantly relative to expectation and earns a larger percentage of the rating bounty. Conversely, if they lose, Player 1 absorbs a larger share of the penalty.

4. **Inactivity Decay**:
   Players inactive for $> 28$ days have an `activityStatus = 'INACTIVE'` flag set, and their rating decays by $1.5\%$ per month of absence to prevent rating squatting.

---

### 3.3 Team Pair Synergy Engine

The synergy model evaluates pairwise chemistry across unique player duos:
$$\text{SynergyScore} = (\text{WinRatio} \times 60) + \left(\frac{\text{AvgPointDiff} + 10}{20} \times 30\right) + (\min(\text{Matches}, 10) \times 1.0)$$
Pairs with high synergy scores are highlighted on the **Top Performing Pairs Podium**.

---

## 4. Audio Synthesis Architecture (`soundEngine`)

To avoid external MP3 dependencies, bandwidth latency, or 404 network errors, the sound system synthesizes all sound effects on the fly via the browser's native **HTML5 Web Audio API**:

```typescript
// Point Beep: Clean 880Hz Sine Wave
const osc = ctx.createOscillator();
osc.type = 'sine';
osc.frequency.setValueAtTime(880, ctx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

// Umpire Whistle: Swept 2200Hz -> 2800Hz -> 2400Hz Triangle Wave
const osc = ctx.createOscillator();
osc.type = 'triangle';
osc.frequency.setValueAtTime(2200, ctx.currentTime);
osc.frequency.linearRampToValueAtTime(2800, ctx.currentTime + 0.08);
osc.frequency.linearRampToValueAtTime(2400, ctx.currentTime + 0.25);
```
- **Autoplay Handling**: AudioContext begins in `suspended` state until the first user interaction, then automatically resumes via `audioCtx.resume()`.

---

## 5. Security & Role-Based Access Control (RBAC)

### 5.1 Identity Resolution
```
User Email (Firebase Auth / Session)
           │
           ▼
Check against Club Contact / Description
  ├── Match ──────► Role: CLUB_MANAGER
  └── No Match ───► Check against sessionManagers[] collection
                      ├── Match ──────► Role: SESSION_MANAGER (Stores managerId)
                      └── No Match ───► Fallback to Public / Restricted View
```

### 5.2 Enforcement in UI Components
- **`ClubSetupScreen.tsx`**: Add Session Manager button and delete icon are wrapped in:
  ```tsx
  {currentUserRole === 'CLUB_MANAGER' && (
    <button onClick={handleAddManager}>Add Session Manager</button>
  )}
  ```
- **`SessionsManagementScreen.tsx`**: Session Managers can only see and launch weekly sessions where `managerId === currentManagerId` or `manager2Id === currentManagerId`.

---

## 6. Design System & CSS Token Architecture

The styling layer uses **Tailwind CSS v4** with a custom theme provider toggling the `dark` class on the root `<html>` element.

### 6.1 Light Mode Color Mapping Standard
- **Backgrounds**: Slate-950 (`#020617`) mapped to Slate-50 (`#f8fafc`); Slate-900 mapped to Pure White (`#ffffff`).
- **Typography**: Pure White mapped to Slate-950 (`#020617`); Slate-200 mapped to Slate-800 (`#1e293b`).
- **Borders**: Slate-800 mapped to Slate-200 (`#e2e8f0`).

### 6.2 The 10% Grey Tile Architecture (`.light-10-grey-tile`)
Defined in `src/index.css`:
```css
html.light .light-10-grey-tile,
html:not(.dark) .light-10-grey-tile {
  background-color: #e6e8ec !important; /* 10% Grey Value */
  border-color: #cbd5e1 !important;
  color: #000000 !important;
}

html.light .light-10-grey-tile h2,
html.light .light-10-grey-tile .podium-title {
  color: #000000 !important;
  font-weight: 900 !important;
}

html.light .light-10-grey-tile p,
html.light .light-10-grey-tile .podium-subtitle {
  color: #1e293b !important;
  font-weight: 700 !important;
}
```

---

## 7. Component Map & Responsibilities

```
src/
├── App.tsx                        # Master container, Auth observer, Multi-tier RTDB sync
├── components/
│   ├── Navbar.tsx                 # Branding, Navigation tabs, Sync status, Theme toggle
│   ├── ClubSetupScreen.tsx        # Venue, Game types, Member roster, Session manager RBAC
│   ├── SessionsManagementScreen.tsx # Weekly templates, Assigned managers, Session launcher
│   ├── LiveSessionScreen.tsx      # Court cards, Live scorekeeper, Player bench, Audio whistle
│   ├── HistoryScreen.tsx          # Session logs, Weekly leaderboard, Lifetime leaderboard
│   ├── TeamPairRankingView.tsx    # 10% grey podium, Pair synergy table, Match history
│   ├── MemberPerformanceModal.tsx # Trajectory chart, Game analytics, Branded PDF export
│   ├── FullscreenCourtMonitor.tsx # Gymnasium TV widescreen scoreboard display
│   ├── MobileQRModal.tsx          # QR Code display for player mobile spectator link
│   └── ErrorBoundary.tsx          # Graceful UI recovery and exception catcher
├── lib/
│   └── firebase.ts                # Firebase app init, RTDB refs, Auth helpers, Local cache
├── utils/
│   └── badmintonLogic.ts          # FairMatchAllocation, StatsCalculator, SoundEngine, PDF
└── types.ts                       # Complete TypeScript schema definitions
```

---

## 8. Build & Deployment Architecture

- **Bundler**: Vite 6 utilizing `@vitejs/plugin-react` and `@tailwindcss/vite`.
- **Target Runtime**: Node.js 18+ / Modern Evergreen Browsers (Chrome, Safari, Firefox, Edge).
- **Compilation**: Clean TypeScript transpilation via `tsc --noEmit` and Vite production bundling into `dist/`.
- **Zero Heavy Backend Overhead**: Fully serverless architecture running directly on static CDN/Cloud Run with Firebase managed database.
