package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.viewmodel.BadmintonViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    viewModel: BadmintonViewModel,
    modifier: Modifier = Modifier
) {
    var selectedTab by remember { mutableStateOf("LIVE") } // "LIVE", "SETUP", "STATS", "HISTORY"
    val activeSession by viewModel.activeSession.collectAsState()
    val clubDetails by viewModel.clubDetails.collectAsState()

    // If activeSession is null, force select SETUP/Onboarding tab to guide users to create a session first!
    // Otherwise, when a session is launched (becomes active), move to the Live menu.
    LaunchedEffect(activeSession) {
        if (activeSession == null) {
            selectedTab = "SETUP"
        } else {
            selectedTab = "LIVE"
        }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.SportsTennis,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(28.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = clubDetails?.name ?: "Badminton Club",
                            fontWeight = FontWeight.Black,
                            letterSpacing = 0.5.sp,
                            fontSize = 20.sp
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                ),
                actions = {
                    // Quick active session indicator
                    activeSession?.let { session ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(end = 12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (session.startTime != null) Color(0xFF10B981) else Color(0xFFF59E0B)
                                    )
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (session.startTime != null) "Active" else "Setup",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Bold,
                                color = if (session.startTime != null) Color(0xFF10B981) else Color(0xFFF59E0B)
                            )
                        }
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar(
                modifier = Modifier.windowInsetsPadding(WindowInsets.navigationBars)
            ) {
                NavigationBarItem(
                    selected = selectedTab == "SETUP",
                    onClick = { selectedTab = "SETUP" },
                    icon = { Icon(Icons.Default.Tune, contentDescription = "Club") },
                    label = { Text("Club") },
                    modifier = Modifier.testTag("nav_setup")
                )

                NavigationBarItem(
                    selected = selectedTab == "CLUB",
                    onClick = { selectedTab = "CLUB" },
                    icon = { Icon(Icons.Default.Group, contentDescription = "Sessions") },
                    label = { Text("Sessions") },
                    modifier = Modifier.testTag("nav_club")
                )

                NavigationBarItem(
                    selected = selectedTab == "LIVE",
                    onClick = { selectedTab = "LIVE" },
                    enabled = activeSession != null,
                    icon = { Icon(Icons.Default.PlayCircleOutline, contentDescription = "Live Session") },
                    label = { Text("Live") },
                    modifier = Modifier.testTag("nav_live")
                )

                NavigationBarItem(
                    selected = selectedTab == "HISTORY",
                    onClick = { selectedTab = "HISTORY" },
                    icon = { Icon(Icons.Default.History, contentDescription = "History") },
                    label = { Text("History") },
                    modifier = Modifier.testTag("nav_history")
                )


            }
        }
    ) { innerPadding ->
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            color = MaterialTheme.colorScheme.background
        ) {
            when (selectedTab) {
                "SETUP" -> SetupScreen(viewModel = viewModel)
                "CLUB" -> ClubManagementScreen(viewModel = viewModel)
                "LIVE" -> SessionScreen(viewModel = viewModel)
                "HISTORY" -> HistoryScreen(viewModel = viewModel)
                "FEEDBACK" -> FeedbackScreen(viewModel = viewModel)
            }
        }
    }
}
