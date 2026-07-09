package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class CRMResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: CRMData? = null
)

data class CRMData(
    @SerializedName("leads") val leads: List<LeadDto>,
    @SerializedName("stats") val stats: Stats?
)

data class Stats(
    @SerializedName("total") val total: Int,
    @SerializedName("birthdaysToday") val birthdaysToday: Int,
    @SerializedName("premiumsDueUrgentCount") val premiumsDueUrgentCount: Int
)
