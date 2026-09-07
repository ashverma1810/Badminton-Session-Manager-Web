package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import com.example.data.database.CourtMasterEntity
import com.example.data.database.CourtEntity
import com.example.data.database.MatchEntity
import com.example.data.database.PlayerEntity
import com.example.data.database.SessionPlayerJoinEntity
import com.example.ui.viewmodel.BadmintonViewModel
import java.text.SimpleDateFormat
import java.util.*

fun calculateWinningScore(losingScore: Int, targetScore: Int): Int {
    val maxCap = when (targetScore) {
        15 -> 20
        21 -> 30
        else -> targetScore + 9
    }
    if (losingScore < 0) return targetScore
    if (losingScore >= maxCap) return maxCap

    return if (losingScore < targetScore - 1) {
        targetScore
    } else if (losingScore == targetScore - 1) {
        targetScore
    } else {
        // losingScore >= targetScore -> deuce / setting rule: win by 2, capped at maxCap
        minOf(losingScore + 2, maxCap)
    }
}

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun SessionScreen(
    viewModel: BadmintonViewModel,
    modifier: Modifier = Modifier
) {
    val activeSession by viewModel.activeSession.collectAsState()
    val courts by viewModel.activeSessionCourts.collectAsState()
    val joins by viewModel.activeSessionPlayers.collectAsState()
    val allPlayers by viewModel.allPlayers.collectAsState()
    val matches by viewModel.activeSessionMatches.collectAsState()
    val clubDetails by viewModel.clubDetails.collectAsState()

    var scoringMatch by remember { mutableStateOf<MatchEntity?>(null) }
    var playerToReplace by remember { mutableStateOf<PlayerEntity?>(null) }
    var substitutionMatch by remember { mutableStateOf<MatchEntity?>(null) }
    var showSubstitutionDialog by remember { mutableStateOf(false) }

    var deletingMatch by remember { mutableStateOf<MatchEntity?>(null) }
    var showDeletePromptDialog by remember { mutableStateOf(false) }
    var showTargetScoreDialog by remember { mutableStateOf(false) }

    if (activeSession == null) {
        Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Create and start a session to view Live court rotations.", style = MaterialTheme.typography.titleMedium)
        }
        return
    }

    val session = activeSession!!

    // Tab and setup dialog states
    var activeTab by remember { mutableStateOf(if (session.startTime == null) 0 else 1) }
    val allMasterCourts by viewModel.allMasterCourts.collectAsState()
    var showAddPlayerDialog by remember { mutableStateOf(false) }
    var showManageCourtsDialog by remember { mutableStateOf(false) }
    var showAddCourtDialog by remember { mutableStateOf(false) }

    val clubThemeColor = remember(clubDetails) {
        val hex = clubDetails?.themeColorHex
        if (hex != null) {
            try {
                Color(android.graphics.Color.parseColor(hex))
            } catch (e: Exception) {
                Color(0xFF0284C7)
            }
        } else {
            Color(0xFF0284C7)
        }
    }
    val activeMatches = remember(matches) { matches.filter { it.endTime == null } }
    val busyPlayerIds = remember(activeMatches) {
        val ids = mutableSetOf<Int>()
        for (m in activeMatches) {
            ids.add(m.teamAPlayer1Id)
            m.teamAPlayer2Id?.let { ids.add(it) }
            ids.add(m.teamBPlayer1Id)
            m.teamBPlayer2Id?.let { ids.add(it) }
        }
        ids
    }

    val sessionPlayersList = remember(joins, allPlayers) {
        allPlayers.filter { p -> joins.any { j -> j.playerId == p.id } }
    }

    val playingPlayers = remember(sessionPlayersList, busyPlayerIds) {
        sessionPlayersList.filter { busyPlayerIds.contains(it.id) }
    }
    val pausedPlayers = remember(sessionPlayersList, joins) {
        sessionPlayersList.filter { p -> joins.find { j -> j.playerId == p.id }?.isPaused == true }
    }
    val waitingPlayers = remember(sessionPlayersList, busyPlayerIds, joins) {
        sessionPlayersList.filter { p -> !busyPlayerIds.contains(p.id) && joins.find { j -> j.playerId == p.id }?.isPaused == false }
    }

    val actualGamesCountMap = remember(matches, sessionPlayersList) {
        val counts = mutableMapOf<Int, Int>()
        for (p in sessionPlayersList) counts[p.id] = 0
        for (m in matches) {
            val players = listOfNotNull(m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id)
            for (pId in players) {
                counts[pId] = (counts[pId] ?: 0) + 1
            }
        }
        counts
    }

    val joinsMap = remember(joins) { joins.associateBy { it.playerId } }

    val gamesCountMap = remember(actualGamesCountMap, joinsMap, matches, courts) {
        val totalMatchesCount = matches.size
        val courtCount = courts.size
        actualGamesCountMap.mapValues { (pId, actualCount) ->
            val join = joinsMap[pId]
            val adj = if (join != null) {
                if (join.isPaused && join.pausedAtMatchCount != null && courtCount > 0) {
                    val matchesDuringPause = maxOf(0, totalMatchesCount - join.pausedAtMatchCount)
                    val avg = Math.round(matchesDuringPause.toDouble() / courtCount).toInt()
                    join.adjustedGames + avg
                } else {
                    join.adjustedGames
                }
            } else 0
            actualCount + adj
        }
    }

    val sortedWaitingPlayers = remember(waitingPlayers, gamesCountMap) {
        waitingPlayers.sortedBy { gamesCountMap[it.id] ?: 0 }
    }

    Column(modifier = modifier.fillMaxSize()) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 4.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)),
            shape = RoundedCornerShape(28.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.2f))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column {
                        Text(
                            text = session.name,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        Text(
                            text = "Type: ${session.type}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            var showStatusDropdown by remember { mutableStateOf(false) }
                            Box {
                                Surface(
                                    onClick = { showStatusDropdown = true },
                                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.8f),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.clickable { showStatusDropdown = true }
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(8.dp)
                                                .clip(RoundedCornerShape(4.dp))
                                                .background(
                                                    when (session.status) {
                                                        "Active" -> Color(0xFF10B981)
                                                        "End" -> Color(0xFFEF4444)
                                                        else -> Color(0xFFF59E0B)
                                                    }
                                                )
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = "Status: ${session.status}",
                                            style = MaterialTheme.typography.bodySmall,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Icon(
                                            imageVector = Icons.Default.ArrowDropDown,
                                            contentDescription = "Change Status",
                                            modifier = Modifier.size(16.dp),
                                            tint = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                    }
                                }

                                DropdownMenu(
                                    expanded = showStatusDropdown,
                                    onDismissRequest = { showStatusDropdown = false }
                                ) {
                                    DropdownMenuItem(
                                        text = { Text("Setting Up") },
                                        onClick = {
                                            viewModel.updateSessionStatus(session.id, "Setting Up")
                                            showStatusDropdown = false
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Active") },
                                        onClick = {
                                            viewModel.updateSessionStatus(session.id, "Active")
                                            showStatusDropdown = false
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("End") },
                                        onClick = {
                                            viewModel.updateSessionStatus(session.id, "End")
                                            showStatusDropdown = false
                                        }
                                    )
                                }
                            }

                            Surface(
                                onClick = { showTargetScoreDialog = true },
                                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.8f),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.clickable { showTargetScoreDialog = true }.testTag("session_target_score_badge")
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = "Target: ${session.targetScore} pts",
                                        style = MaterialTheme.typography.bodySmall,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Icon(
                                        imageVector = Icons.Default.Edit,
                                        contentDescription = "Edit Target Score",
                                        modifier = Modifier.size(12.dp),
                                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                                    )
                                }
                            }
                        }
                    }
                    if (session.status != "Active" && session.status != "End") {
                        Button(
                            onClick = { 
                                viewModel.startSession() 
                                activeTab = 1
                            },
                            modifier = Modifier.testTag("start_session_button"),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Start Session")
                        }
                    } else if (session.status == "Active") {
                        OutlinedButton(
                            onClick = { viewModel.stopSession() },
                            modifier = Modifier.testTag("stop_session_button"),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                        ) {
                            Icon(Icons.Default.Stop, contentDescription = null)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("End Session")
                        }
                    }
                }
            }
        }

        TabRow(
            selectedTabIndex = activeTab,
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = clubThemeColor
        ) {
            Tab(
                selected = activeTab == 0,
                onClick = { activeTab = 0 },
                text = { Text("Session", fontWeight = FontWeight.Bold) },
                icon = { Icon(Icons.Default.Settings, contentDescription = null) }
            )
            Tab(
                selected = activeTab == 1,
                onClick = { activeTab = 1 },
                text = { Text("Games", fontWeight = FontWeight.Bold) },
                icon = { Icon(Icons.Default.PlayCircle, contentDescription = null) }
            )
            Tab(
                selected = activeTab == 2,
                onClick = { activeTab = 2 },
                text = { Text("Stats", fontWeight = FontWeight.Bold) },
                icon = { Icon(Icons.Default.Leaderboard, contentDescription = null) }
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Box(modifier = Modifier.weight(1f)) {
            when (activeTab) {
                1 -> {
                    if (session.startTime == null) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                                Text(
                                    text = "Session is in Setup Mode",
                                    style = MaterialTheme.typography.headlineSmall,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Add players and courts in the 'Manage Session' tab, then click Start.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                                    modifier = Modifier.padding(top = 8.dp, bottom = 24.dp)
                                )
                                Button(onClick = { 
                                    viewModel.startSession() 
                                    activeTab = 1
                                }) {
                                    Icon(Icons.Default.PlayArrow, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Start Session Now")
                                }
                            }
                        }
                    } else {
                        // Using session-wide player state

                        BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val isWideScreen = maxWidth > 700.dp

        if (isWideScreen) {
            // Adaptive top/bottom stacked layout for tablets to ensure full width for scoring buttons and rotation pools
            Column(modifier = Modifier.fillMaxSize()) {
                // Top Section: Live Courts
                Column(
                    modifier = Modifier
                        .weight(1.3f)
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Live Courts", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    if (courts.isEmpty()) {
                        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                            Text("No courts configured. Add courts in Manage Session.", style = MaterialTheme.typography.bodyMedium)
                        }
                    } else {
                        LazyVerticalGrid(
                            columns = GridCells.Adaptive(minSize = 340.dp),
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            items(courts) { court ->
                                val currentMatch = activeMatches.find { it.courtId == court.id }
                                CourtLiveCard(
                                    court = court,
                                    match = currentMatch,
                                    allPlayers = allPlayers,
                                    gamesCountMap = gamesCountMap,
                                    joins = joins,
                                    onEnterScore = { scoringMatch = it },
                                    onGenerateMatch = { viewModel.generateMatchForCourt(court.id) },
                                    onPlayerClick = { match, player ->
                                        substitutionMatch = match
                                        playerToReplace = player
                                        showSubstitutionDialog = true
                                    },
                                    onDeleteMatch = { match ->
                                        deletingMatch = match
                                        showDeletePromptDialog = true
                                    }
                                )
                            }
                        }
                    }
                }

                Divider(color = MaterialTheme.colorScheme.outlineVariant)

                // Bottom Section: Player Rotation Pools
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Player Rotation Pools", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    
                    PlayersRotationListsSection(
                        playing = playingPlayers,
                        waiting = sortedWaitingPlayers,
                        paused = pausedPlayers,
                        gamesCountMap = gamesCountMap,
                        joins = joins,
                        onTogglePause = { viewModel.togglePlayerPause(it) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        } else {
            // Mobile scrolling view
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Text("Live Courts", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                }

                if (courts.isEmpty()) {
                    item {
                        Text("No courts configured. Go to Manage Session tab to add courts.", style = MaterialTheme.typography.bodyMedium)
                    }
                } else {
                    items(courts) { court ->
                        val currentMatch = activeMatches.find { it.courtId == court.id }
                        CourtLiveCard(
                            court = court,
                            match = currentMatch,
                            allPlayers = allPlayers,
                            gamesCountMap = gamesCountMap,
                            joins = joins,
                            onEnterScore = { scoringMatch = it },
                            onGenerateMatch = { viewModel.generateMatchForCourt(court.id) },
                            onPlayerClick = { match, player ->
                                substitutionMatch = match
                                playerToReplace = player
                                showSubstitutionDialog = true
                            },
                            onDeleteMatch = { match ->
                                deletingMatch = match
                                showDeletePromptDialog = true
                            }
                        )
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Player Rotations", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                }

                item {
                    PlayersRotationListsSection(
                        playing = playingPlayers,
                        waiting = sortedWaitingPlayers,
                        paused = pausedPlayers,
                        gamesCountMap = gamesCountMap,
                        joins = joins,
                        onTogglePause = { viewModel.togglePlayerPause(it) },
                        modifier = Modifier.heightIn(max = 500.dp)
                    )
                }
            }
        }
    }
}
}
                0 -> {
                    // SESSION SETUP CONTENT (session card, courts and session players)
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {


                        // 2. Courts Section
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "Courts (${courts.size})",
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold
                                )
                                Button(
                                    onClick = { showManageCourtsDialog = true },
                                    modifier = Modifier.testTag("manage_courts_button")
                                ) {
                                    Icon(Icons.Default.Grid4x4, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Manage Courts")
                                }
                            }
                        }

                        if (courts.isEmpty()) {
                            item {
                                Text(
                                    text = "No courts added. Add at least one court.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.padding(vertical = 8.dp)
                                )
                            }
                        } else {
                            item {
                                FlowRow(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    courts.forEach { court ->
                                        var showMenu by remember { mutableStateOf(false) }
                                        Box {
                                            InputChip(
                                                selected = true,
                                                onClick = {
                                                    if (session.type == "MULTI_TYPE") {
                                                        showMenu = true
                                                    }
                                                },
                                                label = {
                                                    val suffix = if (session.type == "MULTI_TYPE") " (${court.gameType})" else ""
                                                    Text(court.name + suffix)
                                                },
                                                trailingIcon = {
                                                    Icon(
                                                        Icons.Default.Delete,
                                                        contentDescription = "Remove Court",
                                                        modifier = Modifier
                                                            .size(16.dp)
                                                            .clickable { viewModel.deleteCourtFromActiveSession(court.id) }
                                                    )
                                                }
                                            )

                                            if (showMenu) {
                                                DropdownMenu(
                                                    expanded = showMenu,
                                                    onDismissRequest = { showMenu = false }
                                                ) {
                                                    DropdownMenuItem(
                                                        text = { Text("Singles") },
                                                        onClick = {
                                                            viewModel.updateCourtGameType(court.id, "SINGLES")
                                                            showMenu = false
                                                        }
                                                    )
                                                    DropdownMenuItem(
                                                        text = { Text("Doubles") },
                                                        onClick = {
                                                            viewModel.updateCourtGameType(court.id, "DOUBLES")
                                                            showMenu = false
                                                        }
                                                    )
                                                    DropdownMenuItem(
                                                        text = { Text("Mixed Doubles") },
                                                        onClick = {
                                                            viewModel.updateCourtGameType(court.id, "MIXED_DOUBLES")
                                                            showMenu = false
                                                        }
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // 3. Session Players Section
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "Session Players (${joins.size})",
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold
                                )
                                Button(
                                    onClick = { showAddPlayerDialog = true },
                                    modifier = Modifier.testTag("manage_players_button")
                                ) {
                                    Icon(Icons.Default.People, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Manage Pool")
                                }
                            }
                        }

                        if (joins.isEmpty()) {
                            item {
                                Text(
                                    text = "No players added to this session. Click Manage Pool to add players.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                    modifier = Modifier.padding(vertical = 16.dp)
                                )
                            }
                        } else {
                            items(joins) { join ->
                                val player = allPlayers.find { it.id == join.playerId }
                                if (player != null) {
                                    PlayerSetupRow(
                                        player = player,
                                        join = join,
                                        courts = courts,
                                        onTogglePause = { viewModel.togglePlayerPause(player.id) },
                                        onEligibilityChanged = { list ->
                                            viewModel.updatePlayerCourtEligibility(player.id, list)
                                        },
                                        onRemove = { viewModel.removePlayerFromActiveSession(player.id) }
                                    )
                                }
                            }
                        }
                    }
                }
                2 -> {
                    DashboardScreen(viewModel = viewModel)
                }
            }
        }
    }

    // SCORE ENTRY DIALOG
    if (scoringMatch != null) {
        val match = scoringMatch!!
        val courtName = courts.find { it.id == match.courtId }?.name ?: "Court"
        var scoreA by remember { mutableStateOf("") }
        var scoreB by remember { mutableStateOf("") }

        val sessionTargetScore = session.targetScore.takeIf { it > 0 } ?: (clubDetails?.targetScore ?: 21)
        val maxScoreLimit = when (sessionTargetScore) {
            21 -> 30
            15 -> 20
            else -> sessionTargetScore + 9
        }
        val valA = scoreA.toIntOrNull()
        val valB = scoreB.toIntOrNull()
        val isScoreAInvalid = valA != null && valA > maxScoreLimit
        val isScoreBInvalid = valB != null && valB > maxScoreLimit
        val isAnyScoreInvalid = isScoreAInvalid || isScoreBInvalid
        val isInputValid = scoreA.isNotBlank() && scoreB.isNotBlank() && !isAnyScoreInvalid

        val p1A = allPlayers.find { it.id == match.teamAPlayer1Id }?.name ?: ""
        val p2A = match.teamAPlayer2Id?.let { allPlayers.find { p -> p.id == it }?.name }
        val teamANames = if (p2A != null) "$p1A & $p2A" else p1A

        val p1B = allPlayers.find { it.id == match.teamBPlayer1Id }?.name ?: ""
        val p2B = match.teamBPlayer2Id?.let { allPlayers.find { p -> p.id == it }?.name }
        val teamBNames = if (p2B != null) "$p1B & $p2B" else p1B

        AlertDialog(
            onDismissRequest = { scoringMatch = null },
            title = { Text("Enter Match Score - $courtName") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(text = "Enter final scores for Match #${match.matchNumber}:", style = MaterialTheme.typography.bodyMedium)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(teamANames, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, minLines = 2)
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = scoreA,
                                onValueChange = { input ->
                                    val clean = input.filter { char -> char.isDigit() }
                                    scoreA = clean
                                    val numA = clean.toIntOrNull()
                                    if (numA != null) {
                                        scoreB = calculateWinningScore(numA, sessionTargetScore).toString()
                                    }
                                },
                                label = { Text("Score A") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.testTag("team_a_score_input"),
                                singleLine = true,
                                isError = isScoreAInvalid
                            )
                        }

                        Text("VS", fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.padding(top = 24.dp))

                        Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(teamBNames, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, minLines = 2)
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = scoreB,
                                onValueChange = { input ->
                                    val clean = input.filter { char -> char.isDigit() }
                                    scoreB = clean
                                    val numB = clean.toIntOrNull()
                                    if (numB != null) {
                                        scoreA = calculateWinningScore(numB, sessionTargetScore).toString()
                                    }
                                },
                                label = { Text("Score B") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.testTag("team_b_score_input"),
                                singleLine = true,
                                isError = isScoreBInvalid
                            )
                        }
                    }

                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "Target: $sessionTargetScore pts • Entering a losing score auto-fills the winning score",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        )
                    }

                    if (isAnyScoreInvalid) {
                        Text(
                            text = "Maximum allowed score for a $sessionTargetScore-point game is $maxScoreLimit.",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (isInputValid) {
                            viewModel.enterMatchScore(match.id, valA!!, valB!!)
                            scoringMatch = null
                        }
                    },
                    enabled = isInputValid,
                    modifier = Modifier.testTag("confirm_record_score")
                ) {
                    Text("Record Score")
                }
            },
            dismissButton = {
                TextButton(onClick = { scoringMatch = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // PLAYER SUBSTITUTION DIALOG
    if (showSubstitutionDialog && playerToReplace != null && substitutionMatch != null) {
        val courtId = substitutionMatch!!.courtId
        // Find players who are in the session, are currently NOT playing, and are not paused
        val eligibleSubstitutes = remember(waitingPlayers, joins, playerToReplace, session) {
            waitingPlayers.filter { player ->
                val join = joins.find { j -> j.playerId == player.id }
                
                // Court eligibility
                val isCourtEligible = join?.eligibleCourtIds.isNullOrEmpty() ||
                        join?.eligibleCourtIds?.split(",")?.contains(courtId.toString()) == true
                
                // Gender match (only for MIXED_DOUBLES)
                val isGenderMatch = if (session.type == "MIXED_DOUBLES") {
                    player.gender == playerToReplace!!.gender
                } else {
                    true
                }
                
                isCourtEligible && isGenderMatch
            }
        }

        AlertDialog(
            onDismissRequest = {
                showSubstitutionDialog = false
                playerToReplace = null
                substitutionMatch = null
            },
            title = { Text("Substitute Player") },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Substitute for ${playerToReplace?.name} (${playerToReplace?.gender})",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Select a player from the waitlist to take their place on court.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    if (eligibleSubstitutes.isEmpty()) {
                        Text(
                            text = "No eligible waitlist players found. (Note: substitutes must match the gender of the player being replaced for Mixed Doubles).",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    } else {
                        Box(modifier = Modifier.heightIn(max = 240.dp)) {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(eligibleSubstitutes) { player ->
                                    Card(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                viewModel.substitutePlayer(
                                                    substitutionMatch!!.id,
                                                    playerToReplace!!.id,
                                                    player.id
                                                )
                                                showSubstitutionDialog = false
                                                playerToReplace = null
                                                substitutionMatch = null
                                            },
                                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                                    ) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Icon(
                                                    imageVector = if (player.gender == "MALE") Icons.Default.Male else Icons.Default.Female,
                                                    contentDescription = player.gender,
                                                    tint = if (player.gender == "MALE") Color(0xFF38BDF8) else Color(0xFFF472B6),
                                                    modifier = Modifier.size(16.dp)
                                                )
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Text(player.name, fontWeight = FontWeight.SemiBold)
                                            }
                                            Icon(
                                                imageVector = Icons.Default.SwapHoriz,
                                                contentDescription = "Select substitution",
                                                tint = MaterialTheme.colorScheme.primary
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(
                    onClick = {
                        showSubstitutionDialog = false
                        playerToReplace = null
                        substitutionMatch = null
                    }
                ) {
                    Text("Cancel")
                }
            }
        )
    }

    // GAME DELETION / END GAME ACTIONS DIALOG
    if (showDeletePromptDialog && deletingMatch != null) {
        val match = deletingMatch!!
        var showEnterScoreInline by remember { mutableStateOf(false) }
        var scoreA by remember { mutableStateOf("") }
        var scoreB by remember { mutableStateOf("") }

        val sessionTargetScore = session.targetScore.takeIf { it > 0 } ?: (clubDetails?.targetScore ?: 21)
        val maxScoreLimit = when (sessionTargetScore) {
            21 -> 30
            15 -> 20
            else -> sessionTargetScore + 9
        }
        val valA = scoreA.toIntOrNull()
        val valB = scoreB.toIntOrNull()
        val isScoreAInvalid = valA != null && valA > maxScoreLimit
        val isScoreBInvalid = valB != null && valB > maxScoreLimit
        val isAnyScoreInvalid = isScoreAInvalid || isScoreBInvalid
        val isInputValid = scoreA.isNotBlank() && scoreB.isNotBlank() && !isAnyScoreInvalid

        AlertDialog(
            onDismissRequest = {
                showDeletePromptDialog = false
                deletingMatch = null
                showEnterScoreInline = false
                scoreA = ""
                scoreB = ""
            },
            title = { Text("Delete / End Game") },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Would you like to record scores before ending this game? Recording scores updates player stats and history, while ignoring scores deletes the game entirely.",
                        style = MaterialTheme.typography.bodyMedium
                    )

                    if (showEnterScoreInline) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Enter Game Scores", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            OutlinedTextField(
                                value = scoreA,
                                onValueChange = { input ->
                                    val clean = input.filter { char -> char.isDigit() }
                                    scoreA = clean
                                    val numA = clean.toIntOrNull()
                                    if (numA != null) {
                                        scoreB = calculateWinningScore(numA, sessionTargetScore).toString()
                                    }
                                },
                                label = { Text("Score A") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                                isError = isScoreAInvalid
                            )
                            OutlinedTextField(
                                value = scoreB,
                                onValueChange = { input ->
                                    val clean = input.filter { char -> char.isDigit() }
                                    scoreB = clean
                                    val numB = clean.toIntOrNull()
                                    if (numB != null) {
                                        scoreA = calculateWinningScore(numB, sessionTargetScore).toString()
                                    }
                                },
                                label = { Text("Score B") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                                isError = isScoreBInvalid
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Surface(
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = "Target: $sessionTargetScore pts • Entering a losing score auto-fills the winning score",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }

                        if (isAnyScoreInvalid) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Maximum allowed score for a $sessionTargetScore-point game is $maxScoreLimit.",
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (!showEnterScoreInline) {
                        TextButton(
                            onClick = {
                                showEnterScoreInline = true
                            }
                        ) {
                            Text("Record Score")
                        }
                        Button(
                            onClick = {
                                viewModel.deleteMatch(match.id)
                                showDeletePromptDialog = false
                                deletingMatch = null
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                        ) {
                            Text("Ignore & Delete")
                        }
                    } else {
                        Button(
                            onClick = {
                                if (isInputValid) {
                                    viewModel.enterMatchScore(match.id, valA!!, valB!!)
                                    showDeletePromptDialog = false
                                    deletingMatch = null
                                    showEnterScoreInline = false
                                    scoreA = ""
                                    scoreB = ""
                                }
                            },
                            enabled = isInputValid
                        ) {
                            Text("Save & Complete")
                        }
                    }
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showDeletePromptDialog = false
                        deletingMatch = null
                        showEnterScoreInline = false
                        scoreA = ""
                        scoreB = ""
                    }
                ) {
                    Text("Cancel")
                }
            }
        )
    }

    // EDIT SESSION TARGET SCORE DIALOG
    if (showTargetScoreDialog) {
        var editTargetScore by remember { mutableStateOf(session.targetScore) }
        var customScoreText by remember { mutableStateOf(session.targetScore.toString()) }

        AlertDialog(
            onDismissRequest = { showTargetScoreDialog = false },
            title = { Text("Edit Session Target Score") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text(
                        text = "Set the target winning score for matches in this session. Default is inherited from club settings (${clubDetails?.targetScore ?: 21} pts).",
                        style = MaterialTheme.typography.bodyMedium
                    )

                    val presets = listOf(11, 15, 21, 25, 30)
                    Text("Quick Presets:", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        presets.forEach { preset ->
                            FilterChip(
                                selected = editTargetScore == preset,
                                onClick = {
                                    editTargetScore = preset
                                    customScoreText = preset.toString()
                                },
                                label = { Text("$preset", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    OutlinedTextField(
                        value = customScoreText,
                        onValueChange = { input ->
                            val digits = input.filter { it.isDigit() }
                            customScoreText = digits
                            digits.toIntOrNull()?.let { editTargetScore = it }
                        },
                        label = { Text("Custom Target Points") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val finalScore = customScoreText.toIntOrNull() ?: editTargetScore
                        if (finalScore > 0) {
                            viewModel.updateSessionTargetScore(session.id, finalScore)
                        }
                        showTargetScoreDialog = false
                    },
                    enabled = (customScoreText.toIntOrNull() ?: 0) > 0
                ) {
                    Text("Update Target")
                }
            },
            dismissButton = {
                TextButton(onClick = { showTargetScoreDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ============================================
    // MANAGE PLAYERS & COURTS DIALOGS FOR SETUP
    // ============================================
    if (showAddPlayerDialog) {
        var masterName by remember { mutableStateOf("") }
        var masterGender by remember { mutableStateOf("MALE") }
        var masterSearchQuery by remember { mutableStateOf("") }
        val sessionJoinIds = joins.map { it.playerId }.toSet()

        AlertDialog(
            onDismissRequest = { showAddPlayerDialog = false },
            title = { Text("Configure Player Pool") },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    // Functionality 1: Create and Register new player (as PAYG in master & live session)
                    Text("Create & Register New Player", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(6.dp))
                    val isDuplicate = masterName.isNotBlank() && allPlayers.any { it.name.trim().equals(masterName.trim(), ignoreCase = true) }

                    Column(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = masterName,
                                onValueChange = { masterName = it },
                                label = { Text("Name") },
                                isError = isDuplicate,
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("player_name_input"),
                                singleLine = true
                            )
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("M", fontSize = 12.sp)
                                RadioButton(selected = masterGender == "MALE", onClick = { masterGender = "MALE" })
                                Spacer(modifier = Modifier.width(2.dp))
                                Text("F", fontSize = 12.sp)
                                RadioButton(selected = masterGender == "FEMALE", onClick = { masterGender = "FEMALE" })
                            }
                        }
                        if (isDuplicate) {
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "A member with this name already exists in master pool.",
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }

                    Button(
                        onClick = {
                            if (masterName.isNotBlank() && !isDuplicate) {
                                viewModel.addPAYGPlayerToActiveSession(masterName, masterGender)
                                masterName = ""
                            }
                        },
                        enabled = masterName.isNotBlank() && !isDuplicate,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp)
                            .testTag("create_payg_player_button")
                    ) {
                        Text("Create & Register Player (PAYG)")
                    }

                    Divider(modifier = Modifier.padding(vertical = 10.dp))

                    // Functionality 2: Register Player (Master) - fuzzy search across all club members
                    Text("Register Player (Master)", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(6.dp))

                    OutlinedTextField(
                        value = masterSearchQuery,
                        onValueChange = { masterSearchQuery = it },
                        placeholder = { Text("Search club members pool...") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("regular_search_input")
                            .padding(bottom = 8.dp),
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        trailingIcon = {
                            if (masterSearchQuery.isNotEmpty()) {
                                IconButton(onClick = { masterSearchQuery = "" }) {
                                    Icon(Icons.Default.Clear, contentDescription = "Clear search")
                                }
                            }
                        }
                    )

                    val filteredMasterPlayers = remember(masterSearchQuery, allPlayers) {
                        if (masterSearchQuery.isNotBlank()) {
                            allPlayers.filter { it.name.contains(masterSearchQuery, ignoreCase = true) }
                        } else {
                            allPlayers
                        }
                    }

                    Box(modifier = Modifier.heightIn(max = 220.dp)) {
                        if (allPlayers.isEmpty()) {
                            Text("No club members found. Create a new player above.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        } else if (filteredMasterPlayers.isEmpty()) {
                            Text("No matching players found.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        } else {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                items(filteredMasterPlayers) { player ->
                                    val inSession = sessionJoinIds.contains(player.id)
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(
                                                if (inSession) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                                                else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f)
                                            )
                                            .padding(horizontal = 8.dp, vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                                            Icon(
                                                imageVector = if (player.gender == "MALE") Icons.Default.Male else Icons.Default.Female,
                                                contentDescription = player.gender,
                                                tint = if (player.gender == "MALE") Color(0xFF3B82F6) else Color(0xFFEC4899),
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Column {
                                                Text(player.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                                Surface(
                                                    color = if (player.isPAYG) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.secondaryContainer,
                                                    shape = RoundedCornerShape(4.dp)
                                                ) {
                                                    Text(
                                                        text = if (player.isPAYG) "PAYG" else "Member",
                                                        style = MaterialTheme.typography.labelSmall,
                                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                                    )
                                                }
                                            }
                                        }

                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            if (inSession) {
                                                IconButton(onClick = { viewModel.removePlayerFromActiveSession(player.id) }) {
                                                    Icon(Icons.Default.RemoveCircle, contentDescription = "Remove from session", tint = MaterialTheme.colorScheme.error)
                                                }
                                            } else {
                                                IconButton(onClick = { viewModel.addPlayerToActiveSession(player.id) }) {
                                                    Icon(Icons.Default.AddCircle, contentDescription = "Add to session", tint = MaterialTheme.colorScheme.primary)
                                                }
                                            }
                                            IconButton(onClick = { viewModel.deletePlayerFromMaster(player.id) }) {
                                                Icon(Icons.Default.Delete, contentDescription = "Delete from master pool", tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f))
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showAddPlayerDialog = false }) {
                    Text("Done")
                }
            }
        )
    }

    if (showManageCourtsDialog) {
        var masterCourtName by remember { mutableStateOf("") }
        val sessionCourtNames = courts.map { it.name }.toSet()
        val isMasterDuplicate = masterCourtName.isNotBlank() && allMasterCourts.any { it.name.trim().equals(masterCourtName.trim(), ignoreCase = true) }

        AlertDialog(
            onDismissRequest = { showManageCourtsDialog = false },
            title = { Text("Configure Court Master") },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text("Create Central Court", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = masterCourtName,
                                onValueChange = { masterCourtName = it },
                                label = { Text("Court Name") },
                                placeholder = { Text("Court 1") },
                                isError = isMasterDuplicate,
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("court_name_master_input"),
                                singleLine = true
                            )
                            Button(
                                onClick = {
                                    if (masterCourtName.isNotBlank() && !isMasterDuplicate) {
                                        viewModel.addCourtToMaster(masterCourtName)
                                        masterCourtName = ""
                                    }
                                },
                                enabled = masterCourtName.isNotBlank() && !isMasterDuplicate,
                                modifier = Modifier.testTag("submit_court_master_button")
                            ) {
                                Text("Save")
                            }
                        }
                        if (isMasterDuplicate) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "A central court with this name already exists.",
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }

                    Divider(modifier = Modifier.padding(vertical = 12.dp))

                    Text("Central Court Master", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))

                    Box(modifier = Modifier.heightIn(max = 240.dp)) {
                        if (allMasterCourts.isEmpty()) {
                            Text("No master courts found. Create some above.")
                        } else {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                items(allMasterCourts) { masterCourt ->
                                    val inSession = sessionCourtNames.contains(masterCourt.name)
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(
                                                if (inSession) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                                                else Color.Transparent
                                            )
                                            .padding(8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(
                                                imageVector = Icons.Default.Grid4x4,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.primary,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(masterCourt.name, fontWeight = FontWeight.SemiBold)
                                        }

                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            if (inSession) {
                                                val activeSessionCourt = courts.find { it.name == masterCourt.name }
                                                IconButton(onClick = {
                                                    if (activeSessionCourt != null) {
                                                        viewModel.deleteCourtFromActiveSession(activeSessionCourt.id)
                                                    }
                                                }) {
                                                    Icon(Icons.Default.RemoveCircle, contentDescription = "Remove from Session", tint = MaterialTheme.colorScheme.error)
                                                }
                                            } else {
                                                IconButton(onClick = {
                                                    viewModel.addMasterCourtToActiveSession(masterCourt)
                                                }) {
                                                    Icon(Icons.Default.AddCircle, contentDescription = "Add to Session", tint = MaterialTheme.colorScheme.primary)
                                                }
                                            }
                                            IconButton(onClick = { viewModel.deleteCourtFromMaster(masterCourt.id) }) {
                                                Icon(Icons.Default.Delete, contentDescription = "Delete master", tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showManageCourtsDialog = false }) {
                    Text("Done")
                }
            }
        )
    }
}

@Composable
fun CourtLiveCard(
    court: CourtEntity,
    match: MatchEntity?,
    allPlayers: List<PlayerEntity>,
    gamesCountMap: Map<Int, Int> = emptyMap(),
    joins: List<SessionPlayerJoinEntity> = emptyList(),
    onEnterScore: (MatchEntity) -> Unit,
    onGenerateMatch: () -> Unit,
    onPlayerClick: (MatchEntity, PlayerEntity) -> Unit = { _, _ -> },
    onDeleteMatch: (MatchEntity) -> Unit = {}
) {
    fun getPlayerDisplayString(player: PlayerEntity): AnnotatedString {
        val totalCount = gamesCountMap[player.id] ?: 0
        val adj = joins.find { it.playerId == player.id }?.adjustedGames ?: 0
        val actual = totalCount - adj
        val gamesText = if (adj > 0) "($actual ($adj))" else "($actual)"
        return buildAnnotatedString {
            append(player.name.uppercase())
            append(" ")
            withStyle(SpanStyle(fontSize = 11.sp, fontWeight = FontWeight.Normal)) {
                append(gamesText)
            }
        }
    }
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("court_card_${court.id}"),
        colors = CardDefaults.cardColors(
            containerColor = if (match != null) MaterialTheme.colorScheme.surface
            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
        ),
        shape = RoundedCornerShape(28.dp),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (match != null) MaterialTheme.colorScheme.outlineVariant
            else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Grid4x4, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(court.name.uppercase(), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }

                if (match != null) {
                    AssistChip(
                        onClick = {},
                        label = { Text("Match #${match.matchNumber}") },
                        colors = AssistChipDefaults.assistChipColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                    )
                } else {
                    Badge(containerColor = MaterialTheme.colorScheme.error) {
                        Text("IDLE", modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), color = Color.White)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (match != null) {
                val player1A = allPlayers.find { it.id == match.teamAPlayer1Id }
                val player2A = match.teamAPlayer2Id?.let { allPlayers.find { p -> p.id == it } }

                val player1B = allPlayers.find { it.id == match.teamBPlayer1Id }
                val player2B = match.teamBPlayer2Id?.let { allPlayers.find { p -> p.id == it } }

                val timeString = remember(match.startTime) {
                    val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
                    sdf.format(Date(match.startTime))
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
                        .padding(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Team A", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                            player1A?.let { player ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .clickable { onPlayerClick(match, player) }
                                        .padding(vertical = 2.dp)
                                ) {
                                    Text(getPlayerDisplayString(player), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Icon(Icons.Default.Edit, contentDescription = "Substitute", modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f))
                                }
                            }
                            player2A?.let { player ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .clickable { onPlayerClick(match, player) }
                                        .padding(vertical = 2.dp)
                                ) {
                                    Text(getPlayerDisplayString(player), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Icon(Icons.Default.Edit, contentDescription = "Substitute", modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f))
                                }
                            }
                        }

                        Text("VS", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.outline)

                        Column(horizontalAlignment = Alignment.End) {
                            Text("Team B", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
                            player1B?.let { player ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .clickable { onPlayerClick(match, player) }
                                        .padding(vertical = 2.dp)
                                ) {
                                    Icon(Icons.Default.Edit, contentDescription = "Substitute", modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.secondary.copy(alpha = 0.6f))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(getPlayerDisplayString(player), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                            player2B?.let { player ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .clickable { onPlayerClick(match, player) }
                                        .padding(vertical = 2.dp)
                                ) {
                                    Icon(Icons.Default.Edit, contentDescription = "Substitute", modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.secondary.copy(alpha = 0.6f))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(getPlayerDisplayString(player), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
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
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.AccessTime, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.outline)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Started: $timeString", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            IconButton(
                                onClick = { onDeleteMatch(match) },
                                modifier = Modifier
                                    .size(36.dp)
                                    .testTag("delete_game_button_${match.id}")
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Delete,
                                    contentDescription = "Delete Game",
                                    tint = MaterialTheme.colorScheme.error
                                )
                            }

                            Button(
                                onClick = { onEnterScore(match) },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                modifier = Modifier.height(36.dp).testTag("record_score_button_${match.id}")
                            ) {
                                Text("Score", fontSize = 12.sp)
                            }
                        }
                    }
                }
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(100.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No match currently active", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedButton(
                            onClick = onGenerateMatch,
                            modifier = Modifier.testTag("force_schedule_button_${court.id}")
                        ) {
                            Icon(Icons.Default.Autorenew, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Generate Match")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PlayersRotationListsSection(
    playing: List<PlayerEntity>,
    waiting: List<PlayerEntity>,
    paused: List<PlayerEntity>,
    gamesCountMap: Map<Int, Int>,
    joins: List<SessionPlayerJoinEntity> = emptyList(),
    onTogglePause: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    var activeSubTab by remember { mutableStateOf("WAITING") } // "WAITING", "PLAYING", "PAUSED"

    Column(modifier = modifier.fillMaxWidth()) {
        TabRow(selectedTabIndex = when(activeSubTab) {
            "WAITING" -> 0
            "PLAYING" -> 1
            else -> 2
        }) {
            Tab(
                selected = activeSubTab == "WAITING",
                onClick = { activeSubTab = "WAITING" },
                text = { Text("Waiting (${waiting.size})", fontSize = 12.sp) }
            )
            Tab(
                selected = activeSubTab == "PLAYING",
                onClick = { activeSubTab = "PLAYING" },
                text = { Text("Playing (${playing.size})", fontSize = 12.sp) }
            )
            Tab(
                selected = activeSubTab == "PAUSED",
                onClick = { activeSubTab = "PAUSED" },
                text = { Text("Paused (${paused.size})", fontSize = 12.sp) }
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        Box(modifier = Modifier.weight(1f)) {
            val listToDisplay = when(activeSubTab) {
                "WAITING" -> waiting
                "PLAYING" -> playing
                else -> paused
            }

            if (listToDisplay.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = when(activeSubTab) {
                            "WAITING" -> "No players are currently waiting."
                            "PLAYING" -> "No active games."
                            else -> "No players on break/pause."
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(listToDisplay) { player ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(20.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f))
                                .border(
                                    width = 1.dp,
                                    color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f),
                                    shape = RoundedCornerShape(20.dp)
                                )
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = if (player.gender == "MALE") Icons.Default.Male else Icons.Default.Female,
                                    contentDescription = player.gender,
                                    tint = if (player.gender == "MALE") Color(0xFF38BDF8) else Color(0xFFF472B6),
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Column {
                                    Text(player.name.uppercase(), fontWeight = FontWeight.Bold)
                                    val totalCount = gamesCountMap[player.id] ?: 0
                                    val adj = joins.find { it.playerId == player.id }?.adjustedGames ?: 0
                                    val actual = totalCount - adj
                                    val gamesText = if (adj > 0) "$actual ($adj)" else "$actual"
                                    Text("Games played: $gamesText", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                                }
                            }

                            if (activeSubTab != "PLAYING") {
                                IconButton(onClick = { onTogglePause(player.id) }) {
                                    Icon(
                                        imageVector = if (activeSubTab == "PAUSED") Icons.Default.PlayArrow else Icons.Default.Pause,
                                        contentDescription = "Toggle Pause",
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            } else {
                                Badge(containerColor = MaterialTheme.colorScheme.primary) {
                                    Text("Active", color = Color.White, modifier = Modifier.padding(horizontal = 4.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
