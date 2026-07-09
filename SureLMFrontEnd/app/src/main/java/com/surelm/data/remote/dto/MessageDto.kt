package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class MessageDto(
    @SerializedName("id") val id: String,
    @SerializedName("leadId") val leadId: String,
    @SerializedName("role") val role: String,
    @SerializedName("content") val content: String
)
