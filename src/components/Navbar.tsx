import React from 'react';
import { 
  Trophy, 
  Settings2, 
  Calendar, 
  PlayCircle, 
  History, 
  TrendingUp,
  Sun, 
  Moon
} from 'lucide-react';
import type { ClubEntity, SessionEntity } from '../types';
import { ClubLogo } from './ClubLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  activeTab: 'SETUP' | 'CLUB' | 'LIVE' | 'HISTORY';
  setActiveTab: (tab: 'SETUP' | 'CLUB' | 'LIVE' | 'HISTORY') => void;
  clubDetails: ClubEntity | null;
  activeSession: SessionEntity | null;
  isRealtimeConnected: boolean;
  isLoggedIn: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  clubDetails,
  activeSession,
  isRealtimeConnected,
  isLoggedIn,
  theme,
  onToggleTheme,
}) => {
  const themeColor = clubDetails?.themeColorHex || '#0284C7';
  const isDark = theme === 'dark';

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-md transition-colors ${
      isDark 
        ? 'bg-slate-900/90 border-b border-slate-800 text-slate-100' 
        : 'bg-white/95 border-b border-slate-200 text-slate-950 shadow-sm'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand & Club Info */}
          <div className="flex items-center gap-3">
            <div 
              className="h-10 aspect-[3/2] rounded-xl overflow-hidden shadow-md border border-slate-200 dark:border-slate-800 transition-transform hover:scale-105 select-none shrink-0 bg-white flex items-center justify-center p-0.5"
            >
              <ClubLogo className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center gap-2.5">
              {/* Brand Name & Tagline Box strictly matched in width */}
              <div className="inline-flex flex-col w-fit">
                <h1 className={`text-base sm:text-lg font-black tracking-tight leading-tight whitespace-nowrap ${
                  isDark ? 'text-slate-100' : 'text-slate-950'
                }`}>
                  Shuttler Club
                </h1>
                <div className={`flex items-center justify-between w-full text-[7.5px] sm:text-[8px] font-bold uppercase select-none leading-none pt-0.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <span>PLAY</span>
                  <span className="text-sky-500 font-black">•</span>
                  <span>CONNECT</span>
                  <span className="text-sky-500 font-black">•</span>
                  <span>BELONG</span>
                </div>
              </div>

              {activeSession && (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  activeSession.status === 'Active' 
                    ? (isDark ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200') 
                    : (isDark ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-200')
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    activeSession.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`} />
                  {activeSession.status === 'Active' ? 'Active' : 'Setup'}
                </span>
              )}
            </div>
          </div>

          {/* Navigation Tabs matching Android: Club (Setup) | Sessions (Weekly) | Live | History */}
          <nav className={`hidden md:flex items-center gap-1 p-1 rounded-xl border ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setActiveTab('SETUP')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'SETUP'
                  ? (isDark ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-950 shadow-sm border border-slate-200')
                  : (isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50' : 'text-slate-500 hover:text-slate-950 hover:bg-slate-200/50')
              }`}
            >
              <Settings2 className="w-4 h-4 text-sky-500" />
              <span>Club</span>
            </button>

            <button
              onClick={() => setActiveTab('CLUB')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'CLUB'
                  ? (isDark ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-950 shadow-sm border border-slate-200')
                  : (isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50' : 'text-slate-500 hover:text-slate-950 hover:bg-slate-200/50')
              }`}
            >
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>Sessions</span>
            </button>

            <button
              onClick={() => setActiveTab('LIVE')}
              disabled={!activeSession}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === 'LIVE'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                  : (isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50' : 'text-slate-500 hover:text-slate-950 hover:bg-slate-200/50')
              }`}
            >
              <PlayCircle className="w-4 h-4 text-emerald-400" />
              <span>Live Session</span>
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'HISTORY'
                  ? (isDark ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-950 shadow-sm border border-slate-200')
                  : (isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50' : 'text-slate-500 hover:text-slate-950 hover:bg-slate-200/50')
              }`}
            >
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span>Performance</span>
            </button>
          </nav>

          {/* Quick Actions in Top Right Corner */}
          <div className="flex items-center gap-2.5">
            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* Toggle Light / Dark Mode */}
            <button
              type="button"
              onClick={onToggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                isDark
                  ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-amber-400 hover:text-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800 hover:text-slate-950'
              }`}
              aria-label="Toggle theme mode"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Sync Indicator: Green when logged in, Red when logged out */}
            <div 
              title={isLoggedIn ? 'Synchronized with Firebase (Logged In)' : 'Disconnected from Cloud (Logged Out)'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                isLoggedIn 
                  ? (isDark 
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700')
                  : (isDark 
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-400' 
                      : 'bg-rose-50 border-rose-200 text-rose-700')
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full transition-all ${
                isLoggedIn 
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse' 
                  : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]'
              }`} />
              <span className="text-[11px] font-mono tracking-wider">
                {isLoggedIn ? 'SYNC' : 'LOGGED OUT'}
              </span>
            </div>
          </div>

        </div>

        {/* Mobile Navigation Tabs */}
        <div className={`flex md:hidden items-center justify-around py-2 border-t ${
          isDark ? 'border-slate-800/80' : 'border-slate-200'
        }`}>
          <button
            onClick={() => setActiveTab('SETUP')}
            className={`flex flex-col items-center gap-1 text-[11px] font-bold ${
              activeTab === 'SETUP' ? 'text-sky-500' : (isDark ? 'text-slate-400' : 'text-slate-600')
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>Club</span>
          </button>

          <button
            onClick={() => setActiveTab('CLUB')}
            className={`flex flex-col items-center gap-1 text-[11px] font-bold ${
              activeTab === 'CLUB' ? 'text-indigo-500' : (isDark ? 'text-slate-400' : 'text-slate-600')
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Sessions</span>
          </button>

          <button
            onClick={() => setActiveTab('LIVE')}
            disabled={!activeSession}
            className={`flex flex-col items-center gap-1 text-[11px] font-bold disabled:opacity-40 ${
              activeTab === 'LIVE' ? 'text-emerald-500' : (isDark ? 'text-slate-400' : 'text-slate-600')
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>Live</span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex flex-col items-center gap-1 text-[11px] font-bold ${
              activeTab === 'HISTORY' ? 'text-amber-500' : (isDark ? 'text-slate-400' : 'text-slate-600')
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Performance</span>
          </button>
        </div>

      </div>
    </header>
  );
};

