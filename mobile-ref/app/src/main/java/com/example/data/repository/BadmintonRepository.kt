package com.example.data.repository

import android.content.Context
import android.util.Log
import com.example.BadmintonApplication
import com.example.data.database.*
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlin.random.Random

class BadmintonRepository(private val dao: BadmintonDao) {

    val firestoreRepository: FirestoreRepository = FirestoreRepository()
    val realtimeDatabaseRepository: RealtimeDatabaseRepository = RealtimeDatabaseRepository()
    val firebaseAuthRepository: FirebaseAuthRepository = FirebaseAuthRepository()

    val allSessions: Flow<List<SessionEntity>> = dao.getAllSessions()
    val activeSession: Flow<SessionEntity?> = dao.getActiveSession()
    val allPlayers: Flow<List<PlayerEntity>> = dao.getAllPlayers()
    val allMasterCourts: Flow<List<CourtMasterEntity>> = dao.getAllMasterCourts()
    val allSessionManagers: Flow<List<SessionManagerEntity>> = dao.getAllSessionManagers()

    fun getActiveClubId(): String? {
        val ctx = BadmintonApplication.getAppContext()
        return ctx?.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
            ?.getString("active_club_id", null)
            ?.takeIf { it.isNotBlank() }
    }

    fun setActiveClubId(clubId: String?) {
        val ctx = BadmintonApplication.getAppContext()
        ctx?.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
            ?.edit()
            ?.putString("active_club_id", clubId?.trim())
            ?.apply()
    }

    suspend fun getEffectiveClubId(): String {
        val active = getActiveClubId()
        if (!active.isNullOrBlank()) return active
        val userId = firebaseAuthRepository.getCurrentUserId()
        if (!userId.isNullOrBlank()) return "club_$userId"
        val club = dao.getClubDetails().firstOrNull()
        return "club_${club?.id ?: 1}"
    }

    suspend fun createSession(
        name: String,
        type: String,
        targetScore: Int? = null,
        managerId: Int? = null,
        managerName: String? = null,
        manager2Id: Int? = null,
        manager2Name: String? = null
    ): Long {
        // Deactivate all other sessions first to ensure only one active session
        dao.deactivateAllSessions()
        val club = dao.getClubDetails().firstOrNull()
        val defaultScore = targetScore ?: club?.targetScore ?: 21
        val session = SessionEntity(
            name = name,
            type = type,
            isActive = true,
            status = "Setting Up",
            managerId = managerId,
            managerName = managerName,
            manager2Id = manager2Id,
            manager2Name = manager2Name,
            targetScore = defaultScore
        )
        return dao.insertSession(session)
    }

    suspend fun updateSessionTargetScore(sessionId: Int, targetScore: Int) {
        val session = dao.getSessionById(sessionId)
        if (session != null) {
            dao.updateSession(session.copy(targetScore = targetScore))
        }
    }

    suspend fun getSessionById(id: Int): SessionEntity? = dao.getSessionById(id)

    suspend fun updateSession(session: SessionEntity) = dao.updateSession(session)

    suspend fun deleteSession(id: Int) {
        dao.clearSessionPlayers(id)
        dao.clearCourts(id)
        dao.clearMatches(id)
        dao.deleteSessionOnly(id)
    }

    // Players
    suspend fun createPlayer(name: String, gender: String, isPAYG: Boolean = false): Long {
        return dao.insertPlayer(PlayerEntity(name = name.trim().uppercase(), gender = gender, isPAYG = isPAYG))
    }

    suspend fun deletePlayer(id: Int) = dao.deletePlayer(id)

    suspend fun convertPAYGToPermanent(playerId: Int) {
        val player = dao.getPlayerById(playerId)
        if (player != null) {
            dao.insertPlayer(player.copy(isPAYG = false))
            val activeSessionVal = dao.getActiveSession().firstOrNull()
            if (activeSessionVal != null) {
                val joins = dao.getSessionPlayers(activeSessionVal.id).firstOrNull() ?: emptyList()
                val currentJoin = joins.find { it.playerId == playerId }
                if (currentJoin != null) {
                    dao.insertSessionPlayer(currentJoin.copy(isPAYG = false))
                }
            }
        }
    }

    // Courts
    fun getCourtsForSession(sessionId: Int): Flow<List<CourtEntity>> = dao.getCourtsForSession(sessionId)

    suspend fun createCourt(sessionId: Int, name: String, gameType: String = "DOUBLES"): Long {
        return dao.insertCourt(CourtEntity(sessionId = sessionId, name = name.trim().uppercase(), gameType = gameType))
    }

    suspend fun updateCourtGameType(courtId: Int, gameType: String) {
        dao.updateCourtGameType(courtId, gameType)
    }

    suspend fun deleteCourt(id: Int) = dao.deleteCourt(id)

    // Session Players Joins
    fun getSessionPlayers(sessionId: Int): Flow<List<SessionPlayerJoinEntity>> = dao.getSessionPlayers(sessionId)

    suspend fun addPlayerToSession(sessionId: Int, playerId: Int) {
        val joins = dao.getSessionPlayers(sessionId).firstOrNull() ?: emptyList()
        val currentJoin = joins.find { it.playerId == playerId }
        if (currentJoin != null) return

        val player = dao.getPlayerById(playerId)
        val isPAYG = player?.isPAYG ?: false

        val session = dao.getSessionById(sessionId)
        val courts = dao.getCourtsForSession(sessionId).firstOrNull() ?: emptyList()
        val matches = dao.getMatchesForSession(sessionId).firstOrNull() ?: emptyList()

        val avgGames = if (session != null && session.status == "Active" && session.startTime != null && courts.isNotEmpty()) {
            Math.round(matches.size.toDouble() / courts.size).toInt()
        } else {
            0
        }

        dao.insertSessionPlayer(
            SessionPlayerJoinEntity(
                sessionId = sessionId,
                playerId = playerId,
                isPaused = false,
                eligibleCourtIds = null,
                isPAYG = isPAYG,
                adjustedGames = avgGames
            )
        )
    }

