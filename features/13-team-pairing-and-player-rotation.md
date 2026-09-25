# Feature 13: Team Pairing, Player Rotation & Queue Management

## Overview
Specifies automated fair team pairing algorithms for Doubles and Mixed Doubles, player selection criteria, dynamic play count balancing, partner/opponent history tracking, late-arrival adjustments, pause/resume rotation rules, and manager-configured fixed player pairing priority during live session setup and execution.

---

## User Stories
- **As a Session Manager**, I want the system to automatically allocate balanced, fair matches on available courts so that all session participants receive equal playing time and varied partner/opponent combinations.
- **As a Session Manager**, I want the ability to explicitly pair specific players together during session setup or live games so that they are prioritized to play together as a team whenever both are in the waiting queue.
- **As a Late-Arriving Player**, I want to be integrated into the live session queue fairly without bypassing other waiting players or monopolizing court time.
- **As a Paused/Resuming Player**, I want my rotation weight to adjust accurately when I take a break and return so I am not forced into back-to-back games for matches played while I was away.
- **As a Session Manager**, I want support for standard Doubles and Mixed Doubles game types with strict male/female team balancing rules for Mixed Doubles courts.

---

## Key Functional Specifications

### 1. Candidate Player Pool & Eligibility Criteria
Before generating a match for any active court, the system builds an eligible candidate player pool from all session participants (`session_players` / `joins`).

A player is **eligible** if and only if all of the following conditions are met:
1. **Registered in Active Session**: The player is linked to the current active session ID.
2. **Not Paused**: `isPaused === false`.
3. **Not Currently Playing**: The player is not assigned to any ongoing match on any court (`isPlaying === false`).
4. **Court Specific Eligibility**: If the player has court restrictions (`eligibleCourtIds`), the target court ID must be included in their allowed list.

---

### 2. Fair Match Allocation Algorithm & Cost Metrics

#### Tracked Player Metrics
For each eligible candidate, the system evaluates:
- **`completedCount`**: Total valid, completed matches played by the player in the current session (matches with recorded non-zero scores).
- **`adjustedGames`**: Cumulative virtual game offset derived from late arrival or pause durations.
- **`effectiveGamesPlayed`**: Sum of actual and virtual games (`completedCount + adjustedGames`).
- **`lastPlayedMatchNumber`**: The match number of the player's most recent game in this session (returns `0` if player has not played yet).

#### Historical Matrices
The system calculates real-time history matrices across all completed session matches:
- **Partner History (`partnerHistory`)**: Frequency count of how many times any pair of players (`playerA` and `playerB`) have played together on the same team.
- **Opponent History (`opponentHistory`)**: Frequency count of how many times any pair of players (`playerA` and `playerB`) have played against each other on opposing teams.

---

### 3. Doubles Team Pairing (`DOUBLES`)

1. **Minimum Player Requirement**: Requires at least **4 eligible candidate players**. If `< 4`, match generation returns `null`.
2. **Combination Evaluation**: Evaluates all 4-player combinations $\binom{N}{4}$ from the candidate pool.
3. **Team Formations**: For each group of 4 players $(P_1, P_2, P_3, P_4)$, tests all 3 distinct team pairings:
   - **Option A**: $[P_1, P_2] \text{ vs } [P_3, P_4]$
   - **Option B**: $[P_1, P_3] \text{ vs } [P_2, P_4]$
   - **Option C**: $[P_1, P_4] \text{ vs } [P_2, P_3]$
4. **Cost Minimization & Sorting Order**:
   All pairing options are sorted by the following strict 4-tier priority rules (ascending cost):
   - **Tier 0: `pairPriorityBonus` (Top Priority)**: If a pair option places a manager-configured fixed pair ($P_1 + P_2$) together on Team A or Team B while both are available in the waiting queue, the option receives a major negative cost offset (top allocation priority).
   - **Tier 1: `gamesPlayedSum` (Ascending)**: Sum of `effectiveGamesPlayed` of all 4 players ($GP_1 + GP_2 + GP_3 + GP_4$). Prioritizes players with the fewest total played games.
   - **Tier 2: `partnerCost` (Ascending)**: Combined count of previous pairings for Team A + Team B. Minimizes repeating recent partners.
   - **Tier 3: `opponentCost` (Ascending)**: Total head-to-head match count between Team A players and Team B players. Minimizes repeating recent opponents.
   - **Tier 4: `restSum` (Ascending)**: Sum of `lastPlayedMatchNumber` for all 4 players. Prioritizes players who have been resting for more match cycles.
   - **Tie-Breaker**: Random selection if all metrics are identical.

---

### 4. Mixed Doubles Team Pairing (`MIXED_DOUBLES`)

