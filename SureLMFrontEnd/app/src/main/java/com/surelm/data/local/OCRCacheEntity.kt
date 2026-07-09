package com.surelm.data.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "ocr_cache")
data class OCRCacheEntity(
    @PrimaryKey @ColumnInfo(name = "id") val id: String,
    @ColumnInfo(name = "imageHash") val imageHash: String,
    @ColumnInfo(name = "extractedText") val extractedText: String,
    @ColumnInfo(name = "confidence") val confidence: Float,
    @ColumnInfo(name = "cachedAt") val cachedAt: Long
)
