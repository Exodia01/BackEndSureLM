package com.surelm.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.surelm.domain.models.Lead
import com.surelm.domain.models.PolicyIssuance
import com.surelm.domain.models.Reminder

@Database(
    entities = [
        LeadEntity::class, 
        PolicyIssuanceEntity::class, 
        ReminderEntity::class,
        ChatMessageEntity::class,
        PolicyDocumentEntity::class,
        OCRCacheEntity::class,
        SettingEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class SureLMDatabase : RoomDatabase() {
    abstract fun leadDao(): LeadDao
    abstract fun policyIssuanceDao(): PolicyIssuanceDao
    abstract fun reminderDao(): ReminderDao
    abstract fun chatMessageDao(): ChatMessageDao
    abstract fun policyDocumentDao(): PolicyDocumentDao
    abstract fun ocrCacheDao(): OCRCacheDao
    abstract fun settingDao(): SettingDao
}
