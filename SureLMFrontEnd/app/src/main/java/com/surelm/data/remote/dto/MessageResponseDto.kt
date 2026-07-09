package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class MessageResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: MessageDto? = null,
    @SerializedName("error") val error: String? = null
)
