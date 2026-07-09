package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class LeadDto(
    @SerializedName("id") val id: String,
    @SerializedName("agentId") val agentId: String,
    @SerializedName("householdName") val householdName: String,
    @SerializedName("phone") val phone: String?,
    @SerializedName("income") val income: Int?,
    @SerializedName("familySize") val familySize: Int?,
    @SerializedName("status") val status: String,
    @SerializedName("notes") val notes: String?,
    @SerializedName("dateOfBirth") val dateOfBirth: String?,
    @SerializedName("followUpAt") val followUpAt: String?,
    @SerializedName("isBirthdayToday") val isBirthdayToday: Boolean,
    @SerializedName("isBirthdayThisWeek") val isBirthdayThisWeek: Boolean,
    @SerializedName("hasPremiumDue") val hasPremiumDue: Boolean,
    @SerializedName("premiumsDue") val premiumsDue: List<PolicyIssuanceDto> = emptyList(),
    @SerializedName("reminders") val reminders: List<ReminderDto> = emptyList(),
    @SerializedName("issuances") val issuances: List<PolicyIssuanceDto> = emptyList()
)
