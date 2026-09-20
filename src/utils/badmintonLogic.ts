import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { 
  PlayerEntity, 
  MatchEntity, 
  SessionEntity, 
  SessionPlayerJoinEntity, 
  CourtEntity, 
  PlayerStats, 
  SessionStats,
  ClubEntity,
  GameType
} from '../types';

// Sound Engine for Whistle and Point Beeps
class SoundEngine {
  private audioCtx: AudioContext | null = null;
  private isEnabled = true;

  public setSoundEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  private getAudioContext(): AudioContext | null {
    if (!this.isEnabled) return null;
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public playPointBeep() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  public playWhistle() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(2800, ctx.currentTime + 0.08);
      osc.frequency.linearRampToValueAtTime(2400, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio autoplay fallback
    }
  }
}

export const soundEngine = new SoundEngine();

// --- Stats Calculator with Doubles-Aware Ranking Model ---
// Overall Rating = 1000 (starting point) + Rating Changes after every match
// 1. Strength of opponents (40% weight): Team Elo expectation
// 2. Winning margin (20% weight): 1-2 pts: 1.00x, 3-5: 1.05x, 6-10: 1.10x, 11+: 1.15x
// 3. Consistency (15% weight): Standard deviation over last 30 matches
// 4. Recent form (10% weight): Momentum over last 5 matches
// 5. Partner adjustment (10% weight): Weaker partner gains more on win, stronger shoulders more on loss
// 6. Attendance/Activity (5% weight): Inactivity decay starts after 4 weeks (28 days)

/**
 * Helper to determine whether a match was actually played with valid recorded scores.
 * A 0-0 match indicates the game was not played or should not be counted.
 * It is excluded from all player statistics, game counts, leaderboard calculations,
 * averages, ratings, and performance metrics.
 */
export function isMatchValidAndCounted(m: MatchEntity | null | undefined): boolean {
  if (!m) return false;
  if (m.endTime == null && m.winnerTeam == null) return false;
  if (m.teamAScore == null || m.teamBScore == null) return false;
  // If no score has been entered or both scores are 0-0, treat as not played / do not count
  const scoreA = m.teamAScore ?? 0;
  const scoreB = m.teamBScore ?? 0;
  if (scoreA === 0 && scoreB === 0) return false;
  return true;
}

