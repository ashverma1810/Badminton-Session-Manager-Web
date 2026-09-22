# Feature 14: Player Rating & Performance Metrics Calculation

## Overview
Specifies the mathematical formulas, multi-factor Doubles-Aware Ranking Model, win-rate calculations, points +/- differential metrics, consistency evaluation, recent form momentum, streak tracking, and average points per game used across Session Leaderboards, Lifetime Leaderboards, and Live Stats screens.

---

## User Stories
- **As a Player**, I want a fair, doubles-aware rating system that accurately reflects my individual skill contribution, strength of opponents, partner skill level, and winning margins.
- **As a Session Manager or Club Member**, I want comprehensive performance metrics—including win percentage, point differentials (+/-), average points per game, consistency scores, and win/loss streaks—to track player growth over time.
- **As a Player taking extended time off**, I want my activity status and decay to transparently reflect my inactivity without unfairly resetting my rating.

---

## Key Functional Specifications

### 1. Match Qualification Rule (`isMatchValidAndCounted`)
To ensure statistical integrity, a match is included in player performance and rating calculations **if and only if**:
1. The match has concluded with a winner (`winnerTeam !== null` or `endTime !== null`).
2. Valid scores are recorded for both teams (`teamAScore` and `teamBScore` exist).
3. The match score is not `0 - 0` (unplayed, abandoned, or zero-score placeholder matches are strictly excluded).

---

### 2. Doubles-Aware Player Rating Model

#### Baseline & Chronological Simulation
- **Starting Base Rating**: Every new player begins with a baseline rating of **`1000`**.
- **Chronological Match Replay**: All valid matches are sorted and replayed in exact chronological sequence (`startTime` / `endTime`).

#### Multi-Factor Elo Rating Adjustment Formula
For each match played by a player $P$, the rating change $\Delta R$ is calculated based on 6 core factors:

1. **Strength of Opponents (Elo Expectation - 40% Weight)**:
   - Team ratings are averaged: $\text{TeamRating}_A = \frac{R_{A1} + R_{A2}}{2}$, $\text{TeamRating}_B = \frac{R_{B1} + R_{B2}}{2}$.
   - Expected win probability for Team A:
     $$E_A = \frac{1}{1 + 10^{(\text{TeamRating}_B - \text{TeamRating}_A) / 400}}$$
   - Expected win probability for Team B: $E_B = 1 - E_A$.
   - Actual outcome $S$: $1.0$ for win, $0.0$ for loss, $0.5$ for tie.

2. **K-Factor / Player Maturity Scale**:
   - $< 10$ matches played: $K = 40$ (high mobility during placement).
   - $10 - 25$ matches played: $K = 30$.
   - $> 25$ matches played: $K = 20$ (established rating stability).

3. **Margin Multiplier (Winning Margin - 20% Weight)**:
   - Point difference $|S_A - S_B|$ scales rating gains/losses:
     - **1 – 2 points diff**: $1.00\times$
     - **3 – 5 points diff**: $1.05\times$
     - **6 – 10 points diff**: $1.10\times$
     - **11+ points diff**: $1.15\times$

4. **Partner Adjustment (10% Weight)**:
   - Evaluates self rating relative to partner rating:
     $$\text{ratio} = \frac{2 \times R_{\text{partner}}}{R_{\text{self}} + R_{\text{partner}}}$$
     $$\text{partnerWeight} = \text{clamp}(0.75, 1.25, \text{ratio})$$
   - **Effect**: Playing with a weaker partner yields higher rating gain on win ($> 1.0\times$) and lower penalty on loss. Playing with a stronger partner increases loss penalty.

5. **Recent Form Multiplier (10% Weight)**:
   - Evaluates win-rate over the player's last 5 matches ($\text{winRate}_5$):
     $$\text{formMultiplier} = 1.0 + 0.10 \times \left((\text{winRate}_5 - 0.5) \times 2\right) \quad \text{range } [0.90, 1.10]$$

