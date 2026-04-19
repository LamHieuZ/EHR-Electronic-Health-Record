# Electronic Health Record (EHR) - Blockchain Based Platform

Hệ thống quản lý hồ sơ y tế điện tử phi tập trung trên **Hyperledger Fabric**, kết hợp **IPFS** cho lưu trữ file y tế có mã hóa, chuẩn **FHIR R4** cho tích hợp, và **CVX/ICD-10/ATC** chuẩn y khoa quốc tế. Hỗ trợ đầy đủ: bệnh nhân, bác sĩ, bệnh viện, nhà thuốc, công ty bảo hiểm — với **role-based access control**, **private data collections** và **consent-based cross-hospital sharing**.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | Hyperledger Fabric 2.5, Fabric CA, CouchDB |
| **Smart Contract** | JavaScript Chaincode (Fabric Contract API 2.5) |
| **File Storage** | IPFS (Kubo v0.29) + AES-256-GCM encryption |
| **Backend** | Node.js 18+, Express 5, Fabric Network SDK 2.2, Multer |
| **Frontend** | React 18, Vite 5, Tailwind CSS 3.4, React Router 6, Axios |
| **Interop** | FHIR R4 (Patient, Observation, MedicationRequest, Claim, Practitioner) |
| **Medical Standards** | ICD-10, ATC, CVX |
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
┌──────────────────────────────────────────────────────────────────────────┐
│                           WSL / Ubuntu                                    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                 Hyperledger Fabric Network                           │  │
│  │                                                                     │  │
│  │    Org1 (BV1)         Org2 (Insurance)        Org3 (BV2)            │  │
│  │    Peer:7051          Peer:9051               Peer:11051            │  │
│  │    CouchDB:5984       CouchDB:7984            CouchDB:9984          │  │
│  │                                                                     │  │
│  │                   Channel: mychannel                                │  │
│  │                Chaincode: ehrChainCode                              │  │
│  │                                                                     │  │
│  │    ┌─────────────────────────────────────────────────────────────┐  │  │
│  │    │ Private Data Collections (trên peer, không replicate ngoài) │  │  │
│  │    │   - hospital1Collection      (chỉ Org1)                      │  │  │
│  │    │   - hospital2Collection      (chỉ Org3)                      │  │  │
│  │    │   - sharedClinicalCollection (Org1 + Org3, khi share)        │  │  │
│  │    └─────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────┬──────────────────────────────────────────┘  │
│                              │                                            │
│  ┌──────────────────────────▼──────────────────────────────────────────┐  │
│  │           Backend: Node.js + Express (port 5000)                    │  │
│  │           • Fabric Network SDK                                      │  │
│  │           • IPFS client (fetch API)                                  │  │
│  │           • AES-256-GCM encryption                                   │  │
│  │           • FHIR R4 adapter                                          │  │
│  └──────────┬────────────────────────────────┬──────────────────────────┘  │
│             │ REST /api                       │ POST /api/v0/add           │
│  ┌──────────▼───────────────┐  ┌─────────────▼──────────────────┐          │
│  │   Frontend: React        │  │   IPFS Node (Kubo)              │          │
│  │   + Vite (port 3000)     │  │   P2P:4001  API:5001            │          │
│  └──────────────────────────┘  │   Gateway:8088                  │          │
│                                 │   Stored: ciphertext files       │          │
│                                 └─────────────────────────────────┘          │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │         Hyperledger Explorer (port 8080) [optional]                  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Privacy & Storage Model — 3 tầng

| Tầng | Ở đâu | Chứa gì | Ai thấy |
|---|---|---|---|
| **On-chain ledger** | Mọi peer trong channel | Metadata, hash, consent, vaccination, insurance claims | Tất cả org |
| **PDC (private data)** | CouchDB của org trong policy | `diagnosis`, `prescription`, `chiefComplaint`, AES keys file | Chỉ org owning + org được share |
| **IPFS (off-chain)** | IPFS node local/cluster | Ciphertext của X-quang, MRI, PDF | Ai cũng tải được, nhưng chỉ org có key trong PDC mới decrypt được |