export const StatsCalculator = {
  calculatePlayerStats(
    players: PlayerEntity[],
    matches: MatchEntity[],
    joinsMap: Record<number, SessionPlayerJoinEntity> = {},
    courtCount = 0
  ): PlayerStats[] {
    const safeMatches = matches || [];
    const completedMatches = safeMatches.filter(isMatchValidAndCounted);
    const totalMatches = safeMatches.length;

    // 1. Replay matches chronologically for the Doubles-Aware Ranking Model
    const chronoMatches = [...completedMatches].sort((a, b) => {
      const timeA = a.startTime || a.endTime || a.id || 0;
      const timeB = b.startTime || b.endTime || b.id || 0;
      return timeA - timeB;
    });

    interface TrackingInfo {
      rating: number;
      matchesCount: number;
      lastDelta: number;
      history: {
        matchId: number;
        timestamp: number;
        result: 1 | 0 | 0.5;
        pointDiff: number;
        delta: number;
      }[];
      lastMatchTime: number;
    }

    const playerTracking: Record<number, TrackingInfo> = {};

    const getTracker = (id: number): TrackingInfo => {
      if (!playerTracking[id]) {
        playerTracking[id] = {
          rating: 1000,
          matchesCount: 0,
          lastDelta: 0,
          history: [],
          lastMatchTime: 0
        };
      }
      return playerTracking[id];
    };

    // Simulate each match in chronological sequence
    chronoMatches.forEach((m) => {
      const pA1 = m.teamAPlayer1Id;
      const pA2 = m.teamAPlayer2Id || null;
      const pB1 = m.teamBPlayer1Id;
      const pB2 = m.teamBPlayer2Id || null;

      if (!pA1 || !pB1) return;

      const trackA1 = getTracker(pA1);
      const trackA2 = pA2 ? getTracker(pA2) : null;
      const trackB1 = getTracker(pB1);
      const trackB2 = pB2 ? getTracker(pB2) : null;

      const rA1 = trackA1.rating;
      const rA2 = trackA2 ? trackA2.rating : null;
      const rB1 = trackB1.rating;
      const rB2 = trackB2 ? trackB2.rating : null;

      const teamRatingA = rA2 != null ? (rA1 + rA2) / 2 : rA1;
      const teamRatingB = rB2 != null ? (rB1 + rB2) / 2 : rB1;

      // Elo Expected Win Probabilities (Factor 1: Opponent Strength - 40%)
      const expA = 1 / (1 + Math.pow(10, (teamRatingB - teamRatingA) / 400));
      const expB = 1 - expA;

      // Actual Result
      const sA = m.teamAScore ?? 0;
      const sB = m.teamBScore ?? 0;
      let actualA = 0.5;
      if (m.winnerTeam === 'A' || sA > sB) actualA = 1;
      else if (m.winnerTeam === 'B' || sB > sA) actualA = 0;
      const actualB = 1 - actualA;

      // Margin Multiplier (Factor 2: Winning Margin - 20%)
      const diff = Math.abs(sA - sB);
      let marginMultiplier = 1.0;
      if (diff >= 11) marginMultiplier = 1.15;
      else if (diff >= 6) marginMultiplier = 1.10;
      else if (diff >= 3) marginMultiplier = 1.05;
      else marginMultiplier = 1.00;

      const matchTime = m.endTime || m.startTime || Date.now();

      // Update function for each player
      const applyRatingChange = (
        tracker: TrackingInfo,
        selfRating: number,
        partnerRating: number | null,
        actual: number,
        expected: number,
        pointDiff: number
      ) => {
        // Confidence / K-Factor based on player maturity
        let K = 20;
        if (tracker.matchesCount < 10) K = 40;
        else if (tracker.matchesCount <= 25) K = 30;

        // Partner Adjustment (Factor 5: Partner Adjustment - 10%)
        let partnerWeight = 1.0;
        if (partnerRating != null) {
          const ratio = (2 * partnerRating) / (selfRating + partnerRating);
          partnerWeight = Math.min(1.25, Math.max(0.75, ratio));
        }

        // Recent Form (Factor 4: Recent Form - 10%)
        const recentHistory = tracker.history.slice(-5);
        let formMultiplier = 1.0;
        if (recentHistory.length >= 2) {
          const recentWins = recentHistory.filter((h) => h.result === 1).length;
          const recentWinRate = recentWins / recentHistory.length;
          formMultiplier = 1.0 + 0.10 * ((recentWinRate - 0.5) * 2); // 0.90 to 1.10
        }

        const baseDelta = K * (actual - expected);
        let delta = 0;
        if (actual >= expected) {
          delta = baseDelta * marginMultiplier * partnerWeight * formMultiplier;
        } else {
          delta = baseDelta * marginMultiplier * (2 - partnerWeight) * (2 - formMultiplier);
        }

        tracker.rating = Math.max(100, tracker.rating + delta);
        tracker.matchesCount += 1;
        tracker.lastDelta = delta;
        tracker.lastMatchTime = matchTime;
        tracker.history.push({
          matchId: m.id,
          timestamp: matchTime,
          result: actual as 1 | 0 | 0.5,
          pointDiff,
          delta
        });
      };

      // Apply to Team A
      applyRatingChange(trackA1, rA1, rA2, actualA, expA, sA - sB);
      if (trackA2 && rA2 != null) {
        applyRatingChange(trackA2, rA2, rA1, actualA, expA, sA - sB);
      }

      // Apply to Team B
      applyRatingChange(trackB1, rB1, rB2, actualB, expB, sB - sA);
      if (trackB2 && rB2 != null) {
        applyRatingChange(trackB2, rB2, rB1, actualB, expB, sB - sA);
      }
    });

    // Reference time for Attendance/Activity check (latest match or current)
    const latestTimestamp = chronoMatches.reduce(
      (acc, m) => Math.max(acc, m.endTime || m.startTime || 0),
      0
    ) || Date.now();

    const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

    return (players || []).map((rawPlayer: any) => {
      const player = rawPlayer?.player ? rawPlayer.player : rawPlayer;
      const pId = player?.id ?? rawPlayer?.playerId ?? 0;
      const playerName = String(player?.name || rawPlayer?.name || `Player ${pId}`).toUpperCase();
      const playerGender = player?.gender || rawPlayer?.gender || 'MALE';

      const playerMatches = completedMatches.filter(
        (m) =>
          m.teamAPlayer1Id === pId ||
          m.teamAPlayer2Id === pId ||
          m.teamBPlayer1Id === pId ||
          m.teamBPlayer2Id === pId
      );

      const gamesPlayed = playerMatches.length;
      const join = joinsMap[pId] || (rawPlayer?.isPaused !== undefined ? rawPlayer : undefined);
      let adjustedGames = 0;

      if (join) {
        if (join.isPaused && join.pausedAtMatchCount != null && courtCount > 0) {
          const matchesDuringPause = Math.max(0, totalMatches - join.pausedAtMatchCount);
          const avg = Math.round(matchesDuringPause / courtCount);
          adjustedGames = (join.adjustedGames || 0) + avg;
        } else {
          adjustedGames = join.adjustedGames || 0;
        }
      }

      let gamesWon = 0;
      let gamesLost = 0;
      let totalPointsScored = 0;
      let totalPointsConceded = 0;

      // Streaks
      const sortedMatches = [...playerMatches].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
      let maxWins = 0;
      let maxLosses = 0;
      let currentWins = 0;
      let currentLosses = 0;

      for (const m of sortedMatches) {
        const isOnTeamA = m.teamAPlayer1Id === pId || m.teamAPlayer2Id === pId;
        const isOnTeamB = m.teamBPlayer1Id === pId || m.teamBPlayer2Id === pId;
        const isWin = (isOnTeamA && m.winnerTeam === 'A') || (isOnTeamB && m.winnerTeam === 'B');
        const isLoss = (isOnTeamA && m.winnerTeam === 'B') || (isOnTeamB && m.winnerTeam === 'A');

        const scoreA = m.teamAScore ?? 0;
        const scoreB = m.teamBScore ?? 0;
        const pointsScored = isOnTeamA ? scoreA : scoreB;
        const pointsConceded = isOnTeamA ? scoreB : scoreA;

        totalPointsScored += pointsScored;
        totalPointsConceded += pointsConceded;

        if (isWin) {
          gamesWon++;
          currentWins++;
          currentLosses = 0;
          if (currentWins > maxWins) maxWins = currentWins;
        } else if (isLoss) {
          gamesLost++;
          currentLosses++;
          currentWins = 0;
          if (currentLosses > maxLosses) maxLosses = currentLosses;
        } else {
          currentWins = 0;
          currentLosses = 0;
        }
      }

      const winPercentage = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0;
      const averagePointsPerGame = gamesPlayed > 0 ? totalPointsScored / gamesPlayed : 0;

      // Post-match Factor 3: Consistency (15% weight over last 30-50 matches)
      const tracker = playerTracking[pId] || {
        rating: 1000,
        matchesCount: 0,
        lastDelta: 0,
        history: [],
        lastMatchTime: 0
      };

      let computedRating = tracker.rating;
      let consistencyScore = 80;
      if (tracker.history.length >= 3) {
        const sample = tracker.history.slice(-30);
        const pointDiffs = sample.map((h) => h.pointDiff);
        const mean = pointDiffs.reduce((a, b) => a + b, 0) / pointDiffs.length;
        const variance = pointDiffs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pointDiffs.length;
        const stdDev = Math.sqrt(variance);

        // Lower standard deviation = higher consistency
        consistencyScore = Math.max(10, Math.min(100, Math.round(Math.max(0, 1 - stdDev / 15) * 100)));
        const consistencyAdjustment = Math.round(
          ((consistencyScore / 100) - 0.5) * 30 * Math.min(1, tracker.history.length / 10)
        );
        computedRating = Math.max(100, computedRating + consistencyAdjustment);
      }

      // Factor 6: Attendance/Activity (5% weight after 4 weeks of inactivity)
      let activityStatus: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';
      let inactiveWeeks = 0;
      if (tracker.matchesCount > 0 && tracker.lastMatchTime > 0) {
        const elapsedSinceLastMatch = latestTimestamp - tracker.lastMatchTime;
        if (elapsedSinceLastMatch > FOUR_WEEKS_MS) {
          const daysInactive = elapsedSinceLastMatch / (24 * 60 * 60 * 1000);
          inactiveWeeks = Math.floor((daysInactive - 28) / 7) + 1;
          activityStatus = 'INACTIVE';
          // 5% decay rule: small weekly rating decay past 4 weeks
          const activityDecay = Math.min(120, inactiveWeeks * 10);
          if (computedRating > 1000) {
            computedRating = Math.max(1000, computedRating - activityDecay);
          }
        }
      }

      // Recent form win percentage (last 5 matches)
      let recentFormRate = 50;
      if (tracker.history.length > 0) {
        const last5 = tracker.history.slice(-5);
        const wins5 = last5.filter((h) => h.result === 1).length;
        recentFormRate = Math.round((wins5 / last5.length) * 100);
      }

      const finalRating = Math.round(computedRating);
      const ratingChange = finalRating - 1000;

      return {
        playerId: pId,
        name: playerName,
        gender: playerGender,
        gamesPlayed,
        adjustedGames,
        gamesWon,
        gamesLost,
        winPercentage,
        totalPointsScored,
        totalPointsConceded,
        averagePointsPerGame,
        consecutiveWins: maxWins,
        consecutiveLosses: maxLosses,
        rating: finalRating,
        ratingChange,
        lastRatingDelta: Math.round(tracker.lastDelta),
        recentFormRate,
        consistencyScore,
        activityStatus,
        inactiveWeeks
      };
    });
  },

  sortPlayersByRankRule(statsList: PlayerStats[]): PlayerStats[] {
    return [...statsList].sort((a, b) => {
      // Primary: Doubles-aware rating (descending)
      if (b.rating !== a.rating) return b.rating - a.rating;
      // Secondary: Win percentage
      if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
      // Tertiary: Games won
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      // Quaternary: Total points difference
      const diffB = b.totalPointsScored - b.totalPointsConceded;
      const diffA = a.totalPointsScored - a.totalPointsConceded;
      if (diffB !== diffA) return diffB - diffA;
      // Quinary: Player name
      return a.name.localeCompare(b.name);
    });
  },

  groupPlayersByTier(sortedList: PlayerStats[]): { A: PlayerStats[]; B: PlayerStats[]; C: PlayerStats[] } {
    const total = sortedList.length;
    const groupA: PlayerStats[] = [];
    const groupB: PlayerStats[] = [];
    const groupC: PlayerStats[] = [];

    sortedList.forEach((stats, index) => {
      if (index < total * 0.25) {
        groupA.push(stats);
      } else if (index < total * 0.75) {
        groupB.push(stats);
      } else {
        groupC.push(stats);
      }
    });

    return { A: groupA, B: groupB, C: groupC };
  },

  calculateSessionStats(
    session: SessionEntity,
    courts: CourtEntity[],
    matches: MatchEntity[]
  ): SessionStats {
    const totalGames = matches.filter(isMatchValidAndCounted).length;
    const gamesMap: Record<number, number> = {};
    courts.forEach((court) => {
      gamesMap[court.id] = matches.filter((m) => m.courtId === court.id && isMatchValidAndCounted(m)).length;
    });

    const startTime = session.startTime ?? Date.now();
    const endTime = session.endTime ?? Date.now();
    const duration = Math.max(0, endTime - startTime);

    const utilizationMap: Record<number, number> = {};
    courts.forEach((court) => {
      const courtMatches = matches.filter((m) => m.courtId === court.id);
      const activeTimeMs = courtMatches.reduce((acc, m) => {
        const mStart = m.startTime;
        const mEnd = m.endTime ?? Date.now();
        return acc + Math.max(0, mEnd - mStart);
      }, 0);

      const percentage = duration > 0 ? Math.min(100, (activeTimeMs / duration) * 100) : 0;
      utilizationMap[court.id] = percentage;
    });

    return {
      sessionId: session.id,
      sessionName: session.name,
      totalGamesPlayed: totalGames,
      gamesPerCourt: gamesMap,
      courtUtilization: utilizationMap,
      durationMs: duration
    };
  }
};

