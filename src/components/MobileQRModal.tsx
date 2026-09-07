import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, ShieldCheck, Copy, Check } from 'lucide-react';
import { DEFAULT_CLUB_ID } from '../lib/firebase';

interface MobileQRModalProps {
  onClose: () => void;
}

export const MobileQRModal: React.FC<MobileQRModalProps> = ({ onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    QRCode.toDataURL(currentUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#0284C7',
        light: '#FFFFFF'
      }
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error(err));
  }, [currentUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-center relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
          <Smartphone className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-base font-black text-slate-100">
            Mobile & Android App Realtime Sync
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Scan with your mobile camera or Android Badminton Session Manager app to connect seamlessly.
          </p>
        </div>

        {/* QR Code Canvas */}
        <div className="bg-white p-3 rounded-2xl inline-block shadow-inner">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Club QR Code" className="w-48 h-48 rounded-xl" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
              Generating QR...
            </div>
          )}
        </div>

        <div className="bg-slate-800/80 rounded-xl p-3 text-[11px] text-slate-300 flex items-center justify-between border border-slate-700">
          <span className="truncate max-w-[180px] font-mono text-slate-400">
            {currentUrl}
          </span>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1 text-sky-400 font-bold hover:underline cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Tenant Scope ID: <strong className="text-slate-200">{DEFAULT_CLUB_ID}</strong></span>
        </div>
      </div>
    </div>
  );
};
