package com.mediconnect.nativeapp

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp

@Composable
fun JourneyLibrary(journey: NativeJourney, kind: EditorialKind, onHome: () -> Unit) {
    val editorial = journey.editorial
    val copy = editorial.copy(kind)
    var query by rememberSaveable(kind) { mutableStateOf("") }
    var category by rememberSaveable(kind) { mutableStateOf<String?>(null) }
    var slug by rememberSaveable(kind) { mutableStateOf<String?>(null) }
    val listState = rememberLazyListState()
    val focus = LocalFocusManager.current
    BackHandler { if (slug != null) slug = null else onHome() }
    Scaffold { inset ->
        if (slug != null) {
            val article = editorial.article(kind, slug!!)
            LazyColumn(Modifier.fillMaxSize().padding(inset), contentPadding = PaddingValues(24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)) {
                item { TextButton(onClick = { slug = null }) { Text(copy.back) } }
                if (article == null) item { Text(editorial.notFound) }
                else {
                    item { Text("${article.category} · ${article.minutes} ${editorial.minutesRead}") }
                    item { EditorialHeading(article.title) }
                    item { Text(article.summary, style = MaterialTheme.typography.titleMedium) }
                    item { Text(copy.disclaimer, style = MaterialTheme.typography.bodyMedium) }
                    items(article.sections) { section ->
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            EditorialHeading(section.heading)
                            Text(section.body, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                    item { Text(journey.brand) }
                    item { TextButton(onClick = { slug = null }) { Text(copy.back) } }
                }
            }
        } else {
            val articles = editorial.filtered(kind, query, category)
            LazyColumn(Modifier.fillMaxSize().padding(inset), state = listState, contentPadding = PaddingValues(24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)) {
                item { TextButton(onClick = onHome) { Text(journey.home) } }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(copy.eyebrow, style = MaterialTheme.typography.labelLarge)
                        EditorialHeading(copy.title)
                        Text(copy.body, style = MaterialTheme.typography.bodyLarge)
                    }
                }
                if (kind == EditorialKind.KNOWLEDGE) {
                    item { OutlinedTextField(query, onValueChange = { query = it }, label = { Text(editorial.search) },
                        placeholder = { Text(editorial.placeholder) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(onSearch = { focus.clearFocus() })) }
                    item {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.semantics { contentDescription = editorial.categoriesLabel }) {
                            item { FilterChip(category == null, onClick = { category = null }, label = { Text(editorial.all) }) }
                            items(editorial.categories()) { value ->
                                FilterChip(category == value, onClick = { category = value }, label = { Text(value) })
                            }
                        }
                    }
                }
                item { Text("${articles.size} ${if (kind == EditorialKind.KNOWLEDGE) editorial.guides else editorial.stories}",
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }
                items(articles, key = { it.slug }) { article ->
                    Card(onClick = { slug = article.slug }, modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("${article.category} · ${article.minutes} ${editorial.minutesRead}")
                            EditorialHeading(article.title)
                            Text(article.summary)
                            Text(copy.read, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
                if (articles.isEmpty()) item {
                    Column {
                        EditorialHeading(editorial.empty)
                        Button(onClick = { query = ""; category = null }) { Text(editorial.clear) }
                    }
                }
                item { Text(copy.disclaimer, style = MaterialTheme.typography.bodyMedium) }
            }
        }
    }
}

@Composable
private fun EditorialHeading(text: String) {
    Text(text, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.semantics { heading() })
}
