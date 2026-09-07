import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  Plus, 
  RotateCcw, 
  Users, 
  Clock, 
  Trophy, 
  Pause, 
  PlayCircle, 
  UserCheck, 
  Sparkles, 
  Award, 
  Trash2,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  ChevronDown,
  Check,
  X,
  Settings,
  BarChart3,
  Shuffle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { 
  SessionEntity, 
  CourtEntity, 
  PlayerEntity, 
  SessionPlayerJoinEntity, 
  MatchEntity, 
  ClubEntity,
  PlayerStats,
  GameType,
  Gender,
  CourtMasterEntity
} from '../types';
import { FairMatchAllocation, StatsCalculator, soundEngine } from '../utils/badmintonLogic';

export function calculateWinningScore(losingScore: number, targetScore: number = 21): number {
  const maxCap = targetScore === 15 ? 20 : (targetScore === 21 ? 30 : targetScore + 9);
  if (losingScore < 0) return targetScore;
  if (losingScore >= maxCap) return maxCap;

  // BWF Official Badminton Scoring / Deuce Rules:
  // If losingScore < targetScore - 1 (e.g. 0..13 for 15-pt game, or 0..19 for 21-pt game):
  // Winning score is targetScore (e.g. 15 or 21).
  // If losingScore >= targetScore - 1 (e.g. 14 for 15-pt game, or 20 for 21-pt game):
  // It is deuce! The winner must lead by 2 points (losingScore + 2), capped at maxCap.
  if (losingScore < targetScore - 1) {
    return targetScore;
  } else {
    return Math.min(losingScore + 2, maxCap);
  }
}

interface LiveSessionScreenProps {
  clubDetails: ClubEntity | null;
  activeSession: SessionEntity | null;
  courts: CourtEntity[];
  players: PlayerEntity[];
  joins: SessionPlayerJoinEntity[];
  matches: MatchEntity[];
  courtMasters?: CourtMasterEntity[];
  onStartSession: () => Promise<void>;
  onEndSession: () => Promise<void>;
  onGenerateMatch: (courtId: number) => Promise<void>;
  onUpdateScore: (matchId: number, teamAScore: number, teamBScore: number) => Promise<void>;
  onFinishMatch: (matchId: number, teamAScore: number, teamBScore: number, winner: 'A' | 'B') => Promise<void>;
  onCancelMatch: (matchId: number) => Promise<void>;
  onTogglePlayerPause: (playerId: number) => Promise<void>;
  onAddPAYGPlayerToSession: (name: string, gender: 'MALE' | 'FEMALE') => Promise<void>;
  onSwitchMatchPlayers: (matchId: number) => Promise<void>;
  onAddCourtToSession?: (name: string, gameType?: GameType) => Promise<void>;
  onDeleteCourtFromSession?: (courtId: number) => Promise<void>;
  onUpdateCourtGameType?: (courtId: number, gameType: GameType) => Promise<void>;
  onAddPlayerToSession?: (playerId: number) => Promise<void>;
  onRemovePlayerFromSession?: (playerId: number) => Promise<void>;
  onUpdatePlayerCourtEligibility?: (playerId: number, eligibleCourtIds: number[] | null) => Promise<void>;
  onAddPlayerToMaster?: (name: string, gender: Gender, isPAYG: boolean) => Promise<void>;
  onTogglePlayerPAYG?: (playerId: number, currentPAYG: boolean) => Promise<void>;
  onNavigateToSessions?: () => void;
}