1. **Minimum Gender Requirement**: Requires at least **2 Male** and **2 Female** eligible candidate players. If unsatisfied, match generation returns `null`.
2. **Team Structure Rule**: Every team **MUST** consist of exactly **1 Male** and **1 Female** player:
   - **Team A**: $[M_1, F_1]$ or $[M_1, F_2]$
   - **Team B**: $[M_2, F_2]$ or $[M_2, F_1]$
3. **Combination Evaluation**: Iterates over all male pairs $(M_1, M_2)$ and female pairs $(F_1, F_2)$.
4. **Cost Minimization & Sorting Order**: Applied identically to standard Doubles (`pairPriorityBonus` $\rightarrow$ `gamesPlayedSum` $\rightarrow$ `partnerCost` $\rightarrow$ `opponentCost` $\rightarrow$ `restSum`).

---

### 5. Fixed Player Pairing & Priority Allocation

#### Setup & Live Session Management
- **Pairing Trigger**: Session Managers can select any two session players ($P_1$ and $P_2$) and click **"Pair Players"** during:
  - **Session Setup Phase**: When opening or configuring an ad-hoc or weekly session (`SessionStatus: 'Setting Up'`).
  - **Active Session Execution**: At any point during a running session on the Live Session screen.
- **Dedicated "Pair Players" Sub-tab**: Under the **Live Session -> Games** screen, a dedicated **"Pair Players"** sub-tab is displayed alongside **Waiting**, **Playing**, and **Paused**. Under this tab, all active paired couples are listed with real-time status badges (`🔗 Waiting Together (Priority)`, `Playing on Court`, `Paused`) and an **Unpair** action button.
- **Pair Validation**:
  - A player can belong to only one active pair at a time.
  - If either player is already paired, the system prompts or replaces their prior pairing.
- **Unpairing**: Managers can click the **"Unpair"** action (`✕` / link icon) next to any paired couple to release them back to standard individual rotation.

#### Match Priority Rules
- When **both** players of a fixed pair are waiting in the queue (`isPaused === false` and `isPlaying === false`):
  1. The allocation algorithm evaluates match options containing $(P_1, P_2)$ as teammates with **top priority**.
  2. At the start of the session (Match 1 allocations), paired players are assigned together on court first.
  3. Throughout live play, as soon as both paired players complete their rest cycle and return to waiting status, their pair combo takes top priority for the next available court.
- **Partial Waiting**: If $P_1$ is waiting while $P_2$ is still playing an active match or is paused, $P_1$ remains in the regular waiting queue until $P_2$ becomes available, at which point pair priority activates.

---

### 6. Late Arrival Adjustment Rule

When a player joins an active session after games have already commenced (either via walk-in PAYG or late-registering club member):

$$\text{lateArrivalAdjustment} = \text{Math.round}\left(\frac{\text{totalSessionMatches}}{\text{activeCourtCount}}\right)$$

- **Behavior**:
  - If session has not started (`startTime == null` or `totalSessionMatches == 0`), `lateArrivalAdjustment = 0`.
  - The calculated value is assigned to the player's `adjustedGames`.
  - **Rationale**: Prevents late arrivals from having an effective game count of `0` when existing players have played multiple matches, which would otherwise force the late arrival to play back-to-back games without resting.

---

### 7. Pause & Resume Rotation Rule

#### Pausing a Player
- A Session Manager can toggle any active player's status to **Paused** (`isPaused: true`).
- The system records the current total session match count:
  $$\text{pausedAtMatchCount} = \text{totalSessionMatches}$$
- Paused players are immediately excluded from candidate pools for automated match generation and court filling.

#### Resuming a Player
- When a manager toggles a paused player back to **Active** (`isPaused: false`):
  1. The system determines the number of matches completed while the player was away:
     $$\text{matchesDuringPause} = \max(0, \text{totalSessionMatches} - \text{pausedAtMatchCount})$$
  2. The missed rotation adjustment is calculated:
     $$\text{pauseAdjustment} = \text{Math.round}\left(\frac{\text{matchesDuringPause}}{\text{activeCourtCount}}\right)$$
  3. The player's `adjustedGames` is incremented:
     $$\text{adjustedGames} = \text{adjustedGames} + \text{pauseAdjustment}$$
  4. `pausedAtMatchCount` is reset to `null`.
- **Rationale**: Ensures returning players are integrated smoothly into the regular queue without receiving an unfair influx of continuous games to "catch up" on matches played while they were away.

---

### 8. Manual Player Replacement & Intra-Court Position Swap
- **Intra-Court Position Swap**: Session Managers can swap team assignments ($[P_1, P_2] \leftrightarrow [P_3, P_4]$) on an active match court.
- **Live Player Replacement**: Managers can replace an active court player with an eligible waiting player.
- **Realtime Database Synchronization**: All state changes (pause toggles, late additions, player swaps, fixed player pairs, match allocations) sync instantly to Firebase Realtime Database across all manager views and court-side display monitors.
