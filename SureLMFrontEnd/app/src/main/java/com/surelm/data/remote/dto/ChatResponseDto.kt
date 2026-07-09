package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ChatResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: ChatData? = null,
    @SerializedName("error") val error: String? = null
)

data class ChatData(
    @SerializedName("response") val response: String? = null,
    @SerializedName("recommendations") val recommendations: List<PolicyRecommendationDto>? = null,
    @SerializedName("messages") val messages: List<ChatMessage>? = null
)
