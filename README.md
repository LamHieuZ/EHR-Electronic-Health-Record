# Electronic Health Record (EHR) - Blockchain Based Platform

Hệ thống quản lý hồ sơ y tế điện tử phi tập trung trên **Hyperledger Fabric**, cho phép bệnh nhân, bác sĩ, bệnh viện, nhà thuốc và công ty bảo hiểm tương tác với dữ liệu y tế thông qua **role-based access control (RBAC)** và **private data collections (PDC)** trên sổ cái bất biến.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | Hyperledger Fabric 2.5, Fabric CA, CouchDB |
| **Smart Contract** | JavaScript Chaincode (Fabric Contract API 2.5) |
| **Backend** | Node.js 18+, Express 5, Fabric Network SDK 2.2 |
| **Frontend** | React 18, Vite 5, Tailwind CSS 3.4, React Router 6, Axios |
| **Explorer** | Hyperledger Explorer, PostgreSQL |
| **Infrastructure** | Docker, Docker Compose, WSL2 (Ubuntu 22.04) |

## Tổ chức & Vai trò

| Org | Mục đích | Peer Port | CA Port | CouchDB |
|-----|---------|-----------|---------|---------|
| Org1 | Bệnh viện (BV1) | 7051 | 7054 | 5984 |
| Org2 | Công ty bảo hiểm | 9051 | 8054 | 7984 |
| Org3 | Bệnh viện thứ 2 (BV3, optional) | 11051 | 11054 | 9984 |

**Roles:** `patient`, `doctor`, `pharmacy`, `hospital` (admin), `insurance` (admin), `agent`

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          WSL / Ubuntu                             │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │             Hyperledger Fabric Network                      │   │
│  │                                                            │   │
│  │   Org1 (BV1)       Org2 (Insurance)      Org3 (BV3)        │   │
│  │   Peer:7051        Peer:9051             Peer:11051        │   │
│  │   CouchDB:5984     CouchDB:7984          CouchDB:9984      │   │
│  │                                                            │   │
│  │                  Channel: mychannel                         │   │
│  │               Chaincode: ehrChainCode                       │   │
│  │                                                            │   │
│  │   ┌─────────────────────────────────────────────────────┐   │   │
│  │   │ Private Data Collections (trên peer, không replicate)│  │   │
│  │   │   - hospital1Collection  (chỉ Org1)                  │  │   │
│  │   │   - hospital3Collection  (chỉ Org3)                  │  │   │
│  │   │   - sharedClinicalCollection (Org1+Org3)             │  │   │
│  │   └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────┬──────────────────────────────────┘   │
│                             │ Fabric Network SDK                 │
│  ┌─────────────────────────▼──────────────────────────────────┐   │
│  │          Backend: Node.js + Express (port 5000)             │   │
│  │          JWT auth, FHIR R4 adapter                           │   │
│  └─────────────────────────┬──────────────────────────────────┘   │
│                             │ REST /api                            │
│  ┌─────────────────────────▼──────────────────────────────────┐   │
│  │           Frontend: React + Vite (port 3000)                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │        Hyperledger Explorer (port 8080) [optional]          │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Privacy Model — 2 tầng lưu trữ

Dự án dùng kiến trúc **on-chain + PDC** để cách ly dữ liệu y tế nhạy cảm giữa các bệnh viện:

| Tầng | Lưu ở đâu | Chứa gì | Ai thấy |
|---|---|---|---|
| **On-chain (public ledger)** | Mọi peer trong channel | `patientId`, `doctorId`, `hospitalId`, `privateHash`, timestamps, metadata | Tất cả org trong channel |
| **PDC (private data)** | CouchDB của org được phép | `diagnosis`, `prescription` | Chỉ org sở hữu collection |

**Hiệu quả:** Org3 dump CouchDB của mình cũng chỉ thấy hash `a3f7b2…`, không decode được diagnosis gốc của BV1. Hash trên ledger vẫn đảm bảo audit trail bất biến.

## Access Control (ACL)