    suspend fun removePlayerFromSession(sessionId: Int, playerId: Int) {
        dao.removePlayerFromSession(sessionId, playerId)
    }

    fun getEffectiveAdjustedGames(
        join: SessionPlayerJoinEntity,
        totalMatches: Int,
        courtCount: Int
    ): Int {
        if (join.isPaused && join.pausedAtMatchCount != null && courtCount > 0) {
            val matchesDuringPause = maxOf(0, totalMatches - join.pausedAtMatchCount)
            val avg = Math.round(matchesDuringPause.toDouble() / courtCount).toInt()
            return join.adjustedGames + avg
        }
        return join.adjustedGames
    }

    suspend fun setPlayerPauseStatus(sessionId: Int, playerId: Int, isPaused: Boolean) {
        val joins = dao.getSessionPlayers(sessionId).firstOrNull() ?: emptyList()
        val currentJoin = joins.find { it.playerId == playerId }
        if (currentJoin != null) {
            val matches = dao.getMatchesForSession(sessionId).firstOrNull() ?: emptyList()
            val courts = dao.getCourtsForSession(sessionId).firstOrNull() ?: emptyList()
            val currentMatchCount = matches.size

            if (isPaused) {
                val pauseAt = currentJoin.pausedAtMatchCount ?: currentMatchCount
                dao.insertSessionPlayer(currentJoin.copy(isPaused = true, pausedAtMatchCount = pauseAt))
            } else {
                val effectiveAdjusted = getEffectiveAdjustedGames(currentJoin, currentMatchCount, courts.size)
                dao.insertSessionPlayer(
                    currentJoin.copy(
                        isPaused = false,
                        adjustedGames = effectiveAdjusted,
                        pausedAtMatchCount = null
                    )
                )
            }
        }
    }

    suspend fun updatePlayerCourtEligibility(sessionId: Int, playerId: Int, eligibleCourtIds: List<Int>?) {
        val joins = dao.getSessionPlayers(sessionId).firstOrNull() ?: emptyList()
        val currentJoin = joins.find { it.playerId == playerId }
        if (currentJoin != null) {
            val eligibleString = eligibleCourtIds?.joinToString(",")
            dao.insertSessionPlayer(currentJoin.copy(eligibleCourtIds = eligibleString))
        }
    }

    // Matches
    fun getMatchesForSession(sessionId: Int): Flow<List<MatchEntity>> = dao.getMatchesForSession(sessionId)
    fun getActiveMatchesForSession(sessionId: Int): Flow<List<MatchEntity>> = dao.getActiveMatchesForSession(sessionId)

    private suspend fun initializePauseCountForSession(sessionId: Int) {
        val joins = dao.getSessionPlayers(sessionId).firstOrNull() ?: emptyList()
        val matches = dao.getMatchesForSession(sessionId).firstOrNull() ?: emptyList()
        val currentMatchCount = matches.size
        for (join in joins) {
            if (join.isPaused && join.pausedAtMatchCount == null) {
                dao.insertSessionPlayer(join.copy(pausedAtMatchCount = currentMatchCount))
            }
        }
    }

    suspend fun startSession(sessionId: Int) {
        val session = dao.getSessionById(sessionId)
        if (session != null) {
            dao.updateSession(session.copy(startTime = System.currentTimeMillis(), status = "Active"))
            initializePauseCountForSession(sessionId)
        }
    }

    suspend fun syncSessionToCloud(sessionId: Int): Result<Unit> {
        val clubId = getEffectiveClubId()
        val session = dao.getSessionById(sessionId) ?: return Result.failure(IllegalArgumentException("Session not found"))
        val joins = dao.getSessionPlayers(sessionId).firstOrNull() ?: emptyList()
        val courts = dao.getCourtsForSession(sessionId).firstOrNull() ?: emptyList()
        val matches = dao.getMatchesForSession(sessionId).firstOrNull() ?: emptyList()
        val players = dao.getAllPlayers().firstOrNull() ?: emptyList()

        return realtimeDatabaseRepository.syncSessionToRealtimeDatabase(
            clubId = clubId,
            session = session,
            joins = joins,
            courts = courts,
            matches = matches,
            players = players
        )
    }

