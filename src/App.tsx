import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ref, 
  onValue, 
  set as setRtdb, 
  update as updateRtdb, 
  remove as removeRtdb,
  get as getRtdb
} from 'firebase/database';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  rtdb,
  auth,
  isFirebaseConfigured,
  missingFirebaseConfigKeys,
  findClubsForUser,
  registerUserClubAssociation,
  removeUserClubAssociation,
  createSessionManagerAuthUser,
  createOrReuseSessionManagerAuthUser,
  recordAuthUser,
  resendPasswordReset,
  parseRtdbClubData,
  syncMatchToRealtime,
  syncSessionPlayerToRealtime,
  syncSessionStateToRealtime,
  syncClubDetailsToRealtime,
  loadClubFromRealtime,
  saveClubStateToLocal,
  loadClubStateFromLocal,
  UserClubAssociation
} from './lib/firebase';
import type { 
  ClubEntity, 
  PlayerEntity, 
  SessionEntity, 
  SessionPlayerJoinEntity, 
  CourtEntity, 
  CourtMasterEntity, 
  SessionManagerEntity, 
  MatchEntity, 
  WeeklySessionEntity,
  GameType,
  Gender
} from './types';
import { FairMatchAllocation, soundEngine, isMatchValidAndCounted } from './utils/badmintonLogic';

