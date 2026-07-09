package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class OCRResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("text") val text: String? = null,
    @SerializedName("confidence") val confidence: Float = 0.0f,
    @SerializedName("valid") val valid: Boolean = false,
    @SerializedName("error") val error: String? = null
)