Chaincode enforce 2 lớp quyền:

**Lớp 1 — Role-based:** mỗi function check `role` của caller (patient/doctor/hospital/pharmacy/insurance/agent).

**Lớp 2 — Relationship-based:** caller phải có quan hệ với resource:
- **Patient** → chỉ đọc của chính mình
- **Doctor** → phải nằm trong `patient.authorizedDoctors` (do bệnh nhân tự cấp qua `grantAccess`)
- **Hospital admin** → chỉ đọc bệnh nhân có ít nhất 1 bác sĩ thuộc BV mình được cấp quyền
- **Pharmacy** → như hospital admin (để dispense đơn thuốc)

**Flow chuyển viện:** bệnh nhân dùng `grantAccess(doctorIdBV3)` → BV3 (admin + doctor đó) có quyền đọc. Nếu BV3 thuộc collection khác, diagnosis gốc vẫn không tự động chia sẻ — cần flow copy qua `sharedClinicalCollection` (future work).

## Project Structure

```
EHR-Hyperledger-Fabric-Project/
├── client/                        # React frontend (port 3000)
│   ├── src/
│   │   ├── pages/                 # Trang theo role
│   │   ├── components/Layout.jsx  # Sidebar điều hướng theo role
│   │   ├── context/               # AuthContext (JWT)
│   │   └── services/api.js        # Axios API layer
│   └── vite.config.js             # Proxy /api → :5000
│
├── server-node-sdk/               # Express backend (port 5000)
│   ├── app.js                     # API routes
│   ├── helper.js                  # Fabric CA registration & wallet
│   ├── fabric-connection.js       # Gateway connection
│   ├── invoke.js / query.js       # Chaincode invoke/query
│   ├── fhir.js                    # FHIR R4 adapter
│   ├── cert-script/               # Admin & onboarding scripts (Org1/2/3)
│   └── wallet/                    # Fabric identities
│
├── fabric-samples/
│   ├── test-network/              # Fabric network (Org1 + Org2 + Org3)
│   └── asset-transfer-basic/chaincode-javascript/
│       ├── collections_config.json # PDC policy (BV1, BV3, shared)
│       └── lib/ehrChainCode.js    # Smart contract
│
├── fabric-explorer/               # Blockchain explorer (port 8080)
└── install-fabric.sh              # Tải binaries Fabric
```

## Prerequisites

Cài trong **WSL (Ubuntu 22.04)**:

```bash
# Docker & docker compose: cài qua Docker Desktop (Windows) hoặc apt
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Setup & Installation

### 1. Download Fabric Binaries

```bash
./install-fabric.sh
```

### 2. Khởi động mạng

```bash
cd fabric-samples/test-network
./network.sh up createChannel -ca -s couchdb
```

### 3. (Optional) Thêm Org3 — Bệnh viện thứ 2

Chạy **trước** bước deploy chaincode để `deployCC.sh` tự detect và cài lên cả 3 peer:

```bash
cd addOrg3
./addOrg3.sh up -ca -s couchdb -c mychannel
cd ..
```

### 4. Deploy Chaincode với PDC + Endorsement Policy

```bash
./network.sh deployCC -ccn ehrChainCode \
  -ccp ../asset-transfer-basic/chaincode-javascript/ \
  -ccl javascript \
  -ccv 1.0 -ccs 1 \
  -cccg ../asset-transfer-basic/chaincode-javascript/collections_config.json \
  -ccep "OR('Org1MSP.peer','Org3MSP.peer')"
```

Giải thích:
- `-cccg`: load `collections_config.json` cho PDC
- `-ccep`: endorsement policy — chỉ BV điều trị endorse, không bắt 3 bên duyệt
- Script `deployCC.sh` đã được sửa để tự phát hiện Org3 và cài chaincode lên cả 3 peer nếu có

Khi chaincode đổi hoặc sequence cũ, bump cả `-ccv` và `-ccs`:
```bash
./network.sh deployCC ... -ccv 2.0 -ccs 2 ...
```

### 5. Register Admins & Onboard

```bash
cd /home/lamhieu/EHR-Hyperledger-Fabric-Project/server-node-sdk/
npm install

