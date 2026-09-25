import React, { useState } from 'react';
import { 
  Users, 
  Calendar, 
  Zap, 
  ShieldCheck, 
  Plus, 
  Search, 
  Trash2, 
  Play, 
  ChevronRight, 
  Check, 
  X, 
  Clock, 
  Layers, 
  AlertCircle, 
  UserPlus, 
  ArrowRight, 
  CheckCircle2, 
  UserCheck, 
  Shield, 
  Info,
  Radio,
  Flame,
  Award,
  Sparkles,
  Mail,
  Loader2,
  Edit2
} from 'lucide-react';
import type { 
  SessionEntity, 
  CourtEntity, 
  PlayerEntity, 
  SessionPlayerJoinEntity, 
  WeeklySessionEntity,
  SessionManagerEntity,
  ClubEntity,
  CourtMasterEntity,
  GameType,
  Gender,
  ManagerRole
} from '../types';

interface SessionsManagementScreenProps {
  activeSession: SessionEntity | null;
  allSessions: SessionEntity[];
  weeklySessions: WeeklySessionEntity[];
  weeklyMembersMap: Record<number, number[]>;
  weeklyCourtsMap: Record<number, CourtEntity[]>;
  players: PlayerEntity[];
  courtMasters: CourtMasterEntity[];
  sessionManagers: SessionManagerEntity[];
  clubDetails: ClubEntity | null;
  onStartAdhocSession: (
    name: string,
    type: GameType,
    targetScore: number,
    managerId: number | null,
    manager2Id: number | null,
    selectedPlayerIds: number[],
    selectedCourtNames: string[]
  ) => Promise<void>;
  onInstantiateWeeklySession: (weeklySession: WeeklySessionEntity) => Promise<void>;
  onEndActiveSession: (sessionId: number) => Promise<void>;
  onDeleteSession: (sessionId: number) => Promise<void>;
  onSwitchActiveSession: (sessionId: number) => Promise<void>;
  onCreateWeeklySession: (
    name: string,
    dayOfWeek: string,
    time: string,
    type: GameType,
    targetScore: number,
    managerId: number | null,
    manager2Id: number | null,
    playerIds: number[],
    courtNames: string[]
  ) => Promise<void>;
  onUpdateWeeklySession?: (
    weeklyId: number,
    updates: {
      name?: string;
      dayOfWeek?: string;
      time?: string;
      type?: GameType;
      targetScore?: number;
      managerId?: number | null;
      manager2Id?: number | null;
    }
  ) => Promise<void>;
  onDeleteWeeklySession: (weeklyId: number) => Promise<void>;
  onAddWeeklyCourt: (weeklyId: number, courtName: string, gameType: GameType) => Promise<void>;
  onDeleteWeeklyCourt: (weeklyId: number, courtId: number) => Promise<void>;
  onAddWeeklyMember: (weeklyId: number, memberId: number) => Promise<void>;
  onDeleteWeeklyMember: (weeklyId: number, memberId: number) => Promise<void>;
  onAddMember: (name: string, gender: Gender, isPAYG: boolean) => Promise<void>;
  onDeleteMember: (memberId: number) => Promise<void>;
  onToggleMemberPAYG: (memberId: number, currentPAYG: boolean) => Promise<void>;
  onAddSessionManager: (name: string, email: string, role?: ManagerRole) => Promise<{ success: boolean; message?: string; uid?: string; isExistingUser?: boolean } | void>;
  onDeleteSessionManager: (managerId: number) => Promise<void>;
  onResendPasswordReset?: (managerId: number, email: string) => Promise<{ success: boolean; message: string }>;
  currentUserRole?: ManagerRole;
  currentManagerId?: number | null;
  currentManagerName?: string | null;
  onNavigateToLive: () => void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const SessionsManagementScreen: React.FC<SessionsManagementScreenProps> = ({
  activeSession,
  allSessions,
  weeklySessions,
  weeklyMembersMap,
  weeklyCourtsMap,
  players,
  courtMasters,
  sessionManagers,
  clubDetails,
  onStartAdhocSession,
  onInstantiateWeeklySession,
  onEndActiveSession,
  onDeleteSession,
  onSwitchActiveSession,
  onCreateWeeklySession,
  onUpdateWeeklySession,
  onDeleteWeeklySession,
  onAddWeeklyCourt,
  onDeleteWeeklyCourt,
  onAddWeeklyMember,
  onDeleteWeeklyMember,
  onAddMember,
  onDeleteMember,
  onToggleMemberPAYG,
  onAddSessionManager,
  onDeleteSessionManager,
  onResendPasswordReset,
  currentUserRole = 'CLUB_MANAGER',
  currentManagerId = null,
  currentManagerName = null,
  onNavigateToLive,
}) => {
  // 4 Subtabs matching Android: MEMBERS, WEEKLY, ADHOC, MANAGERS
  const [activeSubTab, setActiveSubTab] = useState<'MEMBERS' | 'WEEKLY' | 'ADHOC' | 'MANAGERS'>('MEMBERS');

  // --- 1. MEMBERS SUBTAB STATE ---
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberGender, setNewMemberGender] = useState<Gender>('MALE');
  const [newMemberStatus, setNewMemberStatus] = useState<'PERMANENT' | 'PAYG'>('PERMANENT');
  const [memberToDelete, setMemberToDelete] = useState<PlayerEntity | null>(null);

