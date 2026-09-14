package com.mediconnect.nativeapp

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

@Composable
fun PatientExportActions(state: ExportState, content: MobileContent, download: () -> Unit, save: () -> Unit) {
    if (state.step == ExportStep.CLOSED) return
    Column {
        Text(content.label("export", "title"), style = MaterialTheme.typography.titleMedium)
        Text(content.label("export", "privacy"))
        Text(content.label("exportStatus", state.step.name))
        if (state.step in setOf(ExportStep.IDLE, ExportStep.CANCELLED, ExportStep.FAILED, ExportStep.SAVED)) {
            Button(onClick = download) { Text(content.label("export", "download")) }
        }
        if (state.step == ExportStep.READY) {
            Button(onClick = save) { Text(content.label("export", "save")) }
        }
    }
}
