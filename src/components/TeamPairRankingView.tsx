import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  Sparkles, 
  Search, 
  Users, 
  Flame, 
  TrendingUp, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Award,
  Layers,
  Calendar,
  Zap,
  Info
} from 'lucide-react';
import type { 
  PlayerEntity, 
  SessionEntity, 
  MatchEntity, 
  TeamPairStats, 
  WeeklySessionEntity 
} from '../types';
import { isMatchValidAndCounted } from '../utils/badmintonLogic';

interface TeamPairRankingViewProps {
  sessions: SessionEntity[];
  allMatchesMap: Record<number, MatchEntity[]>;
  players: PlayerEntity[];
  weeklySessions?: WeeklySessionEntity[];
  onSelectPlayerForPerformanceChart: (player: PlayerEntity) => void;
}

export const TeamPairRankingView: React.FC<TeamPairRankingViewProps> = ({
  sessions,
  allMatchesMap,
  players,
  weeklySessions = [],
  onSelectPlayerForPerformanceChart,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'MENS' | 'WOMENS' | 'MIXED'>('ALL');
  const [minMatchesFilter, setMinMatchesFilter] = useState<number>(1);
  const [sessionScopeFilter, setSessionScopeFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'SYNERGY' | 'WIN_RATE' | 'WINS' | 'POINT_DIFF' | 'PLAYED'>('SYNERGY');
  const [expandedPairKey, setExpandedPairKey] = useState<string | null>(null);

  const playersMap = useMemo(() => {
    const map = new Map<number, PlayerEntity>();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  const sessionsMap = useMemo(() => {
    const map = new Map<number, SessionEntity>();
    sessions.forEach((s) => map.set(s.id, s));
    return map;
  }, [sessions]);

  // Aggregate pair performance
  const allPairStats: TeamPairStats[] = useMemo(() => {
    const pairsMap = new Map<string, {
      p1Id: number;
      p2Id: number;
      matchesPlayed: number;
      matchesWon: number;
      matchesLost: number;
      pointsScored: number;
      pointsConceded: number;
      recentForm: ('W' | 'L')[];
      matchHistory: TeamPairStats['matchHistory'];
    }>();

    // Determine eligible sessions
    const targetSessions = sessions.filter((s) => {
      if (sessionScopeFilter === 'ALL') return true;
      return String(s.id) === sessionScopeFilter;
    });

    targetSessions.forEach((sess) => {
      const matches = allMatchesMap[sess.id] || [];
      const sessionName = sess.name || 'Session';

      matches.forEach((m) => {
        if (!isMatchValidAndCounted(m)) return;

        const aScore = m.teamAScore ?? 0;
        const bScore = m.teamBScore ?? 0;
        const teamAWon = m.winnerTeam === 'A' || aScore > bScore;

        // Doubles Match requires team A and team B to have 2 players each
        // Team A: teamAPlayer1Id & teamAPlayer2Id
        if (m.teamAPlayer1Id && m.teamAPlayer2Id) {
          const minP = Math.min(m.teamAPlayer1Id, m.teamAPlayer2Id);
          const maxP = Math.max(m.teamAPlayer1Id, m.teamAPlayer2Id);
          const pairKey = `${minP}_${maxP}`;

          const opp1 = m.teamBPlayer1Id ? (playersMap.get(m.teamBPlayer1Id)?.name || `Player ${m.teamBPlayer1Id}`) : '';
          const opp2 = m.teamBPlayer2Id ? (playersMap.get(m.teamBPlayer2Id)?.name || `Player ${m.teamBPlayer2Id}`) : '';

          if (!pairsMap.has(pairKey)) {
            pairsMap.set(pairKey, {
              p1Id: minP,
              p2Id: maxP,
              matchesPlayed: 0,
              matchesWon: 0,
              matchesLost: 0,
              pointsScored: 0,
              pointsConceded: 0,
              recentForm: [],
              matchHistory: [],
            });
          }

          const record = pairsMap.get(pairKey)!;
          record.matchesPlayed += 1;
          if (teamAWon) {
            record.matchesWon += 1;
            record.recentForm.push('W');
          } else {
            record.matchesLost += 1;
            record.recentForm.push('L');
          }
          record.pointsScored += aScore;
          record.pointsConceded += bScore;
          record.matchHistory.push({
            sessionId: sess.id,
            sessionName,
            date: sess.createdAt,
            won: teamAWon,
            teamScore: aScore,
            opponentScore: bScore,
            opponent1Name: opp1,
            opponent2Name: opp2,
          });
        }

        // Team B: teamBPlayer1Id & teamBPlayer2Id
        if (m.teamBPlayer1Id && m.teamBPlayer2Id) {
          const minP = Math.min(m.teamBPlayer1Id, m.teamBPlayer2Id);
          const maxP = Math.max(m.teamBPlayer1Id, m.teamBPlayer2Id);
          const pairKey = `${minP}_${maxP}`;

          const teamBWon = !teamAWon;
          const opp1 = m.teamAPlayer1Id ? (playersMap.get(m.teamAPlayer1Id)?.name || `Player ${m.teamAPlayer1Id}`) : '';
          const opp2 = m.teamAPlayer2Id ? (playersMap.get(m.teamAPlayer2Id)?.name || `Player ${m.teamAPlayer2Id}`) : '';

          if (!pairsMap.has(pairKey)) {
            pairsMap.set(pairKey, {
              p1Id: minP,
              p2Id: maxP,
              matchesPlayed: 0,
              matchesWon: 0,
              matchesLost: 0,
              pointsScored: 0,
              pointsConceded: 0,
              recentForm: [],
              matchHistory: [],
            });
          }

          const record = pairsMap.get(pairKey)!;
          record.matchesPlayed += 1;
          if (teamBWon) {
            record.matchesWon += 1;
            record.recentForm.push('W');
          } else {
            record.matchesLost += 1;
            record.recentForm.push('L');
          }
          record.pointsScored += bScore;
          record.pointsConceded += aScore;
          record.matchHistory.push({
            sessionId: sess.id,
            sessionName,
            date: sess.createdAt,
            won: teamBWon,
            teamScore: bScore,
            opponentScore: aScore,
            opponent1Name: opp1,
            opponent2Name: opp2,
          });
        }
      });
    });

    const result: TeamPairStats[] = [];

    pairsMap.forEach((rec, key) => {
      const p1 = playersMap.get(rec.p1Id);
      const p2 = playersMap.get(rec.p2Id);

      const p1Name = p1?.name || `Player ${rec.p1Id}`;
      const p2Name = p2?.name || `Player ${rec.p2Id}`;
      const p1Gender = p1?.gender || 'MALE';
      const p2Gender = p2?.gender || 'MALE';

      let category: 'MENS' | 'WOMENS' | 'MIXED' = 'MIXED';
      if (p1Gender === 'MALE' && p2Gender === 'MALE') category = 'MENS';
      else if (p1Gender === 'FEMALE' && p2Gender === 'FEMALE') category = 'WOMENS';

      const winPct = rec.matchesPlayed > 0 ? (rec.matchesWon / rec.matchesPlayed) * 100 : 0;
      const pointDiff = rec.pointsScored - rec.pointsConceded;
      const avgScored = rec.matchesPlayed > 0 ? rec.pointsScored / rec.matchesPlayed : 0;
      const avgConceded = rec.matchesPlayed > 0 ? rec.pointsConceded / rec.matchesPlayed : 0;

      // Synergy score formula: Win rate % weighted by volume of matches and point differential
      // Higher score indicates a proven, dominating pairing
      const volumeBonus = Math.min(rec.matchesPlayed * 2.5, 20);
      const diffBonus = Math.max(-25, Math.min(25, pointDiff * 0.7));
      const synergy = Math.round(winPct * 0.65 + volumeBonus + diffBonus);

      result.push({
        pairKey: key,
        player1Id: rec.p1Id,
        player2Id: rec.p2Id,
        player1Name: p1Name,
        player2Name: p2Name,
        player1Gender: p1Gender,
        player2Gender: p2Gender,
        pairCategory: category,
        matchesPlayed: rec.matchesPlayed,
        matchesWon: rec.matchesWon,
        matchesLost: rec.matchesLost,
        winPercentage: winPct,
        pointsScored: rec.pointsScored,
        pointsConceded: rec.pointsConceded,
        pointDifferential: pointDiff,
        avgPointsScored: avgScored,
        avgPointsConceded: avgConceded,
        synergyScore: synergy,
        recentForm: rec.recentForm.slice(-5),
        matchHistory: rec.matchHistory,
      });
    });

    return result;
  }, [sessions, allMatchesMap, playersMap, sessionScopeFilter]);

  // Filtered and Sorted list
  const filteredAndSortedPairs = useMemo(() => {
    let list = allPairStats.filter((pair) => {
      // Min matches filter
      if (pair.matchesPlayed < minMatchesFilter) return false;

      // Category filter
      if (categoryFilter !== 'ALL' && pair.pairCategory !== categoryFilter) return false;

      // Search query (matches either player's name)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const p1Match = pair.player1Name.toLowerCase().includes(query);
        const p2Match = pair.player2Name.toLowerCase().includes(query);
        if (!p1Match && !p2Match) return false;
      }

      return true;
    });

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'SYNERGY') {
        if (b.synergyScore !== a.synergyScore) return b.synergyScore - a.synergyScore;
        return b.winPercentage - a.winPercentage;
      }
      if (sortBy === 'WIN_RATE') {
        if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
        return b.matchesPlayed - a.matchesPlayed;
      }
      if (sortBy === 'WINS') {
        if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
        return b.winPercentage - a.winPercentage;
      }
      if (sortBy === 'POINT_DIFF') {
        if (b.pointDifferential !== a.pointDifferential) return b.pointDifferential - a.pointDifferential;
        return b.winPercentage - a.winPercentage;
      }
      if (sortBy === 'PLAYED') {
        if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
        return b.winPercentage - a.winPercentage;
      }
      return 0;
    });

    return list;
  }, [allPairStats, minMatchesFilter, categoryFilter, searchQuery, sortBy]);

  // Top 3 Podium Pairs
  const podiumPairs = useMemo(() => {
    return filteredAndSortedPairs.slice(0, 3);
  }, [filteredAndSortedPairs]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Explanation Card */}
      <div className="light-10-grey-tile rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-sky-950/30 border border-emerald-500/20 p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />
            <h3 className="text-base font-black text-black dark:text-slate-100 tracking-tight">
              Team Pair Ranking & Synergy Analysis
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white text-emerald-950 border border-emerald-400 shadow-xs dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">
              Doubles Intelligence
            </span>
          </div>
          <p className="text-xs text-slate-800 dark:text-slate-400 max-w-2xl leading-relaxed font-bold">
            Identifies which member pairing performs best together in competitive and social doubles matches. 
            Use this to determine optimal doubles partnerships, team match lineups, and identify player chemistry.
          </p>
        </div>

        <div className="banner-stat-box flex items-center gap-3 bg-slate-950/80 px-4 py-2.5 rounded-xl border border-slate-800 text-xs shrink-0">
          <div className="text-center">
            <span className="text-[10px] text-slate-800 dark:text-slate-400 uppercase font-black block">Pairs Evaluated</span>
            <span className="text-sm font-black text-emerald-800 dark:text-emerald-400">{allPairStats.length}</span>
          </div>
          <div className="w-px h-6 bg-slate-400 dark:bg-slate-800" />
          <div className="text-center">
            <span className="text-[10px] text-slate-800 dark:text-slate-400 uppercase font-black block">Total Matches</span>
            <span className="text-sm font-black text-black dark:text-slate-200">
              {allPairStats.reduce((acc, p) => acc + p.matchesPlayed, 0) / 2}
            </span>
          </div>
        </div>
      </div>

      {/* Top 3 Best Performing Pairs Podium */}
      {podiumPairs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-black text-slate-900 dark:text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Top Performing Pairs Podium</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {podiumPairs.map((pair, idx) => {
              const medalColors = [
                'from-amber-500/20 via-slate-900 to-slate-900 border-amber-500/40 text-amber-300',
                'from-slate-400/20 via-slate-900 to-slate-900 border-slate-400/40 text-slate-200',
                'from-amber-700/20 via-slate-900 to-slate-900 border-amber-700/40 text-amber-600',
              ];
              const podiumClasses = ['podium-gold', 'podium-silver', 'podium-bronze'];
              const medalLabels = ['#1 Best Pair', '#2 Silver Pair', '#3 Bronze Pair'];

              return (
                <div
                  key={pair.pairKey}
                  className={`light-10-grey-tile ${podiumClasses[idx]} rounded-2xl bg-gradient-to-b ${medalColors[idx]} border p-4 shadow-xl space-y-3 relative overflow-hidden`}
                >
                  <div className="flex items-center justify-between">
                    <span className="podium-medal-badge px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-950/80 border border-slate-800 text-black dark:text-inherit shadow-xs">
                      {medalLabels[idx]}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black shadow-xs ${
                      pair.pairCategory === 'MENS'
                        ? 'bg-white text-sky-950 border border-sky-400 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30'
                        : pair.pairCategory === 'WOMENS'
                        ? 'bg-white text-rose-950 border border-rose-400 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                        : 'bg-white text-purple-950 border border-purple-400 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30'
                    }`}>
                      {pair.pairCategory === 'MENS' ? "Men's" : pair.pairCategory === 'WOMENS' ? "Women's" : 'Mixed'}
                    </span>
                  </div>

                  {/* Pair Member Names (Clickable) */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const p1 = playersMap.get(pair.player1Id);
                          if (p1) onSelectPlayerForPerformanceChart(p1);
                        }}
                        className="text-sm font-black text-black dark:text-slate-100 hover:text-sky-700 dark:hover:text-sky-400 hover:underline transition-colors cursor-pointer"
                        title="View member performance"
                      >
                        {pair.player1Name}
                      </button>
                      <span className="text-slate-800 dark:text-slate-500 font-black">&</span>
                      <button
                        type="button"
                        onClick={() => {
                          const p2 = playersMap.get(pair.player2Id);
                          if (p2) onSelectPlayerForPerformanceChart(p2);
                        }}
                        className="text-sm font-black text-black dark:text-slate-100 hover:text-sky-700 dark:hover:text-sky-400 hover:underline transition-colors cursor-pointer"
                        title="View member performance"
                      >
                        {pair.player2Name}
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-800 dark:text-slate-400 font-bold block">
                      {pair.matchesWon} wins out of {pair.matchesPlayed} matches
                    </span>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-400/80 dark:border-slate-800/80 text-center font-mono">
                    <div className="podium-stat-box bg-slate-950/60 rounded-xl p-2 border border-slate-300/80 dark:border-transparent">
                      <span className="text-[9.5px] font-sans text-slate-800 dark:text-slate-400 font-black block">Win Rate</span>
                      <span className="text-xs font-black text-sky-800 dark:text-sky-400">
                        {pair.winPercentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="podium-stat-box bg-slate-950/60 rounded-xl p-2 border border-slate-300/80 dark:border-transparent">
                      <span className="text-[9.5px] font-sans text-slate-800 dark:text-slate-400 font-black block">Diff (+/-)</span>
                      <span className={`text-xs font-black ${pair.pointDifferential >= 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
                        {pair.pointDifferential > 0 ? `+${pair.pointDifferential}` : pair.pointDifferential}
                      </span>
                    </div>
                    <div className="podium-stat-box bg-slate-950/60 rounded-xl p-2 border border-slate-300/80 dark:border-transparent">
                      <span className="text-[9.5px] font-sans text-slate-800 dark:text-slate-400 font-black block">Synergy</span>
                      <span className="text-xs font-black text-amber-800 dark:text-amber-400">
                        {pair.synergyScore}
                      </span>
                    </div>
                  </div>

                  {/* Recent Form Pills */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-800 dark:text-slate-400 font-black">Recent Form:</span>
                    <div className="flex items-center gap-1">
                      {pair.recentForm.map((res, i) => (
                        <span
                          key={i}
                          className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${
                            res === 'W'
                              ? 'bg-emerald-100 text-emerald-950 border border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40'
                              : 'bg-rose-100 text-rose-950 border border-rose-400 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/40'
                          }`}
                        >
                          {res}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters and Controls */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by player name..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
            {(['ALL', 'MENS', 'WOMENS', 'MIXED'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-sky-600 text-white shadow-sm font-black'
                    : 'text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200'
                }`}
              >
                {cat === 'ALL' ? 'All Pairs' : cat === 'MENS' ? "Men's" : cat === 'WOMENS' ? "Women's" : 'Mixed'}
              </button>
            ))}
          </div>

          {/* Min Matches Played Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-700 dark:text-slate-400 font-black whitespace-nowrap">Min Matches:</span>
            <select
              value={minMatchesFilter}
              onChange={(e) => setMinMatchesFilter(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-sky-500 font-bold"
            >
              <option value={1}>1+ Match</option>
              <option value={2}>2+ Matches</option>
              <option value={3}>3+ Matches</option>
              <option value={5}>5+ Matches</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-700 dark:text-slate-400 font-black whitespace-nowrap">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-sky-500 font-bold"
            >
              <option value="SYNERGY">Synergy Index</option>
              <option value="WIN_RATE">Highest Win %</option>
              <option value="WINS">Most Wins</option>
              <option value="POINT_DIFF">Point Diff (+/-)</option>
              <option value="PLAYED">Most Matches</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pair Rankings Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-950/60 font-black text-slate-800 dark:text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 w-14 text-center">Rank</th>
                <th className="py-3 px-3">Team Pair Members</th>
                <th className="py-3 px-2 text-center">Type</th>
                <th className="py-3 px-2 text-center">Played</th>
                <th className="py-3 px-2 text-center">Won</th>
                <th className="py-3 px-2 text-center">Lost</th>
                <th className="py-3 px-3 text-center">Win %</th>
                <th className="py-3 px-3 text-center">Pts Diff</th>
                <th className="py-3 px-3 text-center">Synergy</th>
                <th className="py-3 px-3 text-center">Recent Form</th>
                <th className="py-3 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-300 font-medium">
              {filteredAndSortedPairs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-400">
                      No team pairs matching current filters.
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Try lowering the minimum matches filter or clearing your search term.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedPairs.map((pair, index) => {
                  const rank = index + 1;
                  const isExpanded = expandedPairKey === pair.pairKey;

                  return (
                    <React.Fragment key={pair.pairKey}>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        
                        {/* Rank */}
                        <td className="py-3 px-3 text-center font-black">
                          {rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-xs font-black">
                              1
                            </span>
                          ) : rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-400/20 text-slate-800 dark:text-slate-200 border border-slate-400/40 text-xs font-black">
                              2
                            </span>
                          ) : rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-800 dark:text-amber-500 border border-amber-700/40 text-xs font-black">
                              3
                            </span>
                          ) : (
                            <span className="text-slate-500 font-bold text-xs font-mono">
                              #{rank}
                            </span>
                          )}
                        </td>

                        {/* Pair Members */}
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap items-center gap-1.5 font-bold">
                            <button
                              type="button"
                              onClick={() => {
                                const p1 = playersMap.get(pair.player1Id);
                                if (p1) onSelectPlayerForPerformanceChart(p1);
                              }}
                              className="text-slate-950 dark:text-slate-100 hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors cursor-pointer text-xs font-black"
                              title="Click to view performance trajectory"
                            >
                              {pair.player1Name}
                            </button>
                            <span className="text-slate-600 dark:text-slate-500 text-xs font-black">&</span>
                            <button
                              type="button"
                              onClick={() => {
                                const p2 = playersMap.get(pair.player2Id);
                                if (p2) onSelectPlayerForPerformanceChart(p2);
                              }}
                              className="text-slate-950 dark:text-slate-100 hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors cursor-pointer text-xs font-black"
                              title="Click to view performance trajectory"
                            >
                              {pair.player2Name}
                            </button>
                          </div>
                          <span className="text-[10.5px] text-slate-600 dark:text-slate-500 font-sans block font-semibold">
                            avg {pair.avgPointsScored.toFixed(1)} pts scored per game
                          </span>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            pair.pairCategory === 'MENS'
                              ? 'bg-sky-100 text-sky-900 border border-sky-300 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30'
                              : pair.pairCategory === 'WOMENS'
                              ? 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30'
                              : 'bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30'
                          }`}>
                            {pair.pairCategory === 'MENS' ? 'MD' : pair.pairCategory === 'WOMENS' ? 'WD' : 'XD'}
                          </span>
                        </td>

                        {/* Played */}
                        <td className="py-3 px-2 text-center font-mono font-bold text-slate-900 dark:text-slate-200">
                          {pair.matchesPlayed}
                        </td>

                        {/* Won */}
                        <td className="py-3 px-2 text-center font-mono font-black text-emerald-700 dark:text-emerald-400">
                          {pair.matchesWon}
                        </td>

                        {/* Lost */}
                        <td className="py-3 px-2 text-center font-mono font-black text-rose-700 dark:text-rose-400">
                          {pair.matchesLost}
                        </td>

                        {/* Win % */}
                        <td className="py-3 px-3 text-center font-mono">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-black text-sky-700 dark:text-sky-400 text-xs">
                              {pair.winPercentage.toFixed(1)}%
                            </span>
                            <div className="w-16 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-sky-500 h-full rounded-full"
                                style={{ width: `${pair.winPercentage}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Pts Diff */}
                        <td className="py-3 px-3 text-center font-mono font-black">
                          <span className={pair.pointDifferential >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                            {pair.pointDifferential > 0 ? `+${pair.pointDifferential}` : pair.pointDifferential}
                          </span>
                        </td>

                        {/* Synergy Rating */}
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20 text-xs font-black">
                            {pair.synergyScore}
                          </span>
                        </td>

                        {/* Form */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            {pair.recentForm.map((res, i) => (
                              <span
                                key={i}
                                className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${
                                  res === 'W'
                                    ? 'bg-emerald-100 text-emerald-950 border border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
                                    : 'bg-rose-100 text-rose-950 border border-rose-400 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30'
                                }`}
                              >
                                {res}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Details Toggle */}
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setExpandedPairKey(isExpanded ? null : pair.pairKey)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                          >
                            <span>{pair.matchHistory.length} games</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Match History Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={11} className="p-4 bg-slate-50 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800">
                            <div className="space-y-3 max-w-4xl mx-auto">
                              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                                <span className="text-xs font-black text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                                  <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                                  <span>
                                    All Matches Played Together by {pair.player1Name} & {pair.player2Name}
                                  </span>
                                </span>
                                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                                  {pair.matchesWon} Wins, {pair.matchesLost} Losses ({pair.pointsScored} pts scored, {pair.pointsConceded} conceded)
                                </span>
                              </div>

                              <div className="space-y-2">
                                {pair.matchHistory.map((h, hIdx) => {
                                  const dateStr = new Date(h.date).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                  });

                                  return (
                                    <div
                                      key={hIdx}
                                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                          h.won
                                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                                            : 'bg-rose-100 text-rose-950 border border-rose-400 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                                        }`}>
                                          {h.won ? 'VICTORY' : 'DEFEAT'}
                                        </span>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                                          vs <strong className="text-slate-950 dark:text-white">{h.opponent1Name}</strong> & <strong className="text-slate-950 dark:text-white">{h.opponent2Name}</strong>
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-4">
                                        <span className="text-[11px] text-slate-400 font-mono">
                                          {h.sessionName} ({dateStr})
                                        </span>
                                        <div className="font-mono font-bold text-slate-100">
                                          <span className={h.won ? 'text-emerald-400 font-black' : 'text-slate-300'}>
                                            {h.teamScore}
                                          </span>
                                          <span className="text-slate-500 mx-1">-</span>
                                          <span className={!h.won ? 'text-rose-400 font-black' : 'text-slate-300'}>
                                            {h.opponentScore}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
