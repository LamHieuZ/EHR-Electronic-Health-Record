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
| **Infrastructure** | Docker, Docker Compose, WSL2 (Ubuntu 22.04) |

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
│                         │ REST API (/api proxy)           │
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
│   │   ├── pages/                 # Các trang theo role
│   │   │   ├── PatientDashboard.jsx
│   │   │   ├── DoctorDashboard.jsx
│   │   │   ├── AdminLedger.jsx    # hospitalAdmin + hospital view
│   │   │   ├── InsuranceClaims.jsx # insuranceAdmin + agent + patient
│   │   │   ├── PatientRecords.jsx
│   │   │   ├── AccessControl.jsx
│   │   │   ├── Prescriptions.jsx
│   │   │   ├── ResearchConsent.jsx
│   │   │   ├── EmergencyLogs.jsx
│   │   │   └── Rewards.jsx
│   │   ├── components/
│   │   │   └── Layout.jsx         # Sidebar nav theo role
│   │   ├── context/               # AuthContext (JWT state)
│   │   └── services/api.js        # Axios API layer
│   └── vite.config.js             # host: true (expose to Windows), proxy /api → :5000
│
├── server-node-sdk/               # Express backend (port 5000)
│   ├── app.js                     # API routes
│   ├── helper.js                  # Fabric gateway & user registration
│   ├── invoke.js                  # Chaincode invoke (write)
│   ├── query.js                   # Chaincode query (read)
│   ├── cert-script/               # Admin registration & onboarding scripts
│   └── wallet/                    # User identities & certificates
│
├── fabric-samples/
│   ├── test-network/              # Hyperledger Fabric network (Org1 + Org2)
│   └── asset-transfer-basic/
│       └── chaincode-javascript/
│           └── lib/ehrChainCode.js  # EHR smart contract
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

> Chạy lại lệnh này mỗi khi có thay đổi chaincode.

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

export EXPLORER_CONFIG_FILE_PATH=./config.json
export EXPLORER_PROFILE_DIR_PATH=./connection-profile
export FABRIC_CRYPTO_PATH=./organizations

docker-compose up -d    # http://localhost:8080
```

## Shutdown

```bash
# Dừng Fabric Explorer
cd /home/lamhieu/EHR-Hyperledger-Fabric-Project/fabric-explorer/ && docker-compose down

