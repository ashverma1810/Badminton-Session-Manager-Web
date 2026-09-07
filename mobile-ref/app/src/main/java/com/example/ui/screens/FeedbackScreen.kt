package com.example.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.SportsTennis
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.viewmodel.BadmintonViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedbackScreen(
    viewModel: BadmintonViewModel,
    modifier: Modifier = Modifier
) {
    val clubDetails by viewModel.clubDetails.collectAsState()
    val defaultPrimary = MaterialTheme.colorScheme.primary
    val clubThemeColor = remember(clubDetails?.themeColorHex, defaultPrimary) {
        try {
            clubDetails?.themeColorHex?.let { Color(android.graphics.Color.parseColor(it)) } ?: defaultPrimary
        } catch (e: Exception) {
            defaultPrimary
        }
    }

    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current

    var userName by remember { mutableStateOf("") }
    var userFeedback by remember { mutableStateOf("") }

    val feedbackEmail = "ashish.verma.uk@gmail.com"
    val emailSubject = "Badminton Club Manager Feedback"

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Top
    ) {
        Spacer(modifier = Modifier.height(16.dp))

        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(clubThemeColor.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Email,
                contentDescription = null,
                tint = clubThemeColor,
                modifier = Modifier.size(36.dp)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "We'd Love Your Feedback!",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center
        )

        Text(
            text = "Tell us how we can improve the Badminton Club Manager app. Your ideas, bug reports, and suggestions make a huge difference!",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp, bottom = 24.dp)
        )

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Draft Feedback",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                OutlinedTextField(
                    value = userName,
                    onValueChange = { userName = it },
                    label = { Text("Your Name / Role (Optional)") },
                    placeholder = { Text("e.g. John Doe - Coach") },
                    leadingIcon = { Icon(Icons.Default.SportsTennis, contentDescription = null) },
                    modifier = Modifier.fillMaxWidth().testTag("feedback_name_input"),
                    singleLine = true
                )

                OutlinedTextField(
                    value = userFeedback,
                    onValueChange = { userFeedback = it },
                    label = { Text("Message") },
                    placeholder = { Text("Type your feedback, feature request, or suggestions here...") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(150.dp)
                        .testTag("feedback_message_input"),
                    maxLines = 10
                )

                Button(
                    onClick = {
                        val body = buildString {
                            if (userName.isNotBlank()) {
                                append("From: $userName\n")
                            }
                            clubDetails?.let {
                                append("Club: ${it.name}\n")
                                if (it.venue.isNotBlank()) {
                                    append("Venue: ${it.venue}\n")
                                }
                            }
                            append("\nFeedback:\n")
                            append(userFeedback)
                        }

                        val emailUri = Uri.parse("mailto:")
                        val emailIntent = Intent(Intent.ACTION_SENDTO).apply {
                            data = emailUri
                            putExtra(Intent.EXTRA_EMAIL, arrayOf(feedbackEmail))
                            putExtra(Intent.EXTRA_SUBJECT, emailSubject)
                            putExtra(Intent.EXTRA_TEXT, body)
                        }

                        try {
                            val chooserIntent = Intent.createChooser(emailIntent, "Send Feedback via...")
                            context.startActivity(chooserIntent)
                        } catch (e: Exception) {
                            Toast.makeText(context, "No email client found. Copying feedback to clipboard instead.", Toast.LENGTH_LONG).show()
                            clipboardManager.setText(AnnotatedString(body))
                        }
                    },
                    enabled = userFeedback.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = clubThemeColor),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .testTag("send_feedback_button")
                ) {
                    Icon(Icons.Default.Send, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Send Feedback")
                }

                if (userFeedback.isNotBlank()) {
                    OutlinedButton(
                        onClick = {
                            val body = buildString {
                                if (userName.isNotBlank()) {
                                    append("From: $userName\n")
                                }
                                clubDetails?.let {
                                    append("Club: ${it.name}\n")
                                }
                                append("\nFeedback:\n")
                                append(userFeedback)
                            }
                            clipboardManager.setText(AnnotatedString(body))
                            Toast.makeText(context, "Copied to clipboard!", Toast.LENGTH_SHORT).show()
                        },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .testTag("copy_feedback_button")
                    ) {
                        Icon(Icons.Default.ContentCopy, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Copy Feedback Text")
                    }
                }
            }
        }
    }
}