  // --- 2. WEEKLY SESSIONS SUBTAB STATE ---
  const [showAddWeeklyModal, setShowAddWeeklyModal] = useState<boolean>(false);
  const [wName, setWName] = useState<string>('Thursday Social Night');
  const [wDay, setWDay] = useState<string>('Thursday');
  const [wTime, setWTime] = useState<string>('19:00');
  const [wType, setWType] = useState<GameType>('DOUBLES');
  const [wTargetScore, setWTargetScore] = useState<number>(21);
  const [wManager1, setWManager1] = useState<string>('NONE');
  const [wManager2, setWManager2] = useState<string>('NONE');
  const [weeklyToDelete, setWeeklyToDelete] = useState<WeeklySessionEntity | null>(null);

  // Edit Weekly Session State
  const [weeklyToEdit, setWeeklyToEdit] = useState<WeeklySessionEntity | null>(null);
  const [editWName, setEditWName] = useState<string>('');
  const [editWDay, setEditWDay] = useState<string>('Thursday');
  const [editWTime, setEditWTime] = useState<string>('19:00');
  const [editWType, setEditWType] = useState<GameType>('DOUBLES');
  const [editWTargetScore, setEditWTargetScore] = useState<number>(21);
  const [editWManager1, setEditWManager1] = useState<string>('NONE');
  const [editWManager2, setEditWManager2] = useState<string>('NONE');
  const [isUpdatingWeekly, setIsUpdatingWeekly] = useState<boolean>(false);

  // Sub-dialogs for weekly sessions
  const [weeklyForAddCourt, setWeeklyForAddCourt] = useState<WeeklySessionEntity | null>(null);
  const [newCourtName, setNewCourtName] = useState<string>('COURT 4');
  const [newCourtGameType, setNewCourtGameType] = useState<GameType>('DOUBLES');

  const [weeklyForAddMember, setWeeklyForAddMember] = useState<WeeklySessionEntity | null>(null);
  const [searchAddMemberQuery, setSearchAddMemberQuery] = useState<string>('');
  const [isCreatingNewMemberInWeekly, setIsCreatingNewMemberInWeekly] = useState<boolean>(false);
  const [directMemberName, setDirectMemberName] = useState<string>('');
  const [directMemberGender, setDirectMemberGender] = useState<Gender>('MALE');

  // --- 3. ADHOC SESSION SUBTAB STATE ---
  const [adhocName, setAdhocName] = useState<string>('Adhoc Social Session');
  const [adhocType, setAdhocType] = useState<GameType>('DOUBLES');
  const [adhocTargetScore, setAdhocTargetScore] = useState<number>(21);
  const [adhocManager1, setAdhocManager1] = useState<string>('NONE');
  const [adhocManager2, setAdhocManager2] = useState<string>('NONE');
  const [isStartingAdhoc, setIsStartingAdhoc] = useState<boolean>(false);
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState<boolean>(false);
  const [showDeleteActiveConfirm, setShowDeleteActiveConfirm] = useState<boolean>(false);

