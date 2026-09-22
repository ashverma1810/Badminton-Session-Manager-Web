# Feature 10: Performance Session Leaderboard

## Overview
Generates session-specific leaderboards evaluating player performance within a single completed session.

## User Stories
- **As a Player**, I want to view the session leaderboard at the end of the night to see who ranked #1 in win rate and point differential.

## Key Functional Specifications

### 1. Leaderboard Ranking Logic
- **Primary Rank**: Win Percentage (`Wins / Matches Played * 100`).
- **Tie-Breaker 1**: Net Point Differential (`Points For - Points Against`).
- **Tie-Breaker 2**: Total Wins.

### 2. Session Podium (#1 Gold, #2 Silver, #3 Bronze)
- Displays top 3 performers of the session on stylized podium cards.
- Podium visual indicators:
  - **#1 Gold**: Amber border & badge
  - **#2 Silver**: Slate/Silver border & badge
  - **#3 Bronze**: Warm Bronze border & badge

### 3. Light Mode 10% Grey Tile Design System
- In light mode, session leaderboard tiles render using `.light-10-grey-tile` with `#e6e8ec` background, white inner metric boxes, and `#000000` high-contrast typography.

### 4. Player Search Filtering
- **Search Bar**: Search input placed on top of session leaderboard controls.
- **Filtering**: Filters multi-session leaderboard rows dynamically by player name.