    suspend fun fullClubSync(): Result<String> {
        val rtdbAvailable = realtimeDatabaseRepository.isAvailable()

        if (!rtdbAvailable) {
            return Result.failure(IllegalStateException("Firebase Realtime Database is currently unreachable. Please check your internet connection."))
        }

        return try {
            Log.d("BadmintonRepository", "Starting full club sync to Firebase Realtime Database...")

            // 1. Make sure all live sessions have ended
            val allSessions = dao.getAllSessions().firstOrNull() ?: emptyList()
            val activeSessions = allSessions.filter { it.isActive || it.status == "Active" || it.status == "Setting Up" }
            for (activeSession in activeSessions) {
                dao.updateSession(
                    activeSession.copy(
                        isActive = false,
                        status = "End",
                        endTime = activeSession.endTime ?: System.currentTimeMillis()
                    )
                )
            }

            val updatedSessions = dao.getAllSessions().firstOrNull() ?: emptyList()

            // 2. Club details & clubId
            val club = dao.getClubDetails().firstOrNull() ?: ClubEntity(id = 1, name = "Default Club")
            val clubId = getEffectiveClubId()

            val allPlayers = dao.getAllPlayers().firstOrNull() ?: emptyList()
            val allSessionManagers = dao.getAllSessionManagers().firstOrNull() ?: emptyList()
            val weeklySessions = dao.getAllWeeklySessions().firstOrNull() ?: emptyList()
            val allWeeklyMembers = dao.getAllWeeklySessionMembers().firstOrNull() ?: emptyList()

            // Gather all historical session details
            val sessionDetailsList = updatedSessions.map { session ->
                val joins = dao.getSessionPlayers(session.id).firstOrNull() ?: emptyList()
                val courts = dao.getCourtsForSession(session.id).firstOrNull() ?: emptyList()
                val matches = dao.getMatchesForSession(session.id).firstOrNull() ?: emptyList()
                Triple(session, joins to courts, matches)
            }

            val allMatchesAcrossSessions = sessionDetailsList.flatMap { it.third }

            val playerStats = StatsCalculator.calculatePlayerStats(
                players = allPlayers,
                matches = allMatchesAcrossSessions,
                courtCount = 0
            )

            // Save to Firebase Realtime Database only
            val syncResult = realtimeDatabaseRepository.syncEntireClubInSingleBatch(
                clubId = clubId,
                club = club,
                players = allPlayers,
                sessionManagers = allSessionManagers,
                weeklySessions = weeklySessions,
                allWeeklyMembers = allWeeklyMembers,
                getWeeklyCourts = { wsId -> dao.getWeeklySessionCourts(wsId).firstOrNull() ?: emptyList() },
                sessionsWithDetails = sessionDetailsList,
                playerStats = playerStats
            )

            if (syncResult.isSuccess) {
                val endedMsg = if (activeSessions.isNotEmpty()) "Ended ${activeSessions.size} active session(s). " else ""
                Result.success("${endedMsg}Successfully synchronized ${allPlayers.size} member(s), ${allSessionManagers.size} session manager(s), and sessions to Firebase Realtime Database!")
            } else {
                val msg = syncResult.exceptionOrNull()?.message ?: "Synchronization encountered an issue saving to Firebase Realtime Database."
                Result.failure(Exception(msg))
            }
        } catch (e: Exception) {
            Log.e("BadmintonRepository", "Full sync failed: ${e.message}", e)
            Result.failure(e)
        }
    }

    suspend fun stopSession(sessionId: Int) {
        val session = dao.getSessionById(sessionId)
        if (session != null) {
            dao.updateSession(session.copy(endTime = System.currentTimeMillis(), isActive = false, status = "End"))
            if (realtimeDatabaseRepository.isAvailable()) {
                syncSessionToCloud(sessionId)
            }
        }
    }

    suspend fun updateSessionStatus(sessionId: Int, status: String) {
        val session = dao.getSessionById(sessionId) ?: return
        val updatedSession = when (status) {
            "Active" -> {
                session.copy(
                    status = status,
                    startTime = session.startTime ?: System.currentTimeMillis(),
                    isActive = true,
                    endTime = null
                )
            }
            "End" -> {
                session.copy(
                    status = status,
                    endTime = session.endTime ?: System.currentTimeMillis(),
                    isActive = false
                )
            }
            "Setting Up" -> {
                session.copy(
                    status = status,
                    startTime = null,
                    endTime = null,
                    isActive = true
                )
            }
            else -> session.copy(status = status)
        }
        dao.updateSession(updatedSession)
        if (status == "Active") {
            initializePauseCountForSession(sessionId)
        } else if (status == "End") {
            if (realtimeDatabaseRepository.isAvailable()) {
                syncSessionToCloud(sessionId)
            }
        }
    }

    // Court Master
    suspend fun createMasterCourt(name: String): Long {
        return dao.insertMasterCourt(CourtMasterEntity(name = name.trim().uppercase()))
    }

    suspend fun deleteMasterCourt(id: Int) {
        dao.deleteMasterCourt(id)
    }

    suspend fun recordMatchScore(matchId: Int, teamAScore: Int, teamBScore: Int) {
        val match = dao.getMatchById(matchId) ?: return
        val winner = when {
            teamAScore > teamBScore -> "A"
            teamBScore > teamAScore -> "B"
            else -> "TIE" // Badminton usually has no ties, but support just in case
        }
        val completedMatch = match.copy(
            teamAScore = teamAScore,
            teamBScore = teamBScore,
            winnerTeam = winner,
            endTime = System.currentTimeMillis()
        )
        dao.updateMatch(completedMatch)

        // Automatically trigger next match generation for this court
        generateNextMatchForCourt(match.sessionId, match.courtId)
    }

    suspend fun deleteMatch(id: Int) {
        dao.deleteMatch(id)
    }

    suspend fun substitutePlayer(matchId: Int, playerToReplaceId: Int, newPlayerId: Int) {
        val match = dao.getMatchById(matchId) ?: return
        val updatedMatch = when (playerToReplaceId) {
            match.teamAPlayer1Id -> match.copy(teamAPlayer1Id = newPlayerId)
            match.teamAPlayer2Id -> match.copy(teamAPlayer2Id = newPlayerId)
            match.teamBPlayer1Id -> match.copy(teamBPlayer1Id = newPlayerId)
            match.teamBPlayer2Id -> match.copy(teamBPlayer2Id = newPlayerId)
            else -> match
        }
        dao.updateMatch(updatedMatch)
    }

