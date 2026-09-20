import React, { useState, useMemo } from 'react';
import { 
  X, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Award, 
  Flame, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  Sparkles,
  BarChart3,
  Activity,
  User
} from 'lucide-react';
import type { PlayerEntity, SessionEntity, MatchEntity, MemberSessionPerformance } from '../types';
import { StatsCalculator, isMatchValidAndCounted } from '../utils/badmintonLogic';

interface MemberPerformanceModalProps {
  player: PlayerEntity | null;
  sessions: SessionEntity[];
  allMatchesMap: Record<number, MatchEntity[]>;
  players: PlayerEntity[];
  onClose: () => void;
}

type ChartMetric = 'RATING' | 'WIN_RATE' | 'POINT_DIFF' | 'WINS_LOSSES' | 'AVG_POINTS';

export const MemberPerformanceModal: React.FC<MemberPerformanceModalProps> = ({
  player,
  sessions,
  allMatchesMap,
  players,
  onClose,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>('RATING');
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  const playersMap = useMemo(() => {
    const map = new Map<number, PlayerEntity>();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  // Compute session-by-session performance in chronological order with Doubles-Aware Rating tracking
  const sessionPerformances: MemberSessionPerformance[] = useMemo(() => {
    if (!player) return [];

    // Sort sessions from oldest to newest for chronological trend
    const chronologicalSessions = [...sessions].sort((a, b) => a.createdAt - b.createdAt);
    const result: MemberSessionPerformance[] = [];
    const cumulativeMatches: MatchEntity[] = [];
    let previousRating = 1000;

    chronologicalSessions.forEach((sess) => {
      const matches = allMatchesMap[sess.id] || [];
      const completedSessionMatches = matches.filter(isMatchValidAndCounted);

      // Accumulate completed matches chronologically for ratings calculation
      cumulativeMatches.push(...completedSessionMatches);

      const playerMatches = completedSessionMatches.filter((m) => {
        return (
          m.teamAPlayer1Id === player.id ||
          m.teamAPlayer2Id === player.id ||
          m.teamBPlayer1Id === player.id ||
          m.teamBPlayer2Id === player.id
        );
      });

      if (playerMatches.length === 0) return;

      // Compute player rating immediately after this session using StatsCalculator
      const statsAfterSession = StatsCalculator.calculatePlayerStats(players, cumulativeMatches);
      const playerStat = statsAfterSession.find((s) => s.playerId === player.id);
      const currentRating = playerStat ? playerStat.rating : previousRating;
      const startRating = previousRating;
      const sessionRatingDelta = currentRating - startRating;
      const ratingChange = currentRating - 1000;
      previousRating = currentRating;

      let gamesWon = 0;
      let gamesLost = 0;
      let pointsScored = 0;
      let pointsConceded = 0;

      const detailedMatches = playerMatches.map((m) => {
        const inTeamA = m.teamAPlayer1Id === player.id || m.teamAPlayer2Id === player.id;
        const aScore = m.teamAScore ?? 0;
        const bScore = m.teamBScore ?? 0;
        const teamAWon = m.winnerTeam === 'A' || aScore > bScore;
        const won = inTeamA ? teamAWon : !teamAWon;
        const myScore = inTeamA ? aScore : bScore;
        const oppScore = inTeamA ? bScore : aScore;

        if (won) gamesWon++;
        else gamesLost++;

        pointsScored += myScore;
        pointsConceded += oppScore;

        // Partner name (if doubles)
        let partnerName: string | undefined = undefined;
        if (inTeamA) {
          const partnerId = m.teamAPlayer1Id === player.id ? m.teamAPlayer2Id : m.teamAPlayer1Id;
          if (partnerId) partnerName = playersMap.get(partnerId)?.name || `Player ${partnerId}`;
        } else {
          const partnerId = m.teamBPlayer1Id === player.id ? m.teamBPlayer2Id : m.teamBPlayer1Id;
          if (partnerId) partnerName = playersMap.get(partnerId)?.name || `Player ${partnerId}`;
        }

        // Opponents
        const opponents: string[] = [];
        if (inTeamA) {
          if (m.teamBPlayer1Id) opponents.push(playersMap.get(m.teamBPlayer1Id)?.name || `Player ${m.teamBPlayer1Id}`);
          if (m.teamBPlayer2Id) opponents.push(playersMap.get(m.teamBPlayer2Id)?.name || `Player ${m.teamBPlayer2Id}`);
        } else {
          if (m.teamAPlayer1Id) opponents.push(playersMap.get(m.teamAPlayer1Id)?.name || `Player ${m.teamAPlayer1Id}`);
          if (m.teamAPlayer2Id) opponents.push(playersMap.get(m.teamAPlayer2Id)?.name || `Player ${m.teamAPlayer2Id}`);
        }

        return {
          matchId: m.id,
          partnerName,
          opponentNames: opponents,
          won,
          teamScore: myScore,
          opponentScore: oppScore,
        };
      });

      const totalGames = gamesWon + gamesLost;
      const winPct = totalGames > 0 ? (gamesWon / totalGames) * 100 : 0;
      const dateObj = new Date(sess.createdAt);
      const dateStr = dateObj.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });

      result.push({
        sessionId: sess.id,
        sessionName: sess.name,
        date: sess.createdAt,
        dateStr,
        matchesPlayed: totalGames,
        matchesWon: gamesWon,
        matchesLost: gamesLost,
        winPercentage: winPct,
        pointsScored,
        pointsConceded,
        pointsDiff: pointsScored - pointsConceded,
        avgPoints: totalGames > 0 ? pointsScored / totalGames : 0,
        rating: currentRating,
        startRating,
        ratingChange,
        sessionRatingDelta,
        matches: detailedMatches,
      });
    });

    return result;
  }, [player, sessions, allMatchesMap, playersMap, players]);

  // Overall totals
  const summaryKPIs = useMemo(() => {
    let totalPlayed = 0;
    let totalWon = 0;
    let totalLost = 0;
    let totalScored = 0;
    let totalConceded = 0;

    sessionPerformances.forEach((sp) => {
      totalPlayed += sp.matchesPlayed;
      totalWon += sp.matchesWon;
      totalLost += sp.matchesLost;
      totalScored += sp.pointsScored;
      totalConceded += sp.pointsConceded;
    });

    const winRate = totalPlayed > 0 ? (totalWon / totalPlayed) * 100 : 0;
    const pointDiff = totalScored - totalConceded;
    const avgPts = totalPlayed > 0 ? totalScored / totalPlayed : 0;

    // Recent form (last 5 matches)
    const allMatchesFlat = sessionPerformances.flatMap((s) => s.matches);
    const last5 = allMatchesFlat.slice(-5).map((m) => (m.won ? 'W' : 'L'));

    // Best session
    let bestSession: MemberSessionPerformance | null = null;
    sessionPerformances.forEach((s) => {
      if (!bestSession || s.winPercentage > bestSession.winPercentage || (s.winPercentage === bestSession.winPercentage && s.pointsDiff > bestSession.pointsDiff)) {
        bestSession = s;
      }
    });

    return {
      totalSessions: sessionPerformances.length,
      totalPlayed,
      totalWon,
      totalLost,
      winRate,
      pointDiff,
      avgPts,
      last5,
      bestSession,
      latestRating: sessionPerformances.length > 0 
        ? (sessionPerformances[sessionPerformances.length - 1].rating ?? 1000) 
        : 1000,
      totalRatingDelta: (sessionPerformances.length > 0 
        ? (sessionPerformances[sessionPerformances.length - 1].rating ?? 1000) 
        : 1000) - 1000,
      peakRating: sessionPerformances.length > 0 
        ? Math.max(1000, ...sessionPerformances.map((s) => s.rating ?? 1000)) 
        : 1000,
      lowestRating: sessionPerformances.length > 0 
        ? Math.min(1000, ...sessionPerformances.map((s) => s.rating ?? 1000)) 
        : 1000,
    };
  }, [sessionPerformances]);

  if (!player) return null;

  // Chart rendering geometry
  const chartWidth = 600;
  const chartHeight = 220;
  const padding = { top: 25, right: 30, bottom: 40, left: 45 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const chartData = sessionPerformances;
  const hasData = chartData.length > 0;

  // Values calculation based on selected metric
  const metricValues = chartData.map((d) => {
    if (selectedMetric === 'RATING') return d.rating ?? 1000;
    if (selectedMetric === 'WIN_RATE') return d.winPercentage;
    if (selectedMetric === 'POINT_DIFF') return d.pointsDiff;
    if (selectedMetric === 'WINS_LOSSES') return d.matchesWon;
    return d.avgPoints;
  });

  const minY = (() => {
    if (selectedMetric === 'RATING') {
      const allR = [1000, ...metricValues];
      const minVal = Math.min(...allR);
      return Math.floor((minVal - 30) / 25) * 25;
    }
    if (selectedMetric === 'WIN_RATE') return 0;
    if (selectedMetric === 'POINT_DIFF') {
      const minVal = Math.min(0, ...metricValues);
      return Math.floor(minVal / 5) * 5 - 5;
    }
    if (selectedMetric === 'WINS_LOSSES') return 0;
    return 0;
  })();

  const maxY = (() => {
    if (selectedMetric === 'RATING') {
      const allR = [1000, ...metricValues];
      const maxVal = Math.max(...allR);
      return Math.ceil((maxVal + 30) / 25) * 25;
    }
    if (selectedMetric === 'WIN_RATE') return 100;
    if (selectedMetric === 'POINT_DIFF') {
      const maxVal = Math.max(0, ...metricValues);
      return Math.ceil(maxVal / 5) * 5 + 5;
    }
    if (selectedMetric === 'WINS_LOSSES') {
      const maxPlayed = Math.max(1, ...chartData.map((d) => d.matchesPlayed));
      return maxPlayed + 1;
    }
    const maxAvg = Math.max(21, ...metricValues);
    return Math.ceil(maxAvg / 5) * 5;
  })();

  const getY = (val: number) => {
    const range = maxY - minY || 1;
    return padding.top + innerHeight - ((val - minY) / range) * innerHeight;
  };

  const getX = (index: number) => {
    if (chartData.length === 1) return padding.left + innerWidth / 2;
    return padding.left + (index / (chartData.length - 1)) * innerWidth;
  };

  // Zero-line Y coordinate for point differential
  const zeroY = getY(0);

  // Line path generator
  const linePath = (() => {
    if (chartData.length === 0) return '';
    if (chartData.length === 1) {
      const x = getX(0);
      const y = getY(metricValues[0]);
      return `M ${x - 20} ${y} L ${x + 20} ${y}`;
    }
    return chartData.reduce((acc, _, i) => {
      const x = getX(i);
      const y = getY(metricValues[i]);
      return `${acc} ${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  })();

  // Gradient area path generator
  const areaPath = (() => {
    if (chartData.length === 0) return '';
    const baseLineY = selectedMetric === 'POINT_DIFF' ? zeroY : padding.top + innerHeight;
    if (chartData.length === 1) {
      const x = getX(0);
      const y = getY(metricValues[0]);
      return `M ${x - 20} ${baseLineY} L ${x - 20} ${y} L ${x + 20} ${y} L ${x + 20} ${baseLineY} Z`;
    }
    const firstX = getX(0);
    const lastX = getX(chartData.length - 1);
    return `${linePath} L ${lastX.toFixed(1)} ${baseLineY.toFixed(1)} L ${firstX.toFixed(1)} ${baseLineY.toFixed(1)} Z`;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        
        {/* Header with Player Info */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-md border ${
              player.gender === 'FEMALE' 
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' 
                : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
            }`}>
              {player.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-100 tracking-tight">
                  {player.name}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  player.gender === 'FEMALE'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                }`}>
                  {player.gender}
                </span>
                {player.isPAYG && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    PAYG
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Performance History Over Sessions</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 border border-slate-700/60 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="rounded-xl bg-slate-950/70 border border-amber-500/30 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <Award className="w-3 h-3" />
              Club Rating
            </span>
            <div className="text-xl font-black text-slate-100 flex items-baseline gap-1.5 font-mono">
              <span>{summaryKPIs.latestRating}</span>
              <span className={`text-xs font-bold ${
                summaryKPIs.totalRatingDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {summaryKPIs.totalRatingDelta >= 0 ? `+${summaryKPIs.totalRatingDelta}` : summaryKPIs.totalRatingDelta}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block font-mono">
              Peak: {summaryKPIs.peakRating} · Base: 1000
            </span>
          </div>

          <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Sessions
            </span>
            <div className="text-xl font-black text-slate-100">
              {summaryKPIs.totalSessions}
            </div>
            <span className="text-[10px] text-slate-400 block">
              {summaryKPIs.totalPlayed} matches
            </span>
          </div>

          <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Win Rate
            </span>
            <div className="text-xl font-black text-sky-400">
              {summaryKPIs.winRate.toFixed(1)}%
            </div>
            <span className="text-[10px] text-slate-400 block">
              {summaryKPIs.totalWon}W - {summaryKPIs.totalLost}L
            </span>
          </div>

          <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Point Diff
            </span>
            <div className={`text-xl font-black ${
              summaryKPIs.pointDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {summaryKPIs.pointDiff > 0 ? `+${summaryKPIs.pointDiff}` : summaryKPIs.pointDiff}
            </div>
            <span className="text-[10px] text-slate-400 block">
              +/- score delta
            </span>
          </div>

          <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Avg Pts / Match
            </span>
            <div className="text-xl font-black text-amber-400">
              {summaryKPIs.avgPts.toFixed(1)}
            </div>
            <span className="text-[10px] text-slate-400 block">
              per game scored
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-xl bg-slate-950/70 border border-slate-800/80 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Recent Form
            </span>
            <div className="flex items-center gap-1 pt-1">
              {summaryKPIs.last5.length > 0 ? (
                summaryKPIs.last5.map((res, i) => (
                  <span
                    key={i}
                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${
                      res === 'W'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {res}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 font-semibold">No matches</span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 block">
              latest matches
            </span>
          </div>
        </div>

        {/* Chart Section */}
        <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-4 space-y-4 shadow-inner">
          
          {/* Chart Metric Selector Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              <h4 className="text-xs font-bold text-slate-200">
                Performance Trajectory
              </h4>
            </div>

            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-bold overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedMetric('RATING')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  selectedMetric === 'RATING'
                    ? 'bg-sky-600 text-white shadow-sm font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Award className="w-3 h-3 text-amber-400" />
                <span>Rating Trajectory</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMetric('WIN_RATE')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                  selectedMetric === 'WIN_RATE'
                    ? 'bg-sky-600 text-white shadow-sm font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Win Rate %
              </button>
              <button
                type="button"
                onClick={() => setSelectedMetric('POINT_DIFF')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                  selectedMetric === 'POINT_DIFF'
                    ? 'bg-sky-600 text-white shadow-sm font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Point Diff (+/-)
              </button>
              <button
                type="button"
                onClick={() => setSelectedMetric('WINS_LOSSES')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                  selectedMetric === 'WINS_LOSSES'
                    ? 'bg-sky-600 text-white shadow-sm font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Wins vs Losses
              </button>
              <button
                type="button"
                onClick={() => setSelectedMetric('AVG_POINTS')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                  selectedMetric === 'AVG_POINTS'
                    ? 'bg-sky-600 text-white shadow-sm font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Avg Points
              </button>
            </div>
          </div>

          {/* Rating Trajectory Narrative banner */}
          {selectedMetric === 'RATING' && hasData && (
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                {summaryKPIs.totalRatingDelta > 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : summaryKPIs.totalRatingDelta < 0 ? (
                  <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <Minus className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span className="text-slate-300">
                  {summaryKPIs.totalRatingDelta > 0
                    ? `Rating has climbed +${summaryKPIs.totalRatingDelta} points across ${sessionPerformances.length} sessions.`
                    : summaryKPIs.totalRatingDelta < 0
                    ? `Rating has shifted ${summaryKPIs.totalRatingDelta} points across ${sessionPerformances.length} sessions.`
                    : `Rating is steady at the 1,000 baseline across ${sessionPerformances.length} sessions.`}
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                <span>Start: <strong className="text-slate-200 font-semibold">1,000</strong></span>
                <span>➔</span>
                <span>Current: <strong className="text-sky-300 font-bold">{summaryKPIs.latestRating}</strong></span>
                <span>·</span>
                <span>Peak: <strong className="text-amber-300 font-bold">{summaryKPIs.peakRating}</strong></span>
              </div>
            </div>
          )}

          {/* SVG Chart */}
          {!hasData ? (
            <div className="py-12 text-center space-y-2">
              <BarChart3 className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-bold">
                No recorded match data for this member across completed sessions.
              </p>
            </div>
          ) : (
            <div className="relative w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-auto min-w-[500px] select-none"
              >
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0284c7" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="ratingAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="diffPosGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="diffNegGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.7" />
                  </linearGradient>
                </defs>

                {/* Grid horizontal lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const val = minY + ratio * (maxY - minY);
                  const y = getY(val);
                  return (
                    <g key={ratio}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={chartWidth - padding.right}
                        y2={y}
                        stroke="#334155"
                        strokeDasharray={val === 50 && selectedMetric === 'WIN_RATE' ? '4 4' : '2 2'}
                        strokeWidth={val === 50 && selectedMetric === 'WIN_RATE' ? '1.5' : '1'}
                        opacity={val === 50 && selectedMetric === 'WIN_RATE' ? 0.7 : 0.35}
                      />
                      <text
                        x={padding.left - 8}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="10"
                        fill="#94a3b8"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {selectedMetric === 'RATING'
                          ? Math.round(val)
                          : selectedMetric === 'WIN_RATE'
                          ? `${Math.round(val)}%`
                          : selectedMetric === 'POINT_DIFF'
                          ? (val > 0 ? `+${Math.round(val)}` : Math.round(val))
                          : Math.round(val)}
                      </text>
                    </g>
                  );
                })}

                {/* 1,000 Base Rating indicator line */}
                {selectedMetric === 'RATING' && (
                  <g>
                    <line
                      x1={padding.left}
                      y1={getY(1000)}
                      x2={chartWidth - padding.right}
                      y2={getY(1000)}
                      stroke="#eab308"
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                      opacity={0.65}
                    />
                    <text
                      x={chartWidth - padding.right}
                      y={getY(1000) - 5}
                      textAnchor="end"
                      fontSize="9"
                      fill="#facc15"
                      fontWeight="bold"
                    >
                      1,000 Base Rating
                    </text>
                  </g>
                )}

                {/* 50% Win Rate Target indicator line */}
                {selectedMetric === 'WIN_RATE' && (
                  <text
                    x={chartWidth - padding.right}
                    y={getY(50) - 5}
                    textAnchor="end"
                    fontSize="9"
                    fill="#38bdf8"
                    fontWeight="bold"
                  >
                    50% Par Target
                  </text>
                )}

                {/* Zero line for point differential */}
                {selectedMetric === 'POINT_DIFF' && minY < 0 && (
                  <line
                    x1={padding.left}
                    y1={zeroY}
                    x2={chartWidth - padding.right}
                    y2={zeroY}
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    opacity={0.6}
                  />
                )}

                {/* Bar chart rendering for Point Diff or Wins/Losses */}
                {selectedMetric === 'POINT_DIFF' ? (
                  chartData.map((d, i) => {
                    const x = getX(i) - 14;
                    const diff = d.pointsDiff;
                    const barHeight = Math.abs(getY(diff) - zeroY);
                    const y = diff >= 0 ? getY(diff) : zeroY;
                    const isHovered = hoveredPointIndex === i;

                    return (
                      <g
                        key={d.sessionId}
                        onMouseEnter={() => setHoveredPointIndex(i)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={x}
                          y={y}
                          width={28}
                          height={Math.max(barHeight, 2)}
                          rx={4}
                          fill={diff >= 0 ? 'url(#diffPosGradient)' : 'url(#diffNegGradient)'}
                          stroke={diff >= 0 ? '#10b981' : '#f43f5e'}
                          strokeWidth={isHovered ? 2 : 1}
                        />
                        <text
                          x={x + 14}
                          y={diff >= 0 ? y - 6 : y + barHeight + 12}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="bold"
                          fill={diff >= 0 ? '#34d399' : '#fb7185'}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </text>
                      </g>
                    );
                  })
                ) : selectedMetric === 'WINS_LOSSES' ? (
                  chartData.map((d, i) => {
                    const x = getX(i);
                    const isHovered = hoveredPointIndex === i;
                    const wonY = getY(d.matchesWon);
                    const wonHeight = Math.max(0, padding.top + innerHeight - wonY);
                    const lostY = getY(d.matchesLost);
                    const lostHeight = Math.max(0, padding.top + innerHeight - lostY);

                    return (
                      <g
                        key={d.sessionId}
                        onMouseEnter={() => setHoveredPointIndex(i)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                        className="cursor-pointer"
                      >
                        {/* Won Bar (Green) */}
                        <rect
                          x={x - 16}
                          y={wonY}
                          width={14}
                          height={wonHeight}
                          rx={3}
                          fill="#10b981"
                          opacity={isHovered ? 1 : 0.85}
                        />
                        {/* Lost Bar (Rose) */}
                        <rect
                          x={x + 2}
                          y={lostY}
                          width={14}
                          height={lostHeight}
                          rx={3}
                          fill="#f43f5e"
                          opacity={isHovered ? 1 : 0.85}
                        />
                        <text
                          x={x - 9}
                          y={wonY - 4}
                          textAnchor="middle"
                          fontSize="8.5"
                          fontWeight="bold"
                          fill="#34d399"
                        >
                          {d.matchesWon}W
                        </text>
                        <text
                          x={x + 9}
                          y={lostY - 4}
                          textAnchor="middle"
                          fontSize="8.5"
                          fontWeight="bold"
                          fill="#fb7185"
                        >
                          {d.matchesLost}L
                        </text>
                      </g>
                    );
                  })
                ) : (
                  /* Line & Area Chart for Rating, Win Rate, and Avg Points */
                  <>
                    {/* Area fill */}
                    <path 
                      d={areaPath} 
                      fill={selectedMetric === 'RATING' ? 'url(#ratingAreaGradient)' : 'url(#areaGradient)'} 
                    />

                    {/* Main Trend Line */}
                    <path
                      d={linePath}
                      fill="none"
                      stroke={selectedMetric === 'RATING' ? '#fbbf24' : '#38bdf8'}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Data Points */}
                    {chartData.map((d, i) => {
                      const x = getX(i);
                      const y = getY(metricValues[i]);
                      const isHovered = hoveredPointIndex === i;

                      return (
                        <g
                          key={d.sessionId}
                          onMouseEnter={() => setHoveredPointIndex(i)}
                          onMouseLeave={() => setHoveredPointIndex(null)}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={x}
                            cy={y}
                            r={isHovered ? 7 : 5}
                            fill={selectedMetric === 'RATING' ? '#f59e0b' : '#0284c7'}
                            stroke="#f8fafc"
                            strokeWidth={isHovered ? 2.5 : 2}
                            className="transition-all"
                          />
                          <text
                            x={x}
                            y={y - 10}
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="bold"
                            fill="#f8fafc"
                          >
                            {selectedMetric === 'RATING'
                              ? (d.rating ?? 1000)
                              : selectedMetric === 'WIN_RATE'
                              ? `${Math.round(d.winPercentage)}%`
                              : d.avgPoints.toFixed(1)}
                          </text>

                          {selectedMetric === 'RATING' && d.sessionRatingDelta != null && (
                            <text
                              x={x}
                              y={y + 14}
                              textAnchor="middle"
                              fontSize="8.5"
                              fontWeight="bold"
                              fontFamily="monospace"
                              fill={(d.sessionRatingDelta ?? 0) >= 0 ? '#34d399' : '#fb7185'}
                            >
                              {(d.sessionRatingDelta ?? 0) >= 0 ? `+${d.sessionRatingDelta}` : d.sessionRatingDelta}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </>
                )}

                {/* X-axis labels (Session Dates) */}
                {chartData.map((d, i) => {
                  const x = getX(i);
                  const isHovered = hoveredPointIndex === i;
                  return (
                    <text
                      key={d.sessionId}
                      x={x}
                      y={chartHeight - 12}
                      textAnchor="middle"
                      fontSize="9.5"
                      fill={isHovered ? '#38bdf8' : '#94a3b8'}
                      fontWeight={isHovered ? 'bold' : 'normal'}
                    >
                      {d.dateStr}
                    </text>
                  );
                })}
              </svg>
            </div>
          )}

          {/* Hovered Session Quick Card */}
          {hoveredPointIndex !== null && chartData[hoveredPointIndex] && (
            <div className="rounded-xl bg-slate-900 border border-sky-500/40 p-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
              <div>
                <span className="text-xs font-bold text-slate-100 block">
                  {chartData[hoveredPointIndex].sessionName} ({chartData[hoveredPointIndex].dateStr})
                </span>
                <span className="text-[11px] text-slate-400">
                  {chartData[hoveredPointIndex].matchesWon} Won, {chartData[hoveredPointIndex].matchesLost} Lost ({chartData[hoveredPointIndex].matchesPlayed} total matches)
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs font-bold">
                <span className="text-amber-400 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  Rating: {chartData[hoveredPointIndex].rating ?? 1000}
                  <span className={`text-[11px] ${
                    (chartData[hoveredPointIndex].sessionRatingDelta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    ({(chartData[hoveredPointIndex].sessionRatingDelta ?? 0) >= 0 ? `+${chartData[hoveredPointIndex].sessionRatingDelta}` : chartData[hoveredPointIndex].sessionRatingDelta})
                  </span>
                </span>
                <span className="text-sky-400">
                  Win: {chartData[hoveredPointIndex].winPercentage.toFixed(1)}%
                </span>
                <span className={chartData[hoveredPointIndex].pointsDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  Diff: {chartData[hoveredPointIndex].pointsDiff > 0 ? `+${chartData[hoveredPointIndex].pointsDiff}` : chartData[hoveredPointIndex].pointsDiff}
                </span>
                <span className="text-slate-300">
                  Avg: {chartData[hoveredPointIndex].avgPoints.toFixed(1)} pts
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Chronological Session Breakdown Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>Session by Session Breakdown ({sessionPerformances.length})</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              Click any session to inspect match details
            </span>
          </div>

          <div className="space-y-2">
            {sessionPerformances.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No completed sessions found.</p>
            ) : (
              sessionPerformances.map((sess) => {
                const isExpanded = expandedSessionId === sess.sessionId;
                return (
                  <div
                    key={sess.sessionId}
                    className="rounded-xl bg-slate-950/70 border border-slate-800 overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedSessionId(isExpanded ? null : sess.sessionId)}
                      className="w-full p-3 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-100">
                            {sess.sessionName}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400">
                            {sess.dateStr}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>{sess.matchesPlayed} games played</span>
                          <span>·</span>
                          <span className="text-amber-400 font-mono font-bold flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            {sess.rating ?? 1000}
                            <span className={`text-[10px] ${
                              (sess.sessionRatingDelta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              ({(sess.sessionRatingDelta ?? 0) >= 0 ? `+${sess.sessionRatingDelta}` : sess.sessionRatingDelta})
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-sky-400 block">
                            {sess.matchesWon}W - {sess.matchesLost}L ({sess.winPercentage.toFixed(0)}%)
                          </span>
                          <span className={`text-[11px] font-mono font-bold block ${
                            sess.pointsDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {sess.pointsDiff > 0 ? `+${sess.pointsDiff}` : sess.pointsDiff} pts diff
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded individual matches in this session */}
                    {isExpanded && (
                      <div className="p-3 bg-slate-900/60 border-t border-slate-800/80 space-y-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Match Results in this Session:
                        </span>
                        <div className="space-y-1.5">
                          {sess.matches.map((m, idx) => (
                            <div
                              key={m.matchId || idx}
                              className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  m.won 
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}>
                                  {m.won ? 'WON' : 'LOST'}
                                </span>
                                <span className="text-slate-200">
                                  {m.partnerName ? (
                                    <>w/ <strong className="text-white">{m.partnerName}</strong></>
                                  ) : (
                                    'Singles'
                                  )}
                                  <span className="text-slate-400 ml-1">vs {m.opponentNames.join(' & ')}</span>
                                </span>
                              </div>

                              <div className="font-mono font-bold text-slate-100">
                                <span className={m.won ? 'text-emerald-400 font-black' : 'text-slate-300'}>
                                  {m.teamScore}
                                </span>
                                <span className="text-slate-500 mx-1">-</span>
                                <span className={!m.won ? 'text-rose-400 font-black' : 'text-slate-300'}>
                                  {m.opponentScore}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
