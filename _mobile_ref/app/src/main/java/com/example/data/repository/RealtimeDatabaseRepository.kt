package com.example.data.repository

import android.content.Context
import android.util.Log
import com.example.BadmintonApplication
import com.example.data.database.BadmintonDao
import com.example.data.database.ClubEntity
import com.example.data.database.CourtEntity
import com.example.data.database.MatchEntity
import com.example.data.database.PlayerEntity
import com.example.data.database.SessionEntity
import com.example.data.database.SessionPlayerJoinEntity
import com.example.data.database.WeeklySessionCourtEntity
import com.example.data.database.WeeklySessionEntity
import com.example.data.database.WeeklySessionMemberEntity
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class RealtimeDatabaseDiagnostic(
    val isInitialized: Boolean,
    val databaseUrl: String,
    val userId: String?,
    val userEmail: String?,
    val writeSuccess: Boolean,
    val writeError: String?,
    val readSuccess: Boolean,
    val readError: String?,
    val recommendation: String?
)

data class UserClubAssociation(
    val email: String = "",
    val clubId: String = "",
    val clubName: String = "",
    val role: String = "SESSION_MANAGER", // "CLUB_MANAGER" or "SESSION_MANAGER"
    val managerId: Int? = null,
    val managerName: String? = null,
    val ownerUid: String? = null,
    val venue: String = "",
    val updatedAt: Long = System.currentTimeMillis()
)

fun sanitizeEmailKey(email: String): String =
    email.lowercase().trim()
        .replace(".", "_")
        .replace("@", "_at_")
        .replace("[^a-z0-9_]".toRegex(), "_")

/**
 * Firebase Realtime Database Data Models & Repository
 *
 * Realtime Database JSON Hierarchy:
 * /clubs/{clubId}
 *    ├── /details
 *    ├── /members/{playerId}
 *    ├── /sessions/{sessionId}
 *    │      ├── /session_players/{playerId}
 *    │      ├── /courts/{courtId}
 *    │      └── /matches/{matchId}
 *    ├── /weekly_sessions/{weeklyId}
 *    │      ├── /members/{playerId}
 *    │      └── /courts/{courtId}
 *    └── /leaderboard/{playerId}
 */

class RealtimeDatabaseRepository {

    fun getEffectiveDatabaseUrl(): String {
        val ctx = BadmintonApplication.getAppContext()
        val customUrl = ctx?.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
            ?.getString("custom_rtdb_url", null)
            ?.takeIf { it.isNotBlank() }
        if (!customUrl.isNullOrEmpty()) return customUrl

        val configuredUrl = try {
            val field = com.example.BuildConfig::class.java.getField("FIREBASE_DATABASE_URL")
            (field.get(null) as? String)?.takeIf { it.isNotBlank() }
        } catch (e: Exception) {
            null
        }
        if (!configuredUrl.isNullOrEmpty()) return configuredUrl

        val projectId = try {
            val field = com.example.BuildConfig::class.java.getField("FIREBASE_PROJECT_ID")
            (field.get(null) as? String)?.takeIf { it.isNotBlank() }
        } catch (e: Exception) {
            null
        } ?: "badmintonsessionmanager"

        return "https://$projectId-default-rtdb.firebaseio.com"
    }

    fun setCustomDatabaseUrl(url: String?) {
        val ctx = BadmintonApplication.getAppContext()
        ctx?.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
            ?.edit()
            ?.putString("custom_rtdb_url", url?.trim())
            ?.apply()
    }

    private fun getDb(): FirebaseDatabase? {
        val url = getEffectiveDatabaseUrl()
        return try {
            val db = FirebaseDatabase.getInstance(url)
            try { db.goOnline() } catch (_: Exception) {}
            db
        } catch (e: Exception) {
            try {
                val db = FirebaseDatabase.getInstance()
                try { db.goOnline() } catch (_: Exception) {}
                db
            } catch (e2: Exception) {
                val ctx = com.example.BadmintonApplication.getAppContext()
                if (ctx != null) {
                    com.example.BadmintonApplication.ensureFirebaseInitialized(ctx)
                    try {
                        val db = FirebaseDatabase.getInstance(url)
                        try { db.goOnline() } catch (_: Exception) {}
                        db
                    } catch (e3: Exception) {
                        try {
                            val db = FirebaseDatabase.getInstance()
                            try { db.goOnline() } catch (_: Exception) {}
                            db
                        } catch (e4: Exception) {
                            Log.w("RealtimeDatabaseRepository", "FirebaseDatabase unavailable after init: ${e4.message}")
                            null
                        }
                    }
                } else {
                    Log.w("RealtimeDatabaseRepository", "Firebase not initialized: ${e.message}")
                    null
                }
            }
        }
    }

