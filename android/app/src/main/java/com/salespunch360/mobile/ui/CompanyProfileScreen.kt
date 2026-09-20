package com.salespunch360.mobile.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
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
import com.salespunch360.mobile.data.TeamStructure

@Composable
fun CompanyProfileScreen(
    vm: CompanyProfileViewModel = viewModel(),
    onComplete: (() -> Unit)? = null,
) {
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

    var name by remember(profile.name) { mutableStateOf(profile.name) }
    var address1 by remember(profile.addressLine1) { mutableStateOf(profile.addressLine1.orEmpty()) }
    var address2 by remember(profile.addressLine2) { mutableStateOf(profile.addressLine2.orEmpty()) }
    var locality by remember(profile.locality) { mutableStateOf(profile.locality.orEmpty()) }
    var city by remember(profile.city) { mutableStateOf(profile.city.orEmpty()) }
    var region by remember(profile.state) { mutableStateOf(profile.state.orEmpty()) }
    var postal by remember(profile.postalCode) { mutableStateOf(profile.postalCode.orEmpty()) }
    var country by remember(profile.country) { mutableStateOf(profile.country ?: "India") }
    var contactName by remember(profile.primaryContactName) { mutableStateOf(profile.primaryContactName.orEmpty()) }
    var phone by remember(profile.primaryPhone) { mutableStateOf(profile.primaryPhone.orEmpty()) }
    var email by remember(profile.contactEmail) { mutableStateOf(profile.contactEmail.orEmpty()) }
    var alternatePhone by remember(profile.alternatePhone) { mutableStateOf(profile.alternatePhone.orEmpty()) }
    var website by remember(profile.website) { mutableStateOf(profile.website.orEmpty()) }
    var gstin by remember(profile.gstin) { mutableStateOf(profile.gstin.orEmpty()) }
    var pan by remember(profile.pan) { mutableStateOf(profile.pan.orEmpty()) }
    var registration by remember(profile.registrationNumber) { mutableStateOf(profile.registrationNumber.orEmpty()) }
    var description by remember(profile.description) { mutableStateOf(profile.description.orEmpty()) }
    var structure by remember(profile.teamStructure) { mutableStateOf(profile.teamStructure) }

    val logoPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let(vm::uploadLogo)
    }
    val emailValid = android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()
    val valid = name.trim().length >= 2 && address1.trim().length >= 2 && city.trim().length >= 2 &&
        region.trim().length >= 2 && postal.trim().length >= 3 && country.trim().length >= 2 &&
        contactName.trim().length >= 2 && phone.trim().length >= 5 && emailValid

    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            if (onComplete != null) TextButton(onClick = onComplete) { Text("← Back to Employees") }
            Text("Company Details", style = MaterialTheme.typography.headlineSmall)
            Text(
                if (profile.profileComplete) "Company profile complete." else "Complete these details before adding Managers or Sales employees.",
                color = if (profile.profileComplete) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
            )
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Company logo", style = MaterialTheme.typography.titleMedium)
                Text(
                    if (profile.hasLogo) "Company logo uploaded." else "Logo is optional. Upload JPG, PNG or WebP up to 5 MB.",
                    style = MaterialTheme.typography.bodySmall,
                )
                OutlinedButton(
                    onClick = { logoPicker.launch("image/*") },
                    enabled = !state.uploadingLogo && !state.saving,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        when {
                            state.uploadingLogo -> "Uploading logo…"
                            profile.hasLogo -> "Change company logo"
                            else -> "Upload company logo"
                        }
                    )
                }
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
                OutlinedTextField(alternatePhone, { alternatePhone = it }, Modifier.fillMaxWidth(), label = { Text("Alternate phone (optional)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
                OutlinedTextField(website, { website = it }, Modifier.fillMaxWidth(), label = { Text("Website (optional)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
                OutlinedTextField(gstin, { gstin = it.uppercase().take(15) }, Modifier.fillMaxWidth(), label = { Text("GSTIN (optional)") }, singleLine = true)
                OutlinedTextField(pan, { pan = it.uppercase().take(10) }, Modifier.fillMaxWidth(), label = { Text("PAN (optional)") }, singleLine = true)
                OutlinedTextField(registration, { registration = it }, Modifier.fillMaxWidth(), label = { Text("Registration number (optional)") }, singleLine = true)
                Text("Sales Team Structure", style = MaterialTheme.typography.titleMedium)
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    listOf(TeamStructure.MANAGERS_AND_SALES to "Admin → Managers → Sales", TeamStructure.SALES_ONLY to "Admin → Sales").forEachIndexed { index, (value, label) ->
                        SegmentedButton(selected = structure == value, onClick = { structure = value }, shape = SegmentedButtonDefaults.itemShape(index, 2)) { Text(label) }
                    }
                }
                Text(if (structure == TeamStructure.SALES_ONLY) "Manager creation and assignment are disabled." else "Managers can supervise Sales employees.", style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(description, { description = it.take(2000) }, Modifier.fillMaxWidth(), label = { Text("Company description (optional)") }, minLines = 3)
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
                                alternatePhone = alternatePhone.trim().ifBlank { null },
                                website = website.trim().ifBlank { null },
                                gstin = gstin.trim().ifBlank { null },
                                pan = pan.trim().ifBlank { null },
                                registrationNumber = registration.trim().ifBlank { null },
                                description = description.trim().ifBlank { null },
                                teamStructure = structure,
                            )
                        ) { saved ->
                            if (saved.profileComplete) onComplete?.invoke()
                        }
                    },
                    enabled = valid && !state.saving && !state.uploadingLogo,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (state.saving) "Saving…" else "Save and continue")
                }
            }
        }
        state.error?.let { item { MessageBanner(it) { vm.load() } } }
        state.message?.let { message ->
            item {
                ContentCard("Saved", message) {
                    if (profile.profileComplete && onComplete != null) {
                        Button(onClick = onComplete, modifier = Modifier.fillMaxWidth()) { Text("Continue to Employees") }
                    }
                }
            }
        }
    }
}