    suspend fun generateNextMatchForCourt(sessionId: Int, courtId: Int): MatchEntity? {
        val session = dao.getSessionById(sessionId) ?: return null
        if (session.endTime != null || session.startTime == null) {
            // Only generate matches during an active started session
            return null
        }

        // 1. Fetch data synchronously from Flow/DB
        val courts = dao.getCourtsForSession(sessionId).firstOrNull() ?: emptyList()
        val playersJoins = dao.getSessionPlayers(sessionId).firstOrNull() ?: emptyList()
        val allPlayersList = dao.getAllPlayers().firstOrNull() ?: emptyList()
        val matches = dao.getMatchesForSession(sessionId).firstOrNull() ?: emptyList()

        val court = courts.find { it.id == courtId } ?: return null

        // 2. Determine currently busy players (playing on ANY court in an active match)
        val activeMatches = matches.filter { it.endTime == null }
        val busyPlayerIds = mutableSetOf<Int>()
        for (m in activeMatches) {
            busyPlayerIds.add(m.teamAPlayer1Id)
            m.teamAPlayer2Id?.let { busyPlayerIds.add(it) }
            busyPlayerIds.add(m.teamBPlayer1Id)
            m.teamBPlayer2Id?.let { busyPlayerIds.add(it) }
        }

        // 3. Filter candidates based on eligibility, pause, and busy status
        val candidates = playersJoins.filter { join ->
            // Exclude busy
            !busyPlayerIds.contains(join.playerId) &&
            // Exclude paused
            !join.isPaused &&
            // Check court eligibility
            (join.eligibleCourtIds.isNullOrEmpty() || 
             join.eligibleCourtIds.split(",").contains(courtId.toString()))
        }.mapNotNull { join ->
            allPlayersList.find { it.id == join.playerId }?.let { player ->
                Pair(player, join)
            }
        }

        // 4. Calculate games played and rest status (last match number played) for each player
        // Games played = completed + active matches in this session
        val gamesPlayedMap = mutableMapOf<Int, Int>()
        val lastMatchPlayedMap = mutableMapOf<Int, Int>()

        val joinsMap = playersJoins.associateBy { it.playerId }
        val courtCount = courts.size
        val totalMatchesCount = matches.size
        for (player in allPlayersList) {
            val join = joinsMap[player.id]
            val adj = if (join != null) getEffectiveAdjustedGames(join, totalMatchesCount, courtCount) else 0
            gamesPlayedMap[player.id] = adj
            lastMatchPlayedMap[player.id] = 0
        }

        // Sort matches by matchNumber ascending to trace history correctly
        val sortedMatches = matches.sortedBy { it.matchNumber }
        for (m in sortedMatches) {
            val playersInMatch = listOfNotNull(
                m.teamAPlayer1Id, m.teamAPlayer2Id,
                m.teamBPlayer1Id, m.teamBPlayer2Id
            )
            for (pId in playersInMatch) {
                gamesPlayedMap[pId] = (gamesPlayedMap[pId] ?: 0) + 1
                lastMatchPlayedMap[pId] = m.matchNumber
            }
        }

        // Build partner history map and opponent history map for Rule 1 & Rule 2
        // Key: Pair of player IDs (smaller ID first to be symmetric) -> Count of occurrences
        val partnerHistoryMap = mutableMapOf<Pair<Int, Int>, Int>()
        val opponentHistoryMap = mutableMapOf<Pair<Int, Int>, Int>()

        for (m in sortedMatches) {
            val a1 = m.teamAPlayer1Id
            val a2 = m.teamAPlayer2Id
            val b1 = m.teamBPlayer1Id
            val b2 = m.teamBPlayer2Id

            if (a2 != null) {
                val pairA = if (a1 < a2) Pair(a1, a2) else Pair(a2, a1)
                partnerHistoryMap[pairA] = (partnerHistoryMap[pairA] ?: 0) + 1
            }
            if (b2 != null) {
                val pairB = if (b1 < b2) Pair(b1, b2) else Pair(b2, b1)
                partnerHistoryMap[pairB] = (partnerHistoryMap[pairB] ?: 0) + 1
            }

            val teamA = listOfNotNull(a1, a2)
            val teamB = listOfNotNull(b1, b2)
            for (pa in teamA) {
                for (pb in teamB) {
                    val pairOpp = if (pa < pb) Pair(pa, pb) else Pair(pb, pa)
                    opponentHistoryMap[pairOpp] = (opponentHistoryMap[pairOpp] ?: 0) + 1
                }
            }
        }

        // 5. Select players based on Resolved Game Type (court specific or session specific)
        val nextMatchNumber = (matches.maxOfOrNull { it.matchNumber } ?: 0) + 1
        val resolvedGameType = if (session.type == "MULTI_TYPE") court.gameType else session.type

        val match = when (resolvedGameType) {
            "SINGLES" -> {
                val males = candidates.filter { it.first.gender == "MALE" }
                val females = candidates.filter { it.first.gender == "FEMALE" }

                val canPlayMale = males.size >= 2
                val canPlayFemale = females.size >= 2

                if (!canPlayMale && !canPlayFemale) return null

                val chooseMale = if (canPlayMale && canPlayFemale) {
                    val minMaleGames = males.minOf { gamesPlayedMap[it.first.id] ?: 0 }
                    val minFemaleGames = females.minOf { gamesPlayedMap[it.first.id] ?: 0 }
                    if (minMaleGames < minFemaleGames) {
                        true
                    } else if (minMaleGames > minFemaleGames) {
                        false
                    } else {
                        Random.nextBoolean()
                    }
                } else {
                    canPlayMale
                }

                val selectedGenderCandidates = if (chooseMale) males else females
                
                // Sort candidates to get the top ones
                val sortedCandidates = selectedGenderCandidates.sortedWith(
                    compareBy<Pair<PlayerEntity, SessionPlayerJoinEntity>> { gamesPlayedMap[it.first.id] ?: 0 }
                        .thenBy { lastMatchPlayedMap[it.first.id] ?: 0 }
                        .thenBy { Random.nextDouble() }
                )

                // Select candidate pool: take top 4 candidates (or all if fewer)
                val pool = sortedCandidates.take(4).map { it.first }

                // Generate all 2-player combinations and evaluate opponent cost (Rule 2)
                class SinglesOption(
                    val p1: PlayerEntity,
                    val p2: PlayerEntity,
                    val gamesPlayedSum: Int,
                    val opponentCost: Int,
                    val restSum: Int
                )

                val options = mutableListOf<SinglesOption>()
                for (i in pool.indices) {
                    for (j in i + 1 until pool.size) {
                        val player1 = pool[i]
                        val player2 = pool[j]
                        val opKey = if (player1.id < player2.id) Pair(player1.id, player2.id) else Pair(player2.id, player1.id)
                        val opponentCost = opponentHistoryMap[opKey] ?: 0
                        val gpSum = (gamesPlayedMap[player1.id] ?: 0) + (gamesPlayedMap[player2.id] ?: 0)
                        val restSum = (lastMatchPlayedMap[player1.id] ?: 0) + (lastMatchPlayedMap[player2.id] ?: 0)

                        options.add(SinglesOption(player1, player2, gpSum, opponentCost, restSum))
                    }
                }

                // Sort options by: gamesPlayedSum, opponentCost, restSum, then random
                val bestOption = options.sortedWith(
                    compareBy<SinglesOption> { it.gamesPlayedSum }
                        .thenBy { it.opponentCost }
                        .thenBy { it.restSum }
                        .thenBy { Random.nextDouble() }
                ).firstOrNull() ?: return null

                MatchEntity(
                    sessionId = sessionId,
                    courtId = courtId,
                    matchNumber = nextMatchNumber,
                    teamAPlayer1Id = bestOption.p1.id,
                    teamBPlayer1Id = bestOption.p2.id,
                    startTime = System.currentTimeMillis()
                )
            }
            "DOUBLES" -> {
                val males = candidates.filter { it.first.gender == "MALE" }
                val females = candidates.filter { it.first.gender == "FEMALE" }

                val canPlayMale = males.size >= 4
                val canPlayFemale = females.size >= 4

                if (!canPlayMale && !canPlayFemale) return null

                val chooseMale = if (canPlayMale && canPlayFemale) {
                    val minMaleGames = males.minOf { gamesPlayedMap[it.first.id] ?: 0 }
                    val minFemaleGames = females.minOf { gamesPlayedMap[it.first.id] ?: 0 }
                    if (minMaleGames < minFemaleGames) {
                        true
                    } else if (minMaleGames > minFemaleGames) {
                        false
                    } else {
                        Random.nextBoolean()
                    }
                } else {
                    canPlayMale
                }

                val selectedGenderCandidates = if (chooseMale) males else females
                val sortedCandidates = selectedGenderCandidates.sortedWith(
                    compareBy<Pair<PlayerEntity, SessionPlayerJoinEntity>> { gamesPlayedMap[it.first.id] ?: 0 }
                        .thenBy { lastMatchPlayedMap[it.first.id] ?: 0 }
                        .thenBy { Random.nextDouble() }
                )

                // Rule 3: Select Top 6 Candidates
                val pool = sortedCandidates.take(6).map { it.first }

                class DoublesOption(
                    val teamA: Pair<PlayerEntity, PlayerEntity>,
                    val teamB: Pair<PlayerEntity, PlayerEntity>,
                    val gamesPlayedSum: Int,
                    val partnerCost: Int,
                    val opponentCost: Int,
                    val restSum: Int
                )

                val options = mutableListOf<DoublesOption>()
                
                // Generate all combinations of 4 players from the pool
                for (i in 0 until pool.size) {
                    for (j in i + 1 until pool.size) {
                        for (k in j + 1 until pool.size) {
                            for (l in k + 1 until pool.size) {
                                val p1 = pool[i]
                                val p2 = pool[j]
                                val p3 = pool[k]
                                val p4 = pool[l]

                                val gpSum = (gamesPlayedMap[p1.id] ?: 0) +
                                             (gamesPlayedMap[p2.id] ?: 0) +
                                             (gamesPlayedMap[p3.id] ?: 0) +
                                             (gamesPlayedMap[p4.id] ?: 0)

                                val restSum = (lastMatchPlayedMap[p1.id] ?: 0) +
                                               (lastMatchPlayedMap[p2.id] ?: 0) +
                                               (lastMatchPlayedMap[p3.id] ?: 0) +
                                               (lastMatchPlayedMap[p4.id] ?: 0)

                                // For these 4 players, there are 3 possible splits:
                                val splits = listOf(
                                    Pair(Pair(p1, p2), Pair(p3, p4)),
                                    Pair(Pair(p1, p3), Pair(p2, p4)),
                                    Pair(Pair(p1, p4), Pair(p2, p3))
                                )

                                for (split in splits) {
                                    val tA = split.first
                                    val tB = split.second

                                    // Rule 1: Partner Cost
                                    val pKeyA = if (tA.first.id < tA.second.id) Pair(tA.first.id, tA.second.id) else Pair(tA.second.id, tA.first.id)
                                    val pKeyB = if (tB.first.id < tB.second.id) Pair(tB.first.id, tB.second.id) else Pair(tB.second.id, tB.first.id)
                                    val partnerCost = (partnerHistoryMap[pKeyA] ?: 0) + (partnerHistoryMap[pKeyB] ?: 0)

                                    // Rule 2: Opponent Cost
                                    val opps = listOf(
                                        Pair(tA.first.id, tB.first.id),
                                        Pair(tA.first.id, tB.second.id),
                                        Pair(tA.second.id, tB.first.id),
                                        Pair(tA.second.id, tB.second.id)
                                    )
                                    var opponentCost = 0
                                    for (o in opps) {
                                        val oKey = if (o.first < o.second) Pair(o.first, o.second) else Pair(o.second, o.first)
                                        opponentCost += opponentHistoryMap[oKey] ?: 0
                                    }

                                    options.add(DoublesOption(tA, tB, gpSum, partnerCost, opponentCost, restSum))
                                }
                            }
                        }
                    }
                }

                // Sort options by: gamesPlayedSum, partnerCost, opponentCost, restSum, then random
                val bestOption = options.sortedWith(
                    compareBy<DoublesOption> { it.gamesPlayedSum }
                        .thenBy { it.partnerCost }
                        .thenBy { it.opponentCost }
                        .thenBy { it.restSum }
                        .thenBy { Random.nextDouble() }
                ).firstOrNull() ?: return null

                MatchEntity(
                    sessionId = sessionId,
                    courtId = courtId,
                    matchNumber = nextMatchNumber,
                    teamAPlayer1Id = bestOption.teamA.first.id,
                    teamAPlayer2Id = bestOption.teamA.second.id,
                    teamBPlayer1Id = bestOption.teamB.first.id,
                    teamBPlayer2Id = bestOption.teamB.second.id,
                    startTime = System.currentTimeMillis()
                )
            }
            "MIXED_DOUBLES" -> {
                val males = candidates.filter { it.first.gender == "MALE" }
                val females = candidates.filter { it.first.gender == "FEMALE" }

                if (males.size < 2 || females.size < 2) return null

                val sortedMales = males.sortedWith(
                    compareBy<Pair<PlayerEntity, SessionPlayerJoinEntity>> { gamesPlayedMap[it.first.id] ?: 0 }
                        .thenBy { lastMatchPlayedMap[it.first.id] ?: 0 }
                        .thenBy { Random.nextDouble() }
                )

                val sortedFemales = females.sortedWith(
                    compareBy<Pair<PlayerEntity, SessionPlayerJoinEntity>> { gamesPlayedMap[it.first.id] ?: 0 }
                        .thenBy { lastMatchPlayedMap[it.first.id] ?: 0 }
                        .thenBy { Random.nextDouble() }
                )

                // Rule 3: Expanded pool (Top 4 males and Top 4 females)
                val poolMales = sortedMales.take(4).map { it.first }
                val poolFemales = sortedFemales.take(4).map { it.first }

                class MixedOption(
                    val teamA: Pair<PlayerEntity, PlayerEntity>,
                    val teamB: Pair<PlayerEntity, PlayerEntity>,
                    val gamesPlayedSum: Int,
                    val partnerCost: Int,
                    val opponentCost: Int,
                    val restSum: Int
                )

                val options = mutableListOf<MixedOption>()

                // Select 2 males and 2 females
                for (mi in 0 until poolMales.size) {
                    for (mj in mi + 1 until poolMales.size) {
                        for (fi in 0 until poolFemales.size) {
                            for (fj in fi + 1 until poolFemales.size) {
                                val m1 = poolMales[mi]
                                val m2 = poolMales[mj]
                                val f1 = poolFemales[fi]
                                val f2 = poolFemales[fj]

                                val gpSum = (gamesPlayedMap[m1.id] ?: 0) +
                                             (gamesPlayedMap[m2.id] ?: 0) +
                                             (gamesPlayedMap[f1.id] ?: 0) +
                                             (gamesPlayedMap[f2.id] ?: 0)

                                val restSum = (lastMatchPlayedMap[m1.id] ?: 0) +
                                               (lastMatchPlayedMap[m2.id] ?: 0) +
                                               (lastMatchPlayedMap[f1.id] ?: 0) +
                                               (lastMatchPlayedMap[f2.id] ?: 0)

                                // Two possible pairings for these 4 players:
                                // Option 1: Team A = {m1, f1}, Team B = {m2, f2}
                                // Option 2: Team A = {m1, f2}, Team B = {m2, f1}
                                val pairings = listOf(
                                    Pair(Pair(m1, f1), Pair(m2, f2)),
                                    Pair(Pair(m1, f2), Pair(m2, f1))
                                )

                                for (pair in pairings) {
                                    val tA = pair.first
                                    val tB = pair.second

                                    // Rule 1: Partner Cost
                                    val pKeyA = if (tA.first.id < tA.second.id) Pair(tA.first.id, tA.second.id) else Pair(tA.second.id, tA.first.id)
                                    val pKeyB = if (tB.first.id < tB.second.id) Pair(tB.first.id, tB.second.id) else Pair(tB.second.id, tB.first.id)
                                    val partnerCost = (partnerHistoryMap[pKeyA] ?: 0) + (partnerHistoryMap[pKeyB] ?: 0)

                                    // Rule 2: Opponent Cost
                                    val opps = listOf(
                                        Pair(tA.first.id, tB.first.id),
                                        Pair(tA.first.id, tB.second.id),
                                        Pair(tA.second.id, tB.first.id),
                                        Pair(tA.second.id, tB.second.id)
                                    )
                                    var opponentCost = 0
                                    for (o in opps) {
                                        val oKey = if (o.first < o.second) Pair(o.first, o.second) else Pair(o.second, o.first)
                                        opponentCost += opponentHistoryMap[oKey] ?: 0
                                    }

                                    options.add(MixedOption(tA, tB, gpSum, partnerCost, opponentCost, restSum))
                                }
                            }
                        }
                    }
                }

                // Sort options by: gamesPlayedSum, partnerCost, opponentCost, restSum, then random
                val bestOption = options.sortedWith(
                    compareBy<MixedOption> { it.gamesPlayedSum }
                        .thenBy { it.partnerCost }
                        .thenBy { it.opponentCost }
                        .thenBy { it.restSum }
                        .thenBy { Random.nextDouble() }
                ).firstOrNull() ?: return null

                MatchEntity(
                    sessionId = sessionId,
                    courtId = courtId,
                    matchNumber = nextMatchNumber,
                    teamAPlayer1Id = bestOption.teamA.first.id,
                    teamAPlayer2Id = bestOption.teamA.second.id,
                    teamBPlayer1Id = bestOption.teamB.first.id,
                    teamBPlayer2Id = bestOption.teamB.second.id,
                    startTime = System.currentTimeMillis()
                )
            }
            else -> null
        }

        if (match != null) {
            dao.insertMatch(match)
        }
        return match
    }

