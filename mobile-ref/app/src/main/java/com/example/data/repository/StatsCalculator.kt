package com.example.data.repository

import com.example.data.database.MatchEntity
import com.example.data.database.PlayerEntity
import com.example.data.database.SessionEntity

data class PlayerStats(
    val playerId: Int,
    val name: String,
    val gender: String,
    val gamesPlayed: Int = 0,
    val adjustedGames: Int = 0,
    val gamesWon: Int = 0,
    val gamesLost: Int = 0,
    val winPercentage: Float = 0f,
    val totalPointsScored: Int = 0,
    val totalPointsConceded: Int = 0,
    val averagePointsPerGame: Float = 0f,
    val consecutiveWins: Int = 0, // Max streak
    val consecutiveLosses: Int = 0 // Max streak
)

data class SessionStats(
    val sessionId: Int,
    val sessionName: String,
    val totalGamesPlayed: Int = 0,
    val gamesPerCourt: Map<Int, Int> = emptyMap(), // courtId -> games count
    val courtUtilization: Map<Int, Float> = emptyMap(), // courtId -> utilization % (0f to 100f)
    val durationMs: Long = 0L
)

object StatsCalculator {

    fun calculatePlayerStats(
        players: List<PlayerEntity>,
        matches: List<MatchEntity>,
        joinsMap: Map<Int, com.example.data.database.SessionPlayerJoinEntity> = emptyMap(),
        courtCount: Int = 0
    ): List<PlayerStats> {
        val completedMatches = matches.filter { it.endTime != null && it.teamAScore != null && it.teamBScore != null }
        val totalMatches = matches.size

        return players.map { player ->
            val pId = player.id
            val playerMatches = completedMatches.filter { m ->
                m.teamAPlayer1Id == pId || m.teamAPlayer2Id == pId ||
                m.teamBPlayer1Id == pId || m.teamBPlayer2Id == pId
            }

            var gamesPlayed = playerMatches.size
            val join = joinsMap[pId]
            val adjustedGames = if (join != null) {
                if (join.isPaused && join.pausedAtMatchCount != null && courtCount > 0) {
                    val matchesDuringPause = maxOf(0, totalMatches - join.pausedAtMatchCount)
                    val avg = Math.round(matchesDuringPause.toDouble() / courtCount).toInt()
                    join.adjustedGames + avg
                } else {
                    join.adjustedGames
                }
            } else 0
            var gamesWon = 0
            var gamesLost = 0
            var totalPointsScored = 0
            var totalPointsConceded = 0

            // Streaks
            val sortedMatches = playerMatches.sortedBy { it.startTime }
            var maxWins = 0
            var maxLosses = 0
            var currentWins = 0
            var currentLosses = 0

            for (m in sortedMatches) {
                val isOnTeamA = m.teamAPlayer1Id == pId || m.teamAPlayer2Id == pId
                val isOnTeamB = m.teamBPlayer1Id == pId || m.teamBPlayer2Id == pId

                val isWin = (isOnTeamA && m.winnerTeam == "A") || (isOnTeamB && m.winnerTeam == "B")
                val isLoss = (isOnTeamA && m.winnerTeam == "B") || (isOnTeamB && m.winnerTeam == "A")

                val scoreA = m.teamAScore ?: 0
                val scoreB = m.teamBScore ?: 0

                val pointsScored = if (isOnTeamA) scoreA else scoreB
                val pointsConceded = if (isOnTeamA) scoreB else scoreA

                totalPointsScored += pointsScored
                totalPointsConceded += pointsConceded

                if (isWin) {
                    gamesWon++
                    currentWins++
                    currentLosses = 0
                    if (currentWins > maxWins) maxWins = currentWins
                } else if (isLoss) {
                    gamesLost++
                    currentLosses++
                    currentWins = 0
                    if (currentLosses > maxLosses) maxLosses = currentLosses
                } else {
                    // Tie or other fallback
                    currentWins = 0
                    currentLosses = 0
                }
            }

            val winPercentage = if (gamesPlayed > 0) {
                (gamesWon.toFloat() / gamesPlayed) * 100f
            } else 0f

            val averagePointsPerGame = if (gamesPlayed > 0) {
                totalPointsScored.toFloat() / gamesPlayed
            } else 0f

            PlayerStats(
                playerId = pId,
                name = player.name.uppercase(),
                gender = player.gender,
                gamesPlayed = gamesPlayed,
                adjustedGames = adjustedGames,
                gamesWon = gamesWon,
                gamesLost = gamesLost,
                winPercentage = winPercentage,
                totalPointsScored = totalPointsScored,
                totalPointsConceded = totalPointsConceded,
                averagePointsPerGame = averagePointsPerGame,
                consecutiveWins = maxWins,
                consecutiveLosses = maxLosses
            )
        }
    }

    fun sortPlayersByRankRule(statsList: List<PlayerStats>): List<PlayerStats> {
        return statsList.sortedWith(
            compareByDescending<PlayerStats> { it.gamesWon }
                .thenBy { it.gamesLost }
                .thenByDescending { it.totalPointsScored }
                .thenBy { it.totalPointsConceded }
                .thenBy { it.name }
        )
    }

    fun groupPlayersByTier(sortedList: List<PlayerStats>): Map<String, List<PlayerStats>> {
        val total = sortedList.size
        val groupA = mutableListOf<PlayerStats>()
        val groupB = mutableListOf<PlayerStats>()
        val groupC = mutableListOf<PlayerStats>()

        sortedList.forEachIndexed { index, stats ->
            when {
                index < total * 0.25 -> groupA.add(stats)
                index < total * 0.75 -> groupB.add(stats)
                else -> groupC.add(stats)
            }
        }

        return mapOf(
            "A" to groupA,
            "B" to groupB,
            "C" to groupC
        )
    }

    fun calculateSessionStats(
        session: SessionEntity,
        courts: List<com.example.data.database.CourtEntity>,
        matches: List<MatchEntity>
    ): SessionStats {
        val totalGames = matches.count { it.endTime != null }
        val gamesMap = courts.associate { court ->
            court.id to matches.count { m -> m.courtId == court.id && m.endTime != null }
        }

        val startTime = session.startTime ?: return SessionStats(session.id, session.name)
        val endTime = session.endTime ?: System.currentTimeMillis()
        val duration = maxOf(0L, endTime - startTime)

        val utilizationMap = courts.associate { court ->
            val courtMatches = matches.filter { m -> m.courtId == court.id }
            val activeTimeMs = courtMatches.sumOf { m ->
                val mStart = m.startTime
                val mEnd = m.endTime ?: System.currentTimeMillis()
                maxOf(0L, mEnd - mStart)
            }
            val percentage = if (duration > 0L) {
                minOf(100f, (activeTimeMs.toFloat() / duration.toFloat()) * 100f)
            } else {
                0f
            }
            court.id to percentage
        }

        return SessionStats(
            sessionId = session.id,
            sessionName = session.name,
            totalGamesPlayed = totalGames,
            gamesPerCourt = gamesMap,
            courtUtilization = utilizationMap,
            durationMs = duration
        )
    }
}
