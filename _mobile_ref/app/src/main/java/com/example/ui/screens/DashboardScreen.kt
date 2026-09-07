package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.repository.PlayerStats
import com.example.data.repository.SessionStats
import com.example.ui.viewmodel.BadmintonViewModel

@Composable
fun DashboardScreen(
    viewModel: BadmintonViewModel,
    modifier: Modifier = Modifier
) {
    val activeSession by viewModel.activeSession.collectAsState()
    val courts by viewModel.activeSessionCourts.collectAsState()
    val playerStatsList by viewModel.activeSessionPlayerStats.collectAsState()
    val sessionStats by viewModel.activeSessionStats.collectAsState()
    val allPlayers by viewModel.allPlayers.collectAsState()
    val activeMatches by viewModel.activeSessionMatches.collectAsState()
    val clubDetails by viewModel.clubDetails.collectAsState()

    val activeSessionJoins by viewModel.activeSessionPlayers.collectAsState()

    val playerGamesMap: Map<Int, Int> = remember(activeMatches, activeSessionJoins, courts) {
        val map = mutableMapOf<Int, Int>()
        val courtCount = courts.size
        val totalMatchesCount = activeMatches.size
        for (j in activeSessionJoins) {
            val adj = if (j.isPaused && j.pausedAtMatchCount != null && courtCount > 0) {
                val matchesDuringPause = maxOf(0, totalMatchesCount - j.pausedAtMatchCount)
                val avg = Math.round(matchesDuringPause.toDouble() / courtCount).toInt()
                j.adjustedGames + avg
            } else {
                j.adjustedGames
            }
            map[j.playerId] = adj
        }
        for (m in activeMatches) {
            listOfNotNull(m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id).forEach { pid ->
                map[pid] = (map[pid] ?: 0) + 1
            }
        }
        map
    }

    var activeSubTab by remember { mutableStateOf("STANDINGS") } // "STANDINGS", "MATCHES"
    var selectedGroupFilter by remember { mutableStateOf("ALL") } // "ALL", "A", "B", "C"

    if (activeSession == null) {
        Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Create and start a session to view live statistics.", style = MaterialTheme.typography.titleMedium)
        }
        return
    }

    val session = activeSession!!
    val rankedLeaderboard = remember(playerStatsList) {
        com.example.data.repository.StatsCalculator.sortPlayersByRankRule(playerStatsList.filter { (it.gamesPlayed + it.adjustedGames) > 0 })
    }

    val gamesPlayedRankMap = remember(rankedLeaderboard) {
        rankedLeaderboard.mapIndexed { index, stats ->
            stats.playerId to (index + 1)
        }.toMap()
    }

    val groupedTiers = remember(rankedLeaderboard) {
        com.example.data.repository.StatsCalculator.groupPlayersByTier(rankedLeaderboard)
    }

    val playerMap = remember(allPlayers) { allPlayers.associateBy { it.id } }
    val courtMap = remember(courts) { courts.associateBy { it.id } }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Session Statistics", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

                var showActiveExportMenu by remember { mutableStateOf(false) }
                val context = androidx.compose.ui.platform.LocalContext.current
                val clubName = clubDetails?.name ?: "Badminton Club"

                Box {
                    Button(
                        onClick = { showActiveExportMenu = true },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer,
                            contentColor = MaterialTheme.colorScheme.onPrimaryContainer
                        ),
                        shape = RoundedCornerShape(20.dp),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Export", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }

                    DropdownMenu(
                        expanded = showActiveExportMenu,
                        onDismissRequest = { showActiveExportMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Export CSV Report") },
                            onClick = {
                                showActiveExportMenu = false
                                com.example.util.ReportExporter.shareSessionReportCsv(
                                    context = context,
                                    session = session,
                                    courts = courts,
                                    matches = activeMatches,
                                    players = allPlayers,
                                    sessionStats = sessionStats,
                                    playerStatsList = rankedLeaderboard
                                )
                            },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.TableChart,
                                    contentDescription = "CSV",
                                    tint = MaterialTheme.colorScheme.secondary
                                )
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Export PDF Report") },
                            onClick = {
                                showActiveExportMenu = false
                                com.example.util.ReportExporter.shareSessionReportPdf(
                                    context = context,
                                    session = session,
                                    courts = courts,
                                    matches = activeMatches,
                                    players = allPlayers,
                                    sessionStats = sessionStats,
                                    playerStatsList = rankedLeaderboard,
                                    clubName = clubName
                                )
                            },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Description,
                                    contentDescription = "PDF",
                                    tint = MaterialTheme.colorScheme.primary
                                )
                            }
                        )
                    }
                }
            }
        }

        // Stats summary cards row/grid
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)),
                    shape = RoundedCornerShape(28.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.2f))
                ) {
                    Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Total Games", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f))
                        Text(
                            text = "${sessionStats?.totalGamesPlayed ?: 0}",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }

                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.4f)),
                    shape = RoundedCornerShape(28.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = 0.2f))
                ) {
                    Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.AccessTime, contentDescription = null, tint = MaterialTheme.colorScheme.onSecondaryContainer)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Duration", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f))
                        val durationMs = sessionStats?.durationMs ?: 0L
                        val hours = durationMs / 3600000
                        val minutes = (durationMs % 3600000) / 60000
                        Text(
                            text = if (hours > 0) "${hours}h ${minutes}m" else "${minutes}m",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    }
                }
            }
        }

        // Court utilization card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(28.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Court Utilization & Games Played",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    if (courts.isEmpty()) {
                        Text("No courts configured.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                    } else {
                        courts.forEach { court ->
                            val gamesCount = sessionStats?.gamesPerCourt?.get(court.id) ?: 0
                            val utilPercent = sessionStats?.courtUtilization?.get(court.id) ?: 0f

                            Column(modifier = Modifier.padding(vertical = 6.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(court.name, fontWeight = FontWeight.Bold)
                                    Text(
                                        "$gamesCount games (${String.format("%.1f", utilPercent)}% util)",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.outline
                                    )
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                LinearProgressIndicator(
                                    progress = { utilPercent / 100f },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(3.dp)),
                                    color = MaterialTheme.colorScheme.primary,
                                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        }

        // Toggle for Standings vs Match Records
        item {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FilterChip(
                        selected = activeSubTab == "STANDINGS",
                        onClick = { activeSubTab = "STANDINGS" },
                        label = { Text("Session Standings", fontWeight = FontWeight.Bold) },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Leaderboard,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    )
                    FilterChip(
                        selected = activeSubTab == "MATCHES",
                        onClick = { activeSubTab = "MATCHES" },
                        label = { Text("Match Records", fontWeight = FontWeight.Bold) },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.History,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    )
                }
            }
        }

        if (activeSubTab == "STANDINGS") {
            // Leaderboard sub-filters
            item {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        FilterChip(
                            selected = selectedGroupFilter == "ALL",
                            onClick = { selectedGroupFilter = "ALL" },
                            label = { Text("All Groups", fontSize = 11.sp) }
                        )
                        FilterChip(
                            selected = selectedGroupFilter == "A",
                            onClick = { selectedGroupFilter = "A" },
                            label = { Text("Group A", fontSize = 11.sp) }
                        )
                        FilterChip(
                            selected = selectedGroupFilter == "B",
                            onClick = { selectedGroupFilter = "B" },
                            label = { Text("Group B", fontSize = 11.sp) }
                        )
                        FilterChip(
                            selected = selectedGroupFilter == "C",
                            onClick = { selectedGroupFilter = "C" },
                            label = { Text("Group C", fontSize = 11.sp) }
                        )
                    }
                }
            }

            // Leaderboard table entries
            if (rankedLeaderboard.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("No completed matches in this session yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                    }
                }
            } else {
                val groupsToShow = listOf("A", "B", "C").filter { selectedGroupFilter == "ALL" || selectedGroupFilter == it }
                
                groupsToShow.forEach { groupName ->
                    val playersInGroup = groupedTiers[groupName] ?: emptyList()
                    if (playersInGroup.isNotEmpty()) {
                        item {
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = when (groupName) {
                                        "A" -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f)
                                        "B" -> MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.2f)
                                        else -> MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.2f)
                                    }
                                ),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Surface(
                                        color = when (groupName) {
                                            "A" -> MaterialTheme.colorScheme.primary
                                            "B" -> MaterialTheme.colorScheme.secondary
                                            else -> MaterialTheme.colorScheme.tertiary
                                        },
                                        contentColor = when (groupName) {
                                            "A" -> MaterialTheme.colorScheme.onPrimary
                                            "B" -> MaterialTheme.colorScheme.onSecondary
                                            else -> MaterialTheme.colorScheme.onTertiary
                                        },
                                        shape = CircleShape,
                                        modifier = Modifier.size(24.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text(groupName, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                        }
                                    }
                                    Text(
                                        text = when (groupName) {
                                            "A" -> "Group A (Top 25%)"
                                            "B" -> "Group B (Next 50%)"
                                            else -> "Group C (Bottom 25%)"
                                        },
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.titleSmall
                                    )
                                }
                            }
                        }

                        items(playersInGroup) { stats ->
                            val rank = gamesPlayedRankMap[stats.playerId]
                            PlayerLeaderboardRow(stats = stats, rank = rank)
                        }
                    }
                }
            }
        } else {
            // activeSubTab == "MATCHES"
            // Show Match Records
            if (activeMatches.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("No matches generated or played in this session yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                    }
                }
            } else {
                // Sort by matchNumber descending so the newest/active match is shown first
                val sortedMatches = activeMatches.sortedByDescending { it.matchNumber }
                items(sortedMatches) { match ->
                    ActiveMatchRecordRow(
                        match = match,
                        playerMap = playerMap,
                        courtMap = courtMap,
                        playerGamesMap = playerGamesMap
                    )
                }
            }
        }
    }
}

