package com.mediconnect.nativeapp

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonNull
import com.google.gson.JsonObject
import com.google.gson.JsonPrimitive
import com.google.gson.Strictness
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonToken
import java.io.StringReader
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.Base64
import java.util.UUID

/** The supported portability profile wraps application collections in FHIR Binary resources. */
object PatientExportBundle {
    fun verifiedBytes(response: NativeResponse, identity: Identity, contract: PatientExportContract,
                      subjectField: String, maxBytes: Long): ByteArray {
        try {
            require(identity.role == Role.PATIENT && identity.subject.isNotBlank() && identity.expiresAt > Instant.now())
            val bytes = ExportIntegrity.verifiedBytes(response)
            require(maxBytes > 0 && bytes.size <= maxBytes)
            val bundle = StrictExportJson.read(bytes, contract.maxJsonDepth).asJsonObject
            require(bundle.keySet() == setOf("resourceType", "type", "timestamp", "entry"))
            require(bundle.string("resourceType") == "Bundle" && bundle.string("type") == "collection")
            Instant.parse(bundle.string("timestamp"))
            val entries = bundle.getAsJsonArray("entry")
            require(entries.size() == contract.collections.size)
            val identifiers = mutableSetOf<String>()
            val collections = mutableSetOf<String>()
            for (element in entries) {
                val entry = element.asJsonObject
                require(entry.keySet() == setOf("fullUrl", "resource"))
                val resource = entry.getAsJsonObject("resource")
                require(resource.keySet() == setOf("resourceType", "id", "contentType", "data"))
                require(resource.string("resourceType") == "Binary" && resource.string("contentType") == "application/json")
                val id = resource.string("id")
                require(UUID.fromString(id).toString() == id && identifiers.add(id))
                require(entry.string("fullUrl") == "urn:uuid:$id")
                val encoded = resource.string("data")
                val decoded = Base64.getDecoder().decode(encoded)
                require(Base64.getEncoder().encodeToString(decoded) == encoded)
                val collection = StrictExportJson.read(decoded, contract.maxJsonDepth).asJsonObject
                require(collection.keySet() == setOf("collection", "records"))
                val name = collection.string("collection")
                require(name in contract.collections && collections.add(name))
                val records = collection.get("records")
                if (name == contract.ownerCollection) {
                    require(records.asJsonObject.string(subjectField) == identity.subject)
                } else require(records.isJsonArray)
            }
            require(collections == contract.collections)
            return bytes
        } catch (_: Exception) { throw ApiFailure() }
    }

    private fun JsonObject.string(name: String): String {
        val value = get(name)
        require(value != null && value.isJsonPrimitive && value.asJsonPrimitive.isString)
        return value.asString
    }
}

/** Strict UTF-8/JSON with duplicate-member and nesting checks, without recursive parsing. */
private object StrictExportJson {
    private class Frame(val value: JsonElement, var name: String? = null)

    fun read(bytes: ByteArray, maxDepth: Int): JsonElement {
        require(maxDepth > 0)
        val text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString()
        val stack = mutableListOf<Frame>()
        var root: JsonElement? = null
        fun attach(value: JsonElement) {
            val parent = stack.lastOrNull()
            if (parent == null) { require(root == null); root = value }
            else if (parent.value.isJsonArray) parent.value.asJsonArray.add(value)
            else {
                val name = requireNotNull(parent.name)
                require(!parent.value.asJsonObject.has(name))
                parent.value.asJsonObject.add(name, value); parent.name = null
            }
        }
        JsonReader(StringReader(text)).use { reader ->
            reader.strictness = Strictness.STRICT
            while (true) {
                when (reader.peek()) {
                    JsonToken.BEGIN_OBJECT -> {
                        reader.beginObject(); val value = JsonObject(); attach(value); stack.add(Frame(value))
                        require(stack.size <= maxDepth)
                    }
                    JsonToken.BEGIN_ARRAY -> {
                        reader.beginArray(); val value = JsonArray(); attach(value); stack.add(Frame(value))
                        require(stack.size <= maxDepth)
                    }
                    JsonToken.END_OBJECT -> { reader.endObject(); require(stack.removeAt(stack.lastIndex).name == null) }
                    JsonToken.END_ARRAY -> { reader.endArray(); stack.removeAt(stack.lastIndex) }
                    JsonToken.NAME -> {
                        val name = scalarString(reader.nextName()); val parent = stack.last()
                        require(parent.name == null && !parent.value.asJsonObject.has(name)); parent.name = name
                    }
                    JsonToken.STRING -> attach(JsonPrimitive(scalarString(reader.nextString())))
                    JsonToken.NUMBER -> { val value = reader.nextDouble(); require(value.isFinite()); attach(JsonPrimitive(value)) }
                    JsonToken.BOOLEAN -> attach(JsonPrimitive(reader.nextBoolean()))
                    JsonToken.NULL -> { reader.nextNull(); attach(JsonNull.INSTANCE) }
                    JsonToken.END_DOCUMENT -> break
                    else -> throw ApiFailure()
                }
            }
        }
        require(stack.isEmpty())
        return requireNotNull(root)
    }

    private fun scalarString(value: String): String {
        var index = 0
        while (index < value.length) {
            val character = value[index++]
            if (Character.isHighSurrogate(character)) {
                require(index < value.length && Character.isLowSurrogate(value[index++]))
            } else require(!Character.isLowSurrogate(character))
        }
        return value
    }
}
