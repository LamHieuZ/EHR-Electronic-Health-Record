# Electronic Health Record (EHR) - Blockchain Based Platform

A decentralized healthcare system for secure management of electronic health records using **Hyperledger Fabric**. The platform enables patients, doctors, hospitals, pharmacies, insurance companies, and researchers to interact with medical data through role-based access control on an immutable blockchain ledger.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | Hyperledger Fabric 2.x, Fabric CA, CouchDB |
| **Smart Contract** | JavaScript Chaincode (Fabric Contract API 2.5) |
| **Backend** | Node.js 18+, Express 5.x, Fabric Network SDK 2.2 |
| **Frontend** | React 18, Vite 5, Tailwind CSS 3.4, React Router 6, Axios |
| **Explorer** | Hyperledger Explorer, PostgreSQL |
| **Infrastructure** | Docker, Docker Compose |

## Architecture

Toàn bộ project chạy trong **WSL (Ubuntu)**. Trình duyệt trên Windows truy cập qua `localhost`.

```
┌──────────────────────────────────────────────────────────┐
│                     WSL / Ubuntu                          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │           Hyperledger Fabric Network               │  │
│  │   Org1 (Hospital) ◄──────────► Org2 (Insurance)   │  │
│  │   Peer: port 7051               Peer: port 9051    │  │
│  │   CouchDB: port 5984            CouchDB: 7984      │  │
│  │   CA: port 7054                 CA: port 8054      │  │
│  │               Channel: mychannel                   │  │
│  │            Chaincode: ehrChainCode                 │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │ crypto/certs (local)            │
│  ┌──────────────────────▼─────────────────────────────┐  │
│  │        Backend: Node.js + Express (port 5000)      │  │
│  │        Fabric Network SDK (đọc file trực tiếp)     │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │ REST API                        │
│  ┌──────────────────────▼─────────────────────────────┐  │
│  │         Frontend: React + Vite (port 3000)         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │     Hyperledger Explorer (port 8080) [optional]    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
              ▲ truy cập từ Windows browser qua localhost
```

## Project Structure

```
EHR-Hyperledger-Fabric-Project/
├── client/                        # React frontend (port 3000)
│   ├── src/
│   │   ├── pages/                 # Login, Dashboard, Records, AccessControl, ...
│   │   ├── components/            # Layout and shared UI components
│   │   ├── context/               # AuthContext (state management)
│   │   └── services/              # Axios API layer
│   └── vite.config.js             # Dev server config (proxy /api → :5000)
│
├── server-node-sdk/               # Express backend (port 5000)
│   ├── app.js                     # API routes and server entry point
│   ├── helper.js                  # Fabric gateway & user registration
│   ├── invoke.js                  # Chaincode invoke operations
│   ├── query.js                   # Chaincode query operations
│   ├── cert-script/               # Admin registration & onboarding scripts
│   └── wallet/                    # User identities & certificates
│
├── fabric-samples/
│   ├── test-network/              # Hyperledger Fabric network (Org1 + Org2)
│   └── asset-transfer-basic/
│       └── chaincode-javascript/  # EHR smart contract (ehrChainCode.js)
│
├── fabric-explorer/               # Blockchain explorer (port 8080)
└── install-fabric.sh              # Script to download Fabric binaries
```

## Prerequisites

Tất cả cài trong **WSL (Ubuntu 22.04)**:

- **Docker** & **Docker Compose**
- **Node.js** 18+
- **Git**

```bash
# Cài Node.js 18 trong WSL
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Setup & Installation

### 1. Download Fabric Binaries

```bash
./install-fabric.sh
```

### 2. Start the Blockchain Network

```bash
cd fabric-samples/test-network

# Khởi động network với Certificate Authority và CouchDB
./network.sh up createChannel -ca -s couchdb
```

### 3. Deploy the EHR Chaincode

```bash
./network.sh deployCC -ccn ehrChainCode \
  -ccp ../asset-transfer-basic/chaincode-javascript/ \
  -ccl javascript
```

### 4. Register Admins & Onboard Organizations

```bash
cd /home/lamhieu/EHR-Hyperledger-Fabric-Project/server-node-sdk/
npm install