# Dừng Fabric network (xóa toàn bộ container và crypto)
cd /home/lamhieu/EHR-Hyperledger-Fabric-Project/fabric-samples/test-network && ./network.sh down
```

---

## Roles & Pages

| Role | Redirect | Trang chính |
|------|----------|-------------|
| `patient` | `/dashboard` | Tổng quan, Hồ sơ bệnh án, Quyền truy cập, Đơn thuốc, Bảo hiểm, Nghiên cứu, Phần thưởng, Nhật ký khẩn cấp |
| `doctor` | `/doctor` | Bảng điều khiển, Hồ sơ bệnh án, Đơn thuốc, Truy cập khẩn cấp |
| `hospitalAdmin` | `/admin/ledger` | Bệnh viện & Bác sĩ, Phần thưởng, Sổ cái Blockchain |
| `hospital` (e.g. Hospital01) | `/admin/ledger` | Danh sách bác sĩ + thêm bác sĩ |
| `pharmacy` | `/prescriptions` | Đơn thuốc |
| `insuranceAdmin` / `insurance` | `/insurance` | Chi nhánh, Sổ cái Blockchain (Org2) |
| `agent` | `/insurance` | Yêu cầu bảo hiểm (duyệt/từ chối) |
| `researcher` | `/research` | Gửi yêu cầu đồng ý, Dữ liệu ẩn danh |

---

## Features

### Patient Dashboard
- Thống kê tổng quan: số hồ sơ, đơn thuốc, yêu cầu bảo hiểm, phần thưởng
- Truy cập nhanh đến các chức năng

### Hồ sơ bệnh án
- Bác sĩ tạo/cập nhật hồ sơ với chuẩn ICD-10 (chẩn đoán) và ATC (thuốc)
- Xem lịch sử thay đổi từng version trên blockchain
- Doctor/Hospital có thể tra cứu theo Patient ID

### Quyền truy cập
- Bệnh nhân cấp/thu hồi quyền cho từng bác sĩ
- Danh sách bác sĩ đang được ủy quyền

### Đơn thuốc
- Bác sĩ tạo đơn kèm hồ sơ bệnh án
- Nhà thuốc xác nhận đã cấp phát

### Quản lý bệnh viện & bác sĩ
- **hospitalAdmin**: xem toàn bộ bệnh viện, thêm bệnh viện mới, expand từng bệnh viện để xem bác sĩ
- **hospital** (Hospital01...): xem và thêm bác sĩ thuộc bệnh viện mình

### Bảo hiểm
- **Bệnh nhân/Bác sĩ**: tạo yêu cầu bồi thường liên kết hồ sơ bệnh án
- **Agent**: duyệt/từ chối yêu cầu theo từng trạng thái
- **InsuranceAdmin**: xem danh sách chi nhánh, sổ cái Org2 (công ty BH, chi nhánh, claims)

### Phần thưởng
- hospitalAdmin phát thưởng cho bệnh nhân (chọn từ danh sách, nhập điểm, lý do)
- Bệnh nhân nhận thưởng và xem lịch sử

### Nghiên cứu & Đồng ý
- **Researcher**: gửi yêu cầu đồng ý đến bệnh nhân, truy cập dữ liệu ẩn danh (HIPAA)
- **Bệnh nhân**: xem danh sách yêu cầu đang chờ, đồng ý/từ chối trực tiếp từng request

### Truy cập khẩn cấp
- **Bác sĩ**: truy cập khẩn cấp hồ sơ bệnh nhân (lý do tối thiểu 10 ký tự), hiện ngay thông tin bệnh nhân + hồ sơ
- **Bệnh nhân**: xem nhật ký ai đã truy cập khẩn cấp hồ sơ của mình
- **Hospital admin**: tra cứu nhật ký theo Patient ID
- Mọi truy cập đều được ghi vào blockchain (audit trail)

### Sổ cái Blockchain
- **Org1 (hospitalAdmin)**: toàn bộ dữ liệu — bệnh nhân, bác sĩ, bệnh viện, bệnh án, đơn thuốc, phần thưởng, yêu cầu BH; filter theo loại, xuất JSON
- **Org2 (insuranceAdmin)**: dữ liệu Org2 — công ty BH, chi nhánh, claims; filter theo loại

---

## API Endpoints

Base URL: `http://localhost:5000`

> Tất cả endpoints dùng **POST**, body JSON với **named parameters**.

### Authentication
| Endpoint | Mô tả |
|----------|-------|
| `/registerPatient` | Đăng ký bệnh nhân mới |
| `/loginPatient` | Đăng nhập |

### Medical Records
| Endpoint | Mô tả |
|----------|-------|
| `/addRecord` | Tạo hồ sơ bệnh án |
| `/updateRecord` | Cập nhật hồ sơ |
| `/getRecordById` | Lấy hồ sơ theo ID |
| `/getAllRecordsByPatientId` | Lấy tất cả hồ sơ của bệnh nhân |
| `/queryHistoryOfAsset` | Xem lịch sử thay đổi (blockchain history) |

### Access Control
| Endpoint | Mô tả |
|----------|-------|
| `/grantAccess` | Cấp quyền cho bác sĩ |
| `/revokeAccess` | Thu hồi quyền |
| `/getMyPatients` | Lấy danh sách bệnh nhân của bác sĩ |
| `/getPatientById` | Lấy thông tin bệnh nhân |

### Prescriptions
| Endpoint | Mô tả |
|----------|-------|
| `/getPrescriptionsByPatient` | Lấy đơn thuốc theo bệnh nhân |
| `/getAllPrescriptions` | Lấy tất cả đơn thuốc |
| `/verifyPrescription` | Xác nhận cấp phát thuốc |

