package com.example.data.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sessions")
data class SessionEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val type: String, // "SINGLES", "DOUBLES", "MIXED_DOUBLES", "MULTI_TYPE"
    val createdAt: Long = System.currentTimeMillis(),
    val isActive: Boolean = false,
    val startTime: Long? = null,
    val endTime: Long? = null,
    val status: String = "Setting Up",
    val weeklySessionId: Int? = null,
    val managerId: Int? = null,
    val managerName: String? = null,
    val manager2Id: Int? = null,
    val manager2Name: String? = null,
    val targetScore: Int = 21
)

@Entity(tableName = "players")
data class PlayerEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val gender: String, // "MALE", "FEMALE"
    val createdAt: Long = System.currentTimeMillis(),
    val isPAYG: Boolean = false
)

@Entity(
    tableName = "session_players",
    primaryKeys = ["sessionId", "playerId"]
)
data class SessionPlayerJoinEntity(
    val sessionId: Int,
    val playerId: Int,
    val isPaused: Boolean = false,
    val eligibleCourtIds: String? = null, // comma-separated court IDs, or null/empty for "ALL"
    val isPAYG: Boolean = false,
    val adjustedGames: Int = 0,
    val pausedAtMatchCount: Int? = null
)

@Entity(tableName = "courts")
data class CourtEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val sessionId: Int,
    val name: String,
    val gameType: String = "DOUBLES" // "SINGLES", "DOUBLES", "MIXED_DOUBLES"
)

@Entity(tableName = "court_master")
data class CourtMasterEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "matches")
data class MatchEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val sessionId: Int,
    val courtId: Int,
    val matchNumber: Int,
    val teamAPlayer1Id: Int,
    val teamAPlayer2Id: Int? = null, // null for singles
    val teamBPlayer1Id: Int,
    val teamBPlayer2Id: Int? = null, // null for singles
    val teamAScore: Int? = null,
    val teamBScore: Int? = null,
    val winnerTeam: String? = null, // "A" or "B"
    val startTime: Long = System.currentTimeMillis(),
    val endTime: Long? = null
)

@Entity(tableName = "club_details")
data class ClubEntity(
    @PrimaryKey val id: Int = 1,
    val name: String,
    val venue: String = "",
    val defaultSessionType: String = "DOUBLES",
    val themeColorHex: String = "#0284C7",
    val targetScore: Int = 21,
    val contactPerson: String = "",
    val description: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "weekly_sessions")
data class WeeklySessionEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val dayOfWeek: String, // "Monday", "Tuesday", etc.
    val time: String,      // "19:00"
    val type: String,      // "SINGLES", "DOUBLES", "MIXED_DOUBLES", "MULTI_TYPE"
    val managerId: Int? = null,
    val managerName: String? = null,
    val manager2Id: Int? = null,
    val manager2Name: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val targetScore: Int = 21
)

@Entity(
    tableName = "weekly_session_members",
    primaryKeys = ["weeklySessionId", "memberId"]
)
data class WeeklySessionMemberEntity(
    val weeklySessionId: Int,
    val memberId: Int
)

@Entity(tableName = "weekly_session_courts")
data class WeeklySessionCourtEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val weeklySessionId: Int,
    val name: String,
    val gameType: String = "DOUBLES"
)

@Entity(tableName = "session_managers")
data class SessionManagerEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val email: String,
    val inviteStatus: String = "INVITED", // "INVITED", "ACTIVE", "EMAIL_SENT"
    val createdAt: Long = System.currentTimeMillis()
)