**Hiệu quả:** Dù BV3 dump CouchDB + crawl IPFS, cũng chỉ có được hash + ciphertext. Không có AES key (trong PDC Org1) → không decrypt. Cross-hospital sharing chỉ khả dụng khi bệnh nhân chủ động `shareRecord`.

## Access Control (ACL)

Chaincode enforce 2 lớp quyền:

**Lớp 1 — Role-based:** mỗi function check `role` của caller (patient/doctor/hospital/pharmacy/insurance/agent).

**Lớp 2 — Relationship-based:**
- **Patient** → chỉ đọc của chính mình
- **Doctor** → phải nằm trong `patient.authorizedDoctors` (do bệnh nhân `grantAccess`)
- **Hospital admin** → chỉ đọc bệnh nhân có ít nhất 1 bác sĩ thuộc BV mình được cấp quyền
- **Pharmacy** → như hospital admin (để dispense đơn thuốc)

**Cross-hospital sharing flow:** bệnh nhân dùng `shareRecord` (hoặc `shareAllRecords`) để copy private data từ `hospitalNCollection` sang `sharedClinicalCollection` → BV khác đọc được. Kèm `unshareRecord` để thu hồi.

## Project Structure

```
EHR-Hyperledger-Fabric-Project/
├── client/                               # React frontend (port 3000)
│   ├── src/
│   │   ├── pages/                        # Trang theo role
│   │   │   ├── PatientDashboard.jsx
│   │   │   ├── DoctorDashboard.jsx       # addRecord form có vital signs
│   │   │   ├── PatientRecords.jsx        # Consent + attachments + share
│   │   │   ├── Vaccinations.jsx          # Timeline tiêm chủng (CVX)
│   │   │   ├── Prescriptions.jsx
│   │   │   ├── AccessControl.jsx
│   │   │   ├── InsuranceClaims.jsx
│   │   │   ├── EmergencyLogs.jsx
│   │   │   ├── AdminLedger.jsx
│   │   │   ├── Register.jsx              # Form có Tier 1 demographics
│   │   │   └── Login.jsx
│   │   ├── components/
│   │   │   ├── Layout.jsx                # Sidebar nav theo role
│   │   │   └── AttachmentManager.jsx     # Upload/download IPFS files
│   │   ├── context/                      # AuthContext (JWT)
│   │   └── services/api.js               # Axios API layer
│   └── vite.config.js                    # Proxy /api → :5000
│
├── server-node-sdk/                      # Express backend (port 5000)
│   ├── app.js                            # 50+ API routes
│   ├── helper.js                         # Fabric CA & wallet
│   ├── fabric-connection.js              # Gateway
│   ├── invoke.js / query.js              # Chaincode invoke/query
│   ├── fhir.js                           # FHIR R4 adapter
│   ├── ipfs-helper.js                    # IPFS + AES-256-GCM encryption
│   ├── cert-script/                      # Admin & onboarding (Org1/2/3)
│   └── wallet/                           # Fabric identities
│
├── fabric-samples/
│   ├── test-network/                     # Fabric network
│   └── asset-transfer-basic/chaincode-javascript/
│       ├── collections_config.json       # PDC policy
│       └── lib/ehrChainCode.js           # Smart contract (~2000 dòng)
│
├── ipfs/                                 # IPFS node cho file storage
│   ├── docker-compose.yml
│   └── README.md
│
├── fabric-explorer/                      # Blockchain explorer (port 8080)
└── install-fabric.sh                     # Tải Fabric binaries
```

## Prerequisites

Cài trong **WSL (Ubuntu 22.04)**:

