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
            val recovery by model.recovery.state.collectAsStateWithLifecycle()
            val registration by model.registration.state.collectAsStateWithLifecycle()
            MobileTheme(model.content) {
                WorkspaceScreen(state, model.content, model.configured, BuildConfig.RESIDENCY,
                    model::signIn, model::confirm, model::signOut, model::refresh,
                    recovery, model::openRecovery, model.recovery::request, model.recovery::confirm, model.recovery::close,
                    model.policies, registration, model::openRegistration, model.registration::accept, model.registration::register,
                    model.registration::confirm, model.registration::resend, model.registration::close)
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
                    signOut: () -> Unit, refresh: (Boolean) -> Unit,
                    recovery: RecoveryState, openRecovery: () -> Unit, requestReset: (String) -> Unit,
                    confirmReset: (String, String) -> Unit, closeRecovery: () -> Unit,
                    policies: MobilePolicies, registration: RegistrationState, openRegistration: () -> Unit,
                    acceptTerms: (Boolean) -> Unit, register: (String, String, String) -> Unit,
                    confirmRegistration: (String) -> Unit, resendRegistration: () -> Unit, closeRegistration: () -> Unit) {
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
            item { PolicyLinks(policies, content) }
            if (!configured) {
                item { Text(content.text("configurationUnavailable")) }
                return@LazyColumn
            }
            if (registration.step != RegistrationStep.CLOSED) {
                item { RegistrationForm(registration, content, policies, acceptTerms, register, confirmRegistration, resendRegistration, closeRegistration) }
                return@LazyColumn
            }
            if (recovery.step != RecoveryStep.CLOSED) {
                item { RecoveryForm(recovery, content, requestReset, confirmReset, closeRecovery) }
                return@LazyColumn
            }
            state.error?.let { key -> item { Text(content.text(key), color = MaterialTheme.colorScheme.error) } }
            if (state.identity == null) {
                item { SignInForm(state, content, signIn, confirm, signOut, openRecovery, openRegistration) }
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
                       signIn: (String, String) -> Unit, confirm: (String) -> Unit, cancel: () -> Unit, openRecovery: () -> Unit, openRegistration: () -> Unit) {
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
            TextButton(onClick = { email = ""; password = ""; code = ""; openRegistration() }, enabled = !state.busy) {
                Text(content.text("createAccount"))
            }
            TextButton(onClick = { email = ""; password = ""; code = ""; openRecovery() }, enabled = !state.busy) {
                Text(content.text("forgotPassword"))
            }
        }
    }
}

@Composable
fun RecoveryForm(state: RecoveryState, content: MobileContent, request: (String) -> Unit,
                 confirm: (String, String) -> Unit, close: () -> Unit) {
    var email by remember(state.step) { mutableStateOf("") }
    var password by remember(state.step) { mutableStateOf("") }
    var code by remember(state.step) { mutableStateOf("") }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(content.text("recoveryTitle"), style = MaterialTheme.typography.headlineSmall)
        if (state.failed) Text(content.text("recoveryFailed"), color = MaterialTheme.colorScheme.error)
        when (state.step) {
            RecoveryStep.REQUEST -> {
                OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), enabled = !state.busy,
                    label = { Text(content.text("email")) }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
                Button(onClick = { val value = email; email = ""; request(value) }, enabled = !state.busy && email.isNotBlank()) {
                    Text(content.text("sendResetCode"))
                }
            }
            RecoveryStep.CONFIRM -> {
                Text(content.text("recoveryInstructions"))
                OutlinedTextField(code, { code = it }, Modifier.fillMaxWidth(), enabled = !state.busy,
                    label = { Text(content.text("code")) }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword))
                OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), enabled = !state.busy,
                    label = { Text(content.text("newPassword")) }, singleLine = true, visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
                Button(onClick = { val secret = password; val value = code; password = ""; code = ""; confirm(secret, value) },
                    enabled = !state.busy && code.isNotBlank() && password.isNotEmpty()) { Text(content.text("resetPassword")) }
            }
            RecoveryStep.COMPLETE -> Text(content.text("recoveryComplete"))
            RecoveryStep.CLOSED -> Unit
        }
        if (state.busy) CircularProgressIndicator()
        TextButton(onClick = { email = ""; password = ""; code = ""; close() }) { Text(content.text("backToSignIn")) }
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
