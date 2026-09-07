import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  Auth, 
  onAuthStateChanged, 
  User, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot as onFirestoreSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  writeBatch,
  Firestore
} from 'firebase/firestore';
import { 
  getDatabase, 
  ref, 
  onValue, 
  set as setRtdb, 
  update as updateRtdb, 
  remove as removeRtdb, 
  get as getRtdb,
  Database 
} from 'firebase/database';
import type { 
  ClubEntity, 
  PlayerEntity, 
  SessionEntity, 
  SessionPlayerJoinEntity, 
  CourtEntity, 
  MatchEntity, 
  WeeklySessionEntity, 
  WeeklySessionMemberEntity, 
  WeeklySessionCourtEntity, 
  CourtMasterEntity,
  SessionManagerEntity
} from '../types';
import firebaseConfigJson from '../../firebase-applet-config.json';

export const RTDB_URL = "https://badmintonsessionmanager-default-rtdb.europe-west1.firebasedatabase.app";

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
  databaseURL: RTDB_URL,
};

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Initialize Firestore
export const db: Firestore = getFirestore(
  app, 
  firebaseConfigJson.firestoreDatabaseId || '(default)'
);

// Initialize Firebase Realtime Database
export const rtdb: Database = getDatabase(app, RTDB_URL);

export const DEFAULT_CLUB_ID = 'club_1';

export const INITIAL_CLUB: ClubEntity = {
  id: 1,
  name: 'Ashish Verma Club',
  venue: 'National Sports Arena - Main Sports Hall',
  defaultSessionType: 'DOUBLES',
  themeColorHex: '#0284C7',
  targetScore: 21,
  contactPerson: 'Ashish Verma',
  description: 'Ashish.Verma.UK@gmail.com',
  createdAt: Date.now(),
};

export const INITIAL_SESSION_MANAGERS: SessionManagerEntity[] = [
  { id: 1, name: 'Pravat Nayak', email: 'pravat.nayak@example.com', inviteStatus: 'ACTIVE', createdAt: Date.now() - 25 * 86400000 },
  { id: 2, name: 'Sarah Jenkins', email: 'sarah.j@example.com', inviteStatus: 'ACTIVE', createdAt: Date.now() - 20 * 86400000 },
];

export const INITIAL_PLAYERS: PlayerEntity[] = [
  { id: 1, name: 'ASHISH VERMA', gender: 'MALE', createdAt: Date.now() - 30 * 86400000, isPAYG: false },
  { id: 2, name: 'PRAVAT NAYAK', gender: 'MALE', createdAt: Date.now() - 28 * 86400000, isPAYG: false },
  { id: 3, name: 'MARCUS CHEN', gender: 'MALE', createdAt: Date.now() - 25 * 86400000, isPAYG: false },
  { id: 4, name: 'PRIYA SHARMA', gender: 'FEMALE', createdAt: Date.now() - 22 * 86400000, isPAYG: false },
  { id: 5, name: 'SARAH JENKINS', gender: 'FEMALE', createdAt: Date.now() - 20 * 86400000, isPAYG: false },
  { id: 6, name: 'DAVID WILSON', gender: 'MALE', createdAt: Date.now() - 18 * 86400000, isPAYG: false },
  { id: 7, name: 'KENJI TAKAHASHI', gender: 'MALE', createdAt: Date.now() - 15 * 86400000, isPAYG: false },
  { id: 8, name: 'EMMA WATSON', gender: 'FEMALE', createdAt: Date.now() - 12 * 86400000, isPAYG: false },
  { id: 9, name: 'LIAM O\'CONNOR', gender: 'MALE', createdAt: Date.now() - 10 * 86400000, isPAYG: true },
  { id: 10, name: 'CHLOE ZHAO', gender: 'FEMALE', createdAt: Date.now() - 5 * 86400000, isPAYG: true },
];

export const INITIAL_COURT_MASTERS: CourtMasterEntity[] = [
  { id: 1, name: 'COURT 1', createdAt: Date.now() },
  { id: 2, name: 'COURT 2', createdAt: Date.now() },
  { id: 3, name: 'COURT 3', createdAt: Date.now() },
  { id: 4, name: 'COURT 4', createdAt: Date.now() },
];

export const INITIAL_WEEKLY_SESSIONS: WeeklySessionEntity[] = [
  {
    id: 1,
    name: 'Wednesday Club Night',
    dayOfWeek: 'Wednesday',
    time: '19:00',
    type: 'DOUBLES',
    managerId: 1,
    createdAt: Date.now() - 14 * 86400000,
  },
  {
    id: 2,
    name: 'Sunday Doubles League',
    dayOfWeek: 'Sunday',
    time: '10:00',
    type: 'DOUBLES',
    managerId: 1,
    createdAt: Date.now() - 10 * 86400000,
  },
  {
    id: 3,
    name: 'Friday Mixed Challenge',
    dayOfWeek: 'Friday',
    time: '18:30',
    type: 'MIXED_DOUBLES',
    managerId: 2,
    createdAt: Date.now() - 7 * 86400000,
  },
];

