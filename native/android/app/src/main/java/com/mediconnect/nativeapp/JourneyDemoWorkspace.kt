package com.mediconnect.nativeapp

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp

@Composable
fun JourneyDemoWorkspace(journey: NativeJourney, state: DemoState, change: (DemoState) -> Unit, onHome: () -> Unit) {
    val content = journey.demo
    val copy = content.copy
    val sample = content.sample
    var guide by remember { mutableStateOf<String?>(null) }
    val focus = LocalFocusManager.current
    if (guide != null) {
        JourneyLibrary(journey, EditorialKind.KNOWLEDGE, initialSlug = guide) { guide = null }
        return
    }
    BackHandler { if (state.visit) change(state.copy(visit = false)) else onHome() }
    Scaffold { inset ->
        LazyColumn(Modifier.fillMaxSize().padding(inset).testTag("demo-workspace"),
            contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            item { TextButton(onClick = onHome) { Text(journey.home) } }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(copy.eyebrow)
                    DemoHeading(when (state.role) { DemoRole.PATIENT -> copy.patient; DemoRole.DOCTOR -> copy.doctor; DemoRole.STAFF -> copy.staff })
                    Button(onClick = { focus.clearFocus(); change(state.reset(content)) }) { Text(copy.reset) }
                }
            }
            item {
                Column(Modifier.semantics { contentDescription = content.workspaceLabel }) {
                    content.roles.forEach { role ->
                        FilterChip(state.role == role.id, onClick = { focus.clearFocus(); change(state.copy(role = role.id)) }, label = { Text(role.label) })
                    }
                }
            }
            item { Text(copy.notice) }
            if (state.visit) {
                item { Button(onClick = { change(state.copy(visit = false)) }) { Text(copy.close) } }
                item { JourneyPoster(journey.homePoster, journey.imageDescription) }
                item { Text(if (state.role == DemoRole.DOCTOR) sample.patient else sample.doctor); DemoHeading(copy.callTitle) }
                item {
                    Column {
                        FilterChip(state.mic, onClick = { change(state.copy(mic = !state.mic)) }, label = { Text(if (state.mic) copy.micOn else copy.micOff) })
                        FilterChip(state.camera, onClick = { change(state.copy(camera = !state.camera)) }, label = { Text(if (state.camera) copy.camOn else copy.camOff) })
                    }
                }
                item { Text(copy.callNotice) }
            } else {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(if (state.role == DemoRole.DOCTOR) copy.queue else copy.appointment)
                        Text(if (state.role == DemoRole.PATIENT) sample.doctorInitials else sample.patientInitials)
                        DemoHeading(if (state.role == DemoRole.PATIENT) sample.doctor else sample.patient)
                        Text(sample.appointment + " · " + if (state.role == DemoRole.STAFF) sample.doctor else content.tagline)
                        Text(sample.date + ", " + sample.year); Text(sample.timezone)
                        Text(state.slot, Modifier.testTag("demo-selected-slot"))
                        Text(copy.choose)
                        sample.slots.forEach { slot ->
                            FilterChip(state.slot == slot, onClick = { change(state.selectSlot(slot, content)) }, label = { Text(slot) })
                        }
                        Text(if (state.ready) copy.ready else copy.pending, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
                        if (state.role == DemoRole.STAFF) Button(onClick = { change(state.copy(ready = !state.ready)) }) { Text(copy.toggle) }
                        else Button(onClick = { focus.clearFocus(); change(state.copy(visit = true)) }) { Text(copy.consult) }
                    }
                }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        if (state.role == DemoRole.STAFF) {
                            val article = requireNotNull(journey.editorial.article(EditorialKind.KNOWLEDGE, copy.coordinationArticleSlug))
                            Text(journey.editorial.knowledgeLink); DemoHeading(article.title); Text(article.summary)
                        } else {
                            Text(copy.followup); DemoHeading(copy.notes)
                            if (state.role == DemoRole.DOCTOR) Text(state.note, Modifier.testTag("demo-saved-note"))
                            else {
                                OutlinedTextField(state.draft, onValueChange = { change(state.editNote(it, content)) },
                                    label = { Text(copy.notes) }, modifier = Modifier.fillMaxWidth().testTag("demo-note"), minLines = 4)
                                Text(copy.noteHint)
                                Button(onClick = { focus.clearFocus(); change(state.saveNote()) }) { Text(copy.save) }
                                if (state.saved) Text(copy.saved, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
                            }
                            Text(copy.followupBody)
                        }
                        Button(onClick = { focus.clearFocus(); guide = if (state.role == DemoRole.STAFF) copy.coordinationArticleSlug else copy.preparationArticleSlug }) {
                            Text(journey.editorial.knowledge.read)
                        }
                    }
                }
            }
        }
    }
}

@Composable private fun DemoHeading(value: String) {
    Text(value, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.semantics { heading() })
}
