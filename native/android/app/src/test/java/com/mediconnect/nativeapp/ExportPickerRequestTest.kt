package com.mediconnect.nativeapp

import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class ExportPickerRequestTest {
    @Test fun outstandingRequestCannotBeReboundAfterSettingsReopen() {
        val request = ExportPickerRequest(); val old = UUID.randomUUID(); val replacement = UUID.randomUUID()
        assertEquals(old, request.begin { old })
        var selectedAgain = false
        assertNull(request.begin { selectedAgain = true; replacement })
        assertFalse(selectedAgain); assertEquals(old, request.finish())
        assertEquals(replacement, request.begin { replacement }); assertEquals(replacement, request.finish())
    }
    @Test fun recreatedActivityDrainsOldResultWithoutPatientTicketBeforeAnyNewLaunch() {
        val original = ExportPickerRequest(); original.begin { UUID.randomUUID() }
        val recreated = ExportPickerRequest(); recreated.restorePending(original.pending)
        assertNull(recreated.ticket)
        assertNull(recreated.begin { fail("Old result could be bound to new ticket"); UUID.randomUUID() })
        assertNull(recreated.finish()); assertFalse(recreated.pending)
        val fresh = UUID.randomUUID(); assertEquals(fresh, recreated.begin { fresh })
        assertEquals(fresh, recreated.finish()); assertNull(recreated.finish())
    }
    @Test fun rejectedSelectionDoesNotReserveLauncher() {
        val request = ExportPickerRequest()
        assertNull(request.begin { null }); assertFalse(request.pending)
        val valid = UUID.randomUUID(); assertEquals(valid, request.begin { valid })
    }
}
