package com.surelm.data.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sync_queue")
data class SyncQueueEntity(
    @PrimaryKey @ColumnInfo(name = "id") val id: String,
    @ColumnInfo(name = "actionType") val actionType: String, // "create_lead", "update_lead"
    @ColumnInfo(name = "payload") val payload: String,  // JSON
    @ColumnInfo(name = "createdAt") val createdAt: Long,
    @ColumnInfo(name = "syncedAt") val syncedAt: Long? = null,
    @ColumnInfo(name = "status") val status: String = "pending"  // pending, syncing, synced, failed
)
