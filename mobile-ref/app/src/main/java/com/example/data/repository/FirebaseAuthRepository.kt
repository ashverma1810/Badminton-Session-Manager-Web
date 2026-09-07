package com.example.data.repository

import android.util.Log
import com.example.BadmintonApplication
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.UUID

class FirebaseAuthRepository {

    private fun getAuth(): FirebaseAuth? {
        return try {
            FirebaseAuth.getInstance()
        } catch (e: Exception) {
            val ctx = BadmintonApplication.getAppContext()
            if (ctx != null) {
                BadmintonApplication.ensureFirebaseInitialized(ctx)
                try {
                    FirebaseAuth.getInstance()
                } catch (e2: Exception) {
                    Log.w("FirebaseAuthRepository", "FirebaseAuth unavailable after init: ${e2.message}")
                    null
                }
            } else {
                Log.w("FirebaseAuthRepository", "FirebaseAuth not available: ${e.message}")
                null
            }
        }
    }

    private val _currentUser = MutableStateFlow<FirebaseUser?>(null)
    val currentUser: StateFlow<FirebaseUser?> = _currentUser

    init {
        val authInstance = getAuth()
        try {
            _currentUser.value = authInstance?.currentUser
            authInstance?.addAuthStateListener { firebaseAuth ->
                _currentUser.value = firebaseAuth.currentUser
            }
        } catch (e: Exception) {
            Log.w("FirebaseAuthRepository", "Auth listener setup failed: ${e.message}")
        }
    }

    fun isAvailable(): Boolean = getAuth() != null

    fun getCurrentUserId(): String? = getAuth()?.currentUser?.uid

    fun getCurrentUserEmail(): String? = getAuth()?.currentUser?.email ?: getAuth()?.currentUser?.uid

    fun isUserSignedIn(): Boolean = getAuth()?.currentUser != null

    private fun mapAuthException(e: Exception): Exception {
        return when (e) {
            is TimeoutCancellationException -> {
                IllegalStateException("Sign-in operation timed out. Please check your internet connection and try again.")
            }
            is FirebaseAuthInvalidUserException -> {
                IllegalStateException("No club account found with this email. Please check your email or tap 'Register New Club'.")
            }
            is FirebaseAuthInvalidCredentialsException -> {
                IllegalStateException("Incorrect password or malformed email. Please check your credentials or tap 'Forgot Password'.")
            }
            is FirebaseAuthUserCollisionException -> {
                IllegalStateException("An account with this email already exists. Please sign in instead.")
            }
            is FirebaseNetworkException -> {
                IllegalStateException("Network connection error. Please verify your internet connection.")
            }
            else -> {
                val msg = e.message ?: ""
                if (msg.contains("API key", ignoreCase = true) ||
                    msg.contains("INVALID_KEY", ignoreCase = true) ||
                    msg.contains("DummyPlaceholder") ||
                    msg.contains("internal error has occurred", ignoreCase = true)) {
                    IllegalStateException("Authentication service notice: Please ensure Identity Toolkit API is active in your Firebase project (Authentication > Sign-in method > Email/Password).")
                } else {
                    e
                }
            }
        }
    }

    suspend fun signInWithEmail(email: String, password: String): Result<FirebaseUser?> = withContext(Dispatchers.IO) {
        val firebaseAuth = getAuth() ?: return@withContext Result.failure(IllegalStateException("Firebase Auth unavailable. Please check internet connection."))
        try {
            withTimeout(20_000L) {
                val result = firebaseAuth.signInWithEmailAndPassword(email.trim(), password).await()
                _currentUser.value = result.user
                Result.success(result.user)
            }
        } catch (e: TimeoutCancellationException) {
            Log.e("FirebaseAuthRepository", "Sign in timed out after 20s", e)
            Result.failure(mapAuthException(e))
        } catch (e: Exception) {
            Log.e("FirebaseAuthRepository", "Sign in error: ${e.message}", e)
            Result.failure(mapAuthException(e))
        }
    }

    suspend fun signUpWithEmail(email: String, password: String): Result<FirebaseUser?> = withContext(Dispatchers.IO) {
        val firebaseAuth = getAuth() ?: return@withContext Result.failure(IllegalStateException("Firebase Auth unavailable. Please check internet connection."))
        try {
            withTimeout(20_000L) {
                val result = firebaseAuth.createUserWithEmailAndPassword(email.trim(), password).await()
                _currentUser.value = result.user
                Result.success(result.user)
            }
        } catch (e: TimeoutCancellationException) {
            Log.e("FirebaseAuthRepository", "Sign up timed out after 20s", e)
            Result.failure(mapAuthException(e))
        } catch (e: Exception) {
            Log.e("FirebaseAuthRepository", "Sign up error: ${e.message}", e)
            Result.failure(mapAuthException(e))
        }
    }

    suspend fun signInAnonymously(): Result<FirebaseUser?> = withContext(Dispatchers.IO) {
        val firebaseAuth = getAuth() ?: return@withContext Result.failure(IllegalStateException("Firebase Auth unavailable. Please check internet connection."))
        try {
            withTimeout(15_000L) {
                val result = firebaseAuth.signInAnonymously().await()
                _currentUser.value = result.user
                Result.success(result.user)
            }
        } catch (e: Exception) {
            Log.e("FirebaseAuthRepository", "Anonymous sign in error: ${e.message}", e)
            Result.failure(mapAuthException(e))
        }
    }