    // Club Settings
    val clubDetails: Flow<ClubEntity?> = dao.getClubDetails()

    suspend fun saveClubDetails(club: ClubEntity) {
        dao.insertClubDetails(club)
        if (realtimeDatabaseRepository.isAvailable()) {
            val userId = firebaseAuthRepository.getCurrentUserId()
            val clubId = if (!userId.isNullOrBlank()) "club_$userId" else "club_${club.id}"
            realtimeDatabaseRepository.saveClub(club, customClubId = clubId)
        }
    }

    suspend fun clearClubDetails() {
        dao.clearClubDetails()
    }

    suspend fun addPlayerToSessionWithPAYG(sessionId: Int, playerId: Int, isPAYG: Boolean) {
        val joins = dao.getSessionPlayers(sessionId).firstOrNull() ?: emptyList()
        val currentJoin = joins.find { it.playerId == playerId }
        if (currentJoin != null) {
            dao.insertSessionPlayer(currentJoin.copy(isPAYG = isPAYG))
            return
        }

        val session = dao.getSessionById(sessionId)
        val courts = dao.getCourtsForSession(sessionId).firstOrNull() ?: emptyList()
        val matches = dao.getMatchesForSession(sessionId).firstOrNull() ?: emptyList()

        val avgGames = if (session != null && session.status == "Active" && session.startTime != null && courts.isNotEmpty()) {
            Math.round(matches.size.toDouble() / courts.size).toInt()
        } else {
            0
        }

        dao.insertSessionPlayer(
            SessionPlayerJoinEntity(
                sessionId = sessionId,
                playerId = playerId,
                isPaused = false,
                eligibleCourtIds = null,
                isPAYG = isPAYG,
                adjustedGames = avgGames
            )
        )
    }