export interface UserClubAssociation {
  email: string;
  clubId: string;
  clubName: string;
  role: 'CLUB_MANAGER' | 'SESSION_MANAGER' | string;
  managerId?: number | null;
  managerName?: string | null;
  ownerUid?: string | null;
  venue?: string;
  updatedAt?: number;
}

/**
 * Sanitizes an email key to match the Android app's sanitizeEmailKey function:
 * email.lowercase().trim().replace(".", "_").replace("@", "_at_").replace("[^a-z0-9_]", "_")
 */
export function sanitizeEmailKey(email: string): string {
  return email
    .toLowerCase()
    .trim()
    .replace(/\./g, '_')
    .replace(/@/g, '_at_')
    .replace(/[^a-z0-9_]/g, '_');
}

/**
 * Finds all clubs associated with a user in Firebase Realtime Database
 * by checking /user_club_index/{sanitizedEmail} and falling back to /clubs
 */
export async function findClubsForUser(email: string, fallbackUid?: string | null): Promise<UserClubAssociation[]> {
  const cleanEmail = email.trim();
  if (!cleanEmail) return [];

  try {
    const sanitized = sanitizeEmailKey(cleanEmail);
    const indexRef = ref(rtdb, `user_club_index/${sanitized}`);
    const indexSnap = await getRtdb(indexRef);

    const list: UserClubAssociation[] = [];

    if (indexSnap.exists()) {
      const data = indexSnap.val();
      for (const key of Object.keys(data)) {
        const item = data[key];
        const clubId = item.clubId || key;
        if (clubId) {
          list.push({
            email: cleanEmail,
            clubId,
            clubName: item.clubName || 'Badminton Club',
            role: item.role || 'SESSION_MANAGER',
            managerId: item.managerId != null ? Number(item.managerId) : undefined,
            managerName: item.managerName,
            ownerUid: item.ownerUid,
            venue: item.venue || '',
            updatedAt: item.updatedAt || Date.now(),
          });
        }
      }
    }

    // Fallback 1: If no entries found and fallbackUid exists, check /clubs/club_{fallbackUid}
    if (list.length === 0 && fallbackUid) {
      const ownerClubId = `club_${fallbackUid}`;
      const clubSnap = await getRtdb(ref(rtdb, `clubs/${ownerClubId}/details`));
      if (clubSnap.exists()) {
        const details = clubSnap.val();
        const assoc: UserClubAssociation = {
          email: cleanEmail,
          clubId: ownerClubId,
          clubName: details.name || 'My Badminton Club',
          role: 'CLUB_MANAGER',
          ownerUid: fallbackUid,
          venue: details.venue || '',
          updatedAt: Date.now(),
        };
        list.push(assoc);
        // Register in index
        await registerUserClubAssociation(assoc);
      }
    }

    // Fallback 2: Scan /clubs for user email
    if (list.length === 0) {
      const allClubsSnap = await getRtdb(ref(rtdb, 'clubs'));
      if (allClubsSnap.exists()) {
        const allClubs = allClubsSnap.val();
        for (const [cId, clubData] of Object.entries<any>(allClubs)) {
          if (!clubData) continue;
          const details = clubData.details || {};
          const description = details.description || '';
          
          if (typeof description === 'string' && description.toLowerCase().includes(cleanEmail.toLowerCase())) {
            const assoc: UserClubAssociation = {
              email: cleanEmail,
              clubId: cId,
              clubName: details.name || 'Club',
              role: 'CLUB_MANAGER',
              venue: details.venue || '',
              updatedAt: Date.now(),
            };
            list.push(assoc);
            await registerUserClubAssociation(assoc);
          } else if (clubData.session_managers) {
            for (const [mId, mData] of Object.entries<any>(clubData.session_managers)) {
              if (mData && mData.email && mData.email.toLowerCase() === cleanEmail.toLowerCase()) {
                const assoc: UserClubAssociation = {
                  email: cleanEmail,
                  clubId: cId,
                  clubName: details.name || 'Club',
                  role: 'SESSION_MANAGER',
                  managerId: mData.id ? Number(String(mData.id).replace('manager_', '')) : undefined,
                  managerName: mData.name || '',
                  venue: details.venue || '',
                  updatedAt: Date.now(),
                };
                list.push(assoc);
                await registerUserClubAssociation(assoc);
              }
            }
          }
        }
      }
    }

    return list;
  } catch (error) {
    console.error('Error finding clubs for user in Realtime DB:', error);
    return [];
  }
}

/**
 * Registers or updates a user-to-club index entry under /user_club_index/{sanitizedEmail}/{clubId}
 */