6. **Rating Delta Calculation**:
   - Base delta: $\text{baseDelta} = K \times (S - E)$.
   - **On Win / Outperformance ($S \ge E$)**:
     $$\Delta R = \text{baseDelta} \times \text{marginMultiplier} \times \text{partnerWeight} \times \text{formMultiplier}$$
   - **On Loss / Underperformance ($S < E$)**:
     $$\Delta R = \text{baseDelta} \times \text{marginMultiplier} \times (2 - \text{partnerWeight}) \times (2 - \text{formMultiplier})$$
   - Rating Floor: Rating cannot drop below **`100`**.

---

### 3. Post-Match Consistency & Activity Adjustments

#### Consistency Score & Rating Fine-Tuning
- Evaluated over the player's last 30 matches using standard deviation ($\sigma$) of match point differentials:
  $$\text{consistencyScore} = \text{clamp}\left(10, 100, \text{round}\left(\max(0, 1 - \sigma / 15) \times 100\right)\right)$$
- Players with consistent performance (low $\sigma$) receive a rating boost of up to $\pm 15$ points:
  $$\text{consistencyAdjustment} = \text{round}\left(\left(\frac{\text{consistencyScore}}{100} - 0.5\right) \times 30 \times \min\left(1, \frac{N}{10}\right)\right)$$

#### Attendance & Inactivity Decay
- **Threshold**: 4 weeks (28 days) of continuous inactivity.
- **Decay Rule**: Past 28 days, an inactivity penalty of 10 points per week is applied (capped at maximum 120 points decay):
  $$\text{activityDecay} = \min(120, \text{inactiveWeeks} \times 10)$$
- Decay is applied only if player's computed rating is $> 1000$, and will not reduce rating below `1000`.
- **Status Flag**: Marked as `INACTIVE` if inactive $> 28$ days; otherwise `ACTIVE`.

---

### 4. Core Performance Metrics

#### Win Percentage (Win-Rate)
$$\text{winPercentage} = \begin{cases} \left(\frac{\text{gamesWon}}{\text{gamesPlayed}}\right) \times 100 & \text{if } \text{gamesPlayed} > 0 \\ 0.0 & \text{otherwise} \end{cases}$$

#### Points Scored, Conceded & Differential (+/-)
- **`totalPointsScored`**: Cumulative points scored by the player's team in all valid played matches.
- **`totalPointsConceded`**: Cumulative points scored by opponent teams in all valid played matches.
- **`pointDifferential` (`points +/-`)**:
  $$\text{pointDifferential} = \text{totalPointsScored} - \text{totalPointsConceded}$$

#### Average Points Per Game
$$\text{averagePointsPerGame} = \begin{cases} \frac{\text{totalPointsScored}}{\text{gamesPlayed}} & \text{if } \text{gamesPlayed} > 0 \\ 0.0 & \text{otherwise} \end{cases}$$

#### Recent Form Rate
- **`recentFormRate`**: Percentage of wins achieved in the player's last 5 completed matches ($0\% – 100\%$). Returns $50\%$ baseline if no matches have been played.

#### Winning & Losing Streaks
- **`consecutiveWins` (`maxWins`)**: The maximum number of consecutive match wins achieved in the session/history scope.
- **`consecutiveLosses` (`maxLosses`)**: The maximum number of consecutive match losses sustained in the session/history scope.

---

### 5. Standard Leaderboard Ranking Rule (`sortPlayersByRankRule`)
When ordering players on Leaderboard tables, the system applies the following strict multi-tier sorting rules:
1. **Primary**: Doubles-Aware Rating (Descending)
2. **Secondary**: Win Percentage (Descending)
3. **Tertiary**: Games Won (Descending)
4. **Quaternary**: Total Points Differential (`totalPointsScored - totalPointsConceded`, Descending)
5. **Quinary**: Player Name (Alphabetical Ascending)