```bash
# Docker & docker-compose (qua Docker Desktop hoặc apt)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Setup & Installation

### 1. Download Fabric Binaries

```bash
./install-fabric.sh
```

### 2. Khởi động Fabric Network

```bash
cd fabric-samples/test-network
./network.sh up createChannel -ca -s couchdb
```

### 3. (Optional) Thêm Org3 trước khi deploy chaincode

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

**Tham số:**
- `-cccg`: collections config cho PDC
- `-ccep`: endorsement policy — mỗi BV tự endorse, không cần 3 bên duyệt
- `deployCC.sh` đã được sửa để auto-detect Org3

Khi chaincode đổi, bump version/sequence:
```bash
./network.sh deployCC ... -ccv 2.0 -ccs 2 ...
```

### 5. Khởi động IPFS Node

```bash
cd ipfs
docker compose up -d

# Verify
curl -X POST http://localhost:5001/api/v0/version
```

### 6. Register Admins & Onboard

```bash
cd server-node-sdk
npm install    # kèm multer cho file upload

# Org1 + Org2
node cert-script/registerHospitalAdmin.js
node cert-script/registerInsuranceAdmin.js
node cert-script/onboardDoctor.js
node cert-script/onboardPharmacy.js
node cert-script/onboardInsuranceCompany.js
node cert-script/onboardInsuranceAgent.js

# Org3 (nếu có)
node cert-script/registerHospital2Admin.js
node cert-script/onboardDoctorHos2.js
node cert-script/onboardPharmacyHos2.js
```

### 7. Start Backend

```bash
cd server-node-sdk
npm run dev    # http://localhost:5000

# Health check IPFS
curl http://localhost:5000/ipfsStatus
```

### 8. Start Frontend

```bash
cd client
npm install
npm run dev    # http://localhost:3000
```

### 9. (Optional) Start Explorer

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
cd ipfs && docker compose down
cd ../fabric-explorer && docker-compose down
cd ../fabric-samples/test-network && ./network.sh down
```

---

## Roles & Pages

| Role | Redirect | Trang chính |
|------|----------|-------------|
| `patient` | `/dashboard` | Tổng quan, Hồ sơ bệnh án, Tiêm chủng, Quyền truy cập, Đơn thuốc, Bảo hiểm, Nhật ký khẩn cấp |
| `doctor` | `/doctor` | Bảng điều khiển, Hồ sơ bệnh án, Tiêm chủng, Đơn thuốc, Truy cập khẩn cấp |
| `hospital` | `/admin/ledger` | Bác sĩ, Nhà thuốc, Sổ cái Blockchain |
| `pharmacy` | `/prescriptions` | Đơn thuốc (dispense) |
| `insurance` | `/insurance/agents` | Chi nhánh, Sổ cái Org2 |
| `agent` | `/insurance/pending` | Duyệt/từ chối claim |

---

## Features

### Patient Demographics (Tier 1)
Bệnh nhân đăng ký với bộ thông tin y tế đầy đủ:
- Giới tính, nhóm máu (A/B/AB/O ± Rh)
- SĐT, CCCD (12 số), BHYT (15 ký tự)
- Dị ứng, bệnh mãn tính (danh sách)
- Liên hệ khẩn cấp, địa chỉ chi tiết

### Hồ sơ bệnh án
- ICD-10 cho chẩn đoán, ATC cho thuốc — validate theo regex chuẩn
- **Vital signs** (public): nhiệt độ, huyết áp, mạch, SpO2, cân, cao
- **Visit type**: ngoại trú / nội trú / cấp cứu / tái khám / tư vấn
- **Chief complaint** (private PDC): lý do đến khám
- Diagnosis + prescription lưu PDC; chỉ BV điều trị + BV được share xem được
- Lịch sử version on-chain via `queryHistoryOfAsset`

