import React, { useState, useMemo } from 'react';
import { 
  History, 
  Trophy, 
  Download, 
  Layers, 
  Users, 
  FileSpreadsheet, 
  Flame, 
  Trash2,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Info,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Check,
  Activity
} from 'lucide-react';
import type { 
  SessionEntity, 
  CourtEntity, 
  PlayerEntity, 
  MatchEntity, 
  ClubEntity,
  WeeklySessionEntity,
  PlayerStats 
} from '../types';
import { StatsCalculator, ReportExporter } from '../utils/badmintonLogic';
import { MemberPerformanceModal } from './MemberPerformanceModal';
import { TeamPairRankingView } from './TeamPairRankingView';

interface HistoryScreenProps {
  clubDetails: ClubEntity | null;
  sessions: SessionEntity[];
  allCourtsMap: Record<number, CourtEntity[]>; // sessionId -> courts
  allMatchesMap: Record<number, MatchEntity[]>; // sessionId -> matches
  players: PlayerEntity[];
  weeklySessions?: WeeklySessionEntity[];
  onDeleteSession?: (sessionId: number) => Promise<void>;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  clubDetails,
  sessions,
  allCourtsMap,
  allMatchesMap,
  players,
  weeklySessions = [],
  onDeleteSession,
}) => {
  // Top-level Navigation: Session History | Session Leaderboard | Lifetime Leaderboard | Team Pair Ranking
  const [activeTab, setActiveTab] = useState<'SESSIONS' | 'WEEKLY' | 'LIFETIME' | 'PAIR_RANKING'>('SESSIONS');

  // Member Performance Chart Pop-up state
  const [selectedMemberForChart, setSelectedMemberForChart] = useState<PlayerEntity | null>(null);

  const handleOpenMemberChart = (playerId: number) => {
    const p = players.find((x) => x.id === playerId);
    if (p) {
      setSelectedMemberForChart(p);
    }
  };

  // Session History Sub-states
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [historyMultiSelectMode, setHistoryMultiSelectMode] = useState<boolean>(false);
  const [historySelectedSessionIds, setHistorySelectedSessionIds] = useState<number[]>([]);
  const [sessionDetailTab, setSessionDetailTab] = useState<'MATCHES' | 'LEADERBOARD'>('MATCHES');
  const [sessionGroupFilter, setSessionGroupFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [sessionGenderFilter, setSessionGenderFilter] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL');

  // Multi-Session Leaderboard Sub-states
  const [userSelectedSessionIds, setUserSelectedSessionIds] = useState<number[] | null>(null);
  const [sessionLeaderboardTierFilter, setSessionLeaderboardTierFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [sessionLeaderboardGenderFilter, setSessionLeaderboardGenderFilter] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL');

  // Lifetime Leaderboard Sub-states
  const [lifetimeTierFilter, setLifetimeTierFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [lifetimeGenderFilter, setLifetimeGenderFilter] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL');

  // Deletion modal state
  const [sessionToDelete, setSessionToDelete] = useState<SessionEntity | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Doubles-Aware Ranking Model info dialog/panel
  const [showModelExplainer, setShowModelExplainer] = useState<boolean>(false);

  const getDayOfWeek = (timestamp: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date(timestamp).getDay()];
  };

  // Helper to extract base session name for grouping (grouping on session name instead of day played)
  const getSessionBaseName = (session: SessionEntity): string => {
    // 1. If linked to a weekly session entity, use its master name
    if (session.weeklySessionId != null) {
      const ws = weeklySessions.find((w) => w.id === session.weeklySessionId);
      if (ws && ws.name && ws.name.trim().length > 0) {
        return ws.name.trim();
      }
    }

    if (!session.name) return 'Standard Session';
    const trimmed = session.name.trim();

    // 2. Check if name starts with or matches any weeklySession name
    for (const ws of weeklySessions) {
      if (!ws.name) continue;
      const wsName = ws.name.trim();
      if (
        trimmed === wsName ||
        trimmed.startsWith(`${wsName} (`) ||
        trimmed.startsWith(`${wsName} -`) ||
        trimmed.startsWith(`${wsName} :`)
      ) {
        return wsName;
      }
    }

    // 3. Strip trailing date/timestamp formats appended to sessions
    // Examples: "Wednesday Club Night (04/09/2026)", "Wed Social - 04/09/2026", "Social - 4 Sep 2026"
    const cleaned = trimmed
      .replace(/\s*[\(-]\s*\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\)?\s*$/i, '')
      .replace(/\s*[\(-]\s*\d{1,2}\s+[A-Za-z]{3,9}(\s+\d{2,4})?\)?\s*$/i, '')
      .replace(/\s*[\(-]\s*[A-Za-z]{3,9}\s+\d{1,2}(,\s*\d{2,4})?\)?\s*$/i, '')
      .trim();

    return cleaned || trimmed;
  };

  // Helper to determine if a match has an actual recorded score
  const hasRecordedScore = (m: MatchEntity) => {
    const hasPoints = m.teamAScore != null && m.teamBScore != null && (m.teamAScore > 0 || m.teamBScore > 0);
    const hasWinner = m.winnerTeam != null;
    return hasPoints || hasWinner;
  };

  // Requirement 4: Completed/Ended Sessions with at least one match having a recorded score
  const completedSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        if (s.isActive || s.status === 'Active') return false;
        const matches = allMatchesMap[s.id] || [];
        return matches.some(hasRecordedScore);
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [sessions, allMatchesMap]);

  // Selected sessions for Session History tab (supports single and multiple session selection)
  const activeHistorySessions = useMemo(() => {
    if (!completedSessions.length) return [];
    if (historyMultiSelectMode) {
      if (historySelectedSessionIds.length > 0) {
        return completedSessions.filter((s) => historySelectedSessionIds.includes(s.id));
      }
      return completedSessions.slice(0, 1);
    }
    const single = completedSessions.find((s) => s.id === selectedSessionId) || completedSessions[0];
    return single ? [single] : [];
  }, [completedSessions, historyMultiSelectMode, historySelectedSessionIds, selectedSessionId]);

  const currentSession = activeHistorySessions[0] || null;

  const currentCourts = useMemo(() => {
    return activeHistorySessions.flatMap((s) => allCourtsMap[s.id] || []);
  }, [activeHistorySessions, allCourtsMap]);

  const currentMatches = useMemo(() => {
    return activeHistorySessions.flatMap((s) => (allMatchesMap[s.id] || []).filter(hasRecordedScore));
  }, [activeHistorySessions, allMatchesMap]);

  // Session History Leaderboard calculated dynamically across all selected sessions
  const sessionStats = useMemo(() => {
    if (activeHistorySessions.length === 0 || currentMatches.length === 0) return [];
    return StatsCalculator.calculatePlayerStats(players, currentMatches)
      .filter((s) => s.gamesPlayed > 0);
  }, [activeHistorySessions, players, currentMatches]);

  const rankedSessionStats = useMemo(() => {
    return StatsCalculator.sortPlayersByRankRule(sessionStats);
  }, [sessionStats]);

  const groupedSessionTiers = useMemo(() => {
    return StatsCalculator.groupPlayersByTier(rankedSessionStats);
  }, [rankedSessionStats]);

  const displayedSessionStats = useMemo(() => {
    let list = sessionGroupFilter === 'ALL'
      ? rankedSessionStats
      : (groupedSessionTiers[sessionGroupFilter] || []);
    if (sessionGenderFilter !== 'ALL') {
      list = list.filter((s) => s.gender === sessionGenderFilter);
    }
    return list;
  }, [rankedSessionStats, groupedSessionTiers, sessionGroupFilter, sessionGenderFilter]);

  // --- Group completed sessions by Session Name (instead of on the day it is played) ---
  const sessionNameGroups = useMemo(() => {
    const groups: Record<string, {
      name: string;
      displayName: string;
      sessions: SessionEntity[];
      matches: MatchEntity[];
    }> = {};

    completedSessions.forEach((s) => {
      const baseName = getSessionBaseName(s);
      if (!groups[baseName]) {
        groups[baseName] = {
          name: baseName,
          displayName: baseName,
          sessions: [],
          matches: []
        };
      }
      groups[baseName].sessions.push(s);
      const matches = allMatchesMap[s.id] || [];
      groups[baseName].matches.push(...matches.filter(hasRecordedScore));
    });

    return groups;
  }, [completedSessions, allMatchesMap, weeklySessions]);

  // Sort groups: most played sessions first, then alphabetically
  const sortedSessionNames = useMemo(() => {
    return Object.keys(sessionNameGroups).sort((a, b) => {
      const diff = sessionNameGroups[b].sessions.length - sessionNameGroups[a].sessions.length;
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    });
  }, [sessionNameGroups]);

  // Default selection: all completed sessions
  const defaultSelectedSessionIds = useMemo(() => {
    return completedSessions.map((s) => s.id);
  }, [completedSessions]);

  const effectiveSelectedSessionIds = useMemo(() => {
    if (userSelectedSessionIds !== null) {
      return userSelectedSessionIds;
    }
    return defaultSelectedSessionIds;
  }, [userSelectedSessionIds, defaultSelectedSessionIds]);

  const selectedSessions = useMemo(() => {
    return completedSessions.filter((s) => effectiveSelectedSessionIds.includes(s.id));
  }, [completedSessions, effectiveSelectedSessionIds]);

  // Aggregate matches from all selected sessions
  const selectedSessionMatches = useMemo(() => {
    return selectedSessions.flatMap((s) => {
      const matches = allMatchesMap[s.id] || [];
      return matches.filter(hasRecordedScore);
    });
  }, [selectedSessions, allMatchesMap]);

  // Display title for multi-session selection
  const selectionTitle = useMemo(() => {
    if (selectedSessions.length === 0) return 'No Sessions Selected';
    const distinctBaseNames = Array.from(new Set(selectedSessions.map((s) => getSessionBaseName(s))));
    if (distinctBaseNames.length === 1) {
      return `${distinctBaseNames[0]} (${selectedSessions.length} ${selectedSessions.length === 1 ? 'session' : 'sessions'})`;
    }
    return `Cumulative Leaderboard (${selectedSessions.length} sessions)`;
  }, [selectedSessions]);

  // Multi-session selection toggles
  const handleToggleSession = (sessionId: number) => {
    setUserSelectedSessionIds((prev) => {
      const current = prev !== null ? prev : defaultSelectedSessionIds;
      if (current.includes(sessionId)) {
        return current.filter((id) => id !== sessionId);
      } else {
        return [...current, sessionId];
      }
    });
  };

  const handleToggleGroup = (groupName: string) => {
    const groupSessions = sessionNameGroups[groupName]?.sessions || [];
    const groupIds = groupSessions.map((s) => s.id);
    setUserSelectedSessionIds((prev) => {
      const current = prev !== null ? prev : defaultSelectedSessionIds;
      const allSelected = groupIds.length > 0 && groupIds.every((id) => current.includes(id));
      if (allSelected) {
        return current.filter((id) => !groupIds.includes(id));
      } else {
        const merged = new Set([...current, ...groupIds]);
        return Array.from(merged);
      }
    });
  };

  const handleSelectAllSessions = () => {
    setUserSelectedSessionIds(completedSessions.map((s) => s.id));
  };

  const handleDeselectAllSessions = () => {
    setUserSelectedSessionIds([]);
  };

  const handleSelectLastNSessions = (n: number) => {
    setUserSelectedSessionIds(completedSessions.slice(0, n).map((s) => s.id));
  };

  // Session History Tab multi-select handlers
  const handleToggleHistorySession = (sessionId: number) => {
    setHistorySelectedSessionIds((prev) => {
      if (prev.includes(sessionId)) {
        return prev.filter((id) => id !== sessionId);
      } else {
        return [...prev, sessionId];
      }
    });
  };

  const handleSelectAllHistorySessions = () => {
    setHistorySelectedSessionIds(completedSessions.map((s) => s.id));
  };

  const handleDeselectAllHistorySessions = () => {
    setHistorySelectedSessionIds([]);
  };

  const handleSelectLastNHistorySessions = (n: number) => {
    setHistorySelectedSessionIds(completedSessions.slice(0, n).map((s) => s.id));
  };

  // Multi-Session Leaderboard calculation
  const sessionLeaderboardPlayerStats = useMemo(() => {
    if (selectedSessions.length === 0 || selectedSessionMatches.length === 0) return [];
    return StatsCalculator.calculatePlayerStats(players, selectedSessionMatches)
      .filter((s) => s.gamesPlayed > 0);
  }, [selectedSessions, selectedSessionMatches, players]);

  const rankedSessionLeaderboardStats = useMemo(() => {
    return StatsCalculator.sortPlayersByRankRule(sessionLeaderboardPlayerStats);
  }, [sessionLeaderboardPlayerStats]);

  const groupedSessionLeaderboardTiers = useMemo(() => {
    return StatsCalculator.groupPlayersByTier(rankedSessionLeaderboardStats);
  }, [rankedSessionLeaderboardStats]);

  const displayedSessionLeaderboardStats = useMemo(() => {
    let list = sessionLeaderboardTierFilter === 'ALL'
      ? rankedSessionLeaderboardStats
      : (groupedSessionLeaderboardTiers[sessionLeaderboardTierFilter] || []);
    if (sessionLeaderboardGenderFilter !== 'ALL') {
      list = list.filter((s) => s.gender === sessionLeaderboardGenderFilter);
    }
    return list;
  }, [rankedSessionLeaderboardStats, groupedSessionLeaderboardTiers, sessionLeaderboardTierFilter, sessionLeaderboardGenderFilter]);

  // --- LIFETIME STATS (Across only completed, non-deleted sessions with recorded scores) ---
  const allCompletedMatches: MatchEntity[] = useMemo(() => {
    return completedSessions.flatMap((s) => {
      const matches = allMatchesMap[s.id] || [];
      return matches.filter(hasRecordedScore);
    });
  }, [completedSessions, allMatchesMap]);

  const lifetimeStats = useMemo(() => {
    return StatsCalculator.calculatePlayerStats(players, allCompletedMatches)
      .filter((s) => s.gamesPlayed > 0);
  }, [players, allCompletedMatches]);

  const rankedLifetimeStats = useMemo(() => {
    return StatsCalculator.sortPlayersByRankRule(lifetimeStats);
  }, [lifetimeStats]);

  const groupedLifetimeTiers = useMemo(() => {
    return StatsCalculator.groupPlayersByTier(rankedLifetimeStats);
  }, [rankedLifetimeStats]);

  const displayedLifetimeStats = useMemo(() => {
    let list = lifetimeTierFilter === 'ALL'
      ? rankedLifetimeStats
      : (groupedLifetimeTiers[lifetimeTierFilter] || []);
    if (lifetimeGenderFilter !== 'ALL') {
      list = list.filter((s) => s.gender === lifetimeGenderFilter);
    }
    return list;
  }, [rankedLifetimeStats, groupedLifetimeTiers, lifetimeTierFilter, lifetimeGenderFilter]);

  // Handlers for Exports
  const handleExportSinglePdf = () => {
    if (activeHistorySessions.length === 0) return;
    if (activeHistorySessions.length === 1) {
      ReportExporter.exportPdf(
        clubDetails,
        activeHistorySessions[0],
        currentCourts,
        players,
        currentMatches,
        sessionStats
      );
    } else {
      ReportExporter.exportWeeklyLeaderboardPdf(
        clubDetails,
        `Leaderboard (${activeHistorySessions.length} Selected Sessions)`,
        activeHistorySessions,
        rankedSessionStats
      );
    }
  };

  const handleExportSingleCsv = () => {
    if (activeHistorySessions.length === 0) return;
    if (activeHistorySessions.length === 1) {
      ReportExporter.exportCsv(
        activeHistorySessions[0],
        currentCourts,
        players,
        currentMatches,
        sessionStats
      );
    } else {
      ReportExporter.exportWeeklyLeaderboardCsv(
        `Leaderboard_${activeHistorySessions.length}_Sessions`,
        activeHistorySessions,
        rankedSessionStats
      );
    }
  };

  const handleExportWeeklyPdf = () => {
    if (selectedSessions.length === 0) return;
    ReportExporter.exportWeeklyLeaderboardPdf(
      clubDetails,
      selectionTitle,
      selectedSessions,
      rankedSessionLeaderboardStats
    );
  };

  const handleExportWeeklyCsv = () => {
    if (selectedSessions.length === 0) return;
    ReportExporter.exportWeeklyLeaderboardCsv(
      selectionTitle,
      selectedSessions,
      rankedSessionLeaderboardStats
    );
  };

  // Requirement 3: Handle Session Deletion Confirmation
  const confirmDeleteSession = async () => {
    if (!sessionToDelete || !onDeleteSession) return;
    try {
      setIsDeleting(true);
      await onDeleteSession(sessionToDelete.id);
      if (selectedSessionId === sessionToDelete.id) {
        setSelectedSessionId(null);
      }
      setSessionToDelete(null);
    } catch (err) {
      console.error('Failed to delete session:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Header with 3 Tabs: Session History | Session Leaderboard | Lifetime Leaderboard */}
      <div className="light-10-grey-tile flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="history-icon-box w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold border border-amber-400/40 dark:border-transparent">
            <History className="w-5 h-5 text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-black dark:text-slate-100">
              Session History & Leaderboards
            </h2>
            <p className="text-xs text-slate-800 dark:text-slate-400 font-bold">
              Historical match records, weekly session rankings, and lifetime club standings
            </p>
          </div>
        </div>

        {/* 4 Tabs: Session History | Session Leaderboard | Lifetime Leaderboard | Team Pair Ranking */}
        <div className="history-tabs-container flex items-center bg-white dark:bg-slate-800 rounded-xl p-1 border border-slate-300 dark:border-slate-700 text-xs font-bold self-start sm:self-auto shadow-sm">
          <button
            id="tab-session-history"
            onClick={() => setActiveTab('SESSIONS')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'SESSIONS'
                ? 'bg-slate-950 dark:bg-slate-700 text-white shadow-sm font-black'
                : 'text-slate-800 dark:text-slate-400 hover:text-black dark:hover:text-slate-200 font-black'
            }`}
          >
            Session History
          </button>
          <button
            id="tab-session-leaderboard"
            onClick={() => setActiveTab('WEEKLY')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'WEEKLY'
                ? 'bg-sky-600 text-white shadow-sm font-black'
                : 'text-slate-800 dark:text-slate-400 hover:text-black dark:hover:text-slate-200 font-black'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Session Leaderboard</span>
          </button>
          <button
            id="tab-lifetime-leaderboard"
            onClick={() => setActiveTab('LIFETIME')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'LIFETIME'
                ? 'bg-amber-600 text-white shadow-sm font-black'
                : 'text-slate-800 dark:text-slate-400 hover:text-black dark:hover:text-slate-200 font-black'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Lifetime Leaderboard</span>
          </button>
          <button
            id="tab-pair-ranking"
            onClick={() => setActiveTab('PAIR_RANKING')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'PAIR_RANKING'
                ? 'bg-emerald-600 text-white shadow-sm font-black'
                : 'text-slate-800 dark:text-slate-400 hover:text-black dark:hover:text-slate-200 font-black'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Team Pair Ranking</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: SESSION HISTORY (Match records & single session) */}
      {/* ======================================================== */}
      {activeTab === 'SESSIONS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Completed Sessions List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Historical Sessions ({completedSessions.length})
                </h3>
              </div>

              {/* Mode Toggle: Single Session vs Multi-Select */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setHistoryMultiSelectMode(false);
                    if (currentSession) {
                      setSelectedSessionId(currentSession.id);
                    }
                  }}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                    !historyMultiSelectMode
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryMultiSelectMode(true);
                    if (historySelectedSessionIds.length === 0 && currentSession) {
                      setHistorySelectedSessionIds([currentSession.id]);
                    }
                  }}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer text-[11px] flex items-center gap-1 ${
                    historyMultiSelectMode
                      ? 'bg-sky-600 text-white shadow-xs font-black'
                      : 'text-slate-500 dark:text-slate-400 hover:text-sky-600'
                  }`}
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>Multi-Select</span>
                </button>
              </div>
            </div>

            {/* Quick multi-select action buttons */}
            {historyMultiSelectMode && (
              <div className="flex items-center justify-between gap-1.5 px-2 py-1.5 bg-sky-50/70 dark:bg-slate-800/80 rounded-xl border border-sky-100 dark:border-slate-700/60 text-xs">
                <span className="text-[11px] font-bold text-sky-700 dark:text-sky-300">
                  {activeHistorySessions.length} of {completedSessions.length} selected
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSelectAllHistorySessions}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10.5px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLastNHistorySessions(3)}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10.5px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                  >
                    Last 3
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLastNHistorySessions(5)}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10.5px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                  >
                    Last 5
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllHistorySessions}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10.5px] font-bold text-slate-500 hover:text-rose-500 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {completedSessions.map((session) => {
                const isSelected = historyMultiSelectMode
                  ? historySelectedSessionIds.includes(session.id)
                  : session.id === currentSession?.id;
                const matchesCount = (allMatchesMap[session.id] || []).length;
                const courtsCount = (allCourtsMap[session.id] || []).length;
                const dayStr = getDayOfWeek(session.startTime || session.createdAt || Date.now());
                const dateStr = new Date(session.startTime || session.createdAt || Date.now()).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });

                return (
                  <div
                    key={session.id}
                    onClick={() => {
                      if (historyMultiSelectMode) {
                        handleToggleHistorySession(session.id);
                      } else {
                        setSelectedSessionId(session.id);
                      }
                    }}
                    className={`group w-full text-left p-4 rounded-2xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-sky-50 dark:bg-slate-800/95 border-sky-500 dark:border-sky-500/80 shadow-md shadow-sky-500/10 text-slate-900 dark:text-white'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {historyMultiSelectMode && (
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                          }`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        )}
                        <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                          {dayStr} • {dateStr}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {session.status || 'End'}
                        </span>
                        
                        {/* Requirement 3: Session Deletion Button on Card */}
                        {onDeleteSession && (
                          <button
                            type="button"
                            title="Delete Session History"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionToDelete(session);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate mb-2">
                      {session.name}
                    </h4>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        {courtsCount} Courts
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-slate-400" />
                        {matchesCount} Matches
                      </span>
                    </div>
                  </div>
                );
              })}

              {completedSessions.length === 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
                  No completed sessions with recorded scores found.
                </div>
              )}
            </div>
          </div>

          {/* Right: Selected Session Detail (8 cols) */}
          {activeHistorySessions.length > 0 && currentSession ? (
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
              
              {/* Session Overview Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  {activeHistorySessions.length > 1 ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                          Multiple Sessions Selected
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                          {activeHistorySessions.length} Sessions Combined
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                        Combined Session Ranking &amp; Records
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                        <span>Selected: <strong className="text-slate-800 dark:text-slate-200">{activeHistorySessions.length} sessions</strong></span>
                        <span>•</span>
                        <span>Courts: <strong className="text-slate-800 dark:text-slate-200">{currentCourts.length}</strong></span>
                        <span>•</span>
                        <span>Matches: <strong className="text-slate-800 dark:text-slate-200">{currentMatches.length}</strong></span>
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                        {getDayOfWeek(currentSession.startTime || currentSession.createdAt || Date.now())} • {new Date(currentSession.startTime || currentSession.createdAt || Date.now()).toLocaleDateString()}
                      </span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                        {currentSession.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                        <span>Mode: <strong className="text-slate-800 dark:text-slate-200">{currentSession.type}</strong></span>
                        <span>•</span>
                        <span>Courts: <strong className="text-slate-800 dark:text-slate-200">{currentCourts.length}</strong></span>
                        <span>•</span>
                        <span>Matches: <strong className="text-slate-800 dark:text-slate-200">{currentMatches.length}</strong></span>
                      </p>
                    </>
                  )}
                </div>

                {/* Export & Delete Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleExportSinglePdf}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF Report</span>
                  </button>

                  <button
                    onClick={handleExportSingleCsv}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                    <span>CSV</span>
                  </button>

                  {/* Requirement 3: Delete Session button in header */}
                  {onDeleteSession && (
                    <button
                      onClick={() => setSessionToDelete(currentSession)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 font-bold text-xs transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Subtabs: Match Records vs Single Session Leaderboard */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <button
                  onClick={() => setSessionDetailTab('MATCHES')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    sessionDetailTab === 'MATCHES'
                      ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Match Records ({currentMatches.length})
                </button>
                <button
                  onClick={() => setSessionDetailTab('LEADERBOARD')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    sessionDetailTab === 'LEADERBOARD'
                      ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Session Leaderboard ({sessionStats.length})
                </button>
              </div>

              {/* MATCH RECORDS VIEW */}
              {sessionDetailTab === 'MATCHES' && (
                <div className="space-y-3">
                  {currentMatches.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {currentMatches
                        .sort((a, b) => a.matchNumber - b.matchNumber)
                        .map((m) => {
                          const courtName = currentCourts.find((c) => c.id === m.courtId)?.name || `Court ${m.courtId}`;
                          const p1A = players.find((p) => p.id === m.teamAPlayer1Id)?.name || 'Player 1';
                          const p2A = m.teamAPlayer2Id ? players.find((p) => p.id === m.teamAPlayer2Id)?.name : null;
                          const teamA = p2A ? `${p1A} & ${p2A}` : p1A;

                          const p1B = players.find((p) => p.id === m.teamBPlayer1Id)?.name || 'Player 1';
                          const p2B = m.teamBPlayer2Id ? players.find((p) => p.id === m.teamBPlayer2Id)?.name : null;
                          const teamB = p2B ? `${p1B} & ${p2B}` : p1B;

                          const isWinnerA = m.winnerTeam === 'A';
                          const isWinnerB = m.winnerTeam === 'B';

                          return (
                            <div
                              key={m.id}
                              className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded-xl p-3.5 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-mono font-bold text-xs flex items-center justify-center">
                                  #{m.matchNumber}
                                </span>
                                <div>
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                    {courtName}
                                  </span>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className={isWinnerA ? 'font-black text-emerald-600 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}>
                                      {teamA}
                                    </span>
                                    <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px]">vs</span>
                                    <span className={isWinnerB ? 'font-black text-emerald-600 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}>
                                      {teamB}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-base font-black font-mono text-sky-600 dark:text-sky-400">
                                  {m.teamAScore ?? 0} : {m.teamBScore ?? 0}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                                  {m.winnerTeam ? `Winner: Team ${m.winnerTeam}` : 'Completed'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No matches played in this session.
                    </div>
                  )}
                </div>
              )}

              {/* SINGLE SESSION LEADERBOARD VIEW */}
              {sessionDetailTab === 'LEADERBOARD' && (
                <div className="space-y-4">
                  {/* Group and Gender Filters */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Group Filter Chips */}
                    <div className="flex items-center gap-1 text-xs font-bold bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                      <span className="px-2 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Group:</span>
                      <button
                        onClick={() => setSessionGroupFilter('ALL')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          sessionGroupFilter === 'ALL'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setSessionGroupFilter('A')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          sessionGroupFilter === 'A'
                            ? 'bg-sky-500 text-white shadow-2xs font-black'
                            : 'text-slate-500 dark:text-slate-400 hover:text-sky-600'
                        }`}
                      >
                        Group A
                      </button>
                      <button
                        onClick={() => setSessionGroupFilter('B')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          sessionGroupFilter === 'B'
                            ? 'bg-indigo-500 text-white shadow-2xs font-black'
                            : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600'
                        }`}
                      >
                        Group B
                      </button>
                      <button
                        onClick={() => setSessionGroupFilter('C')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          sessionGroupFilter === 'C'
                            ? 'bg-amber-500 text-white shadow-2xs font-black'
                            : 'text-slate-500 dark:text-slate-400 hover:text-amber-600'
                        }`}
                      >
                        Group C
                      </button>
                    </div>

                    {/* Gender Filter Chips */}
                    <div className="flex items-center gap-1 text-xs font-bold bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                      <span className="px-2 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Gender:</span>
                      <button
                        onClick={() => setSessionGenderFilter('ALL')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          sessionGenderFilter === 'ALL'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setSessionGenderFilter('MALE')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          sessionGenderFilter === 'MALE'
                            ? 'bg-sky-600 text-white shadow-2xs font-black'
                            : 'text-slate-500 dark:text-slate-400 hover:text-sky-600'
                        }`}
                      >
                        Men
                      </button>
                      <button
                        onClick={() => setSessionGenderFilter('FEMALE')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          sessionGenderFilter === 'FEMALE'
                            ? 'bg-pink-600 text-white shadow-2xs font-black'
                            : 'text-slate-500 dark:text-slate-400 hover:text-pink-600'
                        }`}
                      >
                        Women
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-950/60 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-2">Rank</th>
                          <th className="py-2.5 px-2">Player</th>
                          <th className="py-2.5 px-2 text-center text-sky-600 dark:text-sky-400">Rating</th>
                          <th className="py-2.5 px-2 text-center">Played</th>
                          <th className="py-2.5 px-2 text-center">Won</th>
                          <th className="py-2.5 px-2 text-center">Lost</th>
                          <th className="py-2.5 px-2 text-center">Win %</th>
                          <th className="py-2.5 px-2 text-center">Points +/-</th>
                          <th className="py-2.5 px-2 text-right">Avg Pts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                        {displayedSessionStats.map((stat) => {
                          const rank = rankedSessionStats.findIndex((s) => s.playerId === stat.playerId) + 1;
                          return (
                            <tr key={stat.playerId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="py-2.5 px-2 font-black text-sky-600 dark:text-sky-400">#{rank}</td>
                              <td className="py-2.5 px-2 font-bold text-slate-900 dark:text-white">
                                <button
                                  type="button"
                                  onClick={() => handleOpenMemberChart(stat.playerId)}
                                  className="text-left font-bold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors cursor-pointer inline-flex items-center gap-1 group"
                                  title="Click to view member performance chart over sessions"
                                >
                                  <span>{stat.name}</span>
                                  <Activity className="w-3 h-3 text-sky-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                                </button>
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-sky-600 dark:text-sky-400">
                                <span>{stat.rating}</span>
                                {stat.ratingChange !== 0 && (
                                  <span className={`ml-1 text-[10px] font-semibold ${stat.ratingChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {stat.ratingChange > 0 ? `+${stat.ratingChange}` : stat.ratingChange}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono">
                                {stat.adjustedGames > 0 ? `${stat.gamesPlayed} (${stat.adjustedGames})` : `${stat.gamesPlayed}`}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono text-emerald-600 dark:text-emerald-400 font-bold">{stat.gamesWon}</td>
                              <td className="py-2.5 px-2 text-center font-mono text-rose-600 dark:text-rose-400">{stat.gamesLost}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-sky-600 dark:text-sky-300">{stat.winPercentage.toFixed(1)}%</td>
                              <td className="py-2.5 px-2 text-center font-mono text-slate-500 dark:text-slate-400">
                                {stat.totalPointsScored} : {stat.totalPointsConceded}
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono text-slate-800 dark:text-slate-300 font-bold">
                                {stat.averagePointsPerGame.toFixed(1)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Session Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Select a completed session from the left to view official match history and statistics.
              </p>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SESSION LEADERBOARD (Cumulative across sessions of the same name)   */}
      {/* ========================================================================= */}
      {activeTab === 'WEEKLY' && (
        <div className="space-y-6">
          
          {/* Multi-Session Selection & Top Stats Banner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                    Multi-Session Leaderboard
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    {selectedSessions.length} of {completedSessions.length} sessions selected
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  {selectionTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cumulative player rankings calculated across {selectedSessions.length} selected sessions ({selectedSessionMatches.length} total matches).
                </p>
              </div>

              {/* Action Buttons: Select All, Clear, PDF, CSV */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleSelectAllSessions}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAllSessions}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                >
                  Clear
                </button>
                {selectedSessions.length > 0 && (
                  <>
                    <button
                      onClick={handleExportWeeklyPdf}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF Report</span>
                    </button>
                    <button
                      onClick={handleExportWeeklyCsv}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                      <span>CSV</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Session Group Quick Selectors */}
            {sortedSessionNames.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Select by Session Series:
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Click a series pill to toggle all its sessions
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {sortedSessionNames.map((name) => {
                    const group = sessionNameGroups[name];
                    const groupSessionIds = group.sessions.map((s) => s.id);
                    const selectedInGroup = groupSessionIds.filter((id) => effectiveSelectedSessionIds.includes(id)).length;
                    const isAllSelected = selectedInGroup === groupSessionIds.length && groupSessionIds.length > 0;
                    const isPartialSelected = selectedInGroup > 0 && !isAllSelected;

                    return (
                      <button
                        key={name}
                        onClick={() => handleToggleGroup(name)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isAllSelected
                            ? 'bg-sky-500/15 border-sky-500 text-sky-700 dark:text-sky-300 shadow-2xs'
                            : isPartialSelected
                            ? 'bg-sky-500/5 border-sky-400/60 text-sky-600 dark:text-sky-400'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        ) : isPartialSelected ? (
                          <div className="w-3.5 h-3.5 rounded-xs border-2 border-sky-500 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-sky-500 rounded-2xs" />
                          </div>
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{group.displayName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          isAllSelected
                            ? 'bg-sky-500 text-white font-black'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          {selectedInGroup}/{group.sessions.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Individual Sessions List with checkboxes */}
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span>Individual Sessions ({completedSessions.length}):</span>
                    <span>Click any session card to toggle inclusion</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                    {completedSessions.map((s) => {
                      const isSelected = effectiveSelectedSessionIds.includes(s.id);
                      const matchCount = (allMatchesMap[s.id] || []).filter(hasRecordedScore).length;
                      const dateStr = new Date(s.startTime || s.createdAt || Date.now()).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      });
                      const baseName = getSessionBaseName(s);

                      return (
                        <button
                          key={s.id}
                          onClick={() => handleToggleSession(s.id)}
                          className={`flex items-start gap-2 p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-white dark:bg-slate-800 border-sky-500 shadow-2xs ring-1 ring-sky-500/30'
                              : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div className="pt-0.5">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {s.name}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <span>{dateStr}</span>
                              <span>•</span>
                              <span>{matchCount} games</span>
                            </div>
                            {baseName !== s.name && (
                              <span className="inline-block mt-1 text-[9px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded">
                                {baseName}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No completed sessions found with recorded match scores.
              </div>
            )}
          </div>

          {/* Session Leaderboard Ranking Table */}
          {selectedSessions.length > 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-sky-500" />
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    {selectionTitle} • Player Rankings ({rankedSessionLeaderboardStats.length})
                  </h4>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Model Explainer Toggle */}
                  <button
                    onClick={() => setShowModelExplainer((prev) => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-sky-300 dark:border-sky-800/80 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                    <span>Doubles Model</span>
                    {showModelExplainer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {/* Group Filter Chips */}
                  <div className="flex items-center gap-1 text-xs font-bold bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                    <span className="px-2 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Group:</span>
                    <button
                      onClick={() => setSessionLeaderboardTierFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        sessionLeaderboardTierFilter === 'ALL'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSessionLeaderboardTierFilter('A')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        sessionLeaderboardTierFilter === 'A'
                          ? 'bg-sky-500 text-white shadow-2xs font-black'
                          : 'text-slate-500 dark:text-slate-400 hover:text-sky-600'
                      }`}
                    >
                      Group A
                    </button>
                    <button
                      onClick={() => setSessionLeaderboardTierFilter('B')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        sessionLeaderboardTierFilter === 'B'
                          ? 'bg-indigo-500 text-white shadow-2xs font-black'
                          : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600'
                      }`}
                    >
                      Group B
                    </button>
                    <button
                      onClick={() => setSessionLeaderboardTierFilter('C')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        sessionLeaderboardTierFilter === 'C'
                          ? 'bg-amber-500 text-white shadow-2xs font-black'
                          : 'text-slate-500 dark:text-slate-400 hover:text-amber-600'
                      }`}
                    >
                      Group C
                    </button>
                  </div>

                  {/* Gender Filter Chips */}
                  <div className="flex items-center gap-1 text-xs font-bold bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                    <span className="px-2 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Gender:</span>
                    <button
                      onClick={() => setSessionLeaderboardGenderFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        sessionLeaderboardGenderFilter === 'ALL'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSessionLeaderboardGenderFilter('MALE')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        sessionLeaderboardGenderFilter === 'MALE'
                          ? 'bg-sky-600 text-white shadow-2xs font-black'
                          : 'text-slate-500 dark:text-slate-400 hover:text-sky-600'
                      }`}
                    >
                      Men
                    </button>
                    <button
                      onClick={() => setSessionLeaderboardGenderFilter('FEMALE')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        sessionLeaderboardGenderFilter === 'FEMALE'
                          ? 'bg-pink-600 text-white shadow-2xs font-black'
                          : 'text-slate-500 dark:text-slate-400 hover:text-pink-600'
                      }`}
                    >
                      Women
                    </button>
                  </div>
                </div>
              </div>

              {/* Collapsible Model Explainer */}
              {showModelExplainer && (
                <div className="bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Doubles-Aware Ranking Model (Base Rating: 1,000 pts)
                      </h5>
                    </div>
                    <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded-full">
                      6-Factor Weighted System
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[11px]">
                    <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                      <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-1">
                        <span>1. Opponents&apos; Strength</span>
                        <span className="text-sky-600 dark:text-sky-400 font-black">40% Weight</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[10.5px] leading-relaxed">
                        Pair Elo expectation. Beating higher-rated opponents yields greater rating gains than beating lower-rated pairs.
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                      <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-1">
                        <span>2. Winning Margin</span>
                        <span className="text-sky-600 dark:text-sky-400 font-black">20% Weight</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[10.5px] leading-relaxed">
                        Scale multiplier: 1–2 pts (1.00×), 3–5 pts (1.05×), 6–10 pts (1.10×), 11+ pts (1.15×).
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                      <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-1">
                        <span>3. Consistency</span>
                        <span className="text-sky-600 dark:text-sky-400 font-black">15% Weight</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[10.5px] leading-relaxed">
                        Standard deviation of point differentials over the last 30 matches. Low variance rewards stability.
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                      <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-1">
                        <span>4. Recent Form</span>
                        <span className="text-sky-600 dark:text-sky-400 font-black">10% Weight</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[10.5px] leading-relaxed">
                        Win momentum over the last 5 matches. Players on hot streaks receive an upward adjustment.
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                      <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-1">
                        <span>5. Partner Adjustment</span>
                        <span className="text-sky-600 dark:text-sky-400 font-black">10% Weight</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[10.5px] leading-relaxed">
                        Isolates individual skill: weaker partner gains more on a win, while the higher-rated partner shoulders loss responsibility.
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                      <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-1">
                        <span>6. Attendance &amp; Activity</span>
                        <span className="text-sky-600 dark:text-sky-400 font-black">5% Weight</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[10.5px] leading-relaxed">
                        Inactivity decay starts after 4 weeks (28 days) away from court, gradually reverting unplayed ratings.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Table (Ties/Tier and Gender REMOVED from columns and rows) */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60">
                    <tr>
                      <th className="py-3 px-3">Rank</th>
                      <th className="py-3 px-3">Player Name</th>
                      <th className="py-3 px-3 text-center text-sky-600 dark:text-sky-400">Rating</th>
                      <th className="py-3 px-3 text-center">Played</th>
                      <th className="py-3 px-3 text-center">Won</th>
                      <th className="py-3 px-3 text-center">Lost</th>
                      <th className="py-3 px-3 text-center">Win Rate</th>
                      <th className="py-3 px-3 text-center">Points +/-</th>
                      <th className="py-3 px-3 text-center">Consistency</th>
                      <th className="py-3 px-3 text-center">Recent Form</th>
                      <th className="py-3 px-3 text-center">Streak</th>
                      <th className="py-3 px-3 text-right">Avg Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                    {displayedSessionLeaderboardStats.map((stat) => {
                      const rank = rankedSessionLeaderboardStats.findIndex((s) => s.playerId === stat.playerId) + 1;

                      return (
                        <tr key={stat.playerId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-black text-sky-600 dark:text-sky-400 text-sm">
                            #{rank}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white text-xs">
                            <button
                              type="button"
                              onClick={() => handleOpenMemberChart(stat.playerId)}
                              className="text-left font-bold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors cursor-pointer inline-flex items-center gap-1 group"
                              title="Click to view member performance chart over sessions"
                            >
                              <span>{stat.name}</span>
                              <Activity className="w-3 h-3 text-sky-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-sky-600 dark:text-sky-400">
                            <span className="text-sm">{stat.rating}</span>
                            {stat.ratingChange !== 0 && (
                              <span className={`ml-1 text-[10px] font-semibold ${stat.ratingChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {stat.ratingChange > 0 ? `+${stat.ratingChange}` : stat.ratingChange}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-slate-200">
                            {stat.gamesPlayed}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400 font-black">
                            {stat.gamesWon}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-rose-600 dark:text-rose-400 font-semibold">
                            {stat.gamesLost}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-sky-600 dark:text-sky-300">
                            {stat.winPercentage.toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-500 dark:text-slate-400">
                            {stat.totalPointsScored} : {stat.totalPointsConceded}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {Math.round(stat.consistencyScore)}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-xs">
                            <span className={`font-semibold ${stat.recentFormRate >= 0.6 ? 'text-emerald-600 dark:text-emerald-400' : stat.recentFormRate <= 0.4 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
                              {Math.round(stat.recentFormRate * 100)}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                            {stat.consecutiveWins > 0 && <Flame className="w-3.5 h-3.5 text-amber-500" />}
                            <span>{stat.consecutiveWins} W</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                            {stat.averagePointsPerGame.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}

                    {displayedSessionLeaderboardStats.length === 0 && (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-xs text-slate-400">
                          No players match the selected group/gender filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-sm">
              <Trophy className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Sessions Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Please select one or more sessions above or click &quot;Select All&quot; to calculate cumulative rankings across multiple sessions.
              </p>
              <button
                onClick={handleSelectAllSessions}
                className="mt-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
              >
                Select All Sessions ({completedSessions.length})
              </button>
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: LIFETIME LEADERBOARD (All-time club performance)  */}
      {/* ======================================================== */}
      {activeTab === 'LIFETIME' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>Overall Club Leaderboard</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lifetime player statistics, cumulative win rates, and winning streaks across all {completedSessions.length} completed sessions
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Model Explainer Toggle */}
              <button
                onClick={() => setShowModelExplainer((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-sky-300 dark:border-sky-800/80 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-xs font-bold transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                <span>Doubles Model (1,000 Base)</span>
                {showModelExplainer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {/* Group Filter Chips */}
              <div className="flex items-center gap-1 text-xs font-bold bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                <span className="px-2 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Group:</span>
                <button
                  onClick={() => setLifetimeTierFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    lifetimeTierFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  All ({rankedLifetimeStats.length})
                </button>
                <button
                  onClick={() => setLifetimeTierFilter('A')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    lifetimeTierFilter === 'A'
                      ? 'bg-sky-500 text-white shadow-2xs font-black'
                      : 'text-slate-500 dark:text-slate-400 hover:text-sky-600'
                  }`}
                >
                  Group A
                </button>
                <button
                  onClick={() => setLifetimeTierFilter('B')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    lifetimeTierFilter === 'B'
                      ? 'bg-indigo-500 text-white shadow-2xs font-black'
                      : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600'
                  }`}
                >
                  Group B
                </button>
                <button
                  onClick={() => setLifetimeTierFilter('C')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    lifetimeTierFilter === 'C'
                      ? 'bg-amber-500 text-white shadow-2xs font-black'
                      : 'text-slate-500 dark:text-slate-400 hover:text-amber-600'
                  }`}
                >
                  Group C
                </button>
              </div>

              {/* Gender Filter Chips */}
              <div className="flex items-center gap-1 text-xs font-bold bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                <span className="px-2 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Gender:</span>
                <button
                  onClick={() => setLifetimeGenderFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    lifetimeGenderFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setLifetimeGenderFilter('MALE')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    lifetimeGenderFilter === 'MALE'
                      ? 'bg-sky-600 text-white shadow-2xs font-black'
                      : 'text-slate-500 dark:text-slate-400 hover:text-sky-600'
                  }`}
                >
                  Men
                </button>
                <button
                  onClick={() => setLifetimeGenderFilter('FEMALE')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    lifetimeGenderFilter === 'FEMALE'
                      ? 'bg-pink-600 text-white shadow-2xs font-black'
                      : 'text-slate-500 dark:text-slate-400 hover:text-pink-600'
                  }`}
                >
                  Women
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible Model Explainer */}
          {showModelExplainer && (
            <div className="bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Doubles-Aware Ranking Model (Base Rating: 1,000 pts)
                  </h5>
                </div>
                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded-full">
                  6-Factor Weighted System
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[11px]">
                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-1">
                    <span>1. Opponents&apos; Strength</span>
                    <span className="text-sky-600 dark:text-sky-400 font-black">40% Weight</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[10.5px] leading-relaxed">
                    Pair Elo expectation. Beating higher-rated opponents yields greater rating gains than beating lower-rated pairs.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-1">
                    <span>2. Winning Margin</span>
                    <span className="text-sky-600 dark:text-sky-400 font-black">20% Weight</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[10.5px] leading-relaxed">
                    Scale multiplier: 1–2 pts (1.00×), 3–5 pts (1.05×), 6–10 pts (1.10×), 11+ pts (1.15×).
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-1">
                    <span>3. Consistency</span>
                    <span className="text-sky-600 dark:text-sky-400 font-black">15% Weight</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[10.5px] leading-relaxed">
                    Standard deviation of point differentials over the last 30 matches. Low variance rewards stability.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-1">
                    <span>4. Recent Form</span>
                    <span className="text-sky-600 dark:text-sky-400 font-black">10% Weight</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[10.5px] leading-relaxed">
                    Win momentum over the last 5 matches. Players on hot streaks receive an upward adjustment.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-1">
                    <span>5. Partner Adjustment</span>
                    <span className="text-sky-600 dark:text-sky-400 font-black">10% Weight</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[10.5px] leading-relaxed">
                    Isolates individual skill: weaker partner gains more on a win, while the higher-rated partner shoulders loss responsibility.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-1">
                    <span>6. Attendance &amp; Activity</span>
                    <span className="text-sky-600 dark:text-sky-400 font-black">5% Weight</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[10.5px] leading-relaxed">
                    Inactivity decay starts after 4 weeks (28 days) away from court, gradually reverting unplayed ratings.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60">
                <tr>
                  <th className="py-3 px-3">Rank</th>
                  <th className="py-3 px-3">Player Name</th>
                  <th className="py-3 px-3 text-center text-sky-600 dark:text-sky-400">Rating</th>
                  <th className="py-3 px-3 text-center">Activity</th>
                  <th className="py-3 px-3 text-center">Played</th>
                  <th className="py-3 px-3 text-center">Won</th>
                  <th className="py-3 px-3 text-center">Lost</th>
                  <th className="py-3 px-3 text-center">Win Rate</th>
                  <th className="py-3 px-3 text-center">Points +/-</th>
                  <th className="py-3 px-3 text-center">Consistency</th>
                  <th className="py-3 px-3 text-center">Recent Form</th>
                  <th className="py-3 px-3 text-center">Streak</th>
                  <th className="py-3 px-3 text-right">Avg Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                {displayedLifetimeStats.map((stat) => {
                  const rank = rankedLifetimeStats.findIndex((s) => s.playerId === stat.playerId) + 1;

                  return (
                    <tr key={stat.playerId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-black text-sky-600 dark:text-sky-400 text-sm">
                        #{rank}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white text-xs">
                        <button
                          type="button"
                          onClick={() => handleOpenMemberChart(stat.playerId)}
                          className="text-left font-bold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors cursor-pointer inline-flex items-center gap-1 group"
                          title="Click to view member performance chart over sessions"
                        >
                          <span>{stat.name}</span>
                          <Activity className="w-3 h-3 text-sky-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-sky-600 dark:text-sky-400">
                        <span className="text-sm">{stat.rating}</span>
                        {stat.ratingChange !== 0 && (
                          <span className={`ml-1 text-[10px] font-semibold ${stat.ratingChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {stat.ratingChange > 0 ? `+${stat.ratingChange}` : stat.ratingChange}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {stat.activityStatus === 'INACTIVE' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-400/30">
                            Inactive ({stat.inactiveWeeks}w)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-400/30">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-slate-200">
                        {stat.gamesPlayed}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400 font-black">
                        {stat.gamesWon}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-rose-600 dark:text-rose-400 font-semibold">
                        {stat.gamesLost}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-sky-600 dark:text-sky-300">
                        {stat.winPercentage.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-500 dark:text-slate-400">
                        {stat.totalPointsScored} : {stat.totalPointsConceded}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {Math.round(stat.consistencyScore)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-xs">
                        <span className={`font-semibold ${stat.recentFormRate >= 0.6 ? 'text-emerald-600 dark:text-emerald-400' : stat.recentFormRate <= 0.4 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
                          {Math.round(stat.recentFormRate * 100)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                        {stat.consecutiveWins > 0 && <Flame className="w-3.5 h-3.5 text-amber-500" />}
                        <span>{stat.consecutiveWins} W</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                        {stat.averagePointsPerGame.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}

                {displayedLifetimeStats.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-xs text-slate-400">
                      No players match the selected group/gender filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: TEAM PAIR RANKING                                 */}
      {/* ======================================================== */}
      {activeTab === 'PAIR_RANKING' && (
        <TeamPairRankingView
          sessions={completedSessions}
          allMatchesMap={allMatchesMap}
          players={players}
          weeklySessions={weeklySessions}
          onSelectPlayerForPerformanceChart={(player) => setSelectedMemberForChart(player)}
        />
      )}

      {/* ======================================================== */}
      {/* REQUIREMENT 3: SESSION DELETION CONFIRMATION MODAL       */}
      {/* ======================================================== */}
      {sessionToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Delete Session History
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Irreversible session purge & ranking adjustment
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-900 dark:text-white">"{sessionToDelete.name}"</strong>? 
              This will permanently erase all associated match records and court statistics.
              <br /><br />
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                Player rankings across the Session Leaderboard and Lifetime Leaderboard will be recalculated automatically to exclude this session.
              </span>
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteSession}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/40 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Performance Trajectory Modal */}
      {selectedMemberForChart && (
        <MemberPerformanceModal
          player={selectedMemberForChart}
          sessions={completedSessions}
          allMatchesMap={allMatchesMap}
          players={players}
          onClose={() => setSelectedMemberForChart(null)}
        />
      )}

    </div>
  );
};