  // --- 4. MANAGERS SUBTAB STATE ---
  const isFullManager = currentUserRole === 'CLUB_MANAGER' || currentUserRole === 'SECONDARY_CLUB_MANAGER';
  const [managerSearch, setManagerSearch] = useState<string>('');
  const [showAddManagerModal, setShowAddManagerModal] = useState<boolean>(false);
  const [newManagerName, setNewManagerName] = useState<string>('');
  const [newManagerEmail, setNewManagerEmail] = useState<string>('');
  const [newManagerRole, setNewManagerRole] = useState<ManagerRole>('SESSION_MANAGER');
  const [isCreatingManager, setIsCreatingManager] = useState<boolean>(false);
  const [resendingManagerId, setResendingManagerId] = useState<number | null>(null);
  const [managerFeedback, setManagerFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [managerToDelete, setManagerToDelete] = useState<SessionManagerEntity | null>(null);

  // -------------------------------------------------------------
  // HANDLERS: MEMBERS
  // -------------------------------------------------------------
  const isDuplicateMember = newMemberName.trim().length > 0 && players.some(
    (p) => p.name.trim().toLowerCase() === newMemberName.trim().toLowerCase()
  );

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || isDuplicateMember) return;
    const isPAYG = newMemberStatus === 'PAYG';
    await onAddMember(newMemberName.trim().toUpperCase(), newMemberGender, isPAYG);
    setNewMemberName('');
    setNewMemberGender('MALE');
    setNewMemberStatus('PERMANENT');
    setShowAddMemberModal(false);
  };

  const filteredMembers = players.filter((p) => 
    p.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // -------------------------------------------------------------
  // HANDLERS: WEEKLY SESSIONS
  // -------------------------------------------------------------
  const handleCreateWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFullManager || !wName.trim()) return;

    let m1Id: number | null = null;
    if (wManager1 === 'ORGANISER') m1Id = 0;
    else if (wManager1 !== 'NONE') m1Id = Number(wManager1);

    let m2Id: number | null = null;
    if (wManager2 === 'ORGANISER') m2Id = 0;
    else if (wManager2 !== 'NONE') m2Id = Number(wManager2);

    const initialCourtNames = ['COURT 1', 'COURT 2', 'COURT 3'];
    const initialPlayerIds = players.slice(0, 8).map((p) => p.id);

    await onCreateWeeklySession(
      wName.trim(),
      wDay,
      wTime,
      wType,
      wTargetScore,
      m1Id,
      m2Id,
      initialPlayerIds,
      initialCourtNames
    );

    setShowAddWeeklyModal(false);
  };

  const openEditWeeklyModal = (session: WeeklySessionEntity) => {
    setWeeklyToEdit(session);
    setEditWName(session.name);
    setEditWDay(session.dayOfWeek);
    setEditWTime(session.time);
    setEditWType(session.type);
    setEditWTargetScore(session.targetScore || 21);
    setEditWManager1(
      session.managerId === 0
        ? 'ORGANISER'
        : session.managerId != null
        ? String(session.managerId)
        : 'NONE'
    );
    setEditWManager2(
      session.manager2Id === 0
        ? 'ORGANISER'
        : session.manager2Id != null
        ? String(session.manager2Id)
        : 'NONE'
    );
  };

  const handleSaveWeeklyEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weeklyToEdit || !editWName.trim() || !onUpdateWeeklySession) return;
    setIsUpdatingWeekly(true);

    const m1Id =
      editWManager1 === 'ORGANISER'
        ? 0
        : editWManager1 !== 'NONE'
        ? Number(editWManager1)
        : null;

    const m2Id =
      editWManager2 === 'ORGANISER'
        ? 0
        : editWManager2 !== 'NONE'
        ? Number(editWManager2)
        : null;

    try {
      await onUpdateWeeklySession(weeklyToEdit.id, {
        name: editWName.trim(),
        dayOfWeek: editWDay,
        time: editWTime,
        type: editWType,
        targetScore: editWTargetScore,
        managerId: m1Id,
        manager2Id: m2Id
      });
      setWeeklyToEdit(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingWeekly(false);
    }
  };

  const isCourtDuplicate = Boolean(
    weeklyForAddCourt &&
      newCourtName.trim() &&
      (weeklyCourtsMap[weeklyForAddCourt.id] || []).some(
        (c) => c.name.trim().toLowerCase() === newCourtName.trim().toLowerCase()
      )
  );

  const handleAddCourtToWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weeklyForAddCourt || !newCourtName.trim() || isCourtDuplicate) return;
    await onAddWeeklyCourt(weeklyForAddCourt.id, newCourtName.trim().toUpperCase(), newCourtGameType);
    setWeeklyForAddCourt(null);
  };

  const isDirectMemberDuplicate = Boolean(
    directMemberName.trim() &&
      players.some((p) => p.name.trim().toLowerCase() === directMemberName.trim().toLowerCase())
  );

  const handleAddDirectMemberToWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weeklyForAddMember || !directMemberName.trim() || isDirectMemberDuplicate) return;
    const nextPlayerId = players.length > 0 ? Math.max(...players.map((p) => p.id)) + 1 : 1;
    await onAddMember(directMemberName.trim().toUpperCase(), directMemberGender, false);
    await onAddWeeklyMember(weeklyForAddMember.id, nextPlayerId);
    setDirectMemberName('');
    setIsCreatingNewMemberInWeekly(false);
    setWeeklyForAddMember(null);
  };

  // -------------------------------------------------------------
  // HANDLERS: ADHOC SESSION
  // -------------------------------------------------------------
  const handleStartAdhoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsStartingAdhoc(true);
    try {
      let m1Id: number | null = null;
      if (adhocManager1 === 'ORGANISER') m1Id = 0;
      else if (adhocManager1 !== 'NONE') m1Id = Number(adhocManager1);

      let m2Id: number | null = null;
      if (adhocManager2 === 'ORGANISER') m2Id = 0;
      else if (adhocManager2 !== 'NONE') m2Id = Number(adhocManager2);

      const defaultCourtNames = courtMasters.length > 0 ? courtMasters.map((c) => c.name) : ['COURT 1', 'COURT 2', 'COURT 3'];
      const defaultPlayerIds = players.slice(0, 8).map((p) => p.id);

      await onStartAdhocSession(
        adhocName.trim(),
        adhocType,
        adhocTargetScore,
        m1Id,
        m2Id,
        defaultPlayerIds,
        defaultCourtNames
      );
      onNavigateToLive();
    } finally {
      setIsStartingAdhoc(false);
    }
  };

  // -------------------------------------------------------------
  // HANDLERS: MANAGERS
  // -------------------------------------------------------------
  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFullManager) {
      setManagerFeedback({
        type: 'error',
        message: 'Permission denied: Only Primary or Secondary Club Managers have rights to add managers.'
      });
      setShowAddManagerModal(false);
      return;
    }
    if (!newManagerName.trim() || !newManagerEmail.trim()) return;
    setIsCreatingManager(true);
    try {
      const res: any = await onAddSessionManager(newManagerName.trim(), newManagerEmail.trim(), newManagerRole);
      if (res && !res.success) {
        setManagerFeedback({
          type: 'error',
          message: res.message || 'Failed to create manager account.'
        });
      } else {
        const isReused = res?.isExistingUser;
        const roleTitle = newManagerRole === 'SECONDARY_CLUB_MANAGER' ? 'Secondary Club Manager' : 'Session Manager';
        setManagerFeedback({
          type: 'success',
          message: isReused
            ? `Existing account detected! ${roleTitle} ${newManagerName.trim()} linked reusing existing Authentication UID. A password reset email was sent to ${newManagerEmail.trim()}.`
            : `${roleTitle} ${newManagerName.trim()} created! An account was added on Firebase authentication and a password reset email was sent to ${newManagerEmail.trim()}.`
        });
        setNewManagerName('');
        setNewManagerEmail('');
        setNewManagerRole('SESSION_MANAGER');
        setShowAddManagerModal(false);
      }
    } catch (err: any) {
      setManagerFeedback({
        type: 'error',
        message: err.message || 'Error creating session manager account.'
      });
    } finally {
      setIsCreatingManager(false);
    }
  };

  const handleResendEmail = async (managerId: number, email: string) => {
    if (!onResendPasswordReset || !email.trim()) return;
    setResendingManagerId(managerId);
    try {
      const res = await onResendPasswordReset(managerId, email.trim());
      setManagerFeedback({
        type: res.success ? 'success' : 'error',
        message: res.message
      });
    } catch (err: any) {
      setManagerFeedback({
        type: 'error',
        message: err.message || 'Error sending password reset email.'
      });
    } finally {
      setResendingManagerId(null);
    }
  };

  const filteredManagers = sessionManagers.filter((m) => 
    m.name.toLowerCase().includes(managerSearch.toLowerCase()) || 
    m.email.toLowerCase().includes(managerSearch.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-fade-in">
      
      {/* Tab Header Bar: MEMBERS | WEEKLY | ADHOC | MANAGERS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex rounded-xl bg-slate-900/90 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSubTab('MEMBERS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'MEMBERS'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>MEMBERS</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {players.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('WEEKLY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'WEEKLY'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>WEEKLY</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {weeklySessions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('ADHOC')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'ADHOC'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>ADHOC</span>
            {activeSession && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('MANAGERS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'MANAGERS'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>MANAGERS</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {sessionManagers.length}
            </span>
          </button>
        </div>

        {/* Quick Context Action based on active sub tab */}
        {activeSubTab === 'MEMBERS' && (
          <button
            type="button"
            onClick={() => setShowAddMemberModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        )}

        {activeSubTab === 'WEEKLY' && isFullManager && (
          <button
            type="button"
            onClick={() => setShowAddWeeklyModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Weekly</span>
          </button>
        )}

        {activeSubTab === 'MANAGERS' && currentUserRole === 'CLUB_MANAGER' && (
          <button
            type="button"
            onClick={() => setShowAddManagerModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md transition-all cursor-pointer"
          >
            <Shield className="w-4 h-4" />
            <span>Add Manager</span>
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* 1. MEMBERS SUBTAB */}
      {/* ========================================================= */}
      {activeSubTab === 'MEMBERS' && (
        <div className="space-y-4">
          
          {/* Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Club Members</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                  {players.length} Total
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Directory of permanent club members and Pay-As-You-Go (PAYG) players.
              </p>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members by name..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Members Grid / List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredMembers.map((player) => {
              // Find weekly sessions this member belongs to
              const memberWeeklySessions = weeklySessions.filter((ws) => 
                (weeklyMembersMap[ws.id] || []).includes(player.id)
              );

              return (
                <div
                  key={player.id}
                  className="bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 transition-all flex flex-col justify-between gap-3 shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                        player.gender === 'FEMALE' 
                          ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' 
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}>
                        {player.gender === 'FEMALE' ? '♀' : '♂'}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-tight">
                          {player.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => onToggleMemberPAYG(player.id, player.isPAYG)}
                            title="Click to toggle member status"
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                              player.isPAYG
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${player.isPAYG ? 'bg-amber-400' : 'bg-sky-400'}`} />
                            {player.isPAYG ? 'PAYG' : 'Permanent'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMemberToDelete(player)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete Member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Sessions joined summary */}
                  {memberWeeklySessions.length > 0 ? (
                    <div className="pt-2 border-t border-slate-800/80">
                      <p className="text-[10px] font-semibold text-slate-400 mb-1">Weekly Groups:</p>
                      <div className="flex flex-wrap gap-1">
                        {memberWeeklySessions.map((ws) => {
                          const rawName = (ws.name || '').trim();
                          const day = (ws.dayOfWeek || '').trim();
                          const dayAbbr = day ? day.slice(0, 3) : '';
                          
                          let label = rawName || dayAbbr || day || 'Weekly';
                          if (dayAbbr) {
                            label = label.replace(new RegExp(`\\s*\\(${dayAbbr}\\)`, 'gi'), '').trim();
                          }

                          return (
                            <span
                              key={ws.id}
                              className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-medium text-slate-300"
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-800/60">
                      <p className="text-[10px] text-slate-500 italic">No assigned weekly sessions</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredMembers.length === 0 && (
            <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 space-y-2">
              <Users className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-bold text-slate-400">No members found matching "{memberSearch}"</p>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(true)}
                className="text-xs font-bold text-sky-400 hover:underline cursor-pointer"
              >
                Add Member Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. WEEKLY SESSIONS SUBTAB */}
      {/* ========================================================= */}
      {activeSubTab === 'WEEKLY' && (
        <div className="space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Weekly Session Schedule</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                  {weeklySessions.length} Configured
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Recurring club sessions with configured courts and permanent members.
              </p>
            </div>
          </div>

          {/* Weekly Sessions List */}
          <div className="space-y-6">
            {weeklySessions.map((session) => {
              const assignedCourtList = weeklyCourtsMap[session.id] || [];
              const assignedMemberIds = weeklyMembersMap[session.id] || [];
              const assignedMembers = players.filter((p) => assignedMemberIds.includes(p.id));

              // Find assigned managers
              let manager1Name = 'None';
              if (session.managerId === 0) manager1Name = `${clubDetails?.contactPerson || 'Ashish Verma'} (Club Manager)`;
              else if (session.managerId) {
                const sm = sessionManagers.find((m) => m.id === session.managerId);
                if (sm) manager1Name = sm.name;
              }

              let manager2Name = 'None';
              if (session.manager2Id === 0) manager2Name = `${clubDetails?.contactPerson || 'Ashish Verma'} (Club Manager)`;
              else if (session.manager2Id) {
                const sm = sessionManagers.find((m) => m.id === session.manager2Id);
                if (sm) manager2Name = sm.name;
              }

              return (
                <div
                  key={session.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 transition-all"
                >
                  {/* Session Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                          {session.dayOfWeek} at {session.time}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {session.type.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-slate-100 tracking-tight">
                        {session.name}
                      </h3>
                      <p className="text-xs text-slate-400 flex items-center gap-2">
                        <span>Managers: <strong className="text-slate-200">{manager1Name}</strong></span>
                        {session.manager2Id !== null && session.manager2Id !== undefined && (
                          <span>• <strong className="text-slate-200">{manager2Name}</strong></span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onInstantiateWeeklySession(session);
                          onNavigateToLive();
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950 transition-all cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Open Session</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditWeeklyModal(session)}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 border border-slate-800 hover:border-sky-500/30 transition-all cursor-pointer"
                        title="Edit Weekly Session & Managers"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {isFullManager && (
                        <button
                          type="button"
                          onClick={() => setWeeklyToDelete(session)}
                          className="p-2.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition-all cursor-pointer"
                          title="Delete Session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Session Courts Configuration */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        <span>Session Courts ({assignedCourtList.length})</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setWeeklyForAddCourt(session)}
                        className="text-[11px] font-bold text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Court</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {assignedCourtList.map((court) => (
                        <div
                          key={court.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 shadow-sm"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>{court.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({court.gameType})</span>
                          <button
                            type="button"
                            onClick={() => onDeleteWeeklyCourt(session.id, court.id)}
                            className="text-slate-500 hover:text-rose-400 ml-1 cursor-pointer"
                            title="Remove court"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Permanent Members Configuration */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-sky-400" />
                        <span>Permanent Members ({assignedMembers.length})</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setWeeklyForAddMember(session)}
                        className="text-[11px] font-bold text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Member</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {assignedMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 shadow-sm"
                        >
                          <span className={`text-[11px] ${member.gender === 'FEMALE' ? 'text-pink-400' : 'text-sky-400'}`}>
                            {member.gender === 'FEMALE' ? '♀' : '♂'}
                          </span>
                          <span>{member.name}</span>
                          <button
                            type="button"
                            onClick={() => onToggleMemberPAYG(member.id, member.isPAYG)}
                            title="Click to toggle between PAYG and Permanent"
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                              member.isPAYG
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30'
                            }`}
                          >
                            {member.isPAYG ? 'PAYG' : 'Permanent'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteWeeklyMember(session.id, member.id)}
                            className="text-slate-500 hover:text-rose-400 ml-1 cursor-pointer"
                            title="Remove from session"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              );
            })}

            {weeklySessions.length === 0 && (
              <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 space-y-2">
                <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-400">No weekly sessions created yet.</p>
                <p className="text-xs text-slate-500">Click "+ New Weekly" above to configure recurring sessions.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. ADHOC SESSIONS SUBTAB */}
      {/* ========================================================= */}
      {activeSubTab === 'ADHOC' && (
        <div className="space-y-6">
          
          {/* If Active Session Running */}
          {activeSession ? (
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Active Session Running</span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-100 tracking-tight">
                    {activeSession.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Game Type: <span className="text-slate-200 font-bold">{activeSession.type.replace('_', ' ')}</span> • Started at {new Date(activeSession.createdAt).toLocaleTimeString()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onNavigateToLive}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Go to Live Session</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEndSessionConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer"
                  >
                    <span>End Session</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDeleteActiveConfirm(true)}
                    className="p-2.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition-all cursor-pointer"
                    title="Delete Active Session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 flex items-start gap-3">
                <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 space-y-1">
                  <p className="font-bold">Real-time Court Allocation in Progress</p>
                  <p className="text-slate-400">
                    Live court rotation, player check-in, scorekeeping, and fair wait-time balancing are running live. End the session when club playtime is completed.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* No Active Session - Adhoc Session Creation Form */
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="space-y-1 border-b border-slate-800 pb-4">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <span>Start a New Adhoc Session</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Quickly spin up a live badminton session with custom match rotation rules.
                </p>
              </div>

              <form onSubmit={handleStartAdhoc} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Session Name *</label>
                    <input
                      type="text"
                      required
                      value={adhocName}
                      onChange={(e) => setAdhocName(e.target.value)}
                      placeholder="e.g. Adhoc Social Session"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Target Winning Score</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[15, 21].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setAdhocTargetScore(score)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            adhocTargetScore === score
                              ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {score} pts
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Session Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Game Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['DOUBLES', 'SINGLES', 'MIXED_DOUBLES', 'MULTI_TYPE'] as GameType[]).map((gt) => (
                      <button
                        key={gt}
                        type="button"
                        onClick={() => setAdhocType(gt)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          adhocType === gt
                            ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {gt.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Session Managers Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">Session Manager 1</label>
                      {currentUserRole === 'CLUB_MANAGER' && (
                        <button
                          type="button"
                          onClick={() => setShowAddManagerModal(true)}
                          className="text-[11px] font-bold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
                        >
                          + Add Manager
                        </button>
                      )}
                    </div>
                    <select
                      value={adhocManager1}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          setShowAddManagerModal(true);
                        } else {
                          setAdhocManager1(e.target.value);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    >
                      <option value="NONE">None</option>
                      <option value="ORGANISER">{clubDetails?.contactPerson || 'Ashish Verma'} (Club Manager)</option>
                      {sessionManagers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                      {currentUserRole === 'CLUB_MANAGER' && (
                        <option value="__ADD_NEW__">+ Add New Session Manager...</option>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Session Manager 2 (Optional)</label>
                    <select
                      value={adhocManager2}
                      onChange={(e) => setAdhocManager2(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    >
                      <option value="NONE">None (Optional)</option>
                      <option value="ORGANISER">{clubDetails?.contactPerson || 'Ashish Verma'} (Club Manager)</option>
                      {sessionManagers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isStartingAdhoc}
                  className="w-full py-3.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-950 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{isStartingAdhoc ? 'Starting Session...' : 'Create & Launch Adhoc Session'}</span>
                </button>
              </form>
            </div>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* 4. MANAGERS SUBTAB */}
      {/* ========================================================= */}
      {activeSubTab === 'MANAGERS' && (
        <div className="space-y-6">
          
          {/* Feedback banner */}
          {managerFeedback && (
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs animate-in fade-in ${
              managerFeedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {managerFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{managerFeedback.message}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setManagerFeedback(null)} 
                className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Club Manager Overview */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-xl">
                🛡️
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-sky-400 uppercase tracking-wider">Primary Club Manager</span>
                <h3 className="text-base font-black text-slate-100">
                  {clubDetails?.contactPerson || 'Ashish Verma'}
                </h3>
                <p className="text-xs text-slate-400">{clubDetails?.description || 'Ashish.Verma.UK@gmail.com'}</p>
              </div>
            </div>

            <div className="text-right sm:max-w-xs">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                isFullManager
                  ? 'bg-sky-500/10 border border-sky-500/20 text-sky-400'
                  : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
              }`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {currentUserRole === 'CLUB_MANAGER' 
                    ? 'Primary Club Manager' 
                    : (currentUserRole === 'SECONDARY_CLUB_MANAGER' ? 'Secondary Club Manager' : 'Session Manager View')}
                </span>
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                {isFullManager
                  ? 'Club Managers (Primary & Secondary) have rights to add or remove managers.'
                  : 'Session Managers have view rights for assigned sessions.'}
              </p>
            </div>
          </div>

          {/* Session Managers List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Club & Session Managers ({sessionManagers.length})
              </h3>
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={managerSearch}
                  onChange={(e) => setManagerSearch(e.target.value)}
                  placeholder="Filter managers..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredManagers.map((manager) => (
                <div
                  key={manager.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-xs shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-100">{manager.name}</h4>
                      <p className="text-[11px] text-slate-400">{manager.email || 'No email provided'}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                          manager.role === 'SECONDARY_CLUB_MANAGER'
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {manager.role === 'SECONDARY_CLUB_MANAGER' ? 'Secondary Club Manager' : 'Session Manager'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Resend Password Reset button (Club managers only) */}
                    {isFullManager && manager.email && (
                      <button
                        type="button"
                        disabled={resendingManagerId === manager.id}
                        onClick={() => handleResendEmail(manager.id, manager.email)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition-all cursor-pointer disabled:opacity-50"
                        title={`Send password reset email to ${manager.email}`}
                      >
                        {resendingManagerId === manager.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Mail className="w-3.5 h-3.5" />
                        )}
                        <span>{resendingManagerId === manager.id ? 'Sending...' : 'Resend Reset Email'}</span>
                      </button>
                    )}

                    {/* Remove manager (Club managers only) */}
                    {isFullManager && (
                      <button
                        type="button"
                        onClick={() => setManagerToDelete(manager)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                        title="Remove Manager"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {filteredManagers.length === 0 && (
              <div className="text-center py-8 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 space-y-1">
                <p className="text-xs text-slate-400">No session managers registered.</p>
                <p className="text-[11px] text-slate-500">
                  {currentUserRole === 'CLUB_MANAGER'
                    ? 'Assign and add session managers when configuring weekly or adhoc sessions.'
                    : 'Only Club Managers can add new session managers.'}
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* POPUP: ADD CLUB MEMBER (Requirement #3) */}
      {/* ========================================================= */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-400" />
                <span>Add Club Member</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="space-y-4">
              {/* Field 1: Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Name *</label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Ashish Verma"
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none ${
                    isDuplicateMember
                      ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20'
                      : 'border-slate-800 focus:border-sky-500'
                  }`}
                />
                {isDuplicateMember && (
                  <p className="text-[11px] font-semibold text-rose-400">
                    A member with this name already exists.
                  </p>
                )}
              </div>

              {/* Field 2: Gender with Radio Buttons */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Gender</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    newMemberGender === 'MALE'
                      ? 'bg-sky-500/10 border-sky-500 text-sky-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="memberGender"
                      checked={newMemberGender === 'MALE'}
                      onChange={() => setNewMemberGender('MALE')}
                      className="text-sky-500 focus:ring-0"
                    />
                    <span className="text-xs font-bold">Male ♂</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    newMemberGender === 'FEMALE'
                      ? 'bg-pink-500/10 border-pink-500 text-pink-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="memberGender"
                      checked={newMemberGender === 'FEMALE'}
                      onChange={() => setNewMemberGender('FEMALE')}
                      className="text-pink-500 focus:ring-0"
                    />
                    <span className="text-xs font-bold">Female ♀</span>
                  </label>
                </div>
              </div>

              {/* Field 3: Member Status with Radio Buttons */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Member Status</label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    newMemberStatus === 'PERMANENT'
                      ? 'bg-sky-500/10 border-sky-500 text-sky-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="memberStatus"
                      checked={newMemberStatus === 'PERMANENT'}
                      onChange={() => setNewMemberStatus('PERMANENT')}
                      className="mt-0.5 text-sky-500 focus:ring-0"
                    />
                    <div>
                      <span className="text-xs font-bold block">Permanent / Club Member</span>
                      <span className="text-[11px] text-slate-400">Regular club member registered for weekly and club sessions.</span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    newMemberStatus === 'PAYG'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="memberStatus"
                      checked={newMemberStatus === 'PAYG'}
                      onChange={() => setNewMemberStatus('PAYG')}
                      className="mt-0.5 text-amber-500 focus:ring-0"
                    />
                    <div>
                      <span className="text-xs font-bold block">PAYG (Pay-As-You-Go)</span>
                      <span className="text-[11px] text-slate-400">Casual guest or drop-in player paying per session.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newMemberName.trim() || isDuplicateMember}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all ${
                    !newMemberName.trim() || isDuplicateMember
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                      : 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                  }`}
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* POPUP: NEW WEEKLY SESSION (Requirement #4) */}
      {/* ========================================================= */}
      {showAddWeeklyModal && isFullManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                <span>New Weekly Session</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddWeeklyModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWeekly} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Session Name *</label>
                <input
                  type="text"
                  required
                  value={wName}
                  onChange={(e) => setWName(e.target.value)}
                  placeholder="e.g. Thursday Social Night"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Day of Week</label>
                  <select
                    value={wDay}
                    onChange={(e) => setWDay(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Start Time</label>
                  <input
                    type="time"
                    value={wTime}
                    onChange={(e) => setWTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Game Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Session Game Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['DOUBLES', 'SINGLES', 'MIXED_DOUBLES', 'MULTI_TYPE'] as GameType[]).map((gt) => (
                    <button
                      key={gt}
                      type="button"
                      onClick={() => setWType(gt)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        wType === gt
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {gt.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Session Manager 1 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Session Manager 1</label>
                  {currentUserRole === 'CLUB_MANAGER' && (
                    <button
                      type="button"
                      onClick={() => setShowAddManagerModal(true)}
                      className="text-[11px] font-bold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
                    >
                      + Add Manager
                    </button>
                  )}
                </div>
                <select
                  value={wManager1}
                  onChange={(e) => {
                    if (e.target.value === '__ADD_NEW__') {
                      setShowAddManagerModal(true);
                    } else {
                      setWManager1(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="NONE">None</option>
                  <option value="ORGANISER">{clubDetails?.contactPerson || 'Ashish Verma'} (Club Manager)</option>
                  {sessionManagers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                  {currentUserRole === 'CLUB_MANAGER' && (
                    <option value="__ADD_NEW__">+ Add New Session Manager...</option>
                  )}
                </select>
              </div>

              {/* Session Manager 2 (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Session Manager 2 (Optional)</label>
                <select
                  value={wManager2}
                  onChange={(e) => setWManager2(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="NONE">None (Optional)</option>
                  <option value="ORGANISER">{clubDetails?.contactPerson || 'Ashish Verma'} (Club Manager)</option>
                  {sessionManagers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddWeeklyModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md cursor-pointer"
                >
                  Create Weekly Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP: EDIT WEEKLY SESSION & MANAGERS */}
      {weeklyToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-slate-100">Edit Weekly Session</h3>
              </div>
              <button
                type="button"
                onClick={() => setWeeklyToEdit(null)}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWeeklyEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Session Name</label>
                <input
                  type="text"
                  required
                  value={editWName}
                  onChange={(e) => setEditWName(e.target.value)}
                  placeholder="e.g. Thursday Social Night"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Day of Week</label>
                  <select
                    value={editWDay}
                    onChange={(e) => setEditWDay(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Start Time</label>
                  <input
                    type="time"
                    value={editWTime}
                    onChange={(e) => setEditWTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Target Score */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Target Score</label>
                <div className="grid grid-cols-2 gap-2">
                  {[15, 21].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setEditWTargetScore(score)}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        editWTargetScore === score
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {score} pts
                    </button>
                  ))}
                </div>
              </div>

              {/* Game Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Session Game Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['DOUBLES', 'SINGLES', 'MIXED_DOUBLES', 'MULTI_TYPE'] as GameType[]).map((gt) => (
                    <button
                      key={gt}
                      type="button"
                      onClick={() => setEditWType(gt)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        editWType === gt
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {gt.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Session Manager 1 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Session Manager 1</label>
                  {currentUserRole === 'CLUB_MANAGER' && (
                    <button
                      type="button"
                      onClick={() => setShowAddManagerModal(true)}
                      className="text-[11px] font-bold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
                    >
                      + Add Manager
                    </button>
                  )}
                </div>
                <select
                  value={editWManager1}
                  onChange={(e) => {
                    if (e.target.value === '__ADD_NEW__') {
                      setShowAddManagerModal(true);
                    } else {
                      setEditWManager1(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="NONE">None</option>
                  <option value="ORGANISER">{clubDetails?.contactPerson || 'Ashish Verma'} (Club Manager)</option>
                  {sessionManagers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                  {currentUserRole === 'CLUB_MANAGER' && (
                    <option value="__ADD_NEW__">+ Add New Session Manager...</option>
                  )}
                </select>
              </div>

              {/* Session Manager 2 (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Session Manager 2 (Optional)</label>
                <select
                  value={editWManager2}
                  onChange={(e) => setEditWManager2(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="NONE">None (Optional)</option>
                  <option value="ORGANISER">{clubDetails?.contactPerson || 'Ashish Verma'} (Club Manager)</option>
                  {sessionManagers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setWeeklyToEdit(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingWeekly}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingWeekly ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP: ADD COURT TO WEEKLY */}
      {weeklyForAddCourt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">Add Session Court</h3>
              <button
                type="button"
                onClick={() => setWeeklyForAddCourt(null)}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCourtToWeekly} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Court Name</label>
                <input
                  type="text"
                  required
                  value={newCourtName}
                  onChange={(e) => setNewCourtName(e.target.value)}
                  placeholder="e.g. COURT 4"
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
                <label className="text-xs font-bold text-slate-300">Court Game Type</label>
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
                  onClick={() => setWeeklyForAddCourt(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200"
                >
                  Cancel
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

      {/* POPUP: ADD MEMBER TO WEEKLY */}
      {weeklyForAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">Add Member to {weeklyForAddMember.name}</h3>
              <button
                type="button"
                onClick={() => {
                  setWeeklyForAddMember(null);
                  setIsCreatingNewMemberInWeekly(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isCreatingNewMemberInWeekly ? (
              <div className="space-y-3 overflow-y-auto pr-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Select from existing club members:</p>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewMemberInWeekly(true)}
                    className="text-xs font-bold text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create New</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={searchAddMemberQuery}
                  onChange={(e) => setSearchAddMemberQuery(e.target.value)}
                  placeholder="Filter members..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />

                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {players
                    .filter((p) => p.name.toLowerCase().includes(searchAddMemberQuery.toLowerCase()))
                    .map((p) => {
                      const isAlreadyAssigned = (weeklyMembersMap[weeklyForAddMember.id] || []).includes(p.id);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] ${p.gender === 'FEMALE' ? 'text-pink-400' : 'text-sky-400'}`}>
                              {p.gender === 'FEMALE' ? '♀' : '♂'}
                            </span>
                            <span className="font-bold text-slate-200">{p.name}</span>
                            {p.isPAYG && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px]">PAYG</span>
                            )}
                          </div>

                          {isAlreadyAssigned ? (
                            <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Added
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAddWeeklyMember(weeklyForAddMember.id, p.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                            >
                              {p.isPAYG ? 'Make Permanent & Add' : 'Add'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddDirectMemberToWeekly} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Player Name</label>
                  <input
                    type="text"
                    required
                    value={directMemberName}
                    onChange={(e) => setDirectMemberName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none ${
                      isDirectMemberDuplicate
                        ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20'
                        : 'border-slate-800 focus:border-sky-500'
                    }`}
                  />
                  {isDirectMemberDuplicate && (
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
                      onClick={() => setDirectMemberGender('MALE')}
                      className={`py-2 rounded-xl text-xs font-bold border ${
                        directMemberGender === 'MALE' ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Male ♂
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirectMemberGender('FEMALE')}
                      className={`py-2 rounded-xl text-xs font-bold border ${
                        directMemberGender === 'FEMALE' ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Female ♀
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewMemberInWeekly(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200"
                  >
                    Back to Select
                  </button>
                  <button
                    type="submit"
                    disabled={!directMemberName.trim() || isDirectMemberDuplicate}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      !directMemberName.trim() || isDirectMemberDuplicate
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

      {/* POPUP: ADD MANAGER (PRIMARY OR SECONDARY) */}
      {showAddManagerModal && isFullManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-sky-400" />
                <span>Add Manager Account</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddManagerModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl space-y-1">
              <p className="text-xs font-bold text-sky-300">Firebase Authentication & Password Reset</p>
              <p className="text-[11px] text-slate-300">
                An entry will be created on Firebase authentication for this email and a password reset email will be sent automatically.
              </p>
            </div>

            <form onSubmit={handleCreateManager} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Manager Role *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewManagerRole('SESSION_MANAGER')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      newManagerRole === 'SESSION_MANAGER'
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Session Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewManagerRole('SECONDARY_CLUB_MANAGER')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      newManagerRole === 'SECONDARY_CLUB_MANAGER'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Secondary Club Manager
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {newManagerRole === 'SECONDARY_CLUB_MANAGER'
                    ? 'Secondary Club Managers hold full administrative rights similar to Primary Club Manager.'
                    : 'Session Managers have access only to assigned weekly or adhoc sessions.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Manager Name *</label>
                <input
                  type="text"
                  required
                  value={newManagerName}
                  onChange={(e) => setNewManagerName(e.target.value)}
                  placeholder="e.g. David Wilson"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Email Address (for login) *</label>
                <input
                  type="email"
                  required
                  value={newManagerEmail}
                  onChange={(e) => setNewManagerEmail(e.target.value)}
                  placeholder="manager@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isCreatingManager}
                  onClick={() => setShowAddManagerModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingManager}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isCreatingManager ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating & Sending Email...</span>
                    </>
                  ) : (
                    <span>Create & Send Reset Email</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODALS */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <span>Delete Member</span>
            </h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to remove <strong className="text-slate-200">{memberToDelete.name}</strong> from the club member directory?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteMember(memberToDelete.id);
                  setMemberToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {weeklyToDelete && isFullManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <span>Delete Weekly Session</span>
            </h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to delete <strong className="text-slate-200">{weeklyToDelete.name}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWeeklyToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteWeeklySession(weeklyToDelete.id);
                  setWeeklyToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showEndSessionConfirm && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <span>End Active Session</span>
            </h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to end <strong className="text-slate-200">{activeSession.name}</strong>? It will be finalized and recorded to History.
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
                onClick={() => {
                  onEndActiveSession(activeSession.id);
                  setShowEndSessionConfirm(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md cursor-pointer"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteActiveConfirm && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <span>Delete Active Session</span>
            </h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to delete <strong className="text-slate-200">{activeSession.name}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteActiveConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSession(activeSession.id);
                  setShowDeleteActiveConfirm(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {managerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <span>Remove Session Manager</span>
            </h3>
            <p className="text-xs text-slate-400">
              Remove <strong className="text-slate-200">{managerToDelete.name}</strong> from session managers?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setManagerToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSessionManager(managerToDelete.id);
                  setManagerToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