### Consent-based Access & Sharing
- `grantAccess` / `revokeAccess` — bệnh nhân quyết quyền đọc
- `shareRecord` / `unshareRecord` — chia sẻ 1 hồ sơ qua PDC
- `shareAllRecords` / `unshareAllRecords` — bulk chia sẻ toàn bộ history khi chuyển viện
- Không ai (kể cả admin) cấp/share hộ được

### Vaccination History (CVX code)
- 15 vaccine phổ biến quick-pick (COVID Pfizer/Moderna/AZ, HepB, MMR, DTaP, HPV...)
- Timeline view với dot markers màu (xanh ok / vàng quá hạn / đỏ có phản ứng)
- Ghi đầy đủ: hãng SX, số lô, vị trí tiêm, liều số, ngày hẹn mũi tiếp
- Báo cáo phản ứng phụ 4 mức (Nhẹ/Vừa/Nặng/Nguy hiểm)
- Public ledger — cross-hospital visible (phục vụ public health)

### File y tế (IPFS + encryption)
- Upload X-quang, MRI, CT, siêu âm, ECG, lab report, discharge summary
- File encrypt AES-256-GCM trước khi upload IPFS
- Ciphertext lên IPFS (CID tự sinh từ hash); AES key lưu PDC
- On-chain: CID + sha256(plaintext) để audit integrity
- Download auto decrypt + verify hash — detect tampering
- Max 100MB/file, 9 loại file được phân loại

### Đơn thuốc
- Bác sĩ tạo prescription trong `addRecord`
- Nhà thuốc xác nhận cấp phát → ghi `dispensed` flag lên public ledger

### Bảo hiểm (cross-org)
- Bệnh nhân/bác sĩ tạo claim liên kết record
- Agent duyệt/từ chối; insurance admin xem sổ cái Org2

### Truy cập khẩn cấp
- Bác sĩ/admin có thể `emergencyAccess` khi bệnh nhân không thể cấp quyền
- Mọi truy cập ghi log bất biến; bệnh nhân xem được ai đã access

### Sổ cái Blockchain
- `fetchLedger` — metadata + hash (không có diagnosis/prescription plain)
- `fetchOrg2Ledger` — insurance, agent, claims

---

## API Endpoints

Base URL: `http://localhost:5000` — phần lớn **POST**, JSON body; upload là multipart/form-data.

### Authentication
| Endpoint | Mô tả |
|----------|-------|
| `/registerPatient` | Đăng ký bệnh nhân (Tier 1 demographics tùy chọn) |
| `/loginPatient` | Đăng nhập |
| `/updateProfile` | Cập nhật profile (patient/doctor) |
| `/changePassword` | Đổi mật khẩu |

### Medical Records
| Endpoint | Mô tả |
|----------|-------|
| `/addRecord` | Tạo hồ sơ (vital signs public + diagnosis/prescription PDC) |
| `/updateRecord` | Cập nhật (chỉ BV sở hữu) |
| `/getRecordById` | Lấy 1 hồ sơ (merge public + private) |
| `/getAllRecordsByPatientId` | Tất cả hồ sơ của bệnh nhân |
| `/queryHistoryOfAsset` | Lịch sử blockchain của 1 key |

### Access Control & Sharing
| Endpoint | Mô tả |
|----------|-------|
| `/grantAccess` / `/revokeAccess` | Cấp / thu hồi quyền bác sĩ |
| `/shareRecord` / `/unshareRecord` | Chia sẻ 1 record qua sharedClinicalCollection |
| `/shareAllRecords` / `/unshareAllRecords` | Bulk chia sẻ toàn bộ history |
| `/getPatientById` | Xem thông tin bệnh nhân |

### Vaccinations
| Endpoint | Mô tả |
|----------|-------|
| `/addVaccination` | Thêm mũi tiêm (CVX code) |
| `/getVaccinationsByPatient` | Timeline tiêm chủng |
| `/reportAdverseReaction` | Báo cáo phản ứng phụ |