# Org1 + Org2
node cert-script/registerHospitalAdmin.js
node cert-script/registerInsuranceAdmin.js
node cert-script/onboardDoctor.js
node cert-script/onboardPharmacy.js
node cert-script/onboardInsuranceCompany.js
node cert-script/onboardInsuranceAgent.js

# Org3 (nếu có)
node cert-script/registerHospital3Admin.js
node cert-script/onboardOrg3Doctor.js
```

### 6. Start Backend

```bash
cd server-node-sdk
npm run dev    # http://localhost:5000
```

### 7. Start Frontend

```bash
cd client
npm install
npm run dev    # http://localhost:3000
```

### 8. (Optional) Start Explorer

```bash
cd fabric-explorer
cp -r ../fabric-samples/test-network/organizations/ .
export EXPLORER_CONFIG_FILE_PATH=./config.json
export EXPLORER_PROFILE_DIR_PATH=./connection-profile
export FABRIC_CRYPTO_PATH=./organizations
docker-compose up -d    # http://localhost:8080
```

## Shutdown

```bash
cd fabric-explorer && docker-compose down
cd fabric-samples/test-network && ./network.sh down
```

---

## Roles & Pages

| Role | Redirect | Trang chính |
|------|----------|-------------|
| `patient` | `/dashboard` | Tổng quan, Hồ sơ bệnh án, Quyền truy cập, Đơn thuốc, Bảo hiểm, Nhật ký khẩn cấp |
| `doctor` | `/doctor` | Bảng điều khiển, Hồ sơ bệnh án, Đơn thuốc, Truy cập khẩn cấp |
| `hospital` | `/admin/ledger` | Bệnh viện & Bác sĩ, Sổ cái Blockchain |
| `pharmacy` | `/prescriptions` | Đơn thuốc (dispense) |
| `insurance` | `/insurance` | Chi nhánh, Sổ cái Org2 |
| `agent` | `/insurance` | Duyệt/từ chối yêu cầu bảo hiểm |

---

## Features

### Quản lý hồ sơ bệnh án
- Bác sĩ tạo hồ sơ theo chuẩn **ICD-10** (chẩn đoán) + **ATC** (thuốc)
- Diagnosis + prescription lưu trong PDC → không leak sang BV khác
- Metadata + hash lưu on-chain để audit trail bất biến
- Xem lịch sử version qua `queryHistoryOfAsset`

### Consent-based access
- Bệnh nhân tự cấp/thu hồi quyền cho từng bác sĩ (`grantAccess` / `revokeAccess`)
- Không ai (kể cả admin) cấp hộ được
- Bác sĩ chỉ đọc được bệnh nhân trong danh sách `authorizedDoctors`

### Đơn thuốc
- Bác sĩ tạo prescription trong `addRecord`
- Nhà thuốc xác nhận cấp phát → ghi `dispensed` flag lên public ledger

### Bảo hiểm (cross-org)
- Bệnh nhân/bác sĩ tạo claim liên kết record
- Agent duyệt/từ chối; insurance admin xem sổ cái Org2

### Truy cập khẩn cấp
- Bác sĩ/admin có thể `emergencyAccess` khi bệnh nhân không thể cấp quyền (lý do ≥ 10 ký tự)
- Mọi lần truy cập đều ghi log bất biến
- Bệnh nhân xem được log ai đã access hồ sơ mình

### Sổ cái Blockchain
- **`fetchLedger`** (hospital admin Org1/Org3): metadata + hash records
- **`fetchOrg2Ledger`** (insurance admin): insurance company, agent, claims

---

## API Endpoints

Base URL: `http://localhost:5000` — tất cả **POST** với JSON body.

### Authentication
| Endpoint | Mô tả |
|----------|-------|
| `/registerPatient` | Đăng ký bệnh nhân |
| `/loginPatient` | Đăng nhập |

