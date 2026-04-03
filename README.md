# Electronic Health Record (EHR) - Blockchain Based Platform

A decentralized healthcare system for secure management of electronic health records using **Hyperledger Fabric**. The platform enables patients, doctors, hospitals, pharmacies, insurance companies, and researchers to interact with medical data through role-based access control on an immutable blockchain ledger.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | Hyperledger Fabric 2.x, Fabric CA, CouchDB |
| **Smart Contract** | JavaScript Chaincode (Fabric Contract API 2.5) |
| **Backend** | Node.js, Express 5.x, Fabric Network SDK 2.2 |
| **Frontend** | React 18, Vite, Tailwind CSS 3.4, React Router 6 |
| **Explorer** | Hyperledger Explorer, PostgreSQL |
| **Infrastructure** | Docker, Docker Compose |

## Project Structure

```
EHR-main/
├── client/                        # React frontend (port 5173)
│   ├── src/
│   │   ├── pages/                 # Login, Dashboard, Records, AccessControl, ...
│   │   ├── components/            # Layout and shared UI components
│   │   ├── context/               # AuthContext (state management)
│   │   └── services/              # Axios API layer (30+ endpoints)
│   └── package.json
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

- **Docker** & **Docker Compose**
- **Node.js** 18+
- **Git**
- OS: Linux / macOS / Windows (WSL recommended)

## Setup & Installation

### 1. Download Fabric Binaries

```bash
./install-fabric.sh
```

### 2. Start the Blockchain Network

```bash
cd fabric-samples/test-network

# Create network with Certificate Authority and CouchDB
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
cd server-node-sdk/
npm install
# Register admins for both organizations
node cert-script/registerOrg1Admin.js
node cert-script/registerOrg2Admin.js

# Onboard entities
node cert-script/onboardHospital01.js
node cert-script/onboardDoctor.js
node cert-script/onboardPharmacy.js
node cert-script/onboardInsuranceCompany.js
node cert-script/onboardInsuranceAgent.js
```

### 5. Start the Backend Server

```bash
cd server-node-sdk/
npm run dev    # Runs on http://localhost:5000
```

### 6. Start the Frontend

```bash
cd client/
npm install
npm run dev    # Runs on http://localhost:3000
```

### 7. (Optional) Start Blockchain Explorer

```bash
cd fabric-explorer/

# Copy crypto materials from test-network
cp -r ../fabric-samples/test-network/organizations/ .

# Set environment variables
export EXPLORER_CONFIG_FILE_PATH=./config.json
export EXPLORER_PROFILE_DIR_PATH=./connection-profile
export FABRIC_CRYPTO_PATH=./organizations

# Start Explorer
docker-compose up -d    # Runs on http://localhost:8080
```

## Shutdown

```bash
# Stop Fabric Explorer
cd fabric-explorer/ && docker-compose down

# Stop Fabric network (removes all containers and crypto materials)
cd fabric-samples/test-network && ./network.sh down
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

## Data Validation Standards

- **ICD-10** codes for diagnosis (format: A00 - Z99.9)
- **ATC** codes for medications
- Medication dosage and unit validation
- Route of administration validation (oral, IV, IM, subcutaneous, etc.)