export async function registerUserClubAssociation(assoc: UserClubAssociation): Promise<void> {
  if (!assoc.email || !assoc.clubId) return;
  try {
    const sanitized = sanitizeEmailKey(assoc.email);
    const indexRef = ref(rtdb, `user_club_index/${sanitized}/${assoc.clubId}`);
    await setRtdb(indexRef, {
      email: assoc.email.trim(),
      clubId: assoc.clubId,
      clubName: assoc.clubName,
      role: assoc.role,
      managerId: assoc.managerId ?? null,
      managerName: assoc.managerName ?? null,
      ownerUid: assoc.ownerUid ?? null,
      venue: assoc.venue ?? '',
      updatedAt: assoc.updatedAt || Date.now(),
    });
  } catch (err) {
    console.warn('Warning registering user_club_index:', err);
  }
}

/**
 * Creates a login account for a session manager using a secondary Firebase App instance
 * to avoid signing out the current club manager, and sends a password reset email
 * so the session manager can set their password and log in.
 */
export async function createSessionManagerAuthUser(email: string): Promise<{ success: boolean; message?: string }> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    return { success: false, message: 'Email address is required' };
  }

  // Generate a random temporary password for initial user creation
  const tempPassword = `SmPwd_${Math.random().toString(36).slice(2, 9)}_${Date.now()}!`;
  const secondaryAppName = `SecondaryAuth_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let secondaryApp: any = null;

  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, tempPassword);
      // Immediately sign out from secondary app
      await signOut(secondaryAuth);
    } catch (createErr: any) {
      if (createErr.code === 'auth/email-already-in-use') {
        // Account already exists in Firebase Auth - that's completely acceptable
        console.log(`[Session Manager Auth] Account for ${cleanEmail} already exists in Firebase Auth.`);
      } else {
        console.warn('[Session Manager Auth] User creation note:', createErr.message || createErr.code);
      }
    }
  } catch (appErr) {
    console.warn('[Session Manager Auth] Secondary app error:', appErr);
  } finally {
    if (secondaryApp) {
      try {
        await deleteApp(secondaryApp);
      } catch (_) {}
    }
  }

  // Now send the official password reset email to the session manager
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return { 
      success: true, 
      message: `Login created and password reset email sent to ${cleanEmail}` 
    };
  } catch (resetErr: any) {
    console.warn('[Session Manager Auth] Password reset email error:', resetErr);
    if (resetErr.code === 'auth/user-not-found') {
      return {
        success: false,
        message: `Could not send password reset email: user ${cleanEmail} not found in Firebase Auth.`
      };
    }
    // Still return success with a warning if email was queued or quota reached
    return {
      success: true,
      message: `Account created. (Email status: ${resetErr.message || resetErr.code})`
    };
  }
}

/**
 * Resends the password reset email to a session manager
 */
export async function resendPasswordReset(email: string): Promise<{ success: boolean; message?: string }> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    return { success: false, message: 'Email address is required' };
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return { success: true, message: `Password reset email sent to ${cleanEmail}` };
  } catch (err: any) {
    console.warn('[Session Manager Auth] Resend password reset error:', err);
    let msg = 'Failed to send password reset email. Please try again.';
    if (err.code === 'auth/user-not-found') {
      msg = `No account found for ${cleanEmail}. An account will be initialized.`;
      // Try creating account on secondary app and sending reset
      return await createSessionManagerAuthUser(cleanEmail);
    } else if (err.code === 'auth/too-many-requests') {
      msg = 'Too many requests. Please wait a few moments before requesting another email.';
    } else if (err.message) {
      msg = err.message;
    }
    return { success: false, message: msg };
  }
}

/**
 * Parsed payload from Realtime Database club node
 */
export interface ParsedClubState {
  clubDetails: ClubEntity | null;
  players: PlayerEntity[];
  courtMasters: CourtMasterEntity[];
  sessionManagers: SessionManagerEntity[];
  weeklySessions: WeeklySessionEntity[];
  weeklyMembersMap: Record<number, number[]>;
  weeklyCourtsMap: Record<number, CourtEntity[]>;
  sessions: SessionEntity[];
  allCourtsMap: Record<number, CourtEntity[]>;
  allMatchesMap: Record<number, MatchEntity[]>;
  allJoinsMap: Record<number, SessionPlayerJoinEntity[]>;
}

/**
 * Parses raw Realtime Database club JSON into TypeScript application models
 */
export function parseRtdbClubData(raw: any, fallbackClubId: string = DEFAULT_CLUB_ID): ParsedClubState | null {
  if (!raw || typeof raw !== 'object') return null;

  // 1. Details
  let clubDetails: ClubEntity | null = null;
  if (raw.details) {
    const d = raw.details;
    const rawNumericId = typeof d.id === 'string' ? Number(d.id.replace('club_', '')) || 1 : (Number(d.id) || 1);
    clubDetails = {
      id: rawNumericId,
      name: d.name || 'Badminton Club',
      venue: d.venue || '',
      defaultSessionType: d.defaultSessionType || 'DOUBLES',
      themeColorHex: d.themeColorHex || '#0284C7',
      targetScore: Number(d.targetScore) || 21,
      contactPerson: d.contactPerson || '',
      description: d.description || '',
      createdAt: Number(d.createdAt) || Date.now(),
    };
  }

  // 2. Members (Master Player List)
  const players: PlayerEntity[] = [];
  if (raw.members) {
    for (const [key, p] of Object.entries<any>(raw.members)) {
      if (!p) continue;
      const rawId = p.id != null 
        ? Number(String(p.id).replace('player_', '')) 
        : (Number(key.replace('player_', '')) || 1);
      players.push({
        id: rawId,
        name: p.name || `Player ${rawId}`,
        gender: p.gender === 'FEMALE' ? 'FEMALE' : 'MALE',
        createdAt: Number(p.createdAt) || Date.now(),
        isPAYG: p.isPAYG === true || p.isPAYG === 'true' || p.isPAYG === 1,
      });
    }
    players.sort((a, b) => a.name.localeCompare(b.name));
  }

  // 3. Session Managers
  const sessionManagers: SessionManagerEntity[] = [];
  if (raw.session_managers) {
    for (const [key, m] of Object.entries<any>(raw.session_managers)) {
      if (!m) continue;
      const rawId = m.id != null
        ? Number(String(m.id).replace('manager_', ''))
        : (Number(key.replace('manager_', '')) || 1);
      sessionManagers.push({
        id: rawId,
        name: m.name || `Manager ${rawId}`,
        email: m.email || '',
        inviteStatus: m.inviteStatus || 'ACTIVE',
        createdAt: Number(m.createdAt) || Date.now(),
      });
    }
    sessionManagers.sort((a, b) => a.name.localeCompare(b.name));
  }

  // 3b. Court Masters
  const courtMasters: CourtMasterEntity[] = [];
  if (raw.court_masters) {
    for (const [key, cm] of Object.entries<any>(raw.court_masters)) {
      if (!cm) continue;
      const rawId = cm.id != null
        ? Number(String(cm.id).replace('court_master_', ''))
        : (Number(key.replace('court_master_', '')) || 1);
      courtMasters.push({
        id: rawId,
        name: cm.name || `Court ${rawId}`,
        createdAt: Number(cm.createdAt) || Date.now(),
      });
    }
    courtMasters.sort((a, b) => a.id - b.id);
  }

  // 4. Weekly Sessions
  const weeklySessions: WeeklySessionEntity[] = [];
  const weeklyMembersMap: Record<number, number[]> = {};
  const weeklyCourtsMap: Record<number, CourtEntity[]> = {};

  if (raw.weekly_sessions) {
    for (const [key, wsObj] of Object.entries<any>(raw.weekly_sessions)) {
      if (!wsObj) continue;
      const info = wsObj.info || wsObj;
      const rawWsId = info.id != null
        ? Number(String(info.id).replace('weekly_', ''))
        : (Number(key.replace('weekly_', '')) || 1);

      weeklySessions.push({
        id: rawWsId,
        name: info.name || `Weekly Session ${rawWsId}`,
        dayOfWeek: info.dayOfWeek || 'Wednesday',
        time: info.time || '19:00',
        type: info.type || 'DOUBLES',
        managerId: info.managerId ? Number(String(info.managerId).replace('player_', '')) : null,
        managerName: info.managerName || null,
        manager2Id: info.manager2Id ? Number(String(info.manager2Id).replace('player_', '')) : null,
        manager2Name: info.manager2Name || null,
        createdAt: Number(info.createdAt) || Date.now(),
        targetScore: info.targetScore ? Number(info.targetScore) : undefined,
      });

      // Weekly Members
      if (wsObj.members) {
        const mIds: number[] = [];
        for (const [mKey, mVal] of Object.entries<any>(wsObj.members)) {
          if (!mVal) continue;
          const pId = mVal.playerId 
            ? Number(String(mVal.playerId).replace('player_', '')) 
            : (Number(mKey.replace('member_', '')) || 1);
          mIds.push(pId);
        }
        weeklyMembersMap[rawWsId] = mIds;
      }

      // Weekly Courts
      if (wsObj.courts) {
        const cList: CourtEntity[] = [];
        for (const [cKey, cVal] of Object.entries<any>(wsObj.courts)) {
          if (!cVal) continue;
          const cId = cVal.id != null 
            ? Number(String(cVal.id).replace('court_', '')) 
            : (Number(cKey.replace('court_', '')) || 1);
          cList.push({
            id: cId,
            sessionId: rawWsId,
            name: cVal.name || `Court ${cId}`,
            gameType: cVal.gameType || 'DOUBLES',
          });
        }
        weeklyCourtsMap[rawWsId] = cList;
      }
    }
  }

  // 5. Sessions, Courts, Session Players, and Matches
  const sessions: SessionEntity[] = [];
  const allCourtsMap: Record<number, CourtEntity[]> = {};
  const allMatchesMap: Record<number, MatchEntity[]> = {};
  const allJoinsMap: Record<number, SessionPlayerJoinEntity[]> = {};

  if (raw.sessions) {
    for (const [sKey, sObj] of Object.entries<any>(raw.sessions)) {
      if (!sObj) continue;
      const info = sObj.info || sObj;
      const rawSId = info.id != null
        ? Number(String(info.id).replace('session_', ''))
        : (Number(sKey.replace('session_', '')) || 1);

      sessions.push({
        id: rawSId,
        name: info.name || `Session ${rawSId}`,
        type: info.type || 'DOUBLES',
        status: info.status || (info.isActive ? 'Active' : 'End'),
        isActive: Boolean(info.isActive),
        createdAt: Number(info.createdAt) || Date.now(),
        startTime: info.startTime ? Number(info.startTime) : null,
        endTime: info.endTime ? Number(info.endTime) : null,
        weeklySessionId: info.weeklySessionId ? Number(String(info.weeklySessionId).replace('weekly_', '')) : null,
        managerId: info.managerId ? Number(String(info.managerId).replace('player_', '')) : null,
        managerName: info.managerName || null,
        manager2Id: info.manager2Id ? Number(String(info.manager2Id).replace('player_', '')) : null,
        manager2Name: info.manager2Name || null,
        targetScore: info.targetScore ? Number(info.targetScore) : undefined,
      });

      // Session Players
      const joinsList: SessionPlayerJoinEntity[] = [];
      if (sObj.session_players) {
        for (const [spKey, spVal] of Object.entries<any>(sObj.session_players)) {
          if (!spVal) continue;
          const pId = spVal.playerId != null
            ? Number(String(spVal.playerId).replace('player_', ''))
            : (Number(spKey.replace('player_', '')) || 1);
          joinsList.push({
            sessionId: rawSId,
            playerId: pId,
            isPaused: Boolean(spVal.isPaused),
            eligibleCourtIds: spVal.eligibleCourtIds || null,
            isPAYG: spVal.isPAYG === true || spVal.isPAYG === 'true' || spVal.isPAYG === 1,
            adjustedGames: Number(spVal.adjustedGames) || 0,
            pausedAtMatchCount: spVal.pausedAtMatchCount != null ? Number(spVal.pausedAtMatchCount) : null,
          });
        }
      }
      allJoinsMap[rawSId] = joinsList;

      // Courts
      const courtsList: CourtEntity[] = [];
      if (sObj.courts) {
        for (const [cKey, cVal] of Object.entries<any>(sObj.courts)) {
          if (!cVal) continue;
          const cId = cVal.id != null
            ? Number(String(cVal.id).replace('court_', ''))
            : (Number(cKey.replace('court_', '')) || 1);
          courtsList.push({
            id: cId,
            sessionId: rawSId,
            name: cVal.name || `Court ${cId}`,
            gameType: cVal.gameType || 'DOUBLES',
          });
        }
        courtsList.sort((a, b) => a.id - b.id);
      }
      allCourtsMap[rawSId] = courtsList;

      // Matches
      const matchesList: MatchEntity[] = [];
      if (sObj.matches) {
        for (const [mKey, mVal] of Object.entries<any>(sObj.matches)) {
          if (!mVal) continue;
          const mId = mVal.id != null
            ? Number(String(mVal.id).replace('match_', ''))
            : (Number(mKey.replace('match_', '')) || 1);
          const cId = mVal.courtId != null
            ? Number(String(mVal.courtId).replace('court_', ''))
            : 1;

          const t1p1 = mVal.teamAPlayer1Id != null ? Number(String(mVal.teamAPlayer1Id).replace('player_', '')) : 0;
          const t1p2 = mVal.teamAPlayer2Id != null ? Number(String(mVal.teamAPlayer2Id).replace('player_', '')) : null;
          const t2p1 = mVal.teamBPlayer1Id != null ? Number(String(mVal.teamBPlayer1Id).replace('player_', '')) : 0;
          const t2p2 = mVal.teamBPlayer2Id != null ? Number(String(mVal.teamBPlayer2Id).replace('player_', '')) : null;

          matchesList.push({
            id: mId,
            sessionId: rawSId,
            courtId: cId,
            matchNumber: Number(mVal.matchNumber) || 1,
            teamAPlayer1Id: t1p1,
            teamAPlayer2Id: t1p2,
            teamBPlayer1Id: t2p1,
            teamBPlayer2Id: t2p2,
            teamAScore: mVal.teamAScore != null ? Number(mVal.teamAScore) : null,
            teamBScore: mVal.teamBScore != null ? Number(mVal.teamBScore) : null,
            winnerTeam: mVal.winnerTeam || null,
            startTime: Number(mVal.startTime) || Date.now(),
            endTime: mVal.endTime != null ? Number(mVal.endTime) : null,
          });
        }
        matchesList.sort((a, b) => a.matchNumber - b.matchNumber);
      }
      allMatchesMap[rawSId] = matchesList;
    }
    sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  return {
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
  };
}

/**
 * Helper to sync match updates directly to Firebase Realtime Database
 */
export async function syncMatchToRealtime(
  clubId: string,
  sessionId: number,
  match: MatchEntity
): Promise<void> {
  try {
    const matchRef = ref(rtdb, `clubs/${clubId}/sessions/session_${sessionId}/matches/match_${match.id}`);
    await setRtdb(matchRef, {
      id: `match_${match.id}`,
      matchNumber: match.matchNumber,
      courtId: `court_${match.courtId}`,
      teamAPlayer1Id: `player_${match.teamAPlayer1Id}`,
      teamAPlayer2Id: match.teamAPlayer2Id ? `player_${match.teamAPlayer2Id}` : null,
      teamBPlayer1Id: `player_${match.teamBPlayer1Id}`,
      teamBPlayer2Id: match.teamBPlayer2Id ? `player_${match.teamBPlayer2Id}` : null,
      teamAScore: match.teamAScore,
      teamBScore: match.teamBScore,
      winnerTeam: match.winnerTeam,
      startTime: match.startTime,
      endTime: match.endTime,
    });
  } catch (err) {
    console.warn('Error syncing match to Realtime DB:', err);
  }
}

/**
 * Helper to sync session player status to Firebase Realtime Database
 */
export async function syncSessionPlayerToRealtime(
  clubId: string,
  sessionId: number,
  join: SessionPlayerJoinEntity
): Promise<void> {
  try {
    const spRef = ref(rtdb, `clubs/${clubId}/sessions/session_${sessionId}/session_players/player_${join.playerId}`);
    await setRtdb(spRef, {
      playerId: `player_${join.playerId}`,
      isPaused: join.isPaused,
      eligibleCourtIds: join.eligibleCourtIds,
      isPAYG: join.isPAYG,
      adjustedGames: join.adjustedGames,
      pausedAtMatchCount: join.pausedAtMatchCount,
    });
  } catch (err) {
    console.warn('Error syncing session player to Realtime DB:', err);
  }
}

/**
 * Helper to sync entire session state directly to Firebase Realtime Database
 */
export async function syncSessionStateToRealtime(
  clubId: string,
  session: SessionEntity,
  courts: CourtEntity[],
  joins: SessionPlayerJoinEntity[],
  matches: MatchEntity[]
): Promise<void> {
  const sIdStr = `session_${session.id}`;

  try {
    const sessionRef = ref(rtdb, `clubs/${clubId}/sessions/${sIdStr}`);

    const courtsMap: Record<string, any> = {};
    courts.forEach((c) => {
      courtsMap[`court_${c.id}`] = {
        id: `court_${c.id}`,
        name: c.name,
        gameType: c.gameType,
      };
    });

    const joinsMap: Record<string, any> = {};
    joins.forEach((j) => {
      joinsMap[`player_${j.playerId}`] = {
        playerId: `player_${j.playerId}`,
        isPaused: j.isPaused,
        eligibleCourtIds: j.eligibleCourtIds,
        isPAYG: j.isPAYG,
        adjustedGames: j.adjustedGames,
        pausedAtMatchCount: j.pausedAtMatchCount,
      };
    });

    const matchesMap: Record<string, any> = {};
    matches.forEach((m) => {
      matchesMap[`match_${m.id}`] = {
        id: `match_${m.id}`,
        matchNumber: m.matchNumber,
        courtId: `court_${m.courtId}`,
        teamAPlayer1Id: `player_${m.teamAPlayer1Id}`,
        teamAPlayer2Id: m.teamAPlayer2Id ? `player_${m.teamAPlayer2Id}` : null,
        teamBPlayer1Id: `player_${m.teamBPlayer1Id}`,
        teamBPlayer2Id: m.teamBPlayer2Id ? `player_${m.teamBPlayer2Id}` : null,
        teamAScore: m.teamAScore,
        teamBScore: m.teamBScore,
        winnerTeam: m.winnerTeam,
        startTime: m.startTime,
        endTime: m.endTime,
      };
    });

    await setRtdb(sessionRef, {
      info: {
        id: sIdStr,
        name: session.name,
        type: session.type,
        status: session.status,
        isActive: session.isActive,
        createdAt: session.createdAt,
        startTime: session.startTime,
        endTime: session.endTime,
        weeklySessionId: session.weeklySessionId ? `weekly_${session.weeklySessionId}` : null,
        managerId: session.managerId ? `player_${session.managerId}` : null,
        managerName: session.managerName || null,
        manager2Id: session.manager2Id ? `player_${session.manager2Id}` : null,
        manager2Name: session.manager2Name || null,
        targetScore: session.targetScore || 21,
      },
      courts: courtsMap,
      session_players: joinsMap,
      matches: matchesMap,
    });
  } catch (err) {
    console.warn('Error syncing session to Realtime DB:', err);
  }
}

/**
 * Helper to sync club details to Firebase Realtime Database
 */
export async function syncClubDetailsToRealtime(
  clubId: string,
  club: ClubEntity
): Promise<void> {
  try {
    const detailsRef = ref(rtdb, `clubs/${clubId}/details`);
    await setRtdb(detailsRef, {
      id: clubId,
      name: club.name,
      venue: club.venue,
      defaultSessionType: club.defaultSessionType,
      themeColorHex: club.themeColorHex,
      targetScore: club.targetScore,
      contactPerson: club.contactPerson,
      description: club.description,
      createdAt: club.createdAt,
    });
  } catch (err) {
    console.warn('Error syncing club details to Realtime DB:', err);
  }
}

/**
 * Loads entire club state from Firebase Realtime Database directly
 */
export async function loadClubFromRealtime(clubId: string): Promise<ParsedClubState | null> {
  try {
    const clubSnap = await getRtdb(ref(rtdb, `clubs/${clubId}`));
    if (clubSnap.exists()) {
      return parseRtdbClubData(clubSnap.val(), clubId);
    }
    return null;
  } catch (err) {
    console.warn('Error loading club from Realtime DB:', err);
    return null;
  }
}

/**
 * Loads entire club state from Firestore directly
 */
export async function loadClubFromFirestore(clubId: string): Promise<ParsedClubState | null> {
  try {
    // 1. Club Details
    const clubDoc = await doc(db, 'clubs', clubId);
    const clubSnap = await getDocs(collection(db, 'clubs', clubId, 'members'));
    
    // Players
    const players: PlayerEntity[] = [];
    clubSnap.forEach((d) => {
      const data = d.data() as PlayerEntity;
      players.push(data);
    });
    players.sort((a, b) => a.id - b.id);

    // Court Masters
    const courtMasters: CourtMasterEntity[] = [];
    const cmSnap = await getDocs(collection(db, 'clubs', clubId, 'court_master'));
    cmSnap.forEach((d) => {
      courtMasters.push(d.data() as CourtMasterEntity);
    });
    courtMasters.sort((a, b) => a.id - b.id);

    // Session Managers
    const sessionManagers: SessionManagerEntity[] = [];
    const smSnap = await getDocs(collection(db, 'clubs', clubId, 'session_managers'));
    smSnap.forEach((d) => {
      sessionManagers.push(d.data() as SessionManagerEntity);
    });
    sessionManagers.sort((a, b) => a.id - b.id);

    // Weekly Sessions
    const weeklySessions: WeeklySessionEntity[] = [];
    const weeklyMembersMap: Record<number, number[]> = {};
    const weeklyCourtsMap: Record<number, CourtEntity[]> = {};
    const wsSnap = await getDocs(collection(db, 'clubs', clubId, 'weekly_sessions'));
    for (const wsDoc of wsSnap.docs) {
      const ws = wsDoc.data() as WeeklySessionEntity;
      weeklySessions.push(ws);

      // Members in weekly
      const wmSnap = await getDocs(collection(db, 'clubs', clubId, 'weekly_sessions', wsDoc.id, 'members'));
      const mList: number[] = [];
      wmSnap.forEach((md) => {
        const mData = md.data();
        if (mData.memberId != null) mList.push(Number(mData.memberId));
      });
      weeklyMembersMap[ws.id] = mList;

      // Courts in weekly
      const wcSnap = await getDocs(collection(db, 'clubs', clubId, 'weekly_sessions', wsDoc.id, 'courts'));
      const cList: CourtEntity[] = [];
      wcSnap.forEach((cd) => {
        cList.push(cd.data() as CourtEntity);
      });
      weeklyCourtsMap[ws.id] = cList;
    }

    // Sessions & Subcollections
    const sessions: SessionEntity[] = [];
    const allCourtsMap: Record<number, CourtEntity[]> = {};
    const allMatchesMap: Record<number, MatchEntity[]> = {};
    const allJoinsMap: Record<number, SessionPlayerJoinEntity[]> = {};

    const sSnap = await getDocs(collection(db, 'clubs', clubId, 'sessions'));
    for (const sDoc of sSnap.docs) {
      const s = sDoc.data() as SessionEntity;
      sessions.push(s);

      // Courts
      const cSnap = await getDocs(collection(db, 'clubs', clubId, 'sessions', sDoc.id, 'courts'));
      const sCourts: CourtEntity[] = [];
      cSnap.forEach((cd) => sCourts.push(cd.data() as CourtEntity));
      allCourtsMap[s.id] = sCourts;

      // Joins
      const jSnap = await getDocs(collection(db, 'clubs', clubId, 'sessions', sDoc.id, 'session_players'));
      const sJoins: SessionPlayerJoinEntity[] = [];
      jSnap.forEach((jd) => sJoins.push(jd.data() as SessionPlayerJoinEntity));
      allJoinsMap[s.id] = sJoins;

      // Matches
      const mSnap = await getDocs(collection(db, 'clubs', clubId, 'sessions', sDoc.id, 'matches'));
      const sMatches: MatchEntity[] = [];
      mSnap.forEach((md) => sMatches.push(md.data() as MatchEntity));
      sMatches.sort((a, b) => a.matchNumber - b.matchNumber);
      allMatchesMap[s.id] = sMatches;
    }
    sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Get club detail doc
    let clubDetails: ClubEntity | null = null;
    try {
      const cdSnap = await getDocs(collection(db, 'clubs'));
      const targetDoc = cdSnap.docs.find((d) => d.id === clubId);
      if (targetDoc) {
        clubDetails = targetDoc.data() as ClubEntity;
      }
    } catch (e) {
      console.warn('Could not load club detail doc:', e);
    }

    return {
      clubDetails: clubDetails || INITIAL_CLUB,
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
    };
  } catch (err) {
    console.warn('Error loading club from Firestore:', err);
    return null;
  }
}

/**
 * Local cache persistence helpers for seamless offline/instant recovery
 */
export function saveClubStateToLocal(clubId: string, state: ParsedClubState): void {
  try {
    localStorage.setItem(`badminton_club_state_${clubId}`, JSON.stringify(state));
  } catch (e) {
    console.warn('LocalStorage save note:', e);
  }
}

export function loadClubStateFromLocal(clubId: string): ParsedClubState | null {
  try {
    const raw = localStorage.getItem(`badminton_club_state_${clubId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('LocalStorage load note:', e);
  }
  return null;
}

