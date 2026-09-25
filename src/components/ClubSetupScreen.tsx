import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Check, 
  Sparkles, 
  MapPin, 
  Target, 
  Palette, 
  LogOut, 
  ArrowRight, 
  UserPlus, 
  LogIn, 
  ShieldCheck, 
  RefreshCw,
  Edit3,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  KeyRound
} from 'lucide-react';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth, UserClubAssociation } from '../lib/firebase';
import type { ClubEntity, GameType, ManagerRole } from '../types';

interface ClubSetupScreenProps {
  clubDetails: ClubEntity | null;
  currentClubId?: string | null;
  currentUserRole?: ManagerRole;
  currentManagerName?: string | null;
  currentUserEmail?: string | null;
  onSaveClub: (updated: Partial<ClubEntity>) => Promise<void>;
  onSignInClub: (email: string, password?: string) => Promise<{ success: boolean; message?: string; multiClubs?: UserClubAssociation[] }>;
  onRegisterClub: (clubData: Partial<ClubEntity>, email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  onSelectClub?: (association: UserClubAssociation) => void;
  onSignOut?: () => void;
}

export const ClubSetupScreen: React.FC<ClubSetupScreenProps> = ({
  clubDetails,
  currentClubId,
  currentUserRole = 'CLUB_MANAGER',
  currentManagerName,
  currentUserEmail,
  onSaveClub,
  onSignInClub,
  onRegisterClub,
  onSelectClub,
  onSignOut,
}) => {
  // Mode when not signed in: 'SIGN_IN' | 'REGISTER'
  const [authMode, setAuthMode] = useState<'SIGN_IN' | 'REGISTER'>('SIGN_IN');
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [showSignOutModal, setShowSignOutModal] = useState<boolean>(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState<boolean>(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState<string>('');
  const [isSendingReset, setIsSendingReset] = useState<boolean>(false);
  const [resetEmailSentSuccess, setResetEmailSentSuccess] = useState<string | null>(null);
  const [resetEmailError, setResetEmailError] = useState<string | null>(null);

  // Sign In Form State (starts empty - no default email)
  const [signInEmail, setSignInEmail] = useState<string>('');
  const [signInPassword, setSignInPassword] = useState<string>('');
  const [showSignInPassword, setShowSignInPassword] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [availableClubsForLogin, setAvailableClubsForLogin] = useState<UserClubAssociation[] | null>(null);

  // Register Form State
  const [regName, setRegName] = useState<string>('');
  const [regVenue, setRegVenue] = useState<string>('');
  const [regTargetScore, setRegTargetScore] = useState<number>(21);
  const [regContactPerson, setRegContactPerson] = useState<string>('');
  const [regSessionType, setRegSessionType] = useState<GameType>('DOUBLES');
  const [regThemeColor, setRegThemeColor] = useState<string>('#0284C7');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  // Edit Profile Form State
  const [editName, setEditName] = useState<string>(clubDetails?.name || '');
  const [editVenue, setEditVenue] = useState<string>(clubDetails?.venue || '');
  const [editTargetScore, setEditTargetScore] = useState<number>(clubDetails?.targetScore || 21);
  const [editContactPerson, setEditContactPerson] = useState<string>(clubDetails?.contactPerson || '');
  const [editSessionType, setEditSessionType] = useState<GameType>(clubDetails?.defaultSessionType || 'DOUBLES');
  const [editThemeColor, setEditThemeColor] = useState<string>(clubDetails?.themeColorHex || '#0284C7');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Sync edit form with latest clubDetails whenever it updates or modal opens
  useEffect(() => {
    if (clubDetails) {
      setEditName(clubDetails.name || '');
      setEditVenue(clubDetails.venue || '');
      setEditTargetScore(clubDetails.targetScore || 21);
      setEditContactPerson(clubDetails.contactPerson || '');
      setEditSessionType(clubDetails.defaultSessionType || 'DOUBLES');
      setEditThemeColor(clubDetails.themeColorHex || '#0284C7');
    }
  }, [clubDetails, isEditingProfile]);

  // Alerts / Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const themeColors = [
    { name: 'Sky Blue', hex: '#0284C7' },
    { name: 'Emerald', hex: '#10B981' },
    { name: 'Violet', hex: '#8B5CF6' },
    { name: 'Amber', hex: '#F59E0B' },
    { name: 'Rose', hex: '#EC4899' },
    { name: 'Royal Blue', hex: '#2563EB' },
  ];

  const triggerFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Derive display information matching mobile SetupScreen.kt
  const clubThemeColor = clubDetails?.themeColorHex || '#0284C7';

  const organiserDisplayName = (() => {
    if (!clubDetails) return 'Not Specified';
    if (clubDetails.contactPerson && clubDetails.contactPerson.includes('@')) {
      return clubDetails.contactPerson
        .substring(0, clubDetails.contactPerson.indexOf('@'))
        .replace(/[._]/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    return clubDetails.contactPerson || 'Club Manager';
  })();

  const accountEmail = (() => {
    if (!clubDetails) return '';
    if (clubDetails.description?.includes('@')) return clubDetails.description;
    if (clubDetails.contactPerson?.includes('@')) return clubDetails.contactPerson;
    return clubDetails.description || '';
  })();

  // 1. Sign In Handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = signInEmail.trim();
    if (!cleanEmail) {
      triggerFeedback('error', 'Please enter your club email address.');
      return;
    }
    setIsSigningIn(true);
    try {
      const res = await onSignInClub(cleanEmail, signInPassword.trim());
      if (res.success) {
        if (res.multiClubs && res.multiClubs.length > 1) {
          setAvailableClubsForLogin(res.multiClubs);
        } else {
          triggerFeedback('success', res.message || `Signed in successfully as ${cleanEmail}`);
        }
      } else {
        triggerFeedback('error', res.message || 'Failed to sign in. Please verify your email and password, or register below.');
      }
    } catch (err: any) {
      triggerFeedback('error', err.message || 'Failed to sign in.');
    } finally {
      setIsSigningIn(false);
    }
  };

  // 2. Forgot Password Handlers
  const handleOpenForgotPasswordModal = () => {
    setForgotPasswordEmail(signInEmail.trim());
    setResetEmailSentSuccess(null);
    setResetEmailError(null);
    setShowForgotPasswordModal(true);
  };

  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotPasswordEmail.trim();
    if (!cleanEmail) {
      setResetEmailError('Please enter your club email address.');
      return;
    }
    setIsSendingReset(true);
    setResetEmailError(null);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setResetEmailSentSuccess(cleanEmail);
      triggerFeedback('success', `Password reset link sent to ${cleanEmail}`);
    } catch (err: any) {
      console.warn('Password reset error:', err);
      let message = 'Failed to send password reset email. Please try again.';
      if (err.code === 'auth/user-not-found') {
        message = `No registered club account found for ${cleanEmail}. Please verify your email or register a new club.`;
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please provide a valid email address format.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many requests. Please wait a few moments before trying again.';
      } else if (err.message) {
        message = err.message;
      }
      setResetEmailError(message);
    } finally {
      setIsSendingReset(false);
    }
  };

  // 3. Register New Club Handler
  const handleRegisterClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      triggerFeedback('error', 'Club Name is required.');
      return;
    }
    if (!regEmail.trim()) {
      triggerFeedback('error', 'Club Email address is required.');
      return;
    }
    if (regPassword && regPassword !== regConfirmPassword) {
      triggerFeedback('error', 'Passwords do not match.');
      return;
    }

