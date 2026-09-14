package com.mediconnect.nativeapp

import java.util.UUID

/** One launcher request at a time. Only the non-sensitive pending flag survives recreation. */
class ExportPickerRequest {
    var pending = false
        private set
    var ticket: UUID? = null
        private set
    fun restorePending(value: Boolean) { pending = value; ticket = null }
    fun begin(select: () -> UUID?): UUID? {
        if (pending) return null
        val selected = select() ?: return null
        pending = true; ticket = selected
        return selected
    }
    fun finish(): UUID? {
        val selected = ticket
        pending = false; ticket = null
        return selected
    }
    companion object { const val savedStateKey = "export-picker-pending" }
}
