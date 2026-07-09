package com.surelm.presentation.lead

import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.viewModel
import com.surelm.R
import com.surelm.presentation.theme.SureLMTheme
import kotlinx.coroutines.launch

@Composable
fun LeadListScreen(
    onLeadClick: (String) -> Unit,
    onAddLead: () -> Unit,
    viewModel: LeadListViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    val leads by viewModel.leads.collectAsState()
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.lead_list_title)) },
                actions = {
                    IconButton(onClick = onAddLead) {
                        Icon(Icons.Default.Add, contentDescription = stringResource(R.string.add_lead))
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onAddLead) {
                Icon(Icons.Default.Add, contentDescription = stringResource(R.string.add_lead))
            }
        }
    ) { paddingValues ->
        if (leads.isEmpty()) {
            EmptyState(modifier = Modifier.padding(paddingValues))
        } else {
            LazyColumn(contentPadding = paddingValues) {
                items(leads) { lead ->
                    LeadCard(
                        lead = lead,
                        onClick = { onLeadClick(lead.id) }
                    )
                }
            }
        }
    }
}

@Composable
fun LeadCard(
    lead: com.surelm.domain.models.Lead,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {}
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(8.dp)
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = lead.householdName,
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.weight(1f)
                )
                
                LeadStatusBadge(status = lead.status)
            }
            
            if (lead.phone != null) {
                Text(
                    text = lead.phone ?: "",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            if (lead.income != null || lead.familySize != null) {
                Row(modifier = Modifier.padding(top = 8.dp)) {
                    Text(
                        text = "Income: ₹${lead.income ?: 0}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Text(
                        text = "${lead.familySize ?: 0} members",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            Row(modifier = Modifier.padding(top = 8.dp)) {
                if (lead.isBirthdayToday) {
                    IconButton(
                        onClick = { /* Show birthday notification */ },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            Icons.Default.Cake,
                            contentDescription = "Birthday",
                            tint = MaterialTheme.colorScheme.secondary
                        )
                    }
                }
                
                if (lead.hasPremiumDue) {
                    IconButton(
                        onClick = { /* Show premium due */ },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            Icons.Default.Money,
                            contentDescription = "Premium Due",
                            tint = MaterialTheme.colorScheme.tertiary
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun LeadStatusBadge(status: String, modifier: Modifier = Modifier) {
    val (backgroundColor, textColor) = when (status.uppercase()) {
        "NEW" -> MaterialTheme.colorScheme.onPrimaryContainer to MaterialTheme.colorScheme.primaryContainer
        "CONTACTED" -> MaterialTheme.colorScheme.secondary to MaterialTheme.colorScheme.onSecondary
        "POLICY_ISSUED" -> MaterialTheme.colorScheme.tertiary to MaterialTheme.colorScheme.onTertiary
        else -> MaterialTheme.colorScheme.error to MaterialTheme.colorScheme.onError
    }
    
    Badge(
        modifier = modifier,
        containerColor = backgroundColor,
        contentColor = textColor
    ) {
        Text(status)
    }
}

@Composable
fun EmptyState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.People,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(64.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "No leads found",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
