package com.surelm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class OCRRequest(
    @SerializedName("fileBase64") val fileBase64: String,
    @SerializedName("filename") val filename: String,
    @SerializedName("mimeType") val mimeType: String = "application/pdf"
)