# Đăng ký admin cho cả 2 org
node cert-script/registerHospitalAdmin.js
node cert-script/registerInsuranceAdmin.js

# Onboard các entity
node cert-script/onboardHospital01.js
node cert-script/onboardDoctor.js
node cert-script/onboardPharmacy.js
node cert-script/onboardInsuranceCompany.js
node cert-script/onboardInsuranceAgent.js
```

### 5. Start the Backend Server

```bash
cd /home/lamhieu/EHR-Hyperledger-Fabric-Project/server-node-sdk/
npm run dev    # http://localhost:5000
```

### 6. Start the Frontend

```bash
cd /home/lamhieu/EHR-Hyperledger-Fabric-Project/client/
npm install
npm run dev    # http://localhost:3000
```

Truy cập từ Windows browser: **http://localhost:3000**

### 7. (Optional) Start Blockchain Explorer

```bash
cd /home/lamhieu/EHR-Hyperledger-Fabric-Project/fabric-explorer/

# Copy crypto materials từ test-network
cp -r ../fabric-samples/test-network/organizations/ .

# Set environment variables
export EXPLORER_CONFIG_FILE_PATH=./config.json
export EXPLORER_PROFILE_DIR_PATH=./connection-profile
export FABRIC_CRYPTO_PATH=./organizations

# Khởi động Explorer
docker-compose up -d    # http://localhost:8080
```

## Shutdown

```bash
# Dừng Fabric Explorer
cd /home/lamhieu/EHR-Hyperledger-Fabric-Project/fabric-explorer/ && docker-compose down

# Dừng Fabric network (xóa toàn bộ container và crypto)
cd /home/lamhieu/EHR-Hyperledger-Fabric-Project/fabric-samples/test-network && ./network.sh down
```

## Key Features

### Patient Management
- Patient registration & authentication
- Personal health record dashboard
- Medical record creation, update, and history tracking

### Access Control
- Grant/revoke doctor access to patient records
- Role-based permissions across 8 actor types
- Full audit trail for all access events

### Prescriptions
- Create, manage, and verify prescriptions
- Pharmacy fulfillment tracking
- ICD-10 & ATC code validation

### Insurance Claims
- Submit claims linked to medical records
- Approval/rejection workflow for insurance agents
- Claim status tracking

### Research & Consent
- Researcher onboarding
- Patient consent management for data sharing
- Anonymized data access for approved research

### Emergency Access
- Emergency override mechanism for critical situations
- All emergency accesses are logged and auditable

### Rewards
- Issue rewards to patients for data sharing participation
- Reward claiming system

## Actors & Access Control

| # | Actor | Access Level |
|---|-------|-------------|
| 1 | **Government** | Network admin - full access |
| 2 | **Hospital** | Read/Write doctor data |
| 3 | **Doctor** | Read/Write patient data (within hospital scope) |
| 4 | **Diagnostics Center** | Read/Write diagnostic records |
| 5 | **Pharmacy** | Read/Write prescriptions |
| 6 | **Researcher** | Read anonymized data (with patient consent) |
| 7 | **Insurance Company** | Read/Write patient claims |
| 8 | **Patient** | Read/Write all own data |

## API Endpoints

Base URL: `http://localhost:5000`

> All endpoints use **POST** and expect a JSON body with **named parameters** (not positional arrays).

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/registerPatient` | Register new patient |
| POST | `/loginPatient` | Patient login |

### Medical Records
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/addRecord` | Create medical record |
| POST | `/updateRecord` | Update existing record |
| POST | `/getRecordById` | Get specific record |
| POST | `/getAllRecordsByPatientId` | Get all records for a patient |
| POST | `/queryHistoryOfAsset` | Get record transaction history |

### Access Control
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/grantAccess` | Grant doctor access to patient records |
| POST | `/revokeAccess` | Revoke doctor access |

### Prescriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/getPrescriptionsByPatient` | Get prescriptions by patient |
| POST | `/verifyPrescription` | Verify a prescription |