fun formatTeamWithGamesAnnotated(
    p1Obj: com.example.data.database.PlayerEntity?,
    p2Obj: com.example.data.database.PlayerEntity?,
    gamesMap: Map<Int, Int>
): AnnotatedString {
    return buildAnnotatedString {
        fun appendPlayer(player: com.example.data.database.PlayerEntity?) {
            if (player == null) {
                append("UNKNOWN")
                return
            }
            val name = player.name.lowercase().split(" ").joinToString(" ") { word -> word.replaceFirstChar { it.uppercase() } }
            append(name)
            val count = gamesMap[player.id] ?: 0
            append(" ")
            withStyle(SpanStyle(fontSize = 11.sp, fontWeight = FontWeight.Normal)) {
                append("($count)")
            }
        }

        appendPlayer(p1Obj)
        if (p2Obj != null) {
            append(" & ")
            appendPlayer(p2Obj)
        }
    }
}

@Composable
fun ActiveMatchRecordRow(
    match: com.example.data.database.MatchEntity,
    playerMap: Map<Int, com.example.data.database.PlayerEntity>,
    courtMap: Map<Int, com.example.data.database.CourtEntity>,
    playerGamesMap: Map<Int, Int> = emptyMap()
) {
    val p1AObj = playerMap[match.teamAPlayer1Id]
    val p2AObj = match.teamAPlayer2Id?.let { playerMap[it] }
    val teamANames = formatTeamWithGamesAnnotated(p1AObj, p2AObj, playerGamesMap)

    val p1BObj = playerMap[match.teamBPlayer1Id]
    val p2BObj = match.teamBPlayer2Id?.let { playerMap[it] }
    val teamBNames = formatTeamWithGamesAnnotated(p1BObj, p2BObj, playerGamesMap)

    val courtName = (courtMap[match.courtId]?.name ?: "COURT ${match.courtId}").uppercase()
    val isCompleted = match.endTime != null

    val colorTeamA = when {
        !isCompleted -> MaterialTheme.colorScheme.onSurface
        match.winnerTeam == "A" -> Color(0xFF16A34A)
        else -> MaterialTheme.colorScheme.onSurface
    }

    val colorTeamB = when {
        !isCompleted -> MaterialTheme.colorScheme.onSurface
        match.winnerTeam == "B" -> Color(0xFF16A34A)
        else -> MaterialTheme.colorScheme.onSurface
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(24.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        color = MaterialTheme.colorScheme.secondaryContainer,
                        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                        shape = CircleShape,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = "#${match.matchNumber}",
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = courtName,
                        fontWeight = FontWeight.SemiBold,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.outline
                    )
                }

                if (isCompleted) {
                    Badge(
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                        contentColor = MaterialTheme.colorScheme.onPrimaryContainer
                    ) {
                        Text(
                            text = "Completed",
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp
                        )
                    }
                } else {
                    Badge(
                        containerColor = Color(0xFFFBBF24).copy(alpha = 0.2f),
                        contentColor = Color(0xFFD97706)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .background(Color(0xFFD97706), CircleShape)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Live",
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = teamANames,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = if (match.winnerTeam == "A") FontWeight.Bold else FontWeight.Normal,
                            color = colorTeamA
                        )
                        if (match.winnerTeam == "A") {
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(Icons.Default.CheckCircle, contentDescription = "Winner", tint = Color(0xFF16A34A), modifier = Modifier.size(16.dp))
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "vs",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = teamBNames,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = if (match.winnerTeam == "B") FontWeight.Bold else FontWeight.Normal,
                            color = colorTeamB
                        )
                        if (match.winnerTeam == "B") {
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(Icons.Default.CheckCircle, contentDescription = "Winner", tint = Color(0xFF16A34A), modifier = Modifier.size(16.dp))
                        }
                    }
                }

                if (isCompleted) {
                    Text(
                        text = "${match.teamAScore ?: 0} - ${match.teamBScore ?: 0}",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                } else {
                    Text(
                        text = "vs",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.outlineVariant
                    )
                }
            }
        }
    }
}

