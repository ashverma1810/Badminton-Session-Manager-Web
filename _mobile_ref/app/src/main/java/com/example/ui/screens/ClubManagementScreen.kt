package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.input.PasswordVisualTransformation
import com.example.data.database.*
import com.example.ui.viewmodel.BadmintonViewModel
import com.google.firebase.auth.FirebaseUser
import kotlinx.coroutines.flow.flowOf

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun ClubManagementScreen(
    viewModel: BadmintonViewModel,
    modifier: Modifier = Modifier
) {
    var activeSubTab by remember { mutableStateOf("WEEKLY") } // "MEMBERS", "WEEKLY", "ADHOC", "MANAGERS"
    val allPlayers by viewModel.allPlayers.collectAsState()
    val allWeeklySessions by viewModel.allWeeklySessions.collectAsState()
    val allWeeklySessionMembers by viewModel.allWeeklySessionMembers.collectAsState()
    val allSessionManagers by viewModel.allSessionManagers.collectAsState()
    val clubDetails by viewModel.clubDetails.collectAsState()
    val activeSession by viewModel.activeSession.collectAsState()
    val currentUser by viewModel.currentFirebaseUser.collectAsState()

    val userEmail = currentUser?.email
    val isSessionManager = userEmail != null && allSessionManagers.any { it.email.equals(userEmail, ignoreCase = true) }
    val isClubManager = !isSessionManager

    LaunchedEffect(isClubManager) {
        if (!isClubManager && activeSubTab == "MANAGERS") {
            activeSubTab = "WEEKLY"
        }
    }

    val clubThemeColor = try {
        Color(android.graphics.Color.parseColor(clubDetails?.themeColorHex ?: "#0284C7"))
    } catch (e: Exception) {
        MaterialTheme.colorScheme.primary
    }

    val availableTabs = remember(isClubManager) {
        if (isClubManager) {
            listOf(
                "MEMBERS" to Pair("Members", Icons.Default.Group),
                "WEEKLY" to Pair("Weekly", Icons.Default.CalendarMonth),
                "ADHOC" to Pair("Adhoc", Icons.Default.FlashOn),
                "MANAGERS" to Pair("Managers", Icons.Default.SupervisorAccount)
            )
        } else {
            listOf(
                "MEMBERS" to Pair("Members", Icons.Default.Group),
                "WEEKLY" to Pair("Weekly", Icons.Default.CalendarMonth),
                "ADHOC" to Pair("Adhoc", Icons.Default.FlashOn)
            )
        }
    }

    val selectedTabIndex = availableTabs.indexOfFirst { it.first == activeSubTab }.coerceAtLeast(0)

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Top
    ) {
        // Tab Switcher - Responsive Layout with adjusted labels
        TabRow(
            selectedTabIndex = selectedTabIndex,
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
        ) {
            availableTabs.forEach { (tabKey, tabInfo) ->
                Tab(
                    selected = activeSubTab == tabKey,
                    onClick = { activeSubTab = tabKey },
                    text = { Text(tabInfo.first, fontWeight = FontWeight.Bold, fontSize = 10.sp) },
                    icon = { Icon(tabInfo.second, contentDescription = null, modifier = Modifier.size(16.dp)) }
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        when (activeSubTab) {
            "MEMBERS" -> MemberDirectoryTab(
                players = allPlayers,
                clubThemeColor = clubThemeColor,
                weeklySessions = allWeeklySessions,
                weeklySessionMembers = allWeeklySessionMembers,
                onAddPlayer = { name, gender, isPAYG ->
                    viewModel.addPlayerToMaster(name, gender, isPAYG)
                },
                onDeletePlayer = { viewModel.deletePlayerFromMaster(it) }
            )
            "WEEKLY" -> WeeklySessionsTab(
                weeklySessions = allWeeklySessions,
                players = allPlayers,
                clubThemeColor = clubThemeColor,
                viewModel = viewModel
            )
            "ADHOC" -> AdhocSessionsTab(
                activeSession = activeSession,
                clubThemeColor = clubThemeColor,
                viewModel = viewModel
            )
            "MANAGERS" -> SessionManagersTab(
                viewModel = viewModel,
                clubThemeColor = clubThemeColor,
                clubDetails = clubDetails,
                allSessionManagers = allSessionManagers
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MemberDirectoryTab(
    players: List<PlayerEntity>,
    clubThemeColor: Color,
    weeklySessions: List<WeeklySessionEntity>,
    weeklySessionMembers: List<WeeklySessionMemberEntity>,
    onAddPlayer: (String, String, Boolean) -> Unit,
    onDeletePlayer: (Int) -> Unit
) {
    var showAddDialog by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var playerToDelete by remember { mutableStateOf<PlayerEntity?>(null) }

    val filteredPlayers = players.filter {
        it.name.contains(searchQuery, ignoreCase = true)
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Club Members (${players.size})",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Button(
                onClick = { showAddDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = clubThemeColor),
                modifier = Modifier.testTag("club_add_member_button")
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Member")
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search members...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            modifier = Modifier
                .fillMaxWidth()
                .testTag("member_search_input"),
            singleLine = true,
            shape = RoundedCornerShape(12.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        if (filteredPlayers.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(48.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (searchQuery.isEmpty()) "No members added yet.\nClick Add Member to start!" else "No matches found.",
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(filteredPlayers) { player ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.15f)),
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(CircleShape)
                                        .background(if (player.gender == "MALE") Color(0xFF3B82F6).copy(alpha = 0.15f) else Color(0xFFEC4899).copy(alpha = 0.15f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = if (player.gender == "MALE") Icons.Default.Male else Icons.Default.Female,
                                        contentDescription = player.gender,
                                        tint = if (player.gender == "MALE") Color(0xFF3B82F6) else Color(0xFFEC4899),
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = player.name.uppercase(),
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        // PAYG vs Permanent Status Badge
                                        Surface(
                                            color = if (player.isPAYG) Color(0xFFF59E0B).copy(alpha = 0.12f) else clubThemeColor.copy(alpha = 0.12f),
                                            contentColor = if (player.isPAYG) Color(0xFFD97706) else clubThemeColor,
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = if (player.isPAYG) "PAYG" else "Permanent",
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Black,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }

                                    // Display sessions the player plays in
                                    val playerSessions = weeklySessionMembers
                                        .filter { it.memberId == player.id }
                                        .mapNotNull { join -> weeklySessions.find { it.id == join.weeklySessionId } }

                                    if (!player.isPAYG && playerSessions.isNotEmpty()) {
                                        Spacer(modifier = Modifier.height(4.dp))
                                        FlowRow(
                                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                                            verticalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            playerSessions.forEach { session ->
                                                Surface(
                                                    color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.4f),
                                                    contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                                                    shape = RoundedCornerShape(4.dp)
                                                ) {
                                                    Text(
                                                        text = session.name,
                                                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 10.sp),
                                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            IconButton(onClick = { playerToDelete = player }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete member", tint = MaterialTheme.colorScheme.error.copy(alpha = 0.8f))
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        var name by remember { mutableStateOf("") }
        var gender by remember { mutableStateOf("MALE") }
        var isPAYG by remember { mutableStateOf(false) }

        val isDuplicate = name.isNotBlank() && players.any { it.name.trim().equals(name.trim(), ignoreCase = true) }

        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("Add Club Member") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column {
                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it },
                            label = { Text("Name") },
                            placeholder = { Text("e.g. Ashish Verma") },
                            isError = isDuplicate,
                            modifier = Modifier.fillMaxWidth().testTag("add_member_name_input"),
                            singleLine = true
                        )
                        if (isDuplicate) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "A member with this name already exists.",
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }

                    Column {
                        Text("Gender", style = MaterialTheme.typography.titleSmall)
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { gender = "MALE" }) {
                                RadioButton(selected = gender == "MALE", onClick = { gender = "MALE" })
                                Text("Male")
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { gender = "FEMALE" }) {
                                RadioButton(selected = gender == "FEMALE", onClick = { gender = "FEMALE" })
                                Text("Female")
                            }
                        }
                    }

                    Column {
                        Text("Member Status", style = MaterialTheme.typography.titleSmall)
                        Spacer(modifier = Modifier.height(8.dp))
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { isPAYG = false }) {
                                RadioButton(selected = !isPAYG, onClick = { isPAYG = false })
                                Text("Permanent / Club Member")
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { isPAYG = true }) {
                                RadioButton(selected = isPAYG, onClick = { isPAYG = true })
                                Text("PAYG (Pay-As-You-Go)")
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (name.isNotBlank() && !isDuplicate) {
                            onAddPlayer(name, gender, isPAYG)
                            showAddDialog = false
                        }
                    },
                    enabled = name.isNotBlank() && !isDuplicate,
                    modifier = Modifier.testTag("confirm_add_member_btn")
                ) {
                    Text("Add")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    if (playerToDelete != null) {
        val player = playerToDelete!!
        AlertDialog(
            onDismissRequest = { playerToDelete = null },
            title = { Text("Delete Club Member") },
            text = {
                Text("Are you sure you want to delete \"${player.name}\" from the club directory? This action cannot be undone.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        onDeletePlayer(player.id)
                        playerToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { playerToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WeeklySessionsTab(
    weeklySessions: List<WeeklySessionEntity>,
    players: List<PlayerEntity>,
    clubThemeColor: Color,
    viewModel: BadmintonViewModel
) {
    var showAddDialog by remember { mutableStateOf(false) }
    var selectedSessionId by remember { mutableStateOf<Int?>(null) }
    var weeklySessionToDelete by remember { mutableStateOf<WeeklySessionEntity?>(null) }

    val currentMembersFlow = remember(selectedSessionId) {
        selectedSessionId?.let { viewModel.getWeeklySessionMembers(it) } ?: flowOf(emptyList())
    }
    val currentMembers by currentMembersFlow.collectAsState(initial = emptyList())

    val currentCourtsFlow = remember(selectedSessionId) {
        selectedSessionId?.let { viewModel.getWeeklySessionCourts(it) } ?: flowOf(emptyList())
    }
    val currentCourts by currentCourtsFlow.collectAsState(initial = emptyList())

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Weekly sessions",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Button(
                onClick = { showAddDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = clubThemeColor),
                modifier = Modifier.testTag("add_weekly_session_button")
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text("New Weekly")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (weeklySessions.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(48.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No weekly sessions configured.\nOrganisers can set up weekly schedules that automatically repeat!",
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(weeklySessions) { session ->
                    val isExpanded = selectedSessionId == session.id
                    val manager1Name = session.managerName ?: players.find { it.id == session.managerId }?.name
                    val manager2Name = session.manager2Name ?: players.find { it.id == session.manager2Id }?.name
                    val managersList = listOfNotNull(manager1Name, manager2Name).filter { it.isNotBlank() }

                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedSessionId = if (isExpanded) null else session.id },
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (isExpanded) clubThemeColor.copy(alpha = 0.05f)
                            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.15f)
                        ),
                        border = androidx.compose.foundation.BorderStroke(
                            width = 1.dp,
                            color = if (isExpanded) clubThemeColor.copy(alpha = 0.5f)
                            else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
                        )
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            // Header Row
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = session.name,
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isExpanded) clubThemeColor else MaterialTheme.colorScheme.onSurface
                                    )
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Text(
                                            text = "${session.dayOfWeek} at ${session.time}",
                                            style = MaterialTheme.typography.bodySmall,
                                            fontWeight = FontWeight.SemiBold,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        Text(
                                            text = "•",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        Text(
                                            text = session.type,
                                            style = MaterialTheme.typography.bodySmall,
                                            fontWeight = FontWeight.Bold,
                                            color = clubThemeColor
                                        )
                                    }
                                    if (managersList.isNotEmpty()) {
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.SupervisorAccount,
                                                contentDescription = "Session Manager",
                                                tint = MaterialTheme.colorScheme.primary,
                                                modifier = Modifier.size(14.dp)
                                            )
                                            Text(
                                                text = if (managersList.size > 1) "Managers: ${managersList.joinToString(", ")}" else "Manager: ${managersList.first()}",
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Medium,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }
                                }

                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }

                            if (isExpanded) {
                                Spacer(modifier = Modifier.height(16.dp))
                                Divider(color = clubThemeColor.copy(alpha = 0.2f))
                                Spacer(modifier = Modifier.height(12.dp))

                                // OPTION A: Launch Concrete Session
                                Button(
                                    onClick = {
                                        viewModel.instantiateWeeklySession(session.id) {
                                            // Instantiate concrete week's session and trigger liveness
                                             // Let user start it from the setup screen
                                        }
                                    },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(48.dp)
                                        .testTag("launch_weekly_session_btn"),
                                    colors = ButtonDefaults.buttonColors(containerColor = clubThemeColor),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Icon(Icons.Default.RocketLaunch, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Start Session", fontWeight = FontWeight.Bold)
                                }

                                Spacer(modifier = Modifier.height(16.dp))

                                // Manage Default Courts
                                Text(
                                    text = "Session Courts (${currentCourts.size})",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(6.dp))

                                FlowRow(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    currentCourts.forEach { court ->
                                        AssistChip(
                                            onClick = { },
                                            label = { Text(court.name + " (${court.gameType})") },
                                            trailingIcon = {
                                                Icon(
                                                    Icons.Default.Close,
                                                    contentDescription = "Remove court",
                                                    modifier = Modifier
                                                        .size(16.dp)
                                                        .clickable { viewModel.deleteCourtFromWeeklySession(court.id) }
                                                )
                                            }
                                        )
                                    }

                                    // Add court helper chip
                                    var showCourtInput by remember { mutableStateOf(false) }
                                    if (showCourtInput) {
                                        var newCourtName by remember { mutableStateOf("") }
                                        var newCourtType by remember { mutableStateOf("DOUBLES") }
                                        val isCourtDuplicate = newCourtName.isNotBlank() && currentCourts.any { it.name.trim().equals(newCourtName.trim(), ignoreCase = true) }

                                        AlertDialog(
                                            onDismissRequest = { showCourtInput = false },
                                            title = { Text("Add Session Court") },
                                            text = {
                                                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                                    Column {
                                                        OutlinedTextField(
                                                            value = newCourtName,
                                                            onValueChange = { newCourtName = it },
                                                            label = { Text("Court Name") },
                                                            placeholder = { Text("e.g. Court 3") },
                                                            isError = isCourtDuplicate,
                                                            singleLine = true,
                                                            modifier = Modifier.fillMaxWidth()
                                                        )
                                                        if (isCourtDuplicate) {
                                                            Spacer(modifier = Modifier.height(4.dp))
                                                            Text(
                                                                text = "A court with this name already exists.",
                                                                color = MaterialTheme.colorScheme.error,
                                                                style = MaterialTheme.typography.bodySmall
                                                            )
                                                        }
                                                    }
                                                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                                        listOf("SINGLES", "DOUBLES", "MIXED_DOUBLES").forEach { g ->
                                                            FilterChip(
                                                                selected = newCourtType == g,
                                                                onClick = { newCourtType = g },
                                                                label = { Text(g) }
                                                            )
                                                        }
                                                    }
                                                }
                                            },
                                            confirmButton = {
                                                TextButton(
                                                    onClick = {
                                                        if (newCourtName.isNotBlank() && !isCourtDuplicate) {
                                                            viewModel.addCourtToWeeklySession(session.id, newCourtName, newCourtType)
                                                            showCourtInput = false
                                                        }
                                                    },
                                                    enabled = newCourtName.isNotBlank() && !isCourtDuplicate
                                                ) {
                                                    Text("Add")
                                                }
                                            },
                                            dismissButton = {
                                                TextButton(onClick = { showCourtInput = false }) {
                                                    Text("Cancel")
                                                }
                                            }
                                        )
                                    }

                                    IconButton(
                                        onClick = { showCourtInput = true },
                                        modifier = Modifier.size(32.dp).background(clubThemeColor.copy(alpha = 0.15f), CircleShape)
                                    ) {
                                        Icon(Icons.Default.Add, contentDescription = "Add court", tint = clubThemeColor, modifier = Modifier.size(18.dp))
                                    }
                                }

                                Spacer(modifier = Modifier.height(16.dp))

                                // Manage Permanent Members
                                Text(
                                    text = "Permanent Members (${currentMembers.size})",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(8.dp))

                                val joinedMemberIds = currentMembers.map { it.memberId }.toSet()
                                var showAddMemberPopup by remember { mutableStateOf(false) }

                                FlowRow(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    currentMembers.forEach { member ->
                                        val player = players.find { it.id == member.memberId }
                                        if (player != null) {
                                             AssistChip(
                                                 onClick = {
                                                     if (player.isPAYG) {
                                                         viewModel.convertPAYGToPermanent(player.id)
                                                     }
                                                 },
                                                 label = {
                                                     Row(
                                                         verticalAlignment = Alignment.CenterVertically,
                                                         horizontalArrangement = Arrangement.spacedBy(4.dp)
                                                     ) {
                                                         Text(player.name)
                                                         if (player.isPAYG) {
                                                             Text(
                                                                 text = "PAYG ➔ Permanent",
                                                                 style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp),
                                                                 color = Color(0xFFD97706),
                                                                 fontWeight = FontWeight.Bold,
                                                                 modifier = Modifier
                                                                     .background(Color(0xFFF59E0B).copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                                                     .padding(horizontal = 4.dp, vertical = 1.dp)
                                                             )
                                                         }
                                                     }
                                                 },
                                                 trailingIcon = {
                                                     Icon(
                                                         Icons.Default.Close,
                                                         contentDescription = "Remove member",
                                                         modifier = Modifier
                                                             .size(16.dp)
                                                             .clickable { viewModel.removeMemberFromWeeklySession(session.id, player.id) }
                                                     )
                                                 }
                                             )
                                        }
                                    }

                                    IconButton(
                                         onClick = { showAddMemberPopup = true },
                                         modifier = Modifier.size(32.dp).background(clubThemeColor.copy(alpha = 0.15f), CircleShape)
                                    ) {
                                         Icon(Icons.Default.Add, contentDescription = "Add member", tint = clubThemeColor, modifier = Modifier.size(18.dp))
                                    }
                                }

                                if (showAddMemberPopup) {
                                     var newMemberQuery by remember { mutableStateOf("") }
                                     var newMemberGender by remember { mutableStateOf("MALE") }
                                     val matchingPlayers = if (newMemberQuery.isBlank()) emptyList() else players.filter {
                                         it.name.contains(newMemberQuery, ignoreCase = true) && !joinedMemberIds.contains(it.id)
                                     }
                                     val isDuplicateInSession = newMemberQuery.isNotBlank() && currentMembers.any { m ->
                                         players.find { it.id == m.memberId }?.name?.trim()?.equals(newMemberQuery.trim(), ignoreCase = true) == true
                                     }
                                     val playerExistsInMaster = newMemberQuery.isNotBlank() && players.any {
                                         it.name.trim().equals(newMemberQuery.trim(), ignoreCase = true)
                                     }

                                     AlertDialog(
                                         onDismissRequest = { showAddMemberPopup = false },
                                         title = { Text("Add Permanent Member") },
                                         text = {
                                             Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                                 OutlinedTextField(
                                                     value = newMemberQuery,
                                                     onValueChange = { newMemberQuery = it },
                                                     label = { Text("Member Name") },
                                                     placeholder = { Text("e.g. Ashish Verma") },
                                                     singleLine = true,
                                                     modifier = Modifier.fillMaxWidth()
                                                 )

                                                 if (newMemberQuery.isNotBlank()) {
                                                     if (isDuplicateInSession) {
                                                         Text(
                                                             text = "This player is already a permanent member of this session.",
                                                             color = MaterialTheme.colorScheme.error,
                                                             style = MaterialTheme.typography.bodySmall
                                                         )
                                                     } else if (matchingPlayers.isNotEmpty()) {
                                                         Text(
                                                             text = "Matching registered players:",
                                                             style = MaterialTheme.typography.titleSmall,
                                                             fontWeight = FontWeight.Bold
                                                         )
                                                         Box(
                                                             modifier = Modifier
                                                                 .fillMaxWidth()
                                                                 .heightIn(max = 150.dp)
                                                                 .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                                                                 .padding(4.dp)
                                                         ) {
                                                             LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                                                 items(matchingPlayers) { player ->
                                                                     Row(
                                                                         modifier = Modifier
                                                                             .fillMaxWidth()
                                                                             .clickable {
                                                                                 if (player.isPAYG) {
                                                                                     viewModel.convertPAYGToPermanent(player.id)
                                                                                 }
                                                                                 viewModel.addMemberToWeeklySession(session.id, player.id)
                                                                                 showAddMemberPopup = false
                                                                             }
                                                                             .padding(6.dp),
                                                                         verticalAlignment = Alignment.CenterVertically,
                                                                         horizontalArrangement = Arrangement.SpaceBetween
                                                                     ) {
                                                                         Column {
                                                                             Text(player.name, fontWeight = FontWeight.SemiBold)
                                                                             if (player.isPAYG) {
                                                                                 Text(
                                                                                     text = "PAYG Member",
                                                                                     style = MaterialTheme.typography.bodySmall,
                                                                                     color = Color(0xFFD97706)
                                                                                 )
                                                                             }
                                                                         }
                                                                         if (player.isPAYG) {
                                                                             TextButton(
                                                                                 onClick = {
                                                                                     viewModel.convertPAYGToPermanent(player.id)
                                                                                     viewModel.addMemberToWeeklySession(session.id, player.id)
                                                                                     showAddMemberPopup = false
                                                                                 }
                                                                             ) {
                                                                                 Text("Make Permanent & Add")
                                                                             }
                                                                         } else {
                                                                             IconButton(
                                                                                 onClick = {
                                                                                     viewModel.addMemberToWeeklySession(session.id, player.id)
                                                                                     showAddMemberPopup = false
                                                                                 }
                                                                             ) {
                                                                                 Icon(Icons.Default.Add, contentDescription = "Add")
                                                                             }
                                                                         }
                                                                     }
                                                                 }
                                                             }
                                                         }
                                                     } else if (!playerExistsInMaster) {
                                                         // Player does not exist as a member -> show "Add member" screen/controls
                                                         Divider()
                                                         Text(
                                                             text = "New Member Details",
                                                             style = MaterialTheme.typography.titleSmall,
                                                             fontWeight = FontWeight.Bold,
                                                             color = clubThemeColor
                                                         )
                                                         Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                                             Text("Gender", style = MaterialTheme.typography.titleSmall)
                                                             Row(
                                                                 verticalAlignment = Alignment.CenterVertically,
                                                                 horizontalArrangement = Arrangement.spacedBy(16.dp)
                                                             ) {
                                                                 Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { newMemberGender = "MALE" }) {
                                                                     RadioButton(selected = newMemberGender == "MALE", onClick = { newMemberGender = "MALE" })
                                                                     Text("Male")
                                                                 }
                                                                 Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { newMemberGender = "FEMALE" }) {
                                                                     RadioButton(selected = newMemberGender == "FEMALE", onClick = { newMemberGender = "FEMALE" })
                                                                     Text("Female")
                                                                 }
                                                             }
                                                         }

                                                         Spacer(modifier = Modifier.height(8.dp))

                                                         Button(
                                                             onClick = {
                                                                 viewModel.createAndAddPlayerToWeeklySession(newMemberQuery, newMemberGender, session.id)
                                                                 showAddMemberPopup = false
                                                             },
                                                             modifier = Modifier.fillMaxWidth(),
                                                             colors = ButtonDefaults.buttonColors(containerColor = clubThemeColor)
                                                         ) {
                                                             Text("Create & Add Member")
                                                         }
                                                     }
                                                 }
                                             }
                                         },
                                         confirmButton = {
                                             TextButton(onClick = { showAddMemberPopup = false }) {
                                                 Text("Close")
                                             }
                                         }
                                     )
                                 }

                                 Spacer(modifier = Modifier.height(16.dp))

                                 OutlinedButton(
                                     onClick = { weeklySessionToDelete = session },
                                     modifier = Modifier
                                         .fillMaxWidth()
                                         .testTag("delete_weekly_session_btn_${session.id}"),
                                     colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                                     shape = RoundedCornerShape(12.dp)
                                 ) {
                                     Icon(Icons.Default.Delete, contentDescription = "Delete Session")
                                     Spacer(modifier = Modifier.width(8.dp))
                                     Text("Delete Session", fontWeight = FontWeight.Bold)
                                 }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        val allSessionManagers by viewModel.allSessionManagers.collectAsState()
        val clubDetails by viewModel.clubDetails.collectAsState()
        val clubManagerName = clubDetails?.contactPerson?.ifBlank { "Club Manager" } ?: "Club Manager"

        // Manager option helper
        val managerOptions = remember(allSessionManagers, clubManagerName) {
            val list = mutableListOf<Pair<Int?, String>>()
            list.add(Pair(null, "None"))
            list.add(Pair(0, "$clubManagerName (Club Manager)"))
            allSessionManagers.forEach { mgr ->
                list.add(Pair(mgr.id, mgr.name))
            }
            list
        }

        var name by remember { mutableStateOf("") }
        var dayOfWeek by remember { mutableStateOf("Monday") }
        var time by remember { mutableStateOf("19:00") }
        var type by remember { mutableStateOf("DOUBLES") }
        var selectedManager1 by remember { mutableStateOf<Pair<Int?, String>?>(null) }
        var selectedManager2 by remember { mutableStateOf<Pair<Int?, String>?>(null) }
        var isDropdownExpanded by remember { mutableStateOf(false) }

        val days = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")

        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("New Weekly Session") },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Session Name") },
                        placeholder = { Text("e.g. Thursday Social Night") },
                        modifier = Modifier.fillMaxWidth().testTag("add_weekly_name_input"),
                        singleLine = true
                    )

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(modifier = Modifier.weight(1.2f)) {
                            Text("Day of Week", style = MaterialTheme.typography.titleSmall)
                            Box {
                                OutlinedButton(onClick = { isDropdownExpanded = true }, modifier = Modifier.fillMaxWidth()) {
                                    Text(dayOfWeek)
                                }
                                DropdownMenu(expanded = isDropdownExpanded, onDismissRequest = { isDropdownExpanded = false }) {
                                    days.forEach { d ->
                                        DropdownMenuItem(text = { Text(d) }, onClick = { dayOfWeek = d; isDropdownExpanded = false })
                                    }
                                }
                            }
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text("Start Time", style = MaterialTheme.typography.titleSmall)
                            OutlinedTextField(
                                value = time,
                                onValueChange = { time = it },
                                placeholder = { Text("19:00") },
                                singleLine = true
                            )
                        }
                    }

                    Column {
                        Text("Session Type", style = MaterialTheme.typography.titleSmall)
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf("SINGLES", "DOUBLES", "MIXED_DOUBLES", "MULTI_TYPE").forEach { t ->
                                FilterChip(
                                    selected = type == t,
                                    onClick = { type = t },
                                    label = { Text(t, fontSize = 10.sp) }
                                )
                            }
                        }
                    }

                    // Session Manager 1 Selection
                    Column {
                        Text("Session Manager 1", style = MaterialTheme.typography.titleSmall)
                        Spacer(modifier = Modifier.height(4.dp))
                        var showManager1Dropdown by remember { mutableStateOf(false) }
                        val currentManager1Name = selectedManager1?.second ?: "No Manager Selected"

                        Box {
                            OutlinedButton(
                                onClick = { showManager1Dropdown = true },
                                modifier = Modifier.fillMaxWidth().testTag("select_manager1_btn")
                            ) {
                                Icon(Icons.Default.Person, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(currentManager1Name)
                            }
                            DropdownMenu(expanded = showManager1Dropdown, onDismissRequest = { showManager1Dropdown = false }) {
                                managerOptions.forEach { opt ->
                                    DropdownMenuItem(
                                        text = { Text(opt.second) },
                                        onClick = {
                                            selectedManager1 = if (opt.first == null) null else opt
                                            showManager1Dropdown = false
                                        }
                                    )
                                }
                            }
                        }
                    }

                    // Session Manager 2 Selection (Dual manager support)
                    Column {
                        Text("Session Manager 2 (Optional)", style = MaterialTheme.typography.titleSmall)
                        Spacer(modifier = Modifier.height(4.dp))
                        var showManager2Dropdown by remember { mutableStateOf(false) }
                        val currentManager2Name = selectedManager2?.second ?: "None (Optional)"

                        Box {
                            OutlinedButton(
                                onClick = { showManager2Dropdown = true },
                                modifier = Modifier.fillMaxWidth().testTag("select_manager2_btn")
                            ) {
                                Icon(Icons.Default.PersonOutline, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(currentManager2Name)
                            }
                            DropdownMenu(expanded = showManager2Dropdown, onDismissRequest = { showManager2Dropdown = false }) {
                                managerOptions.forEach { opt ->
                                    DropdownMenuItem(
                                        text = { Text(opt.second) },
                                        onClick = {
                                            selectedManager2 = if (opt.first == null) null else opt
                                            showManager2Dropdown = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (name.isNotBlank()) {
                            val mgr1Id = selectedManager1?.first
                            val mgr1Name = selectedManager1?.let { if (it.first == 0) clubManagerName else it.second }

                            val mgr2Id = selectedManager2?.first
                            val mgr2Name = selectedManager2?.let { if (it.first == 0) clubManagerName else it.second }

                            viewModel.createWeeklySession(
                                name = name,
                                dayOfWeek = dayOfWeek,
                                time = time,
                                type = type,
                                managerId = mgr1Id,
                                managerName = mgr1Name,
                                manager2Id = mgr2Id,
                                manager2Name = mgr2Name
                            )
                            showAddDialog = false
                        }
                    },
                    modifier = Modifier.testTag("confirm_add_weekly_btn")
                ) {
                    Text("Create")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    if (weeklySessionToDelete != null) {
        val s = weeklySessionToDelete!!
        AlertDialog(
            onDismissRequest = { weeklySessionToDelete = null },
            title = { Text("Delete Weekly Session") },
            text = {
                Text("Are you sure you want to permanently delete the weekly session \"${s.name}\"? This action cannot be undone.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteWeeklySession(s.id)
                        weeklySessionToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { weeklySessionToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun AdhocSessionsTab(
    activeSession: SessionEntity?,
    clubThemeColor: Color,
    viewModel: BadmintonViewModel
) {
    val clubDetails by viewModel.clubDetails.collectAsState()
    val allSessionManagers by viewModel.allSessionManagers.collectAsState()
    val clubManagerName = clubDetails?.contactPerson?.ifBlank { "Club Manager" } ?: "Club Manager"

    val managerOptions = remember(allSessionManagers, clubManagerName) {
        val list = mutableListOf<Pair<Int?, String>>()
        list.add(Pair(null, "None"))
        list.add(Pair(0, "$clubManagerName (Club Manager)"))
        allSessionManagers.forEach { mgr ->
            list.add(Pair(mgr.id, mgr.name))
        }
        list
    }

    var sessionName by remember { mutableStateOf("Adhoc Social Session") }
    var selectedType by remember { mutableStateOf("DOUBLES") } // "SINGLES", "DOUBLES", "MIXED_DOUBLES", "MULTI_TYPE"
    var sessionTargetScore by remember(clubDetails) { mutableStateOf(clubDetails?.targetScore ?: 21) }
    var selectedManager1 by remember { mutableStateOf<Pair<Int?, String>?>(null) }
    var selectedManager2 by remember { mutableStateOf<Pair<Int?, String>?>(null) }
    var showEndConfirmDialog by remember { mutableStateOf(false) }
    var showDeleteConfirmDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Adhoc Session Management",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )

        if (activeSession != null) {
            // There is already an active session running
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = clubThemeColor.copy(alpha = 0.12f)),
                shape = RoundedCornerShape(20.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, clubThemeColor.copy(alpha = 0.3f))
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.RocketLaunch,
                            contentDescription = "Active Session Running",
                            tint = clubThemeColor,
                            modifier = Modifier.size(28.dp)
                        )
                        Text(
                            text = "Active Session Running",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = clubThemeColor
                        )
                    }

                    Text(
                        text = "Session Name: ${activeSession.name}",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.SemiBold
                    )

                    Text(
                        text = "Game Type: ${when (activeSession.type) {
                            "SINGLES" -> "Singles (2 Players)"
                            "DOUBLES" -> "Doubles (4 Players)"
                            "MIXED_DOUBLES" -> "Mixed Doubles"
                            "MULTI_TYPE" -> "Multi-Game Type"
                            else -> activeSession.type
                        }}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Text(
                        text = "An active session is already in progress. You can configure it, add players, or manage courts in the Club setup tab. Or, play matches under the Live tab.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f)
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { showEndConfirmDialog = true },
                            colors = ButtonDefaults.buttonColors(containerColor = clubThemeColor),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Stop, contentDescription = null)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("End Session")
                        }

                        OutlinedButton(
                            onClick = { showDeleteConfirmDialog = true },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Delete, contentDescription = null)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Delete")
                        }
                    }
                }
            }
        } else {
            // No active session. Show beautiful form to create an adhoc session
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.15f)),
                shape = RoundedCornerShape(20.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Start a New Adhoc Session",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )

                    OutlinedTextField(
                        value = sessionName,
                        onValueChange = { sessionName = it },
                        label = { Text("Session Name") },
                        placeholder = { Text("e.g. Friday Social Session") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("adhoc_session_name_input"),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )

                    Column {
                        Text(
                            text = "Session Type",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        val types = listOf(
                            "SINGLES" to "Singles",
                            "DOUBLES" to "Doubles",
                            "MIXED_DOUBLES" to "Mixed",
                            "MULTI_TYPE" to "Multi-Game"
                        )

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            types.forEach { (typeVal, typeLabel) ->
                                FilterChip(
                                    selected = selectedType == typeVal,
                                    onClick = { selectedType = typeVal },
                                    label = { Text(typeLabel, fontSize = 11.sp, fontWeight = FontWeight.Medium) },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }

                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Target Score",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "Default: ${clubDetails?.targetScore ?: 21} pts",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))

                        val scorePresets = listOf(11, 15, 21, 30)
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            scorePresets.forEach { preset ->
                                FilterChip(
                                    selected = sessionTargetScore == preset,
                                    onClick = { sessionTargetScore = preset },
                                    label = { Text("$preset pts", fontSize = 11.sp, fontWeight = FontWeight.Medium) },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }

                    // Session Managers
                    Column {
                        Text(
                            text = "Session Manager 1",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        var showManager1Dropdown by remember { mutableStateOf(false) }
                        val currentManager1Name = selectedManager1?.second ?: "No Manager Selected"

                        Box {
                            OutlinedButton(
                                onClick = { showManager1Dropdown = true },
                                modifier = Modifier.fillMaxWidth().testTag("adhoc_select_manager1_btn")
                            ) {
                                Icon(Icons.Default.Person, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(currentManager1Name)
                            }
                            DropdownMenu(expanded = showManager1Dropdown, onDismissRequest = { showManager1Dropdown = false }) {
                                managerOptions.forEach { opt ->
                                    DropdownMenuItem(
                                        text = { Text(opt.second) },
                                        onClick = {
                                            selectedManager1 = if (opt.first == null) null else opt
                                            showManager1Dropdown = false
                                        }
                                    )
                                }
                            }
                        }
                    }

                    Column {
                        Text(
                            text = "Session Manager 2 (Optional)",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        var showManager2Dropdown by remember { mutableStateOf(false) }
                        val currentManager2Name = selectedManager2?.second ?: "None (Optional)"

                        Box {
                            OutlinedButton(
                                onClick = { showManager2Dropdown = true },
                                modifier = Modifier.fillMaxWidth().testTag("adhoc_select_manager2_btn")
                            ) {
                                Icon(Icons.Default.PersonOutline, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(currentManager2Name)
                            }
                            DropdownMenu(expanded = showManager2Dropdown, onDismissRequest = { showManager2Dropdown = false }) {
                                managerOptions.forEach { opt ->
                                    DropdownMenuItem(
                                        text = { Text(opt.second) },
                                        onClick = {
                                            selectedManager2 = if (opt.first == null) null else opt
                                            showManager2Dropdown = false
                                        }
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    Button(
                        onClick = {
                            if (sessionName.isNotBlank()) {
                                val mgr1Id = selectedManager1?.first
                                val mgr1Name = selectedManager1?.let { if (it.first == 0) clubManagerName else it.second }

                                val mgr2Id = selectedManager2?.first
                                val mgr2Name = selectedManager2?.let { if (it.first == 0) clubManagerName else it.second }

                                viewModel.createSession(
                                    name = sessionName,
                                    type = selectedType,
                                    targetScore = sessionTargetScore,
                                    managerId = mgr1Id,
                                    managerName = mgr1Name,
                                    manager2Id = mgr2Id,
                                    manager2Name = mgr2Name
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = clubThemeColor),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("create_adhoc_session_button"),
                        shape = RoundedCornerShape(12.dp),
                        enabled = sessionName.isNotBlank()
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Create Adhoc Session", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    // End active session confirmation dialog
    if (showEndConfirmDialog && activeSession != null) {
        AlertDialog(
            onDismissRequest = { showEndConfirmDialog = false },
            title = { Text("End Active Session") },
            text = { Text("Are you sure you want to end \"${activeSession.name}\"? This will move the session details to the History tab.") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.stopSession()
                        showEndConfirmDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = clubThemeColor)
                ) {
                    Text("End Session")
                }
            },
            dismissButton = {
                TextButton(onClick = { showEndConfirmDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Delete active session confirmation dialog
    if (showDeleteConfirmDialog && activeSession != null) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmDialog = false },
            title = { Text("Delete Active Session") },
            text = { Text("Are you sure you want to permanently delete \"${activeSession.name}\"? All associated player attendance and courts for this session will be lost. This action cannot be undone.") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteSession(activeSession.id)
                        showDeleteConfirmDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionManagersTab(
    viewModel: BadmintonViewModel,
    clubThemeColor: Color,
    clubDetails: ClubEntity?,
    allSessionManagers: List<SessionManagerEntity>,
    modifier: Modifier = Modifier
) {
    var showAddDialog by remember { mutableStateOf(false) }
    var managerToDelete by remember { mutableStateOf<SessionManagerEntity?>(null) }
    var newManagerName by remember { mutableStateOf("") }
    var newManagerEmail by remember { mutableStateOf("") }
    var sendSetupEmailCheck by remember { mutableStateOf(true) }
    var isSubmitting by remember { mutableStateOf(false) }
    var actionFeedback by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var searchQuery by remember { mutableStateOf("") }

    val filteredManagers = remember(allSessionManagers, searchQuery) {
        if (searchQuery.isBlank()) {
            allSessionManagers
        } else {
            allSessionManagers.filter {
                it.name.contains(searchQuery, ignoreCase = true) ||
                it.email.contains(searchQuery, ignoreCase = true)
            }
        }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Club Details & Profile Summary Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = clubThemeColor.copy(alpha = 0.08f)),
                border = androidx.compose.foundation.BorderStroke(1.dp, clubThemeColor.copy(alpha = 0.25f))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = clubDetails?.name?.ifBlank { "Badminton Club" } ?: "Badminton Club",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = clubThemeColor
                            )
                            Text(
                                text = if (!clubDetails?.venue.isNullOrBlank()) "Venue: ${clubDetails?.venue}" else "Target Score: ${clubDetails?.targetScore ?: 21} points",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Surface(
                            color = clubThemeColor.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = "${clubDetails?.targetScore ?: 21} pts default",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = clubThemeColor,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }

                    if (!clubDetails?.contactPerson.isNullOrBlank()) {
                        Text(
                            text = "Club Organiser: ${clubDetails?.contactPerson}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // Action Feedback Toast / Banner
        actionFeedback?.let { (isSuccess, msg) ->
            item {
                Surface(
                    color = if (isSuccess) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                if (isSuccess) Icons.Default.CheckCircle else Icons.Default.ErrorOutline,
                                contentDescription = null,
                                tint = if (isSuccess) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = msg,
                                style = MaterialTheme.typography.bodySmall,
                                color = if (isSuccess) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onErrorContainer
                            )
                        }
                        IconButton(
                            onClick = { actionFeedback = null },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Dismiss", modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }

        // Section Title & Actions
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Session Managers",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Surface(
                        color = clubThemeColor.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            text = "${allSessionManagers.size}",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = clubThemeColor,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                        )
                    }
                }

                Button(
                    onClick = {
                        newManagerName = ""
                        newManagerEmail = ""
                        sendSetupEmailCheck = true
                        showAddDialog = true
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = clubThemeColor),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    modifier = Modifier.testTag("add_session_manager_btn")
                ) {
                    Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Manager", fontSize = 12.sp)
                }
            }
        }

        // Info Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Info,
                        contentDescription = null,
                        tint = clubThemeColor,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "Session managers can conduct sessions and record match scores. Adding them creates their login profile and sends a password setup email.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Search Bar
        if (allSessionManagers.size > 2) {
            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search managers by name or email...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear search")
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("search_managers_field")
                )
            }
        }

        // Empty state
        if (allSessionManagers.isEmpty()) {
            item {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.SupervisorAccount,
                            contentDescription = null,
                            tint = clubThemeColor.copy(alpha = 0.6f),
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = "No Session Managers Yet",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Add session managers to delegate court scoring and match rotations. They will receive an email to set their password.",
                            style = MaterialTheme.typography.bodySmall,
                            textAlign = TextAlign.Center,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Button(
                            onClick = {
                                newManagerName = ""
                                newManagerEmail = ""
                                sendSetupEmailCheck = true
                                showAddDialog = true
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = clubThemeColor),
                            modifier = Modifier.testTag("empty_add_manager_button")
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Add First Manager")
                        }
                    }
                }
            }
        } else {
            // Manager List
            items(filteredManagers, key = { it.id }) { mgr ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("manager_card_${mgr.id}"),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            Surface(
                                shape = CircleShape,
                                color = clubThemeColor.copy(alpha = 0.15f),
                                modifier = Modifier.size(42.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text = mgr.name.take(1).uppercase(),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 18.sp,
                                        color = clubThemeColor
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.width(12.dp))

                            Column {
                                Text(
                                    text = mgr.name,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = mgr.email,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Surface(
                                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f),
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Text(
                                        text = if (mgr.inviteStatus == "INVITED") "Password Reset Email Sent" else "Manager Account",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.primary,
                                        fontSize = 10.sp,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(
                                onClick = {
                                    actionFeedback = Pair(true, "Sending password reset email to ${mgr.email}...")
                                    viewModel.sendPasswordSetupEmailToManager(mgr.email, mgr.name) { success, msg ->
                                        actionFeedback = Pair(
                                            success,
                                            msg ?: if (success) "Password setup link dispatched to ${mgr.email}" else "Failed to send email"
                                        )
                                    }
                                },
                                modifier = Modifier.testTag("resend_reset_email_${mgr.id}")
                            ) {
                                Icon(
                                    Icons.Default.Send,
                                    contentDescription = "Resend Password Reset Email",
                                    tint = clubThemeColor,
                                    modifier = Modifier.size(20.dp)
                                )
                            }

                            IconButton(
                                onClick = { managerToDelete = mgr },
                                modifier = Modifier.testTag("delete_manager_btn_${mgr.id}")
                            ) {
                                Icon(
                                    Icons.Default.DeleteOutline,
                                    contentDescription = "Delete Session Manager",
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }
            }

            // Bulk Actions
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            actionFeedback = Pair(true, "Dispatching password setup emails to all managers...")
                            viewModel.sendPasswordSetupEmailToAllManagers { sent, failed ->
                                actionFeedback = Pair(
                                    true,
                                    "Password setup emails sent to $sent manager(s)" + if (failed > 0) " ($failed could not be reached)" else ""
                                )
                            }
                        },
                        modifier = Modifier
                            .weight(1f)
                            .testTag("send_email_all_managers_btn")
                    ) {
                        Icon(Icons.Default.Email, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Send Reset Link to All", fontSize = 12.sp)
                    }
                }
            }
        }
    }

    // Add Session Manager Dialog
    if (showAddDialog) {
        AlertDialog(
            onDismissRequest = { if (!isSubmitting) showAddDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.PersonAdd, contentDescription = null, tint = clubThemeColor)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Add Session Manager")
                }
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Enter details for the new session manager. They will be added to the system and emailed a password setup link.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    OutlinedTextField(
                        value = newManagerName,
                        onValueChange = { newManagerName = it },
                        label = { Text("Manager Full Name *") },
                        placeholder = { Text("e.g. Sarah Jenkins") },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("new_manager_name_input")
                    )

                    OutlinedTextField(
                        value = newManagerEmail,
                        onValueChange = { newManagerEmail = it },
                        label = { Text("Manager Email Address *") },
                        placeholder = { Text("e.g. sarah.j@badmintonclub.com") },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("new_manager_email_input")
                    )

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { sendSetupEmailCheck = !sendSetupEmailCheck }
                    ) {
                        Checkbox(
                            checked = sendSetupEmailCheck,
                            onCheckedChange = { sendSetupEmailCheck = it }
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Create account & send password setup email",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (newManagerName.isNotBlank() && newManagerEmail.isNotBlank()) {
                            isSubmitting = true
                            viewModel.createSessionManager(
                                name = newManagerName.trim(),
                                email = newManagerEmail.trim(),
                                sendEmail = sendSetupEmailCheck
                            ) { success, msg ->
                                isSubmitting = false
                                showAddDialog = false
                                actionFeedback = Pair(success, msg ?: "Session manager registered successfully")
                            }
                        }
                    },
                    enabled = newManagerName.isNotBlank() && newManagerEmail.isNotBlank() && !isSubmitting,
                    colors = ButtonDefaults.buttonColors(containerColor = clubThemeColor),
                    modifier = Modifier.testTag("confirm_add_manager_button")
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White)
                    } else {
                        Text("Add Manager")
                    }
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showAddDialog = false },
                    enabled = !isSubmitting
                ) {
                    Text("Cancel")
                }
            }
        )
    }

    // Delete Confirmation Dialog
    managerToDelete?.let { mgr ->
        AlertDialog(
            onDismissRequest = { managerToDelete = null },
            title = { Text("Remove Session Manager") },
            text = { Text("Are you sure you want to remove \"${mgr.name}\" (${mgr.email}) from Session Managers?") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteSessionManager(mgr.id)
                        actionFeedback = Pair(true, "Removed ${mgr.name} from session managers")
                        managerToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Remove")
                }
            },
            dismissButton = {
                TextButton(onClick = { managerToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

