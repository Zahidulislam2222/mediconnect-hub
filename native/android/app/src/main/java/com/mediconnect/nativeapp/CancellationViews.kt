package com.mediconnect.nativeapp

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable

@Composable
fun CancellationDialog(state: CancellationState, content: MobileContent, confirm: () -> Unit, check: () -> Unit, close: () -> Unit) {
    if (state.step == CancellationStep.CLOSED) return
    AlertDialog(onDismissRequest = close, title = { Text(content.text("cancelAppointment")) }, text = {
        Column {
            state.appointment?.person?.let { Text(it) }
            when (state.step) {
                CancellationStep.CONFIRM -> Text(content.text("cancelConfirmation"))
                CancellationStep.PROCESSING -> CircularProgressIndicator()
                CancellationStep.CONFIRMED -> Text(content.text("cancellationConfirmed"))
                CancellationStep.UNCONFIRMED -> Text(content.text("cancellationUnconfirmed"))
                CancellationStep.CLOSED -> Unit
            }
        }
    }, confirmButton = {
        when (state.step) {
            CancellationStep.CONFIRM -> TextButton(onClick = confirm) { Text(content.text("confirmCancellation")) }
            CancellationStep.UNCONFIRMED -> TextButton(onClick = check) { Text(content.text("checkCancellation")) }
            else -> Unit
        }
    }, dismissButton = {
        TextButton(onClick = close) { Text(content.text(if (state.step == CancellationStep.CONFIRM) "keepAppointment" else "close")) }
    })
}
