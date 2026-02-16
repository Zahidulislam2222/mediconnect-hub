# 🏥 MediConnect V2: Enterprise Multi-Cloud Telemedicine Ecosystem

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Security](https://img.shields.io/badge/Security-HIPAA%20Compliant-green.svg)
![Compliance](https://img.shields.io/badge/Compliance-GDPR%20Ready-blue.svg)
![Architecture](https://img.shields.io/badge/Architecture-Zero--Cost%20Idle-orange.svg)
![IaC](https://img.shields.io/badge/IaC-Terraform-623CE4.svg)
![Standard](https://img.shields.io/badge/Standard-HL7%20FHIR%20R4-red)

> **Architected by [Zahidul Islam](https://www.linkedin.com/in/zahidul-islam-developer/)**

**MediConnect V2** is a state-of-the-art healthcare platform engineered for maximum security, regulatory compliance, and extreme cost-efficiency. By leveraging a **Triple-Cloud Strategy (AWS, GCP, Azure)** orchestrated via **Terraform**, the system achieves a **"Zero-Cost Idle"** state, scaling down to zero compute consumption when not in use.

---

## 🌐 The "Triple-Cloud" Zero-Cost Architecture

MediConnect strategically splits workloads across the "Big Three" cloud providers to maximize Free Tier offerings, leverage specialized medical AI services, and ensure disaster recovery.

| Provider | Role | Key Components | Zero-Cost Logic |
| :--- | :--- | :--- | :--- |
| **AWS** | **Security & Identity Hub** | Cognito, DynamoDB, SSM, KMS | Free Tier (50k MAU) + On-Demand Database Billing |
| **GCP** | **Relational Heart** | Cloud Run, Cloud SQL (Postgres) | **Scale-to-Zero** Containers + Auto-Pause Database |
| **Azure** | **Clinical Intelligence** | Container Apps, Cosmos DB | **Scale-to-Zero** Replicas + Serverless Request Mode |

---

## 🛡️ Compliance, Security & Interoperability

This platform is "Secure by Design," satisfying strict international data laws for PHI (Protected Health Information).

### 🩺 HIPAA (Health Insurance Portability and Accountability Act)
*   **Immutable Audit Logs:** A custom middleware intercepts every request and writes a "Write-Once-Read-Many" log to DynamoDB, tracking *who* accessed *what* record and *when*.
*   **Recursive PII Scrubbing:** All server logs pass through a sanitizer engine that regex-matches and masks SSNs, Emails, and Credit Card numbers before logging.
*   **Encryption:** 
    *   **At Rest:** AES-256 encryption enforced on all databases (AWS/GCP/Azure).
    *   **In Transit:** Strict TLS 1.3 enforcement for all cross-cloud API communication.
*   **Digital Signatures:** E-Prescriptions are cryptographically signed using **AWS KMS**, creating a tamper-proof legal seal.

### 🇪🇺 GDPR (General Data Protection Regulation)
*   **Right to be Forgotten:** Automated workflows allow for "Soft Deletion" where PII is anonymized (e.g., `User_123` becomes `Deleted_User_X`), preserving statistical integrity while respecting user privacy.

### 🏥 HL7 FHIR R4 Interoperability
*   **Standardized Data:** All backend services map internal data models to **HL7 FHIR R4** resources (`Patient`, `Appointment`, `DiagnosticReport`), ensuring the platform can natively integrate with hospital EHR systems (Epic, Cerner).

---

## 🛠️ Infrastructure as Code (Terraform)

The entire ecosystem is provisioned using **Terraform**, ensuring the multi-cloud environment is reproducible, version-controlled, and disaster-proof.

*   **Multi-Provider Orchestration:** A single `terraform apply` manages resources across AWS, GCP, and Azure simultaneously.
*   **Modular Design:** Networking, Compute, and Database layers are decoupled for independent scaling.
*   **Secret Management:** Terraform automates the provisioning of the **AWS SSM Parameter Store**, creating a centralized, encrypted vault for all API keys and database credentials. No `.env` files are used in production.

---

## 💻 Tech Stack & Microservices

### 🧩 Microservices Architecture
1.  **Patient Service (GCP Cloud Run):** Handles identity verification, appointment booking, and real-time IoT Vital ingestion.
2.  **Doctor Service (Azure Container Apps):** Manages credentialing, officer approvals, and doctor availability schedules.
3.  **Communication Hub (Serverless):** Manages secure Video Consultations (WebRTC) and AI-powered Chat.

### ⚙️ Core Technologies
*   **IaC:** Terraform
*   **Backend:** Node.js (TypeScript), Express, Python (AI Agents)
*   **Frontend:** React (Vite), Tailwind CSS, Shadcn UI
*   **Mobile:** Capacitor (Cross-platform iOS/Android)
*   **AI/ML:** AWS Bedrock (Claude), Google Vertex AI (Gemini), Azure OpenAI
*   **DevOps:** Docker, GitHub Actions, Google Cloud Build

---

## 🚀 The Migration Story

MediConnect represents a successful migration from a legacy monolith to a modern distributed system using the **Strangler Fig Pattern**.

*   **From:** High-cost, static architecture (AWS EKS + RDS Always-On). **Cost: ~$300/mo.**
*   **To:** Event-driven, serverless ecosystem. **Cost: $0.00/mo (Idle).**
*   **The Bridge:** A custom Python migration container moved terabytes of data from legacy DynamoDB tables to GCP PostgreSQL and Azure Cosmos DB with zero downtime.

---

## 📂 Project Structure

```bash
mediconnect-v2/
├── terraform/               # IaC Configuration
│   ├── main.tf              # Multi-cloud provider setup
│   ├── aws/                 # AWS Modules (Cognito, DynamoDB)
│   ├── gcp/                 # GCP Modules (Cloud Run, SQL)
│   └── azure/               # Azure Modules (Container Apps)
├── backend/
│   ├── patient-service/     # Node.js/TypeScript
│   ├── doctor-service/      # Node.js/TypeScript
│   └── shared/              # HIPAA Logger & FHIR Mappers
├── frontend/                # React + Vite + Capacitor
├── scripts/
│   ├── deploy_gcp.sh        # Deployment orchestration
│   └── deploy_azure.sh
└── docker-compose.yml       # Local development orchestration

👨‍💻 Getting Started
Prerequisites
Node.js v18+
Docker & Docker Compose
Terraform CLI
AWS/GCP/Azure CLI tools installed
1. Infrastructure Provisioning
code Bash
downloadcontent_copy
expand_less
cd terraform
terraform init
terraform plan
terraform apply
2. Local Development
code Bash
downloadcontent_copy
expand_less
# Install dependencies
npm install

# Start the local development cluster (Hot Reloading)
npm run dev
```
📄 License & Contact
This project is open-source and licensed under the MIT License.
Architected by Muhammad Zahidul Islam
LinkedIn Profile | GitHub Profile