### Insurance Claims
| Endpoint | Mô tả |
|----------|-------|
| `/createClaim` | Tạo yêu cầu bảo hiểm |
| `/getClaim` | Lấy yêu cầu theo ID |
| `/getClaimsByPatient` | Lấy yêu cầu theo bệnh nhân |
| `/getAllClaims` | Lấy tất cả yêu cầu (agent/insurance) |
| `/approveClaim` | Duyệt yêu cầu |
| `/rejectClaim` | Từ chối yêu cầu |

### Research & Consent
| Endpoint | Mô tả |
|----------|-------|
| `/onboardResearcher` | Đăng ký nhà nghiên cứu |
| `/requestConsent` | Gửi yêu cầu đồng ý |
| `/approveConsent` | Bệnh nhân đồng ý/từ chối |
| `/getAnonymizedData` | Lấy dữ liệu ẩn danh (cần consent) |

### Emergency
| Endpoint | Mô tả |
|----------|-------|
| `/emergencyAccess` | Truy cập khẩn cấp (doctor/hospital) |
| `/getEmergencyLogs` | Xem nhật ký khẩn cấp (hospital hoặc chính bệnh nhân) |

### Rewards
| Endpoint | Mô tả |
|----------|-------|
| `/issueReward` | Phát thưởng cho bệnh nhân |
| `/claimReward` | Bệnh nhân nhận thưởng |
| `/getRewardsByPatient` | Lịch sử phần thưởng |

### Organization Management
| Endpoint | Mô tả |
|----------|-------|
| `/onboardHospital` | Thêm bệnh viện |
| `/onboardDoctor` | Thêm bác sĩ |
| `/onboardPharmacy` | Thêm nhà thuốc |
| `/onboardInsuranceCompany` | Thêm công ty bảo hiểm |
| `/onboardInsuranceAgent` | Thêm chi nhánh bảo hiểm |
| `/getAllHospitals` | Danh sách bệnh viện |
| `/getAllDoctors` | Danh sách bác sĩ (lọc theo hospitalId) |
| `/getAllPharmacies` | Danh sách nhà thuốc |
| `/getAllInsuranceCompanies` | Danh sách công ty bảo hiểm |
| `/getAllAgents` | Danh sách chi nhánh bảo hiểm |

### Ledger / Blockchain
| Endpoint | Mô tả |
|----------|-------|
| `/fetchLedger` | Toàn bộ sổ cái Org1 (bao gồm composite keys: record, dispense, claim, reward) |
| `/fetchOrg2Ledger` | Sổ cái Org2 (insurance, agent, claim) |
| `/fetchInsuranceLedger` | Claims tổng hợp theo bệnh nhân (fallback Org2) |

---

## Chaincode Functions

Smart contract `ehrChainCode.js` bao gồm các nhóm function:

| Nhóm | Function |
|------|----------|
| **Patient** | `registerPatient`, `getPatientById`, `getAllPatients` |
| **Records** | `addRecord`, `updateRecord`, `getRecordById`, `getAllRecordsByPatientId`, `getRecordsByDoctor`, `queryHistoryOfAsset` |
| **Access** | `grantAccess`, `revokeAccess` |
| **Pharmacy** | `getPrescriptionsByPatient`, `getAllPrescriptions`, `verifyPrescription` |
| **Insurance** | `createClaim`, `getClaim`, `getClaimsByPatient`, `getAllClaims`, `approveClaim`, `rejectClaim` |
| **Research** | `onboardResearcher`, `requestConsent`, `approveConsent`, `getAnonymizedData` |
| **Emergency** | `emergencyAccess`, `getEmergencyLogs` |
| **Rewards** | `issueReward`, `claimReward`, `getRewardsByPatient` |
| **Onboard** | `onboardHospital`, `onboardDoctor`, `onboardPharmacy`, `onboardInsuranceCompany`, `onboardInsuranceAgent` |
| **Admin** | `fetchLedger` (Org1), `fetchOrg2Ledger` (Org2), `getAllAgents`, `getAllHospitals`, `getAllDoctors` |

### Key Storage Patterns

