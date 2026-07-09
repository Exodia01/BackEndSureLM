package com.surelm.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface PolicyDocumentDao {
    @Query("SELECT * FROM policy_documents ORDER BY cachedAt DESC")
    fun getAllDocuments(): Flow<List<PolicyDocumentEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDocument(document: PolicyDocumentEntity)

    @Query("SELECT * FROM policy_documents WHERE id = :id LIMIT 1")
    suspend fun getDocumentById(id: String): PolicyDocumentEntity?

    @Query("DELETE FROM policy_documents WHERE id = :id")
    suspend fun deleteDocument(id: String)
}
