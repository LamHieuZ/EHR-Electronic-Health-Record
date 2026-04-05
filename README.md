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

```
┌─────────────────────────────────────────────────────┐
│                    WSL / Linux                       │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │         Hyperledger Fabric Network            │  │
│  │   Org1 (Hospital) ◄──────► Org2 (Insurance)  │  │
│  │   Peer: port 7051            Peer: port 9051  │  │
│  │   CouchDB: port 5984         CouchDB: 7984    │  │
│  │   CA: port 7054              CA: port 8054    │  │
│  │             Channel: mychannel                │  │
│  │          Chaincode: ehrChainCode              │  │
│  └───────────────────────────────────────────────┘  │
│                        │ crypto/certs                │
└────────────────────────┼────────────────────────────┘
                         │ (copy to Windows)
┌────────────────────────┼────────────────────────────┐
│                   Windows Host                       │
│                        │                            │
│  ┌─────────────────────▼──────────────────────────┐ │
│  │     Backend: Node.js + Express (port 5000)     │ │
│  │     Fabric Network SDK → connects to WSL peers │ │
│  └────────────────────────────────────────────────┘ │
│                        │ REST API                    │
│  ┌─────────────────────▼──────────────────────────┐ │
│  │      Frontend: React + Vite (port 3000)        │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │   Hyperledger Explorer (port 8080)  [optional] │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
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

- **Docker** & **Docker Compose**
- **Node.js** 18+
- **Git**
- **OS:** Linux or Windows with WSL2 (Fabric network runs inside WSL; backend/frontend run on the Windows host)

## Setup & Installation

> **Note for Windows users:** Steps 1–3 run inside WSL. Steps 4–6 run on the Windows host. The crypto materials generated in WSL must be copied to Windows before starting the backend.

### 1. Download Fabric Binaries (WSL)

```bash
./install-fabric.sh
```

### 2. Start the Blockchain Network (WSL)

```bash
cd fabric-samples/test-network

# Create network with Certificate Authority and CouchDB
./network.sh up createChannel -ca -s couchdb
```

### 3. Deploy the EHR Chaincode (WSL)

```bash
./network.sh deployCC -ccn ehrChainCode \
  -ccp ../asset-transfer-basic/chaincode-javascript/ \
  -ccl javascript
```

### 4. Copy Crypto Materials to Windows

After the network is up, copy the generated organization certificates from WSL to your Windows project directory so the Node.js SDK (running on Windows) can access them:

```bash
# From WSL — copy the organizations folder to the server-node-sdk directory on Windows
cp -r fabric-samples/test-network/organizations/ server-node-sdk/
```

### 5. Register Admins & Onboard Organizations (Windows)

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

### 6. Start the Backend Server (Windows)

```bash
cd server-node-sdk/
npm run dev    # Runs on http://localhost:5000
```

### 7. Start the Frontend (Windows)

```bash
cd client/
npm install
npm run dev    # Runs on http://localhost:3000
```

### 8. (Optional) Start Blockchain Explorer

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

## Data Validation Standards

- **ICD-10** codes for diagnosis (format: A00 – Z99.9)
- **ATC** codes for medications
- Medication dosage and unit validation
- Route of administration validation (oral, IV, IM, subcutaneous, etc.)

## Troubleshooting

**Backend cannot connect to Fabric peers**
- Ensure the Fabric network is running in WSL (`./network.sh up ...`).
- Verify that the `organizations/` crypto folder was copied from WSL to the `server-node-sdk/` directory on Windows after the network started.
- Check that peer hostnames in the connection profile resolve correctly from Windows (may need `/etc/hosts` entries pointing to the WSL IP).

**`wallet/` identity errors on backend startup**
- Re-run the `registerOrg1Admin.js` / `registerOrg2Admin.js` scripts after any `./network.sh down` + `up` cycle, because new crypto materials are generated each time.

**Frontend shows blank page or API errors**
- Confirm the backend is running on port 5000.
- The Vite dev server proxies `/api` requests to `http://localhost:5000`; ensure there are no CORS errors in the browser console.

**Chaincode endorsement failures**
- Confirm the chaincode was deployed to **both** Org1 and Org2 peers before invoking transactions.

## License

Apache 2.0 — see [LICENSE](LICENSE).