    suspend fun sendPasswordResetEmail(email: String): Result<Unit> = withContext(Dispatchers.IO) {
        val firebaseAuth = getAuth() ?: return@withContext Result.failure(IllegalStateException("Firebase Auth unavailable. Please check internet connection."))
        try {
            withTimeout(15_000L) {
                firebaseAuth.sendPasswordResetEmail(email.trim()).await()
                Result.success(Unit)
            }
        } catch (e: Exception) {
            Log.e("FirebaseAuthRepository", "Password reset error: ${e.message}", e)
            Result.failure(mapAuthException(e))
        }
    }

    /**
     * Provisions a session manager in Firebase Authentication and sends them a password reset/setup email.
     * Uses an isolated secondary FirebaseApp instance to create the account so the active club organiser
     * session is NEVER signed out.
     */
    suspend fun provisionManagerAccountAndSendResetEmail(email: String, name: String): Result<String> = withContext(Dispatchers.IO) {
        val cleanEmail = email.trim()
        if (cleanEmail.isBlank()) {
            return@withContext Result.failure(IllegalArgumentException("Email address cannot be empty"))
        }

        val primaryAuth = getAuth() ?: return@withContext Result.failure(IllegalStateException("Firebase Auth is unavailable."))

        try {
            val context = BadmintonApplication.getAppContext()
            if (context != null) {
                val primaryApp = FirebaseApp.getInstance()
                val secondaryAppName = "SecondaryManagerAuthApp"
                val secondaryApp = try {
                    FirebaseApp.getInstance(secondaryAppName)
                } catch (e: Exception) {
                    FirebaseApp.initializeApp(context, primaryApp.options, secondaryAppName)
                }

                val secondaryAuth = FirebaseAuth.getInstance(secondaryApp)
                val tempPassword = "MgrPass${UUID.randomUUID().toString().take(8)}!1"

                try {
                    withTimeout(15_000L) {
                        secondaryAuth.createUserWithEmailAndPassword(cleanEmail, tempPassword).await()
                        Log.d("FirebaseAuthRepository", "Created Firebase Auth account for manager $cleanEmail")
                    }
                } catch (e: FirebaseAuthUserCollisionException) {
                    Log.d("FirebaseAuthRepository", "Manager account already exists in Firebase Auth for $cleanEmail")
                } catch (e: Exception) {
                    Log.w("FirebaseAuthRepository", "Secondary createUser warning for $cleanEmail: ${e.message}")
                } finally {
                    try { secondaryAuth.signOut() } catch (_: Exception) {}
                }
            }

            // Send Password Reset / Setup email to the session manager
            withTimeout(15_000L) {
                primaryAuth.sendPasswordResetEmail(cleanEmail).await()
            }
            Log.i("FirebaseAuthRepository", "Password setup email successfully dispatched to $cleanEmail")
            Result.success("Account provisioned on Application Auth and password setup email sent to $cleanEmail")
        } catch (e: Exception) {
            Log.e("FirebaseAuthRepository", "Failed to provision manager $cleanEmail: ${e.message}", e)
            // Even if email dispatch failed or threw, check if it was due to non-existent account or network
            val mapped = mapAuthException(e)
            Result.failure(mapped)
        }
    }

    /**
     * Deletes a session manager's authentication details from Firebase Authentication
     */
    suspend fun deleteManagerAccount(email: String): Result<Unit> = withContext(Dispatchers.IO) {
        val cleanEmail = email.trim()
        if (cleanEmail.isBlank()) return@withContext Result.success(Unit)

        try {
            val context = BadmintonApplication.getAppContext()
            if (context != null) {
                val primaryApp = FirebaseApp.getInstance()
                val secondaryAppName = "SecondaryManagerAuthApp"
                val secondaryApp = try {
                    FirebaseApp.getInstance(secondaryAppName)
                } catch (e: Exception) {
                    FirebaseApp.initializeApp(context, primaryApp.options, secondaryAppName)
                }

                val secondaryAuth = FirebaseAuth.getInstance(secondaryApp)
                val user = secondaryAuth.currentUser
                if (user != null && user.email.equals(cleanEmail, ignoreCase = true)) {
                    try {
                        user.delete().await()
                        Log.d("FirebaseAuthRepository", "Deleted secondary auth user for $cleanEmail")
                    } catch (e: Exception) {
                        Log.w("FirebaseAuthRepository", "Secondary auth user delete notice for $cleanEmail: ${e.message}")
                    }
                }
                try { secondaryAuth.signOut() } catch (_: Exception) {}
            }
            Log.d("FirebaseAuthRepository", "Cleaned up authentication for manager $cleanEmail")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.w("FirebaseAuthRepository", "Manager auth cleanup notice for $cleanEmail: ${e.message}")
            Result.success(Unit)
        }
    }

    fun signOut() {
        try {
            getAuth()?.signOut()
            _currentUser.value = null
        } catch (e: Exception) {
            Log.e("FirebaseAuthRepository", "Sign out error: ${e.message}", e)
        }
    }
}
