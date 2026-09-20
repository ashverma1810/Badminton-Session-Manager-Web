import React, { useState, useEffect } from 'react';
import { X, Trophy, Clock, Tv, Users } from 'lucide-react';
import type { 
  CourtEntity, 
  PlayerEntity, 
  MatchEntity, 
  SessionEntity, 
  ClubEntity 
} from '../types';
import { ClubLogo } from './ClubLogo';

interface FullscreenCourtMonitorProps {
  onClose: () => void;
  clubDetails: ClubEntity | null;
  activeSession: SessionEntity | null;
  courts: CourtEntity[];
  players: PlayerEntity[];
  matches: MatchEntity[];
}

export const FullscreenCourtMonitor: React.FC<FullscreenCourtMonitorProps> = ({
  onClose,
  clubDetails,
  activeSession,
  courts,
  players,
  matches,
}) => {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    const start = activeSession?.startTime || activeSession?.createdAt || Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSession]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activeMatchesMap: Record<number, MatchEntity> = {};
  matches.forEach((m) => {
    if (m.endTime == null) {
      activeMatchesMap[m.courtId] = m;
    }
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col p-6 overflow-hidden animate-fade-in">
      
      {/* Top TV Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 aspect-[3/2] rounded-xl overflow-hidden shadow-md border border-slate-700 bg-white flex items-center justify-center p-0.5 shrink-0">
            <ClubLogo className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-100">
              {clubDetails?.name || 'Badminton Club'}
            </h1>
            <p className="text-xs text-slate-400">
              {activeSession?.name || 'Live Session'} • {courts.length} Sports Hall Courts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 font-mono text-emerald-400 font-bold text-base">
            <Clock className="w-4 h-4" />
            <span>{formatTimer(elapsed)}</span>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Big TV Courts Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-6 overflow-y-auto">
        {courts.map((court) => {
          const match = activeMatchesMap[court.id];
          const p1A = match ? players.find((p) => p.id === match.teamAPlayer1Id) : null;
          const p2A = match && match.teamAPlayer2Id ? players.find((p) => p.id === match.teamAPlayer2Id) : null;
          const p1B = match ? players.find((p) => p.id === match.teamBPlayer1Id) : null;
          const p2B = match && match.teamBPlayer2Id ? players.find((p) => p.id === match.teamBPlayer2Id) : null;

          return (
            <div
              key={court.id}
              className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-lg font-black tracking-wider text-sky-400 uppercase">
                  {court.name}
                </span>
                {match ? (
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                    Match #{match.matchNumber}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-500">
                    Court Available
                  </span>
                )}
              </div>

              {match ? (
                <div className="grid grid-cols-2 gap-4 my-auto">
                  {/* Team A */}
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-center space-y-2">
                    <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block">
                      Team A
                    </span>
                    <p className="text-sm font-black text-white truncate">
                      {p1A?.name || 'Player 1'}
                    </p>
                    {p2A && (
                      <p className="text-sm font-black text-white truncate">
                        {p2A.name}
                      </p>
                    )}
                    <div className="pt-2 text-5xl font-black font-mono text-sky-300">
                      {match.teamAScore ?? 0}
                    </div>
                  </div>

                  {/* Team B */}
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-center space-y-2">
                    <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                      Team B
                    </span>
                    <p className="text-sm font-black text-white truncate">
                      {p1B?.name || 'Player 1'}
                    </p>
                    {p2B && (
                      <p className="text-sm font-black text-white truncate">
                        {p2B.name}
                      </p>
                    )}
                    <div className="pt-2 text-5xl font-black font-mono text-indigo-300">
                      {match.teamBScore ?? 0}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="my-auto text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-bold">Waiting for next fair match allocation</p>
                </div>
              )}

              <div className="text-center text-xs text-slate-500 pt-3 border-t border-slate-800/80">
                Target Score: {clubDetails?.targetScore || 21} Points
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
