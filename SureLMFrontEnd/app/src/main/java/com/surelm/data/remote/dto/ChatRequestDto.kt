package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ChatRequest(
    val messages: List<ChatMessage>,
    val sessionId: String? = null,
    val stream: Boolean = false
)

data class ChatMessage(
    val role: String,  // "user", "system"
    val content: String
)