// --- Fair Match Allocation Algorithm matching Android BadmintonRepository.kt ---
export interface MatchOptionDoubles {
  p1: PlayerEntity;
  p2: PlayerEntity;
  p3: PlayerEntity;
  p4: PlayerEntity;
  gamesPlayedSum: number;
  partnerCost: number;
  opponentCost: number;
  restSum: number;
}

export interface MatchOptionSingles {
  p1: PlayerEntity;
  p2: PlayerEntity;
  gamesPlayedSum: number;
  restSum: number;
}

export const FairMatchAllocation = {
  generateMatchForCourt(
    sessionId: number,
    courtId: number,
    gameType: GameType,
    allPlayers: PlayerEntity[],
    joins: SessionPlayerJoinEntity[],
    matches: MatchEntity[],
    courts: CourtEntity[]
  ): Omit<MatchEntity, 'id'> | null {
    const effectiveGameType = gameType === 'MULTI_TYPE' ? 'DOUBLES' : gameType;

    // 1. Identify currently playing players
    const activeMatches = matches.filter((m) => m.endTime == null);
    const activePlayingPlayerIds = new Set<number>();
    for (const m of activeMatches) {
      activePlayingPlayerIds.add(m.teamAPlayer1Id);
      if (m.teamAPlayer2Id) activePlayingPlayerIds.add(m.teamAPlayer2Id);
      activePlayingPlayerIds.add(m.teamBPlayer1Id);
      if (m.teamBPlayer2Id) activePlayingPlayerIds.add(m.teamBPlayer2Id);
    }

    // 2. Identify candidate players in session
    const sessionPlayerIds = joins.map((j) => j.playerId);
    const candidatePlayers = allPlayers.filter((p) => {
      if (!sessionPlayerIds.includes(p.id)) return false;
      if (activePlayingPlayerIds.has(p.id)) return false;

      const join = joins.find((j) => j.playerId === p.id);
      if (!join || join.isPaused) return false;

      // Court eligibility check
      if (join.eligibleCourtIds) {
        let eligible: number[] = [];
        if (Array.isArray(join.eligibleCourtIds)) {
          eligible = (join.eligibleCourtIds as any[]).map((v) => Number(v)).filter((n) => !isNaN(n));
        } else if (typeof join.eligibleCourtIds === 'string') {
          eligible = join.eligibleCourtIds.split(',').map((idStr) => Number(idStr.trim())).filter((n) => !isNaN(n));
        }
        if (eligible.length > 0 && !eligible.includes(courtId)) return false;
      }
      return true;
    });

    const activeCourtCount = courts.length || 1;
    const totalSessionMatches = matches.filter(isMatchValidAndCounted).length;

    // 3. Build Games Count Map (Actual + Effective Adjusted)
    const gamesCountMap: Record<number, number> = {};
    const lastPlayedMatchMap: Record<number, number> = {};

    candidatePlayers.forEach((p) => {
      const pId = p.id;
      const completedCount = matches.filter(
        (m) =>
          isMatchValidAndCounted(m) &&
          (m.teamAPlayer1Id === pId ||
            m.teamAPlayer2Id === pId ||
            m.teamBPlayer1Id === pId ||
            m.teamBPlayer2Id === pId)
      ).length;

      const join = joins.find((j) => j.playerId === pId);
      let adjusted = join ? join.adjustedGames : 0;
      if (join && join.isPaused && join.pausedAtMatchCount != null) {
        const pausedMatches = Math.max(0, totalSessionMatches - join.pausedAtMatchCount);
        adjusted += Math.round(pausedMatches / activeCourtCount);
      }

      gamesCountMap[pId] = completedCount + adjusted;

      // Find last match index
      const playerMatches = matches.filter(
        (m) =>
          isMatchValidAndCounted(m) &&
          (m.teamAPlayer1Id === pId ||
            m.teamAPlayer2Id === pId ||
            m.teamBPlayer1Id === pId ||
            m.teamBPlayer2Id === pId)
      );
      if (playerMatches.length > 0) {
        const maxMatchNum = Math.max(...playerMatches.map((m) => m.matchNumber));
        lastPlayedMatchMap[pId] = maxMatchNum;
      } else {
        lastPlayedMatchMap[pId] = 0;
      }
    });

    // 4. Partner and Opponent history matrices
    const partnerHistory: Record<string, number> = {};
    const opponentHistory: Record<string, number> = {};

    matches.filter(isMatchValidAndCounted).forEach((m) => {
      // Partner History
      if (m.teamAPlayer1Id && m.teamAPlayer2Id) {
        const keyA = [m.teamAPlayer1Id, m.teamAPlayer2Id].sort((a, b) => a - b).join('-');
        partnerHistory[keyA] = (partnerHistory[keyA] || 0) + 1;
      }
      if (m.teamBPlayer1Id && m.teamBPlayer2Id) {
        const keyB = [m.teamBPlayer1Id, m.teamBPlayer2Id].sort((a, b) => a - b).join('-');
        partnerHistory[keyB] = (partnerHistory[keyB] || 0) + 1;
      }

      // Opponent History
      const teamAPlayers = [m.teamAPlayer1Id, m.teamAPlayer2Id].filter(Boolean) as number[];
      const teamBPlayers = [m.teamBPlayer1Id, m.teamBPlayer2Id].filter(Boolean) as number[];
      teamAPlayers.forEach((pA) => {
        teamBPlayers.forEach((pB) => {
          const oppKey = [pA, pB].sort((a, b) => a - b).join('-');
          opponentHistory[oppKey] = (opponentHistory[oppKey] || 0) + 1;
        });
      });
    });

    const nextMatchNumber = totalSessionMatches + 1;

    // --- DOUBLES MODE ---
    if (effectiveGameType === 'DOUBLES') {
      if (candidatePlayers.length < 4) return null;

      const options: MatchOptionDoubles[] = [];
      const n = candidatePlayers.length;

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          for (let k = j + 1; k < n; k++) {
            for (let l = k + 1; l < n; l++) {
              const p1 = candidatePlayers[i];
              const p2 = candidatePlayers[j];
              const p3 = candidatePlayers[k];
              const p4 = candidatePlayers[l];

              const gpSum =
                (gamesCountMap[p1.id] || 0) +
                (gamesCountMap[p2.id] || 0) +
                (gamesCountMap[p3.id] || 0) +
                (gamesCountMap[p4.id] || 0);

              const restSum =
                (lastPlayedMatchMap[p1.id] || 0) +
                (lastPlayedMatchMap[p2.id] || 0) +
                (lastPlayedMatchMap[p3.id] || 0) +
                (lastPlayedMatchMap[p4.id] || 0);

              // 3 possible pairings for the 4 players
              const pairings = [
                { tA: [p1, p2], tB: [p3, p4] },
                { tA: [p1, p3], tB: [p2, p4] },
                { tA: [p1, p4], tB: [p2, p3] }
              ];

              pairings.forEach((pair) => {
                const pKeyA = [pair.tA[0].id, pair.tA[1].id].sort((a, b) => a - b).join('-');
                const pKeyB = [pair.tB[0].id, pair.tB[1].id].sort((a, b) => a - b).join('-');
                const partnerCost = (partnerHistory[pKeyA] || 0) + (partnerHistory[pKeyB] || 0);

                let opponentCost = 0;
                pair.tA.forEach((pa) => {
                  pair.tB.forEach((pb) => {
                    const oKey = [pa.id, pb.id].sort((a, b) => a - b).join('-');
                    opponentCost += opponentHistory[oKey] || 0;
                  });
                });

                options.push({
                  p1: pair.tA[0],
                  p2: pair.tA[1],
                  p3: pair.tB[0],
                  p4: pair.tB[1],
                  gamesPlayedSum: gpSum,
                  partnerCost,
                  opponentCost,
                  restSum
                });
              });
            }
          }
        }
      }

      options.sort((a, b) => {
        if (a.gamesPlayedSum !== b.gamesPlayedSum) return a.gamesPlayedSum - b.gamesPlayedSum;
        if (a.partnerCost !== b.partnerCost) return a.partnerCost - b.partnerCost;
        if (a.opponentCost !== b.opponentCost) return a.opponentCost - b.opponentCost;
        if (a.restSum !== b.restSum) return a.restSum - b.restSum;
        return Math.random() - 0.5;
      });

      const best = options[0];
      if (!best) return null;

      return {
        sessionId,
        courtId,
        matchNumber: nextMatchNumber,
        teamAPlayer1Id: best.p1.id,
        teamAPlayer2Id: best.p2.id,
        teamBPlayer1Id: best.p3.id,
        teamBPlayer2Id: best.p4.id,
        teamAScore: 0,
        teamBScore: 0,
        winnerTeam: null,
        startTime: Date.now(),
        endTime: null
      };
    }

    // --- MIXED DOUBLES MODE ---
    if (effectiveGameType === 'MIXED_DOUBLES') {
      const males = candidatePlayers.filter((p) => p.gender === 'MALE');
      const females = candidatePlayers.filter((p) => p.gender === 'FEMALE');

      if (males.length < 2 || females.length < 2) return null;

      const options: MatchOptionDoubles[] = [];

      for (let mIdx1 = 0; mIdx1 < males.length; mIdx1++) {
        for (let mIdx2 = mIdx1 + 1; mIdx2 < males.length; mIdx2++) {
          for (let fIdx1 = 0; fIdx1 < females.length; fIdx1++) {
            for (let fIdx2 = fIdx1 + 1; fIdx2 < females.length; fIdx2++) {
              const m1 = males[mIdx1];
              const m2 = males[mIdx2];
              const f1 = females[fIdx1];
              const f2 = females[fIdx2];

              const gpSum =
                (gamesCountMap[m1.id] || 0) +
                (gamesCountMap[m2.id] || 0) +
                (gamesCountMap[f1.id] || 0) +
                (gamesCountMap[f2.id] || 0);

              const restSum =
                (lastPlayedMatchMap[m1.id] || 0) +
                (lastPlayedMatchMap[m2.id] || 0) +
                (lastPlayedMatchMap[f1.id] || 0) +
                (lastPlayedMatchMap[f2.id] || 0);

              const pairings = [
                { tA: [m1, f1], tB: [m2, f2] },
                { tA: [m1, f2], tB: [m2, f1] }
              ];

              pairings.forEach((pair) => {
                const pKeyA = [pair.tA[0].id, pair.tA[1].id].sort((a, b) => a - b).join('-');
                const pKeyB = [pair.tB[0].id, pair.tB[1].id].sort((a, b) => a - b).join('-');
                const partnerCost = (partnerHistory[pKeyA] || 0) + (partnerHistory[pKeyB] || 0);

                let opponentCost = 0;
                pair.tA.forEach((pa) => {
                  pair.tB.forEach((pb) => {
                    const oKey = [pa.id, pb.id].sort((a, b) => a - b).join('-');
                    opponentCost += opponentHistory[oKey] || 0;
                  });
                });

                options.push({
                  p1: pair.tA[0],
                  p2: pair.tA[1],
                  p3: pair.tB[0],
                  p4: pair.tB[1],
                  gamesPlayedSum: gpSum,
                  partnerCost,
                  opponentCost,
                  restSum
                });
              });
            }
          }
        }
      }

      options.sort((a, b) => {
        if (a.gamesPlayedSum !== b.gamesPlayedSum) return a.gamesPlayedSum - b.gamesPlayedSum;
        if (a.partnerCost !== b.partnerCost) return a.partnerCost - b.partnerCost;
        if (a.opponentCost !== b.opponentCost) return a.opponentCost - b.opponentCost;
        if (a.restSum !== b.restSum) return a.restSum - b.restSum;
        return Math.random() - 0.5;
      });

      const best = options[0];
      if (!best) return null;

      return {
        sessionId,
        courtId,
        matchNumber: nextMatchNumber,
        teamAPlayer1Id: best.p1.id,
        teamAPlayer2Id: best.p2.id,
        teamBPlayer1Id: best.p3.id,
        teamBPlayer2Id: best.p4.id,
        teamAScore: 0,
        teamBScore: 0,
        winnerTeam: null,
        startTime: Date.now(),
        endTime: null
      };
    }

    // --- SINGLES MODE ---
    if (effectiveGameType === 'SINGLES') {
      if (candidatePlayers.length < 2) return null;

      const options: MatchOptionSingles[] = [];
      const n = candidatePlayers.length;

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const p1 = candidatePlayers[i];
          const p2 = candidatePlayers[j];

          const gpSum = (gamesCountMap[p1.id] || 0) + (gamesCountMap[p2.id] || 0);
          const restSum = (lastPlayedMatchMap[p1.id] || 0) + (lastPlayedMatchMap[p2.id] || 0);

          options.push({
            p1,
            p2,
            gamesPlayedSum: gpSum,
            restSum
          });
        }
      }

      options.sort((a, b) => {
        if (a.gamesPlayedSum !== b.gamesPlayedSum) return a.gamesPlayedSum - b.gamesPlayedSum;
        if (a.restSum !== b.restSum) return a.restSum - b.restSum;
        return Math.random() - 0.5;
      });

      const best = options[0];
      if (!best) return null;

      return {
        sessionId,
        courtId,
        matchNumber: nextMatchNumber,
        teamAPlayer1Id: best.p1.id,
        teamAPlayer2Id: null,
        teamBPlayer1Id: best.p2.id,
        teamBPlayer2Id: null,
        teamAScore: 0,
        teamBScore: 0,
        winnerTeam: null,
        startTime: Date.now(),
        endTime: null
      };
    }

    return null;
  }
};