### IPFS Attachments
| Endpoint | Mô tả |
|----------|-------|
| `/uploadAttachment` | Upload file (multipart, auto encrypt + IPFS + chain) |
| `/downloadAttachment` | Download (decrypt + verify hash) |
| `/getAttachmentsByPatient` | List attachments |
| `GET /ipfsStatus` | Health check IPFS node |

### Prescriptions
| Endpoint | Mô tả |
|----------|-------|
| `/getPrescriptionsByPatient` | Đơn thuốc của bệnh nhân |
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
| `/getAllHospitals`, `/getAllDoctors`, `/getAllPharmacies` | List |
| `/getAllInsuranceCompanies`, `/getAllAgents` | List BH |

### Ledger
| Endpoint | Mô tả |
|----------|-------|
| `/fetchLedger` | Sổ cái hospital (metadata + hash) |
| `/fetchOrg2Ledger` | Sổ cái insurance |

---

## Chaincode Functions

Smart contract [`ehrChainCode.js`](fabric-samples/asset-transfer-basic/chaincode-javascript/lib/ehrChainCode.js):

| Nhóm | Function |
|------|----------|
| **Patient** | `registerPatient`, `getPatientById`, `getAllPatients` |
| **Records** | `addRecord`, `updateRecord`, `getRecordById`, `getAllRecordsByPatientId`, `getRecordsByDoctor`, `queryHistoryOfAsset` |
| **Access & Share** | `grantAccess`, `revokeAccess`, `shareRecordWithHospital`, `unshareRecordFromHospital`, `shareAllRecordsWithHospital`, `unshareAllRecordsFromHospital` |
| **Vaccination** | `addVaccination`, `getVaccinationsByPatient`, `reportAdverseReaction` |
| **IPFS Attachment** | `addAttachment`, `getAttachmentDecryptionKey`, `getAttachmentsByPatient` |
| **Prescription** | `getPrescriptionsByPatient`, `verifyPrescription` |
| **Insurance** | `createClaim`, `getClaim`, `getClaimsByPatient`, `getAllClaims`, `approveClaim`, `rejectClaim` |
| **Emergency** | `emergencyAccess`, `getEmergencyLogs` |
| **Onboard** | `onboardHospital`, `onboardDoctor`, `onboardPharmacy`, `onboardInsuranceCompany`, `onboardInsuranceAgent` |
| **Admin** | `fetchLedger`, `fetchOrg2Ledger` |

### Key Storage Patterns

| Key Format | Loại dữ liệu | Tầng |
|------------|-------------|------|
| `patient-{id}` | Bệnh nhân (Tier 1 đầy đủ) | on-chain |
| `hospital-{id}`, `doctor-{id}`, `pharmacy-{id}` | Metadata | on-chain |
| `insurance-{id}`, `agent-{id}` | BH | on-chain |
| `record\|{patientId}\|{recordId}` | Metadata + vital signs + hash | on-chain |
| `record\|{patientId}\|{recordId}` (PDC) | diagnosis, prescription, chiefComplaint | **private (PDC)** |
| `vaccination\|{patientId}\|{vaxId}` | Mũi tiêm + CVX code | on-chain |
| `attachment\|{patientId}\|{recordId}\|{attId}` | CID + hash + metadata file | on-chain |
| `attachment\|...` (PDC) | AES key, IV, authTag | **private (PDC)** |
| `claim\|{patientId}\|{claimId}` | Claim BH | on-chain |
| `dispense\|{patientId}\|{dispenseId}` | Dispense log | on-chain |
| `emergency\|{patientId}\|{logId}` | Log khẩn cấp | on-chain |

Composite keys truy vấn bằng `getStateByPartialCompositeKey`.

---

## Data Validation

