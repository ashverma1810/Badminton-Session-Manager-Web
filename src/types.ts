export type GameType = 'SINGLES' | 'DOUBLES' | 'MIXED_DOUBLES' | 'MULTI_TYPE';
export type SessionStatus = 'Setting Up' | 'Active' | 'End';
export type Gender = 'MALE' | 'FEMALE';

export interface ClubEntity {
  id: number;
  name: string;
  venue: string;
  defaultSessionType: GameType;
  themeColorHex: string;
  targetScore: number;
  contactPerson: string;
  description: string;
  createdAt: number;
}

export interface PlayerEntity {
  id: number;
  name: string;
  gender: Gender;
  createdAt: number;
  isPAYG: boolean;
}

export interface SessionEntity {
  id: number;
  name: string;
  type: GameType;
  createdAt: number;
  isActive: boolean;
  startTime: number | null;
  endTime: number | null;
  status: SessionStatus;
  weeklySessionId: number | null;
  managerId: number | null;
  managerName?: string | null;
  manager2Id?: number | null;
  manager2Name?: string | null;
  targetScore?: number;
  isDeleted?: boolean;
  deletedAt?: number;
  deletedBy?: string;
}

export interface SessionPlayerJoinEntity {
  sessionId: number;
  playerId: number;
  isPaused: boolean;
  eligibleCourtIds: string | null; // Comma separated court IDs or null for ALL
  isPAYG: boolean;
  adjustedGames: number;
  pausedAtMatchCount: number | null;
  pairedPartnerId?: number | null;
}

export interface PlayerPairEntity {
  id: string;
  sessionId: number;
  player1Id: number;
  player2Id: number;
  createdAt: number;
}

export interface CourtEntity {
  id: number;
  sessionId?: number;
  weeklySessionId?: number;
  name: string;
  gameType: GameType;
}

export interface CourtMasterEntity {
  id: number;
  name: string;
  createdAt: number;
}

export interface MatchEntity {
  id: number;
  sessionId: number;
  courtId: number;
  matchNumber: number;
  teamAPlayer1Id: number;
  teamAPlayer2Id: number | null; // null for singles
  teamBPlayer1Id: number;
  teamBPlayer2Id: number | null; // null for singles
  teamAScore: number | null;
  teamBScore: number | null;
  winnerTeam: 'A' | 'B' | null;
  startTime: number;
  endTime: number | null;
  isEdited?: boolean;
  lastEditedAt?: number;
  lastEditedBy?: string;
}

export interface WeeklySessionEntity {
  id: number;
  name: string;
  dayOfWeek: string; // "Monday", "Tuesday", etc.
  time: string; // "19:00"
  type: GameType;
  managerId: number | null;
  managerName?: string | null;
  manager2Id?: number | null;
  manager2Name?: string | null;
  createdAt: number;
  targetScore?: number;
}

export interface WeeklySessionMemberEntity {
  weeklySessionId: number;
  memberId: number;
}

export interface WeeklySessionCourtEntity {
  id: number;
  weeklySessionId: number;
  name: string;
  gameType: GameType;
}

export type ManagerRole = 'CLUB_MANAGER' | 'SECONDARY_CLUB_MANAGER' | 'SESSION_MANAGER';

export interface SessionManagerEntity {
  id: number;
  name: string;
  email: string;
  role?: ManagerRole;
  authUid?: string;
  uid?: string;
  inviteStatus?: 'INVITED' | 'ACTIVE' | 'EMAIL_SENT';
  createdAt: number;
}

export interface PlayerStats {
  playerId: number;
  name: string;
  gender: Gender;
  gamesPlayed: number;
  adjustedGames: number;
  gamesWon: number;
  gamesLost: number;
  winPercentage: number;
  totalPointsScored: number;
  totalPointsConceded: number;
  averagePointsPerGame: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  // Doubles-Aware Ranking Model
  rating: number; // Overall rating starting at 1000 + match rating changes
  ratingChange: number; // Net rating change from 1000
  lastRatingDelta?: number; // Latest match delta (+32, -14, etc.)
  recentFormRate?: number; // Recent form win rate % over last 5 matches
  consistencyScore?: number; // Consistency score 0-100%
  activityStatus?: 'ACTIVE' | 'INACTIVE'; // Active or Inactive after 4 weeks
  inactiveWeeks?: number;
}

export interface SessionStats {
  sessionId: number;
  sessionName: string;
  totalGamesPlayed: number;
  gamesPerCourt: Record<number, number>;
  courtUtilization: Record<number, number>;
  durationMs: number;
}

export interface TeamPairStats {
  pairKey: string;
  player1Id: number;
  player2Id: number;
  player1Name: string;
  player2Name: string;
  player1Gender: Gender;
  player2Gender: Gender;
  pairCategory: 'MENS' | 'WOMENS' | 'MIXED';
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winPercentage: number;
  pointsScored: number;
  pointsConceded: number;
  pointDifferential: number;
  avgPointsScored: number;
  avgPointsConceded: number;
  synergyScore: number;
  recentForm: ('W' | 'L')[];
  matchHistory: {
    sessionId: number;
    sessionName: string;
    date: number;
    won: boolean;
    teamScore: number;
    opponentScore: number;
    opponent1Name: string;
    opponent2Name: string;
  }[];
}

export interface MemberSessionPerformance {
  sessionId: number;
  sessionName: string;
  date: number;
  dateStr: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winPercentage: number;
  pointsScored: number;
  pointsConceded: number;
  pointsDiff: number;
  avgPoints: number;
  rating?: number;
  startRating?: number;
  ratingChange?: number;
  sessionRatingDelta?: number;
  matches: {
    matchId: number;
    courtName?: string;
    partnerName?: string;
    opponentNames: string[];
    won: boolean;
    teamScore: number;
    opponentScore: number;
  }[];
}

export interface ScoreAuditLogEntity {
  id: string;
  matchId: number;
  matchNumber: number;
  sessionId: number;
  sessionName: string;
  weeklySessionId?: number | null;
  weeklySessionName?: string | null;
  sessionDate: string;
  courtName: string;
  teamAPlayers: string;
  teamBPlayers: string;
  oldTeamAScore: number;
  oldTeamBScore: number;
  oldWinnerTeam: 'A' | 'B';
  newTeamAScore: number;
  newTeamBScore: number;
  newWinnerTeam: 'A' | 'B';
  scoreChangeSummary: string;
  updatedByUid: string;
  updatedByName: string;
  updatedByEmail: string;
  updatedByRole: ManagerRole | string;
  timestamp: number;
}