### Insurance Claims
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/createClaim` | Submit insurance claim |
| POST | `/getClaim` | Get specific claim |
| POST | `/getClaimsByPatient` | Get all claims for a patient |
| POST | `/approveClaim` | Approve a claim |
| POST | `/rejectClaim` | Reject a claim |

### Research & Consent
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/onboardResearcher` | Register a researcher |
| POST | `/requestConsent` | Request patient consent |
| POST | `/approveConsent` | Approve consent |
| POST | `/getAnonymizedData` | Access anonymized data |

### Emergency
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/emergencyAccess` | Emergency record access |
| POST | `/getEmergencyLogs` | View emergency access logs |

### Rewards
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/issueReward` | Issue reward to patient |
| POST | `/claimReward` | Claim reward |
| POST | `/getRewardsByPatient` | Get patient rewards |

### Organization Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/onboardHospital` | Register hospital |
| POST | `/onboardDoctor` | Register doctor |
| POST | `/onboardPharmacy` | Register pharmacy |
| POST | `/onboardInsuranceCompany` | Register insurance company |
| POST | `/onboardInsuranceAgent` | Register insurance agent |
| POST | `/getAllHospitals` | List all hospitals |
| POST | `/getAllDoctors` | List all doctors |
| POST | `/getAllPharmacies` | List all pharmacies |
| POST | `/getAllInsuranceCompanies` | List all insurance companies |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/fetchLedger` | Fetch full ledger (admin only) |

## FHIR R4 API

Project hỗ trợ chuẩn **FHIR R4** (Fast Healthcare Interoperability Resources) — cho phép các hệ thống bên ngoài (HIS, phần mềm bảo hiểm, ứng dụng di động) đọc dữ liệu theo định dạng chuẩn quốc tế HL7.

Base URL FHIR: `http://localhost:5000/fhir`

> Tất cả FHIR endpoints dùng **GET**, response header `Content-Type: application/fhir+json`.

### FHIR Endpoints

| Method | Endpoint | FHIR Resource | Mô tả |
|--------|----------|---------------|-------|
| GET | `/fhir/metadata` | CapabilityStatement | Thông tin server FHIR |
| GET | `/fhir/Patient/:patientId` | Patient | Thông tin bệnh nhân |
| GET | `/fhir/Patient/:patientId/$everything` | Bundle | Toàn bộ dữ liệu bệnh nhân |
| GET | `/fhir/Observation/:patientId/:recordId` | Observation | Chẩn đoán (ICD-10) |
| GET | `/fhir/MedicationRequest/:patientId/:recordId` | MedicationRequest | Đơn thuốc (ATC) |
| GET | `/fhir/Claim/:patientId/:claimId` | Claim | Yêu cầu bảo hiểm |
| GET | `/fhir/Practitioner/:doctorId` | Practitioner | Thông tin bác sĩ |

---

### Ví dụ: Lấy thông tin bệnh nhân

**Request:**
```bash
GET /fhir/Patient/P001?userId=hospitalAdmin
```

**Response:**
```json
{
  "resourceType": "Patient",
  "id": "P001",
  "meta": { "lastUpdated": "2024-11-01T08:00:00.000Z" },
  "identifier": [
    { "system": "urn:ehr-blockchain:patient", "value": "P001" }
  ],
  "name": [{ "text": "Nguyen Van A" }],
  "birthDate": "1990-05-15",
  "address": [{ "city": "Ho Chi Minh" }]
}
```

---

### Ví dụ: Lấy chẩn đoán (Observation)

**Request:**
```bash
GET /fhir/Observation/P001/R-abc123?userId=D001
```

**Response:**
```json
{
  "resourceType": "Observation",
  "id": "R-abc123",
  "status": "final",
  "code": {
    "coding": [
      {
        "system": "http://hl7.org/fhir/sid/icd-10",
        "code": "J11.1",
        "display": "Influenza with other respiratory manifestations"
      }
    ]
  },
  "subject": { "reference": "Patient/P001" },
  "performer": [{ "reference": "Practitioner/D001" }],
  "effectiveDateTime": "2024-11-01T08:00:00.000Z"
}
```

---

### Ví dụ: Lấy đơn thuốc (MedicationRequest)

**Request:**
```bash
GET /fhir/MedicationRequest/P001/R-abc123?userId=D001
```