    suspend fun runDiagnostics(clubId: String): RealtimeDatabaseDiagnostic = withContext(Dispatchers.IO) {
        val db = getDb()
        val auth = FirebaseAuth.getInstance()
        val currentUser = auth.currentUser
        val effectiveUrl = getEffectiveDatabaseUrl()

        if (db == null) {
            return@withContext RealtimeDatabaseDiagnostic(
                isInitialized = false,
                databaseUrl = effectiveUrl,
                userId = currentUser?.uid,
                userEmail = currentUser?.email,
                writeSuccess = false,
                writeError = "Firebase Realtime Database instance could not be created. Check Firebase initialization.",
                readSuccess = false,
                readError = "Database unavailable",
                recommendation = "Verify that google-services.json is present and the database URL ($effectiveUrl) is valid."
            )
        }

        var writeOk = false
        var writeErr: String? = null

        var readOk = false
        var readErr: String? = null

        val targetPath = "clubs/$clubId/_connection_test"
        val testRef = db.reference.child(targetPath)

        // 1. Direct server write test with explicit callback
        try {
            suspendCancellableCoroutine<Unit> { cont ->
                val payload = mapOf(
                    "pingAt" to System.currentTimeMillis(),
                    "user" to (currentUser?.email ?: "anonymous"),
                    "device" to android.os.Build.MODEL
                )
                testRef.setValue(payload) { error, _ ->
                    if (error != null) {
                        writeErr = "DatabaseError: ${error.message} (code ${error.code}: ${error.details})"
                        cont.resume(Unit)
                    } else {
                        writeOk = true
                        cont.resume(Unit)
                    }
                }

                // 8 second test timeout
                val timer = java.util.Timer()
                timer.schedule(object : java.util.TimerTask() {
                    override fun run() {
                        if (!cont.isCompleted) {
                            writeErr = "Write timed out after 8s. WebSocket could not establish connection to $effectiveUrl. Check database region URL."
                            cont.resume(Unit)
                        }
                    }
                }, 8000L)

                cont.invokeOnCancellation { timer.cancel() }
            }
        } catch (e: Exception) {
            writeErr = e.message ?: "Unknown write exception"
        }

        // 2. Direct read test
        try {
            suspendCancellableCoroutine<Unit> { cont ->
                testRef.addListenerForSingleValueEvent(object : ValueEventListener {
                    override fun onDataChange(snapshot: DataSnapshot) {
                        readOk = true
                        cont.resume(Unit)
                    }

                    override fun onCancelled(error: DatabaseError) {
                        readErr = "Read cancelled: ${error.message} (code ${error.code})"
                        cont.resume(Unit)
                    }
                })

                val timer = java.util.Timer()
                timer.schedule(object : java.util.TimerTask() {
                    override fun run() {
                        if (!cont.isCompleted) {
                            readErr = "Read timed out after 8s."
                            cont.resume(Unit)
                        }
                    }
                }, 8000L)

                cont.invokeOnCancellation { timer.cancel() }
            }
        } catch (e: Exception) {
            readErr = e.message ?: "Unknown read exception"
        }

        // Generate specific diagnosis & recommendation
        val recommendation = when {
            writeOk -> "Connection and Security Rules are 100% WORKING! Data is actively writing to $targetPath in Realtime Database."
            writeErr?.contains("Permission denied", ignoreCase = true) == true ->
                "SECURITY RULES ISSUE: Firebase Realtime Database is rejecting writes with 'Permission Denied'. In Firebase Console -> Realtime Database -> Rules tab, set '.read': true, '.write': true (or allow auth != null)."
            writeErr?.contains("timed out", ignoreCase = true) == true || writeErr?.contains("WebSocket", ignoreCase = true) == true ->
                "URL / REGION MISMATCH: Realtime Database did not respond at $effectiveUrl. If you created your Realtime Database in Europe (europe-west1) or Asia (asia-southeast1), enter your exact Database URL from the top of the Firebase Console in the settings dialog."
            else -> "Review the error details and ensure the Realtime Database has been created in your Firebase Console under project 'badmintonsessionmanager'."
        }

        RealtimeDatabaseDiagnostic(
            isInitialized = true,
            databaseUrl = effectiveUrl,
            userId = currentUser?.uid,
            userEmail = currentUser?.email,
            writeSuccess = writeOk,
            writeError = writeErr,
            readSuccess = readOk,
            readError = readErr,
            recommendation = recommendation
        )
    }

    /**
     * Resilient write helper that writes locally immediately and prevents timeout failures
     * if the remote WebSocket acknowledgement is delayed.
     */
    private suspend fun DatabaseReference.setValueSafely(value: Any?, timeoutMs: Long = 7_000L): Unit {
        return suspendCancellableCoroutine { continuation ->
            var completed = false
            setValue(value) { error, _ ->
                if (!completed) {
                    completed = true
                    if (error != null) {
                        Log.e("RealtimeDatabaseRepository", "Database write error at $path: ${error.message}")
                        continuation.resumeWithException(error.toException())
                    } else {
                        Log.d("RealtimeDatabaseRepository", "Database write committed on server for $path")
                        continuation.resume(Unit)
                    }
                }
            }

            val timer = java.util.Timer()
            timer.schedule(object : java.util.TimerTask() {
                override fun run() {
                    if (!completed) {
                        completed = true
                        Log.i("RealtimeDatabaseRepository", "Realtime Database write locally persisted & enqueued for sync ($path)")
                        continuation.resume(Unit)
                    }
                }
            }, timeoutMs)

            continuation.invokeOnCancellation {
                timer.cancel()
            }
        }
    }

    private suspend fun DatabaseReference.removeValueSafely(timeoutMs: Long = 7_000L): Unit =
        setValueSafely(null, timeoutMs)

