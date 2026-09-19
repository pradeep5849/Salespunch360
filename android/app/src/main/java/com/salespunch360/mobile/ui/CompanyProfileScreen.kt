package com.salespunch360.mobile.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.CompanyProfileViewModel
import com.salespunch360.mobile.data.CompanyProfileUpdate

@Composable
fun CompanyProfileScreen(vm: CompanyProfileViewModel = viewModel()) {
    val state = vm.state.collectAsStateWithLifecycle().value
    val profile = state.profile
    if (profile == null && state.loading) {
        LoadingScreen("Loading company details…")
        return
    }
    if (profile == null) {
        RetryScreen(state.error ?: "Company details couldn't be loaded.", vm::load)
        return
    }

    var name by remember(profile) { mutableStateOf(profile.name) }
    var address1 by remember(profile) { mutableStateOf(profile.addressLine1.orEmpty()) }
    var address2 by remember(profile) { mutableStateOf(profile.addressLine2.orEmpty()) }
    var locality by remember(profile) { mutableStateOf(profile.locality.orEmpty()) }
    var city by remember(profile) { mutableStateOf(profile.city.orEmpty()) }
    var region by remember(profile) { mutableStateOf(profile.state.orEmpty()) }
    var postal by remember(profile) { mutableStateOf(profile.postalCode.orEmpty()) }
    var country by remember(profile) { mutableStateOf(profile.country ?: "India") }
    var contactName by remember(profile) { mutableStateOf(profile.primaryContactName.orEmpty()) }
    var phone by remember(profile) { mutableStateOf(profile.primaryPhone.orEmpty()) }
    var email by remember(profile) { mutableStateOf(profile.contactEmail.orEmpty()) }

    val emailValid = android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()
    val valid = name.trim().length >= 2 && address1.trim().length >= 2 && city.trim().length >= 2 &&
        region.trim().length >= 2 && postal.trim().length >= 3 && country.trim().length >= 2 &&
        contactName.trim().length >= 2 && phone.trim().length >= 5 && emailValid

    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text("Company Details", style = MaterialTheme.typography.headlineSmall)
            Text(
                if (profile.profileComplete) "Company profile complete." else "Complete these details before adding Managers or Sales employees.",
                color = if (profile.profileComplete) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
            )
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), label = { Text("Company name") }, singleLine = true)
                OutlinedTextField(address1, { address1 = it }, Modifier.fillMaxWidth(), label = { Text("Address line 1") })
                OutlinedTextField(address2, { address2 = it }, Modifier.fillMaxWidth(), label = { Text("Address line 2 (optional)") })
                OutlinedTextField(locality, { locality = it }, Modifier.fillMaxWidth(), label = { Text("Locality (optional)") }, singleLine = true)
                OutlinedTextField(city, { city = it }, Modifier.fillMaxWidth(), label = { Text("City") }, singleLine = true)
                OutlinedTextField(region, { region = it }, Modifier.fillMaxWidth(), label = { Text("State") }, singleLine = true)
                OutlinedTextField(postal, { postal = it }, Modifier.fillMaxWidth(), label = { Text("Postal code") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                OutlinedTextField(country, { country = it }, Modifier.fillMaxWidth(), label = { Text("Country") }, singleLine = true)
                OutlinedTextField(contactName, { contactName = it }, Modifier.fillMaxWidth(), label = { Text("Primary contact name") }, singleLine = true)
                OutlinedTextField(phone, { phone = it }, Modifier.fillMaxWidth(), label = { Text("Primary phone") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
                OutlinedTextField(
                    email,
                    { email = it },
                    Modifier.fillMaxWidth(),
                    label = { Text("Contact email") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    isError = email.isNotBlank() && !emailValid,
                    supportingText = { if (email.isNotBlank() && !emailValid) Text("Enter a valid email address") },
                )
                Button(
                    onClick = {
                        vm.save(
                            CompanyProfileUpdate(
                                name = name.trim(),
                                addressLine1 = address1.trim(),
                                addressLine2 = address2.trim().ifBlank { null },
                                locality = locality.trim().ifBlank { null },
                                city = city.trim(),
                                state = region.trim(),
                                postalCode = postal.trim(),
                                country = country.trim(),
                                primaryContactName = contactName.trim(),
                                primaryPhone = phone.trim(),
                                contactEmail = email.trim(),
                            )
                        )
                    },
                    enabled = valid && !state.saving,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (state.saving) "Saving…" else "Save company details")
                }
            }
        }
        state.error?.let { item { MessageBanner(it) { vm.load() } } }
        state.message?.let { item { ContentCard("Saved", it) } }
    }
}