**Response:**
```json
{
  "resourceType": "MedicationRequest",
  "id": "R-abc123-med-0",
  "status": "active",
  "intent": "order",
  "subject": { "reference": "Patient/P001" },
  "requester": { "reference": "Practitioner/D001" },
  "medicationCodeableConcept": {
    "coding": [
      {
        "system": "http://www.whocc.no/atc",
        "code": "N02BE01",
        "display": "Paracetamol"
      }
    ]
  },
  "dosageInstruction": [
    {
      "text": "500mg oral 3x/day",
      "route": { "coding": [{ "display": "oral" }] },
      "doseAndRate": [
        { "doseQuantity": { "value": 500, "unit": "mg" } }
      ]
    }
  ]
}
```

---

### Ví dụ: Bundle toàn bộ dữ liệu bệnh nhân (`$everything`)

**Request:**
```bash
GET /fhir/Patient/P001/$everything?userId=hospitalAdmin
```

**Response:**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 4,
  "entry": [
    {
      "fullUrl": "urn:uuid:Patient/P001",
      "resource": { "resourceType": "Patient", "id": "P001", "..." }
    },
    {
      "fullUrl": "urn:uuid:Observation/R-abc123",
      "resource": { "resourceType": "Observation", "id": "R-abc123", "..." }
    },
    {
      "fullUrl": "urn:uuid:MedicationRequest/R-abc123-med-0",
      "resource": { "resourceType": "MedicationRequest", "id": "R-abc123-med-0", "..." }
    }
  ]
}
```

---

### Ví dụ: Yêu cầu bảo hiểm (Claim)

**Request:**
```bash
GET /fhir/Claim/P001/CLM-001?userId=insuranceAgent-Rama
```

**Response:**
```json
{
  "resourceType": "Claim",
  "id": "CLM-001",
  "status": "active",
  "type": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/claim-type",
        "code": "professional",
        "display": "outpatient"
      }
    ]
  },
  "patient": { "reference": "Patient/P001" },
  "created": "2024-11-02T10:00:00.000Z",
  "total": { "value": 1500000, "currency": "VND" }
}
```

---

### Ví dụ: CapabilityStatement

**Request:**
```bash
GET /fhir/metadata
```

**Response (tóm tắt):**
```json
{
  "resourceType": "CapabilityStatement",
  "status": "active",
  "fhirVersion": "4.0.1",
  "format": ["json"],
  "rest": [{
    "mode": "server",
    "resource": [
      { "type": "Patient", "interaction": [{ "code": "read" }] },
      { "type": "Observation", "interaction": [{ "code": "read" }] },
      { "type": "MedicationRequest", "interaction": [{ "code": "read" }] },
      { "type": "Claim", "interaction": [{ "code": "read" }] },
      { "type": "Practitioner", "interaction": [{ "code": "read" }] }
    ]
  }]
}
```

---

## Data Validation Standards

- **ICD-10** codes for diagnosis (format: A00 – Z99.9)
- **ATC** codes for medications
- Medication dosage and unit validation
- Route of administration validation (oral, IV, IM, subcutaneous, etc.)

## Troubleshooting

**Backend không kết nối được Fabric peers**
- Kiểm tra Fabric network đang chạy: `docker ps` trong WSL.
- Sau mỗi lần `./network.sh down` + `up`, phải chạy lại `registerOrg1Admin.js` / `registerOrg2Admin.js` vì crypto materials mới được tạo lại.

**Lỗi `wallet/` khi khởi động backend**
- Xóa thư mục `server-node-sdk/wallet/` và chạy lại các script đăng ký admin.

**Frontend trắng hoặc lỗi API**
- Kiểm tra backend đang chạy trên port 5000.
- Vite proxy `/api` → `http://localhost:5000`; kiểm tra console browser nếu có lỗi CORS.

**Chaincode endorsement failures**
- Đảm bảo chaincode đã được deploy lên **cả 2** peer của Org1 và Org2.

**Không truy cập được từ Windows browser**
- WSL2 tự động forward port — truy cập `http://localhost:3000` từ Windows là đủ.
- Nếu không được, kiểm tra `wsl hostname -I` để lấy WSL IP và truy cập trực tiếp.

## License

Apache 2.0 — see [LICENSE](LICENSE).
