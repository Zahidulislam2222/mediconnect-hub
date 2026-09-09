package com.mediconnect.nativeapp

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

class MainActivity : ComponentActivity() {
    private val model: WorkspaceModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        enableEdgeToEdge()
        setContent {
            val state by model.state.collectAsStateWithLifecycle()
            MobileTheme(model.content) {
                WorkspaceScreen(state, model.content, model.configured, BuildConfig.RESIDENCY,
                    model::signIn, model::confirm, model::signOut, model::refresh)
            }
        }
    }
    override fun onStart() { super.onStart(); model.resume() }
    override fun onStop() { model.hide(); super.onStop() }
}

@Composable
fun MobileTheme(content: MobileContent, children: @Composable () -> Unit) {
    fun color(key: String) = Color(android.graphics.Color.parseColor(content.label("theme", key)))
    MaterialTheme(colorScheme = lightColorScheme(
        primary = color("accent"), onPrimary = color("onAccent"), background = color("background"),
        onBackground = color("foreground"), surface = color("surface"), onSurface = color("foreground"),
        onSurfaceVariant = color("muted"), error = color("error"),
    ), content = children)
}

@Composable
fun WorkspaceScreen(state: WorkspaceState, content: MobileContent, configured: Boolean, residency: String,
                    signIn: (String, String) -> Unit, confirm: (String) -> Unit,
                    signOut: () -> Unit, refresh: (Boolean) -> Unit) {
    Scaffold { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(content.text("brand"), style = MaterialTheme.typography.headlineLarge)
                    Text(content.text("tagline"), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(content.label("residency", residency), style = MaterialTheme.typography.labelLarge)
                }
            }
            if (!state.visible) return@LazyColumn
            if (!configured) {
                item { Text(content.text("configurationUnavailable")) }
                return@LazyColumn
            }
            state.error?.let { key -> item { Text(content.text(key), color = MaterialTheme.colorScheme.error) } }
            if (state.identity == null) {
                item { SignInForm(state, content, signIn, confirm, signOut) }
            } else {
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(content.label("roles", state.identity.role.key), style = MaterialTheme.typography.titleLarge)
                        TextButton(onClick = signOut) { Text(content.text("signOut")) }
                    }
                }
                if (state.identity.role == Role.PATIENT || state.identity.role == Role.DOCTOR) {
                    item {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(content.text("appointments"), style = MaterialTheme.typography.headlineSmall)
                            TextButton(onClick = { refresh(false) }, enabled = !state.busy) { Text(content.text("refresh")) }
                        }
                    }
                    if (!state.busy && state.error == null && state.appointments.isEmpty()) {
                        item { Text(content.text("emptyAppointments")) }
                    }
                    items(state.appointments, key = { it.id }) { appointment -> AppointmentCard(appointment, content) }
                    if (state.next != null) item {
                        Button(onClick = { refresh(true) }, enabled = !state.busy) { Text(content.text("loadMore")) }
                    }
                } else item { Text(content.text("roleUnavailable")) }
            }
            if (state.busy) item { CircularProgressIndicator() }
        }
    }
}

@Composable
private fun SignInForm(state: WorkspaceState, content: MobileContent,
                       signIn: (String, String) -> Unit, confirm: (String) -> Unit, cancel: () -> Unit) {
    // Deliberately remember, not rememberSaveable: credentials must never enter saved instance state.
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (state.challenge) {
            OutlinedTextField(code, { code = it }, Modifier.fillMaxWidth(), enabled = !state.busy,
                label = { Text(content.text("code")) }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword))
            Button(onClick = { val value = code; code = ""; confirm(value) }, enabled = !state.busy && code.isNotBlank()) { Text(content.text("verify")) }
            TextButton(onClick = cancel) { Text(content.text("cancel")) }
        } else {
            OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), enabled = !state.busy,
                label = { Text(content.text("email")) }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
            OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), enabled = !state.busy,
                label = { Text(content.text("password")) }, singleLine = true, visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
            Button(onClick = { val value = password; password = ""; signIn(email, value) },
                enabled = !state.busy && email.isNotBlank() && password.isNotEmpty()) { Text(content.text("signIn")) }
        }
    }
}

@Composable
private fun AppointmentCard(appointment: Appointment, content: MobileContent) {
    val time = appointment.time?.atZone(ZoneId.systemDefault())?.format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM))
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(appointment.person ?: content.text("unknown"), style = MaterialTheme.typography.titleMedium)
            Text(time ?: content.text("unknown"))
            Text(appointment.status ?: content.text("unknown"), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
