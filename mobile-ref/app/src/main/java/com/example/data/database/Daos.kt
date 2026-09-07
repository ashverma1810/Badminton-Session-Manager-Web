package com.example.data.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface BadmintonDao {
    // Session queries
    @Query("SELECT * FROM sessions ORDER BY createdAt DESC")
    fun getAllSessions(): Flow<List<SessionEntity>>

    @Query("SELECT * FROM sessions WHERE isActive = 1 LIMIT 1")
    fun getActiveSession(): Flow<SessionEntity?>

    @Query("SELECT * FROM sessions WHERE id = :id")
    suspend fun getSessionById(id: Int): SessionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSession(session: SessionEntity): Long

    @Update
    suspend fun updateSession(session: SessionEntity)

    @Query("UPDATE sessions SET isActive = 0")
    suspend fun deactivateAllSessions()

    // Player queries
    @Query("SELECT * FROM players ORDER BY name ASC")
    fun getAllPlayers(): Flow<List<PlayerEntity>>

    @Query("SELECT * FROM players WHERE id = :id")
    suspend fun getPlayerById(id: Int): PlayerEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlayer(player: PlayerEntity): Long

    @Query("DELETE FROM players WHERE id = :id")
    suspend fun deletePlayer(id: Int)

    // SessionPlayerJoin queries
    @Query("SELECT * FROM session_players WHERE sessionId = :sessionId")
    fun getSessionPlayers(sessionId: Int): Flow<List<SessionPlayerJoinEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSessionPlayer(join: SessionPlayerJoinEntity)

    @Query("DELETE FROM session_players WHERE sessionId = :sessionId AND playerId = :playerId")
    suspend fun removePlayerFromSession(sessionId: Int, playerId: Int)

    @Query("DELETE FROM session_players WHERE sessionId = :sessionId")
    suspend fun clearSessionPlayers(sessionId: Int)

    // Court queries
    @Query("SELECT * FROM courts WHERE sessionId = :sessionId ORDER BY id ASC")
    fun getCourtsForSession(sessionId: Int): Flow<List<CourtEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCourt(court: CourtEntity): Long

    @Query("DELETE FROM courts WHERE id = :id")
    suspend fun deleteCourt(id: Int)

    @Query("UPDATE courts SET gameType = :gameType WHERE id = :courtId")
    suspend fun updateCourtGameType(courtId: Int, gameType: String)

    @Query("DELETE FROM courts WHERE sessionId = :sessionId")
    suspend fun clearCourts(sessionId: Int)

    // Court Master queries
    @Query("SELECT * FROM court_master ORDER BY name ASC")
    fun getAllMasterCourts(): Flow<List<CourtMasterEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMasterCourt(court: CourtMasterEntity): Long

    @Query("DELETE FROM court_master WHERE id = :id")
    suspend fun deleteMasterCourt(id: Int)

    @Query("DELETE FROM sessions WHERE id = :id")
    suspend fun deleteSessionOnly(id: Int)

    // Match queries
    @Query("SELECT * FROM matches WHERE sessionId = :sessionId ORDER BY matchNumber DESC")
    fun getMatchesForSession(sessionId: Int): Flow<List<MatchEntity>>

    @Query("SELECT * FROM matches WHERE sessionId = :sessionId AND endTime IS NULL")
    fun getActiveMatchesForSession(sessionId: Int): Flow<List<MatchEntity>>

    @Query("SELECT * FROM matches WHERE id = :id")
    suspend fun getMatchById(id: Int): MatchEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMatch(match: MatchEntity): Long

    @Update
    suspend fun updateMatch(match: MatchEntity)

    @Query("DELETE FROM matches WHERE id = :id")
    suspend fun deleteMatch(id: Int)

    @Query("DELETE FROM matches WHERE sessionId = :sessionId")
    suspend fun clearMatches(sessionId: Int)

    // Club queries
    @Query("SELECT * FROM club_details LIMIT 1")
    fun getClubDetails(): Flow<ClubEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertClubDetails(club: ClubEntity)

    @Query("DELETE FROM club_details")
    suspend fun clearClubDetails()

    // Weekly Session queries
    @Query("SELECT * FROM weekly_sessions ORDER BY createdAt DESC")
    fun getAllWeeklySessions(): Flow<List<WeeklySessionEntity>>

    @Query("SELECT * FROM weekly_sessions WHERE id = :id")
    suspend fun getWeeklySessionById(id: Int): WeeklySessionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWeeklySession(session: WeeklySessionEntity): Long

    @Query("DELETE FROM weekly_sessions WHERE id = :id")
    suspend fun deleteWeeklySession(id: Int)

    // Weekly Session Member queries
    @Query("SELECT * FROM weekly_session_members WHERE weeklySessionId = :weeklySessionId")
    fun getWeeklySessionMembers(weeklySessionId: Int): Flow<List<WeeklySessionMemberEntity>>

    @Query("SELECT * FROM weekly_session_members")
    fun getAllWeeklySessionMembers(): Flow<List<WeeklySessionMemberEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWeeklySessionMember(join: WeeklySessionMemberEntity)

    @Query("DELETE FROM weekly_session_members WHERE weeklySessionId = :weeklySessionId AND memberId = :memberId")
    suspend fun deleteWeeklySessionMember(weeklySessionId: Int, memberId: Int)

    @Query("DELETE FROM weekly_session_members WHERE weeklySessionId = :weeklySessionId")
    suspend fun clearWeeklySessionMembers(weeklySessionId: Int)

    // Weekly Session Court queries
    @Query("SELECT * FROM weekly_session_courts WHERE weeklySessionId = :weeklySessionId ORDER BY id ASC")
    fun getWeeklySessionCourts(weeklySessionId: Int): Flow<List<WeeklySessionCourtEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWeeklySessionCourt(court: WeeklySessionCourtEntity): Long

    @Query("DELETE FROM weekly_session_courts WHERE id = :id")
    suspend fun deleteWeeklySessionCourt(id: Int)

    @Query("DELETE FROM weekly_session_courts WHERE weeklySessionId = :weeklySessionId")
    suspend fun clearWeeklySessionCourts(weeklySessionId: Int)

    // Session Manager queries
    @Query("SELECT * FROM session_managers ORDER BY name ASC")
    fun getAllSessionManagers(): Flow<List<SessionManagerEntity>>

    @Query("SELECT * FROM session_managers WHERE id = :id")
    suspend fun getSessionManagerById(id: Int): SessionManagerEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSessionManager(manager: SessionManagerEntity): Long

    @Query("DELETE FROM session_managers WHERE id = :id")
    suspend fun deleteSessionManager(id: Int)

    @Query("DELETE FROM session_managers WHERE LOWER(email) = LOWER(:email)")
    suspend fun deleteSessionManagerByEmail(email: String)

    @Query("UPDATE weekly_sessions SET managerId = NULL, managerName = NULL WHERE managerId = :managerId")
    suspend fun clearManager1FromWeeklySessions(managerId: Int)

    @Query("UPDATE weekly_sessions SET manager2Id = NULL, manager2Name = NULL WHERE manager2Id = :managerId")
    suspend fun clearManager2FromWeeklySessions(managerId: Int)

    @Query("UPDATE sessions SET managerId = NULL, managerName = NULL WHERE managerId = :managerId")
    suspend fun clearManager1FromSessions(managerId: Int)

    @Query("UPDATE sessions SET manager2Id = NULL, manager2Name = NULL WHERE manager2Id = :managerId")
    suspend fun clearManager2FromSessions(managerId: Int)

    @Query("DELETE FROM session_managers")
    suspend fun clearAllSessionManagers()

    // Bulk delete queries to purge all local club data on sign out
    @Query("DELETE FROM sessions")
    suspend fun clearAllSessions()

    @Query("DELETE FROM players")
    suspend fun clearAllPlayers()

    @Query("DELETE FROM session_players")
    suspend fun clearAllSessionPlayers()

    @Query("DELETE FROM courts")
    suspend fun clearAllCourts()

    @Query("DELETE FROM court_master")
    suspend fun clearAllCourtMasters()

    @Query("DELETE FROM matches")
    suspend fun clearAllMatches()

    @Query("DELETE FROM weekly_sessions")
    suspend fun clearAllWeeklySessions()

    @Query("DELETE FROM weekly_session_members")
    suspend fun clearAllWeeklySessionMembers()

    @Query("DELETE FROM weekly_session_courts")
    suspend fun clearAllWeeklySessionCourts()
}