    // Weekly Sessions
    val allWeeklySessions: Flow<List<WeeklySessionEntity>> = dao.getAllWeeklySessions()

    suspend fun getWeeklySessionById(id: Int): WeeklySessionEntity? = dao.getWeeklySessionById(id)

    suspend fun createWeeklySession(
        name: String,
        dayOfWeek: String,
        time: String,
        type: String,
        managerId: Int? = null,
        managerName: String? = null,
        manager2Id: Int? = null,
        manager2Name: String? = null,
        targetScore: Int? = null
    ): Long {
        val club = dao.getClubDetails().firstOrNull()
        val defaultScore = targetScore ?: club?.targetScore ?: 21
        val session = WeeklySessionEntity(
            name = name,
            dayOfWeek = dayOfWeek,
            time = time,
            type = type,
            managerId = managerId,
            managerName = managerName,
            manager2Id = manager2Id,
            manager2Name = manager2Name,
            targetScore = defaultScore
        )
        return dao.insertWeeklySession(session)
    }

    suspend fun updateWeeklySession(session: WeeklySessionEntity) {
        dao.insertWeeklySession(session)
    }

    suspend fun deleteWeeklySession(id: Int) {
        dao.clearWeeklySessionMembers(id)
        dao.clearWeeklySessionCourts(id)
        dao.deleteWeeklySession(id)
    }