### Medical Records
| Endpoint | Mô tả |
|----------|-------|
| `/addRecord` | Tạo hồ sơ (public metadata + PDC private) |
| `/updateRecord` | Cập nhật (chỉ BV sở hữu) |
| `/getRecordById` | Lấy 1 hồ sơ (merge public + private) |
| `/getAllRecordsByPatientId` | Tất cả hồ sơ của bệnh nhân |
| `/queryHistoryOfAsset` | Lịch sử blockchain của 1 key |

### Access Control
| Endpoint | Mô tả |
|----------|-------|
| `/grantAccess` | Bệnh nhân cấp quyền cho bác sĩ |
| `/revokeAccess` | Bệnh nhân thu hồi quyền |
| `/getPatientById` | Xem thông tin bệnh nhân |

### Prescriptions
| Endpoint | Mô tả |
|----------|-------|
| `/getPrescriptionsByPatient` | Đơn thuốc của 1 bệnh nhân |
| `/verifyPrescription` | Nhà thuốc xác nhận dispense |

### Insurance Claims
| Endpoint | Mô tả |
|----------|-------|
| `/createClaim`, `/getClaim`, `/getClaimsByPatient`, `/getAllClaims` | CRUD claim |
| `/approveClaim`, `/rejectClaim` | Agent xử lý claim |

### Emergency
| Endpoint | Mô tả |
|----------|-------|
| `/emergencyAccess` | Truy cập khẩn cấp (ghi log) |
| `/getEmergencyLogs` | Xem log khẩn cấp |

### Organization
| Endpoint | Mô tả |
|----------|-------|
| `/onboardHospital`, `/onboardDoctor`, `/onboardPharmacy` | Thêm thực thể |
| `/onboardInsuranceCompany`, `/onboardInsuranceAgent` | Thêm BH |
| `/getAllHospitals`, `/getAllDoctors`, `/getAllPharmacies`, `/getAllInsuranceCompanies`, `/getAllAgents` | List |

### Ledger
| Endpoint | Mô tả |
|----------|-------|
| `/fetchLedger` | Sổ cái hospital (Org1/Org3) |
| `/fetchOrg2Ledger` | Sổ cái insurance (Org2) |

---

## Chaincode Functions

Smart contract [`ehrChainCode.js`](fabric-samples/asset-transfer-basic/chaincode-javascript/lib/ehrChainCode.js) gồm các nhóm:

| Nhóm | Function |
|------|----------|
| **Patient** | `registerPatient`, `getPatientById`, `getAllPatients` |
| **Records** | `addRecord`, `updateRecord`, `getRecordById`, `getAllRecordsByPatientId`, `getRecordsByDoctor`, `queryHistoryOfAsset` |
| **Access** | `grantAccess`, `revokeAccess` |
| **Prescription** | `getPrescriptionsByPatient`, `verifyPrescription` |
| **Insurance** | `createClaim`, `getClaim`, `getClaimsByPatient`, `getAllClaims`, `approveClaim`, `rejectClaim` |
| **Emergency** | `emergencyAccess`, `getEmergencyLogs` |
| **Onboard** | `onboardHospital`, `onboardDoctor`, `onboardPharmacy`, `onboardInsuranceCompany`, `onboardInsuranceAgent` |
| **Admin** | `fetchLedger`, `fetchOrg2Ledger` |

### Key Storage Patterns

| Key Format | Loại dữ liệu | Tầng |
|------------|-------------|------|
| `patient-{id}` | Bệnh nhân | on-chain |
| `hospital-{id}`, `doctor-{id}`, `pharmacy-{id}` | Metadata | on-chain |
| `insurance-{id}`, `agent-{id}` | BH | on-chain |
| `record\|{patientId}\|{recordId}` | Metadata + hash | on-chain |
| `record\|{patientId}\|{recordId}` (trong PDC) | diagnosis, prescription | **private (PDC)** |
| `claim\|{patientId}\|{claimId}` | Claim | on-chain |
| `dispense\|{patientId}\|{dispenseId}` | Dispense log | on-chain |
| `emergency\|{patientId}\|{logId}` | Log khẩn cấp | on-chain |

