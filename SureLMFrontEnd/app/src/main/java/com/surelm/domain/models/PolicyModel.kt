package com.surelm.domain.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class Policy(
    val id: String = "",
    val policyId: String = "",
    val name: String = "",
    val provider: String? = null,
    val type: String = "",
    val status: String = "",
    val premiumAmount: Int? = null,
    val coverageAmount: Int? = null
) : Parcelable
