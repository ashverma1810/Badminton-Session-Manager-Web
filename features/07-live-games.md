# Feature 07: Live Games & Court Scorekeeping

## Overview
Handles live game execution, court-side scorekeeping, match conclusion, and score entry verification.

## User Stories
- **As a Scorekeeper or Player**, I want a clean, touch-friendly score entry interface to record match scores without native browser stepper arrows interfering.
- **As a Session Manager**, I want an option to finish a game with or without recording detailed statistics.

## Key Functional Specifications

### 1. Score Entry Interface
- **Team A vs Team B Inputs**: Dedicated input fields for Team A and Team B scores.
- **Integer Validation**: Only whole positive numbers (integers 0, 1, 2...) are accepted. Non-digits, negative numbers, and decimals are stripped automatically.
- **Score Caps & Auto-Calculation**:
  - **15-Point Target Game**: Maximum score cap is **20**. Entering scores > 20 is prevented.
    - Entering `20` (max winning score) auto-populates losing score as `19`.
    - Entering deuce scores `19` or `18` auto-populates winning score as `20`.
    - Entering deuce score `16` auto-populates winning score as `18` (deuce rule: entered + 2).
    - Entering scores `< 14` (e.g. `11`) auto-populates winning score as target score (`15`).
  - **21-Point Target Game**: Maximum score cap is **30**. Entering scores > 30 is prevented.
    - Entering `30` (max winning score) auto-populates losing score as `29`.
    - Entering deuce scores `29` or `28` auto-populates winning score as `30`.
    - Entering deuce score `26` auto-populates winning score as `28` (deuce rule: entered + 2).
    - Entering scores `< 20` (e.g. `16`) auto-populates winning score as target score (`21`).
- **No Spinner Buttons**: Browser default up/down stepper arrows (`input[type="number"]`) are removed via CSS (`appearance: textfield`) and numeric inputs use `inputMode="numeric"` for clean touch interaction on mobile devices and court tablets.

### 2. Match Conclusion Flow
- **Confirm & Next Match**: Records the final scores, updates player Elo ratings and stats, frees up the court, and prompts for the next match allocation.
- **Finish Without Scores**: Concludes the match without updating rating stats if a game was abandoned or played informally.
- **End / Delete Game Dialog**: Safely end an in-progress match or delete a duplicate/erroneous match record.

### 3. Fullscreen Court Monitor Mode
- Displays enlarged court scores, team player names, and live match timer designed for wall-mounted TV monitors or court-side tablet displays.

### 4. Live Court Player Replacement & Intra-Court Swap
- **Interactive Player Selection**: On running courts in the Games tab, clicking any assigned player's name opens a Change Player dialog.
- **Candidate Filtering Rules**:
  - **Included**: All currently waiting players (`isPaused === false` and `isPlaying === false`) and players assigned to that specific court (enabling intra-court position swaps).
  - **Excluded**: The player currently being replaced, any paused players (`isPaused === true`), and any playing players assigned to other active courts.
- **Intra-Court Position Swap**: If a manager selects another player currently assigned to the same court, the system swaps their positions/teams on the court.
- **Realtime Database Sync**: Swaps and player replacements immediately sync to Firebase Realtime Database across all connected clients.

