package com.example

import android.app.Application
import android.content.Context
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.database.FirebaseDatabase

class BadmintonApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        instance = this
        ensureFirebaseInitialized(this)
        try {
            FirebaseDatabase.getInstance().setPersistenceEnabled(true)
        } catch (e: Exception) {
            Log.w("BadmintonApplication", "RTDB persistence notice: ${e.message}")
        }
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        when (level) {
            TRIM_MEMORY_RUNNING_CRITICAL,
            TRIM_MEMORY_RUNNING_LOW,
            TRIM_MEMORY_COMPLETE,
            TRIM_MEMORY_MODERATE,
            TRIM_MEMORY_BACKGROUND,
            TRIM_MEMORY_UI_HIDDEN -> {
                // Release memory caches to comply with Android Q+ memory management
                System.gc()
            }
        }
    }

    override fun onLowMemory() {
        super.onLowMemory()
        System.gc()
    }

    companion object {
        private var instance: BadmintonApplication? = null

        fun getAppContext(): Context? = instance?.applicationContext

        fun ensureFirebaseInitialized(context: Context) {
            try {
                val appCtx = context.applicationContext ?: context
                if (FirebaseApp.getApps(appCtx).isEmpty()) {
                    val apiKey = try {
                        val field = BuildConfig::class.java.getField("FIREBASE_API_KEY")
                        (field.get(null) as? String)?.takeIf { it.isNotBlank() }
                    } catch (e: Exception) {
                        null
                    } ?: "AIzaSyBdmClubAppInitKey_DummyPlaceholder"

                    val projectId = try {
                        val field = BuildConfig::class.java.getField("FIREBASE_PROJECT_ID")
                        (field.get(null) as? String)?.takeIf { it.isNotBlank() }
                    } catch (e: Exception) {
                        null
                    } ?: "badmintonsessionmanager"

                    val dbUrl = try {
                        val field = BuildConfig::class.java.getField("FIREBASE_DATABASE_URL")
                        (field.get(null) as? String)?.takeIf { it.isNotBlank() }
                    } catch (e: Exception) {
                        null
                    } ?: "https://$projectId-default-rtdb.firebaseio.com"

                    val options = FirebaseOptions.Builder()
                        .setApiKey(apiKey)
                        .setApplicationId("1:976049980290:android:ffad50d5b47ca2eaedc59b")
                        .setProjectId(projectId)
                        .setDatabaseUrl(dbUrl)
                        .build()

                    FirebaseApp.initializeApp(appCtx, options)
                    Log.i("BadmintonApplication", "FirebaseApp initialized programmatically with key: ${apiKey.take(6)}...")
                }
            } catch (e: Exception) {
                Log.w("BadmintonApplication", "FirebaseApp init warning: ${e.message}")
            }
        }
    }
}
