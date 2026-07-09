package com.surelm.data.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "policy_issuances",
    indices = [Index(value = ["leadId"])]
)
data class PolicyIssuanceEntity(
    @PrimaryKey @ColumnInfo(name = "id") val id: String,
    @ColumnInfo(name = "leadId") val leadId: String,
    @ColumnInfo(name = "policy_name") val policyName: String,
    @ColumnInfo(name = "premium_amount") val premiumAmount: Int?,
    @ColumnInfo(name = "issued_at") val issuedAt: Long,
    @ColumnInfo(name = "status") val status: String
)
