import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (showReconnected) {
    return (
      <div 
        id="pwa-online-toast"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-600/90 text-white px-3.5 py-2 text-xs font-semibold shadow-xl backdrop-blur-xs border border-emerald-400/30 animate-bounce"
      >
        <Wifi className="w-4 h-4 text-emerald-200" />
        <span>Connected — Realtime sync restored</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div 
        id="pwa-offline-banner"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-500/95 text-slate-950 px-3.5 py-2 text-xs font-bold shadow-2xl backdrop-blur-xs border border-amber-300"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-900 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-950"></span>
        </span>
        <WifiOff className="w-4 h-4 text-amber-950" />
        <span>Sports Hall Offline Mode — Local matches & scorekeeper cached</span>
      </div>
    );
  }

  return null;
};
