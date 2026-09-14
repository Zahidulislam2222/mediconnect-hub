package com.mediconnect.nativeapp

import kotlinx.coroutines.ensureActive
import java.time.Instant
import kotlin.coroutines.coroutineContext

interface PatientExportService {
    suspend fun download(identity: Identity): ByteArray
}

class PatientExportApi(private val transport: NativeApi, private val contract: MobileContract,
                       private val maxResponseBytes: Long, private val sessions: SessionProvider) : PatientExportService {
    override suspend fun download(identity: Identity): ByteArray {
        if (identity.role != Role.PATIENT || identity.expiresAt <= Instant.now()) throw ApiFailure(403)
        val route = contract.profiles[Role.PATIENT] ?: throw ApiFailure(403)
        val response = transport.requestResponse(identity, route.service, contract.patientExport.path)
        coroutineContext.ensureActive()
        val bytes = PatientExportBundle.verifiedBytes(response, identity, contract.patientExport, route.subjectField, maxResponseBytes)
        coroutineContext.ensureActive()
        val current = sessions.fetch().identity
        coroutineContext.ensureActive()
        if (current.subject != identity.subject || current.role != identity.role ||
            current.expiresAt <= Instant.now() || identity.expiresAt <= Instant.now()) throw ApiFailure(403)
        return bytes
    }
}
