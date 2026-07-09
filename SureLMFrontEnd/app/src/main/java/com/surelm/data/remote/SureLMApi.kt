package com.surelm.data.remote

import retrofit2.http.*

interface SureLMApi {
    
    @GET("/api/crm")
    suspend fun getLeads(): CRMResponse
    
    @PATCH("/api/leads/{id}")
    suspend fun updateLead(
        @Path("id") id: String,
        @Body updates: Map<String, Any>
    ): LeadResponse
    
    @POST("/api/leads")
    suspend fun createLead(@Body request: CreateLeadRequest): LeadResponse
    
    @GET("/api/leads")
    suspend fun getAllLeads(): List<LeadResponse>
    
    @POST("/api/chat")
    suspend fun chat(
        @Body request: ChatRequest
    ): ChatResponse
    
    @Streaming
    @POST("/api/chat")
    suspend fun chatStream(
        @Body request: ChatRequest
    ): retrofit2.Response<okhttp3.ResponseBody>
    
    @POST("/api/ocr")
    suspend fun processOCR(@Body request: OCRRequest): OCRResponse
    
    @POST("/api/messages")
    suspend fun addMessage(@Body request: AddMessageRequest): MessageResponse
}
