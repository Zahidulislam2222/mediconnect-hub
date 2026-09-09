package com.mediconnect.nativeapp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun PolicyLinks(policies: MobilePolicies, content: MobileContent) {
    var selected by remember { mutableStateOf<String?>(null) }
    Column {
        policies.pages.forEach { (key, page) ->
            TextButton(onClick = { selected = key }) { Text(page.title) }
        }
    }
    selected?.let { key ->
        val page = policies.pages.getValue(key)
        AlertDialog(onDismissRequest = { selected = null }, title = { Text(page.title) }, text = {
            LazyColumn(Modifier.heightIn(max = 480.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                item { Text(policies.notice) }
                page.sections.forEach { section -> item {
                    Column { Text(section.title, style = MaterialTheme.typography.titleSmall); Text(section.body) }
                } }
                page.sources.forEach { source -> item { Column { Text(source.label); Text(source.url) } } }
            }
        }, confirmButton = { TextButton(onClick = { selected = null }) { Text(content.text("close")) } })
    }
}

@Composable
fun RegistrationForm(state: RegistrationState, content: MobileContent, policies: MobilePolicies,
                     accept: (Boolean) -> Unit, register: (String, String, String) -> Unit,
                     confirm: (String) -> Unit, resend: () -> Unit, close: () -> Unit) {
    var name by remember(state.step) { mutableStateOf("") }
    var email by remember(state.step) { mutableStateOf("") }
    var password by remember(state.step) { mutableStateOf("") }
    var code by remember(state.step) { mutableStateOf("") }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(content.text("createAccount"), style = MaterialTheme.typography.headlineSmall)
        if (state.failed) Text(content.text("registrationFailed"), color = MaterialTheme.colorScheme.error)
        when (state.step) {
            RegistrationStep.DETAILS -> {
                OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), enabled = !state.busy,
                    label = { Text(content.text("fullName")) }, singleLine = true)
                OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), enabled = !state.busy,
                    label = { Text(content.text("email")) }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
                OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), enabled = !state.busy,
                    label = { Text(content.text("password")) }, singleLine = true, visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
                Text(policies.notice)
                PolicyLinks(policies, content)
                Row {
                    Checkbox(state.accepted, accept, modifier = Modifier.semantics { contentDescription = policies.acceptance }, enabled = !state.busy)
                    Text(policies.acceptance)
                }
                Button(onClick = {
                    val secret = password; password = ""; register(email, secret, name)
                }, enabled = !state.busy && state.accepted && name.isNotBlank() && email.isNotBlank() && password.isNotEmpty()) {
                    Text(content.text("register"))
                }
            }
            RegistrationStep.CONFIRM -> {
                Text(content.text("registrationInstructions"))
                OutlinedTextField(code, { code = it }, Modifier.fillMaxWidth(), enabled = !state.busy,
                    label = { Text(content.text("code")) }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword))
                Button(onClick = { val value = code; code = ""; confirm(value) }, enabled = !state.busy && code.isNotBlank()) {
                    Text(content.text("verify"))
                }
                TextButton(onClick = resend, enabled = !state.busy) { Text(content.text("resendCode")) }
                if (state.codeRequested) Text(content.text("registrationCodeRequested"))
            }
            RegistrationStep.COMPLETE -> Text(content.text("registrationComplete"))
            RegistrationStep.CLOSED -> Unit
        }
        if (state.busy) CircularProgressIndicator()
        TextButton(onClick = { name = ""; email = ""; password = ""; code = ""; close() }) { Text(content.text("backToSignIn")) }
    }
}