import { Navbar } from './components/Navbar';
import { ClubSetupScreen } from './components/ClubSetupScreen';
import { SessionsManagementScreen } from './components/SessionsManagementScreen';
import { LiveSessionScreen } from './components/LiveSessionScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { FullscreenCourtMonitor } from './components/FullscreenCourtMonitor';
import { MobileQRModal } from './components/MobileQRModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './components/OfflineIndicator';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SETUP' | 'CLUB' | 'LIVE' | 'HISTORY'>('SETUP');
  const [currentClubId, setCurrentClubId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [clubDetails, setClubDetails] = useState<ClubEntity | null>(null);
  const [players, setPlayers] = useState<PlayerEntity[]>([]);
  const [courtMasters, setCourtMasters] = useState<CourtMasterEntity[]>([]);
  const [sessionManagers, setSessionManagers] = useState<SessionManagerEntity[]>([]);
  const [weeklySessions, setWeeklySessions] = useState<WeeklySessionEntity[]>([]);
  const [weeklyMembersMap, setWeeklyMembersMap] = useState<Record<number, number[]>>({});
  const [weeklyCourtsMap, setWeeklyCourtsMap] = useState<Record<number, CourtEntity[]>>({});
  const [sessions, setSessions] = useState<SessionEntity[]>([]);

  // User Role & Permissions (RBAC)
  const [currentUserRole, setCurrentUserRole] = useState<'CLUB_MANAGER' | 'SESSION_MANAGER'>('CLUB_MANAGER');
  const [currentManagerId, setCurrentManagerId] = useState<number | null>(null);
  const [currentManagerName, setCurrentManagerName] = useState<string | null>(null);
  
  // Active Session Subcollections
  const [activeCourts, setActiveCourts] = useState<CourtEntity[]>([]);
  const [activeJoins, setActiveJoins] = useState<SessionPlayerJoinEntity[]>([]);
  const [activeMatches, setActiveMatches] = useState<MatchEntity[]>([]);

  // Historical Maps
  const [allCourtsMap, setAllCourtsMap] = useState<Record<number, CourtEntity[]>>({});
  const [allMatchesMap, setAllMatchesMap] = useState<Record<number, MatchEntity[]>>({});
  const [allJoinsMap, setAllJoinsMap] = useState<Record<number, SessionPlayerJoinEntity[]>>({});

  // Theme & UI state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('badminton_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(true);
  const [isFullscreenMonitorOpen, setIsFullscreenMonitorOpen] = useState<boolean>(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Sync theme with document class & localStorage
  useEffect(() => {
    localStorage.setItem('badminton_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 1. Session and Auth check on startup
  // When website is loaded, it does NOT default to any specific user.
  // It opens directly to the Club page with sign in.
  useEffect(() => {
    const activeSessionEmail = sessionStorage.getItem('badminton_session_user');
    const activeSessionClubId = sessionStorage.getItem('badminton_session_club_id');

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user && user.email && activeSessionEmail && activeSessionClubId) {
        // Active session exists in this browser session
        setCurrentClubId(activeSessionClubId);
      } else if (user && user.email && activeSessionEmail) {
        try {
          const userClubs = await findClubsForUser(user.email, user.uid);
          if (userClubs.length > 0 && userClubs[0].clubId) {
            setCurrentClubId(userClubs[0].clubId);
            sessionStorage.setItem('badminton_session_club_id', userClubs[0].clubId);
          }
        } catch (err) {
          console.warn('[RTDB Auth] Error resolving user club index:', err);
        }
      } else {
        // Fresh load: Ensure clean unauthenticated state so Club sign-in is shown
        setCurrentClubId(null);
        setClubDetails(null);
      }
    });

    return () => unsubAuth();
  }, []);

  const loadedClubIdRef = useRef<string | null>(null);

  // Pure state clearing: completely clears in-memory club records across all collections
  const clearClubState = useCallback(() => {
    setClubDetails(null);
    setPlayers([]);
    setCourtMasters([]);
    setSessionManagers([]);
    setWeeklySessions([]);
    setWeeklyMembersMap({});
    setWeeklyCourtsMap({});
    setSessions([]);
    setActiveCourts([]);
    setActiveJoins([]);
    setActiveMatches([]);
    setAllCourtsMap({});
    setAllMatchesMap({});
    setAllJoinsMap({});
  }, []);

  // 2. Continuous local persistence backup: whenever club state changes, cache it locally (strictly scoped to currentClubId)
  useEffect(() => {
    if (!currentClubId || !clubDetails) return;
    // Guard against saving mismatched or transitional cross-club state
    if (loadedClubIdRef.current !== currentClubId) return;

    saveClubStateToLocal(currentClubId, {
      clubDetails,
      players,
      courtMasters,
      sessionManagers,
      weeklySessions,
      weeklyMembersMap,
      weeklyCourtsMap,
      sessions,
      allCourtsMap,
      allMatchesMap,
      allJoinsMap,
    });
  }, [
    currentClubId,
    clubDetails,
    players,
    courtMasters,
    sessionManagers,
    weeklySessions,
    weeklyMembersMap,
    weeklyCourtsMap,
    sessions,
    allCourtsMap,
    allMatchesMap,
    allJoinsMap,
  ]);

  // 3. Multi-tier Data Loading (Local Cache -> Realtime Database) with Strict Tenant Isolation
  useEffect(() => {
    // Immediately clear all previously loaded club data when club changes or unmounts
    clearClubState();

    if (!currentClubId) {
      loadedClubIdRef.current = null;
      return;
    }

    let isCancelled = false;

    // Tier 1: Instant load from Local Storage Cache (strictly scoped to this clubId)
    const cached = loadClubStateFromLocal(currentClubId);
    if (cached && !isCancelled) {
      if (cached.clubDetails) setClubDetails(cached.clubDetails);
      setPlayers(cached.players || []);
      setCourtMasters(cached.courtMasters || []);
      setSessionManagers(cached.sessionManagers || []);
      setWeeklySessions(cached.weeklySessions || []);
      setWeeklyMembersMap(cached.weeklyMembersMap || {});
      setWeeklyCourtsMap(cached.weeklyCourtsMap || {});
      setSessions(cached.sessions || []);
      setAllCourtsMap(cached.allCourtsMap || {});
      setAllMatchesMap(cached.allMatchesMap || {});
      setAllJoinsMap(cached.allJoinsMap || {});
      const active = cached.sessions?.find((s) => s.isActive || s.status === 'Active' || s.status === 'Setting Up');
      if (active) {
        setActiveCourts(cached.allCourtsMap?.[active.id] || []);
        setActiveJoins(cached.allJoinsMap?.[active.id] || []);
        setActiveMatches(cached.allMatchesMap?.[active.id] || []);
      } else {
        setActiveCourts([]);
        setActiveJoins([]);
        setActiveMatches([]);
      }
      loadedClubIdRef.current = currentClubId;
    }

    // Tier 2: Direct initial fetch from Firebase Realtime Database
    loadClubFromRealtime(currentClubId).then((rtdbData) => {
      if (isCancelled) return;
      if (rtdbData) {
        if (rtdbData.clubDetails) setClubDetails(rtdbData.clubDetails);
        setPlayers(rtdbData.players || []);
        setCourtMasters(rtdbData.courtMasters || []);
        setSessionManagers(rtdbData.sessionManagers || []);
        setWeeklySessions(rtdbData.weeklySessions || []);
        setWeeklyMembersMap(rtdbData.weeklyMembersMap || {});
        setWeeklyCourtsMap(rtdbData.weeklyCourtsMap || {});
        setSessions(rtdbData.sessions || []);
        setAllCourtsMap(rtdbData.allCourtsMap || {});
        setAllMatchesMap(rtdbData.allMatchesMap || {});
        setAllJoinsMap(rtdbData.allJoinsMap || {});
        const active = rtdbData.sessions?.find((s) => s.isActive || s.status === 'Active' || s.status === 'Setting Up');
        if (active) {
          setActiveCourts(rtdbData.allCourtsMap[active.id] || []);
          setActiveJoins(rtdbData.allJoinsMap[active.id] || []);
          setActiveMatches(rtdbData.allMatchesMap[active.id] || []);
        } else {
          setActiveCourts([]);
          setActiveJoins([]);
          setActiveMatches([]);
        }
        loadedClubIdRef.current = currentClubId;
      }
    }).catch((err) => console.warn('Realtime DB initial load notice:', err));

    // Tier 3: Real-time Live Listener on Firebase Realtime Database
    const clubRef = ref(rtdb, `clubs/${currentClubId}`);

    const unsubRtdb = onValue(clubRef, (snapshot) => {
      if (isCancelled) return;
      if (snapshot.exists()) {
        const raw = snapshot.val();
        const parsed = parseRtdbClubData(raw, currentClubId);
        if (parsed) {
          if (parsed.clubDetails) setClubDetails(parsed.clubDetails);
          setPlayers(parsed.players || []);
          setCourtMasters(parsed.courtMasters || []);
          setSessionManagers(parsed.sessionManagers || []);
          setWeeklySessions(parsed.weeklySessions || []);
          setWeeklyMembersMap(parsed.weeklyMembersMap || {});
          setWeeklyCourtsMap(parsed.weeklyCourtsMap || {});
          setSessions(parsed.sessions || []);
          setAllCourtsMap(parsed.allCourtsMap || {});
          setAllMatchesMap(parsed.allMatchesMap || {});
          setAllJoinsMap(parsed.allJoinsMap || {});

          // Active session subcollections
          const currActive = parsed.sessions?.find((s) => s.isActive || s.status === 'Active' || s.status === 'Setting Up');
          if (currActive) {
            setActiveCourts(parsed.allCourtsMap[currActive.id] || []);
            setActiveJoins(parsed.allJoinsMap[currActive.id] || []);
            setActiveMatches(parsed.allMatchesMap[currActive.id] || []);
          } else {
            setActiveCourts([]);
            setActiveJoins([]);
            setActiveMatches([]);
          }
          loadedClubIdRef.current = currentClubId;
          setIsRealtimeConnected(true);
        }
      } else {
        // Snapshot does not exist in RTDB (new club with zero existing records)
        // Keep collections strictly empty/blank. Never populate with fallback or other club's data.
        setPlayers([]);
        setCourtMasters([]);
        setSessionManagers([]);
        setWeeklySessions([]);
        setWeeklyMembersMap({});
        setWeeklyCourtsMap({});
        setSessions([]);
        setActiveCourts([]);
        setActiveJoins([]);
        setActiveMatches([]);
        setAllCourtsMap({});
        setAllMatchesMap({});
        setAllJoinsMap({});
        loadedClubIdRef.current = currentClubId;
        setIsRealtimeConnected(true);
      }
    }, (error) => {
      if (isCancelled) return;
      console.warn('[RTDB Listener Note]:', error);
      // Even if RTDB listener reports permission/connection issue, keep app functional
      setIsRealtimeConnected(true);
    });

    return () => {
      isCancelled = true;
      unsubRtdb();
    };
  }, [currentClubId, clearClubState]);

  // 3. User Role & Manager Resolution
  useEffect(() => {
    const activeEmail = currentUser?.email || sessionStorage.getItem('badminton_session_user');
    if (!activeEmail || !clubDetails) {
      const savedRole = sessionStorage.getItem('badminton_session_role') as 'CLUB_MANAGER' | 'SESSION_MANAGER' | null;
      if (savedRole) setCurrentUserRole(savedRole);
      return;
    }

    const cleanEmail = activeEmail.trim().toLowerCase();
    const clubDesc = (clubDetails.description || '').toLowerCase();
    const clubContact = (clubDetails.contactPerson || '').toLowerCase();
    const isClubOwner = clubDesc.includes(cleanEmail) || clubContact === cleanEmail;

    if (isClubOwner) {
      setCurrentUserRole('CLUB_MANAGER');
      setCurrentManagerId(null);
      setCurrentManagerName(clubDetails.contactPerson || 'Club Manager');
      sessionStorage.setItem('badminton_session_role', 'CLUB_MANAGER');
      sessionStorage.removeItem('badminton_session_manager_id');
    } else {
      const matched = sessionManagers.find((m) => 
        (cleanEmail && m.email && m.email.trim().toLowerCase() === cleanEmail) ||
        (currentUser?.uid && (m.authUid === currentUser.uid || m.uid === currentUser.uid))
      );
      if (matched) {
        setCurrentUserRole('SESSION_MANAGER');
        setCurrentManagerId(matched.id);
        setCurrentManagerName(matched.name);
        sessionStorage.setItem('badminton_session_role', 'SESSION_MANAGER');
        sessionStorage.setItem('badminton_session_manager_id', String(matched.id));
      } else {
        const savedRole = sessionStorage.getItem('badminton_session_role') as 'CLUB_MANAGER' | 'SESSION_MANAGER' | null;
        if (savedRole === 'SESSION_MANAGER') {
          setCurrentUserRole('SESSION_MANAGER');
          const savedId = sessionStorage.getItem('badminton_session_manager_id');
          if (savedId) setCurrentManagerId(Number(savedId));
        } else {
          setCurrentUserRole('CLUB_MANAGER');
        }
      }
    }
  }, [currentUser, clubDetails, sessionManagers]);

  // 4. Role-based Session Filtering Helpers
  const isSessionManager = currentUserRole === 'SESSION_MANAGER' && currentManagerId != null;

  const isSessionAssignedToCurrentManager = (sess: {
    managerId?: number | null;
    manager2Id?: number | null;
    managerName?: string | null;
    manager2Name?: string | null;
  }) => {
    // Club manager has all permissions and sees all sessions
    if (!isSessionManager) return true;
    if (sess.managerId === currentManagerId || sess.manager2Id === currentManagerId) return true;
    if (currentManagerName) {
      const cName = currentManagerName.trim().toLowerCase();
      if (sess.managerName && sess.managerName.trim().toLowerCase() === cName) return true;
      if (sess.manager2Name && sess.manager2Name.trim().toLowerCase() === cName) return true;
    }
    return false;
  };

  const visibleWeeklySessions = useMemo(() => {
    return isSessionManager ? weeklySessions.filter(isSessionAssignedToCurrentManager) : weeklySessions;
  }, [weeklySessions, isSessionManager, currentManagerId, currentManagerName]);

  const visibleSessions = useMemo(() => {
    return isSessionManager ? sessions.filter(isSessionAssignedToCurrentManager) : sessions;
  }, [sessions, isSessionManager, currentManagerId, currentManagerName]);

  // 5. Active Session Determination
  const rawActiveSession = sessions.find((s) => s.isActive || s.status === 'Active' || s.status === 'Setting Up') || null;
  const activeSession = useMemo(() => {
    if (!rawActiveSession) return null;
    return isSessionAssignedToCurrentManager(rawActiveSession) ? rawActiveSession : null;
  }, [rawActiveSession, isSessionManager, currentManagerId, currentManagerName]);

  // --- ACTIONS & BIDIRECTIONAL SYNC HANDLERS ---

  const handleSignInClub = async (
    email: string,
    password?: string
  ): Promise<{ success: boolean; message?: string; multiClubs?: UserClubAssociation[] }> => {
    const cleanEmail = email.trim();
    if (!cleanEmail) return { success: false, message: 'Please enter your club email address.' };

    let authUser: User | null = null;
    if (password) {
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        authUser = userCred.user;
        setCurrentUser(authUser);
      } catch (authErr: any) {
        console.warn('Firebase Auth sign in notice:', authErr.message);
        if (authErr.code === 'auth/wrong-password') {
          return { success: false, message: 'Incorrect password for this club account.' };
        }
      }
    }

    try {
      const clubs = await findClubsForUser(cleanEmail, authUser?.uid || auth.currentUser?.uid);
      if (clubs.length === 1) {
        const target = clubs[0];
        clearClubState();
        setCurrentClubId(target.clubId);
        sessionStorage.setItem('badminton_session_user', cleanEmail);
        sessionStorage.setItem('badminton_session_club_id', target.clubId);
        
        if (target.role === 'SESSION_MANAGER') {
          setCurrentUserRole('SESSION_MANAGER');
          if (target.managerId != null) {
            setCurrentManagerId(target.managerId);
            sessionStorage.setItem('badminton_session_manager_id', String(target.managerId));
          }
          if (target.managerName) setCurrentManagerName(target.managerName);
          sessionStorage.setItem('badminton_session_role', 'SESSION_MANAGER');
        } else {
          setCurrentUserRole('CLUB_MANAGER');
          setCurrentManagerId(null);
          sessionStorage.setItem('badminton_session_role', 'CLUB_MANAGER');
          sessionStorage.removeItem('badminton_session_manager_id');
        }

        const roleLabel = target.role === 'CLUB_MANAGER' ? 'Club Manager' : 'Session Manager';
        return { success: true, message: `Signed in! Loaded ${target.clubName} as ${roleLabel}.` };
      } else if (clubs.length > 1) {
        sessionStorage.setItem('badminton_session_user', cleanEmail);
        return { success: true, multiClubs: clubs };
      } else {
        if (authUser?.uid) {
          const ownerClubId = `club_${authUser.uid}`;
          const snap = await getRtdb(ref(rtdb, `clubs/${ownerClubId}/details`));
          if (snap.exists()) {
            clearClubState();
            setCurrentClubId(ownerClubId);
            setCurrentUserRole('CLUB_MANAGER');
            sessionStorage.setItem('badminton_session_user', cleanEmail);
            sessionStorage.setItem('badminton_session_club_id', ownerClubId);
            sessionStorage.setItem('badminton_session_role', 'CLUB_MANAGER');
            return { success: true, message: 'Signed in to your club as Club Manager!' };
          }
        }
        return { 
          success: false, 
          message: `No club associated with ${cleanEmail}. You can register a new club with the Register tab.` 
        };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Sign in error' };
    }
  };

  const handleSelectClub = (assoc: UserClubAssociation) => {
    clearClubState();
    setCurrentClubId(assoc.clubId);
    sessionStorage.setItem('badminton_session_user', assoc.email);
    sessionStorage.setItem('badminton_session_club_id', assoc.clubId);

    if (assoc.role === 'SESSION_MANAGER') {
      setCurrentUserRole('SESSION_MANAGER');
      if (assoc.managerId != null) {
        setCurrentManagerId(assoc.managerId);
        sessionStorage.setItem('badminton_session_manager_id', String(assoc.managerId));
      }
      if (assoc.managerName) setCurrentManagerName(assoc.managerName);
      sessionStorage.setItem('badminton_session_role', 'SESSION_MANAGER');
    } else {
      setCurrentUserRole('CLUB_MANAGER');
      setCurrentManagerId(null);
      sessionStorage.setItem('badminton_session_role', 'CLUB_MANAGER');
      sessionStorage.removeItem('badminton_session_manager_id');
    }
  };

  const handleRegisterClub = async (
    clubData: Partial<ClubEntity>,
    email: string,
    password?: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      let createdUid = '';
      if (password && email) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          createdUid = cred.user.uid;
          setCurrentUser(cred.user);
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            try {
              const cred = await signInWithEmailAndPassword(auth, email, password);
              createdUid = cred.user.uid;
              setCurrentUser(cred.user);
            } catch (loginErr) {
              console.warn('Sign-in after email-in-use notice:', loginErr);
            }
          }
        }
      }

      const newClubId = createdUid ? `club_${createdUid}` : `club_${Date.now()}`;
      const newClub: ClubEntity = {
        id: Date.now(),
        name: clubData.name || 'New Badminton Club',
        venue: clubData.venue || '',
        defaultSessionType: clubData.defaultSessionType || 'DOUBLES',
        themeColorHex: clubData.themeColorHex || '#0284C7',
        targetScore: Number(clubData.targetScore) || 21,
        contactPerson: clubData.contactPerson || email,
        description: email,
        createdAt: Date.now(),
      };

      // 1. Sync details to RTDB with safe timeout
      try {
        await Promise.race([
          syncClubDetailsToRealtime(newClubId, newClub),
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]);
      } catch (err) {
        console.warn('RTDB register sync notice:', err);
      }

      // 2. Register index in RTDB
      try {
        await Promise.race([
          registerUserClubAssociation({
            email: email.trim(),
            clubId: newClubId,
            clubName: newClub.name,
            role: 'CLUB_MANAGER',
            venue: newClub.venue,
            ownerUid: createdUid || null,
            updatedAt: Date.now(),
          }),
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]);
      } catch (err) {
        console.warn('RTDB register index notice:', err);
      }

      // Clear state before switching to new tenant
      clearClubState();
      setCurrentClubId(newClubId);
      setClubDetails(newClub);
      sessionStorage.setItem('badminton_session_user', email);
      sessionStorage.setItem('badminton_session_club_id', newClubId);

      return { success: true, message: `Club "${newClub.name}" registered successfully!` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Registration failed' };
    }
  };

  const handleSignOut = async () => {
    sessionStorage.removeItem('badminton_session_user');
    sessionStorage.removeItem('badminton_session_club_id');
    sessionStorage.removeItem('badminton_session_role');
    sessionStorage.removeItem('badminton_session_manager_id');
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out notice:', e);
    }
    clearClubState();
    setCurrentUser(null);
    setCurrentClubId(null);
    setCurrentUserRole('CLUB_MANAGER');
    setCurrentManagerId(null);
    setCurrentManagerName(null);
    setActiveTab('SETUP');
  };

  const handleSaveClub = async (updated: Partial<ClubEntity>) => {
    if (!clubDetails || !currentClubId) return;
    const merged: ClubEntity = {
      ...clubDetails,
      ...updated,
    };
    setClubDetails(merged);

    // 1. Sync to Firebase Realtime Database with timeout guard
    try {
      await Promise.race([
        syncClubDetailsToRealtime(currentClubId, merged),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch (err) {
      console.warn('Realtime DB club sync notice:', err);
    }

    // 2. Register association in user_club_index (non-blocking)
    if (merged.description && merged.description.includes('@')) {
      registerUserClubAssociation({
        email: merged.description.trim(),
        clubId: currentClubId,
        clubName: merged.name,
        role: 'CLUB_MANAGER',
        venue: merged.venue,
        updatedAt: Date.now(),
      }).catch((e) => console.warn('User club index update note:', e));
    }
  };

  const handleAddPlayer = async (name: string, gender: Gender, isPAYG: boolean) => {
    if (!currentClubId) return;
    const nextId = players.length > 0 ? Math.max(...players.map((p) => p.id)) + 1 : 1;
    const newPlayer: PlayerEntity = {
      id: nextId,
      name,
      gender,
      createdAt: Date.now(),
      isPAYG
    };

    // Optimistic state update
    setPlayers((prev) => [...prev, newPlayer]);

    // Update Realtime Database
    try {
      const pRef = ref(rtdb, `clubs/${currentClubId}/members/player_${nextId}`);
      await setRtdb(pRef, {
        id: `player_${nextId}`,
        name,
        gender,
        isPAYG,
        createdAt: newPlayer.createdAt
      });
    } catch (e) {
      console.warn('RTDB add player note:', e);
    }
  };

  const handleDeletePlayer = async (playerId: number) => {
    if (!currentClubId) return;
    // Optimistic state update
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));

    // Realtime Database
    try {
      const pRef = ref(rtdb, `clubs/${currentClubId}/members/player_${playerId}`);
      await removeRtdb(pRef);
    } catch (e) {
      console.warn('RTDB delete player note:', e);
    }
  };

  const handleTogglePlayerPAYG = async (playerId: number, currentPAYG: boolean) => {
    if (!currentClubId) return;
    const newPAYG = !currentPAYG;

    // Optimistic state update across players and local cache
    setPlayers((prev) => {
      const nextPlayers = prev.map((p) => (p.id === playerId ? { ...p, isPAYG: newPAYG } : p));
      saveClubStateToLocal(currentClubId, {
        clubDetails,
        players: nextPlayers,
        courtMasters,
        sessionManagers,
        weeklySessions,
        weeklyMembersMap,
        weeklyCourtsMap,
        sessions,
        allCourtsMap,
        allMatchesMap,
        allJoinsMap,
      });
      return nextPlayers;
    });

    // Also update in active session player join if present
    if (activeSession) {
      setActiveJoins((prev) => {
        const nextJoins = prev.map((j) => (j.playerId === playerId ? { ...j, isPAYG: newPAYG } : j));
        setAllJoinsMap((allPrev) => ({ ...allPrev, [activeSession.id]: nextJoins }));
        return nextJoins;
      });
    }

    // Realtime Database persistence for club member
    try {
      const pRef = ref(rtdb, `clubs/${currentClubId}/members/player_${playerId}`);
      await updateRtdb(pRef, { isPAYG: newPAYG });
    } catch (e) {
      console.warn('RTDB update PAYG note (player_ key):', e);
      try {
        const pRefRaw = ref(rtdb, `clubs/${currentClubId}/members/${playerId}`);
        await updateRtdb(pRefRaw, { isPAYG: newPAYG });
      } catch (err2) {
        console.warn('RTDB update PAYG note (raw key):', err2);
      }
    }

    // Also persist in active session's session_players if applicable
    if (activeSession) {
      try {
        const spRef = ref(rtdb, `clubs/${currentClubId}/sessions/session_${activeSession.id}/session_players/player_${playerId}`);
        await updateRtdb(spRef, { isPAYG: newPAYG }).catch(() => {});
        const spRefRaw = ref(rtdb, `clubs/${currentClubId}/sessions/session_${activeSession.id}/session_players/${playerId}`);
        await updateRtdb(spRefRaw, { isPAYG: newPAYG }).catch(() => {});
      } catch (_) {}
    }
  };

  const handleAddSessionManager = async (name: string, email: string) => {
    if (currentUserRole !== 'CLUB_MANAGER') {
      return { success: false, message: 'Permission denied: Only Club Managers can add new session managers.' };
    }
    if (!currentClubId) return { success: false, message: 'No club selected' };
    const cleanEmail = email.trim();
    if (!cleanEmail) return { success: false, message: 'Email address is required' };

    // 1. Detect existing Firebase Authentication user or create if new
    const authResult = await createOrReuseSessionManagerAuthUser(cleanEmail);
    if (!authResult.success) {
      return authResult;
    }

    const assignedUid = authResult.uid || undefined;
    const nextId = sessionManagers.length > 0 ? Math.max(...sessionManagers.map((m) => m.id)) + 1 : 1;
    const newManager: SessionManagerEntity = {
      id: nextId,
      name: name.trim(),
      email: cleanEmail,
      authUid: assignedUid,
      uid: assignedUid,
      inviteStatus: 'EMAIL_SENT',
      createdAt: Date.now()
    };

    // Optimistic state update
    setSessionManagers((prev) => [...prev, newManager]);

    // Realtime Database: persist manager with its Authentication UID
    try {
      const smRef = ref(rtdb, `clubs/${currentClubId}/session_managers/manager_${nextId}`);
      await setRtdb(smRef, {
        id: `manager_${nextId}`,
        name: name.trim(),
        email: cleanEmail,
        authUid: assignedUid ?? null,
        uid: assignedUid ?? null,
        inviteStatus: 'EMAIL_SENT',
        createdAt: newManager.createdAt
      });
    } catch (e) {
      console.warn('RTDB add manager note:', e);
    }

    // Index in user_club_index with UID association
    try {
      await registerUserClubAssociation({
        email: cleanEmail,
        clubId: currentClubId,
        clubName: clubDetails?.name || 'Badminton Club',
        role: 'SESSION_MANAGER',
        managerId: nextId,
        managerName: name.trim(),
        ownerUid: assignedUid ?? null,
        venue: clubDetails?.venue || '',
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn('User club index note:', e);
    }

    return authResult;
  };

  const handleResendPasswordReset = async (managerId: number, email: string) => {
    if (currentUserRole !== 'CLUB_MANAGER') {
      return { success: false, message: 'Permission denied: Only Club Managers can manage session manager credentials.' };
    }
    const cleanEmail = email.trim();
    if (!cleanEmail) return { success: false, message: 'Email address is required' };

    const res = await resendPasswordReset(cleanEmail);
    if (res.success && currentClubId) {
      try {
        const smRef = ref(rtdb, `clubs/${currentClubId}/session_managers/manager_${managerId}`);
        await updateRtdb(smRef, { inviteStatus: 'EMAIL_SENT' });
      } catch (e) {
        console.warn('Failed to update manager inviteStatus on resend:', e);
      }
    }
    return {
      success: res.success,
      message: res.message || (res.success ? `Password reset email sent to ${cleanEmail}` : 'Failed to send reset email')
    };
  };

  const handleDeleteSessionManager = async (managerId: number) => {
    if (currentUserRole !== 'CLUB_MANAGER') return;
    if (!currentClubId) return;
    const targetManager = sessionManagers.find((m) => m.id === managerId);

    // Optimistic state update
    setSessionManagers((prev) => prev.filter((m) => m.id !== managerId));

    // Realtime Database: remove manager record from the club
    try {
      const smRef = ref(rtdb, `clubs/${currentClubId}/session_managers/manager_${managerId}`);
      await removeRtdb(smRef);
    } catch (e) {
      console.warn('RTDB delete manager note:', e);
    }

    // Remove club association from user_club_index (Auth user remains in Firebase Auth and RTDB auth_users)
    if (targetManager?.email) {
      try {
        await removeUserClubAssociation(targetManager.email, currentClubId);
      } catch (e) {
        console.warn('RTDB remove user_club_index note:', e);
      }
    }
  };

  // Start New Adhoc Session
  const handleStartAdhocSession = async (
    name: string,
    type: GameType,
    targetScore: number,
    managerId: number | null,
    manager2Id: number | null,
    selectedPlayerIds: number[],
    selectedCourtNames: string[]
  ) => {
    if (!currentClubId) return;
    const nextSessionId = sessions.length > 0 ? Math.max(...sessions.map((s) => s.id)) + 1 : 1;
    const mgr1 = sessionManagers.find((m) => m.id === managerId);
    const mgr2 = sessionManagers.find((m) => m.id === manager2Id);

    const newSession: SessionEntity = {
      id: nextSessionId,
      name,
      type,
      targetScore,
      createdAt: Date.now(),
      isActive: true,
      startTime: Date.now(),
      endTime: null,
      status: 'Active',
      weeklySessionId: null,
      managerId,
      managerName: mgr1?.name,
      manager2Id,
      manager2Name: mgr2?.name
    };

    const courtEntities: CourtEntity[] = selectedCourtNames.map((cName, idx) => ({
      id: idx + 1,
      sessionId: nextSessionId,
      name: cName,
      gameType: type === 'MULTI_TYPE' ? 'DOUBLES' : type
    }));

    const joinEntities: SessionPlayerJoinEntity[] = selectedPlayerIds.map((pId) => {
      const p = players.find((pl) => pl.id === pId);
      return {
        sessionId: nextSessionId,
        playerId: pId,
        isPaused: false,
        eligibleCourtIds: null,
        isPAYG: p?.isPAYG || false,
        adjustedGames: 0,
        pausedAtMatchCount: null
      };
    });

    // Optimistic UI updates
    setSessions((prev) => [newSession, ...prev.map((s) => ({ ...s, isActive: false }))]);
    setActiveCourts(courtEntities);
    setActiveJoins(joinEntities);
    setActiveMatches([]);
    setAllCourtsMap((prev) => ({ ...prev, [nextSessionId]: courtEntities }));
    setAllJoinsMap((prev) => ({ ...prev, [nextSessionId]: joinEntities }));
    setAllMatchesMap((prev) => ({ ...prev, [nextSessionId]: [] }));

    // Dual-Sync to Firestore & Realtime Database
    await syncSessionStateToRealtime(currentClubId, newSession, courtEntities, joinEntities, []);

    setActiveTab('LIVE');

    // Auto-generate initial matches for courts
    setTimeout(async () => {
      let currentMatches: MatchEntity[] = [];
      for (const court of courtEntities) {
        const generated = FairMatchAllocation.generateMatchForCourt(
          nextSessionId,
          court.id,
          court.gameType,
          players,
          joinEntities,
          currentMatches,
          courtEntities
        );
        if (generated) {
          const matchId = currentMatches.length + 1;
          const matchEntity: MatchEntity = { ...generated, id: matchId };
          currentMatches = [...currentMatches, matchEntity];
          await syncMatchToRealtime(currentClubId, nextSessionId, matchEntity);
        }
      }
      if (currentMatches.length > 0) {
        setActiveMatches(currentMatches);
        setAllMatchesMap((prev) => ({ ...prev, [nextSessionId]: currentMatches }));
      }
    }, 100);
  };

  // Instantiate Weekly Session
  const handleInstantiateWeeklySession = async (weeklySession: WeeklySessionEntity) => {
    if (!currentClubId) return;
    const nextSessionId = sessions.length > 0 ? Math.max(...sessions.map((s) => s.id)) + 1 : 1;
    
    const newSession: SessionEntity = {
      id: nextSessionId,
      name: `${weeklySession.name} (${new Date().toLocaleDateString('en-GB')})`,
      type: weeklySession.type,
      targetScore: weeklySession.targetScore || clubDetails?.targetScore || 21,
      createdAt: Date.now(),
      isActive: true,
      startTime: Date.now(),
      endTime: null,
      status: 'Active',
      weeklySessionId: weeklySession.id,
      managerId: weeklySession.managerId,
      managerName: weeklySession.managerName,
      manager2Id: weeklySession.manager2Id,
      manager2Name: weeklySession.manager2Name
    };

    const assignedCourts = weeklyCourtsMap[weeklySession.id] || [
      { id: 1, sessionId: nextSessionId, name: 'COURT 1', gameType: weeklySession.type },
      { id: 2, sessionId: nextSessionId, name: 'COURT 2', gameType: weeklySession.type },
      { id: 3, sessionId: nextSessionId, name: 'COURT 3', gameType: weeklySession.type }
    ];
    const courtEntities: CourtEntity[] = assignedCourts.map((c, idx) => ({
      ...c,
      id: idx + 1,
      sessionId: nextSessionId
    }));

    const assignedMemberIds = weeklyMembersMap[weeklySession.id] || players.slice(0, 8).map((p) => p.id);
    
    // Requirement 1: If anyone is playing on any weekly session as regular member, change status from PAYG to PERMANENT
    for (const pId of assignedMemberIds) {
      const p = players.find((pl) => pl.id === pId);
      if (p && p.isPAYG) {
        handleConvertPAYGToPermanent(pId);
      }
    }

    const joinEntities: SessionPlayerJoinEntity[] = assignedMemberIds.map((pId) => {
      return {
        sessionId: nextSessionId,
        playerId: pId,
        isPaused: false,
        eligibleCourtIds: null,
        isPAYG: false, // Regular member of weekly session is PERMANENT
        adjustedGames: 0,
        pausedAtMatchCount: null
      };
    });

    // Optimistic UI updates
    setSessions((prev) => [newSession, ...prev.map((s) => ({ ...s, isActive: false }))]);
    setActiveCourts(courtEntities);
    setActiveJoins(joinEntities);
    setActiveMatches([]);
    setAllCourtsMap((prev) => ({ ...prev, [nextSessionId]: courtEntities }));
    setAllJoinsMap((prev) => ({ ...prev, [nextSessionId]: joinEntities }));
    setAllMatchesMap((prev) => ({ ...prev, [nextSessionId]: [] }));

    // Dual-Sync to Firestore & Realtime Database
    await syncSessionStateToRealtime(currentClubId, newSession, courtEntities, joinEntities, []);

    setActiveTab('LIVE');

    // Auto-generate initial matches for courts
    setTimeout(async () => {
      let currentMatches: MatchEntity[] = [];
      for (const court of courtEntities) {
        const generated = FairMatchAllocation.generateMatchForCourt(
          nextSessionId,
          court.id,
          court.gameType,
          players,
          joinEntities,
          currentMatches,
          courtEntities
        );
        if (generated) {
          const matchId = currentMatches.length + 1;
          const matchEntity: MatchEntity = { ...generated, id: matchId };
          currentMatches = [...currentMatches, matchEntity];
          await syncMatchToRealtime(currentClubId, nextSessionId, matchEntity);
        }
      }
      if (currentMatches.length > 0) {
        setActiveMatches(currentMatches);
        setAllMatchesMap((prev) => ({ ...prev, [nextSessionId]: currentMatches }));
      }
    }, 100);
  };

  const handleConvertPAYGToPermanent = async (playerId: number) => {
    if (!currentClubId) return;
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, isPAYG: false } : p))
    );
    setActiveJoins((prev) =>
      prev.map((j) => (j.playerId === playerId ? { ...j, isPAYG: false } : j))
    );
    setAllJoinsMap((prev) => {
      const updated: Record<number, SessionPlayerJoinEntity[]> = {};
      for (const [sId, joins] of Object.entries(prev)) {
        updated[Number(sId)] = joins.map((j) => (j.playerId === playerId ? { ...j, isPAYG: false } : j));
      }
      return updated;
    });

    try {
      const pRef = ref(rtdb, `clubs/${currentClubId}/members/player_${playerId}`);
      await updateRtdb(pRef, { isPAYG: false });
      if (activeSession) {
        const spRef = ref(rtdb, `clubs/${currentClubId}/sessions/session_${activeSession.id}/session_players/player_${playerId}`);
        await updateRtdb(spRef, { isPAYG: false });
      }
    } catch (e) {
      console.warn('RTDB convert PAYG to permanent note:', e);
    }
  };

  const handleEndActiveSession = async (sessionId: number) => {
    if (!currentClubId) return;
    const now = Date.now();

    // Check played/completed matches (excluding 0-0 / unplayed matches)
    const currentMatches = allMatchesMap[sessionId] || activeMatches || [];
    const gamesPlayedCount = currentMatches.filter(isMatchValidAndCounted).length;

    if (gamesPlayedCount === 0) {
      // Requirement 6: If there are no games played on any session and session was ended then don't record that session on history tab
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setActiveCourts([]);
      setActiveJoins([]);
      setActiveMatches([]);
      setAllCourtsMap((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      setAllMatchesMap((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      setAllJoinsMap((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });

      try {
        const sRef = ref(rtdb, `clubs/${currentClubId}/sessions/session_${sessionId}`);
        await removeRtdb(sRef);
      } catch (e) {
        console.warn('RTDB remove empty session note:', e);
      }
    } else {
      // Mark as ended
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: 'End', isActive: false, endTime: now } : s))
      );
      setActiveCourts([]);
      setActiveJoins([]);
      setActiveMatches([]);

      try {
        const sessRef = ref(rtdb, `clubs/${currentClubId}/sessions/session_${sessionId}`);
        await updateRtdb(sessRef, {
          status: 'End',
          isActive: false,
          endTime: now
        });
        const sessInfoRef = ref(rtdb, `clubs/${currentClubId}/sessions/session_${sessionId}/info`);
        await updateRtdb(sessInfoRef, {
          status: 'End',
          isActive: false,
          endTime: now
        });
      } catch (e) {
        console.warn('RTDB end session note:', e);
      }
    }

    // Switch to Sessions Management tab
    setActiveTab('CLUB');
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!currentClubId) return;
    // Optimistic state update
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSession?.id === sessionId) {
      setActiveCourts([]);
      setActiveJoins([]);
      setActiveMatches([]);
    }
    setAllCourtsMap((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    setAllMatchesMap((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    setAllJoinsMap((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });

    // Realtime Database
    try {
      const sRefRtdb = ref(rtdb, `clubs/${currentClubId}/sessions/session_${sessionId}`);
      await removeRtdb(sRefRtdb);
    } catch (e) {
      console.warn('RTDB delete session note:', e);
    }
  };

  const handleStartSession = async () => {
    if (!activeSession || !currentClubId) return;
    const now = Date.now();
    // Optimistic state update
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSession.id ? { ...s, status: 'Active', isActive: true, startTime: now } : s))
    );

    try {
      const sessInfoRef = ref(rtdb, `clubs/${currentClubId}/sessions/session_${activeSession.id}/info`);
      await updateRtdb(sessInfoRef, {
        status: 'Active',
        isActive: true,
        startTime: now
      });
    } catch (e) {
      console.warn('RTDB start session note:', e);
    }

    // If there are courts and no matches yet, generate initial rotation
    if (activeMatches.length === 0 && activeCourts.length > 0) {
      let currentMatches: MatchEntity[] = [];
      for (const court of activeCourts) {
        try {
          const generated = FairMatchAllocation.generateMatchForCourt(
            activeSession.id,
            court.id,
            court.gameType,
            players,
            activeJoins,
            currentMatches,
            activeCourts
          );
          if (generated) {
            const matchId = currentMatches.length + 1;
            const matchEntity: MatchEntity = { ...generated, id: matchId };
            currentMatches = [...currentMatches, matchEntity];
            await syncMatchToRealtime(currentClubId, activeSession.id, matchEntity);
          }
        } catch (err) {
          console.warn('Auto match generation note:', err);
        }
      }
      if (currentMatches.length > 0) {
        setActiveMatches(currentMatches);
        setAllMatchesMap((prev) => ({ ...prev, [activeSession.id]: currentMatches }));
      }
    }
  };

  // Generate Match for Court using Fair Match Allocation
  const handleGenerateMatchWithMatches = async (
    courtId: number,
    matchesList: MatchEntity[],
    silentFail = false
  ) => {
    if (!activeSession || !currentClubId) return;
    const court = activeCourts.find((c) => c.id === courtId);
    if (!court) return;

    const newMatchData = FairMatchAllocation.generateMatchForCourt(
      activeSession.id,
      courtId,
      court.gameType,
      players,
      activeJoins,
      matchesList,
      activeCourts
    );

    if (!newMatchData) {
      if (!silentFail) {
        alert('Not enough available players in rotation to form a match for this court.');
      }
      return;
    }

    const nextMatchId = matchesList.length > 0 ? Math.max(...matchesList.map((m) => m.id)) + 1 : 1;
    const matchEntity: MatchEntity = { ...newMatchData, id: nextMatchId };

    // Optimistic UI updates
    setActiveMatches((prev) => [...prev, matchEntity]);
    setAllMatchesMap((prev) => ({
      ...prev,
      [activeSession.id]: [...(prev[activeSession.id] || []), matchEntity]
    }));

    // Dual-Sync to Firestore & RTDB
    await syncMatchToRealtime(currentClubId, activeSession.id, matchEntity);
  };

  const handleGenerateMatch = async (courtId: number, silentFail = false) => {
    await handleGenerateMatchWithMatches(courtId, activeMatches, silentFail);
  };

  const handleUpdateScore = async (matchId: number, teamAScore: number, teamBScore: number) => {
    if (!activeSession || !currentClubId) return;

    // Optimistic state update
    setActiveMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, teamAScore, teamBScore } : m))
    );
    setAllMatchesMap((prev) => ({
      ...prev,
      [activeSession.id]: (prev[activeSession.id] || []).map((m) =>
        m.id === matchId ? { ...m, teamAScore, teamBScore } : m
      )
    }));

    // Realtime Database
    try {
      const mRef = ref(rtdb, `clubs/${currentClubId}/sessions/session_${activeSession.id}/matches/match_${matchId}`);
      await updateRtdb(mRef, { teamAScore, teamBScore });
    } catch (e) {
      console.warn('RTDB update score note:', e);
    }
  };

  const handleFinishMatch = async (matchId: number, teamAScore: number, teamBScore: number, winner: 'A' | 'B') => {
    if (!activeSession || !currentClubId) return;

    // Safety guard: 0-0 match indicates the game was not played or should not be counted.
    // Do not record the game, exclude from all metrics, and do not persist as completed 0-0 match.
    if (teamAScore === 0 && teamBScore === 0) {
      await handleCancelMatch(matchId);
      return;
    }

    const targetMatch = activeMatches.find((m) => m.id === matchId);
    const courtId = targetMatch?.courtId;
    const now = Date.now();

    const payload = {
      teamAScore,
      teamBScore,
      winnerTeam: winner,
      endTime: now
    };

    // Optimistic UI updates
    const updatedMatches = activeMatches.map((m) =>
      m.id === matchId ? { ...m, ...payload } : m
    );
    setActiveMatches(updatedMatches);
    setAllMatchesMap((prev) => ({
      ...prev,
      [activeSession.id]: (prev[activeSession.id] || []).map((m) =>
        m.id === matchId ? { ...m, ...payload } : m
      )
    }));

    // Realtime Database
    try {
      const mRef = ref(rtdb, `clubs/${currentClubId}/sessions/session_${activeSession.id}/matches/match_${matchId}`);
      await updateRtdb(mRef, payload);
    } catch (e) {
      console.warn('RTDB finish match note:', e);
    }

    // Automatically trigger next match generation for this court
    if (courtId != null) {
      await handleGenerateMatchWithMatches(courtId, updatedMatches, true);
    }
  };

  const handleCancelMatch = async (matchId: number) => {
    if (!activeSession || !currentClubId) return;

    // Optimistic UI update
    setActiveMatches((prev) => prev.filter((m) => m.id !== matchId));
    setAllMatchesMap((prev) => ({
      ...prev,
      [activeSession.id]: (prev[activeSession.id] || []).filter((m) => m.id !== matchId)
    }));

    // Realtime Database
    try {
      const mRef = ref(rtdb, `clubs/${currentClubId}/sessions/session_${activeSession.id}/matches/match_${matchId}`);
      await removeRtdb(mRef);
    } catch (e) {
      console.warn('RTDB cancel match note:', e);
    }
  };

  // Toggle Pause Player matching Android BadmintonRepository logic
  const handleTogglePlayerPause = async (playerId: number) => {
    if (!activeSession || !currentClubId) return;
    const join = activeJoins.find((j) => j.playerId === playerId);
    if (!join) return;

    const totalMatches = activeMatches.length;
    const courtCount = activeCourts.length || 1;

    let updatedJoin: SessionPlayerJoinEntity;

    if (!join.isPaused) {
      updatedJoin = {
        ...join,
        isPaused: true,
        pausedAtMatchCount: totalMatches
      };
    } else {
      let pauseAdjustment = 0;
      if (join.pausedAtMatchCount != null) {
        const matchesDuringPause = Math.max(0, totalMatches - join.pausedAtMatchCount);
        pauseAdjustment = Math.round(matchesDuringPause / courtCount);
      }
      updatedJoin = {
        ...join,
        isPaused: false,
        adjustedGames: join.adjustedGames + pauseAdjustment,
        pausedAtMatchCount: null
      };
    }

    // Optimistic UI update
    setActiveJoins((prev) => prev.map((j) => (j.playerId === playerId ? updatedJoin : j)));

    // Sync to Realtime Database
    await syncSessionPlayerToRealtime(currentClubId, activeSession.id, updatedJoin);
  };

  // Add PAYG Player Walk-in with Late Arrival Calculation
  const handleAddPAYGPlayerToSession = async (name: string, gender: Gender) => {
    if (!activeSession || !currentClubId) return;

    const nextPlayerId = players.length > 0 ? Math.max(...players.map((p) => p.id)) + 1 : 1;
    const newPlayer: PlayerEntity = {
      id: nextPlayerId,
      name,
      gender,
      createdAt: Date.now(),
      isPAYG: true
    };

    // Late Arrival Adjustment = round(totalMatches / courtCount)
    const totalMatches = activeMatches.length;
    const courtCount = activeCourts.length || 1;
    const lateArrivalAdjustment = Math.round(totalMatches / courtCount);

    const joinEntity: SessionPlayerJoinEntity = {
      sessionId: activeSession.id,
      playerId: nextPlayerId,
      isPaused: false,
      eligibleCourtIds: null,
      isPAYG: true,
      adjustedGames: lateArrivalAdjustment,
      pausedAtMatchCount: null
    };

    // Optimistic UI updates
    setPlayers((prev) => [...prev, newPlayer]);
    setActiveJoins((prev) => [...prev, joinEntity]);

    // Members in RTDB
    try {
      await setRtdb(ref(rtdb, `clubs/${currentClubId}/members/player_${nextPlayerId}`), {
        id: `player_${nextPlayerId}`,
        name,
        gender,
        isPAYG: true,
        createdAt: newPlayer.createdAt
      });
    } catch (e) {
      console.warn('RTDB add PAYG player note:', e);
    }

    // Session player in RTDB
    await syncSessionPlayerToRealtime(currentClubId, activeSession.id, joinEntity);
  };

  // Switch / Swap Players in active match
  const handleSwitchMatchPlayers = async (matchId: number) => {
    if (!activeSession || !currentClubId) return;
    const match = activeMatches.find((m) => m.id === matchId);
    if (!match) return;

    const updatedMatch: MatchEntity = {
      ...match,
      teamAPlayer1Id: match.teamBPlayer1Id,
      teamAPlayer2Id: match.teamBPlayer2Id,
      teamBPlayer1Id: match.teamAPlayer1Id,
      teamBPlayer2Id: match.teamAPlayer2Id,
      teamAScore: match.teamBScore ?? 0,
      teamBScore: match.teamAScore ?? 0
    };

    // Optimistic UI update
    setActiveMatches((prev) => prev.map((m) => (m.id === matchId ? updatedMatch : m)));
    setAllMatchesMap((prev) => ({
      ...prev,
      [activeSession.id]: (prev[activeSession.id] || []).map((m) =>
        m.id === matchId ? updatedMatch : m
      )
    }));

    // Sync to RTDB
    await syncMatchToRealtime(currentClubId, activeSession.id, updatedMatch);
  };

  const handleAddCourtToActiveSession = async (name: string, gameType: GameType = 'DOUBLES') => {
    if (!activeSession || !currentClubId) return;
    const nextCourtId = activeCourts.length > 0 ? Math.max(...activeCourts.map((c) => c.id)) + 1 : 1;
    const newCourt: CourtEntity = {
      id: nextCourtId,
      sessionId: activeSession.id,
      name: name.trim().toUpperCase(),
      gameType
    };
    const nextCourts = [...activeCourts, newCourt];
    setActiveCourts(nextCourts);
    setAllCourtsMap((prev) => ({ ...prev, [activeSession.id]: nextCourts }));

    try {
      const cRef = ref(rtdb, `clubs/${currentClubId}/sessions/session_${activeSession.id}/courts/court_${nextCourtId}`);
      await setRtdb(cRef, {
        id: `court_${nextCourtId}`,
        name: newCourt.name,
        gameType: newCourt.gameType
      });
    } catch (e) {
      console.warn('RTDB add court to active session note:', e);
    }
  };

  const handleDeleteCourtFromActiveSession = async (courtId: number) => {
    if (!activeSession || !currentClubId) return;
    const nextCourts = activeCourts.filter((c) => c.id !== courtId);
    setActiveCourts(nextCourts);
    setAllCourtsMap((prev) => ({ ...prev, [activeSession.id]: nextCourts }));

    // If an active ongoing match is on this court, cancel it
    const ongoing = activeMatches.find((m) => m.courtId === courtId && !m.endTime);
    if (ongoing) {
      await handleCancelMatch(ongoing.id);
    }

    try {
      const cRef = ref(rtdb, `clubs/${currentClubId}/sessions/session_${activeSession.id}/courts/court_${courtId}`);
      await removeRtdb(cRef);
    } catch (e) {
      console.warn('RTDB delete court from active session note:', e);
    }
  };

  const handleUpdateCourtGameType = async (courtId: number, gameType: GameType) => {
    if (!activeSession || !currentClubId) return;
    const nextCourts = activeCourts.map((c) => (c.id === courtId ? { ...c, gameType } : c));
    setActiveCourts(nextCourts);
    setAllCourtsMap((prev) => ({ ...prev, [activeSession.id]: nextCourts }));

    try {
      const cRef = ref(rtdb, `clubs/${currentClubId}/sessions/session_${activeSession.id}/courts/court_${courtId}`);
      await updateRtdb(cRef, { gameType });
    } catch (e) {
      console.warn('RTDB update court gameType note:', e);
    }
  };

  const handleAddPlayerToActiveSession = async (playerId: number) => {
    if (!activeSession || !currentClubId) return;
    if (activeJoins.some((j) => j.playerId === playerId)) return;
    const player = players.find((p) => p.id === playerId);

    const totalMatches = activeMatches.length;
    const courtCount = activeCourts.length || 1;
    const lateArrivalAdjustment = activeSession.startTime ? Math.round(totalMatches / courtCount) : 0;

    const newJoin: SessionPlayerJoinEntity = {
      sessionId: activeSession.id,
      playerId,
      isPaused: false,
      eligibleCourtIds: null,
      isPAYG: player?.isPAYG || false,
      adjustedGames: lateArrivalAdjustment,
      pausedAtMatchCount: null
    };

    const nextJoins = [...activeJoins, newJoin];
    setActiveJoins(nextJoins);
    setAllJoinsMap((prev) => ({ ...prev, [activeSession.id]: nextJoins }));

    await syncSessionPlayerToRealtime(currentClubId, activeSession.id, newJoin);
  };

  const handleRemovePlayerFromActiveSession = async (playerId: number) => {
    if (!activeSession || !currentClubId) return;
    const nextJoins = activeJoins.filter((j) => j.playerId !== playerId);
    setActiveJoins(nextJoins);
    setAllJoinsMap((prev) => ({ ...prev, [activeSession.id]: nextJoins }));

    try {
      const spRef = ref(rtdb, `clubs/${currentClubId}/sessions/session_${activeSession.id}/session_players/player_${playerId}`);
      await removeRtdb(spRef);
    } catch (e) {
      console.warn('RTDB remove session player note:', e);
    }
  };

  const handleUpdatePlayerCourtEligibility = async (playerId: number, eligibleCourtIds: number[] | null) => {
    if (!activeSession || !currentClubId) return;
    const targetJoin = activeJoins.find((j) => j.playerId === playerId);
    if (!targetJoin) return;
    const eligibleString = eligibleCourtIds && eligibleCourtIds.length > 0 ? eligibleCourtIds.join(',') : null;
    const updatedJoin: SessionPlayerJoinEntity = {
      ...targetJoin,
      eligibleCourtIds: eligibleString
    };
    setActiveJoins((prev) => prev.map((j) => (j.playerId === playerId ? updatedJoin : j)));
    setAllJoinsMap((prev) => ({
      ...prev,
      [activeSession.id]: (prev[activeSession.id] || []).map((j) => (j.playerId === playerId ? updatedJoin : j))
    }));

    await syncSessionPlayerToRealtime(currentClubId, activeSession.id, updatedJoin);
  };

  const handleCreateWeeklySession = async (
    name: string,
    dayOfWeek: string,
    time: string,
    type: GameType,
    targetScore: number,
    managerId: number | null,
    manager2Id: number | null,
    playerIds: number[],
    courtNames: string[]
  ) => {
    if (!currentClubId) return;
    const nextWSId = weeklySessions.length > 0 ? Math.max(...weeklySessions.map((w) => w.id)) + 1 : 1;
    const mgr1 = sessionManagers.find((m) => m.id === managerId);
    const mgr2 = sessionManagers.find((m) => m.id === manager2Id);

    const wsEntity: WeeklySessionEntity = {
      id: nextWSId,
      name,
      dayOfWeek,
      time,
      type,
      targetScore,
      managerId,
      managerName: mgr1?.name,
      manager2Id,
      manager2Name: mgr2?.name,
      createdAt: Date.now()
    };

    const newCourts: CourtEntity[] = courtNames.map((cName, idx) => ({
      id: idx + 1,
      weeklySessionId: nextWSId,
      name: cName,
      gameType: type
    }));

    // Optimistic UI updates
    setWeeklySessions((prev) => [...prev, wsEntity]);
    setWeeklyMembersMap((prev) => ({ ...prev, [nextWSId]: playerIds }));
    setWeeklyCourtsMap((prev) => ({ ...prev, [nextWSId]: newCourts }));

    const membersMap: Record<string, any> = {};
    playerIds.forEach((mId) => {
      membersMap[`member_${mId}`] = { playerId: `player_${mId}` };
    });

    const courtsMap: Record<string, any> = {};
    newCourts.forEach((c) => {
      courtsMap[`court_${c.id}`] = { id: `court_${c.id}`, name: c.name, gameType: c.gameType };
    });

    // Realtime Database
    try {
      const wsRef = ref(rtdb, `clubs/${currentClubId}/weekly_sessions/weekly_${nextWSId}`);
      await setRtdb(wsRef, {
        info: {
          id: `weekly_${nextWSId}`,
          name,
          dayOfWeek,
          time,
          type,
          targetScore,
          managerId: managerId ? `player_${managerId}` : null,
          managerName: mgr1?.name || null,
          manager2Id: manager2Id ? `player_${manager2Id}` : null,
          manager2Name: mgr2?.name || null,
          createdAt: wsEntity.createdAt
        },
        members: membersMap,
        courts: courtsMap
      });
    } catch (e) {
      console.warn('RTDB weekly session note:', e);
    }
  };

  const handleDeleteWeeklySession = async (weeklyId: number) => {
    if (!currentClubId) return;
    // Optimistic UI update
    setWeeklySessions((prev) => prev.filter((w) => w.id !== weeklyId));

    try {
      const wsRef = ref(rtdb, `clubs/${currentClubId}/weekly_sessions/weekly_${weeklyId}`);
      await removeRtdb(wsRef);
    } catch (e) {
      console.warn('RTDB delete weekly note:', e);
    }
  };

  const handleUpdateWeeklySession = async (
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
  ) => {
    if (!currentClubId) return;
    const mgr1 = updates.managerId !== undefined 
      ? (updates.managerId === 0 ? { name: `${clubDetails?.contactPerson || 'Ashish Verma'} (Club Manager)` } : sessionManagers.find((m) => m.id === updates.managerId))
      : undefined;
    const mgr2 = updates.manager2Id !== undefined
      ? (updates.manager2Id === 0 ? { name: `${clubDetails?.contactPerson || 'Ashish Verma'} (Club Manager)` } : sessionManagers.find((m) => m.id === updates.manager2Id))
      : undefined;

    setWeeklySessions((prev) =>
      prev.map((w) => {
        if (w.id !== weeklyId) return w;
        return {
          ...w,
          ...updates,
          ...(updates.managerId !== undefined ? { managerId: updates.managerId, managerName: mgr1?.name || null } : {}),
          ...(updates.manager2Id !== undefined ? { manager2Id: updates.manager2Id, manager2Name: mgr2?.name || null } : {})
        };
      })
    );

    try {
      const wsInfoRef = ref(rtdb, `clubs/${currentClubId}/weekly_sessions/weekly_${weeklyId}/info`);
      const payload: Record<string, any> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.dayOfWeek !== undefined) payload.dayOfWeek = updates.dayOfWeek;
      if (updates.time !== undefined) payload.time = updates.time;
      if (updates.type !== undefined) payload.type = updates.type;
      if (updates.targetScore !== undefined) payload.targetScore = updates.targetScore;
      if (updates.managerId !== undefined) {
        payload.managerId = updates.managerId === 0 ? 'manager_0' : (updates.managerId ? `player_${updates.managerId}` : null);
        payload.managerName = mgr1?.name || null;
      }
      if (updates.manager2Id !== undefined) {
        payload.manager2Id = updates.manager2Id === 0 ? 'manager_0' : (updates.manager2Id ? `player_${updates.manager2Id}` : null);
        payload.manager2Name = mgr2?.name || null;
      }
      await updateRtdb(wsInfoRef, payload);
    } catch (e) {
      console.warn('RTDB update weekly note:', e);
    }
  };

  const handleAddWeeklyCourt = async (weeklyId: number, courtName: string, gameType: GameType) => {
    if (!currentClubId) return;
    const existingCourts = weeklyCourtsMap[weeklyId] || [];
    const nextId = existingCourts.length > 0 ? Math.max(...existingCourts.map((c) => c.id)) + 1 : 1;
    const newCourt: CourtEntity = { id: nextId, weeklySessionId: weeklyId, name: courtName, gameType };

    // Optimistic UI update
    setWeeklyCourtsMap((prev) => ({
      ...prev,
      [weeklyId]: [...(prev[weeklyId] || []), newCourt]
    }));

    // Realtime Database
    try {
      const cRef = ref(rtdb, `clubs/${currentClubId}/weekly_sessions/weekly_${weeklyId}/courts/court_${nextId}`);
      await setRtdb(cRef, { id: `court_${nextId}`, name: courtName, gameType });
    } catch (e) {
      console.warn('RTDB court note:', e);
    }
  };

  const handleDeleteWeeklyCourt = async (weeklyId: number, courtId: number) => {
    if (!currentClubId) return;
    // Optimistic UI update
    setWeeklyCourtsMap((prev) => ({
      ...prev,
      [weeklyId]: (prev[weeklyId] || []).filter((c) => c.id !== courtId)
    }));

    try {
      const cRef = ref(rtdb, `clubs/${currentClubId}/weekly_sessions/weekly_${weeklyId}/courts/court_${courtId}`);
      await removeRtdb(cRef);
    } catch (e) {
      console.warn('RTDB delete court note:', e);
    }
  };

  const handleAddWeeklyMember = async (weeklyId: number, memberId: number) => {
    if (!currentClubId) return;
    // Optimistic UI update
    setWeeklyMembersMap((prev) => ({
      ...prev,
      [weeklyId]: [...(prev[weeklyId] || []), memberId]
    }));

    // Requirement 1: If anyone is playing on any weekly session as regular member, change status from PAYG to PERMANENT
    const targetPlayer = players.find((p) => p.id === memberId);
    if (targetPlayer && targetPlayer.isPAYG) {
      await handleConvertPAYGToPermanent(memberId);
    }

    try {
      const mRef = ref(rtdb, `clubs/${currentClubId}/weekly_sessions/weekly_${weeklyId}/members/member_${memberId}`);
      await setRtdb(mRef, { playerId: `player_${memberId}` });
    } catch (e) {
      console.warn('RTDB add member note:', e);
    }
  };

  const handleDeleteWeeklyMember = async (weeklyId: number, memberId: number) => {
    if (!currentClubId) return;
    // Optimistic UI update
    setWeeklyMembersMap((prev) => ({
      ...prev,
      [weeklyId]: (prev[weeklyId] || []).filter((id) => id !== memberId)
    }));

    try {
      const mRef = ref(rtdb, `clubs/${currentClubId}/weekly_sessions/weekly_${weeklyId}/members/member_${memberId}`);
      await removeRtdb(mRef);
    } catch (e) {
      console.warn('RTDB delete member note:', e);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-sky-500 selection:text-white transition-colors duration-200 ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-950'
    }`}>
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        clubDetails={clubDetails}
        activeSession={activeSession}
        isRealtimeConnected={isRealtimeConnected}
        isLoggedIn={!!currentUser || !!clubDetails}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Missing Secrets / Configuration Banner */}
      {!isFirebaseConfigured && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-amber-200 text-xs">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px]">
                Firebase Secrets Required
              </span>
              <span>
                Missing environment configuration: <code className="font-mono text-amber-300">{missingFirebaseConfigKeys.join(', ')}</code>.
              </span>
            </div>
            <span className="text-[11px] text-amber-400/80">
              Configure these in Google AI Studio Settings &gt; Secrets or your environment.
            </span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorBoundary onReset={() => setActiveTab('CLUB')}>
          {activeTab === 'SETUP' && (
            <ClubSetupScreen
              clubDetails={clubDetails}
              currentClubId={currentClubId}
              currentUserRole={currentUserRole}
              currentManagerName={currentManagerName}
              currentUserEmail={currentUser?.email || sessionStorage.getItem('badminton_session_user') || null}
              onSaveClub={handleSaveClub}
              onSignInClub={handleSignInClub}
              onRegisterClub={handleRegisterClub}
              onSelectClub={handleSelectClub}
              onSignOut={handleSignOut}
            />
          )}

          {!clubDetails && activeTab !== 'SETUP' && (
            <div className="max-w-md mx-auto py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto text-3xl">
                🏸
              </div>
              <h2 className="text-xl font-bold text-slate-100">Club Sign In Required</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Please sign in with your club email on the Club page to view sessions, manage courts, and track live scores.
              </p>
            </div>
          )}

          {clubDetails && activeTab === 'CLUB' && (
            <SessionsManagementScreen
              activeSession={activeSession}
              allSessions={visibleSessions}
              weeklySessions={visibleWeeklySessions}
              weeklyMembersMap={weeklyMembersMap}
              weeklyCourtsMap={weeklyCourtsMap}
              players={players}
              courtMasters={courtMasters}
              sessionManagers={sessionManagers}
              clubDetails={clubDetails}
              onStartAdhocSession={handleStartAdhocSession}
              onInstantiateWeeklySession={handleInstantiateWeeklySession}
              onEndActiveSession={handleEndActiveSession}
              onDeleteSession={handleDeleteSession}
              onSwitchActiveSession={async (sId) => {
                const sess = sessions.find((s) => s.id === sId);
                if (sess) setActiveTab('LIVE');
              }}
              onCreateWeeklySession={handleCreateWeeklySession}
              onUpdateWeeklySession={handleUpdateWeeklySession}
              onDeleteWeeklySession={handleDeleteWeeklySession}
              onAddWeeklyCourt={handleAddWeeklyCourt}
              onDeleteWeeklyCourt={handleDeleteWeeklyCourt}
              onAddWeeklyMember={handleAddWeeklyMember}
              onDeleteWeeklyMember={handleDeleteWeeklyMember}
              onAddMember={handleAddPlayer}
              onDeleteMember={handleDeletePlayer}
              onToggleMemberPAYG={handleTogglePlayerPAYG}
              onAddSessionManager={handleAddSessionManager}
              onDeleteSessionManager={handleDeleteSessionManager}
              onResendPasswordReset={handleResendPasswordReset}
              currentUserRole={currentUserRole}
              currentManagerId={currentManagerId}
              currentManagerName={currentManagerName}
              onNavigateToLive={() => setActiveTab('LIVE')}
            />
          )}

          {clubDetails && activeTab === 'LIVE' && (
            <LiveSessionScreen
              clubDetails={clubDetails}
              activeSession={activeSession}
              courts={activeCourts}
              players={players}
              joins={activeJoins}
              matches={activeMatches}
              courtMasters={courtMasters}
              onStartSession={handleStartSession}
              onEndSession={async () => {
                if (activeSession) await handleEndActiveSession(activeSession.id);
              }}
              onGenerateMatch={handleGenerateMatch}
              onUpdateScore={handleUpdateScore}
              onFinishMatch={handleFinishMatch}
              onCancelMatch={handleCancelMatch}
              onTogglePlayerPause={handleTogglePlayerPause}
              onAddPAYGPlayerToSession={handleAddPAYGPlayerToSession}
              onSwitchMatchPlayers={handleSwitchMatchPlayers}
              onAddCourtToSession={handleAddCourtToActiveSession}
              onDeleteCourtFromSession={handleDeleteCourtFromActiveSession}
              onUpdateCourtGameType={handleUpdateCourtGameType}
              onAddPlayerToSession={handleAddPlayerToActiveSession}
              onRemovePlayerFromSession={handleRemovePlayerFromActiveSession}
              onUpdatePlayerCourtEligibility={handleUpdatePlayerCourtEligibility}
              onAddPlayerToMaster={handleAddPlayer}
              onTogglePlayerPAYG={handleTogglePlayerPAYG}
              onNavigateToSessions={() => setActiveTab('CLUB')}
            />
          )}

          {clubDetails && activeTab === 'HISTORY' && (
            <HistoryScreen
              clubDetails={clubDetails}
              sessions={visibleSessions}
              allCourtsMap={allCourtsMap}
              allMatchesMap={allMatchesMap}
              players={players}
              weeklySessions={visibleWeeklySessions}
              onDeleteSession={handleDeleteSession}
            />
          )}
        </ErrorBoundary>
      </main>

      {/* Fullscreen TV / Monitor Display */}
      {isFullscreenMonitorOpen && (
        <FullscreenCourtMonitor
          onClose={() => setIsFullscreenMonitorOpen(false)}
          clubDetails={clubDetails}
          activeSession={activeSession}
          courts={activeCourts}
          players={players}
          matches={activeMatches}
        />
      )}

      {/* Mobile QR Modal */}
      {isQRModalOpen && (
        <MobileQRModal 
          onClose={() => setIsQRModalOpen(false)} 
        />
      )}

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />

    </div>
  );
};

export default App;