| Key Format | Loại dữ liệu |
|------------|-------------|
| `patient-{id}` | Thông tin bệnh nhân |
| `hospital-{id}` | Thông tin bệnh viện |
| `doctor-{id}` | Thông tin bác sĩ |
| `insurance-{id}` | Công ty bảo hiểm |
| `agent-{id}` | Chi nhánh bảo hiểm |
| `researcher-{id}` | Nhà nghiên cứu |
| `record\|{patientId}\|{recordId}` | Hồ sơ bệnh án *(composite key)* |
| `claim\|{patientId}\|{claimId}` | Yêu cầu bảo hiểm *(composite key)* |
| `dispense\|{patientId}\|{dispenseId}` | Cấp phát thuốc *(composite key)* |
| `reward\|{patientId}\|{rewardId}` | Phần thưởng *(composite key)* |
| `emergency\|{patientId}\|{logId}` | Nhật ký khẩn cấp *(composite key)* |

> Composite keys bắt đầu bằng `\x00` và phải truy vấn bằng `getStateByPartialCompositeKey`.

---

## Data Validation Standards

- **ICD-10** codes cho chẩn đoán (format: A00 – Z99.9)
- **ATC** codes cho thuốc
- Liều lượng, đường dùng thuốc được validate
- Lý do truy cập khẩn cấp tối thiểu 10 ký tự

---

## FHIR R4 API

Project hỗ trợ chuẩn **FHIR R4** cho phép tích hợp với HIS, phần mềm bảo hiểm, ứng dụng di động.

Base URL: `http://localhost:5000/fhir`

| Method | Endpoint | FHIR Resource |
|--------|----------|---------------|
| GET | `/fhir/metadata` | CapabilityStatement |
| GET | `/fhir/Patient/:patientId` | Patient |
| GET | `/fhir/Patient/:patientId/$everything` | Bundle |
| GET | `/fhir/Observation/:patientId/:recordId` | Observation (ICD-10) |
| GET | `/fhir/MedicationRequest/:patientId/:recordId` | MedicationRequest (ATC) |
| GET | `/fhir/Claim/:patientId/:claimId` | Claim |
| GET | `/fhir/Practitioner/:doctorId` | Practitioner |

### GET /fhir/metadata

```json
{
  "resourceType": "CapabilityStatement",
  "status": "active",
  "kind": "instance",
  "fhirVersion": "4.0.1",
  "format": ["json"],
  "rest": [{
    "mode": "server",
    "resource": [
      { "type": "Patient",           "interaction": [{"code": "read"}] },
      { "type": "Observation",       "interaction": [{"code": "read"}] },
      { "type": "MedicationRequest", "interaction": [{"code": "read"}] },
      { "type": "Claim",             "interaction": [{"code": "read"}] },
      { "type": "Practitioner",      "interaction": [{"code": "read"}] }
    ]
  }]
}
```

### GET /fhir/Patient/:patientId

```json
{
  "resourceType": "Patient",
  "id": "patient01",
  "identifier": [{
    "system": "urn:ehr:blockchain",
    "value": "patient01"
  }],
  "name": [{
    "use": "official",
    "text": "Nguyễn Văn A",
    "family": "Nguyễn",
    "given": ["Văn A"]
  }],
  "gender": "male",
  "birthDate": "1990-05-15",
  "telecom": [{ "system": "phone", "value": "0912345678" }]
}
```

### GET /fhir/Patient/:patientId/$everything

Trả về **Bundle** chứa toàn bộ dữ liệu liên quan đến bệnh nhân: Patient + tất cả Observation + MedicationRequest.

```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 3,
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient01"
      }
    },
    {
      "resource": {
        "resourceType": "Observation",
        "id": "record01",
        "status": "final",
        "code": {
          "coding": [{ "system": "http://hl7.org/fhir/sid/icd-10", "code": "J06.9", "display": "Viêm đường hô hấp trên" }]
        },
        "subject": { "reference": "Patient/patient01" }
      }
    },
    {
      "resource": {
        "resourceType": "MedicationRequest",
        "id": "record01-med",
        "status": "active",
        "subject": { "reference": "Patient/patient01" }
      }
    }
  ]
}
```

### GET /fhir/Observation/:patientId/:recordId

Maps hồ sơ bệnh án EHR → FHIR Observation với ICD-10 coding.

