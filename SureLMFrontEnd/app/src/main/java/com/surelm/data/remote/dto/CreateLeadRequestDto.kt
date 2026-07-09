package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class CreateLeadRequest(
    @SerializedName("householdName") val householdName: String,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("phone") val phone: String? = null
)
