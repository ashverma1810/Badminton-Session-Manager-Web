package com.example.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.database.*
import com.example.data.repository.*
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class BadmintonViewModel(application: Application) : AndroidViewModel(application) {

    private val database = AppDatabase.getDatabase(application)
    private val repository = BadmintonRepository(database.badmintonDao())

    val allSessions: StateFlow<List<SessionEntity>> = repository.allSessions
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val activeSession: StateFlow<SessionEntity?> = repository.activeSession
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val allPlayers: StateFlow<List<PlayerEntity>> = repository.allPlayers
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allMasterCourts: StateFlow<List<CourtMasterEntity>> = repository.allMasterCourts
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allSessionManagers: StateFlow<List<SessionManagerEntity>> = repository.allSessionManagers
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Active session sub-flows
    private val _activeSessionCourts = MutableStateFlow<List<CourtEntity>>(emptyList())
    val activeSessionCourts: StateFlow<List<CourtEntity>> = _activeSessionCourts

    private val _activeSessionPlayers = MutableStateFlow<List<SessionPlayerJoinEntity>>(emptyList())
    val activeSessionPlayers: StateFlow<List<SessionPlayerJoinEntity>> = _activeSessionPlayers

    private val _activeSessionMatches = MutableStateFlow<List<MatchEntity>>(emptyList())
    val activeSessionMatches: StateFlow<List<MatchEntity>> = _activeSessionMatches

    private var activeSessionCollectionJob: Job? = null

    // Combined Player statistics for active session
    val activeSessionPlayerStats: StateFlow<List<PlayerStats>> = combine(
        allPlayers,
        _activeSessionPlayers,
        _activeSessionMatches,
        _activeSessionCourts
    ) { players, joins, matches, courts ->
        val activeSessionPlayersList = players.filter { p -> joins.any { j -> j.playerId == p.id } }
        val joinsMap = joins.associateBy { it.playerId }
        StatsCalculator.calculatePlayerStats(activeSessionPlayersList, matches, joinsMap, courts.size)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Overall Session Statistics
    val activeSessionStats: StateFlow<SessionStats?> = combine(
        activeSession,
        _activeSessionCourts,
        _activeSessionMatches
    ) { session, courts, matches ->
        if (session != null) {
            StatsCalculator.calculateSessionStats(session, courts, matches)
        } else {
            null
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    init {
        // Collect activeSession changes to dynamically observe the details of the active session
        viewModelScope.launch {
            activeSession.collect { session ->
                activeSessionCollectionJob?.cancel()
                if (session != null) {
                    activeSessionCollectionJob = launch {
                        launch {
                            repository.getCourtsForSession(session.id).collect {
                                _activeSessionCourts.value = it
                            }
                        }
                        launch {
                            repository.getSessionPlayers(session.id).collect {
                                _activeSessionPlayers.value = it
                            }
                        }
                        launch {
                            repository.getMatchesForSession(session.id).collect {
                                _activeSessionMatches.value = it
                            }
                        }
                    }
                } else {
                    _activeSessionCourts.value = emptyList()
                    _activeSessionPlayers.value = emptyList()
                    _activeSessionMatches.value = emptyList()
                }
            }
        }
    }

    // --- Actions ---

    fun createSession(
        name: String,
        type: String,
        targetScore: Int? = null,
        managerId: Int? = null,
        managerName: String? = null,
        manager2Id: Int? = null,
        manager2Name: String? = null
    ) {
        viewModelScope.launch {
            repository.createSession(
                name = name,
                type = type,
                targetScore = targetScore,
                managerId = managerId,
                managerName = managerName,
                manager2Id = manager2Id,
                manager2Name = manager2Name
            )
        }
    }

    fun updateSessionTargetScore(sessionId: Int, targetScore: Int) {
        viewModelScope.launch {
            repository.updateSessionTargetScore(sessionId, targetScore)
        }
    }

    fun deleteSession(sessionId: Int) {
        viewModelScope.launch {
            repository.deleteSession(sessionId)
        }
    }

    fun startSession() {
        val session = activeSession.value ?: return
        viewModelScope.launch {
            repository.startSession(session.id)
            // Automatically schedule matches for all courts
            generateMatchesForAllCourts()
        }
    }

    fun stopSession() {
        val session = activeSession.value ?: return
        viewModelScope.launch {
            repository.stopSession(session.id)
        }
    }

    // Master Players Management
    fun addPlayerToMaster(name: String, gender: String, isPAYG: Boolean = false) {
        viewModelScope.launch {
            repository.createPlayer(name, gender, isPAYG)
        }
    }

    fun deletePlayerFromMaster(playerId: Int) {
        viewModelScope.launch {
            repository.deletePlayer(playerId)
        }
    }

    fun convertPAYGToPermanent(playerId: Int) {
        viewModelScope.launch {
            repository.convertPAYGToPermanent(playerId)
        }
    }

    fun createAndAddPlayerToWeeklySession(name: String, gender: String, weeklySessionId: Int) {
        viewModelScope.launch {
            val playerId = repository.createPlayer(name, gender, isPAYG = false)
            repository.addMemberToWeeklySession(weeklySessionId, playerId.toInt())
        }
    }

    // Active Session Player Management
    fun addPlayerToSessionWithPAYG(sessionId: Int, playerId: Int, isPAYG: Boolean) {
        viewModelScope.launch {
            repository.addPlayerToSessionWithPAYG(sessionId, playerId, isPAYG)
        }
    }

    // Active Session Player Management
    fun addPlayerToActiveSession(playerId: Int) {
        val session = activeSession.value ?: return
        viewModelScope.launch {
            repository.addPlayerToSession(session.id, playerId)
        }
    }

    fun removePlayerFromActiveSession(playerId: Int) {
        val session = activeSession.value ?: return
        viewModelScope.launch {
            repository.removePlayerFromSession(session.id, playerId)
        }
    }

    fun togglePlayerPause(playerId: Int) {
        val session = activeSession.value ?: return
        val joins = _activeSessionPlayers.value
        val currentJoin = joins.find { it.playerId == playerId } ?: return
        viewModelScope.launch {
            repository.setPlayerPauseStatus(session.id, playerId, !currentJoin.isPaused)
        }
    }

    fun updatePlayerCourtEligibility(playerId: Int, eligibleCourtIds: List<Int>?) {
        val session = activeSession.value ?: return
        viewModelScope.launch {
            repository.updatePlayerCourtEligibility(session.id, playerId, eligibleCourtIds)
        }
    }

    // Court Management
    fun addCourtToActiveSession(name: String, gameType: String? = null) {
        val session = activeSession.value ?: return
        viewModelScope.launch {
            val masterExists = repository.allMasterCourts.firstOrNull()?.any { it.name.equals(name, ignoreCase = true) } ?: false
            if (!masterExists) {
                repository.createMasterCourt(name)
            }
            val resolvedType = gameType ?: if (session.type == "MULTI_TYPE") "DOUBLES" else session.type
            repository.createCourt(session.id, name, resolvedType)
        }
    }

    fun addMasterCourtToActiveSession(court: CourtMasterEntity, gameType: String? = null) {
        val session = activeSession.value ?: return
        viewModelScope.launch {
            val resolvedType = gameType ?: if (session.type == "MULTI_TYPE") "DOUBLES" else session.type
            repository.createCourt(session.id, court.name, resolvedType)
        }
    }

    fun updateCourtGameType(courtId: Int, gameType: String) {
        viewModelScope.launch {
            repository.updateCourtGameType(courtId, gameType)
        }
    }

    fun addCourtToMaster(name: String) {
        viewModelScope.launch {
            repository.createMasterCourt(name)
        }
    }

    fun deleteCourtFromMaster(courtId: Int) {
        viewModelScope.launch {
            repository.deleteMasterCourt(courtId)
        }
    }

    fun updateSessionStatus(sessionId: Int, status: String) {
        viewModelScope.launch {
            repository.updateSessionStatus(sessionId, status)
        }
    }

    fun deleteCourtFromActiveSession(courtId: Int) {
        viewModelScope.launch {
            repository.deleteCourt(courtId)
        }
    }

    // Match Entry
    fun enterMatchScore(matchId: Int, scoreA: Int, scoreB: Int) {
        viewModelScope.launch {
            repository.recordMatchScore(matchId, scoreA, scoreB)
        }
    }

    fun deleteMatch(matchId: Int) {
        viewModelScope.launch {
            repository.deleteMatch(matchId)
        }
    }

    fun substitutePlayer(matchId: Int, playerToReplaceId: Int, newPlayerId: Int) {
        viewModelScope.launch {
            repository.substitutePlayer(matchId, playerToReplaceId, newPlayerId)
        }
    }

    // Force/Auto generation
    fun generateMatchForCourt(courtId: Int) {
        val session = activeSession.value ?: return
        viewModelScope.launch {
            repository.generateNextMatchForCourt(session.id, courtId)
        }
    }

    fun generateMatchesForAllCourts() {
        val session = activeSession.value ?: return
        val courts = _activeSessionCourts.value
        val activeMatches = _activeSessionMatches.value.filter { it.endTime == null }

        viewModelScope.launch {
            for (court in courts) {
                val hasActiveMatch = activeMatches.any { it.courtId == court.id }
                if (!hasActiveMatch) {
                    repository.generateNextMatchForCourt(session.id, court.id)
                }
            }
        }
    }

    fun getMatchesForSession(sessionId: Int): Flow<List<MatchEntity>> {
        return repository.getMatchesForSession(sessionId)
    }

    fun getCourtsForSession(sessionId: Int): Flow<List<CourtEntity>> {
        return repository.getCourtsForSession(sessionId)
    }

    fun getSessionPlayers(sessionId: Int): Flow<List<SessionPlayerJoinEntity>> {
        return repository.getSessionPlayers(sessionId)
    }

    // A clean backing state for historical stats
    private val _historicalLeaderboard = MutableStateFlow<List<PlayerStats>>(emptyList())
    val historicalLeaderboardState: StateFlow<List<PlayerStats>> = _historicalLeaderboard

    private val _historicalSessionsWithStats = MutableStateFlow<List<Pair<SessionEntity, SessionStats>>>(emptyList())
    val historicalSessionsWithStats: StateFlow<List<Pair<SessionEntity, SessionStats>>> = _historicalSessionsWithStats

    private val _historicalSessionsWithMatches = MutableStateFlow<List<Triple<SessionEntity, SessionStats, List<MatchEntity>>>>(emptyList())
    val historicalSessionsWithMatches: StateFlow<List<Triple<SessionEntity, SessionStats, List<MatchEntity>>>> = _historicalSessionsWithMatches

    fun refreshHistoricalData() {
        viewModelScope.launch {
            val sessions = database.badmintonDao().getAllSessions().firstOrNull() ?: emptyList()
            val players = database.badmintonDao().getAllPlayers().firstOrNull() ?: emptyList()
            
            val historicalSessions = sessions.filter { !it.isActive && it.startTime != null }
            val sessionStatsList = mutableListOf<Pair<SessionEntity, SessionStats>>()
            val sessionsWithMatches = mutableListOf<Triple<SessionEntity, SessionStats, List<MatchEntity>>>()
            val allCompletedMatches = mutableListOf<MatchEntity>()

            for (session in historicalSessions) {
                val courts = database.badmintonDao().getCourtsForSession(session.id).firstOrNull() ?: emptyList()
                val matches = database.badmintonDao().getMatchesForSession(session.id).firstOrNull() ?: emptyList()
                
                val stats = StatsCalculator.calculateSessionStats(session, courts, matches)
                sessionStatsList.add(Pair(session, stats))
                
                val completedMatches = matches.filter { it.endTime != null }
                allCompletedMatches.addAll(completedMatches)
                
                sessionsWithMatches.add(Triple(session, stats, completedMatches))
            }

            _historicalSessionsWithStats.value = sessionStatsList
            _historicalSessionsWithMatches.value = sessionsWithMatches
            _historicalLeaderboard.value = StatsCalculator.calculatePlayerStats(players, allCompletedMatches)
        }
    }

    // Club Details Settings
    val clubDetails: StateFlow<ClubEntity?> = repository.clubDetails
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    fun saveClubDetails(
        name: String,
        venue: String,
        defaultSessionType: String,
        themeColorHex: String,
        targetScore: Int,
        contactPerson: String = "",
        description: String = ""
    ) {
        viewModelScope.launch {
            repository.saveClubDetails(
                ClubEntity(
                    name = name,
                    venue = venue,
                    defaultSessionType = defaultSessionType,
                    themeColorHex = themeColorHex,
                    targetScore = targetScore,
                    contactPerson = contactPerson,
                    description = description
                )
            )
        }
    }

    // Weekly Sessions
    val allWeeklySessions: StateFlow<List<WeeklySessionEntity>> = repository.allWeeklySessions
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allWeeklySessionMembers: StateFlow<List<WeeklySessionMemberEntity>> = repository.allWeeklySessionMembers
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun createWeeklySession(
        name: String,
        dayOfWeek: String,
        time: String,
        type: String,
        managerId: Int? = null,
        managerName: String? = null,
        manager2Id: Int? = null,
        manager2Name: String? = null,
        targetScore: Int? = null
    ) {
        viewModelScope.launch {
            repository.createWeeklySession(
                name = name,
                dayOfWeek = dayOfWeek,
                time = time,
                type = type,
                managerId = managerId,
                managerName = managerName,
                manager2Id = manager2Id,
                manager2Name = manager2Name,
                targetScore = targetScore
            )
        }
    }

    fun updateWeeklySession(session: WeeklySessionEntity) {
        viewModelScope.launch {
            repository.updateWeeklySession(session)
        }
    }

    fun deleteWeeklySession(id: Int) {
        viewModelScope.launch {
            repository.deleteWeeklySession(id)
        }
    }

    fun addMemberToWeeklySession(weeklySessionId: Int, memberId: Int) {
        viewModelScope.launch {
            repository.addMemberToWeeklySession(weeklySessionId, memberId)
        }
    }

    fun removeMemberFromWeeklySession(weeklySessionId: Int, memberId: Int) {
        viewModelScope.launch {
            repository.removeMemberFromWeeklySession(weeklySessionId, memberId)
        }
    }

    fun getWeeklySessionMembers(weeklySessionId: Int): Flow<List<WeeklySessionMemberEntity>> = 
        repository.getWeeklySessionMembers(weeklySessionId)

    fun getWeeklySessionCourts(weeklySessionId: Int): Flow<List<WeeklySessionCourtEntity>> = 
        repository.getWeeklySessionCourts(weeklySessionId)

    fun addCourtToWeeklySession(weeklySessionId: Int, name: String, gameType: String) {
        viewModelScope.launch {
            repository.addCourtToWeeklySession(weeklySessionId, name, gameType)
        }
    }

    fun deleteCourtFromWeeklySession(courtId: Int) {
        viewModelScope.launch {
            repository.deleteCourtFromWeeklySession(courtId)
        }
    }

    fun instantiateWeeklySession(weeklySessionId: Int, onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            repository.instantiateWeeklySession(weeklySessionId)
            onComplete()
        }
    }

    fun addPAYGPlayerToActiveSession(name: String, gender: String) {
        val session = activeSession.value ?: return
        viewModelScope.launch {
            val playersList = repository.allPlayers.firstOrNull() ?: emptyList()
            val existingPlayer = playersList.find { it.name.equals(name, ignoreCase = true) }
            val playerId = if (existingPlayer != null) {
                existingPlayer.id
            } else {
                repository.createPlayer(name, gender, isPAYG = true).toInt()
            }
            repository.addPlayerToSessionWithPAYG(session.id, playerId, isPAYG = true)
        }
    }

    // --- Firebase Auth & Cloud Sync ---
    val currentFirebaseUser = repository.firebaseAuthRepository.currentUser
    val availableClubsForLogin = MutableStateFlow<List<UserClubAssociation>?>(null)

    fun signInWithEmail(email: String, pass: String, onResult: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            val cleanEmail = email.trim()
            val result = repository.firebaseAuthRepository.signInWithEmail(cleanEmail, pass)
            if (result.isSuccess) {
                // 1. Discover all clubs for this user from user_club_index
                val discoveryResult = repository.discoverClubsForUser(cleanEmail)
                val clubs = discoveryResult.getOrNull() ?: emptyList()

                if (clubs.size == 1) {
                    val targetClub = clubs.first()
                    val restoreRes = repository.selectAndRestoreClub(targetClub)
                    if (restoreRes.isSuccess && restoreRes.getOrNull() == true) {
                        val roleLabel = if (targetClub.role == "CLUB_MANAGER") "Club Manager" else "Session Manager"
                        onResult(true, "Signed in! Loaded ${targetClub.clubName} as $roleLabel")
                    } else {
                        onResult(true, "Signed in to ${targetClub.clubName}")
                    }
                } else if (clubs.size > 1) {
                    // Multi-club selection
                    availableClubsForLogin.value = clubs
                    onResult(true, "MULTI_CLUB")
                } else {
                    // 0 clubs found in index
                    // If user has local data, maintain it and sync
                    val hasData = repository.hasClubData()
                    if (hasData) {
                        repository.fullClubSync()
                        onResult(true, "Signed in with existing local club")
                    } else {
                        onResult(false, "NO_CLUB_FOUND: No club associated with $cleanEmail. You can register a new club below.")
                    }
                }
            } else {
                onResult(false, result.exceptionOrNull()?.localizedMessage ?: "Sign in failed")
            }
        }
    }

    fun selectClubAndProceed(association: UserClubAssociation, onResult: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            val res = repository.selectAndRestoreClub(association)
            availableClubsForLogin.value = null
            if (res.isSuccess) {
                val roleLabel = if (association.role == "CLUB_MANAGER") "Club Manager" else "Session Manager"
                onResult(true, "Loaded ${association.clubName} as $roleLabel")
            } else {
                onResult(false, res.exceptionOrNull()?.localizedMessage ?: "Failed to load club")
            }
        }
    }

    fun dismissMultiClubSelection() {
        availableClubsForLogin.value = null
    }

    fun signUpWithEmail(email: String, pass: String, onResult: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            val cleanEmail = email.trim()
            val result = repository.firebaseAuthRepository.signUpWithEmail(cleanEmail, pass)
            if (result.isSuccess) {
                val user = result.getOrNull()
                if (user != null) {
                    repository.setActiveClubId("club_${user.uid}")
                }
                // Immediately sync local club to cloud and index it
                repository.fullClubSync()
                onResult(true, null)
            } else {
                onResult(false, result.exceptionOrNull()?.localizedMessage ?: "Sign up failed")
            }
        }
    }

    fun signOutFirebase() {
        repository.firebaseAuthRepository.signOut()
        viewModelScope.launch {
            repository.clearAllLocalData()
        }
    }

    fun signOutAndClearLocalData(syncFirst: Boolean, onResult: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            if (syncFirst) {
                val syncRes = repository.fullClubSync()
                if (syncRes.isSuccess) {
                    repository.firebaseAuthRepository.signOut()
                    repository.clearAllLocalData()
                    onResult(true, "All club data synchronized to Firebase Realtime Database and cleared from local storage.")
                } else {
                    val err = syncRes.exceptionOrNull()?.localizedMessage ?: "Sync failed"
                    onResult(false, err)
                }
            } else {
                repository.firebaseAuthRepository.signOut()
                repository.clearAllLocalData()
                onResult(true, "Signed out and cleared all local club data from this device.")
            }
        }
    }

    fun sendPasswordResetEmail(email: String, onResult: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            val result = repository.firebaseAuthRepository.sendPasswordResetEmail(email)
            if (result.isSuccess) {
                onResult(true, "Password reset email sent to $email")
            } else {
                onResult(false, result.exceptionOrNull()?.localizedMessage ?: "Failed to send reset email")
            }
        }
    }

    fun createSessionManager(name: String, email: String, sendEmail: Boolean = true, onResult: ((Boolean, String?) -> Unit)? = null) {
        viewModelScope.launch {
            if (name.isBlank() || email.isBlank()) {
                onResult?.invoke(false, "Name and Email cannot be empty")
                return@launch
            }
            if (sendEmail) {
                val res = repository.provisionSessionManager(name, email)
                if (res.isSuccess) {
                    onResult?.invoke(true, res.getOrNull() ?: "Session manager created and password setup email sent to $email")
                } else {
                    onResult?.invoke(true, "Session manager added. (Email notice: ${res.exceptionOrNull()?.localizedMessage ?: "Verify email address"})")
                }
            } else {
                repository.createSessionManager(name, email, inviteStatus = "PENDING")
                onResult?.invoke(true, "Session manager added")
            }
        }
    }

    fun deleteSessionManager(id: Int) {
        viewModelScope.launch {
            repository.deleteSessionManager(id)
        }
    }

    fun sendPasswordSetupEmailToManager(email: String, name: String = "", onResult: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            if (email.isBlank()) {
                onResult(false, "Email cannot be blank")
                return@launch
            }
            val res = repository.firebaseAuthRepository.provisionManagerAccountAndSendResetEmail(email.trim(), name.trim())
            if (res.isSuccess) {
                onResult(true, "Password setup email sent to $email")
            } else {
                onResult(false, res.exceptionOrNull()?.localizedMessage ?: "Could not send setup email to $email")
            }
        }
    }

    fun sendPasswordSetupEmailToAllManagers(onComplete: (Int, Int) -> Unit) {
        viewModelScope.launch {
            val managers = allSessionManagers.value
            if (managers.isEmpty()) {
                onComplete(0, 0)
                return@launch
            }
            var successCount = 0
            var failCount = 0
            for (manager in managers) {
                if (manager.email.isNotBlank()) {
                    val result = repository.firebaseAuthRepository.provisionManagerAccountAndSendResetEmail(manager.email.trim(), manager.name)
                    if (result.isSuccess) {
                        successCount++
                    } else {
                        failCount++
                    }
                }
            }
            onComplete(successCount, failCount)
        }
    }

    fun manualCloudSync(onResult: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            val res = repository.fullClubSync()
            if (res.isSuccess) {
                onResult(true, res.getOrNull() ?: "Club data successfully synced to cloud!")
            } else {
                onResult(false, res.exceptionOrNull()?.localizedMessage ?: "Sync failed")
            }
        }
    }

    fun getEffectiveDatabaseUrl(): String = repository.getEffectiveDatabaseUrl()

    fun setCustomDatabaseUrl(url: String?) = repository.setCustomDatabaseUrl(url)

    fun runDatabaseDiagnostics(onResult: (com.example.data.repository.RealtimeDatabaseDiagnostic) -> Unit) {
        viewModelScope.launch {
            val diag = repository.runDatabaseDiagnostics()
            onResult(diag)
        }
    }
}