Composite keys truy vấn bằng `getStateByPartialCompositeKey`.

---

## Data Validation

- **ICD-10** (format: A00–Z99.9) cho chẩn đoán
- **ATC** codes cho thuốc, kèm validate liều/đường dùng
- Lý do truy cập khẩn cấp ≥ 10 ký tự

---

## FHIR R4 API

Adapter tại `http://localhost:5000/fhir` dịch dữ liệu EHR sang chuẩn **FHIR R4** để tích hợp HIS/ứng dụng di động.

| Method | Endpoint | FHIR Resource |
|--------|----------|---------------|
| GET | `/fhir/metadata` | CapabilityStatement |
| GET | `/fhir/Patient/:patientId` | Patient |
| GET | `/fhir/Patient/:patientId/$everything` | Bundle (Patient + Observations + MedicationRequests) |
| GET | `/fhir/Observation/:patientId/:recordId` | Observation (ICD-10) |
| GET | `/fhir/MedicationRequest/:patientId/:recordId` | MedicationRequest (ATC) |
| GET | `/fhir/Claim/:patientId/:claimId` | Claim |
| GET | `/fhir/Practitioner/:doctorId` | Practitioner |

Ví dụ Patient:
```json
{
  "resourceType": "Patient",
  "id": "patient01",
  "identifier": [{ "system": "urn:ehr:blockchain", "value": "patient01" }],
  "name": [{ "use": "official", "family": "Nguyễn", "given": ["Văn A"] }],
  "gender": "male",
  "birthDate": "1990-05-15"
}
```

Ví dụ Observation (ICD-10):
```json
{
  "resourceType": "Observation",
  "id": "record01",
  "status": "final",
  "code": {
    "coding": [{ "system": "http://hl7.org/fhir/sid/icd-10", "code": "J06.9", "display": "Viêm đường hô hấp trên" }]
  },
  "subject": { "reference": "Patient/patient01" }
}
```

Ví dụ MedicationRequest (ATC):
```json
{
  "resourceType": "MedicationRequest",
  "id": "record01-med",
  "status": "active",
  "medicationCodeableConcept": {
    "coding": [{ "system": "http://www.whocc.no/atc", "code": "J01CA04", "display": "Amoxicillin" }]
  },
  "subject": { "reference": "Patient/patient01" }
}
```

---

## Troubleshooting

**Backend không kết nối được Fabric**
- `docker ps` kiểm tra peer/orderer còn chạy
- Sau `./network.sh down && up`, phải chạy lại scripts đăng ký admin

**Lỗi wallet/ khi start backend**
- Xóa `server-node-sdk/wallet/` rồi chạy lại cert scripts

**Frontend redirect loop**
- Xóa localStorage, đăng nhập lại
- Kiểm tra role trong `getHomeRedirect` (App.jsx)

**Port conflict**
```bash
kill $(lsof -ti:5000)
```

**Chaincode endorsement failed**
- Chaincode phải cài lên tất cả peer (Org1/Org2/Org3 nếu có)
- Redeploy: `./network.sh deployCC ... -ccv <new> -ccs <new+1>`

**`INVALID_STATE: collection not found`**
- Quên truyền `-cccg collections_config.json` khi deploy
- Hoặc record tạo trước khi deploy PDC — reset network hoặc migrate

**BV3 không thấy diagnosis của BV1**
- **Đúng thiết kế** — PDC cách ly. Nếu muốn share: bệnh nhân grant thêm bác sĩ BV3, sau đó copy sang `sharedClinicalCollection` (flow chưa implement).

**Sổ cái không hiện records**
- Record đã chuyển sang PDC, `fetchLedger` chỉ trả metadata + hash. Để xem full dùng `getAllRecordsByPatientId`.

## License

Apache 2.0 — xem [LICENSE](LICENSE).
