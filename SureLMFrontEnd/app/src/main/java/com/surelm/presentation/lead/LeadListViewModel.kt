package com.surelm.presentation.lead

import androidx.lifecycle.viewModelScope
import com.surelm.domain.models.Lead
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import androidx.lifecycle.ViewModel

@HiltViewModel
class LeadListViewModel @Inject constructor(
    private val leadRepository: LeadRepository
) : ViewModel() {
    
    val leads = leadRepository.getLeads()
        .stateIn(
            viewModelScope,
            SharingStarted.Lazily,
            emptyList()
        )
    
    fun refresh() {
        viewModelScope.launch {
            leadRepository.syncLeads()
        }
    }
}