@Composable
fun PlayerLeaderboardRow(stats: PlayerStats, rank: Int? = null) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("leaderboard_row_${stats.playerId}"),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(28.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (rank != null) {
                        val rankBg = when (rank) {
                            1 -> Color(0xFFFBBF24) // Gold
                            2 -> Color(0xFF94A3B8) // Silver
                            3 -> Color(0xFFCD7F32) // Bronze
                            else -> MaterialTheme.colorScheme.surfaceVariant
                        }
                        val rankFg = when (rank) {
                            1, 2 -> Color.Black
                            3 -> Color.White
                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                        }
                        Surface(
                            color = rankBg,
                            contentColor = rankFg,
                            shape = CircleShape,
                            modifier = Modifier.size(24.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    text = rank.toString(),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                    }

                    Icon(
                        imageVector = if (stats.gender == "MALE") Icons.Default.Male else Icons.Default.Female,
                        contentDescription = null,
                        tint = if (stats.gender == "MALE") Color(0xFF38BDF8) else Color(0xFFF472B6),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stats.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                }

                Badge(containerColor = MaterialTheme.colorScheme.primaryContainer) {
                    Text(
                        "${String.format("%.1f", stats.winPercentage)}% Win Rate",
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Stats values grid
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
                    .padding(8.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                    Text("Played", style = MaterialTheme.typography.bodySmall, fontSize = 10.sp, color = MaterialTheme.colorScheme.outline)
                    val playedText = if (stats.adjustedGames > 0) "${stats.gamesPlayed} (${stats.adjustedGames})" else "${stats.gamesPlayed}"
                    Text(playedText, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                    Text("Won", style = MaterialTheme.typography.bodySmall, fontSize = 10.sp, color = Color(0xFF10B981))
                    Text("${stats.gamesWon}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF10B981))
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                    Text("Lost", style = MaterialTheme.typography.bodySmall, fontSize = 10.sp, color = Color(0xFFEF4444))
                    Text("${stats.gamesLost}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFFEF4444))
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                    Text("Points +/-", style = MaterialTheme.typography.bodySmall, fontSize = 10.sp, color = MaterialTheme.colorScheme.outline)
                    Text("${stats.totalPointsScored}:${stats.totalPointsConceded}", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                    Text("Avg Pts", style = MaterialTheme.typography.bodySmall, fontSize = 10.sp, color = MaterialTheme.colorScheme.outline)
                    Text(String.format("%.1f", stats.averagePointsPerGame), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }
    }
}
