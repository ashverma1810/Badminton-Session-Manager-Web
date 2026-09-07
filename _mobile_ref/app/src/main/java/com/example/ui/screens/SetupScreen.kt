package com.example.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.data.database.CourtEntity
import com.example.data.database.CourtMasterEntity
import com.example.data.database.PlayerEntity
import com.example.data.database.SessionEntity
import com.example.data.database.SessionManagerEntity
import com.example.data.database.SessionPlayerJoinEntity
import com.example.ui.viewmodel.BadmintonViewModel

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun SetupScreen(
    viewModel: BadmintonViewModel,
    modifier: Modifier = Modifier
) {
    val activeSession by viewModel.activeSession.collectAsState()
    val allPlayers by viewModel.allPlayers.collectAsState()
    val sessionPlayers by viewModel.activeSessionPlayers.collectAsState()
    val courts by viewModel.activeSessionCourts.collectAsState()
    val allMasterCourts by viewModel.allMasterCourts.collectAsState()
    val allSessionManagers by viewModel.allSessionManagers.collectAsState()
    val clubDetails by viewModel.clubDetails.collectAsState()
    val availableClubsForLogin by viewModel.availableClubsForLogin.collectAsState()

    var showAddPlayerDialog by remember { mutableStateOf(false) }
    var showAddCourtDialog by remember { mutableStateOf(false) }
    var showManageCourtsDialog by remember { mutableStateOf(false) }
    var showCreateSessionDialog by remember { mutableStateOf(false) }
    var showEditClubDialog by remember { mutableStateOf(false) }
    var showSignOutDialog by remember { mutableStateOf(false) }
    var isSigningOutAndSyncing by remember { mutableStateOf(false) }
    var signOutSyncError by remember { mutableStateOf<String?>(null) }

    if (!availableClubsForLogin.isNullOrEmpty()) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissMultiClubSelection() },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.SportsTennis,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "Select Club to Manage",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        "Your account is associated with multiple clubs. Please select which club you would like to open:",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    availableClubsForLogin?.forEach { clubAssoc ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    viewModel.selectClubAndProceed(clubAssoc) { _, _ -> }
                                }
                                .testTag("select_club_${clubAssoc.clubId}"),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
                            ),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
                            )
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = clubAssoc.clubName,
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    if (clubAssoc.venue.isNotBlank()) {
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = "Venue: ${clubAssoc.venue}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Surface(
                                        color = if (clubAssoc.role == "CLUB_MANAGER")
                                            MaterialTheme.colorScheme.primaryContainer
                                        else
                                            MaterialTheme.colorScheme.secondaryContainer,
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text(
                                            text = if (clubAssoc.role == "CLUB_MANAGER") "Club Manager" else "Session Manager",
                                            style = MaterialTheme.typography.labelSmall,
                                            fontWeight = FontWeight.SemiBold,
                                            color = if (clubAssoc.role == "CLUB_MANAGER")
                                                MaterialTheme.colorScheme.onPrimaryContainer
                                            else
                                                MaterialTheme.colorScheme.onSecondaryContainer,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                                Icon(
                                    Icons.Default.ChevronRight,
                                    contentDescription = "Select",
                                    tint = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { viewModel.dismissMultiClubSelection() }) {
                    Text("Cancel")
                }
            }
        )
    }

    if (clubDetails == null) {
        var isRegisteringNewClub by remember { mutableStateOf(false) }

        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Top
        ) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                // Badminton Hero Image at the very top of Club menu page
                Image(
                    painter = painterResource(id = R.drawable.img_badminton_hero),
                    contentDescription = "Badminton sports illustration",
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .testTag("club_hero_image_top"),
                    contentScale = ContentScale.Crop
                )

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Club Management",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(16.dp))
            }

            item {
                if (!isRegisteringNewClub) {
                    // Sign in tile for registered club
                    var signInEmail by remember { mutableStateOf("") }
                    var signInPassword by remember { mutableStateOf("") }
                    var isSigningIn by remember { mutableStateOf(false) }
                    var feedbackMsg by remember { mutableStateOf<Pair<Boolean, String>?>(null) }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)),
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Login, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Sign In",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Text(
                                text = "Enter your registered club email and password to log in and restore cloud settings.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            OutlinedTextField(
                                value = signInEmail,
                                onValueChange = { signInEmail = it },
                                label = { Text("Club Email Address") },
                                placeholder = { Text("club@example.com") },
                                leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                                modifier = Modifier.fillMaxWidth().testTag("auth_email_input"),
                                singleLine = true
                            )

                            OutlinedTextField(
                                value = signInPassword,
                                onValueChange = { signInPassword = it },
                                label = { Text("Password") },
                                placeholder = { Text("••••••••") },
                                visualTransformation = PasswordVisualTransformation(),
                                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                                modifier = Modifier.fillMaxWidth().testTag("auth_password_input"),
                                singleLine = true
                            )

                            Button(
                                onClick = {
                                    if (signInEmail.isBlank() || signInPassword.isBlank()) {
                                        feedbackMsg = Pair(false, "Please enter email and password")
                                        return@Button
                                    }
                                    isSigningIn = true
                                    viewModel.signInWithEmail(signInEmail, signInPassword) { success, errorMsg ->
                                        isSigningIn = false
                                        feedbackMsg = Pair(success, if (success) "Signed in successfully!" else errorMsg ?: "Sign in failed")
                                    }
                                },
                                enabled = !isSigningIn && signInEmail.isNotBlank() && signInPassword.isNotBlank(),
                                modifier = Modifier.fillMaxWidth().height(48.dp).testTag("auth_submit_button")
                            ) {
                                if (isSigningIn) {
                                    CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White)
                                } else {
                                    Icon(Icons.Default.Login, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Sign In to Club Account")
                                }
                            }

                            Box(
                                modifier = Modifier.fillMaxWidth(),
                                contentAlignment = Alignment.CenterEnd
                            ) {
                                TextButton(
                                    onClick = {
                                        if (signInEmail.isBlank()) {
                                            feedbackMsg = Pair(false, "Please enter your email address above first.")
                                        } else {
                                            isSigningIn = true
                                            viewModel.sendPasswordResetEmail(signInEmail) { success, msg ->
                                                isSigningIn = false
                                                feedbackMsg = Pair(success, msg ?: "Reset link dispatched.")
                                            }
                                        }
                                    },
                                    modifier = Modifier.testTag("forgot_password_button")
                                ) {
                                    Text("Forgot Password?", style = MaterialTheme.typography.bodySmall)
                                }
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Don't have registered club?",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                TextButton(
                                    onClick = { isRegisteringNewClub = true },
                                    modifier = Modifier.testTag("register_new_club_link")
                                ) {
                                    Text(
                                        "Register New Club",
                                        style = MaterialTheme.typography.bodySmall,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }

                            feedbackMsg?.let { (isSuccess, msg) ->
                                Surface(
                                    color = if (isSuccess) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.errorContainer,
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        text = msg,
                                        color = if (isSuccess) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onErrorContainer,
                                        style = MaterialTheme.typography.bodySmall,
                                        modifier = Modifier.fillMaxWidth().padding(8.dp),
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }
                    }
                } else {
                    // Register New Club form
                    var name by remember { mutableStateOf("") }
                    var venue by remember { mutableStateOf("") }
                    var defaultSessionType by remember { mutableStateOf("DOUBLES") }
                    var targetScore by remember { mutableStateOf("21") }
                    var selectedColorHex by remember { mutableStateOf("#0284C7") }
                    var contactPerson by remember { mutableStateOf("") }
                    var description by remember { mutableStateOf("") }
                    var email by remember { mutableStateOf("") }
                    var password by remember { mutableStateOf("") }
                    var confirmPassword by remember { mutableStateOf("") }
                    var isRegisteringClub by remember { mutableStateOf(false) }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)),
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.AppRegistration, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Register New Club",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                TextButton(onClick = { isRegisteringNewClub = false }) {
                                    Text("Back to Sign In", style = MaterialTheme.typography.bodySmall)
                                }
                            }

                            OutlinedTextField(
                                value = name,
                                onValueChange = { name = it },
                                label = { Text("Club Name") },
                                placeholder = { Text("e.g. Sunset Badminton Club") },
                                leadingIcon = { Icon(Icons.Default.SportsTennis, contentDescription = null) },
                                modifier = Modifier.fillMaxWidth().testTag("club_name_input"),
                                singleLine = true
                            )

                            OutlinedTextField(
                                value = venue,
                                onValueChange = { venue = it },
                                label = { Text("Venue / Arena") },
                                placeholder = { Text("e.g. Richmond Sports Center") },
                                leadingIcon = { Icon(Icons.Default.LocationOn, contentDescription = null) },
                                modifier = Modifier.fillMaxWidth().testTag("club_venue_input"),
                                singleLine = true
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                OutlinedTextField(
                                    value = targetScore,
                                    onValueChange = { if (it.all { char -> char.isDigit() }) targetScore = it },
                                    label = { Text("Target Score") },
                                    placeholder = { Text("21") },
                                    leadingIcon = { Icon(Icons.Default.Score, contentDescription = null) },
                                    modifier = Modifier.weight(1f).testTag("club_target_score_input"),
                                    singleLine = true
                                )

                                OutlinedTextField(
                                    value = contactPerson,
                                    onValueChange = { contactPerson = it },
                                    label = { Text("Organiser") },
                                    placeholder = { Text("e.g. John Doe") },
                                    leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                                    modifier = Modifier.weight(1.2f).testTag("club_contact_input"),
                                    singleLine = true
                                )
                            }

                            Divider(modifier = Modifier.padding(vertical = 4.dp))

                            Text(
                                text = "Club Account Creation",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )

                            OutlinedTextField(
                                value = email,
                                onValueChange = { email = it },
                                label = { Text("Club Email Address") },
                                placeholder = { Text("club@example.com") },
                                leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                                modifier = Modifier.fillMaxWidth().testTag("club_reg_email_input"),
                                singleLine = true
                            )

                            OutlinedTextField(
                                value = password,
                                onValueChange = { password = it },
                                label = { Text("Password") },
                                placeholder = { Text("••••••••") },
                                visualTransformation = PasswordVisualTransformation(),
                                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                                modifier = Modifier.fillMaxWidth().testTag("club_reg_password_input"),
                                singleLine = true
                            )

                            OutlinedTextField(
                                value = confirmPassword,
                                onValueChange = { confirmPassword = it },
                                label = { Text("Verify Password") },
                                placeholder = { Text("••••••••") },
                                visualTransformation = PasswordVisualTransformation(),
                                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                                isError = confirmPassword.isNotBlank() && confirmPassword != password,
                                supportingText = {
                                    if (confirmPassword.isNotBlank() && confirmPassword != password) {
                                        Text("Passwords do not match", color = MaterialTheme.colorScheme.error)
                                    }
                                },
                                modifier = Modifier.fillMaxWidth().testTag("club_reg_confirm_password_input"),
                                singleLine = true
                            )

                            Button(
                                onClick = {
                                    if (name.isNotBlank()) {
                                        if (password.isNotBlank() && password != confirmPassword) {
                                            return@Button
                                        }
                                        isRegisteringClub = true

                                        // 1. Save Club details
                                        viewModel.saveClubDetails(
                                            name = name,
                                            venue = venue,
                                            defaultSessionType = defaultSessionType,
                                            themeColorHex = selectedColorHex,
                                            targetScore = targetScore.toIntOrNull() ?: 21,
                                            contactPerson = contactPerson,
                                            description = description
                                        )

                                        // 2. Register club account
                                        if (email.isNotBlank() && password.isNotBlank() && password == confirmPassword) {
                                            viewModel.signUpWithEmail(email, password) { _, _ -> }
                                        }

                                        isRegisteringClub = false
                                    }
                                },
                                enabled = !isRegisteringClub && name.isNotBlank() && (password.isBlank() || password == confirmPassword),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(50.dp)
                                    .padding(top = 8.dp)
                                    .testTag("save_club_details_button"),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                if (isRegisteringClub) {
                                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Registering & Sending Invites...")
                                } else {
                                    Icon(Icons.Default.Save, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Save Club Registration & Continue")
                                }
                            }
                        }
                    }
                }
            }
        }
    } else {
        val club = clubDetails!!
        val clubThemeColor = try {
            Color(android.graphics.Color.parseColor(club.themeColorHex))
        } catch (e: Exception) {
            MaterialTheme.colorScheme.primary
        }

        // Welcome Onboarding Empty State with generated Hero banner (Tailored to Club!)
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Top
        ) {
            item {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Welcome to ${club.name}",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = clubThemeColor
                )
                Text(
                    text = if (club.venue.isNotBlank()) "Playing at ${club.venue}" else "Automate matches, rotate players fairly, and track performance.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                    modifier = Modifier.padding(top = 8.dp, bottom = 24.dp)
                )

                // Hero illustration banner (16:9)
                Image(
                    painter = painterResource(id = R.drawable.img_badminton_hero),
                    contentDescription = "Badminton sports illustration",
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .testTag("onboarding_hero_image"),
                    contentScale = ContentScale.Crop
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Club Registration Profile Card
                val currentUser by viewModel.currentFirebaseUser.collectAsState()
                var isSyncing by remember { mutableStateOf(false) }
                var syncFeedbackMsg by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
                val accountEmail = currentUser?.email?.ifBlank { null }
                    ?: if (club.description.contains("@")) club.description else null
                    ?: if (club.contactPerson.contains("@")) club.contactPerson else null
                    ?: "Club Account"

                val organiserDisplayName = if (club.contactPerson.contains("@")) {
                    club.contactPerson.substringBefore('@')
                        .replace(".", " ")
                        .replace("_", " ")
                        .split(" ")
                        .filter { it.isNotBlank() }
                        .joinToString(" ") { word -> word.replaceFirstChar { it.uppercase() } }
                } else if (club.contactPerson.isNotBlank()) {
                    club.contactPerson
                } else {
                    "Not Specified"
                }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = clubThemeColor.copy(alpha = 0.12f)),
                    shape = RoundedCornerShape(20.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, clubThemeColor.copy(alpha = 0.3f))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Club Registration",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = clubThemeColor
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Organiser: $organiserDisplayName",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Text(
                                    text = "Target score: ${club.targetScore} points",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                            IconButton(
                                onClick = { showEditClubDialog = true },
                                colors = IconButtonDefaults.iconButtonColors(contentColor = clubThemeColor)
                            ) {
                                Icon(Icons.Default.Edit, contentDescription = "Edit Club Registration")
                            }
                        }

                        Divider(
                            modifier = Modifier.padding(vertical = 12.dp),
                            color = clubThemeColor.copy(alpha = 0.2f)
                        )

                        Surface(
                            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = "Logged in Club Account:",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                                Text(
                                    text = accountEmail,
                                    style = MaterialTheme.typography.bodyLarge,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = {
                                    isSyncing = true
                                    viewModel.manualCloudSync { success, msg ->
                                        isSyncing = false
                                        syncFeedbackMsg = Pair(success, msg ?: "Sync completed")
                                    }
                                },
                                enabled = !isSyncing,
                                modifier = Modifier.weight(1f).testTag("sync_cloud_button"),
                                colors = ButtonDefaults.buttonColors(containerColor = clubThemeColor)
                            ) {
                                if (isSyncing) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White)
                                } else {
                                    Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Sync", fontSize = 12.sp)
                                }
                            }

                            OutlinedButton(
                                onClick = {
                                    showSignOutDialog = true
                                    signOutSyncError = null
                                },
                                modifier = Modifier.weight(1f).testTag("sign_out_button")
                            ) {
                                Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Sign Out", fontSize = 12.sp)
                            }
                        }

                        syncFeedbackMsg?.let { (isSuccess, msg) ->
                            Text(
                                text = msg,
                                color = if (isSuccess) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(top = 8.dp)
                            )
                        }
                    }
                }
            }
        }
    }

    // EDIT CLUB DETAILS DIALOG
    if (showEditClubDialog && clubDetails != null) {
        val club = clubDetails!!
        var name by remember { mutableStateOf(club.name) }
        var venue by remember { mutableStateOf(club.venue) }
        var defaultSessionType by remember { mutableStateOf(club.defaultSessionType) }
        var targetScore by remember { mutableStateOf(club.targetScore.toString()) }
        var selectedColorHex by remember { mutableStateOf(club.themeColorHex) }
        var contactPerson by remember { mutableStateOf(club.contactPerson) }
        var description by remember { mutableStateOf(club.description) }

        val clubThemeColor = try {
            Color(android.graphics.Color.parseColor(selectedColorHex))
        } catch (e: Exception) {
            MaterialTheme.colorScheme.primary
        }

        AlertDialog(
            onDismissRequest = { showEditClubDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.SportsTennis, contentDescription = null, tint = clubThemeColor)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Edit Club Registration")
                }
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Club Name") },
                        modifier = Modifier.fillMaxWidth().testTag("edit_club_name_input"),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = venue,
                        onValueChange = { venue = it },
                        label = { Text("Venue / Arena") },
                        modifier = Modifier.fillMaxWidth().testTag("edit_club_venue_input"),
                        singleLine = true
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = targetScore,
                            onValueChange = { if (it.all { char -> char.isDigit() }) targetScore = it },
                            label = { Text("Target Score") },
                            modifier = Modifier.weight(1f).testTag("edit_club_target_score_input"),
                            singleLine = true
                        )

                        OutlinedTextField(
                            value = contactPerson,
                            onValueChange = { contactPerson = it },
                            label = { Text("Organiser") },
                            modifier = Modifier.weight(1.2f).testTag("edit_club_contact_input"),
                            singleLine = true
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (name.isNotBlank()) {
                            viewModel.saveClubDetails(
                                name = name,
                                venue = venue,
                                defaultSessionType = defaultSessionType,
                                themeColorHex = selectedColorHex,
                                targetScore = targetScore.toIntOrNull() ?: 21,
                                contactPerson = contactPerson,
                                description = description
                            )
                            showEditClubDialog = false
                        }
                    },
                    modifier = Modifier.testTag("confirm_edit_club")
                ) {
                    Text("Save", color = clubThemeColor)
                }
            },
            dismissButton = {
                TextButton(onClick = { showEditClubDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // SIGN OUT & SYNC DATA DIALOG
    if (showSignOutDialog) {
        val themeColor = clubDetails?.themeColorHex?.let {
            try {
                Color(android.graphics.Color.parseColor(it))
            } catch (e: Exception) {
                null
            }
        } ?: MaterialTheme.colorScheme.primary

        AlertDialog(
            onDismissRequest = {
                if (!isSigningOutAndSyncing) {
                    showSignOutDialog = false
                    signOutSyncError = null
                }
            },
            icon = {
                Icon(
                    imageVector = Icons.Default.Logout,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(28.dp)
                )
            },
            title = {
                Text(
                    text = "Sign Out & Sync Data",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Signing out will disconnect your account and remove all club information (members, sessions, courts, match history, and settings) from this local device.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.CloudSync,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "To avoid losing any changes, sync your club data before signing out.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }

                    if (isSigningOutAndSyncing) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp)
                        ) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "Syncing to Realtime Database and signing out...",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    signOutSyncError?.let { err ->
                        Surface(
                            color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.8f),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.ErrorOutline,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Sync failed: $err\n\nYou can retry syncing, or proceed to sign out without syncing (local unsynced changes will be lost).",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onErrorContainer
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                if (signOutSyncError != null) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(
                            onClick = {
                                isSigningOutAndSyncing = false
                                viewModel.signOutAndClearLocalData(syncFirst = false) { _, _ ->
                                    showSignOutDialog = false
                                }
                            },
                            colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                            modifier = Modifier.testTag("sign_out_anyway_button")
                        ) {
                            Text("Sign Out Anyway")
                        }
                        Button(
                            onClick = {
                                isSigningOutAndSyncing = true
                                signOutSyncError = null
                                viewModel.signOutAndClearLocalData(syncFirst = true) { success, msg ->
                                    isSigningOutAndSyncing = false
                                    if (success) {
                                        showSignOutDialog = false
                                    } else {
                                        signOutSyncError = msg ?: "Sync failed"
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = themeColor),
                            modifier = Modifier.testTag("retry_sync_and_sign_out_button")
                        ) {
                            Text("Retry Sync")
                        }
                    }
                } else {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(
                            onClick = {
                                isSigningOutAndSyncing = false
                                viewModel.signOutAndClearLocalData(syncFirst = false) { _, _ ->
                                    showSignOutDialog = false
                                }
                            },
                            enabled = !isSigningOutAndSyncing,
                            colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                            modifier = Modifier.testTag("sign_out_without_sync_button")
                        ) {
                            Text("Sign Out Only")
                        }
                        Button(
                            onClick = {
                                isSigningOutAndSyncing = true
                                signOutSyncError = null
                                viewModel.signOutAndClearLocalData(syncFirst = true) { success, msg ->
                                    isSigningOutAndSyncing = false
                                    if (success) {
                                        showSignOutDialog = false
                                    } else {
                                        signOutSyncError = msg ?: "Sync failed"
                                    }
                                }
                            },
                            enabled = !isSigningOutAndSyncing,
                            colors = ButtonDefaults.buttonColors(containerColor = themeColor),
                            modifier = Modifier.testTag("sync_and_sign_out_button")
                        ) {
                            Icon(Icons.Default.CloudSync, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Sync & Sign Out")
                        }
                    }
                }
            },
            dismissButton = {
                if (!isSigningOutAndSyncing) {
                    TextButton(
                        onClick = {
                            showSignOutDialog = false
                            signOutSyncError = null
                        },
                        modifier = Modifier.testTag("cancel_sign_out_button")
                    ) {
                        Text("Cancel")
                    }
                }
            }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun PlayerSetupRow(
    player: PlayerEntity,
    join: SessionPlayerJoinEntity,
    courts: List<CourtEntity>,
    onTogglePause: () -> Unit,
    onEligibilityChanged: (List<Int>?) -> Unit,
    onRemove: () -> Unit
) {
    var expandedEligibility by remember { mutableStateOf(false) }
    val assignedCourts = remember(join.eligibleCourtIds) {
        if (join.eligibleCourtIds.isNullOrEmpty()) emptyList()
        else join.eligibleCourtIds.split(",").mapNotNull { it.toIntOrNull() }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (join.isPaused) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f)
            else MaterialTheme.colorScheme.surface
        ),
        shape = RoundedCornerShape(24.dp),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (join.isPaused) MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f)
            else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f)
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    Icon(
                        imageVector = if (player.gender == "MALE") Icons.Default.Male else Icons.Default.Female,
                        contentDescription = player.gender,
                        tint = if (player.gender == "MALE") Color(0xFF38BDF8) else Color(0xFFF472B6),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = player.name,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (join.isPaused) MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                                else MaterialTheme.colorScheme.onSurface
                            )
                            if (join.isPAYG) {
                                Spacer(modifier = Modifier.width(6.dp))
                                Surface(
                                    color = Color(0xFFF59E0B).copy(alpha = 0.12f),
                                    contentColor = Color(0xFFD97706),
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Text(
                                        text = "PAYG",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Black,
                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }
                        val eligibilityText = if (assignedCourts.isEmpty()) "All Courts (Shared Pool)"
                        else "Courts: " + assignedCourts.mapNotNull { cId -> courts.find { it.id == cId }?.name }.joinToString(", ")
                        Text(
                            text = eligibilityText,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    // Pause/Unpause Button
                    IconButton(onClick = onTogglePause) {
                        Icon(
                            imageVector = if (join.isPaused) Icons.Default.PlayArrow else Icons.Default.Pause,
                            contentDescription = if (join.isPaused) "Resume" else "Pause",
                            tint = if (join.isPaused) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary
                        )
                    }

                    // Court eligibility toggle
                    IconButton(onClick = { expandedEligibility = !expandedEligibility }) {
                        Icon(
                            imageVector = Icons.Default.EditRoad,
                            contentDescription = "Edit Court Assignments",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Remove from active session
                    IconButton(onClick = onRemove) {
                        Icon(Icons.Default.RemoveCircleOutline, contentDescription = "Remove", tint = MaterialTheme.colorScheme.error)
                    }
                }
            }

            // Expanded Court assignments checklist
            if (expandedEligibility && courts.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Divider()
                Spacer(modifier = Modifier.height(8.dp))
                Text("Select Eligible Courts:", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(4.dp))
                
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    // Shared pool chip (All courts)
                    FilterChip(
                        selected = assignedCourts.isEmpty(),
                        onClick = { onEligibilityChanged(null) },
                        label = { Text("All Courts (Shared)") }
                    )

                    courts.forEach { court ->
                        val isAssigned = assignedCourts.contains(court.id)
                        FilterChip(
                            selected = isAssigned,
                            onClick = {
                                val newList = if (isAssigned) {
                                    assignedCourts.filter { it != court.id }
                                } else {
                                    assignedCourts + court.id
                                }
                                onEligibilityChanged(if (newList.isEmpty()) null else newList)
                            },
                            label = { Text(court.name) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun CloudAuthTab(
    viewModel: BadmintonViewModel,
    clubThemeColor: Color
) {
    val currentUser by viewModel.currentFirebaseUser.collectAsState()
    if (currentUser != null) return

    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var isSignUpMode by remember { mutableStateOf(false) }
    var feedbackMessage by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var isLoading by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
            ),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.CloudSync,
                        contentDescription = "Club Account",
                        tint = clubThemeColor,
                        modifier = Modifier.size(24.dp)
                    )
                    Text(
                        text = "Club Account",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }

                Text(
                    text = "Sign in or register a dedicated account to manage club sessions, court configurations, members, and historical records.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = !isSignUpMode,
                        onClick = { isSignUpMode = false },
                        label = { Text("Sign In") },
                        modifier = Modifier.weight(1f)
                    )
                    FilterChip(
                        selected = isSignUpMode,
                        onClick = { isSignUpMode = true },
                        label = { Text("Register Club Account") },
                        modifier = Modifier.weight(1f)
                    )
                }

                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Club Email Address") },
                    modifier = Modifier.fillMaxWidth().testTag("auth_email_input"),
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) }
                )

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth().testTag("auth_password_input"),
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) }
                )

                if (isSignUpMode) {
                    OutlinedTextField(
                        value = confirmPassword,
                        onValueChange = { confirmPassword = it },
                        label = { Text("Verify Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        isError = confirmPassword.isNotBlank() && confirmPassword != password,
                        supportingText = {
                            if (confirmPassword.isNotBlank() && confirmPassword != password) {
                                Text("Passwords do not match", color = MaterialTheme.colorScheme.error)
                            }
                        },
                        modifier = Modifier.fillMaxWidth().testTag("auth_confirm_password_input"),
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) }
                    )
                }

                Button(
                    onClick = {
                        if (email.isBlank() || password.isBlank()) {
                            feedbackMessage = Pair(false, "Please enter email and password")
                            return@Button
                        }
                        if (isSignUpMode && password != confirmPassword) {
                            feedbackMessage = Pair(false, "Passwords do not match. Please verify your password.")
                            return@Button
                        }
                        isLoading = true
                        if (isSignUpMode) {
                            viewModel.signUpWithEmail(email, password) { success, errorMsg ->
                                isLoading = false
                                feedbackMessage = Pair(success, if (success) "Club account registered successfully!" else errorMsg ?: "Sign up failed")
                            }
                        } else {
                            viewModel.signInWithEmail(email, password) { success, errorMsg ->
                                isLoading = false
                                feedbackMessage = Pair(success, if (success) "Signed in successfully!" else errorMsg ?: "Sign in failed")
                            }
                        }
                    },
                    enabled = !isLoading && email.isNotBlank() && password.isNotBlank() && (!isSignUpMode || password == confirmPassword),
                    modifier = Modifier.fillMaxWidth().testTag("auth_submit_button"),
                    colors = ButtonDefaults.buttonColors(containerColor = clubThemeColor)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White)
                    } else {
                        Text(if (isSignUpMode) "Register Club Account" else "Sign In")
                    }
                }

                if (!isSignUpMode) {
                    TextButton(
                        onClick = {
                            if (email.isBlank()) {
                                feedbackMessage = Pair(false, "Please enter your email address above first.")
                            } else {
                                isLoading = true
                                viewModel.sendPasswordResetEmail(email) { success, msg ->
                                    isLoading = false
                                    feedbackMessage = Pair(success, msg ?: "Reset link dispatched.")
                                }
                            }
                        },
                        modifier = Modifier.align(Alignment.End).testTag("forgot_password_button")
                    ) {
                        Text("Forgot Password?", style = MaterialTheme.typography.bodySmall)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Don't have registered club ? ",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        TextButton(
                            onClick = { isSignUpMode = true },
                            modifier = Modifier.testTag("register_new_club_link")
                        ) {
                            Text(
                                text = "Register New Club",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Bold,
                                color = clubThemeColor
                            )
                        }
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Already have a registered club ? ",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        TextButton(
                            onClick = { isSignUpMode = false },
                            modifier = Modifier.testTag("switch_to_signin_link")
                        ) {
                            Text(
                                text = "Sign In",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Bold,
                                color = clubThemeColor
                            )
                        }
                    }
                }

                feedbackMessage?.let { (isSuccess, msg) ->
                    Surface(
                        color = if (isSuccess) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.errorContainer,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = msg,
                            color = if (isSuccess) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onErrorContainer,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(8.dp),
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }
    }
}

