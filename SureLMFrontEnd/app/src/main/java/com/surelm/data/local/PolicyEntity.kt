package com.surelm.data.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "policies",
    indices = [Index(value = ["leadId"])]
)
data class PolicyEntity(
    @PrimaryKey @ColumnInfo(name = "id") val id: String,
    @ColumnInfo(name = "leadId") val leadId: String,
    @ColumnInfo(name = "policyName") val policyName: String,
    @ColumnInfo(name = "premiumAmount") val premiumAmount: Int?,
    @ColumnInfo(name = "issuedAt") val issuedAt: Long,
    @ColumnInfo(name = "status") val status: String
)
