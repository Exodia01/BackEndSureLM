package com.surelm.data.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "leads",
    indices = [
        Index(value = ["agentId"]),
        Index(value = ["status"])
    ]
)
data class LeadEntity(
    @PrimaryKey @ColumnInfo(name = "id") val id: String,
    @ColumnInfo(name = "agentId") val agentId: String,
    @ColumnInfo(name = "householdName") val householdName: String,
    @ColumnInfo(name = "phone") val phone: String?,
    @ColumnInfo(name = "income") val income: Int?,
    @ColumnInfo(name = "familySize") val familySize: Int?,
    @ColumnInfo(name = "status") val status: String,
    @ColumnInfo(name = "notes") val notes: String?,
    @ColumnInfo(name = "date_of_birth") val dateOfBirth: String?,
    @ColumnInfo(name = "follow_up_at") val followUpAt: String?,
    @ColumnInfo(name = "is_birthday_today") val isBirthdayToday: Boolean,
    @ColumnInfo(name = "is_birthday_this_week") val isBirthdayThisWeek: Boolean,
    @ColumnInfo(name = "has_premium_due") val hasPremiumDue: Boolean,
    @ColumnInfo(name = "last_sync") val lastSync: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis()
)