// --- Report Exporter matching Android ReportExporter.kt ---
export const ReportExporter = {
  exportPdf(
    club: ClubEntity | null,
    session: SessionEntity,
    courts: CourtEntity[],
    players: PlayerEntity[],
    matches: MatchEntity[],
    playerStatsList: PlayerStats[]
  ) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const clubName = club?.name || 'Badminton Club';
    const venue = club?.venue || 'Main Sports Hall';
    const dateStr = new Date(session.createdAt || Date.now()).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    // 1. Header Section
    doc.setFontSize(20);
    doc.setTextColor(2, 132, 199); // #0284C7
    doc.text(clubName.toUpperCase(), 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Venue: ${venue}  |  Date: ${dateStr}`, 14, 26);
    doc.text(`Session: ${session.name} (${session.type})`, 14, 31);

    // 2. Summary Metrics
    const completedMatches = matches.filter((m) => m.endTime != null);
    const durationMin = session.startTime && session.endTime
      ? Math.round((session.endTime - session.startTime) / 60000)
      : Math.round(matches.length * 15);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 35, 196, 35);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Courts: ${courts.length}    Total Matches: ${completedMatches.length}    Active Players: ${playerStatsList.filter(p => p.gamesPlayed > 0).length}    Duration: ~${durationMin} mins`, 14, 42);

    // 3. Leaderboard Table
    const sortedLeaderboard = StatsCalculator.sortPlayersByRankRule(playerStatsList);
    const leaderboardRows = sortedLeaderboard.map((stat, idx) => [
      `#${idx + 1}`,
      stat.name,
      `${stat.rating} (${stat.ratingChange >= 0 ? '+' : ''}${stat.ratingChange})`,
      stat.adjustedGames > 0 ? `${stat.gamesPlayed} (${stat.adjustedGames})` : `${stat.gamesPlayed}`,
      stat.gamesWon,
      stat.gamesLost,
      `${stat.winPercentage.toFixed(1)}%`,
      `${stat.totalPointsScored} : ${stat.totalPointsConceded}`,
      stat.averagePointsPerGame.toFixed(1)
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['Rank', 'Player Name', 'Rating', 'Played', 'Won', 'Lost', 'Win %', 'Points +/-', 'Avg Pts']],
      body: leaderboardRows,
      theme: 'striped',
      headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { fontStyle: 'bold' },
        2: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 12, halign: 'center' },
        6: { cellWidth: 16, halign: 'center' },
        7: { cellWidth: 24, halign: 'center' },
        8: { cellWidth: 16, halign: 'center' }
      }
    });

    // 4. Match Records Table
    const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 150;
    
    doc.setFontSize(13);
    doc.setTextColor(2, 132, 199);
    doc.text('MATCH RECORDS', 14, lastY + 12);

    const matchRows = completedMatches
      .sort((a, b) => a.matchNumber - b.matchNumber)
      .map((m) => {
        const courtName = courts.find((c) => c.id === m.courtId)?.name || `Court ${m.courtId}`;
        const p1A = players.find((p) => p.id === m.teamAPlayer1Id)?.name || '';
        const p2A = m.teamAPlayer2Id ? players.find((p) => p.id === m.teamAPlayer2Id)?.name : null;
        const teamA = p2A ? `${p1A} & ${p2A}` : p1A;

        const p1B = players.find((p) => p.id === m.teamBPlayer1Id)?.name || '';
        const p2B = m.teamBPlayer2Id ? players.find((p) => p.id === m.teamBPlayer2Id)?.name : null;
        const teamB = p2B ? `${p1B} & ${p2B}` : p1B;

        const score = `${m.teamAScore ?? 0} - ${m.teamBScore ?? 0}`;
        const winner = m.winnerTeam === 'A' ? 'Team A' : m.winnerTeam === 'B' ? 'Team B' : 'Draw';

        return [`Match ${m.matchNumber}`, courtName, teamA, teamB, score, winner];
      });

    autoTable(doc, {
      startY: lastY + 16,
      head: [['Match #', 'Court', 'Team A', 'Team B', 'Score', 'Winner']],
      body: matchRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 22 },
        4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 20, halign: 'center' }
      }
    });

    doc.save(`${session.name.replace(/\s+/g, '_')}_Report.pdf`);
  },

  exportCsv(
    session: SessionEntity,
    courts: CourtEntity[],
    players: PlayerEntity[],
    matches: MatchEntity[],
    playerStatsList: PlayerStats[]
  ) {
    const csvLines: string[] = [];
    csvLines.push(`Session Name,${session.name}`);
    csvLines.push(`Session Type,${session.type}`);
    csvLines.push(`Date,${new Date(session.createdAt || Date.now()).toLocaleDateString()}`);
    csvLines.push('');
    
    // Leaderboard Section
    csvLines.push('LEADERBOARD');
    csvLines.push('Rank,Player Name,Rating,Rating Change,Games Played,Games Won,Games Lost,Win Percentage,Points Scored,Points Conceded,Avg Points');
    const sortedLeaderboard = StatsCalculator.sortPlayersByRankRule(playerStatsList);
    sortedLeaderboard.forEach((s, idx) => {
      csvLines.push(`${idx + 1},"${s.name}",${s.rating},${s.ratingChange >= 0 ? '+' : ''}${s.ratingChange},${s.gamesPlayed},${s.gamesWon},${s.gamesLost},${s.winPercentage.toFixed(1)}%,${s.totalPointsScored},${s.totalPointsConceded},${s.averagePointsPerGame.toFixed(1)}`);
    });

    csvLines.push('');
    csvLines.push('MATCHES');
    csvLines.push('Match Number,Court,Team A Player 1,Team A Player 2,Team B Player 1,Team B Player 2,Team A Score,Team B Score,Winner');
    matches.forEach((m) => {
      const courtName = courts.find((c) => c.id === m.courtId)?.name || `Court ${m.courtId}`;
      const p1A = players.find((p) => p.id === m.teamAPlayer1Id)?.name || '';
      const p2A = m.teamAPlayer2Id ? players.find((p) => p.id === m.teamAPlayer2Id)?.name || '' : '';
      const p1B = players.find((p) => p.id === m.teamBPlayer1Id)?.name || '';
      const p2B = m.teamBPlayer2Id ? players.find((p) => p.id === m.teamBPlayer2Id)?.name || '' : '';
      csvLines.push(`${m.matchNumber},"${courtName}","${p1A}","${p2A}","${p1B}","${p2B}",${m.teamAScore ?? 0},${m.teamBScore ?? 0},${m.winnerTeam || 'N/A'}`);
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${session.name.replace(/\s+/g, '_')}_Stats.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  exportWeeklyLeaderboardPdf(
    club: ClubEntity | null,
    groupTitle: string,
    sessions: SessionEntity[],
    playerStatsList: PlayerStats[]
  ) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const clubName = club?.name || 'Badminton Club';
    const venue = club?.venue || 'Main Sports Hall';
    const dateStr = new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    // 1. Header Section
    doc.setFontSize(20);
    doc.setTextColor(2, 132, 199); // #0284C7
    doc.text(clubName.toUpperCase(), 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Venue: ${venue}  |  Generated: ${dateStr}`, 14, 26);
    doc.text(`Weekly Session Leaderboard: ${groupTitle} (${sessions.length} sessions played)`, 14, 31);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 35, 196, 35);

    const sortedLeaderboard = StatsCalculator.sortPlayersByRankRule(playerStatsList);
    const leaderboardRows = sortedLeaderboard.map((stat, idx) => [
      `#${idx + 1}`,
      stat.name,
      `${stat.rating} (${stat.ratingChange >= 0 ? '+' : ''}${stat.ratingChange})`,
      stat.gamesPlayed.toString(),
      stat.gamesWon.toString(),
      stat.gamesLost.toString(),
      `${stat.winPercentage.toFixed(1)}%`,
      `${stat.totalPointsScored} : ${stat.totalPointsConceded}`,
      `${stat.consecutiveWins}W`,
      stat.averagePointsPerGame.toFixed(1)
    ]);

    autoTable(doc, {
      startY: 42,
      head: [['Rank', 'Player Name', 'Rating', 'Played', 'Won', 'Lost', 'Win %', 'Points +/-', 'Streak', 'Avg Pts']],
      body: leaderboardRows,
      theme: 'striped',
      headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { fontStyle: 'bold' },
        2: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 14, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 24, halign: 'center' },
        8: { cellWidth: 16, halign: 'center' },
        9: { cellWidth: 18, halign: 'center' }
      }
    });

    doc.save(`${groupTitle.replace(/\s+/g, '_')}_Leaderboard.pdf`);
  },

  exportWeeklyLeaderboardCsv(
    groupTitle: string,
    sessions: SessionEntity[],
    playerStatsList: PlayerStats[]
  ) {
    const csvLines: string[] = [];
    csvLines.push(`Weekly Session Group,${groupTitle}`);
    csvLines.push(`Sessions Included,${sessions.length}`);
    csvLines.push(`Generated Date,${new Date().toLocaleDateString()}`);
    csvLines.push('');
    csvLines.push('Rank,Player Name,Rating,Rating Change,Matches Played,Matches Won,Matches Lost,Win Percentage,Points Scored,Points Conceded,Max Win Streak,Avg Points');
    const sortedLeaderboard = StatsCalculator.sortPlayersByRankRule(playerStatsList);
    sortedLeaderboard.forEach((s, idx) => {
      csvLines.push(`${idx + 1},"${s.name}",${s.rating},${s.ratingChange >= 0 ? '+' : ''}${s.ratingChange},${s.gamesPlayed},${s.gamesWon},${s.gamesLost},${s.winPercentage.toFixed(1)}%,${s.totalPointsScored},${s.totalPointsConceded},${s.consecutiveWins},${s.averagePointsPerGame.toFixed(1)}`);
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${groupTitle.replace(/\s+/g, '_')}_Leaderboard.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
