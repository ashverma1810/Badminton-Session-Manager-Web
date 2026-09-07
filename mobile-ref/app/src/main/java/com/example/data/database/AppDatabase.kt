package com.example.data.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        SessionEntity::class,
        PlayerEntity::class,
        SessionPlayerJoinEntity::class,
        CourtEntity::class,
        CourtMasterEntity::class,
        MatchEntity::class,
        ClubEntity::class,
        WeeklySessionEntity::class,
        WeeklySessionMemberEntity::class,
        WeeklySessionCourtEntity::class,
        SessionManagerEntity::class
    ],
    version = 10,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun badmintonDao(): BadmintonDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        private val MIGRATION_6_7 = object : Migration(6, 7) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `session_players` ADD COLUMN `pausedAtMatchCount` INTEGER DEFAULT NULL")
            }
        }

        private val MIGRATION_8_9 = object : Migration(8, 9) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `sessions` ADD COLUMN `targetScore` INTEGER NOT NULL DEFAULT 21")
                db.execSQL("ALTER TABLE `weekly_sessions` ADD COLUMN `targetScore` INTEGER NOT NULL DEFAULT 21")
            }
        }

        private val MIGRATION_9_10 = object : Migration(9, 10) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `weekly_sessions` ADD COLUMN `managerName` TEXT DEFAULT NULL")
                db.execSQL("ALTER TABLE `weekly_sessions` ADD COLUMN `manager2Id` INTEGER DEFAULT NULL")
                db.execSQL("ALTER TABLE `weekly_sessions` ADD COLUMN `manager2Name` TEXT DEFAULT NULL")
                db.execSQL("ALTER TABLE `sessions` ADD COLUMN `managerName` TEXT DEFAULT NULL")
                db.execSQL("ALTER TABLE `sessions` ADD COLUMN `manager2Id` INTEGER DEFAULT NULL")
                db.execSQL("ALTER TABLE `sessions` ADD COLUMN `manager2Name` TEXT DEFAULT NULL")
            }
        }

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "badminton_database"
                )
                .addMigrations(MIGRATION_6_7, MIGRATION_8_9, MIGRATION_9_10)
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