```json
{
  "resourceType": "Observation",
  "id": "record01",
  "status": "final",
  "category": [{
    "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "exam" }]
  }],
  "code": {
    "coding": [{
      "system": "http://hl7.org/fhir/sid/icd-10",
      "code": "J06.9",
      "display": "Viêm đường hô hấp trên cấp tính, không xác định"
    }]
  },
  "subject": { "reference": "Patient/patient01" },
  "performer": [{ "reference": "Practitioner/doctor01" }],
  "effectiveDateTime": "2024-01-15T08:30:00Z",
  "valueString": "Bệnh nhân sốt 38.5°C, ho khan, đau họng"
}
```

### GET /fhir/MedicationRequest/:patientId/:recordId

Maps đơn thuốc EHR → FHIR MedicationRequest với ATC coding.

```json
{
  "resourceType": "MedicationRequest",
  "id": "record01-med",
  "status": "active",
  "intent": "order",
  "medicationCodeableConcept": {
    "coding": [{
      "system": "http://www.whocc.no/atc",
      "code": "J01CA04",
      "display": "Amoxicillin"
    }]
  },
  "subject": { "reference": "Patient/patient01" },
  "requester": { "reference": "Practitioner/doctor01" },
  "dosageInstruction": [{
    "text": "500mg x 3 lần/ngày x 7 ngày",
    "timing": { "repeat": { "frequency": 3, "period": 1, "periodUnit": "d" } },
    "doseAndRate": [{
      "doseQuantity": { "value": 500, "unit": "mg", "system": "http://unitsofmeasure.org", "code": "mg" }
    }]
  }]
}
```

### GET /fhir/Claim/:patientId/:claimId

Maps yêu cầu bảo hiểm EHR → FHIR Claim resource.

```json
{
  "resourceType": "Claim",
  "id": "claim01",
  "status": "active",
  "type": {
    "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/claim-type", "code": "institutional" }]
  },
  "use": "claim",
  "patient": { "reference": "Patient/patient01" },
  "created": "2024-01-20T10:00:00Z",
  "provider": { "reference": "Organization/hospital01" },
  "priority": { "coding": [{ "code": "normal" }] },
  "total": { "value": 2500000, "currency": "VND" }
}
```

### GET /fhir/Practitioner/:doctorId

```json
{
  "resourceType": "Practitioner",
  "id": "doctor01",
  "identifier": [{
    "system": "urn:ehr:blockchain",
    "value": "doctor01"
  }],
  "name": [{
    "use": "official",
    "text": "BS. Trần Thị B",
    "family": "Trần",
    "given": ["Thị B"]
  }],
  "qualification": [{
    "code": {
      "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v2-0360", "code": "MD", "display": "Doctor of Medicine" }]
    }
  }]
}
```

---

## Troubleshooting

**Backend không kết nối được Fabric peers**
- Kiểm tra Fabric network: `docker ps` trong WSL
- Sau mỗi `./network.sh down` + `up`, phải chạy lại các script đăng ký admin (crypto materials mới)

**Lỗi `wallet/` khi khởi động backend**
- Xóa thư mục `server-node-sdk/wallet/` và chạy lại scripts đăng ký

**Frontend trắng hoặc lỗi redirect loop**
- Kiểm tra role của user có nằm trong danh sách được xử lý trong `getHomeRedirect` (App.jsx)
- Xóa localStorage và đăng nhập lại

**localhost:3000 không truy cập được từ Windows**
- Vite phải bind `host: true` trong `vite.config.js` (đã cấu hình)
- Kiểm tra Windows Firewall không chặn port 3000/5000

**Port 5000 đã được dùng**
```bash
kill $(lsof -ti:5000)
```

**Chaincode endorsement failures**
- Đảm bảo chaincode đã deploy lên cả 2 peer (Org1 và Org2)
- Chạy lại `./network.sh deployCC ...`

**Sổ cái không hiện hồ sơ bệnh án**
- Hồ sơ dùng composite key — cần chaincode version mới đã có `getStateByPartialCompositeKey`
- Redeploy chaincode nếu đang dùng version cũ

## License

Apache 2.0 — see [LICENSE](LICENSE).
