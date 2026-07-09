package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ReminderDto(
    @SerializedName("id") val id: String,
    @SerializedName("leadId") val leadId: String,
    @SerializedName("type") val type: String,
    @SerializedName("scheduledAt") val scheduledAt: String,
    @SerializedName("note") val note: String?,
    @SerializedName("isDone") val isDone: Boolean
)
