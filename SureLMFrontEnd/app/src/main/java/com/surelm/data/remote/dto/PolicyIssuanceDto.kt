package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class PolicyIssuanceDto(
    @SerializedName("id") val id: String,
    @SerializedName("leadId") val leadId: String,
    @SerializedName("policyName") val policyName: String,
    @SerializedName("premiumAmount") val premiumAmount: Int?,
    @SerializedName("issuedAt") val issuedAt: String,
    @SerializedName("status") val status: String
)
