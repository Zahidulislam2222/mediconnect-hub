package com.mediconnect.nativeapp

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics

@Composable
fun ProfileSetup(state: ProfileState, role: Role, content: MobileContent, policies: MobilePolicies,
                 accept: (Boolean) -> Unit, submit: (String, String, String) -> Unit, check: () -> Unit) {
    var name by remember(state.step) { mutableStateOf("") }
    var email by remember(state.step) { mutableStateOf("") }
    var specialization by remember(state.step) { mutableStateOf("") }
    Column {
        Text(content.text("profileSetup"))
        when (state.step) {
            ProfileStep.MISSING -> {
                Text(content.text("profileSetupInstructions"))
                OutlinedTextField(name, { name = it }, label = { Text(content.text("fullName")) }, enabled = !state.busy)
                OutlinedTextField(email, { email = it }, label = { Text(content.text("email")) }, enabled = !state.busy)
                if (role == Role.DOCTOR) OutlinedTextField(specialization, { specialization = it }, label = { Text(content.text("specialization")) }, enabled = !state.busy)
                PolicyLinks(policies, content)
                Text(policies.acceptance)
                Checkbox(state.accepted, accept, modifier = Modifier.semantics { contentDescription = policies.acceptance }, enabled = !state.busy)
                Button(onClick = { submit(name, email, specialization) }, enabled = !state.busy && state.accepted && name.isNotBlank()
                    && email.isNotBlank() && (role != Role.DOCTOR || specialization.isNotBlank())) { Text(content.text("saveProfile")) }
            }
            ProfileStep.FAILED -> {
                Text(content.text("profileCheckFailed"))
                Button(onClick = check, enabled = !state.busy) { Text(content.text("checkProfile")) }
            }
            ProfileStep.CHECKING -> Text(content.text("loading"))
            else -> Unit
        }
    }
}
