package com.example.data.repository

import android.util.Log
import com.example.data.database.BadmintonDao
import com.example.data.database.ClubEntity
import com.example.data.database.CourtEntity
import com.example.data.database.MatchEntity
import com.example.data.database.PlayerEntity
import com.example.data.database.SessionEntity
import com.example.data.database.SessionManagerEntity
import com.example.data.database.SessionPlayerJoinEntity
import com.example.data.database.WeeklySessionCourtEntity
import com.example.data.database.WeeklySessionEntity
import com.example.data.database.WeeklySessionMemberEntity
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

/**
 * Firestore Data Models for Multi-Club Hierarchy
 *
 * Collection Hierarchy:
 * /clubs/{clubId}
 *    ├── /members/{playerId}
 *    └── /sessions/{sessionId}
 *           ├── /session_players/{playerId}
 *           ├── /courts/{courtId}
 *           └── /matches/{matchId}
 */

data class FirestoreClub(
    val id: String = "",
    val name: String = "",
    val venue: String = "",
    val defaultSessionType: String = "DOUBLES",
    val themeColorHex: String = "#0284C7",
    val targetScore: Int = 21,
    val contactPerson: String = "",
    val description: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

data class FirestorePlayer(
    val id: String = "",
    val name: String = "",
    val gender: String = "MALE",
    val isPAYG: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

data class FirestoreSession(
    val id: String = "",
    val name: String = "",
    val type: String = "DOUBLES",
    val status: String = "Setting Up",
    val isActive: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val startTime: Long? = null,
    val endTime: Long? = null,
    val weeklySessionId: String? = null,
    val managerId: String? = null,
    val managerName: String? = null,
    val manager2Id: String? = null,
    val manager2Name: String? = null,
    val targetScore: Int = 21
)

data class FirestoreSessionPlayer(
    val playerId: String = "",
    val isPaused: Boolean = false,
    val eligibleCourtIds: String? = null,
    val isPAYG: Boolean = false,
    val adjustedGames: Int = 0,
    val pausedAtMatchCount: Int? = null
)

data class FirestoreCourt(
    val id: String = "",
    val name: String = "",
    val gameType: String = "DOUBLES"
)

data class FirestoreMatch(
    val id: String = "",
    val matchNumber: Int = 0,
    val courtId: String = "",
    val teamAPlayer1Id: String = "",
    val teamAPlayer2Id: String? = null,
    val teamBPlayer1Id: String = "",
    val teamBPlayer2Id: String? = null,
    val teamAScore: Int? = null,
    val teamBScore: Int? = null,
    val winnerTeam: String? = null,
    val startTime: Long = System.currentTimeMillis(),
    val endTime: Long? = null
)

data class FirestoreWeeklySession(
    val id: String = "",
    val name: String = "",
    val dayOfWeek: String = "",
    val time: String = "",
    val type: String = "DOUBLES",
    val managerId: String? = null,
    val managerName: String? = null,
    val manager2Id: String? = null,
    val manager2Name: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val targetScore: Int = 21
)

data class FirestoreWeeklySessionMember(
    val playerId: String = ""
)

data class FirestoreWeeklySessionCourt(
    val id: String = "",
    val name: String = "",
    val gameType: String = "DOUBLES"
)

data class FirestoreSessionManager(
    val id: String = "",
    val name: String = "",
    val email: String = "",
    val inviteStatus: String = "INVITED",
    val createdAt: Long = System.currentTimeMillis()
)

data class FirestoreLeaderboardEntry(
    val playerId: String = "",
    val name: String = "",
    val gender: String = "",
    val gamesPlayed: Int = 0,
    val gamesWon: Int = 0,
    val gamesLost: Int = 0,
    val winPercentage: Float = 0f,
    val totalPointsScored: Int = 0,
    val totalPointsConceded: Int = 0,
    val averagePointsPerGame: Float = 0f,
    val maxConsecutiveWins: Int = 0,
    val maxConsecutiveLosses: Int = 0
)

class FirestoreRepository {

    private fun getDb(): FirebaseFirestore? {
        return try {
            FirebaseFirestore.getInstance()
        } catch (e: Exception) {
            val ctx = com.example.BadmintonApplication.getAppContext()
            if (ctx != null) {
                com.example.BadmintonApplication.ensureFirebaseInitialized(ctx)
                try {
                    FirebaseFirestore.getInstance()
                } catch (e2: Exception) {
                    Log.w("FirestoreRepository", "FirebaseFirestore unavailable after init: ${e2.message}")
                    null
                }
            } else {
                Log.w("FirestoreRepository", "Firebase not initialized: ${e.message}")
                null
            }
        }
    }

    fun isAvailable(): Boolean {
        return try {
            getDb() != null
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Saves or updates Club metadata in Firestore
     */
    suspend fun saveClub(club: ClubEntity, customClubId: String? = null): Result<Unit> = withContext(Dispatchers.IO) {
        val firestore = getDb() ?: return@withContext Result.failure(IllegalStateException("Firestore unavailable"))
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
            firestore.collection("clubs").document(clubId).set(doc, SetOptions.merge()).await()
            Log.d("FirestoreRepository", "Saved club $clubId successfully")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("FirestoreRepository", "Error saving club: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Saves or updates player master pool for a specific club
     */
    suspend fun savePlayers(clubId: String, players: List<PlayerEntity>): Result<Unit> = withContext(Dispatchers.IO) {
        val firestore = getDb() ?: return@withContext Result.failure(IllegalStateException("Firestore unavailable"))
        try {
            val batch = firestore.batch()
            val membersRef = firestore.collection("clubs").document(clubId).collection("members")

            for (p in players) {
                val pId = "player_${p.id}"
                val doc = FirestorePlayer(
                    id = pId,
                    name = p.name,
                    gender = p.gender,
                    isPAYG = p.isPAYG,
                    createdAt = p.createdAt
                )
                batch.set(membersRef.document(pId), doc, SetOptions.merge())
            }
            batch.commit().await()
            Log.d("FirestoreRepository", "Saved ${players.size} players to club $clubId")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("FirestoreRepository", "Error saving players: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Saves session details, active participants, courts, and completed matches to Firestore.
     * This establishes full multi-club history and cloud backup.
     */
    suspend fun syncSessionToFirestore(
        clubId: String,
        session: SessionEntity,
        joins: List<SessionPlayerJoinEntity>,
        courts: List<CourtEntity>,
        matches: List<MatchEntity>,
        players: List<PlayerEntity>
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val firestore = getDb() ?: return@withContext Result.failure(IllegalStateException("Firestore unavailable"))
        try {
            // 1. Ensure players are updated in club master pool
            savePlayers(clubId, players)

            val sessionIdStr = "session_${session.id}"
            val sessionRef = firestore.collection("clubs").document(clubId)
                .collection("sessions").document(sessionIdStr)

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
                managerId = session.managerId?.let { "player_$it" },
                managerName = session.managerName,
                manager2Id = session.manager2Id?.let { "player_$it" },
                manager2Name = session.manager2Name,
                targetScore = session.targetScore
            )
            sessionRef.set(sessionDoc, SetOptions.merge()).await()

            // 2. Write session players
            val playersBatch = firestore.batch()
            val playersRef = sessionRef.collection("session_players")
            for (j in joins) {
                val pId = "player_${j.playerId}"
                val joinDoc = FirestoreSessionPlayer(
                    playerId = pId,
                    isPaused = j.isPaused,
                    eligibleCourtIds = j.eligibleCourtIds,
                    isPAYG = j.isPAYG,
                    adjustedGames = j.adjustedGames,
                    pausedAtMatchCount = j.pausedAtMatchCount
                )
                playersBatch.set(playersRef.document(pId), joinDoc, SetOptions.merge())
            }
            playersBatch.commit().await()

            // 3. Write session courts
            val courtsBatch = firestore.batch()
            val courtsRef = sessionRef.collection("courts")
            for (c in courts) {
                val cId = "court_${c.id}"
                val courtDoc = FirestoreCourt(
                    id = cId,
                    name = c.name,
                    gameType = c.gameType
                )
                courtsBatch.set(courtsRef.document(cId), courtDoc, SetOptions.merge())
            }
            courtsBatch.commit().await()

            // 4. Write session matches
            val matchesBatch = firestore.batch()
            val matchesRef = sessionRef.collection("matches")
            for (m in matches) {
                val mId = "match_${m.id}"
                val matchDoc = FirestoreMatch(
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
                matchesBatch.set(matchesRef.document(mId), matchDoc, SetOptions.merge())
            }
            matchesBatch.commit().await()

            Log.d("FirestoreRepository", "Successfully synced session $sessionIdStr to Firestore under club $clubId")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("FirestoreRepository", "Error syncing session to Firestore: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Synchronizes all club members, removing members from Firestore that were deleted locally
     */
    suspend fun syncMembers(clubId: String, players: List<PlayerEntity>): Result<Unit> = withContext(Dispatchers.IO) {
        val firestore = getDb() ?: return@withContext Result.failure(IllegalStateException("Firestore unavailable"))
        try {
            val membersRef = firestore.collection("clubs").document(clubId).collection("members")
            val activePlayerIds = players.map { "player_${it.id}" }.toSet()

            if (players.isNotEmpty()) {
                val batch = firestore.batch()
                for (p in players) {
                    val pId = "player_${p.id}"
                    val doc = FirestorePlayer(
                        id = pId,
                        name = p.name,
                        gender = p.gender,
                        isPAYG = p.isPAYG,
                        createdAt = p.createdAt
                    )
                    batch.set(membersRef.document(pId), doc, SetOptions.merge())
                }
                batch.commit().await()
            }

            // Remove members deleted locally
            val existingSnapshot = membersRef.get().await()
            for (doc in existingSnapshot.documents) {
                if (doc.id !in activePlayerIds) {
                    membersRef.document(doc.id).delete().await()
                }
            }

            Log.d("FirestoreRepository", "Synced ${players.size} members for club $clubId")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("FirestoreRepository", "Error syncing members: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Synchronizes weekly sessions, members, and courts
     */
    suspend fun syncWeeklySessions(
        clubId: String,
        weeklySessions: List<WeeklySessionEntity>,
        allMembers: List<WeeklySessionMemberEntity>,
        getWeeklyCourts: suspend (Int) -> List<WeeklySessionCourtEntity>
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val firestore = getDb() ?: return@withContext Result.failure(IllegalStateException("Firestore unavailable"))
        try {
            val weeklyRef = firestore.collection("clubs").document(clubId).collection("weekly_sessions")
            val activeWeeklyIds = weeklySessions.map { "weekly_${it.id}" }.toSet()

            for (ws in weeklySessions) {
                val wsIdStr = "weekly_${ws.id}"
                val docRef = weeklyRef.document(wsIdStr)
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
                docRef.set(wsDoc, SetOptions.merge()).await()

                // Sync Weekly Session Members
                val membersForWs = allMembers.filter { it.weeklySessionId == ws.id }
                val membersBatch = firestore.batch()
                val wsMembersRef = docRef.collection("members")
                val activeMemberIds = membersForWs.map { "member_${it.memberId}" }.toSet()

                for (m in membersForWs) {
                    val mId = "member_${m.memberId}"
                    membersBatch.set(wsMembersRef.document(mId), FirestoreWeeklySessionMember(playerId = "player_${m.memberId}"), SetOptions.merge())
                }
                membersBatch.commit().await()

                val existingWsMembers = wsMembersRef.get().await()
                for (doc in existingWsMembers.documents) {
                    if (doc.id !in activeMemberIds) {
                        wsMembersRef.document(doc.id).delete().await()
                    }
                }

                // Sync Weekly Session Courts
                val courtsForWs = getWeeklyCourts(ws.id)
                val courtsBatch = firestore.batch()
                val wsCourtsRef = docRef.collection("courts")
                val activeCourtIds = courtsForWs.map { "court_${it.id}" }.toSet()

                for (c in courtsForWs) {
                    val cId = "court_${c.id}"
                    courtsBatch.set(wsCourtsRef.document(cId), FirestoreWeeklySessionCourt(id = cId, name = c.name, gameType = c.gameType), SetOptions.merge())
                }
                courtsBatch.commit().await()

                val existingWsCourts = wsCourtsRef.get().await()
                for (doc in existingWsCourts.documents) {
                    if (doc.id !in activeCourtIds) {
                        wsCourtsRef.document(doc.id).delete().await()
                    }
                }
            }

            // Clean up deleted weekly sessions
            val existingWeeklyDocs = weeklyRef.get().await()
            for (doc in existingWeeklyDocs.documents) {
                if (doc.id !in activeWeeklyIds) {
                    weeklyRef.document(doc.id).delete().await()
                }
            }

            Log.d("FirestoreRepository", "Synced ${weeklySessions.size} weekly sessions for club $clubId")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("FirestoreRepository", "Error syncing weekly sessions: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Synchronizes historical player leaderboard and statistics
     */
    suspend fun syncLeaderboard(
        clubId: String,
        playerStats: List<PlayerStats>
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val firestore = getDb() ?: return@withContext Result.failure(IllegalStateException("Firestore unavailable"))
        try {
            val leaderboardRef = firestore.collection("clubs").document(clubId).collection("leaderboard")
            val activeIds = playerStats.map { "player_${it.playerId}" }.toSet()

            if (playerStats.isNotEmpty()) {
                val batch = firestore.batch()
                for (stat in playerStats) {
                    val pIdStr = "player_${stat.playerId}"
                    val entry = FirestoreLeaderboardEntry(
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
                    batch.set(leaderboardRef.document(pIdStr), entry, SetOptions.merge())
                }
                batch.commit().await()
            }

            val existing = leaderboardRef.get().await()
            for (doc in existing.documents) {
                if (doc.id !in activeIds) {
                    leaderboardRef.document(doc.id).delete().await()
                }
            }

            Log.d("FirestoreRepository", "Synced leaderboard for ${playerStats.size} players in club $clubId")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("FirestoreRepository", "Error syncing leaderboard: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Saves or updates session managers in Firestore
     */
    suspend fun saveSessionManagers(clubId: String, sessionManagers: List<SessionManagerEntity>): Result<Unit> = withContext(Dispatchers.IO) {
        val firestore = getDb() ?: return@withContext Result.failure(IllegalStateException("Firestore unavailable"))
        try {
            val managersRef = firestore.collection("clubs").document(clubId).collection("session_managers")
            val activeManagerIds = sessionManagers.map { "manager_${it.id}" }.toSet()

            if (sessionManagers.isNotEmpty()) {
                val batch = firestore.batch()
                for (m in sessionManagers) {
                    val mId = "manager_${m.id}"
                    val doc = FirestoreSessionManager(
                        id = mId,
                        name = m.name,
                        email = m.email,
                        inviteStatus = m.inviteStatus,
                        createdAt = m.createdAt
                    )
                    batch.set(managersRef.document(mId), doc, SetOptions.merge())
                }
                batch.commit().await()
            }

            // Remove deleted managers
            val existing = managersRef.get().await()
            for (doc in existing.documents) {
                if (doc.id !in activeManagerIds) {
                    managersRef.document(doc.id).delete().await()
                }
            }

            Log.d("FirestoreRepository", "Saved ${sessionManagers.size} session managers to club $clubId")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("FirestoreRepository", "Error saving session managers: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Synchronizes the entire club data in Firestore
     */
    suspend fun syncEntireClubInSingleBatch(
        clubId: String,
        club: ClubEntity,
        players: List<PlayerEntity>,
        sessionManagers: List<SessionManagerEntity>,
        weeklySessions: List<WeeklySessionEntity>,
        allWeeklyMembers: List<WeeklySessionMemberEntity>,
        getWeeklyCourts: suspend (Int) -> List<WeeklySessionCourtEntity>,
        sessionsWithDetails: List<Triple<SessionEntity, Pair<List<SessionPlayerJoinEntity>, List<CourtEntity>>, List<MatchEntity>>>,
        playerStats: List<PlayerStats>
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val firestore = getDb() ?: return@withContext Result.failure(IllegalStateException("Firestore unavailable"))
        try {
            // 1. Save Club Details
            saveClub(club, clubId)
            // 2. Save Members
            syncMembers(clubId, players)
            // 3. Save Session Managers
            saveSessionManagers(clubId, sessionManagers)
            // 4. Save Weekly Sessions
            syncWeeklySessions(clubId, weeklySessions, allWeeklyMembers, getWeeklyCourts)
            // 5. Save Historical Sessions
            for ((session, joinsAndCourts, matches) in sessionsWithDetails) {
                syncSessionToFirestore(clubId, session, joinsAndCourts.first, joinsAndCourts.second, matches, players)
            }
            // 6. Save Leaderboard
            syncLeaderboard(clubId, playerStats)

            Log.d("FirestoreRepository", "Full club sync completed for $clubId in Firestore")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("FirestoreRepository", "Error in Firestore full club sync: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Restores all club details, members, session managers, and weekly sessions from Firestore
     */
    suspend fun restoreClubData(
        clubId: String,
        dao: BadmintonDao
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        val firestore = getDb() ?: return@withContext Result.failure(IllegalStateException("Firestore unavailable"))
        try {
            val clubDoc = firestore.collection("clubs").document(clubId).get().await()
            if (!clubDoc.exists()) {
                return@withContext Result.success(false)
            }

            val clubObj = clubDoc.toObject(FirestoreClub::class.java)
            if (clubObj != null) {
                dao.insertClubDetails(
                    ClubEntity(
                        id = 1,
                        name = clubObj.name.ifBlank { "Badminton Club" },
                        venue = clubObj.venue,
                        defaultSessionType = clubObj.defaultSessionType.ifBlank { "DOUBLES" },
                        themeColorHex = clubObj.themeColorHex.ifBlank { "#0284C7" },
                        targetScore = if (clubObj.targetScore > 0) clubObj.targetScore else 21,
                        contactPerson = clubObj.contactPerson,
                        description = clubObj.description,
                        createdAt = clubObj.createdAt
                    )
                )
            }

            // Restore Members
            val membersDocs = firestore.collection("clubs").document(clubId).collection("members").get().await()
            for (doc in membersDocs.documents) {
                val p = doc.toObject(FirestorePlayer::class.java)
                if (p != null && p.name.isNotBlank()) {
                    val rawId = p.id.removePrefix("player_").toIntOrNull()
                    val entity = if (rawId != null) {
                        PlayerEntity(id = rawId, name = p.name, gender = p.gender, isPAYG = p.isPAYG, createdAt = p.createdAt)
                    } else {
                        PlayerEntity(name = p.name, gender = p.gender, isPAYG = p.isPAYG, createdAt = p.createdAt)
                    }
                    dao.insertPlayer(entity)
                }
            }

            // Restore Session Managers
            val managersDocs = firestore.collection("clubs").document(clubId).collection("session_managers").get().await()
            for (doc in managersDocs.documents) {
                val m = doc.toObject(FirestoreSessionManager::class.java)
                if (m != null && m.name.isNotBlank() && m.email.isNotBlank()) {
                    val rawId = m.id.removePrefix("manager_").toIntOrNull()
                    val entity = if (rawId != null) {
                        SessionManagerEntity(id = rawId, name = m.name, email = m.email, inviteStatus = m.inviteStatus, createdAt = m.createdAt)
                    } else {
                        SessionManagerEntity(name = m.name, email = m.email, inviteStatus = m.inviteStatus, createdAt = m.createdAt)
                    }
                    dao.insertSessionManager(entity)
                }
            }

            // Restore Weekly Sessions
            val weeklyDocs = firestore.collection("clubs").document(clubId).collection("weekly_sessions").get().await()
            for (doc in weeklyDocs.documents) {
                val ws = doc.toObject(FirestoreWeeklySession::class.java)
                if (ws != null && ws.name.isNotBlank()) {
                    val rawWsId = ws.id.removePrefix("weekly_").toIntOrNull()
                    val managerId = ws.managerId?.removePrefix("player_")?.toIntOrNull()
                    val manager2Id = ws.manager2Id?.removePrefix("player_")?.toIntOrNull()
                    val wsEntity = if (rawWsId != null) {
                        WeeklySessionEntity(
                            id = rawWsId,
                            name = ws.name,
                            dayOfWeek = ws.dayOfWeek,
                            time = ws.time,
                            type = ws.type,
                            managerId = managerId,
                            managerName = ws.managerName,
                            manager2Id = manager2Id,
                            manager2Name = ws.manager2Name,
                            createdAt = ws.createdAt,
                            targetScore = if (ws.targetScore > 0) ws.targetScore else 21
                        )
                    } else {
                        WeeklySessionEntity(
                            name = ws.name,
                            dayOfWeek = ws.dayOfWeek,
                            time = ws.time,
                            type = ws.type,
                            managerId = managerId,
                            managerName = ws.managerName,
                            manager2Id = manager2Id,
                            manager2Name = ws.manager2Name,
                            createdAt = ws.createdAt,
                            targetScore = if (ws.targetScore > 0) ws.targetScore else 21
                        )
                    }
                    val insertedWsId = dao.insertWeeklySession(wsEntity).toInt()
                    val actualWsId = rawWsId ?: insertedWsId

                    // Weekly Members
                    val wsMembersDocs = doc.reference.collection("members").get().await()
                    for (mDoc in wsMembersDocs.documents) {
                        val mObj = mDoc.toObject(FirestoreWeeklySessionMember::class.java)
                        val pId = mObj?.playerId?.removePrefix("player_")?.toIntOrNull()
                        if (pId != null) {
                            dao.insertWeeklySessionMember(WeeklySessionMemberEntity(weeklySessionId = actualWsId, memberId = pId))
                        }
                    }

                    // Weekly Courts
                    val wsCourtsDocs = doc.reference.collection("courts").get().await()
                    for (cDoc in wsCourtsDocs.documents) {
                        val cObj = cDoc.toObject(FirestoreWeeklySessionCourt::class.java)
                        if (cObj != null && cObj.name.isNotBlank()) {
                            val cId = cObj.id.removePrefix("court_").toIntOrNull()
                            val courtEntity = if (cId != null) {
                                WeeklySessionCourtEntity(id = cId, weeklySessionId = actualWsId, name = cObj.name, gameType = cObj.gameType)
                            } else {
                                WeeklySessionCourtEntity(weeklySessionId = actualWsId, name = cObj.name, gameType = cObj.gameType)
                            }
                            dao.insertWeeklySessionCourt(courtEntity)
                        }
                    }
                }
            }

            Log.d("FirestoreRepository", "Restored club data successfully from Firestore for $clubId")
            Result.success(true)
        } catch (e: Exception) {
            Log.e("FirestoreRepository", "Error restoring club from Firestore: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Deletes a session manager document from Firestore
     */
    suspend fun deleteSessionManager(clubId: String, managerId: String): Result<Unit> = withContext(Dispatchers.IO) {
        val firestore = getDb() ?: return@withContext Result.failure(IllegalStateException("Firestore unavailable"))
        try {
            firestore.collection("clubs").document(clubId).collection("session_managers").document(managerId).delete().await()
            Log.d("FirestoreRepository", "Deleted session manager $managerId from Firestore")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("FirestoreRepository", "Error deleting manager $managerId from Firestore: ${e.message}", e)
            Result.failure(e)
        }
    }
}