export const LiveSessionScreen: React.FC<LiveSessionScreenProps> = ({
  clubDetails,
  activeSession,
  courts,
  players,
  joins,
  matches,
  courtMasters = [],
  onStartSession,
  onEndSession,
  onGenerateMatch,
  onFinishMatch,
  onCancelMatch,
  onTogglePlayerPause,
  onAddPAYGPlayerToSession,
  onSwitchMatchPlayers,
  onAddCourtToSession,
  onDeleteCourtFromSession,
  onUpdateCourtGameType,
  onAddPlayerToSession,
  onRemovePlayerFromSession,
  onUpdatePlayerCourtEligibility,
  onAddPlayerToMaster,
  onTogglePlayerPAYG,
  onNavigateToSessions,
}) => {
  // Main 3-Tab Structure requested: Session | Games | Stats
  const [activeTab, setActiveTab] = useState<'SESSION' | 'GAMES' | 'STATS'>(
    activeSession?.status === 'Active' ? 'GAMES' : 'SESSION'
  );

  // Rotation Sub-Tabs inside Games
  const [rotationTab, setRotationTab] = useState<'WAITING' | 'PLAYING' | 'PAUSED'>('WAITING');
  
  // Stats Tab Sub-Toggle: Standings vs Match Records
  const [statsView, setStatsView] = useState<'STANDINGS' | 'MATCHES'>('STANDINGS');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  
  // Duration Clock
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  
  // Quick Add PAYG Modal
  const [isAddPAYGOpen, setIsAddPAYGOpen] = useState<boolean>(false);
  const [paygName, setPaygName] = useState<string>('');
  const [paygGender, setPaygGender] = useState<'MALE' | 'FEMALE'>('MALE');

  // Finish Game Dialog with auto-score population
  const [finishingMatch, setFinishingMatch] = useState<MatchEntity | null>(null);
  const [scoreInputA, setScoreInputA] = useState<string>('');
  const [scoreInputB, setScoreInputB] = useState<string>('');

  // Delete / End Game Dialog State (Mobile App Parity)
  const [deletingMatch, setDeletingMatch] = useState<MatchEntity | null>(null);
  const [deleteShowRecordScore, setDeleteShowRecordScore] = useState<boolean>(false);
  const [deleteScoreA, setDeleteScoreA] = useState<string>('');
  const [deleteScoreB, setDeleteScoreB] = useState<string>('');

  // End Session Confirmation Modal
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState<boolean>(false);

  // Manage Courts Dialog
  const [showManageCourtsModal, setShowManageCourtsModal] = useState<boolean>(false);
  const [newCourtName, setNewCourtName] = useState<string>('');
  const [newCourtGameType, setNewCourtGameType] = useState<GameType>('DOUBLES');

  // Manage Players Pool Dialog
  const [showManagePlayersModal, setShowManagePlayersModal] = useState<boolean>(false);
  const [searchPlayerQuery, setSearchPlayerQuery] = useState<string>('');
  const [isCreatingNewPlayerInPool, setIsCreatingNewPlayerInPool] = useState<boolean>(false);
  const [newPoolPlayerName, setNewPoolPlayerName] = useState<string>('');
  const [newPoolPlayerGender, setNewPoolPlayerGender] = useState<Gender>('MALE');
  const [newPoolPlayerPAYG, setNewPoolPlayerPAYG] = useState<boolean>(false);

  // Court Eligibility Dialog
  const [editingEligibilityPlayerId, setEditingEligibilityPlayerId] = useState<number | null>(null);
  const [selectedEligibleCourtIds, setSelectedEligibleCourtIds] = useState<number[]>([]);

  const targetScore = clubDetails?.targetScore || 21;
  const maxScoreLimit = targetScore === 15 ? 20 : (targetScore === 21 ? 30 : targetScore + 9);

  useEffect(() => {
    if (!activeSession) return;
    const startTime = activeSession.startTime || activeSession.createdAt || Date.now();
    const updateTimer = () => {
      if (activeSession.status === 'End' && activeSession.endTime) {
        setElapsedSeconds(Math.max(0, Math.floor((activeSession.endTime - startTime) / 1000)));
      } else {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  if (!activeSession) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto text-2xl font-bold border border-amber-500/20">
          🏸
        </div>
        <h2 className="text-xl font-black text-slate-100 tracking-tight">No Active Session Selected</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Please select or start a weekly or ad-hoc badminton session from the Sessions Management dashboard to view courts, live rotation, and standings.
        </p>
        {onNavigateToSessions && (
          <button
            type="button"
            onClick={onNavigateToSessions}
            className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-950 transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            <span>Go to Sessions Management</span>
          </button>
        )}
      </div>
    );
  }

  // Active matches mapped by courtId
  const activeMatchesMap: Record<number, MatchEntity> = {};
  matches.forEach((m) => {
    if (!m.endTime) {
      activeMatchesMap[m.courtId] = m;
    }
  });

  // Calculate rotation state
  const playingPlayerIds = new Set<number>();
  Object.values(activeMatchesMap).forEach((m) => {
    playingPlayerIds.add(m.teamAPlayer1Id);
    if (m.teamAPlayer2Id) playingPlayerIds.add(m.teamAPlayer2Id);
    playingPlayerIds.add(m.teamBPlayer1Id);
    if (m.teamBPlayer2Id) playingPlayerIds.add(m.teamBPlayer2Id);
  });

  const sessionPlayers = joins.map((j) => {
    const player = players.find((p) => p.id === j.playerId);
    return {
      ...j,
      player,
      isPlaying: playingPlayerIds.has(j.playerId)
    };
  }).filter((sp): sp is (SessionPlayerJoinEntity & { player: PlayerEntity; isPlaying: boolean }) => Boolean(sp.player));

  const playingPlayers = sessionPlayers.filter((p) => p.isPlaying);
  const pausedPlayers = sessionPlayers.filter((p) => p.isPaused && !p.isPlaying);
  const waitingPlayers = sessionPlayers.filter((p) => !p.isPaused && !p.isPlaying);

  // Completed matches
  const completedMatches = matches
    .filter((m) => Boolean(m.endTime))
    .sort((a, b) => (b.endTime || 0) - (a.endTime || 0));

  // Player stats
  const sessionPlayerEntities = sessionPlayers.map((sp) => sp.player);
  const joinsMap: Record<number, SessionPlayerJoinEntity> = {};
  joins.forEach((j) => {
    joinsMap[j.playerId] = j;
  });
  const rawStatsList: PlayerStats[] = StatsCalculator.calculatePlayerStats(
    sessionPlayerEntities,
    matches,
    joinsMap,
    courts.length
  );
  const statsList: PlayerStats[] = StatsCalculator.sortPlayersByRankRule(rawStatsList);

  // Court Utilisation stats
  const courtUtilisation = courts.map((court) => {
    const courtMatches = completedMatches.filter((m) => m.courtId === court.id);
    const activeCourtMatch = activeMatchesMap[court.id];
    const gamesCount = courtMatches.length + (activeCourtMatch ? 1 : 0);
    const totalSessionMatches = matches.length || 1;
    const utilPercentage = Math.min(100, Math.round((gamesCount / totalSessionMatches) * 100));
    return {
      court,
      gamesCount,
      utilPercentage
    };
  });

  // Format Elapsed Time
  const formatDuration = (totalSecs: number) => {
    if (!totalSecs || isNaN(totalSecs) || totalSecs < 0) return '0m 00s';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Helper: Get games played count for a player
  const getPlayerGamesCount = (playerId: number): number => {
    const st = statsList.find((s) => s.playerId === playerId);
    return st?.gamesPlayed || 0;
  };

  // Helper: Format player name with games count
  const renderPlayerWithCount = (playerId: number) => {
    const p = players.find((pl) => pl.id === playerId);
    if (!p) return 'Unknown';
    const count = getPlayerGamesCount(playerId);
    return (
      <span className="inline-flex items-center gap-1">
        <span>{p.name}</span>
        <span className="text-[10px] font-mono text-slate-400 font-normal">({count})</span>
      </span>
    );
  };

  // Auto-Score calculations for Finish Match Modal
  const handleScoreAChange = (val: string) => {
    setScoreInputA(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      const autoB = calculateWinningScore(num, targetScore);
      setScoreInputB(autoB.toString());
    }
  };

  const handleScoreBChange = (val: string) => {
    setScoreInputB(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      const autoA = calculateWinningScore(num, targetScore);
      setScoreInputA(autoA.toString());
    }
  };

  // Auto-Score calculations for Delete / End Game Modal
  const handleDeleteScoreAChange = (val: string) => {
    setDeleteScoreA(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      const autoB = calculateWinningScore(num, targetScore);
      setDeleteScoreB(autoB.toString());
    }
  };

  const handleDeleteScoreBChange = (val: string) => {
    setDeleteScoreB(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      const autoA = calculateWinningScore(num, targetScore);
      setDeleteScoreA(autoA.toString());
    }
  };

  const handleOpenFinishModal = (m: MatchEntity) => {
    setFinishingMatch(m);
    setScoreInputA('');
    setScoreInputB('');
  };

  const handleFinishScoreModal = async (noScores = false) => {
    if (!finishingMatch) return;
    const matchId = finishingMatch.id;
    
    let valA = 0;
    let valB = 0;
    let winner: 'A' | 'B' = 'A';

    if (!noScores && scoreInputA.trim() !== '' && scoreInputB.trim() !== '') {
      valA = parseInt(scoreInputA, 10) || 0;
      valB = parseInt(scoreInputB, 10) || 0;
      winner = valA >= valB ? 'A' : 'B';
    }

    setFinishingMatch(null);
    setScoreInputA('');
    setScoreInputB('');

    soundEngine.playWhistle();
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch {}

    await onFinishMatch(matchId, valA, valB, winner);
  };

  // Delete Dialog Handlers (Mobile App Parity)
  const handleSaveAndCompleteFromDelete = async () => {
    if (!deletingMatch) return;
    const valA = parseInt(deleteScoreA, 10);
    const valB = parseInt(deleteScoreB, 10);
    if (isNaN(valA) || isNaN(valB)) return;

    const winner: 'A' | 'B' = valA >= valB ? 'A' : 'B';
    const matchId = deletingMatch.id;

    setDeletingMatch(null);
    setDeleteShowRecordScore(false);
    setDeleteScoreA('');
    setDeleteScoreB('');

    soundEngine.playWhistle();
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch {}

    await onFinishMatch(matchId, valA, valB, winner);
  };

  const handleIgnoreAndDelete = async () => {
    if (!deletingMatch) return;
    const matchId = deletingMatch.id;
    setDeletingMatch(null);
    setDeleteShowRecordScore(false);
    setDeleteScoreA('');
    setDeleteScoreB('');
    await onCancelMatch(matchId);
  };

  const handleDismissDeleteDialog = () => {
    setDeletingMatch(null);
    setDeleteShowRecordScore(false);
    setDeleteScoreA('');
    setDeleteScoreB('');
  };

  const handleAddPAYGSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paygName.trim()) return;
    await onAddPAYGPlayerToSession(paygName.trim().toUpperCase(), paygGender);
    setPaygName('');
    setIsAddPAYGOpen(false);
  };

  // Duplicate checks for Manage Courts
  const isCourtDuplicate = Boolean(
    newCourtName.trim() &&
    courts.some((c) => c.name.trim().toLowerCase() === newCourtName.trim().toLowerCase())
  );

  const handleAddCourtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourtName.trim() || isCourtDuplicate) return;
    if (onAddCourtToSession) {
      await onAddCourtToSession(newCourtName.trim().toUpperCase(), newCourtGameType);
    }
    setNewCourtName('');
  };

  // Duplicate checks for Manage Pool
  const isPoolPlayerDuplicate = Boolean(
    newPoolPlayerName.trim() &&
    players.some((p) => p.name.trim().toLowerCase() === newPoolPlayerName.trim().toLowerCase())
  );

  const handleCreatePoolPlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoolPlayerName.trim() || isPoolPlayerDuplicate) return;
    const nextPlayerId = players.length > 0 ? Math.max(...players.map((p) => p.id)) + 1 : 1;
    if (onAddPlayerToMaster) {
      await onAddPlayerToMaster(newPoolPlayerName.trim().toUpperCase(), newPoolPlayerGender, newPoolPlayerPAYG);
    }
    if (onAddPlayerToSession) {
      await onAddPlayerToSession(nextPlayerId);
    }
    setNewPoolPlayerName('');
    setIsCreatingNewPlayerInPool(false);
  };

  const handleOpenEligibilityModal = (playerId: number) => {
    const join = joins.find((j) => j.playerId === playerId);
    setEditingEligibilityPlayerId(playerId);
    if (!join?.eligibleCourtIds) {
      setSelectedEligibleCourtIds([]);
    } else if (Array.isArray(join.eligibleCourtIds)) {
      setSelectedEligibleCourtIds((join.eligibleCourtIds as any[]).map(Number));
    } else {
      setSelectedEligibleCourtIds(
        join.eligibleCourtIds
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n))
      );
    }
  };

  const handleSaveEligibility = async () => {
    if (editingEligibilityPlayerId === null || !onUpdatePlayerCourtEligibility) return;
    const ids = selectedEligibleCourtIds.length === 0 ? null : selectedEligibleCourtIds;
    await onUpdatePlayerCourtEligibility(editingEligibilityPlayerId, ids);
    setEditingEligibilityPlayerId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. TOP SESSION HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xl">
            🏸
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-tight">
                {activeSession.name}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                activeSession.status === 'Active'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}>
                {activeSession.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Mode: <strong className="text-sky-300">{activeSession.type}</strong></span>
              <span>•</span>
              <span>Target: <strong className="text-emerald-400">{targetScore} pts</strong> (Max {maxScoreLimit})</span>
              <span>•</span>
              <span className="font-mono text-slate-300">{formatDuration(elapsedSeconds)}</span>
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {activeSession.status !== 'Active' ? (
            <button
              type="button"
              onClick={async () => {
                await onStartSession();
                setActiveTab('GAMES');
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Session</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowEndSessionConfirm(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-xs transition-colors cursor-pointer"
            >
              <Square className="w-4 h-4 fill-rose-300" />
              <span>End Session</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. THE 3 MAIN TABS REQUESTED: Session | Games | Stats */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('SESSION')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'SESSION'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20 font-black'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Session ({courts.length} Courts • {joins.length} Players)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('GAMES')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'GAMES'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20 font-black'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Games ({Object.keys(activeMatchesMap).length} Live)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('STATS')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'STATS'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20 font-black'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Stats & Standings</span>
        </button>
      </div>

      {/* TAB 1: SESSION MANAGEMENT (Courts, Players Pool, Setup) */}
      {activeTab === 'SESSION' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Section 1: Session Courts */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <span>Session Courts ({courts.length})</span>
                </h3>
                <p className="text-xs text-slate-400">Courts actively deployed for this session</p>
              </div>

              <button
                type="button"
                onClick={() => setShowManageCourtsModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manage Courts</span>
              </button>
            </div>

            {courts.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-950 border border-dashed border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-400">No courts configured for this session yet.</p>
                <button
                  type="button"
                  onClick={() => setShowManageCourtsModal(true)}
                  className="text-xs font-bold text-sky-400 hover:underline"
                >
                  + Add court to session
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {courts.map((court) => {
                  const hasActiveMatch = Boolean(activeMatchesMap[court.id]);
                  return (
                    <div
                      key={court.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-200 uppercase">{court.name}</span>
                        {hasActiveMatch && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                            In Game
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                        {onUpdateCourtGameType ? (
                          <select
                            value={court.gameType}
                            onChange={(e) => onUpdateCourtGameType(court.id, e.target.value as GameType)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-300 font-bold focus:outline-none"
                          >
                            <option value="DOUBLES">DOUBLES</option>
                            <option value="SINGLES">SINGLES</option>
                            <option value="MIXED_DOUBLES">MIXED_DOUBLES</option>
                          </select>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-bold">{court.gameType}</span>
                        )}

                        {onDeleteCourtFromSession && (
                          <button
                            type="button"
                            onClick={() => onDeleteCourtFromSession(court.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                            title="Delete court from session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Session Players Pool */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>Session Players Pool ({sessionPlayers.length})</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Toggle PAYG/Permanent, adjust court eligibility, pause/resume, or add/remove players
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowManagePlayersModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Manage Pool</span>
                </button>
              </div>
            </div>

            {sessionPlayers.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-950 border border-dashed border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-400">No players in this session pool yet.</p>
                <button
                  type="button"
                  onClick={() => setShowManagePlayersModal(true)}
                  className="text-xs font-bold text-sky-400 hover:underline"
                >
                  + Add players from club or create new
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sessionPlayers.map((sp) => {
                  const isPlayerPAYG = Boolean(sp.isPAYG || sp.player.isPAYG);
                  const eligibleCourtIdList: number[] = sp.eligibleCourtIds
                    ? (Array.isArray(sp.eligibleCourtIds)
                        ? (sp.eligibleCourtIds as any[]).map(Number)
                        : sp.eligibleCourtIds.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)))
                    : [];
                  const eligibleCourtNames = eligibleCourtIdList.length > 0
                    ? courts.filter((c) => eligibleCourtIdList.includes(c.id)).map((c) => c.name).join(', ')
                    : 'All Courts';

                  return (
                    <div
                      key={sp.playerId}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3 flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${sp.player.gender === 'FEMALE' ? 'text-pink-400' : 'text-sky-400'}`}>
                              {sp.player.gender === 'FEMALE' ? '♀' : '♂'}
                            </span>
                            <span className="text-xs font-bold text-slate-100">{sp.player.name}</span>
                          </div>

                          {/* Bidirectional PAYG / Permanent Toggle */}
                          <button
                            type="button"
                            onClick={() => onTogglePlayerPAYG && onTogglePlayerPAYG(sp.playerId, isPlayerPAYG)}
                            title="Click to toggle between PAYG and Permanent"
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                              isPlayerPAYG
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30'
                            }`}
                          >
                            {isPlayerPAYG ? 'PAYG' : 'Permanent'}
                          </button>
                        </div>

                        {/* Status chip */}
                        {sp.isPlaying ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                            Playing
                          </span>
                        ) : sp.isPaused ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                            Paused
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                            Waiting
                          </span>
                        )}
                      </div>

                      {/* Eligibility and Controls */}
                      <div className="pt-2 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Courts:</span>
                          <button
                            type="button"
                            onClick={() => handleOpenEligibilityModal(sp.playerId)}
                            className="font-bold text-sky-400 hover:underline truncate max-w-[140px]"
                            title={eligibleCourtNames}
                          >
                            {eligibleCourtNames}
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onTogglePlayerPause(sp.playerId)}
                            disabled={sp.isPlaying}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              sp.isPlaying
                                ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                                : sp.isPaused
                                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                            }`}
                          >
                            {sp.isPaused ? 'Resume' : 'Pause'}
                          </button>

                          {onRemovePlayerFromSession && (
                            <button
                              type="button"
                              onClick={() => onRemovePlayerFromSession(sp.playerId)}
                              disabled={sp.isPlaying}
                              className="text-[10px] text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-500 cursor-pointer"
                              title="Remove player from session"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GAMES (Live Rotation, Match Cards, Queue Lists) */}
      {activeTab === 'GAMES' && (
        <div className="space-y-6 animate-fade-in">
          
          {activeSession.status !== 'Active' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Session is currently in <strong>Setup Mode</strong>. Start the session to generate rotation matches.</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onStartSession();
                }}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md cursor-pointer shrink-0"
              >
                Start Session Now
              </button>
            </div>
          )}

          {/* Sports Hall Courts Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span>Courts Grid</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  {courts.length} Courts
                </span>
              </h3>
              <span className="text-xs text-slate-400">
                Fair Play: Opponent & Partner Replay Cost Minimization
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courts.map((court) => {
                const activeMatch = activeMatchesMap[court.id];
                
                return (
                  <div
                    key={court.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all"
                  >
                    {/* Court Header */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 font-black text-xs flex items-center justify-center">
                          🏸
                        </span>
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-wider">
                            {court.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {court.gameType}
                          </span>
                        </div>
                      </div>

                      {activeMatch ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Match #{activeMatch.matchNumber}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                          Court Ready
                        </span>
                      )}
                    </div>

                    {/* Active Match Display */}
                    {activeMatch ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                          {/* Team A */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                              Team A
                            </span>
                            <div className="text-xs font-bold text-slate-100 flex flex-col gap-0.5">
                              <span>{renderPlayerWithCount(activeMatch.teamAPlayer1Id)}</span>
                              {activeMatch.teamAPlayer2Id && (
                                <span>{renderPlayerWithCount(activeMatch.teamAPlayer2Id)}</span>
                              )}
                            </div>
                          </div>

                          {/* Team B */}
                          <div className="space-y-1 text-right">
                            <span className="text-[10px] font-black uppercase tracking-wider text-pink-400">
                              Team B
                            </span>
                            <div className="text-xs font-bold text-slate-100 flex flex-col gap-0.5">
                              <span>{renderPlayerWithCount(activeMatch.teamBPlayer1Id)}</span>
                              {activeMatch.teamBPlayer2Id && (
                                <span>{renderPlayerWithCount(activeMatch.teamBPlayer2Id)}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Match Actions: Only two buttons as in mobile app (Update Score and Delete) */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                          <button
                            type="button"
                            onClick={() => setDeletingMatch(activeMatch)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer"
                            title="Delete game"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFinishModal(activeMatch)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-950 transition-all cursor-pointer"
                            title="Update match score"
                          >
                            <Trophy className="w-3.5 h-3.5" />
                            <span>Update Score</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Idle Court State */
                      <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
                        <span className="text-2xl">🏸</span>
                        <p className="text-xs text-slate-400">Court available for next rotation</p>
                        <button
                          type="button"
                          onClick={() => onGenerateMatch(court.id)}
                          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-950 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Generate Match</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rotation Lists Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRotationTab('WAITING')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    rotationTab === 'WAITING'
                      ? 'bg-sky-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Waiting ({waitingPlayers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRotationTab('PLAYING')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    rotationTab === 'PLAYING'
                      ? 'bg-sky-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Playing ({playingPlayers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRotationTab('PAUSED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    rotationTab === 'PAUSED'
                      ? 'bg-sky-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Paused ({pausedPlayers.length})
                </button>
              </div>

              <span className="text-xs text-slate-400">
                Sorted by games played ascending (fewest games first)
              </span>
            </div>

            {/* Sub-tab: Waiting */}
            {rotationTab === 'WAITING' && (
              <div className="space-y-2">
                {waitingPlayers.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No players currently waiting in queue.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {waitingPlayers
                      .sort((a, b) => getPlayerGamesCount(a.playerId) - getPlayerGamesCount(b.playerId))
                      .map((sp) => {
                        const count = getPlayerGamesCount(sp.playerId);
                        const isPAYG = Boolean(sp.isPAYG || sp.player.isPAYG);
                        return (
                          <div
                            key={sp.playerId}
                            className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs ${sp.player.gender === 'FEMALE' ? 'text-pink-400' : 'text-sky-400'}`}>
                                  {sp.player.gender === 'FEMALE' ? '♀' : '♂'}
                                </span>
                                <span className="text-xs font-bold text-slate-200">{sp.player.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                <span>Games: <strong className="text-slate-200">{count}</strong></span>
                                {isPAYG && (
                                  <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                                    PAYG
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => onTogglePlayerPause(sp.playerId)}
                              className="p-1 text-slate-400 hover:text-amber-400 cursor-pointer"
                              title="Pause player"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab: Playing */}
            {rotationTab === 'PLAYING' && (
              <div className="space-y-2">
                {playingPlayers.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No players currently on court.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {playingPlayers.map((sp) => {
                      const count = getPlayerGamesCount(sp.playerId);
                      // find court
                      const activeMatch = Object.values(activeMatchesMap).find(
                        (m) =>
                          m.teamAPlayer1Id === sp.playerId ||
                          m.teamAPlayer2Id === sp.playerId ||
                          m.teamBPlayer1Id === sp.playerId ||
                          m.teamBPlayer2Id === sp.playerId
                      );
                      const court = courts.find((c) => c.id === activeMatch?.courtId);

                      return (
                        <div
                          key={sp.playerId}
                          className="bg-slate-950 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs ${sp.player.gender === 'FEMALE' ? 'text-pink-400' : 'text-sky-400'}`}>
                                {sp.player.gender === 'FEMALE' ? '♀' : '♂'}
                              </span>
                              <span className="text-xs font-bold text-slate-200">{sp.player.name}</span>
                            </div>
                            <span className="text-[10px] text-emerald-400 font-bold">
                              On {court?.name || 'Court'}
                            </span>
                          </div>

                          <span className="text-xs font-mono text-slate-400 font-bold">
                            {count} gms
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab: Paused */}
            {rotationTab === 'PAUSED' && (
              <div className="space-y-2">
                {pausedPlayers.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No players paused.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {pausedPlayers.map((sp) => {
                      const count = getPlayerGamesCount(sp.playerId);
                      return (
                        <div
                          key={sp.playerId}
                          className="bg-slate-950 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs ${sp.player.gender === 'FEMALE' ? 'text-pink-400' : 'text-sky-400'}`}>
                                {sp.player.gender === 'FEMALE' ? '♀' : '♂'}
                              </span>
                              <span className="text-xs font-bold text-slate-200">{sp.player.name}</span>
                            </div>
                            <span className="text-[10px] text-amber-400 font-bold">
                              Paused ({count} games)
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onTogglePlayerPause(sp.playerId)}
                            className="px-2 py-1 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold hover:bg-emerald-600/30 cursor-pointer"
                          >
                            Resume
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STATS (Session Standings, Court Utilisation, Match Records) */}
      {activeTab === 'STATS' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-bold">Total Duration</span>
                <p className="text-lg font-black text-slate-100">{formatDuration(elapsedSeconds)}</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-bold">Total Games Played</span>
                <p className="text-lg font-black text-slate-100">{completedMatches.length}</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-bold">Session Members</span>
                <p className="text-lg font-black text-slate-100">{sessionPlayers.length}</p>
              </div>
            </div>
          </div>

          {/* Court Utilisation Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">
              Court Utilisation Breakdown
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {courtUtilisation.map(({ court, gamesCount, utilPercentage }) => (
                <div key={court.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">{court.name}</span>
                    <span className="font-mono text-sky-400 font-bold">{gamesCount} gms ({utilPercentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${utilPercentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Standings vs Matches Toggle */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStatsView('STANDINGS')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    statsView === 'STANDINGS'
                      ? 'bg-sky-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Session Standings
                </button>
                <button
                  type="button"
                  onClick={() => setStatsView('MATCHES')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    statsView === 'MATCHES'
                      ? 'bg-sky-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Match Records ({completedMatches.length})
                </button>
              </div>

              {statsView === 'STANDINGS' && (
                <div className="flex items-center gap-1.5">
                  {(['ALL', 'A', 'B', 'C'] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setTierFilter(tier)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        tierFilter === tier
                          ? 'bg-slate-800 text-sky-400 border border-sky-500/40'
                          : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      {tier === 'ALL' ? 'All Groups' : `Group ${tier}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Standings Table */}
            {statsView === 'STANDINGS' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-200">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">Player</th>
                      <th className="py-3 px-3 text-sky-400">Rating</th>
                      <th className="py-3 px-3">Played</th>
                      <th className="py-3 px-3 text-emerald-400">Won</th>
                      <th className="py-3 px-3 text-rose-400">Lost</th>
                      <th className="py-3 px-3">Pts +/-</th>
                      <th className="py-3 px-3 text-right">Avg Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {statsList
                      .map((s, i) => {
                        const total = statsList.length;
                        let tierGroup: 'A' | 'B' | 'C' = 'A';
                        if (total > 0) {
                          const pct = (i + 1) / total;
                          if (pct <= 0.25) tierGroup = 'A';
                          else if (pct <= 0.75) tierGroup = 'B';
                          else tierGroup = 'C';
                        }
                        return { ...s, rank: i + 1, tierGroup };
                      })
                      .filter((s) => tierFilter === 'ALL' || s.tierGroup === tierFilter)
                      .map((stat) => {
                        const player = players.find((p) => p.id === stat.playerId);
                        return (
                          <tr key={stat.playerId} className="hover:bg-slate-950/50 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                              {stat.rank}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs ${player?.gender === 'FEMALE' ? 'text-pink-400' : 'text-sky-400'}`}>
                                  {player?.gender === 'FEMALE' ? '♀' : '♂'}
                                </span>
                                <span className="font-bold text-slate-100">{stat.name}</span>
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[9px] font-mono text-slate-400">
                                  Grp {stat.tierGroup}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-sky-400">
                              <span>{stat.rating}</span>
                              {stat.ratingChange !== 0 && (
                                <span className={`ml-1 text-[10px] font-semibold ${stat.ratingChange > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {stat.ratingChange > 0 ? `+${stat.ratingChange}` : stat.ratingChange}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {stat.gamesPlayed}
                              {stat.adjustedGames ? (
                                <span className="text-[10px] text-slate-500 ml-1">({stat.adjustedGames})</span>
                              ) : null}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                              {stat.gamesWon}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-rose-400">
                              {stat.gamesLost}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {stat.totalPointsScored}:{stat.totalPointsConceded}
                            </td>
                            {/* Avg Pts is in the last column with no Win% column */}
                            <td className="py-2.5 px-3 font-mono font-bold text-right text-sky-400">
                              {stat.averagePointsPerGame.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Match Records View */}
            {statsView === 'MATCHES' && (
              <div className="space-y-2">
                {completedMatches.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No completed matches in this session yet.</p>
                ) : (
                  completedMatches.map((m) => {
                    const court = courts.find((c) => c.id === m.courtId);
                    const teamAWon = m.winnerTeam === 'A' || ((m.teamAScore ?? 0) > (m.teamBScore ?? 0));
                    const teamBWon = m.winnerTeam === 'B' || ((m.teamBScore ?? 0) > (m.teamAScore ?? 0));

                    return (
                      <div
                        key={m.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px] font-bold">
                            #{m.matchNumber}
                          </span>
                          <span className="font-bold text-slate-300">{court?.name || 'Court'}</span>
                        </div>

                        <div className="flex items-center gap-6">
                          {/* Team A */}
                          <div className={`flex items-center gap-2 ${teamAWon ? 'font-black text-emerald-400' : 'text-slate-300'}`}>
                            {teamAWon && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                            <span>{renderPlayerWithCount(m.teamAPlayer1Id)}</span>
                            {m.teamAPlayer2Id && (
                              <>
                                <span>&</span>
                                <span>{renderPlayerWithCount(m.teamAPlayer2Id)}</span>
                              </>
                            )}
                          </div>

                          {/* Score Display */}
                          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono font-black text-xs text-slate-100">
                            {m.teamAScore ?? 0} - {m.teamBScore ?? 0}
                          </div>

                          {/* Team B */}
                          <div className={`flex items-center gap-2 ${teamBWon ? 'font-black text-emerald-400' : 'text-slate-300'}`}>
                            <span>{renderPlayerWithCount(m.teamBPlayer1Id)}</span>
                            {m.teamBPlayer2Id && (
                              <>
                                <span>&</span>
                                <span>{renderPlayerWithCount(m.teamBPlayer2Id)}</span>
                              </>
                            )}
                            {teamBWon && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* POPUP 1: ENTER SCORE & FINISH GAME (Auto-calculates Winning Score) */}
      {finishingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                  Record Game Result
                </h3>
                <p className="text-[11px] text-slate-400">Match #{finishingMatch.matchNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setFinishingMatch(null)}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300 leading-relaxed">
              Target: <strong>{targetScore} points</strong>. Entering either score will automatically calculate and populate the corresponding winning score!
            </div>

            <div className="space-y-4">
              {/* Team A */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400 uppercase">Team A</span>
                  <input
                    type="number"
                    min={0}
                    max={maxScoreLimit}
                    value={scoreInputA}
                    onChange={(e) => handleScoreAChange(e.target.value)}
                    placeholder="Score"
                    className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-center font-mono font-black text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="text-xs text-slate-300 font-bold">
                  {renderPlayerWithCount(finishingMatch.teamAPlayer1Id)}
                  {finishingMatch.teamAPlayer2Id && (
                    <span> & {renderPlayerWithCount(finishingMatch.teamAPlayer2Id)}</span>
                  )}
                </div>
              </div>

              {/* Team B */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-pink-400 uppercase">Team B</span>
                  <input
                    type="number"
                    min={0}
                    max={maxScoreLimit}
                    value={scoreInputB}
                    onChange={(e) => handleScoreBChange(e.target.value)}
                    placeholder="Score"
                    className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-center font-mono font-black text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="text-xs text-slate-300 font-bold">
                  {renderPlayerWithCount(finishingMatch.teamBPlayer1Id)}
                  {finishingMatch.teamBPlayer2Id && (
                    <span> & {renderPlayerWithCount(finishingMatch.teamBPlayer2Id)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleFinishScoreModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Finish without Scores
              </button>
              <button
                type="button"
                onClick={() => handleFinishScoreModal(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Next Match</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: DELETE / END GAME DIALOG (Mobile App Parity) */}
      {deletingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">End or Delete Game</h3>
              </div>
              <button
                type="button"
                onClick={handleDismissDeleteDialog}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Match #{deletingMatch.matchNumber} is currently in progress. Would you like to record final scores or delete this match without recording stats?
            </p>

            {deleteShowRecordScore ? (
              <div className="space-y-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-sky-400 font-bold">Team A Score</span>
                  <input
                    type="number"
                    min={0}
                    max={maxScoreLimit}
                    value={deleteScoreA}
                    onChange={(e) => handleDeleteScoreAChange(e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-xs text-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-pink-400 font-bold">Team B Score</span>
                  <input
                    type="number"
                    min={0}
                    max={maxScoreLimit}
                    value={deleteScoreB}
                    onChange={(e) => handleDeleteScoreBChange(e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-xs text-white"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 pt-2">
              {deleteShowRecordScore ? (
                <button
                  type="button"
                  onClick={handleSaveAndCompleteFromDelete}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  Save Score & Complete
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteShowRecordScore(true)}
                  className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  Enter Score & Complete
                </button>
              )}

              <button
                type="button"
                onClick={handleIgnoreAndDelete}
                className="w-full py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-xs transition-colors cursor-pointer"
              >
                Delete Game (No Stats Recorded)
              </button>

              <button
                type="button"
                onClick={handleDismissDeleteDialog}
                className="w-full py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Keep Game Playing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP: CONFIRM END SESSION */}
      {showEndSessionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Square className="w-5 h-5 fill-rose-500 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-100">End Active Session?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to end this active session? All match results and player standings will be finalized.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEndSessionConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowEndSessionConfirm(false);
                  await onEndSession();
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>End Session</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 3: MANAGE COURTS MODAL (With duplicate checks) */}
      {showManageCourtsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">Manage Session Courts</h3>
              <button
                type="button"
                onClick={() => setShowManageCourtsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Courts in Session */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Active Courts in Session</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {courts.map((court) => (
                  <div
                    key={court.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <span className="font-bold text-slate-200 uppercase">{court.name}</span>
                    <span className="text-[10px] text-slate-400">{court.gameType}</span>
                    {onDeleteCourtFromSession && (
                      <button
                        type="button"
                        onClick={() => onDeleteCourtFromSession(court.id)}
                        className="text-slate-500 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add New Court Form with Duplicate Check */}
            <form onSubmit={handleAddCourtSubmit} className="space-y-3 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-300">Add New Court to Session</label>
              <div className="space-y-1.5">
                <input
                  type="text"
                  required
                  value={newCourtName}
                  onChange={(e) => setNewCourtName(e.target.value)}
                  placeholder="e.g. COURT 3"
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none ${
                    isCourtDuplicate
                      ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20'
                      : 'border-slate-800 focus:border-sky-500'
                  }`}
                />
                {isCourtDuplicate && (
                  <p className="text-[11px] font-semibold text-rose-400">
                    A court with this name already exists.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Game Type</label>
                <select
                  value={newCourtGameType}
                  onChange={(e) => setNewCourtGameType(e.target.value as GameType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="DOUBLES">DOUBLES</option>
                  <option value="SINGLES">SINGLES</option>
                  <option value="MIXED_DOUBLES">MIXED_DOUBLES</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManageCourtsModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Done
                </button>
                <button
                  type="submit"
                  disabled={!newCourtName.trim() || isCourtDuplicate}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    !newCourtName.trim() || isCourtDuplicate
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                      : 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                  }`}
                >
                  Add Court
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP 4: MANAGE PLAYERS POOL MODAL (With duplicate checks) */}
      {showManagePlayersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">Manage Session Players Pool</h3>
              <button
                type="button"
                onClick={() => {
                  setShowManagePlayersModal(false);
                  setIsCreatingNewPlayerInPool(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!isCreatingNewPlayerInPool ? (
              <div className="space-y-3 overflow-y-auto pr-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Select players from club registry:</p>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewPlayerInPool(true)}
                    className="text-xs font-bold text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create New</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={searchPlayerQuery}
                  onChange={(e) => setSearchPlayerQuery(e.target.value)}
                  placeholder="Search club members..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />

                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {players
                    .filter((p) => p.name.toLowerCase().includes(searchPlayerQuery.toLowerCase()))
                    .map((p) => {
                      const isInSession = joins.some((j) => j.playerId === p.id);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${p.gender === 'FEMALE' ? 'text-pink-400' : 'text-sky-400'}`}>
                              {p.gender === 'FEMALE' ? '♀' : '♂'}
                            </span>
                            <span className="font-bold text-slate-200">{p.name}</span>
                            {p.isPAYG && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                                PAYG
                              </span>
                            )}
                          </div>

                          {isInSession ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> In Pool
                              </span>
                              {onRemovePlayerFromSession && (
                                <button
                                  type="button"
                                  onClick={() => onRemovePlayerFromSession(p.id)}
                                  className="text-[10px] text-slate-500 hover:text-rose-400 ml-1 cursor-pointer"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAddPlayerToSession && onAddPlayerToSession(p.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              /* Create New Player Form with Duplicate Check */
              <form onSubmit={handleCreatePoolPlayerSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Player Name</label>
                  <input
                    type="text"
                    required
                    value={newPoolPlayerName}
                    onChange={(e) => setNewPoolPlayerName(e.target.value)}
                    placeholder="e.g. Robin Hood"
                    className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none ${
                      isPoolPlayerDuplicate
                        ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20'
                        : 'border-slate-800 focus:border-sky-500'
                    }`}
                  />
                  {isPoolPlayerDuplicate && (
                    <p className="text-[11px] font-semibold text-rose-400">
                      A member with this name already exists.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Gender</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPoolPlayerGender('MALE')}
                      className={`py-2 rounded-xl text-xs font-bold border ${
                        newPoolPlayerGender === 'MALE'
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Male ♂
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPoolPlayerGender('FEMALE')}
                      className={`py-2 rounded-xl text-xs font-bold border ${
                        newPoolPlayerGender === 'FEMALE'
                          ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Female ♀
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Member Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPoolPlayerPAYG(false)}
                      className={`py-2 rounded-xl text-xs font-bold border ${
                        !newPoolPlayerPAYG
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Permanent
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPoolPlayerPAYG(true)}
                      className={`py-2 rounded-xl text-xs font-bold border ${
                        newPoolPlayerPAYG
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      PAYG
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewPlayerInPool(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200"
                  >
                    Back to Select
                  </button>
                  <button
                    type="submit"
                    disabled={!newPoolPlayerName.trim() || isPoolPlayerDuplicate}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      !newPoolPlayerName.trim() || isPoolPlayerDuplicate
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                        : 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                    }`}
                  >
                    Create & Add
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* POPUP 5: COURT ELIGIBILITY MODAL */}
      {editingEligibilityPlayerId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">Court Eligibility</h3>
              <button
                type="button"
                onClick={() => setEditingEligibilityPlayerId(null)}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Select which courts this player is allowed to play on. If none selected, the player can play on All Courts.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSelectedEligibleCourtIds([])}
                className={`w-full py-2 rounded-xl text-xs font-bold border transition-all ${
                  selectedEligibleCourtIds.length === 0
                    ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                All Courts (Shared Pool)
              </button>

              <div className="grid grid-cols-2 gap-2">
                {courts.map((court) => {
                  const isSelected = selectedEligibleCourtIds.includes(court.id);
                  return (
                    <button
                      key={court.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedEligibleCourtIds((prev) => prev.filter((id) => id !== court.id));
                        } else {
                          setSelectedEligibleCourtIds((prev) => [...prev, court.id]);
                        }
                      }}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {court.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingEligibilityPlayerId(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEligibility}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 6: QUICK ADD PAYG MODAL */}
      {isAddPAYGOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">Add PAYG Guest Player</h3>
              <button
                type="button"
                onClick={() => setIsAddPAYGOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPAYGSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Player Name</label>
                <input
                  type="text"
                  required
                  value={paygName}
                  onChange={(e) => setPaygName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Gender</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaygGender('MALE')}
                    className={`py-2 rounded-xl text-xs font-bold border ${
                      paygGender === 'MALE' ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Male ♂
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaygGender('FEMALE')}
                    className={`py-2 rounded-xl text-xs font-bold border ${
                      paygGender === 'FEMALE' ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Female ♀
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPAYGOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                >
                  Add Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
