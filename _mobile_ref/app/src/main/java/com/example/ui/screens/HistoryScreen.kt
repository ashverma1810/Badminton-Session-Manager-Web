package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import com.example.data.database.MatchEntity
import com.example.data.database.SessionEntity
import com.example.data.repository.SessionStats
import com.example.data.repository.PlayerStats
import com.example.ui.viewmodel.BadmintonViewModel
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun HistoryScreen(
    viewModel: BadmintonViewModel,
    modifier: Modifier = Modifier
) {
    val historicalSessions by viewModel.historicalSessionsWithStats.collectAsState()
    val historicalSessionsWithMatches by viewModel.historicalSessionsWithMatches.collectAsState()
    val cumulativeLeaderboard by viewModel.historicalLeaderboardState.collectAsState()
    val allPlayers by viewModel.allPlayers.collectAsState()

    var historyTab by remember { mutableStateOf("SESSIONS") } // "SESSIONS", "WEEKLY", "ALL_TIME"

    var singleSessionToDelete by remember { mutableStateOf<SessionEntity?>(null) }
    var showSingleDeleteConfirm by remember { mutableStateOf(false) }

    // State & calculation hooks moved to the top of Composable
    val groupedByDay = remember(historicalSessionsWithMatches) {
        historicalSessionsWithMatches.groupBy { (session, _, _) ->
            getDayOfWeek(session.startTime ?: session.createdAt)
        }
    }
    
    val daysOfWeekOrder = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
    val sortedDays = remember(groupedByDay) {
        groupedByDay.keys.sortedWith(compareBy { daysOfWeekOrder.indexOf(it) })
    }
    
    val weeklyGroupLeaderboards = remember(groupedByDay, allPlayers) {
        groupedByDay.mapValues { (_, triples) ->
            val matches = triples.flatMap { (_, _, mList) -> mList }
            val stats = com.example.data.repository.StatsCalculator.calculatePlayerStats(allPlayers, matches)
                .filter { it.gamesPlayed > 0 }
            val sorted = com.example.data.repository.StatsCalculator.sortPlayersByRankRule(stats)
            val rankMap = sorted.mapIndexed { index, pStats -> pStats.playerId to (index + 1) }.toMap()
            val grouped = com.example.data.repository.StatsCalculator.groupPlayersByTier(sorted)
            Triple(sorted, rankMap, grouped)
        }
    }

    var expandedDay by remember { mutableStateOf<String?>(null) }
    var dayGroupFilter by remember { mutableStateOf("ALL") }

    val sortedCumulative = remember(cumulativeLeaderboard) {
        com.example.data.repository.StatsCalculator.sortPlayersByRankRule(cumulativeLeaderboard.filter { it.gamesPlayed > 0 })
    }
    val cumulativeRankMap = remember(sortedCumulative) {
        sortedCumulative.mapIndexed { index, stats -> stats.playerId to (index + 1) }.toMap()
    }
    val cumulativeTiers = remember(sortedCumulative) {
        com.example.data.repository.StatsCalculator.groupPlayersByTier(sortedCumulative)
    }

    var cumulativeGroupFilter by remember { mutableStateOf("ALL") }

    // Refresh historical data when this screen becomes visible
    LaunchedEffect(Unit) {
        viewModel.refreshHistoricalData()
    }

    Box(modifier = modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "History & Leaderboards",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        FilterChip(
                            selected = historyTab == "SESSIONS",
                            onClick = { historyTab = "SESSIONS" },
                            label = { Text("Sessions") }
                        )
                        FilterChip(
                            selected = historyTab == "WEEKLY",
                            onClick = { historyTab = "WEEKLY" },
                            label = { Text("Weekly Groups") }
                        )
                        FilterChip(
                            selected = historyTab == "ALL_TIME",
                            onClick = { historyTab = "ALL_TIME" },
                            label = { Text("All-Time") }
                        )
                    }
                }
            }

            if (historyTab == "SESSIONS") {
                if (historicalSessions.isEmpty()) {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                            Text("No past completed sessions found.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                        }
                    }
                } else {
                    items(historicalSessions) { (session, stats) ->
                        HistoricalSessionCard(
                            session = session,
                            stats = stats,
                            viewModel = viewModel,
                            onDeleteClick = {
                                singleSessionToDelete = session
                                showSingleDeleteConfirm = true
                            }
                        )
                    }
                }
            } else if (historyTab == "WEEKLY") {
                if (sortedDays.isEmpty()) {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                            Text("No completed weekly sessions found.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                        }
                    }
                } else {
                    sortedDays.forEach { day ->
                        val dayTriples = groupedByDay[day] ?: emptyList()
                        val (sortedStats, rankMap, groupedTiers) = weeklyGroupLeaderboards[day] ?: Triple(emptyList(), emptyMap(), emptyMap())
                        
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable { 
                                                expandedDay = if (expandedDay == day) null else day
                                                dayGroupFilter = "ALL" // Reset filter on expand
                                            },
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Icon(Icons.Default.CalendarToday, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                                Text(
                                                    text = "$day Sessions",
                                                    style = MaterialTheme.typography.titleMedium,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                            Text(
                                                text = "${dayTriples.size} sessions • ${sortedStats.size} players active",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.outline
                                            )
                                        }
                                        Icon(
                                            imageVector = if (expandedDay == day) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                            contentDescription = null
                                        )
                                    }
                                    
                                    AnimatedVisibility(visible = expandedDay == day) {
                                        Column(modifier = Modifier.padding(top = 12.dp)) {
                                            Divider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                                            Spacer(modifier = Modifier.height(12.dp))
                                            
                                            Text(
                                                text = "Sessions in group: " + dayTriples.joinToString { it.first.name },
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.primary,
                                                fontWeight = FontWeight.SemiBold,
                                                modifier = Modifier.padding(bottom = 12.dp)
                                            )
                                            
                                            if (sortedStats.isEmpty()) {
                                                Text("No completed matches under this group.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                                            } else {
                                                Row(
                                                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                                ) {
                                                    FilterChip(
                                                        selected = dayGroupFilter == "ALL",
                                                        onClick = { dayGroupFilter = "ALL" },
                                                        label = { Text("All", fontSize = 11.sp) }
                                                    )
                                                    FilterChip(
                                                        selected = dayGroupFilter == "A",
                                                        onClick = { dayGroupFilter = "A" },
                                                        label = { Text("Group A", fontSize = 11.sp) }
                                                    )
                                                    FilterChip(
                                                        selected = dayGroupFilter == "B",
                                                        onClick = { dayGroupFilter = "B" },
                                                        label = { Text("Group B", fontSize = 11.sp) }
                                                    )
                                                    FilterChip(
                                                        selected = dayGroupFilter == "C",
                                                        onClick = { dayGroupFilter = "C" },
                                                        label = { Text("Group C", fontSize = 11.sp) }
                                                    )
                                                }
                                                
                                                val groupsToShow = listOf("A", "B", "C").filter { dayGroupFilter == "ALL" || dayGroupFilter == it }
                                                
                                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                                    groupsToShow.forEach { groupName ->
                                                        val playersInGroup = groupedTiers[groupName] ?: emptyList()
                                                        if (playersInGroup.isNotEmpty()) {
                                                            Text(
                                                                text = when (groupName) {
                                                                    "A" -> "Group A (Top 25%)"
                                                                    "B" -> "Group B (Next 50%)"
                                                                    else -> "Group C (Bottom 25%)"
                                                                },
                                                                fontWeight = FontWeight.Bold,
                                                                style = MaterialTheme.typography.titleSmall,
                                                                color = when (groupName) {
                                                                    "A" -> MaterialTheme.colorScheme.primary
                                                                    "B" -> MaterialTheme.colorScheme.secondary
                                                                    else -> MaterialTheme.colorScheme.tertiary
                                                                },
                                                                modifier = Modifier.padding(top = 4.dp, bottom = 4.dp)
                                                            )
                                                            
                                                            playersInGroup.forEach { stats ->
                                                                val rank = rankMap[stats.playerId]
                                                                Row(
                                                                    modifier = Modifier.fillMaxWidth(),
                                                                    verticalAlignment = Alignment.CenterVertically,
                                                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                                                ) {
                                                                    Text(
                                                                        text = "#$rank",
                                                                        style = MaterialTheme.typography.titleSmall,
                                                                        fontWeight = FontWeight.Bold,
                                                                        color = MaterialTheme.colorScheme.primary,
                                                                        modifier = Modifier.width(32.dp)
                                                                    )
                                                                    Box(modifier = Modifier.weight(1f)) {
                                                                        PlayerLeaderboardRow(stats)
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                if (sortedCumulative.isEmpty()) {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                            Text("No completed matches in history yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                        }
                    }
                } else {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            FilterChip(
                                selected = cumulativeGroupFilter == "ALL",
                                onClick = { cumulativeGroupFilter = "ALL" },
                                label = { Text("All Groups", fontSize = 11.sp) }
                            )
                            FilterChip(
                                selected = cumulativeGroupFilter == "A",
                                onClick = { cumulativeGroupFilter = "A" },
                                label = { Text("Group A", fontSize = 11.sp) }
                            )
                            FilterChip(
                                selected = cumulativeGroupFilter == "B",
                                onClick = { cumulativeGroupFilter = "B" },
                                label = { Text("Group B", fontSize = 11.sp) }
                            )
                            FilterChip(
                                selected = cumulativeGroupFilter == "C",
                                onClick = { cumulativeGroupFilter = "C" },
                                label = { Text("Group C", fontSize = 11.sp) }
                            )
                        }
                    }

                    val groupsToShow = listOf("A", "B", "C").filter { cumulativeGroupFilter == "ALL" || cumulativeGroupFilter == it }
                    
                    groupsToShow.forEach { groupName ->
                        val playersInGroup = cumulativeTiers[groupName] ?: emptyList()
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
                                val rank = cumulativeRankMap[stats.playerId]
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        text = "#$rank",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.width(32.dp)
                                    )
                                    Box(modifier = Modifier.weight(1f)) {
                                        PlayerLeaderboardRow(stats)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Single Session delete confirmation dialog
        if (showSingleDeleteConfirm && singleSessionToDelete != null) {
            val s = singleSessionToDelete!!
            AlertDialog(
                onDismissRequest = {
                    showSingleDeleteConfirm = false
                    singleSessionToDelete = null
                },
                title = { Text("Delete Session History") },
                text = {
                    Text("Are you sure you want to permanently delete \"${s.name}\"? This will also permanently erase all associated match records and statistics. This action cannot be undone.")
                },
                confirmButton = {
                    Button(
                        onClick = {
                            viewModel.deleteSession(s.id)
                            showSingleDeleteConfirm = false
                            singleSessionToDelete = null
                            viewModel.refreshHistoricalData()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Delete Permanently")
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = {
                            showSingleDeleteConfirm = false
                            singleSessionToDelete = null
                        }
                    ) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
fun HistoricalSessionCard(
    session: SessionEntity,
    stats: SessionStats,
    viewModel: BadmintonViewModel,
    onDeleteClick: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val matchesFlow = remember(session.id) { viewModel.getMatchesForSession(session.id) }
    val matches by matchesFlow.collectAsState(initial = emptyList())
    val courtsFlow = remember(session.id) { viewModel.getCourtsForSession(session.id) }
    val courts by courtsFlow.collectAsState(initial = emptyList())
    val allPlayers by viewModel.allPlayers.collectAsState()

    val sessionPlayersFlow = remember(session.id) { viewModel.getSessionPlayers(session.id) }
    val sessionPlayers by sessionPlayersFlow.collectAsState(initial = emptyList())

    val playerGamesMap: Map<Int, Int> = remember(matches, sessionPlayers, courts) {
        val map = mutableMapOf<Int, Int>()
        val courtCount = courts.size
        val totalMatchesCount = matches.size
        for (sp in sessionPlayers) {
            val adj = if (sp.isPaused && sp.pausedAtMatchCount != null && courtCount > 0) {
                val matchesDuringPause = maxOf(0, totalMatchesCount - sp.pausedAtMatchCount)
                val avg = Math.round(matchesDuringPause.toDouble() / courtCount).toInt()
                sp.adjustedGames + avg
            } else {
                sp.adjustedGames
            }
            map[sp.playerId] = adj
        }
        for (m in matches) {
            listOfNotNull(m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id).forEach { pid ->
                map[pid] = (map[pid] ?: 0) + 1
            }
        }
        map
    }

    var activeHistorySubTab by remember { mutableStateOf("MATCHES") } // "MATCHES", "LEADERBOARD"

    var playerSearchQuery by remember { mutableStateOf("") }
    var selectedPlayerFilter by remember { mutableStateOf<com.example.data.database.PlayerEntity?>(null) }

    val playersInSessionMatches = remember(matches, allPlayers) {
        val playerIds = matches.flatMap { m ->
            listOfNotNull(m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id)
        }.toSet()
        allPlayers.filter { it.id in playerIds }
    }

    val filteredMatches = remember(matches, selectedPlayerFilter) {
        val allCompleted = matches.filter { it.endTime != null }
        if (selectedPlayerFilter == null) {
            allCompleted
        } else {
            val pid = selectedPlayerFilter!!.id
            allCompleted.filter { m ->
                m.teamAPlayer1Id == pid || m.teamAPlayer2Id == pid || m.teamBPlayer1Id == pid || m.teamBPlayer2Id == pid
            }
        }
    }

    val dateString = remember(session.createdAt) {
        val sdf = SimpleDateFormat("MMM d, yyyy HH:mm", Locale.getDefault())
        sdf.format(Date(session.createdAt))
    }

    val durationString = remember(stats.durationMs) {
        val hours = stats.durationMs / 3600000
        val minutes = (stats.durationMs % 3600000) / 60000
        if (hours > 0) "${hours}h ${minutes}m" else "${minutes}m"
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { expanded = !expanded }
            .testTag("historical_session_card_${session.id}"),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(28.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(session.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Text("Date: $dateString • Duration: $durationString", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Badge(containerColor = MaterialTheme.colorScheme.secondary) {
                        Text("${stats.totalGamesPlayed} Games", modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), color = Color.White)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    
                    var showExportMenu by remember { mutableStateOf(false) }
                    val context = androidx.compose.ui.platform.LocalContext.current
                    val clubDetails by viewModel.clubDetails.collectAsState()
                    val clubName = clubDetails?.name ?: "Badminton Club"

                    Box {
                        IconButton(
                            onClick = { showExportMenu = true },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Share,
                                contentDescription = "Export Report",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        DropdownMenu(
                            expanded = showExportMenu,
                            onDismissRequest = { showExportMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Export CSV Report") },
                                onClick = {
                                    showExportMenu = false
                                    val sessionLeaderboard = com.example.data.repository.StatsCalculator.calculatePlayerStats(allPlayers, matches)
                                    com.example.util.ReportExporter.shareSessionReportCsv(
                                        context = context,
                                        session = session,
                                        courts = courts,
                                        matches = matches,
                                        players = allPlayers,
                                        sessionStats = stats,
                                        playerStatsList = sessionLeaderboard
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
                                    showExportMenu = false
                                    val sessionLeaderboard = com.example.data.repository.StatsCalculator.calculatePlayerStats(allPlayers, matches)
                                    com.example.util.ReportExporter.shareSessionReportPdf(
                                        context = context,
                                        session = session,
                                        courts = courts,
                                        matches = matches,
                                        players = allPlayers,
                                        sessionStats = stats,
                                        playerStatsList = sessionLeaderboard,
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
                    Spacer(modifier = Modifier.width(4.dp))
                    IconButton(
                        onClick = { onDeleteClick() },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Delete Session",
                            tint = MaterialTheme.colorScheme.error.copy(alpha = 0.8f),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(
                        imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = "Expand Matches"
                    )
                }
            }

            AnimatedVisibility(visible = expanded) {
                Column(modifier = Modifier.padding(top = 12.dp)) {
                    Divider()
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        FilterChip(
                            selected = activeHistorySubTab == "MATCHES",
                            onClick = { activeHistorySubTab = "MATCHES" },
                            label = { Text("Match Records") }
                        )
                        FilterChip(
                            selected = activeHistorySubTab == "LEADERBOARD",
                            onClick = { activeHistorySubTab = "LEADERBOARD" },
                            label = { Text("Session Leaderboard") }
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    if (activeHistorySubTab == "MATCHES") {
                        if (matches.isEmpty()) {
                            Text("No matches played in this session.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                        } else {
                            // Player filtering card
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.15f)),
                                shape = RoundedCornerShape(16.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(
                                        text = "Filter Match Records by Player",
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.padding(bottom = 6.dp)
                                    )

                                    OutlinedTextField(
                                        value = if (selectedPlayerFilter != null) selectedPlayerFilter!!.name else playerSearchQuery,
                                        onValueChange = { newValue ->
                                            if (selectedPlayerFilter != null) {
                                                selectedPlayerFilter = null
                                                playerSearchQuery = ""
                                            } else {
                                                playerSearchQuery = newValue
                                            }
                                        },
                                        placeholder = { Text("Type player name to filter...") },
                                        modifier = Modifier.fillMaxWidth().testTag("player_match_filter_input"),
                                        singleLine = true,
                                        leadingIcon = {
                                            Icon(
                                                imageVector = Icons.Default.Search,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        },
                                        trailingIcon = {
                                            if (selectedPlayerFilter != null || playerSearchQuery.isNotEmpty()) {
                                                IconButton(onClick = {
                                                    selectedPlayerFilter = null
                                                    playerSearchQuery = ""
                                                }) {
                                                    Icon(
                                                        imageVector = Icons.Default.Close,
                                                        contentDescription = "Clear",
                                                        tint = MaterialTheme.colorScheme.error
                                                    )
                                                }
                                            }
                                        }
                                    )

                                    // Suggestion list
                                    if (selectedPlayerFilter == null && playerSearchQuery.isNotBlank()) {
                                        val suggestions = remember(playersInSessionMatches, playerSearchQuery) {
                                            playersInSessionMatches.filter {
                                                it.name.contains(playerSearchQuery, ignoreCase = true)
                                            }
                                        }

                                        if (suggestions.isNotEmpty()) {
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Surface(
                                                modifier = Modifier.fillMaxWidth(),
                                                shape = RoundedCornerShape(8.dp),
                                                color = MaterialTheme.colorScheme.surface,
                                                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
                                            ) {
                                                Column {
                                                    suggestions.take(5).forEach { player ->
                                                        Row(
                                                            modifier = Modifier
                                                                .fillMaxWidth()
                                                                .clickable {
                                                                    selectedPlayerFilter = player
                                                                    playerSearchQuery = ""
                                                                }
                                                                .padding(horizontal = 16.dp, vertical = 12.dp),
                                                            verticalAlignment = Alignment.CenterVertically
                                                        ) {
                                                            Icon(
                                                                imageVector = if (player.gender == "MALE") Icons.Default.Male else Icons.Default.Female,
                                                                contentDescription = null,
                                                                tint = if (player.gender == "MALE") Color(0xFF3B82F6) else Color(0xFFEC4899),
                                                                modifier = Modifier.size(16.dp)
                                                            )
                                                            Spacer(modifier = Modifier.width(8.dp))
                                                            Text(
                                                                text = player.name,
                                                                style = MaterialTheme.typography.bodyMedium,
                                                                fontWeight = FontWeight.Medium
                                                            )
                                                        }
                                                        Divider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            if (filteredMatches.isEmpty()) {
                                Box(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("No matches played by this player in this session.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                                }
                            } else {
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    for (m in filteredMatches) {
                                        fun formatTeamWithGamesAnnotated(
                                            p1Obj: com.example.data.database.PlayerEntity?,
                                            p2Obj: com.example.data.database.PlayerEntity?,
                                            gamesMap: Map<Int, Int>
                                        ): AnnotatedString {
                                            return buildAnnotatedString {
                                                fun appendPlayer(player: com.example.data.database.PlayerEntity?) {
                                                    if (player == null) return
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

                                        val p1AObj = allPlayers.find { it.id == m.teamAPlayer1Id }
                                        val p2AObj = m.teamAPlayer2Id?.let { id -> allPlayers.find { it.id == id } }
                                        val teamA = formatTeamWithGamesAnnotated(p1AObj, p2AObj, playerGamesMap)

                                        val p1BObj = allPlayers.find { it.id == m.teamBPlayer1Id }
                                        val p2BObj = m.teamBPlayer2Id?.let { id -> allPlayers.find { it.id == id } }
                                        val teamB = formatTeamWithGamesAnnotated(p1BObj, p2BObj, playerGamesMap)

                                        val courtObj = courts.find { it.id == m.courtId }
                                        val courtName = courtObj?.name?.uppercase() ?: "COURT ${m.courtId}"

                                        val colorA = when (m.winnerTeam) {
                                            "A" -> Color(0xFF16A34A)
                                            else -> MaterialTheme.colorScheme.onSurface
                                        }

                                        val colorB = when (m.winnerTeam) {
                                            "B" -> Color(0xFF16A34A)
                                            else -> MaterialTheme.colorScheme.onSurface
                                        }

                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 4.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    Text(
                                                        text = "Match #${m.matchNumber}",
                                                        style = MaterialTheme.typography.bodySmall,
                                                        color = MaterialTheme.colorScheme.primary,
                                                        fontWeight = FontWeight.Bold
                                                    )
                                                    Spacer(modifier = Modifier.width(8.dp))
                                                    Text(
                                                        text = courtName,
                                                        style = MaterialTheme.typography.bodySmall,
                                                        color = MaterialTheme.colorScheme.outline
                                                    )
                                                }
                                                Spacer(modifier = Modifier.height(2.dp))
                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    Text(
                                                        text = teamA,
                                                        style = MaterialTheme.typography.bodyMedium,
                                                        fontWeight = if (m.winnerTeam == "A") FontWeight.Bold else FontWeight.Normal,
                                                        color = colorA
                                                    )
                                                    Text(
                                                        text = " vs ",
                                                        style = MaterialTheme.typography.bodySmall,
                                                        color = MaterialTheme.colorScheme.outline
                                                    )
                                                    Text(
                                                        text = teamB,
                                                        style = MaterialTheme.typography.bodyMedium,
                                                        fontWeight = if (m.winnerTeam == "B") FontWeight.Bold else FontWeight.Normal,
                                                        color = colorB
                                                    )
                                                }
                                            }

                                            Text(
                                                text = "${m.teamAScore ?: 0} : ${m.teamBScore ?: 0}",
                                                style = MaterialTheme.typography.titleMedium,
                                                fontWeight = FontWeight.Bold,
                                                color = MaterialTheme.colorScheme.primary
                                            )
                                        }
                                        Divider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                                    }
                                }
                            }
                        }
                    } else {
                        // Calculate Leaderboard dynamically for this session
                        val sessionLeaderboard = remember(allPlayers, matches) {
                            val stats = com.example.data.repository.StatsCalculator.calculatePlayerStats(allPlayers, matches)
                                .filter { it.gamesPlayed > 0 }
                            com.example.data.repository.StatsCalculator.sortPlayersByRankRule(stats)
                        }

                        val rankMap = remember(sessionLeaderboard) {
                            sessionLeaderboard.mapIndexed { index, stats -> stats.playerId to (index + 1) }.toMap()
                        }

                        val groupedTiers = remember(sessionLeaderboard) {
                            com.example.data.repository.StatsCalculator.groupPlayersByTier(sessionLeaderboard)
                        }

                        if (sessionLeaderboard.isEmpty()) {
                            Text("No match statistics available for this session.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                        } else {
                            var sessionGroupFilter by remember { mutableStateOf("ALL") }
                            
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    FilterChip(
                                        selected = sessionGroupFilter == "ALL",
                                        onClick = { sessionGroupFilter = "ALL" },
                                        label = { Text("All", fontSize = 11.sp) }
                                    )
                                    FilterChip(
                                        selected = sessionGroupFilter == "A",
                                        onClick = { sessionGroupFilter = "A" },
                                        label = { Text("Group A", fontSize = 11.sp) }
                                    )
                                    FilterChip(
                                        selected = sessionGroupFilter == "B",
                                        onClick = { sessionGroupFilter = "B" },
                                        label = { Text("Group B", fontSize = 11.sp) }
                                    )
                                    FilterChip(
                                        selected = sessionGroupFilter == "C",
                                        onClick = { sessionGroupFilter = "C" },
                                        label = { Text("Group C", fontSize = 11.sp) }
                                    )
                                }
                                
                                val groupsToShow = listOf("A", "B", "C").filter { sessionGroupFilter == "ALL" || sessionGroupFilter == it }
                                
                                groupsToShow.forEach { groupName ->
                                    val playersInGroup = groupedTiers[groupName] ?: emptyList()
                                    if (playersInGroup.isNotEmpty()) {
                                        Text(
                                            text = when (groupName) {
                                                "A" -> "Group A (Top 25%)"
                                                "B" -> "Group B (Next 50%)"
                                                else -> "Group C (Bottom 25%)"
                                            },
                                            fontWeight = FontWeight.Bold,
                                            style = MaterialTheme.typography.titleSmall,
                                            color = when (groupName) {
                                                "A" -> MaterialTheme.colorScheme.primary
                                                "B" -> MaterialTheme.colorScheme.secondary
                                                else -> MaterialTheme.colorScheme.tertiary
                                            },
                                            modifier = Modifier.padding(top = 4.dp)
                                        )
                                        
                                        playersInGroup.forEach { stats ->
                                            val rank = rankMap[stats.playerId]
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                Text(
                                                    text = "#$rank",
                                                    style = MaterialTheme.typography.titleSmall,
                                                    fontWeight = FontWeight.Bold,
                                                    color = MaterialTheme.colorScheme.primary,
                                                    modifier = Modifier.width(32.dp)
                                                )
                                                Box(modifier = Modifier.weight(1f)) {
                                                    PlayerLeaderboardRow(stats)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

fun getDayOfWeek(timestamp: Long): String {
    val calendar = Calendar.getInstance().apply {
        timeInMillis = timestamp
    }
    return when (calendar.get(Calendar.DAY_OF_WEEK)) {
        Calendar.SUNDAY -> "Sunday"
        Calendar.MONDAY -> "Monday"
        Calendar.TUESDAY -> "Tuesday"
        Calendar.WEDNESDAY -> "Wednesday"
        Calendar.THURSDAY -> "Thursday"
        Calendar.FRIDAY -> "Friday"
        Calendar.SATURDAY -> "Saturday"
        else -> "Unknown"
    }
}