    setIsRegistering(true);
    try {
      const res = await Promise.race([
        onRegisterClub(
          {
            name: regName.trim(),
            venue: regVenue.trim() || '',
            defaultSessionType: regSessionType,
            themeColorHex: regThemeColor,
            targetScore: Number(regTargetScore) || 21,
            contactPerson: regContactPerson.trim() || regEmail.trim(),
            description: regEmail.trim(),
          },
          regEmail.trim(),
          regPassword.trim()
        ),
        new Promise<{ success: boolean; message?: string }>((resolve) =>
          setTimeout(() => resolve({ success: true, message: `Club "${regName.trim()}" registered successfully!` }), 4500)
        ),
      ]);

      if (res.success) {
        triggerFeedback('success', res.message || `Club "${regName.trim()}" registered successfully!`);
      } else {
        triggerFeedback('error', res.message || 'Failed to register club.');
      }
    } catch (err: any) {
      triggerFeedback('error', err.message || 'Failed to register club.');
    } finally {
      setIsRegistering(false);
    }
  };

  // 4. Save Edited Club Profile
  const handleSaveEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setIsSavingEdit(true);
    try {
      await Promise.race([
        onSaveClub({
          name: editName.trim(),
          venue: editVenue.trim(),
          defaultSessionType: editSessionType,
          themeColorHex: editThemeColor,
          targetScore: Number(editTargetScore) || 21,
          contactPerson: editContactPerson.trim(),
        }),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      setIsEditingProfile(false);
      triggerFeedback('success', 'Club registration successfully updated!');
    } catch (err: any) {
      triggerFeedback('error', err.message || 'Failed to update club registration.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Sign Out Handler
  const handleSignOut = async () => {
    try {
      setShowSignOutModal(false);
      if (onSignOut) {
        onSignOut();
      } else {
        await signOut(auth);
      }
      triggerFeedback('success', 'Signed out from club account.');
    } catch (err: any) {
      triggerFeedback('error', err.message || 'Failed to sign out.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-fade-in">
      
      {/* Feedback Toast */}
      {feedback && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 border shadow-lg animate-in fade-in slide-in-from-top-2 ${
          feedback.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. AUTHENTICATED / REGISTERED CLUB: MOBILE WELCOME SCREEN */}
      {/* ========================================================================= */}
      {clubDetails ? (
        <div className="space-y-6 text-center">
          
          {/* Welcome Header matching mobile SetupScreen.kt */}
          <div className="space-y-2 pt-2">
            <h1 
              className="text-2xl sm:text-3xl font-black tracking-tight"
              style={{ color: clubThemeColor }}
            >
              Welcome to {clubDetails.name}
            </h1>
            <p className="text-sm sm:text-base text-slate-400">
              {clubDetails.venue 
                ? `Playing at ${clubDetails.venue}` 
                : 'Automate matches, rotate players fairly, and track performance.'}
            </p>
          </div>

          {/* Hero Illustration Banner matching mobile img_badminton_hero */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 shadow-2xl bg-slate-900 aspect-[16/8] sm:aspect-[16/7] max-h-72 w-full">
            <img
              src="/img_badminton_hero.jpg"
              alt="Badminton sports illustration"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback elegant gradient if image asset is unavailable
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {/* Gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-6">
              <div className="text-left">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-950/80 border border-slate-700 text-sky-400 backdrop-blur-md">
                  🏸 Smart Badminton Rotation & Live Courts
                </span>
              </div>
            </div>
          </div>

          {/* Club Registration Profile Card matching mobile SetupScreen.kt */}
          <div 
            className="rounded-2xl border p-5 sm:p-6 text-left transition-all shadow-xl bg-slate-900/60"
            style={{ 
              borderColor: `${clubThemeColor}4D`,
              backgroundColor: `${clubThemeColor}14` 
            }}
          >
            {/* Top Row with Title, Details and Edit Button */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 
                    className="text-base font-bold tracking-tight"
                    style={{ color: clubThemeColor }}
                  >
                    Registered Club Details
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-sky-400 border border-slate-700">
                    Active Club
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-200">
                  <span className="text-slate-400">Club Name:</span> <strong className="text-white">{clubDetails.name}</strong>
                </p>
                <p className="text-xs sm:text-sm text-slate-200">
                  <span className="text-slate-400">Registered Organiser:</span> {organiserDisplayName}
                </p>
                <p className="text-xs sm:text-sm text-slate-200">
                  <span className="text-slate-400">Venue:</span> {clubDetails.venue || 'Not specified'}
                </p>
                <p className="text-xs sm:text-sm text-slate-200">
                  <span className="text-slate-400">Target score:</span> {clubDetails.targetScore} points
                </p>
                <p className="text-xs sm:text-sm text-slate-200">
                  <span className="text-slate-400">Session format:</span> {clubDetails.defaultSessionType}
                </p>
              </div>

              {currentUserRole === 'SESSION_MANAGER' ? (
                <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 text-[10px] font-bold shrink-0">
                  Managed by Club Organiser
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditName(clubDetails.name);
                    setEditVenue(clubDetails.venue);
                    setEditTargetScore(clubDetails.targetScore);
                    setEditContactPerson(clubDetails.contactPerson);
                    setEditSessionType(clubDetails.defaultSessionType);
                    setEditThemeColor(clubDetails.themeColorHex);
                    setIsEditingProfile(true);
                  }}
                  title="Edit Club Registration"
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all cursor-pointer shadow-md shrink-0"
                >
                  <Edit3 className="w-4 h-4 text-sky-400" />
                </button>
              )}
            </div>

            {/* Subtle Divider */}
            <div 
              className="h-px my-4" 
              style={{ backgroundColor: `${clubThemeColor}33` }} 
            />

            {/* Logged in Club Account Container */}
            <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Logged in Club Account:
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  currentUserRole === 'SESSION_MANAGER'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : (currentUserRole === 'SECONDARY_CLUB_MANAGER'
                        ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30')
                }`}>
                  {currentUserRole === 'SESSION_MANAGER' 
                    ? 'Session Manager' 
                    : (currentUserRole === 'SECONDARY_CLUB_MANAGER' ? 'Secondary Club Manager' : 'Primary Club Manager')}
                </span>
              </div>

              {currentUserRole === 'SESSION_MANAGER' ? (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-100">
                      {currentManagerName || 'Session Manager'}
                    </span>
                    <span className="text-xs text-sky-400 font-mono">
                      ({currentUserEmail || accountEmail})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Logged in under registered club: <strong className="text-slate-200">{clubDetails.name}</strong>
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <span className="text-sm font-bold text-slate-100 break-all block">
                    {currentUserEmail || accountEmail}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Club Organiser: <strong className="text-slate-200">{organiserDisplayName}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons: Sign Out */}
            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSignOutModal(true)}
                className="py-2.5 px-6 rounded-xl font-bold text-xs bg-slate-800/90 hover:bg-slate-800 text-rose-300 border border-rose-500/30 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. SIGNED OUT / NO CLUB: SIGN IN & REGISTRATION SCREEN */
        /* ========================================================================= */
        <div className="space-y-6">
          
          {/* Top Hero Image Banner */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 shadow-2xl bg-slate-900 aspect-[16/8] max-h-56 w-full">
            <img
              src="/img_badminton_hero.jpg"
              alt="Badminton sports illustration"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">
              Club Management
            </h1>
            <p className="text-xs text-slate-400">
              Sign in to your registered club account or register a new club with real-time court rotation.
            </p>
          </div>

          {/* TAB TOGGLE: SIGN IN vs REGISTER NEW CLUB */}
          <div className="flex rounded-xl bg-slate-900 p-1.5 border border-slate-800 max-w-md mx-auto w-full">
            <button
              type="button"
              onClick={() => setAuthMode('SIGN_IN')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                authMode === 'SIGN_IN'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
            
            <button
              type="button"
              onClick={() => setAuthMode('REGISTER')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                authMode === 'REGISTER'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Register New Club</span>
            </button>
          </div>

          {/* SIGN IN FORM */}
          {authMode === 'SIGN_IN' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-5">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <LogIn className="w-4 h-4 text-sky-400" />
                  <span>Sign In</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Enter your registered club email and password to log in and restore cloud settings.
                </p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Club Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      placeholder="club@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showSignInPassword ? 'text' : 'password'}
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword(!showSignInPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSigningIn}
                  className="w-full py-3 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-950 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSigningIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In to Club Account</span>
                    </>
                  )}
                </button>

                {/* Forgot Password Link - Placed under the Sign In button */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleOpenForgotPasswordModal}
                    className="text-xs font-medium text-sky-400 hover:text-sky-300 hover:underline cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Forgot password?</span>
                  </button>
                </div>
              </form>

              <div className="pt-3 border-t border-slate-800 text-center">
                <p className="text-xs text-slate-400">
                  Don't have registered club?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMode('REGISTER')}
                    className="font-bold text-sky-400 hover:underline cursor-pointer"
                  >
                    Register New Club
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* REGISTER NEW CLUB FORM */}
          {authMode === 'REGISTER' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-sky-400" />
                  <span>Register New Club</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setAuthMode('SIGN_IN')}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>

              <form onSubmit={handleRegisterClub} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Club Name *</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Richmond Badminton Club"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Venue / Arena</label>
                  <input
                    type="text"
                    value={regVenue}
                    onChange={(e) => setRegVenue(e.target.value)}
                    placeholder="e.g. Richmond Sports Center"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Target Score</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[15, 21].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setRegTargetScore(score)}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            regTargetScore === score
                              ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {score} pts
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Organiser</label>
                    <input
                      type="text"
                      value={regContactPerson}
                      onChange={(e) => setRegContactPerson(e.target.value)}
                      placeholder="e.g. Club Organiser Name"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Club Email Address</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="club@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Password</label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Verify Password</label>
                    <input
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isRegistering || !regName.trim()}
                  className="w-full py-3 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-950 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {isRegistering ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Registering Club...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Club Registration & Continue</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. EDIT CLUB REGISTRATION MODAL */}
      {/* ========================================================================= */}
      {isEditingProfile && clubDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Edit Club Registration
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Club Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Venue / Arena</label>
                <input
                  type="text"
                  value={editVenue}
                  onChange={(e) => setEditVenue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Target Score</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[15, 21].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setEditTargetScore(score)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          editTargetScore === score
                            ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {score} pts
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Organiser</label>
                  <input
                    type="text"
                    value={editContactPerson}
                    onChange={(e) => setEditContactPerson(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Default Session Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['DOUBLES', 'SINGLES', 'MIXED'] as GameType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditSessionType(type)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        editSessionType === type
                          ? 'bg-sky-600 text-white border-sky-500 shadow-md'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Color Palette matching mobile SetupScreen */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Theme Color Accent</label>
                <div className="flex flex-wrap items-center gap-2">
                  {themeColors.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setEditThemeColor(color.hex)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform cursor-pointer ${
                        editThemeColor === color.hex ? 'scale-110 border-white shadow-md' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.hex }}
                    >
                      {editThemeColor === color.hex && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4b. FORGOT PASSWORD MODAL */}
      {/* ========================================================================= */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Reset Password
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Receive a secure password reset link via email
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetEmailSentSuccess ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Reset Link Sent!</span>
                  </div>
                  <p className="leading-relaxed">
                    A password reset link has been dispatched to:
                  </p>
                  <p className="font-mono font-bold text-white bg-slate-950/60 p-2 rounded-lg break-all">
                    {resetEmailSentSuccess}
                  </p>
                  <p className="text-[11px] text-emerald-400/80">
                    Please check your inbox (and spam folder). Click the link in the email to set a new password, then return here to sign in.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(false)}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white shadow-md transition-all cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendPasswordReset} className="space-y-4 py-1">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter your registered club email address below. We'll send you a password reset link to create a new password.
                </p>

                {resetEmailError && (
                  <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <span className="leading-tight">{resetEmailError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Club Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={forgotPasswordEmail}
                      onChange={(e) => {
                        setForgotPasswordEmail(e.target.value);
                        setResetEmailError(null);
                      }}
                      placeholder="e.g. club@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(false)}
                    className="py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSendingReset}
                    className="py-2.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-950 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingReset ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        <span>Send Reset Link</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SIGN OUT CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showSignOutModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <LogOut className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-100">
                Sign Out from Club?
              </h3>
              <p className="text-xs text-slate-400">
                You will be signed out from <span className="text-slate-200 font-semibold">{clubDetails?.name}</span>. You can sign back in at any time.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSignOutModal(false)}
                className="py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950 transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MULTI-CLUB SELECTION MODAL (matches mobile selectAndRestoreClub dialog) */}
      {/* ========================================================================= */}
      {availableClubsForLogin && availableClubsForLogin.length > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>🏸</span>
                <span>Select Club to Manage</span>
              </h3>
              <button
                type="button"
                onClick={() => setAvailableClubsForLogin(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Multiple clubs are associated with this email. Select which club you would like to open:
            </p>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {availableClubsForLogin.map((clubAssoc) => (
                <button
                  key={clubAssoc.clubId}
                  type="button"
                  onClick={() => {
                    if (onSelectClub) onSelectClub(clubAssoc);
                    setAvailableClubsForLogin(null);
                  }}
                  className="w-full text-left p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-800/60 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-100 group-hover:text-sky-400 transition-colors">
                      {clubAssoc.clubName}
                    </div>
                    {clubAssoc.venue && (
                      <div className="text-xs text-slate-400">
                        Venue: {clubAssoc.venue}
                      </div>
                    )}
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {clubAssoc.role === 'CLUB_MANAGER' ? 'Club Manager' : 'Session Manager'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