    fun isAvailable(): Boolean {
        return try {
            getDb() != null
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Saves or updates Club metadata in Firebase Realtime Database
     */
    suspend fun saveClub(club: ClubEntity, customClubId: String? = null): Result<Unit> = withContext(Dispatchers.IO) {
        val db = getDb() ?: return@withContext Result.failure(IllegalStateException("Realtime Database unavailable"))
        try {
            val clubId = customClubId ?: "club_${club.id}"
            val doc = FirestoreClub(
                id = clubId,
                name = club.name,
                venue = club.venue,
                defaultSessionType = club.defaultSessionType,
                themeColorHex = club.themeColorHex,
                targetScore = club.targetScore,
                contactPerson = club.contactPerson,
                description = club.description,
                createdAt = club.createdAt
            )
            db.reference.child("clubs").child(clubId).child("details").setValueSafely(doc)
            Log.d("RealtimeDatabaseRepository", "Saved club details to Realtime Database for $clubId")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("RealtimeDatabaseRepository", "Error saving club to Realtime DB: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Saves or updates player master pool for a specific club in Realtime Database
     */
    suspend fun savePlayers(clubId: String, players: List<PlayerEntity>): Result<Unit> = withContext(Dispatchers.IO) {
        val db = getDb() ?: return@withContext Result.failure(IllegalStateException("Realtime Database unavailable"))
        try {
            val membersRef = db.reference.child("clubs").child(clubId).child("members")
            val membersMap = players.associate { p ->
                val pId = "player_${p.id}"
                pId to FirestorePlayer(
                    id = pId,
                    name = p.name,
                    gender = p.gender,
                    isPAYG = p.isPAYG,
                    createdAt = p.createdAt
                )
            }
            membersRef.setValueSafely(membersMap)
            Log.d("RealtimeDatabaseRepository", "Saved ${players.size} players to Realtime Database for club $clubId")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("RealtimeDatabaseRepository", "Error saving players to Realtime DB: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Synchronizes all club members, replacing node in Realtime DB
     */
    suspend fun syncMembers(clubId: String, players: List<PlayerEntity>): Result<Unit> = withContext(Dispatchers.IO) {
        val db = getDb() ?: return@withContext Result.failure(IllegalStateException("Realtime Database unavailable"))
        try {
            val membersRef = db.reference.child("clubs").child(clubId).child("members")
            val membersMap = players.associate { p ->
                val pId = "player_${p.id}"
                pId to FirestorePlayer(
                    id = pId,
                    name = p.name,
                    gender = p.gender,
                    isPAYG = p.isPAYG,
                    createdAt = p.createdAt
                )
            }
            membersRef.setValueSafely(membersMap)
            Log.d("RealtimeDatabaseRepository", "Synced ${players.size} members in Realtime DB for club $clubId")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("RealtimeDatabaseRepository", "Error syncing members in Realtime DB: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Synchronizes all club session managers in Realtime DB
     */
    suspend fun syncSessionManagers(clubId: String, managers: List<com.example.data.database.SessionManagerEntity>): Result<Unit> = withContext(Dispatchers.IO) {
        val db = getDb() ?: return@withContext Result.failure(IllegalStateException("Realtime Database unavailable"))
        try {
            val managersRef = db.reference.child("clubs").child(clubId).child("session_managers")
            val managersMap = managers.associate { m ->
                val mId = "manager_${m.id}"
                mId to FirestoreSessionManager(
                    id = mId,
                    name = m.name,
                    email = m.email,
                    inviteStatus = m.inviteStatus,
                    createdAt = m.createdAt
                )
            }
            managersRef.setValueSafely(managersMap)
            Log.d("RealtimeDatabaseRepository", "Synced ${managers.size} session managers in Realtime DB for club $clubId")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("RealtimeDatabaseRepository", "Error syncing session managers in Realtime DB: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Synchronizes session details, players, courts, and matches to Realtime Database in 1 network operation
     */
    suspend fun syncSessionToRealtimeDatabase(
        clubId: String,
        session: SessionEntity,
        joins: List<SessionPlayerJoinEntity>,
        courts: List<CourtEntity>,
        matches: List<MatchEntity>,
        players: List<PlayerEntity>
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val db = getDb() ?: return@withContext Result.failure(IllegalStateException("Realtime Database unavailable"))
        try {
            val sessionIdStr = "session_${session.id}"
            val sessionRef = db.reference.child("clubs").child(clubId).child("sessions").child(sessionIdStr)

            val sessionDoc = FirestoreSession(
                id = sessionIdStr,
                name = session.name,
                type = session.type,
                status = session.status,
                isActive = session.isActive,
                createdAt = session.createdAt,
                startTime = session.startTime,
                endTime = session.endTime,
                weeklySessionId = session.weeklySessionId?.let { "weekly_$it" },
                managerId = session.managerId?.let { "player_$it" }
            )

            val playersMap = joins.associate { j ->
                val pId = "player_${j.playerId}"
                pId to FirestoreSessionPlayer(
                    playerId = pId,
                    isPaused = j.isPaused,
                    eligibleCourtIds = j.eligibleCourtIds,
                    isPAYG = j.isPAYG,
                    adjustedGames = j.adjustedGames,
                    pausedAtMatchCount = j.pausedAtMatchCount
                )
            }

            val courtsMap = courts.associate { c ->
                val cId = "court_${c.id}"
                cId to FirestoreCourt(
                    id = cId,
                    name = c.name,
                    gameType = c.gameType
                )
            }

            val matchesMap = matches.associate { m ->
                val mId = "match_${m.id}"
                mId to FirestoreMatch(
                    id = mId,
                    matchNumber = m.matchNumber,
                    courtId = "court_${m.courtId}",
                    teamAPlayer1Id = "player_${m.teamAPlayer1Id}",
                    teamAPlayer2Id = m.teamAPlayer2Id?.let { "player_$it" },
                    teamBPlayer1Id = "player_${m.teamBPlayer1Id}",
                    teamBPlayer2Id = m.teamBPlayer2Id?.let { "player_$it" },
                    teamAScore = m.teamAScore,
                    teamBScore = m.teamBScore,
                    winnerTeam = m.winnerTeam,
                    startTime = m.startTime,
                    endTime = m.endTime
                )
            }

            val sessionPayload = mapOf(
                "info" to sessionDoc,
                "session_players" to playersMap,
                "courts" to courtsMap,
                "matches" to matchesMap
            )

            sessionRef.setValueSafely(sessionPayload)
            Log.d("RealtimeDatabaseRepository", "Synced session $sessionIdStr to Realtime Database in single batch")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("RealtimeDatabaseRepository", "Error syncing session to Realtime DB: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Atomically synchronizes the ENTIRE club state (details, members, session managers,
     * weekly sessions, historical sessions, and leaderboard) to Firebase Realtime Database
     * in a single high-performance network write operation.
     */
    suspend fun syncEntireClubInSingleBatch(
        clubId: String,
        club: ClubEntity,
        players: List<PlayerEntity>,
        sessionManagers: List<com.example.data.database.SessionManagerEntity>,
        weeklySessions: List<WeeklySessionEntity>,
        allWeeklyMembers: List<WeeklySessionMemberEntity>,
        getWeeklyCourts: suspend (Int) -> List<WeeklySessionCourtEntity>,
        sessionsWithDetails: List<Triple<SessionEntity, Pair<List<SessionPlayerJoinEntity>, List<CourtEntity>>, List<MatchEntity>>>,
        playerStats: List<PlayerStats>
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val db = getDb() ?: return@withContext Result.failure(IllegalStateException("Realtime Database unavailable"))
        try {
            val clubDoc = FirestoreClub(
                id = clubId,
                name = club.name,
                venue = club.venue,
                defaultSessionType = club.defaultSessionType,
                themeColorHex = club.themeColorHex,
                targetScore = club.targetScore,
                contactPerson = club.contactPerson,
                description = club.description,
                createdAt = club.createdAt
            )

            val membersMap = players.associate { p ->
                val pId = "player_${p.id}"
                pId to FirestorePlayer(
                    id = pId,
                    name = p.name,
                    gender = p.gender,
                    isPAYG = p.isPAYG,
                    createdAt = p.createdAt
                )
            }

            val managersMap = sessionManagers.associate { m ->
                val mId = "manager_${m.id}"
                mId to FirestoreSessionManager(
                    id = mId,
                    name = m.name,
                    email = m.email,
                    inviteStatus = m.inviteStatus,
                    createdAt = m.createdAt
                )
            }

            val weeklyMap = mutableMapOf<String, Any?>()
            for (ws in weeklySessions) {
                val wsIdStr = "weekly_${ws.id}"
                val wsDoc = FirestoreWeeklySession(
                    id = wsIdStr,
                    name = ws.name,
                    dayOfWeek = ws.dayOfWeek,
                    time = ws.time,
                    type = ws.type,
                    managerId = ws.managerId?.let { "player_$it" },
                    managerName = ws.managerName,
                    manager2Id = ws.manager2Id?.let { "player_$it" },
                    manager2Name = ws.manager2Name,
                    createdAt = ws.createdAt,
                    targetScore = ws.targetScore
                )
                val membersForWs = allWeeklyMembers.filter { it.weeklySessionId == ws.id }
                val membersForWsMap = membersForWs.associate { m ->
                    val mId = "member_${m.memberId}"
                    mId to FirestoreWeeklySessionMember(playerId = "player_${m.memberId}")
                }
                val courtsForWs = getWeeklyCourts(ws.id)
                val courtsForWsMap = courtsForWs.associate { c ->
                    val cId = "court_${c.id}"
                    cId to FirestoreWeeklySessionCourt(id = cId, name = c.name, gameType = c.gameType)
                }
                weeklyMap[wsIdStr] = mapOf(
                    "info" to wsDoc,
                    "members" to membersForWsMap,
                    "courts" to courtsForWsMap
                )
            }

            val sessionsMap = mutableMapOf<String, Any?>()
            for ((session, joinsAndCourts, matches) in sessionsWithDetails) {
                val sIdStr = "session_${session.id}"
                val sDoc = FirestoreSession(
                    id = sIdStr,
                    name = session.name,
                    type = session.type,
                    status = session.status,
                    isActive = session.isActive,
                    createdAt = session.createdAt,
                    startTime = session.startTime,
                    endTime = session.endTime,
                    weeklySessionId = session.weeklySessionId?.let { "weekly_$it" },
                    managerId = session.managerId?.let { "player_$it" },
                    managerName = session.managerName,
                    manager2Id = session.manager2Id?.let { "player_$it" },
                    manager2Name = session.manager2Name,
                    targetScore = session.targetScore
                )
                val joinsMap = joinsAndCourts.first.associate { j ->
                    val pId = "player_${j.playerId}"
                    pId to FirestoreSessionPlayer(
                        playerId = pId,
                        isPaused = j.isPaused,
                        eligibleCourtIds = j.eligibleCourtIds,
                        isPAYG = j.isPAYG,
                        adjustedGames = j.adjustedGames,
                        pausedAtMatchCount = j.pausedAtMatchCount
                    )
                }
                val courtsMap = joinsAndCourts.second.associate { c ->
                    val cId = "court_${c.id}"
                    cId to FirestoreCourt(id = cId, name = c.name, gameType = c.gameType)
                }
                val matchesMap = matches.associate { m ->
                    val mId = "match_${m.id}"
                    mId to FirestoreMatch(
                        id = mId,
                        matchNumber = m.matchNumber,
                        courtId = "court_${m.courtId}",
                        teamAPlayer1Id = "player_${m.teamAPlayer1Id}",
                        teamAPlayer2Id = m.teamAPlayer2Id?.let { "player_$it" },
                        teamBPlayer1Id = "player_${m.teamBPlayer1Id}",
                        teamBPlayer2Id = m.teamBPlayer2Id?.let { "player_$it" },
                        teamAScore = m.teamAScore,
                        teamBScore = m.teamBScore,
                        winnerTeam = m.winnerTeam,
                        startTime = m.startTime,
                        endTime = m.endTime
                    )
                }
                sessionsMap[sIdStr] = mapOf(
                    "info" to sDoc,
                    "session_players" to joinsMap,
                    "courts" to courtsMap,
                    "matches" to matchesMap
                )
            }

            val leaderboardMap = playerStats.associate { stat ->
                val pIdStr = "player_${stat.playerId}"
                pIdStr to FirestoreLeaderboardEntry(
                    playerId = pIdStr,
                    name = stat.name,
                    gender = stat.gender,
                    gamesPlayed = stat.gamesPlayed,
                    gamesWon = stat.gamesWon,
                    gamesLost = stat.gamesLost,
                    winPercentage = stat.winPercentage,
                    totalPointsScored = stat.totalPointsScored,
                    totalPointsConceded = stat.totalPointsConceded,
                    averagePointsPerGame = stat.averagePointsPerGame,
                    maxConsecutiveWins = stat.consecutiveWins,
                    maxConsecutiveLosses = stat.consecutiveLosses
                )
            }

            val fullPayload = mapOf<String, Any?>(
                "details" to clubDoc,
                "members" to membersMap,
                "session_managers" to managersMap,
                "weekly_sessions" to weeklyMap,
                "sessions" to sessionsMap,
                "leaderboard" to leaderboardMap,
                "lastSyncedAt" to System.currentTimeMillis()
            )

            db.reference.child("clubs").child(clubId).setValueSafely(fullPayload)
            Log.d("RealtimeDatabaseRepository", "Synchronized full club $clubId in single batch successfully")

            // Index club manager and all session managers in user_club_index
            try {
                val currentAuthEmail = FirebaseAuth.getInstance().currentUser?.email
                val clubManagerEmail = if (club.description.contains("@")) {
                    club.description.trim()
                } else {
                    currentAuthEmail
                }
                if (!clubManagerEmail.isNullOrBlank()) {
                    registerUserClubAssociation(
                        UserClubAssociation(
                            email = clubManagerEmail,
                            clubId = clubId,
                            clubName = club.name,
                            role = "CLUB_MANAGER",
                            venue = club.venue,
                            updatedAt = System.currentTimeMillis()
                        )
                    )
                }

                // Index each session manager
                sessionManagers.forEach { sm ->
                    if (sm.email.isNotBlank()) {
                        registerUserClubAssociation(
                            UserClubAssociation(
                                email = sm.email.trim(),
                                clubId = clubId,
                                clubName = club.name,
                                role = "SESSION_MANAGER",
                                managerId = sm.id,
                                managerName = sm.name,
                                venue = club.venue,
                                updatedAt = sm.createdAt
                            )
                        )
                    }
                }
            } catch (e: Exception) {
                Log.w("RealtimeDatabaseRepository", "Warning indexing user_club_index: ${e.message}")
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("RealtimeDatabaseRepository", "Error during single-batch full club sync: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Synchronizes weekly sessions, members, and courts in Realtime Database
     */
    suspend fun syncWeeklySessions(
        clubId: String,
        weeklySessions: List<WeeklySessionEntity>,
        allMembers: List<WeeklySessionMemberEntity>,
        getWeeklyCourts: suspend (Int) -> List<WeeklySessionCourtEntity>
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val db = getDb() ?: return@withContext Result.failure(IllegalStateException("Realtime Database unavailable"))
        try {
            val weeklyRef = db.reference.child("clubs").child(clubId).child("weekly_sessions")
            val weeklyMap = mutableMapOf<String, Any?>()

            for (ws in weeklySessions) {
                val wsIdStr = "weekly_${ws.id}"
                val wsDoc = FirestoreWeeklySession(
                    id = wsIdStr,
                    name = ws.name,
                    dayOfWeek = ws.dayOfWeek,
                    time = ws.time,
                    type = ws.type,
                    managerId = ws.managerId?.let { "player_$it" },
                    managerName = ws.managerName,
                    manager2Id = ws.manager2Id?.let { "player_$it" },
                    manager2Name = ws.manager2Name,
                    createdAt = ws.createdAt
                )

                val membersForWs = allMembers.filter { it.weeklySessionId == ws.id }
                val membersMap = membersForWs.associate { m ->
                    val mId = "member_${m.memberId}"
                    mId to FirestoreWeeklySessionMember(playerId = "player_${m.memberId}")
                }

                val courtsForWs = getWeeklyCourts(ws.id)
                val courtsMap = courtsForWs.associate { c ->
                    val cId = "court_${c.id}"
                    cId to FirestoreWeeklySessionCourt(id = cId, name = c.name, gameType = c.gameType)
                }

                weeklyMap[wsIdStr] = mapOf(
                    "info" to wsDoc,
                    "members" to membersMap,
                    "courts" to courtsMap
                )
            }

            weeklyRef.setValueSafely(weeklyMap)
            Log.d("RealtimeDatabaseRepository", "Synced ${weeklySessions.size} weekly sessions in Realtime DB")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("RealtimeDatabaseRepository", "Error syncing weekly sessions in Realtime DB: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Synchronizes historical player leaderboard and statistics in Realtime Database
     */
    suspend fun syncLeaderboard(
        clubId: String,
        playerStats: List<PlayerStats>
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val db = getDb() ?: return@withContext Result.failure(IllegalStateException("Realtime Database unavailable"))
        try {
            val leaderboardRef = db.reference.child("clubs").child(clubId).child("leaderboard")
            val leaderboardMap = playerStats.associate { stat ->
                val pIdStr = "player_${stat.playerId}"
                pIdStr to FirestoreLeaderboardEntry(
                    playerId = pIdStr,
                    name = stat.name,
                    gender = stat.gender,
                    gamesPlayed = stat.gamesPlayed,
                    gamesWon = stat.gamesWon,
                    gamesLost = stat.gamesLost,
                    winPercentage = stat.winPercentage,
                    totalPointsScored = stat.totalPointsScored,
                    totalPointsConceded = stat.totalPointsConceded,
                    averagePointsPerGame = stat.averagePointsPerGame,
                    maxConsecutiveWins = stat.consecutiveWins,
                    maxConsecutiveLosses = stat.consecutiveLosses
                )
            }

            leaderboardRef.setValueSafely(leaderboardMap)
            Log.d("RealtimeDatabaseRepository", "Synced leaderboard for ${playerStats.size} players in Realtime DB")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("RealtimeDatabaseRepository", "Error syncing leaderboard in Realtime DB: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Restores all club details, members, weekly sessions, and historical sessions from Realtime Database
     */
    suspend fun restoreClubData(
        clubId: String,
        dao: BadmintonDao
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        val db = getDb() ?: return@withContext Result.failure(IllegalStateException("Realtime Database unavailable"))
        try {
            val clubSnap = withTimeoutOrNull(10_000L) {
                try { db.goOnline() } catch (_: Exception) {}
                db.reference.child("clubs").child(clubId).get().await()
            } ?: return@withContext Result.success(false)

            if (!clubSnap.exists()) {
                return@withContext Result.success(false)
            }

            // Restore Club details
            val detailsSnap = clubSnap.child("details")
            if (detailsSnap.exists()) {
                val name = detailsSnap.child("name").getValue(String::class.java) ?: "Badminton Club"
                val venue = detailsSnap.child("venue").getValue(String::class.java) ?: ""
                val defaultSessionType = detailsSnap.child("defaultSessionType").getValue(String::class.java) ?: "DOUBLES"
                val themeColorHex = detailsSnap.child("themeColorHex").getValue(String::class.java) ?: "#0284C7"
                val targetScore = detailsSnap.child("targetScore").getValue(Int::class.java) ?: 21
                val contactPerson = detailsSnap.child("contactPerson").getValue(String::class.java) ?: ""
                val description = detailsSnap.child("description").getValue(String::class.java) ?: ""
                val createdAt = detailsSnap.child("createdAt").getValue(Long::class.java) ?: System.currentTimeMillis()

                dao.insertClubDetails(
                    ClubEntity(
                        id = 1,
                        name = name,
                        venue = venue,
                        defaultSessionType = defaultSessionType,
                        themeColorHex = themeColorHex,
                        targetScore = targetScore,
                        contactPerson = contactPerson,
                        description = description,
                        createdAt = createdAt
                    )
                )
            }

            // Restore Members
            val membersSnap = clubSnap.child("members")
            for (mChild in membersSnap.children) {
                val pIdStr = mChild.child("id").getValue(String::class.java) ?: mChild.key ?: ""
                val rawId = pIdStr.removePrefix("player_").toIntOrNull()
                val name = mChild.child("name").getValue(String::class.java) ?: ""
                val gender = mChild.child("gender").getValue(String::class.java) ?: "MALE"
                val isPAYG = mChild.child("isPAYG").getValue(Boolean::class.java) ?: false
                val createdAt = mChild.child("createdAt").getValue(Long::class.java) ?: System.currentTimeMillis()

                if (name.isNotBlank()) {
                    val entity = if (rawId != null) {
                        PlayerEntity(id = rawId, name = name, gender = gender, isPAYG = isPAYG, createdAt = createdAt)
                    } else {
                        PlayerEntity(name = name, gender = gender, isPAYG = isPAYG, createdAt = createdAt)
                    }
                    dao.insertPlayer(entity)
                }
            }

            // Restore Session Managers
            val managersSnap = clubSnap.child("session_managers")
            for (mChild in managersSnap.children) {
                val mIdStr = mChild.child("id").getValue(String::class.java) ?: mChild.key ?: ""
                val rawId = mIdStr.removePrefix("manager_").toIntOrNull()
                val name = mChild.child("name").getValue(String::class.java) ?: ""
                val email = mChild.child("email").getValue(String::class.java) ?: ""
                val inviteStatus = mChild.child("inviteStatus").getValue(String::class.java) ?: "INVITED"
                val createdAt = mChild.child("createdAt").getValue(Long::class.java) ?: System.currentTimeMillis()

                if (name.isNotBlank() && email.isNotBlank()) {
                    val entity = if (rawId != null) {
                        com.example.data.database.SessionManagerEntity(id = rawId, name = name, email = email, inviteStatus = inviteStatus, createdAt = createdAt)
                    } else {
                        com.example.data.database.SessionManagerEntity(name = name, email = email, inviteStatus = inviteStatus, createdAt = createdAt)
                    }
                    dao.insertSessionManager(entity)
                }
            }

            // Restore Weekly Sessions
            val weeklySnap = clubSnap.child("weekly_sessions")
            for (wsChild in weeklySnap.children) {
                val infoSnap = wsChild.child("info")
                val wsIdStr = infoSnap.child("id").getValue(String::class.java) ?: wsChild.key ?: ""
                val rawWsId = wsIdStr.removePrefix("weekly_").toIntOrNull()
                val name = infoSnap.child("name").getValue(String::class.java) ?: ""
                val dayOfWeek = infoSnap.child("dayOfWeek").getValue(String::class.java) ?: "Monday"
                val time = infoSnap.child("time").getValue(String::class.java) ?: "19:00"
                val type = infoSnap.child("type").getValue(String::class.java) ?: "DOUBLES"
                val managerIdStr = infoSnap.child("managerId").getValue(String::class.java)
                val managerId = managerIdStr?.removePrefix("player_")?.toIntOrNull()
                val managerName = infoSnap.child("managerName").getValue(String::class.java)
                val manager2IdStr = infoSnap.child("manager2Id").getValue(String::class.java)
                val manager2Id = manager2IdStr?.removePrefix("player_")?.toIntOrNull()
                val manager2Name = infoSnap.child("manager2Name").getValue(String::class.java)
                val targetScore = infoSnap.child("targetScore").getValue(Int::class.java) ?: 21
                val createdAt = infoSnap.child("createdAt").getValue(Long::class.java) ?: System.currentTimeMillis()

                if (name.isNotBlank()) {
                    val wsEntity = if (rawWsId != null) {
                        WeeklySessionEntity(
                            id = rawWsId,
                            name = name,
                            dayOfWeek = dayOfWeek,
                            time = time,
                            type = type,
                            managerId = managerId,
                            managerName = managerName,
                            manager2Id = manager2Id,
                            manager2Name = manager2Name,
                            createdAt = createdAt,
                            targetScore = targetScore
                        )
                    } else {
                        WeeklySessionEntity(
                            name = name,
                            dayOfWeek = dayOfWeek,
                            time = time,
                            type = type,
                            managerId = managerId,
                            managerName = managerName,
                            manager2Id = manager2Id,
                            manager2Name = manager2Name,
                            createdAt = createdAt,
                            targetScore = targetScore
                        )
                    }
                    val insertedWsId = dao.insertWeeklySession(wsEntity).toInt()
                    val actualWsId = if (rawWsId != null) rawWsId else insertedWsId

                    // Members
                    val wsMembersSnap = wsChild.child("members")
                    for (mSnap in wsMembersSnap.children) {
                        val mPlayerIdStr = mSnap.child("playerId").getValue(String::class.java) ?: mSnap.key ?: ""
                        val pId = mPlayerIdStr.removePrefix("player_").removePrefix("member_").toIntOrNull()
                        if (pId != null) {
                            dao.insertWeeklySessionMember(WeeklySessionMemberEntity(weeklySessionId = actualWsId, memberId = pId))
                        }
                    }

                    // Courts
                    val wsCourtsSnap = wsChild.child("courts")
                    for (cSnap in wsCourtsSnap.children) {
                        val cIdStr = cSnap.child("id").getValue(String::class.java) ?: cSnap.key ?: ""
                        val rawCourtId = cIdStr.removePrefix("court_").toIntOrNull()
                        val cName = cSnap.child("name").getValue(String::class.java) ?: "Court"
                        val gameType = cSnap.child("gameType").getValue(String::class.java) ?: "DOUBLES"

                        val cEntity = if (rawCourtId != null) {
                            WeeklySessionCourtEntity(id = rawCourtId, weeklySessionId = actualWsId, name = cName, gameType = gameType)
                        } else {
                            WeeklySessionCourtEntity(weeklySessionId = actualWsId, name = cName, gameType = gameType)
                        }
                        dao.insertWeeklySessionCourt(cEntity)
                    }
                }
            }

            // Restore Historical Sessions
            val sessionsSnap = clubSnap.child("sessions")
            for (sChild in sessionsSnap.children) {
                val sInfo = if (sChild.hasChild("info")) sChild.child("info") else sChild
                val sIdStr = sInfo.child("id").getValue(String::class.java) ?: sChild.key ?: ""
                val rawSessionId = sIdStr.removePrefix("session_").toIntOrNull()
                val sName = sInfo.child("name").getValue(String::class.java) ?: "Session"
                val sType = sInfo.child("type").getValue(String::class.java) ?: "DOUBLES"
                val sStatus = sInfo.child("status").getValue(String::class.java) ?: "End"
                val sIsActive = sInfo.child("isActive").getValue(Boolean::class.java) ?: false
                val sCreatedAt = sInfo.child("createdAt").getValue(Long::class.java) ?: System.currentTimeMillis()
                val sStartTime = sInfo.child("startTime").getValue(Long::class.java)
                val sEndTime = sInfo.child("endTime").getValue(Long::class.java)
                val sWeeklyIdStr = sInfo.child("weeklySessionId").getValue(String::class.java)
                val sWeeklyId = sWeeklyIdStr?.removePrefix("weekly_")?.toIntOrNull()
                val sManagerIdStr = sInfo.child("managerId").getValue(String::class.java)
                val sManagerId = sManagerIdStr?.removePrefix("player_")?.toIntOrNull()
                val sManagerName = sInfo.child("managerName").getValue(String::class.java)
                val sManager2IdStr = sInfo.child("manager2Id").getValue(String::class.java)
                val sManager2Id = sManager2IdStr?.removePrefix("player_")?.toIntOrNull()
                val sManager2Name = sInfo.child("manager2Name").getValue(String::class.java)
                val sTargetScore = sInfo.child("targetScore").getValue(Int::class.java) ?: 21

                val sessionEntity = if (rawSessionId != null) {
                    SessionEntity(
                        id = rawSessionId,
                        name = sName,
                        type = sType,
                        status = sStatus,
                        isActive = sIsActive,
                        createdAt = sCreatedAt,
                        startTime = sStartTime,
                        endTime = sEndTime,
                        weeklySessionId = sWeeklyId,
                        managerId = sManagerId,
                        managerName = sManagerName,
                        manager2Id = sManager2Id,
                        manager2Name = sManager2Name,
                        targetScore = sTargetScore
                    )
                } else {
                    SessionEntity(
                        name = sName,
                        type = sType,
                        status = sStatus,
                        isActive = sIsActive,
                        createdAt = sCreatedAt,
                        startTime = sStartTime,
                        endTime = sEndTime,
                        weeklySessionId = sWeeklyId,
                        managerId = sManagerId,
                        managerName = sManagerName,
                        manager2Id = sManager2Id,
                        manager2Name = sManager2Name,
                        targetScore = sTargetScore
                    )
                }
                val insertedSessId = dao.insertSession(sessionEntity).toInt()
                val actualSessId = if (rawSessionId != null) rawSessionId else insertedSessId

                // Session Players
                val sPlayersSnap = sChild.child("session_players")
                for (spChild in sPlayersSnap.children) {
                    val pIdStr = spChild.child("playerId").getValue(String::class.java) ?: spChild.key ?: ""
                    val pId = pIdStr.removePrefix("player_").toIntOrNull()
                    val isPaused = spChild.child("isPaused").getValue(Boolean::class.java) ?: false
                    val eligibleCourtIds = spChild.child("eligibleCourtIds").getValue(String::class.java)
                    val isPAYG = spChild.child("isPAYG").getValue(Boolean::class.java) ?: false
                    val adjustedGames = spChild.child("adjustedGames").getValue(Int::class.java) ?: 0
                    val pausedAtMatchCount = spChild.child("pausedAtMatchCount").getValue(Int::class.java)

                    if (pId != null) {
                        dao.insertSessionPlayer(
                            SessionPlayerJoinEntity(
                                sessionId = actualSessId,
                                playerId = pId,
                                isPaused = isPaused,
                                eligibleCourtIds = eligibleCourtIds,
                                isPAYG = isPAYG,
                                adjustedGames = adjustedGames,
                                pausedAtMatchCount = pausedAtMatchCount
                            )
                        )
                    }
                }

                // Courts
                val sCourtsSnap = sChild.child("courts")
                for (scChild in sCourtsSnap.children) {
                    val cIdStr = scChild.child("id").getValue(String::class.java) ?: scChild.key ?: ""
                    val rawCId = cIdStr.removePrefix("court_").toIntOrNull()
                    val cName = scChild.child("name").getValue(String::class.java) ?: "Court"
                    val gameType = scChild.child("gameType").getValue(String::class.java) ?: "DOUBLES"

                    val courtEntity = if (rawCId != null) {
                        CourtEntity(id = rawCId, sessionId = actualSessId, name = cName, gameType = gameType)
                    } else {
                        CourtEntity(sessionId = actualSessId, name = cName, gameType = gameType)
                    }
                    dao.insertCourt(courtEntity)
                }

                // Matches
                val sMatchesSnap = sChild.child("matches")
                for (smChild in sMatchesSnap.children) {
                    val mIdStr = smChild.child("id").getValue(String::class.java) ?: smChild.key ?: ""
                    val rawMId = mIdStr.removePrefix("match_").toIntOrNull()
                    val matchNumber = smChild.child("matchNumber").getValue(Int::class.java) ?: 1
                    val courtIdStr = smChild.child("courtId").getValue(String::class.java) ?: ""
                    val courtId = courtIdStr.removePrefix("court_").toIntOrNull() ?: 1
                    val t1p1 = smChild.child("teamAPlayer1Id").getValue(String::class.java)?.removePrefix("player_")?.toIntOrNull() ?: 0
                    val t1p2 = smChild.child("teamAPlayer2Id").getValue(String::class.java)?.removePrefix("player_")?.toIntOrNull()
                    val t2p1 = smChild.child("teamBPlayer1Id").getValue(String::class.java)?.removePrefix("player_")?.toIntOrNull() ?: 0
                    val t2p2 = smChild.child("teamBPlayer2Id").getValue(String::class.java)?.removePrefix("player_")?.toIntOrNull()
                    val scoreA = smChild.child("teamAScore").getValue(Int::class.java)
                    val scoreB = smChild.child("teamBScore").getValue(Int::class.java)
                    val winnerTeam = smChild.child("winnerTeam").getValue(String::class.java)
                    val startTime = smChild.child("startTime").getValue(Long::class.java) ?: System.currentTimeMillis()
                    val endTime = smChild.child("endTime").getValue(Long::class.java)

                    val matchEntity = if (rawMId != null) {
                        MatchEntity(
                            id = rawMId,
                            sessionId = actualSessId,
                            matchNumber = matchNumber,
                            courtId = courtId,
                            teamAPlayer1Id = t1p1,
                            teamAPlayer2Id = t1p2,
                            teamBPlayer1Id = t2p1,
                            teamBPlayer2Id = t2p2,
                            teamAScore = scoreA,
                            teamBScore = scoreB,
                            winnerTeam = winnerTeam,
                            startTime = startTime,
                            endTime = endTime
                        )
                    } else {
                        MatchEntity(
                            sessionId = actualSessId,
                            matchNumber = matchNumber,
                            courtId = courtId,
                            teamAPlayer1Id = t1p1,
                            teamAPlayer2Id = t1p2,
                            teamBPlayer1Id = t2p1,
                            teamBPlayer2Id = t2p2,
                            teamAScore = scoreA,
                            teamBScore = scoreB,
                            winnerTeam = winnerTeam,
                            startTime = startTime,
                            endTime = endTime
                        )
                    }
                    dao.insertMatch(matchEntity)
                }
            }

            Log.d("RealtimeDatabaseRepository", "Successfully restored club data for $clubId from Realtime DB")
            Result.success(true)
        } catch (e: Exception) {
            Log.e("RealtimeDatabaseRepository", "Error restoring club from Realtime DB: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Deletes a session manager from Realtime Database
     */
    suspend fun deleteSessionManager(clubId: String, managerId: String): Result<Unit> = withContext(Dispatchers.IO) {
        val db = getDb() ?: return@withContext Result.failure(IllegalStateException("Realtime Database unavailable"))
        try {
            db.reference.child("clubs").child(clubId).child("session_managers").child(managerId).removeValueSafely()
            Log.d("RealtimeDatabaseRepository", "Deleted session manager $managerId from Realtime DB")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("RealtimeDatabaseRepository", "Error deleting session manager from Realtime DB: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Registers or updates a user-to-club index association under /user_club_index/{sanitizedEmail}/{clubId}
     */
    suspend fun registerUserClubAssociation(association: UserClubAssociation): Result<Unit> = withContext(Dispatchers.IO) {
        val db = getDb() ?: return@withContext Result.failure(IllegalStateException("Realtime Database unavailable"))
        if (association.email.isBlank() || association.clubId.isBlank()) {
            return@withContext Result.failure(IllegalArgumentException("Email and clubId must not be blank"))
        }
        try {
            val sanitized = sanitizeEmailKey(association.email)
            val indexRef = db.reference.child("user_club_index").child(sanitized).child(association.clubId)
            val data = mapOf(
                "email" to association.email.trim(),
                "clubId" to association.clubId,
                "clubName" to association.clubName,
                "role" to association.role,
                "managerId" to association.managerId,
                "managerName" to association.managerName,
                "ownerUid" to association.ownerUid,
                "venue" to association.venue,
                "updatedAt" to (if (association.updatedAt > 0) association.updatedAt else System.currentTimeMillis())
            )
            indexRef.setValueSafely(data)
            Log.d("RealtimeDatabaseRepository", "Registered user_club_index for ${association.email} -> club ${association.clubId} (${association.role})")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("RealtimeDatabaseRepository", "Error registering user_club_index: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Removes a user-to-club index association from /user_club_index/{sanitizedEmail}/{clubId}
     */
    suspend fun removeUserClubAssociation(email: String, clubId: String): Result<Unit> = withContext(Dispatchers.IO) {
        val db = getDb() ?: return@withContext Result.failure(IllegalStateException("Realtime Database unavailable"))
        if (email.isBlank() || clubId.isBlank()) {
            return@withContext Result.failure(IllegalArgumentException("Email and clubId must not be blank"))
        }
        try {
            val sanitized = sanitizeEmailKey(email)
            db.reference.child("user_club_index").child(sanitized).child(clubId).removeValueSafely()
            Log.d("RealtimeDatabaseRepository", "Removed user_club_index for $email -> club $clubId")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("RealtimeDatabaseRepository", "Error removing user_club_index: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Finds all clubs associated with a user's email by checking /user_club_index/{sanitizedEmail}.
     * If the index is empty, it also performs a fallback check against /clubs/club_{fallbackUid} and
     * scans clubs for any session manager matching the email, auto-populating the index for future logins.
     */
    suspend fun findClubsForUser(email: String, fallbackUid: String? = null): Result<List<UserClubAssociation>> = withContext(Dispatchers.IO) {
        val db = getDb() ?: return@withContext Result.failure(IllegalStateException("Realtime Database unavailable"))
        val cleanEmail = email.trim()
        if (cleanEmail.isBlank()) return@withContext Result.success(emptyList())

        try {
            val sanitized = sanitizeEmailKey(cleanEmail)
            val indexRef = db.reference.child("user_club_index").child(sanitized)
            val indexSnap = withTimeoutOrNull(10_000L) {
                indexRef.get().await()
            }

            val list = mutableListOf<UserClubAssociation>()

            if (indexSnap != null && indexSnap.exists()) {
                for (child in indexSnap.children) {
                    val clubId = child.child("clubId").getValue(String::class.java) ?: child.key ?: ""
                    val clubName = child.child("clubName").getValue(String::class.java) ?: "Club"
                    val role = child.child("role").getValue(String::class.java) ?: "SESSION_MANAGER"
                    val managerId = child.child("managerId").getValue(Int::class.java)
                    val managerName = child.child("managerName").getValue(String::class.java)
                    val ownerUid = child.child("ownerUid").getValue(String::class.java)
                    val venue = child.child("venue").getValue(String::class.java) ?: ""
                    val updatedAt = child.child("updatedAt").getValue(Long::class.java) ?: System.currentTimeMillis()

                    if (clubId.isNotBlank()) {
                        list.add(
                            UserClubAssociation(
                                email = cleanEmail,
                                clubId = clubId,
                                clubName = clubName,
                                role = role,
                                managerId = managerId,
                                managerName = managerName,
                                ownerUid = ownerUid,
                                venue = venue,
                                updatedAt = updatedAt
                            )
                        )
                    }
                }
            }

            // Fallback 1: If no index entries found, check if fallbackUid is an existing club owner
            if (list.isEmpty() && !fallbackUid.isNullOrBlank()) {
                val ownerClubId = "club_$fallbackUid"
                val clubDetailsSnap = withTimeoutOrNull(5_000L) {
                    db.reference.child("clubs").child(ownerClubId).child("details").get().await()
                }
                if (clubDetailsSnap != null && clubDetailsSnap.exists()) {
                    val clubName = clubDetailsSnap.child("name").getValue(String::class.java) ?: "My Badminton Club"
                    val venue = clubDetailsSnap.child("venue").getValue(String::class.java) ?: ""
                    val assoc = UserClubAssociation(
                        email = cleanEmail,
                        clubId = ownerClubId,
                        clubName = clubName,
                        role = "CLUB_MANAGER",
                        ownerUid = fallbackUid,
                        venue = venue,
                        updatedAt = System.currentTimeMillis()
                    )
                    list.add(assoc)
                    // Auto-populate index for future instant lookup
                    registerUserClubAssociation(assoc)
                }
            }

            // Fallback 2: Deep scan of all clubs in Realtime DB if still empty
            if (list.isEmpty()) {
                val allClubsSnap = withTimeoutOrNull(8_000L) {
                    db.reference.child("clubs").get().await()
                }
                if (allClubsSnap != null && allClubsSnap.exists()) {
                    for (clubSnap in allClubsSnap.children) {
                        val cId = clubSnap.key ?: continue
                        val detailsSnap = clubSnap.child("details")
                        val clubName = detailsSnap.child("name").getValue(String::class.java) ?: "Club"
                        val venue = detailsSnap.child("venue").getValue(String::class.java) ?: ""
                        val description = detailsSnap.child("description").getValue(String::class.java) ?: ""

                        // Check if user is club manager
                        if (description.contains(cleanEmail, ignoreCase = true)) {
                            val assoc = UserClubAssociation(
                                email = cleanEmail,
                                clubId = cId,
                                clubName = clubName,
                                role = "CLUB_MANAGER",
                                venue = venue,
                                updatedAt = System.currentTimeMillis()
                            )
                            list.add(assoc)
                            registerUserClubAssociation(assoc)
                            continue
                        }

                        // Check if user is in session_managers
                        val managersSnap = clubSnap.child("session_managers")
                        for (mChild in managersSnap.children) {
                            val mEmail = mChild.child("email").getValue(String::class.java) ?: ""
                            if (mEmail.equals(cleanEmail, ignoreCase = true)) {
                                val mIdStr = mChild.child("id").getValue(String::class.java) ?: mChild.key ?: ""
                                val rawId = mIdStr.removePrefix("manager_").toIntOrNull()
                                val mName = mChild.child("name").getValue(String::class.java) ?: ""
                                val assoc = UserClubAssociation(
                                    email = cleanEmail,
                                    clubId = cId,
                                    clubName = clubName,
                                    role = "SESSION_MANAGER",
                                    managerId = rawId,
                                    managerName = mName,
                                    venue = venue,
                                    updatedAt = System.currentTimeMillis()
                                )
                                list.add(assoc)
                                registerUserClubAssociation(assoc)
                            }
                        }
                    }
                }
            }

            Log.d("RealtimeDatabaseRepository", "Found ${list.size} club(s) for user $cleanEmail")
            Result.success(list)
        } catch (e: Exception) {
            Log.e("RealtimeDatabaseRepository", "Error discovering clubs for user $cleanEmail: ${e.message}", e)
            Result.failure(e)
        }
    }
}
