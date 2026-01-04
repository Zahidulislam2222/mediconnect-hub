/**
 * Master Control for MediConnect Infrastructure
 * 
 * SET TO 'true': Shows the "Contact Admin" popup for expensive services.
 * SET TO 'false': Enables real AWS/GCP cloud connections.
 */
export const IS_DEMO_MODE = true;

export const GATED_SERVICES = {
    REAL_TIME_VIDEO: "AWS Chime Video Infrastructure",
    AI_SYMPTOM_CHECKER: "GCP Vertex AI Diagnosis Engine",
    IOT_VITAL_STREAM: "AWS IoT Core Real-time Stream",
    FINANCIAL_LEDGER: "AWS QLDB Immutable Audit Log",
    AI_RECORDS_ANALYSIS: "AWS Comprehend Medical Engine"
};