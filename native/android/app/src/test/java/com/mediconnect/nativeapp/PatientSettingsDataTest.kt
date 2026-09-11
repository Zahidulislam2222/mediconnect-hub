package com.mediconnect.nativeapp

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class PatientSettingsDataTest {
    private val identity = Identity("test-patient", Role.PATIENT, Instant.now().plusSeconds(300))
    private fun row() = JSONObject().put("patientId", identity.subject).put("name", "Test person").put("email", "test@example.test")
    private fun decode(value: JSONObject) = PatientSettingsData.decode(value, identity, "patientId")
    @Test fun absentValuesStayAbsentAndUnchangedDraftSendsNothing() {
        val snapshot = decode(row())
        assertNull(snapshot.phone); assertNull(snapshot.address); assertNull(snapshot.preferences)
        assertEquals(0, PatientSettingsData.changes(snapshot, PatientSettingsDraft(snapshot), 200).length())
        assertEquals(snapshot, decode(row().put("phone", JSONObject.NULL).put("preferences", JSONObject.NULL)))
    }
    @Test fun malformedFieldsAndForeignIdentityAreRejectedWithoutCoercion() {
        for (key in listOf("patientId", "name", "email", "phone", "address")) {
            assertThrows(IllegalArgumentException::class.java) { decode(row().put(key, 1)) }
        }
        assertThrows(IllegalArgumentException::class.java) { decode(row().put("patientId", "other")) }
        assertThrows(IllegalArgumentException::class.java) {
            PatientSettingsData.decode(row(), identity.copy(role = Role.DOCTOR), "patientId")
        }
    }
    @Test fun preferencesAreStrictAndMissingChoicesAreNotInvented() {
        assertEquals(mapOf("email" to false), decode(row().put("preferences", JSONObject().put("email", false))).preferences)
        for (value in listOf("true", 1, JSONObject.NULL)) {
            assertThrows(IllegalArgumentException::class.java) { decode(row().put("preferences", JSONObject().put("email", value))) }
        }
        assertThrows(IllegalArgumentException::class.java) { decode(row().put("preferences", JSONObject().put("unknown", true))) }
    }
    @Test fun updatesContainOnlyChangedEditableValues() {
        val snapshot = decode(row().put("preferences", JSONObject().put("email", false)))
        val draft = PatientSettingsDraft(snapshot).copy(phone = "", preferences = mapOf("email" to false, "sms" to true))
        val changes = PatientSettingsData.changes(snapshot, draft, 200)
        assertEquals(setOf("phone", "preferences"), changes.keys().asSequence().toSet())
        assertFalse(changes.getJSONObject("preferences").getBoolean("email"))
        assertTrue(changes.getJSONObject("preferences").getBoolean("sms"))
        assertFalse(changes.getJSONObject("preferences").has("promotional"))
    }
    @Test fun invalidEditsCannotEraseKnownChoicesOrExceedConfiguredNameBound() {
        val snapshot = decode(row().put("preferences", JSONObject().put("email", false)))
        for (draft in listOf(PatientSettingsDraft(snapshot).copy(name = " "),
            PatientSettingsDraft(snapshot).copy(name = "😀"), PatientSettingsDraft(snapshot).copy(preferences = emptyMap()))) {
            assertThrows(IllegalArgumentException::class.java) { PatientSettingsData.changes(snapshot, draft, 1) }
        }
        assertThrows(IllegalArgumentException::class.java) {
            PatientSettingsData.changes(snapshot, PatientSettingsDraft(snapshot).copy(preferences = emptyMap()), 200)
        }
    }
}
