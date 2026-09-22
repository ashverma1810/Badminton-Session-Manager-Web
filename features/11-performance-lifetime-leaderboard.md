# Feature 11: Performance Lifetime Leaderboard & Elo Ratings

## Overview
Tracks overall club member rankings using a Doubles-Aware Elo rating system (1,000 baseline) across all completed sessions in club history.

## User Stories
- **As a Player**, I want to view the club's lifetime leaderboard to track my overall Elo rating progression and rank against other members over time.

## Key Functional Specifications

### 1. Doubles-Aware Elo Rating Model
- **Baseline**: Every new member starts at `1,000` Elo points.
- **Doubles Rating Calculation**:
  - Calculates team expected win probability based on combined team ratings.
  - Adjusts individual rating gains/losses proportional to match outcome and point margin.

### 2. Lifetime Leaderboard Table
- **Columns**:
  - Rank Position (#1, #2, #3...)
  - Player Name & Gender Badge
  - Current Elo Rating & Rating Change Delta (+/-)
  - Matches Played, Wins, Losses, Win Rate %
  - Net Point Differential
- **Filters**:
  - **Player Name Search**: Search bar to filter rankings by player name.
  - **Gender Filter**: All, Male, Female
  - **Group Filter**: All, Group A, Group B, Group C
  - **Minimum Matches Filter**: e.g., At least 5 matches played

