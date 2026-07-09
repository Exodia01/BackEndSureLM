package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class AddMessageRequest(
    @SerializedName("leadId") val leadId: String,
    @SerializedName("role") val role: String,  // "agent", "ai"
    @SerializedName("content") val content: String
)
