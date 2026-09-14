package com.mediconnect.nativeapp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TriStateCheckbox
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.unit.dp

@Composable
fun PatientSettingsForm(state: SettingsState, content: MobileContent, edit: (PatientSettingsDraft) -> Unit,
                        save: () -> Unit, discard: () -> Unit, reload: () -> Unit, close: () -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(content.label("settings", "title"), style = MaterialTheme.typography.headlineSmall)
        Text(content.label("settingsStatus", state.step.name))
        val draft = state.draft
        if (draft != null && state.snapshot != null) {
            OutlinedTextField(draft.name, { edit(draft.copy(name = it)) }, label = { Text(content.text("fullName")) },
                enabled = state.editable, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(state.snapshot.email, {}, readOnly = true, label = { Text(content.text("email")) },
                supportingText = { Text(content.label("settings", "emailReadOnly")) }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(draft.phone.orEmpty(), { edit(draft.copy(phone = it)) }, label = { Text(content.label("settings", "phone")) },
                enabled = state.editable, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(draft.address.orEmpty(), { edit(draft.copy(address = it)) }, label = { Text(content.label("settings", "address")) },
                enabled = state.editable, modifier = Modifier.fillMaxWidth())
            for (key in PatientSettingsData.preferenceNames()) {
                val value = draft.preferences?.get(key)
                val label = content.label("settingsPreferences", key)
                Column {
                    Text(label)
                    if (value == null) Text(content.label("settings", "unset"))
                    TriStateCheckbox(state = when (value) { true -> ToggleableState.On; false -> ToggleableState.Off; null -> ToggleableState.Indeterminate },
                        onClick = { edit(draft.copy(preferences = draft.preferences.orEmpty() + (key to (value != true)))) },
                        enabled = state.editable, modifier = Modifier.semantics { contentDescription = label })
                }
            }
            if (state.invalid) Text(content.label("settings", "invalid"), color = MaterialTheme.colorScheme.error)
            Button(onClick = save, enabled = state.editable) { Text(content.label("settings", "save")) }
            TextButton(onClick = discard, enabled = state.editable) { Text(content.label("settings", "discard")) }
        }
        if (!state.busy && !state.editable) Button(onClick = reload) { Text(content.label("settings", "reload")) }
        TextButton(onClick = close) { Text(content.label("settings", "close")) }
    }
}
