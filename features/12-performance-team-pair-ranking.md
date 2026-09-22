# Feature 12: Performance Team Pair Ranking & Synergy Analysis

## Overview
Analyzes doubles pair chemistry, team synergy ratings, and win rates for unique two-player combinations across the club.

## User Stories
- **As a Club Organizer**, I want to view team pair rankings to discover which player combinations have the highest win rates and synergy ratings for tournament selections.

## Key Functional Specifications

### 1. Pair Synergy Calculation
- **Pair Identifier**: Unique combination of two players (e.g. "Alex Chen & David Wong").
- **Synergy Rating**: Evaluates actual match performance vs expected baseline rating of the individual players.
- **Pair Metrics**:
  - Matches Played Together
  - Wins & Losses as a Pair
  - Win Rate Percentage
  - Combined Synergy Score (+/-)

### 2. Top Performing Pairs Podium (#1 Gold, #2 Silver, #3 Bronze)
- Displays top 3 doubles teams on prominent podium cards with synergy statistics.

### 3. Light Mode 10% Grey Tile Design System
- In light mode, Team Pair Ranking overview tiles and podium cards render using `.light-10-grey-tile` with `#e6e8ec` background, white inner metric containers, and `#000000` high-contrast typography.