    // Weekly Session Members
    fun getWeeklySessionMembers(weeklySessionId: Int): Flow<List<WeeklySessionMemberEntity>> = dao.getWeeklySessionMembers(weeklySessionId)

    val allWeeklySessionMembers: Flow<List<WeeklySessionMemberEntity>> = dao.getAllWeeklySessionMembers()

    suspend fun addMemberToWeeklySession(weeklySessionId: Int, memberId: Int) {
        dao.insertWeeklySessionMember(WeeklySessionMemberEntity(weeklySessionId, memberId))
    }

    suspend fun removeMemberFromWeeklySession(weeklySessionId: Int, memberId: Int) {
        dao.deleteWeeklySessionMember(weeklySessionId, memberId)
    }

    // Weekly Session Courts
    fun getWeeklySessionCourts(weeklySessionId: Int): Flow<List<WeeklySessionCourtEntity>> = dao.getWeeklySessionCourts(weeklySessionId)

    suspend fun addCourtToWeeklySession(weeklySessionId: Int, name: String, gameType: String) {
        dao.insertWeeklySessionCourt(WeeklySessionCourtEntity(weeklySessionId = weeklySessionId, name = name.trim().uppercase(), gameType = gameType))
    }

    suspend fun deleteCourtFromWeeklySession(courtId: Int) {
        dao.deleteWeeklySessionCourt(courtId)
    }

    suspend fun instantiateWeeklySession(weeklySessionId: Int): Long {
        val weeklySession = dao.getWeeklySessionById(weeklySessionId) ?: return -1L
        val club = dao.getClubDetails().firstOrNull()
        val defaultScore = if (weeklySession.targetScore > 0) weeklySession.targetScore else (club?.targetScore ?: 21)
        
        // 1. Deactivate other sessions
        dao.deactivateAllSessions()
        
        // 2. Create concrete session
        val session = SessionEntity(
            name = "${weeklySession.name} (${java.text.SimpleDateFormat("MMM dd", java.util.Locale.getDefault()).format(java.util.Date())})",
            type = weeklySession.type,
            isActive = true,
            status = "Setting Up",
            weeklySessionId = weeklySession.id,
            managerId = weeklySession.managerId,
            managerName = weeklySession.managerName,
            manager2Id = weeklySession.manager2Id,
            manager2Name = weeklySession.manager2Name,
            targetScore = defaultScore
        )
        val sessionId = dao.insertSession(session).toInt()
        
        // 3. Copy players (permanent members)
        val members = dao.getWeeklySessionMembers(weeklySessionId).firstOrNull() ?: emptyList()
        members.forEach { member ->
            dao.insertSessionPlayer(
                SessionPlayerJoinEntity(
                    sessionId = sessionId,
                    playerId = member.memberId,
                    isPaused = false,
                    eligibleCourtIds = null,
                    isPAYG = false
                )
            )
        }
        
        // 4. Copy courts
        val courts = dao.getWeeklySessionCourts(weeklySessionId).firstOrNull() ?: emptyList()
        courts.forEach { court ->
            dao.insertCourt(
                CourtEntity(
                    sessionId = sessionId,
                    name = court.name,
                    gameType = court.gameType
                )
            )
        }
        
        return sessionId.toLong()
    }

    suspend fun createSessionManager(name: String, email: String, inviteStatus: String = "INVITED"): Long {
        return dao.insertSessionManager(
            SessionManagerEntity(
                name = name.trim(),
                email = email.trim(),
                inviteStatus = inviteStatus
            )
        )
    }