/**
 * Seeds initial mock data if both Realtime DB and Firestore are completely empty
 */
export async function seedInitialDataIfEmpty(clubId: string = DEFAULT_CLUB_ID): Promise<void> {
  try {
    // Check Realtime Database first
    const rtdbClubSnap = await getRtdb(ref(rtdb, `clubs/${clubId}/details`));
    if (!rtdbClubSnap.exists()) {
      // Seed Realtime DB
      await syncClubDetailsToRealtime(clubId, INITIAL_CLUB);
      
      const membersMap: Record<string, any> = {};
      INITIAL_PLAYERS.forEach((p) => {
        membersMap[`player_${p.id}`] = {
          id: `player_${p.id}`,
          name: p.name,
          gender: p.gender,
          isPAYG: p.isPAYG,
          createdAt: p.createdAt,
        };
      });
      await setRtdb(ref(rtdb, `clubs/${clubId}/members`), membersMap);

      const managersMap: Record<string, any> = {};
      INITIAL_SESSION_MANAGERS.forEach((m) => {
        managersMap[`manager_${m.id}`] = {
          id: `manager_${m.id}`,
          name: m.name,
          email: m.email,
          inviteStatus: m.inviteStatus,
          createdAt: m.createdAt,
        };
      });
      await setRtdb(ref(rtdb, `clubs/${clubId}/session_managers`), managersMap);

      const cmMap: Record<string, any> = {};
      INITIAL_COURT_MASTERS.forEach((cm) => {
        cmMap[`court_${cm.id}`] = {
          id: `court_${cm.id}`,
          name: cm.name,
          createdAt: cm.createdAt,
        };
      });
      await setRtdb(ref(rtdb, `clubs/${clubId}/court_master`), cmMap);

      const wsMap: Record<string, any> = {};
      INITIAL_WEEKLY_SESSIONS.forEach((ws) => {
        wsMap[`weekly_${ws.id}`] = {
          info: {
            id: `weekly_${ws.id}`,
            name: ws.name,
            dayOfWeek: ws.dayOfWeek,
            time: ws.time,
            type: ws.type,
            managerId: ws.managerId ? `player_${ws.managerId}` : null,
            createdAt: ws.createdAt,
          },
        };
      });
      await setRtdb(ref(rtdb, `clubs/${clubId}/weekly_sessions`), wsMap);

      // Register in user_club_index
      await registerUserClubAssociation({
        email: 'Ashish.Verma.UK@gmail.com',
        clubId: clubId,
        clubName: INITIAL_CLUB.name,
        role: 'CLUB_MANAGER',
        venue: INITIAL_CLUB.venue,
        updatedAt: Date.now(),
      });
    }
  } catch (error) {
    console.error('Error during Realtime DB data check/seed:', error);
  }
}
