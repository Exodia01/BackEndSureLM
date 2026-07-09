package com.surelm.data.remote

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import com.surelm.BuildConfig

object ApiClient {
    
    private const val BASE_URL = "http://10.0.2.2:3000"
    
    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) 
            HttpLoggingInterceptor.Level.BODY 
        else 
            HttpLoggingInterceptor.Level.NONE
    }
    
    private val httpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .build()
    
    val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(httpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
    
    val sureLMApi: SureLMApi = retrofit.create(SureLMApi::class.java)
}
