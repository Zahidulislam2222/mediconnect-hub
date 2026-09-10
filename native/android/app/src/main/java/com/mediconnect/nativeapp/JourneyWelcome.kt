package com.mediconnect.nativeapp

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

@Composable
fun JourneyWelcome(journey: NativeJourney, onSignIn: () -> Unit) {
    var library by rememberSaveable { mutableStateOf<EditorialKind?>(null) }
    var demoVisible by remember { mutableStateOf(false) }
    var demoState by remember(journey) { mutableStateOf(journey.demo.initialState()) }
    val kind = library
    if (demoVisible) JourneyDemoWorkspace(journey, demoState, { demoState = it }) { demoVisible = false }
    else if (kind != null) JourneyLibrary(journey, kind) { library = null }
    else JourneyHome(journey, onSignIn, { library = it }) { role ->
        demoState = demoState.copy(role = role); demoVisible = true
    }
}

@Composable
private fun JourneyHome(journey: NativeJourney, onSignIn: () -> Unit, onLibrary: (EditorialKind) -> Unit, onDemo: (DemoRole) -> Unit) {
    Scaffold { inset ->
        LazyColumn(Modifier.fillMaxSize().padding(inset), contentPadding = PaddingValues(24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(journey.brand, style = MaterialTheme.typography.titleLarge)
                    Button(onClick = onSignIn) { Text(journey.login) }
                    Button(onClick = { onLibrary(EditorialKind.KNOWLEDGE) }) { Text(journey.editorial.knowledgeLink) }
                    Button(onClick = { onLibrary(EditorialKind.JOURNAL) }) { Text(journey.editorial.journalLink) }
                }
            }
            item { JourneyCopy(journey.hero) }
            item { JourneyPoster(journey.poster, journey.imageDescription) }
            item { Text(journey.illustration, style = MaterialTheme.typography.labelLarge) }
            items(journey.chapters.drop(1), key = { it.id }) { chapter ->
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(24.dp)) { JourneyCopy(chapter) }
                }
            }
            item { JourneyPoster(journey.homePoster, journey.imageDescription) }
            item { Text(journey.notice, style = MaterialTheme.typography.bodyMedium) }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(journey.demo.eyebrow)
                    Text(journey.demo.title, style = MaterialTheme.typography.headlineSmall)
                    Text(journey.demo.body)
                }
            }
            items(journey.demo.roles, key = { it.id.wire }) { role ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(role.number + " · " + role.label)
                        Text(role.title, style = MaterialTheme.typography.titleLarge)
                        Text(role.body)
                        Button(onClick = { onDemo(role.id) }) { Text(role.action) }
                    }
                }
            }
            item { Button(onClick = onSignIn) { Text(journey.login) } }
        }
    }
}

@Composable
private fun JourneyCopy(chapter: JourneyChapter) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(chapter.label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
        Text(chapter.title + "\n" + chapter.emphasis, style = MaterialTheme.typography.headlineLarge,
            modifier = Modifier.semantics { heading() })
        Text(chapter.body, style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
fun JourneyPoster(name: String, description: String) {
    val context = LocalContext.current
    val bitmap = remember(name) { runCatching {
        context.assets.open(name).use { BitmapFactory.decodeStream(it)?.asImageBitmap() }
    }.getOrNull() }
    if (bitmap != null) Image(bitmap, description, contentScale = ContentScale.Fit,
        modifier = Modifier.fillMaxWidth().aspectRatio(bitmap.width.toFloat() / bitmap.height).clip(RoundedCornerShape(24.dp)))
    else Text(description, style = MaterialTheme.typography.bodyMedium)
}