    suspend fun provisionSessionManager(name: String, email: String): Result<String> {
        val cleanName = name.trim()
        val cleanEmail = email.trim()
        
        // 1. Insert or update in local Room DB
        val id = dao.insertSessionManager(
            SessionManagerEntity(
                name = cleanName,
                email = cleanEmail,
                inviteStatus = "INVITING"
            )
        ).toInt()

        // 2. Provision on Firebase Authentication and dispatch password reset email
        val authResult = firebaseAuthRepository.provisionManagerAccountAndSendResetEmail(cleanEmail, cleanName)
        
        if (authResult.isSuccess) {
            dao.insertSessionManager(
                SessionManagerEntity(
                    id = id,
                    name = cleanName,
                    email = cleanEmail,
                    inviteStatus = "INVITED"
                )
            )
        } else {
            dao.insertSessionManager(
                SessionManagerEntity(
                    id = id,
                    name = cleanName,
                    email = cleanEmail,
                    inviteStatus = "INVITED" // Keep as invited so user can retry or manager can reset password
                )
            )
        }

        // 3. Register Session Manager in user_club_index
        try {
            val club = dao.getClubDetails().firstOrNull()
            val effectiveClubId = getEffectiveClubId()
            realtimeDatabaseRepository.registerUserClubAssociation(
                UserClubAssociation(
                    email = cleanEmail,
                    clubId = effectiveClubId,
                    clubName = club?.name ?: "Badminton Club",
                    role = "SESSION_MANAGER",
                    managerId = id,
                    managerName = cleanName,
                    venue = club?.venue ?: "",
                    updatedAt = System.currentTimeMillis()
                )
            )
        } catch (e: Exception) {
            Log.w("BadmintonRepository", "Warning indexing session manager $cleanEmail: ${e.message}")
        }

        return authResult
    }

    suspend fun deleteSessionManager(id: Int) {
        val manager = dao.getSessionManagerById(id)
        val managerEmail = manager?.email
        val effectiveClubId = getEffectiveClubId()

        // 1. Delete from Local Room Database FIRST so UI immediately reflects removal
        dao.deleteSessionManager(id)
        if (!managerEmail.isNullOrBlank()) {
            dao.deleteSessionManagerByEmail(managerEmail)
        }
        dao.clearManager1FromWeeklySessions(id)
        dao.clearManager2FromWeeklySessions(id)
        dao.clearManager1FromSessions(id)
        dao.clearManager2FromSessions(id)

        // 2. Delete from Firebase Auth & revoke credentials
        if (!managerEmail.isNullOrBlank()) {
            try {
                firebaseAuthRepository.deleteManagerAccount(managerEmail)
            } catch (e: Exception) {
                Log.w("BadmintonRepository", "Firebase auth delete warning for manager $managerEmail: ${e.message}")
            }
        }

        // 3. Delete from Cloud Databases (Firestore & Realtime DB & user_club_index)
        try {
            firestoreRepository.deleteSessionManager(effectiveClubId, "manager_$id")
            realtimeDatabaseRepository.deleteSessionManager(effectiveClubId, "manager_$id")
            if (!managerEmail.isNullOrBlank()) {
                realtimeDatabaseRepository.removeUserClubAssociation(managerEmail, effectiveClubId)
            }
        } catch (e: Exception) {
            Log.w("BadmintonRepository", "Cloud delete warning for manager $id: ${e.message}")
        }
    }

    suspend fun clearAllSessionManagers() {
        dao.clearAllSessionManagers()
    }

    suspend fun clearAllLocalData() {
        Log.d("BadmintonRepository", "Purging all local club data from Room database...")
        setActiveClubId(null)
        dao.clearAllSessions()
        dao.clearAllPlayers()
        dao.clearAllSessionPlayers()
        dao.clearAllCourts()
        dao.clearAllCourtMasters()
        dao.clearAllMatches()
        dao.clearClubDetails()
        dao.clearAllWeeklySessions()
        dao.clearAllWeeklySessionMembers()
        dao.clearAllWeeklySessionCourts()
        dao.clearAllSessionManagers()
    }

    suspend fun hasClubData(): Boolean {
        val club = dao.getClubDetails().firstOrNull()
        val players = dao.getAllPlayers().firstOrNull() ?: emptyList()
        val sessions = dao.getAllSessions().firstOrNull() ?: emptyList()
        val weeklySessions = dao.getAllWeeklySessions().firstOrNull() ?: emptyList()
        return club != null || players.isNotEmpty() || sessions.isNotEmpty() || weeklySessions.isNotEmpty()
    }

    suspend fun discoverClubsForUser(email: String): Result<List<UserClubAssociation>> {
        val uid = firebaseAuthRepository.getCurrentUserId()
        return realtimeDatabaseRepository.findClubsForUser(email, fallbackUid = uid)
    }

    suspend fun selectAndRestoreClub(association: UserClubAssociation): Result<Boolean> {
        clearAllLocalData()
        setActiveClubId(association.clubId)
        val restoreResult = restoreClubFromRealtimeDatabase(association.clubId)
        return restoreResult
    }

    suspend fun restoreClubFromRealtimeDatabase(clubId: String): Result<Boolean> {
        if (realtimeDatabaseRepository.isAvailable()) {
            return realtimeDatabaseRepository.restoreClubData(clubId, dao)
        }
        return Result.success(false)
    }

    fun getEffectiveDatabaseUrl(): String = realtimeDatabaseRepository.getEffectiveDatabaseUrl()

    fun setCustomDatabaseUrl(url: String?) = realtimeDatabaseRepository.setCustomDatabaseUrl(url)

    suspend fun runDatabaseDiagnostics(): RealtimeDatabaseDiagnostic {
        val userId = firebaseAuthRepository.getCurrentUserId()
        val clubId = if (!userId.isNullOrBlank()) "club_$userId" else "club_1"
        return realtimeDatabaseRepository.runDiagnostics(clubId)
    }
}
