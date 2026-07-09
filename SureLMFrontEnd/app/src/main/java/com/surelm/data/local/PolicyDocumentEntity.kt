package com.surelm.data.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "policy_documents")
data class PolicyDocumentEntity(
    @PrimaryKey @ColumnInfo(name = "id") val id: String,
    @ColumnInfo(name = "name") val name: String,
    @ColumnInfo(name = "provider") val provider: String? = null,
    @ColumnInfo(name = "pdf_path") val pdfPath: String,
    @ColumnInfo(name = "cached_at") val cachedAt: Long
)