- **ICD-10** (format: `A00-Z99.9`) — chẩn đoán
- **ATC** (format: `1 chữ + 2 số + 2 chữ + 2 số`) — thuốc; validate liều, đường dùng
- **CVX** (1-3 chữ số, chuẩn CDC) — vaccine
- **CID** (CIDv0 `Qm...` hoặc CIDv1 `bafy.../bafk...`) — IPFS file
- **CCCD** 12 số VN, **BHYT** 15 ký tự chữ+số, **SĐT** 0xxxxxxxxx
- **Vital signs** range: nhiệt độ 30-45°C, SpO2 50-100%, huyết áp format `xxx/xx`
- Lý do truy cập khẩn cấp ≥ 10 ký tự

---

## FHIR R4 API

Adapter tại `http://localhost:5000/fhir` dịch dữ liệu EHR sang chuẩn **FHIR R4**.

| Method | Endpoint | FHIR Resource |
|--------|----------|---------------|
| GET | `/fhir/metadata` | CapabilityStatement |
| GET | `/fhir/Patient/:patientId` | Patient |
| GET | `/fhir/Patient/:patientId/$everything` | Bundle (Patient + Observations + MedicationRequests) |
| GET | `/fhir/Observation/:patientId/:recordId` | Observation (ICD-10) |
| GET | `/fhir/MedicationRequest/:patientId/:recordId` | MedicationRequest (ATC) |
| GET | `/fhir/Claim/:patientId/:claimId` | Claim |
| GET | `/fhir/Practitioner/:doctorId` | Practitioner |

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

## IPFS File Storage

### Flow upload
```
Frontend → multipart/form-data → Backend
  → encrypt AES-256-GCM (random key + IV)
  → POST /api/v0/add?pin=true → IPFS → CID
  → chaincode addAttachment:
     public ledger: { cid, sha256(plaintext), fileName, fileType, size }
     PDC hospital{N}Collection: { aesKeyHex, ivHex, authTagHex }
```

### Flow download
```
Frontend → /downloadAttachment → Backend
  → chaincode getAttachmentDecryptionKey (ACL + PDC)
  → POST /api/v0/cat?arg=<cid> → IPFS → ciphertext
  → AES-256-GCM decrypt
  → verify sha256(plaintext) khớp on-chain hash
  → stream plaintext về client
```

### Test cách ly
```bash
# Upload X-quang bằng BV1 doctor → lấy CID
# Thử tải raw từ IPFS gateway
curl http://localhost:8088/ipfs/<CID> --output leaked.bin

# Mở file → chỉ thấy binary garbage (ciphertext)
# Không có AES key trong PDC Org3 → không decrypt được
```

---

## Troubleshooting

**Backend không kết nối Fabric**
- `docker ps` kiểm tra peer/orderer còn chạy
- Sau `./network.sh down && up`, phải chạy lại scripts đăng ký admin

**Wallet lỗi khi start backend**
- Xóa `server-node-sdk/wallet/` rồi chạy lại cert scripts

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
- **Đúng thiết kế** — PDC cách ly. Bệnh nhân cần `shareRecord` hoặc `shareAllRecords` trước.

**IPFS upload/download fail**
- `curl http://localhost:5000/ipfsStatus` để check node
- `docker logs ehr-ipfs` xem log
- Nếu lỗi CORS: xem `ipfs/README.md` hướng dẫn bật CORS cho frontend

**`Access denied: no decryption key available`**
- Caller không có quyền đọc PDC (sai org)
- Hoặc file chưa share với collection mà caller truy cập được
- Cần `shareRecord` để copy key sang `sharedClinicalCollection`

**Tải xong nhưng file garbage**
- Hash mismatch → file đã bị tamper trên IPFS (hiếm) hoặc decrypt lỗi key
- Kiểm tra log backend: `Integrity check failed`

**Vite redirect loop / không vào được page**
- Xóa localStorage, đăng nhập lại
- Kiểm tra role trong `getHomeRedirect` (App.jsx)

## License

Apache 2.0 — xem [LICENSE](LICENSE).
