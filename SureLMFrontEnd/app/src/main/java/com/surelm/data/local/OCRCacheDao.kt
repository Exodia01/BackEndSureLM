package com.surelm.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface OCRCacheDao {
    @Query("SELECT * FROM ocr_cache WHERE imageHash = :hash LIMIT 1")
    suspend fun getCachedResult(hash: String): OCRCacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun cacheOCR(result: OCRCacheEntity)

    @Query("DELETE FROM ocr_cache WHERE cachedAt < :beforeDate")
    suspend fun deleteExpired(beforeDate: Long)
}
