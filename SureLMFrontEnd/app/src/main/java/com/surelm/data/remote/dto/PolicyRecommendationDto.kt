package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class PolicyRecommendationDto(
    @SerializedName("policyId") val policyId: String,
    @SerializedName("policyName") val policyName: String,
    @SerializedName("relevanceScore") val relevanceScore: Float,
    @SerializedName("monthlyCost") val monthlyCost: Int,
    @SerializedName("coverageAmount") val coverageAmount: Int,
    @SerializedName("keyBenefits") val keyBenefits: List<String>,
    @SerializedName("explanation") val explanation: String
)
