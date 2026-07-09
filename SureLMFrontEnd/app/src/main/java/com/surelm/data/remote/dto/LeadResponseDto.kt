package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class LeadResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: LeadDto? = null,
    @SerializedName("error") val error: String? = null
)
