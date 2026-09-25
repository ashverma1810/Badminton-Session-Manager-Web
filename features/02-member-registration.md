# Feature 02: Member Registration & Roster Management

## Overview
Enables organizers to register and manage club members (Full Regular Members) and guests (PAYG - Pay As You Go), maintaining member profiles, initial Elo ratings, and attendance history.

## User Stories
- **As an Organizer**, I want to register new members with their name, gender, and membership type so that they can be assigned to courts and tracked in leaderboards.
- **As a Session Manager**, I want to search and quick-add guest players during a live session so that pop-up attendees can join games instantly.

## Key Functional Specifications

### 1. Member Profile Attributes
- **Full Name**: Text input (e.g. "Alex Chen")
- **Gender**: `MALE` or `FEMALE`
- **Membership Status**: `Regular Member` or `PAYG Guest`
- **Initial Baseline Rating**: Default `1,000` Elo baseline
- **Created Timestamp**: Auto-generated epoch timestamp

### 2. Member Directory Operations
- **Add Member**: Single or bulk member addition under `/clubs/{clubId}/members/`.
- **Search & Filter**: Real-time text search by member name; filter by Gender (`All`, `Male`, `Female`) or Membership type (`All`, `Regular`, `PAYG`).
- **Edit Member**: Update member display name, gender, or membership status.
- **Delete Member**: Soft or hard deletion with confirmation safeguards; preserves historical match records to protect global Elo calculation integrity.

### 3. Quick Guest Registration
- Available directly from the Live Session player pool drawer.
- Allows immediate creation of guest players without leaving the active court view.
