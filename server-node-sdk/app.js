'use strict';

const http = require('http');
const express = require('express');
const helper = require('./helper');
const invoke = require('./invoke');
const query = require('./query');
const cors = require('cors');
const fhirRouter = require('./fhir');

const app = express();
app.use(express.json());
app.use(cors());
app.use(fhirRouter);

const server = http.createServer(app);
server.listen(5000, function () {
    console.log('Node SDK server is running on 5000 port :) ');
});

server.on('error', (err) => {
    console.error('Server error:', err.message);
    process.exit(1);
});

app.get('/status', async function (req, res, next) {
    try {
        const { Gateway, Wallets } = require('fabric-network');
        const fs = require('fs');
        const path = require('path');
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        const identity = await wallet.get('hospitalAdmin');
        if (!identity) throw new Error('hospitalAdmin not found in wallet');
        const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations',
            'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'hospitalAdmin', discovery: { enabled: false } });
        const network = await gateway.getNetwork('mychannel');
        network.getChannel();
        gateway.disconnect();
        res.json({ status: 'ok', fabric: true });
    } catch (err) {
        res.status(503).json({ status: 'degraded', fabric: false, error: err.message });
    }
})


app.post('/registerPatient', async function (req, res, next) {
    try {
        let {adminId, userId, name, dob, city, password, orgId} = req.body;

        console.log("Received request:", req.body);
        if (!userId) {
            throw new Error("Missing input data. Please enter userId.");
        }
        if (!password || password.length < 4) {
            throw new Error("Password is required (min 4 characters).");
        }
        adminId = adminId || (orgId === 'Org3' ? 'hospital3Admin' : 'hospitalAdmin');
        const submitterId = req.body.submitterId || (orgId === 'Org3' ? 'hospital3Admin' : 'hospitalAdmin');

        const result = await helper.registerUser(adminId, submitterId, userId, 'patient', {
            chaincodeFcn: 'onboardPatient',
            patientId: userId, name, dob, city
        }, {}, orgId || null);

        // Luu hash password
        await helper.savePassword(userId, password);

        console.log("Result from user registration function:", result);
        res.status(200).send(result);
    } catch (error) {
        console.log("There was an error while registering the user. Error is ", error);
        next(error);
    }
});

// ===========================================================================================
// ONBOARD HOSPITAL - Dang ky benh vien moi (chi hospital admin)
// ===========================================================================================
app.post('/onboardHospital', async function (req, res, next) {
    try {
        const {adminId, hospitalId, name, city, password, orgId} = req.body;
        if (!hospitalId || !name) {
            throw new Error("Missing hospitalId or name");
        }
        if (!password || password.length < 4) {
            throw new Error("Password is required (min 4 characters).");
        }
        const admin = adminId || (orgId === 'Org3' ? 'hospital3Admin' : 'hospitalAdmin');
        const result = await helper.registerUser(
            admin, admin, hospitalId, 'hospital',
            { chaincodeFcn: 'onboardHospital', hospitalId, name, city },
            { hospitalId: hospitalId },
            orgId || null
        );
        await helper.savePassword(hospitalId, password);
        res.status(200).send(result);
    } catch (error) {
        next(error);
    }
});

// ===========================================================================================
// ONBOARD DOCTOR - Dang ky bac si moi (hospital dang ky)
// ===========================================================================================
app.post('/onboardDoctor', async function (req, res, next) {
    try {
        const {hospitalUserId, doctorId, name, city, dob, department, position, specialization, phone, password, orgId} = req.body;
        if (!doctorId || !name) {
            throw new Error("Missing doctorId or name");
        }
        if (!password || password.length < 4) {
            throw new Error("Password is required (min 4 characters).");
        }
        const admin = orgId === 'Org3' ? 'hospital3Admin' : 'hospitalAdmin';
        const result = await helper.registerUser(
            admin, admin, doctorId, 'doctor',
            { chaincodeFcn: 'onboardDoctor', doctorId, name, city, dob, department, position, specialization, phone },
            { hospitalId: req.body.hospitalId || admin },
            orgId || null
        );
        await helper.savePassword(doctorId, password);
        res.status(200).send(result);
    } catch (error) {
        next(error);
    }
});

// ===========================================================================================
// ONBOARD PHARMACY - Dang ky nha thuoc moi (hospital dang ky)
// ===========================================================================================
app.post('/onboardPharmacy', async function (req, res, next) {
    try {
        const {hospitalUserId, pharmacyId, name, city, password, orgId} = req.body;
        if (!pharmacyId || !name) {
            throw new Error("Missing pharmacyId or name");
        }
        if (!password || password.length < 4) {
            throw new Error("Password is required (min 4 characters).");
        }
        const admin = orgId === 'Org3' ? 'hospital3Admin' : 'hospitalAdmin';
        const result = await helper.registerUser(
            admin, admin, pharmacyId, 'pharmacy',
            { chaincodeFcn: 'onboardPharmacy', pharmacyId, name, city },
            { hospitalId: req.body.hospitalId || admin },
            orgId || null
        );
        await helper.savePassword(pharmacyId, password);
        res.status(200).send(result);
    } catch (error) {
        next(error);
    }
});

// ===========================================================================================
// ONBOARD INSURANCE COMPANY - Dang ky cong ty bao hiem moi
// ===========================================================================================
app.post('/onboardInsuranceCompany', async function (req, res, next) {
    try {
        const {companyId, name, city, password} = req.body;
        if (!companyId || !name) {
            throw new Error("Missing companyId or name");
        }
        if (!password || password.length < 4) {
            throw new Error("Password is required (min 4 characters).");
        }
        const result = await helper.registerUser(
            'insuranceAdmin',
            'insuranceAdmin',
            companyId,
            'insuranceAdmin',
            { chaincodeFcn: 'onboardInsuranceCompany', companyId, name, city },
            { companyId: companyId }
        );
        await helper.savePassword(companyId, password);
        res.status(200).send(result);
    } catch (error) {
        next(error);
    }
});

// ===========================================================================================
// ONBOARD INSURANCE AGENT - Dang ky dai ly bao hiem
// ===========================================================================================
app.post('/onboardInsuranceAgent', async function (req, res, next) {
    try {
        const {companyUserId, agentId, name, city, password} = req.body;
        if (!agentId || !name) {
            throw new Error("Missing agentId or name");
        }
        if (!password || password.length < 4) {
            throw new Error("Password is required (min 4 characters).");
        }
        const companyUser = companyUserId || 'insuranceCompany01';
        const result = await helper.registerUser(
            'insuranceAdmin',
            companyUser,
            agentId,
            'agent',
            { chaincodeFcn: 'onboardInsurance', agentId, name, city },
            { companyId: req.body.companyId || companyUser }
        );
        await helper.savePassword(agentId, password);
        res.status(200).send(result);
    } catch (error) {
        next(error);
    }
});

// ===========================================================================================
// QUERY - Lay danh sach benh vien, bac si, nha thuoc, bao hiem
// ===========================================================================================
app.post('/getAllHospitals', async function (req, res, next) {
    try {
        const {userId} = req.body;
        const result = await query.getQuery('getAllHospitals', {}, userId);
        res.status(200).send({ success: true, data: result });
    } catch (error) { next(error); }
});

app.post('/getAllDoctors', async function (req, res, next) {
    try {
        const {userId, hospitalId} = req.body;
        const result = await query.getQuery('getAllDoctors', {hospitalId: hospitalId || ''}, userId);
        res.status(200).send({ success: true, data: result });
    } catch (error) { next(error); }
});

app.post('/getAllPharmacies', async function (req, res, next) {
    try {
        const {userId, hospitalId} = req.body;
        const result = await query.getQuery('getAllPharmacies', {hospitalId: hospitalId || ''}, userId);
        res.status(200).send({ success: true, data: result });
    } catch (error) { next(error); }
});

app.post('/getAllInsuranceCompanies', async function (req, res, next) {
    try {
        const {userId} = req.body;
        const result = await query.getQuery('getAllInsuranceCompanies', {}, userId);
        res.status(200).send({ success: true, data: result });
    } catch (error) { next(error); }
});

app.post('/getAllAgents', async function (req, res, next) {
    try {
        const { userId } = req.body;
        const result = await query.getQuery('getAllAgents', {}, userId);
        res.status(200).send({ success: true, data: result });
    } catch (error) { next(error); }
});

app.post('/loginPatient', async function (req, res, next){
    try {
        let userId;
        let password = req.body.password || '';

        // check request body
        if (req.body.userId) {
            userId = req.body.userId.trim();

        } else {
            console.log("Missing input data. Please enter all the user details.");
            throw new Error("Missing input data. Please enter all the user details.");
        }

        const result = await helper.login(userId, password);
        console.log("Result from user login function: ", result);
        //check response returned by login function and set API response accordingly
        res.status(200).send(result);
    } catch (error) {
        console.log("There was an error while logging in. Error is ", error);
        next(error);
    }

});

// ===========================================================================================
// UPDATE PROFILE - Cap nhat thong tin ca nhan
// ===========================================================================================
app.post('/updateProfile', async function (req, res, next) {
    try {
        const { userId, name, dob, city, department, position, specialization, phone } = req.body;
        if (!userId) throw new Error('Missing userId');
        const result = await invoke.invokeTransaction('updateProfile', { name, dob, city, department, position, specialization, phone }, userId);
        res.status(200).send({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// ===========================================================================================
// CHANGE PASSWORD - Doi mat khau
// ===========================================================================================
app.post('/changePassword', async function (req, res, next) {
    try {
        const { userId, currentPassword, newPassword } = req.body;
        if (!userId) throw new Error('Missing userId');
        if (!newPassword || newPassword.length < 4) throw new Error('New password must be at least 4 characters');

        // Verify current password (neu co)
        const valid = await helper.verifyPassword(userId, currentPassword || '');
        // Neu user da co password thi phai nhap dung current password
        const fs = require('fs');
        const path = require('path');
        const storePath = path.join(process.cwd(), 'wallet', 'passwords.json');
        let store = {};
        try { if (fs.existsSync(storePath)) store = JSON.parse(fs.readFileSync(storePath, 'utf8')); } catch {}
        if (store[userId] && !valid) {
            throw new Error('Current password is incorrect');
        }

        await helper.savePassword(userId, newPassword);
        res.status(200).send({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        next(error);
    }
});

app.post('/queryHistoryOfAsset', async function (req, res, next){
    try {
        //  queryHistory(ctx, Id)
        let userId = req.body.userId;
        let recordId = req.body.recordId;
      
        const result = await query.getQuery('queryHistoryOfAsset', { assetId: recordId }, userId);
        res.status(200).send({ success: true, data: result });
    } catch (error) {       
        next(error);
    }
});


app.post('/addRecord', async function (req, res, next){
    try {
        //  Only doctors can add records
        const {userId, patientId, diagnosis, prescription} = req.body;
        const diagObj = typeof diagnosis === 'string' ? JSON.parse(diagnosis) : diagnosis;
        const presObj = typeof prescription === 'string' ? JSON.parse(prescription) : prescription;
        const result = await invoke.invokeTransaction('addRecord', {patientId, diagnosis: diagObj, prescription: presObj}, userId);
              
        res.send({success:true, data: result})
                
    } catch (error) {       
        next(error);
    }
});


app.post('/getAllRecordsByPatientId', async function (req, res, next){
    try {
        // getAllRecordsByPatientId(ctx, patientId
        const {userId, patientId} = req.body;  
        const result = await query.getQuery('getAllRecordsByPatientId',{patientId}, userId);

        console.log("Response from chaincode", result);
        res.status(200).send({ success: true, data:result});

    } catch (error) {       
        next(error);
    }
});

app.post('/getRecordById', async function (req, res, next){
    try {
        // getRecordById(ctx, patientId, recordId)
        const {userId, patientId, recordId} = req.body;  
        const result = await query.getQuery('getRecordById',{patientId, recordId}, userId);

        console.log("Response from chaincode", result);
        res.status(200).send({ success: true, data:result});

    } catch (error) {       
        next(error);
    }
});

app.post('/getAllPrescriptions', async function (req, res, next){
    try {
        const { userId } = req.body;
        // Get all patients first
        const patients = await query.getQuery('getAllPatients', {}, userId);
        const patientList = Array.isArray(patients) ? patients : [];

        // Fetch prescriptions for each patient in parallel
        const results = await Promise.allSettled(
            patientList.map(p =>
                query.getQuery('getPrescriptionsByPatient', { patientId: p.patientId }, userId)
                    .then(rxs => (Array.isArray(rxs) ? rxs : []).map(rx => ({ ...rx, patientId: p.patientId, patientName: p.name || '' })))
                    .catch(() => [])
            )
        );

        const allRx = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
        res.status(200).send({ success: true, data: allRx });
    } catch (error) {
        next(error);
    }
});

app.post('/getMyPatients', async function (req, res, next){
    try {
        const { userId } = req.body;
        const all = await query.getQuery('getAllPatients', {}, userId);
        const patients = Array.isArray(all) ? all : [];
        const mine = patients
            .filter(p => Array.isArray(p.authorizedDoctors) && p.authorizedDoctors.includes(userId))
            .map(p => ({ patientId: p.patientId, name: p.name || '' }));
        res.status(200).send({ success: true, data: mine });
    } catch (error) {
        next(error);
    }
});

app.post('/getPatientById', async function (req, res, next){
    try {
        const {userId, patientId} = req.body;
        const result = await query.getQuery('getPatientById',{patientId}, userId);
        console.log("Response from chaincode", result);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

app.post('/grantAccess', async function (req, res, next){
    try {
        // call this from patient 
        // grantAccess(ctx, patientId, doctorIdToGrant) - call by patient
        const {userId, patientId, doctorIdToGrant} = req.body;  
        const result = await invoke.invokeTransaction('grantAccess',{patientId:patientId, doctorIdToGrant:doctorIdToGrant}, userId);

        console.log("Response from chaincode", result);
        res.status(200).send({ success: true, data:result});

    } catch (error) {       
        next(error);
    }
});

// Admin (hospital) xem toan bo ledger
app.post('/fetchLedger', async function (req, res, next){
    try {
        let userId = req.body.userId;
        const result = await query.getQuery('fetchLedger', {}, userId);
        res.status(200).send({ success: true, data:result})
    } catch (error) {
        next(error);
    }
});

// Insurance admin (Org2) xem toan bo so cai Org2
app.post('/fetchOrg2Ledger', async function (req, res, next) {
    try {
        const { userId } = req.body;
        const result = await query.getQuery('fetchOrg2Ledger', {}, userId);
        res.status(200).send({ success: true, data: result });
    } catch (error) { next(error); }
});

// Insurance admin (Org2) xem ledger claims
app.post('/fetchInsuranceLedger', async function (req, res, next){
    try {
        const { userId } = req.body;
        const patients = await query.getQuery('getAllPatients', {}, userId);
        const patientList = Array.isArray(patients) ? patients : [];
        const results = await Promise.allSettled(
            patientList.map(p =>
                query.getQuery('getClaimsByPatient', { patientId: p.patientId }, userId)
                    .then(claims => {
                        const arr = Array.isArray(claims) ? claims :
                            (typeof claims === 'string' ? JSON.parse(claims || '[]') : []);
                        return arr.map(c => ({ ...c, patientName: p.name || '' }));
                    })
                    .catch(() => [])
            )
        );
        const allClaims = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
        allClaims.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.status(200).send({ success: true, data: allClaims });
    } catch (error) {
        next(error);
    }
});

// ===========================================================================================
// REVOKE ACCESS - Benh nhan thu hoi quyen bac si
// ===========================================================================================
app.post('/revokeAccess', async function (req, res, next){
    try {
        const {userId, patientId, doctorIdToRevoke} = req.body;
        const result = await invoke.invokeTransaction('revokeAccess', {patientId, doctorIdToRevoke}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// ===========================================================================================
// UPDATE RECORD - Bac si cap nhat ho so (chuan hoa ICD-10 & ATC)
// ===========================================================================================
app.post('/updateRecord', async function (req, res, next){
    try {
        const {userId, patientId, recordId, diagnosis, prescription} = req.body;
        const diagObj = typeof diagnosis === 'string' ? JSON.parse(diagnosis) : diagnosis;
        const presObj = typeof prescription === 'string' ? JSON.parse(prescription) : prescription;
        const result = await invoke.invokeTransaction('updateRecord', {patientId, recordId, diagnosis: diagObj, prescription: presObj}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// ===========================================================================================
// PRESCRIPTION MANAGEMENT - Quan ly don thuoc
// ===========================================================================================

// Lay tat ca don thuoc cua benh nhan
app.post('/getPrescriptionsByPatient', async function (req, res, next){
    try {
        const {userId, patientId} = req.body;
        const result = await query.getQuery('getPrescriptionsByPatient', {patientId}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// Nha thuoc xac nhan da phat thuoc
app.post('/verifyPrescription', async function (req, res, next){
    try {
        const {userId, patientId, recordId, dispensedBy, dispensedNotes} = req.body;
        const result = await invoke.invokeTransaction('verifyPrescription', {patientId, recordId, dispensedBy, dispensedNotes}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// ===========================================================================================
// INSURANCE MODULE - Bao hiem
// ===========================================================================================

// Tao yeu cau bao hiem
app.post('/createClaim', async function (req, res, next){
    try {
        const {userId, patientId, recordId, claimType, amount, description} = req.body;
        const result = await invoke.invokeTransaction('createClaim', {patientId, recordId, claimType, amount, description}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// Xem chi tiet 1 claim
app.post('/getClaim', async function (req, res, next){
    try {
        const {userId, patientId, claimId} = req.body;
        const result = await query.getQuery('getClaim', {patientId, claimId}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// Lay tat ca claim cua 1 benh nhan
app.post('/getClaimsByPatient', async function (req, res, next){
    try {
        const {userId, patientId} = req.body;
        const result = await query.getQuery('getClaimsByPatient', {patientId}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// Dai ly bao hiem duyet claim
app.post('/approveClaim', async function (req, res, next){
    try {
        const {userId, patientId, claimId, reviewNotes} = req.body;
        const result = await invoke.invokeTransaction('approveClaim', {patientId, claimId, reviewNotes}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// Dai ly bao hiem tu choi claim
app.post('/rejectClaim', async function (req, res, next){
    try {
        const {userId, patientId, claimId, reviewNotes} = req.body;
        const result = await invoke.invokeTransaction('rejectClaim', {patientId, claimId, reviewNotes}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// Lay tat ca claim cua toan bo benh nhan (insurance company/agent)
app.post('/getAllClaims', async function (req, res, next){
    try {
        const { userId } = req.body;
        const patients = await query.getQuery('getAllPatients', {}, userId);
        const patientList = Array.isArray(patients) ? patients : [];

        const results = await Promise.allSettled(
            patientList.map(p =>
                query.getQuery('getClaimsByPatient', { patientId: p.patientId }, userId)
                    .then(claims => {
                        const arr = Array.isArray(claims) ? claims :
                            (typeof claims === 'string' ? JSON.parse(claims || '[]') : []);
                        return arr.map(c => ({ ...c, patientName: p.name || '' }));
                    })
                    .catch(() => [])
            )
        );

        const allClaims = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
        // Sort by timestamp descending
        allClaims.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.status(200).send({ success: true, data: allClaims });
    } catch (error) {
        next(error);
    }
});

// ===========================================================================================
// EMERGENCY ACCESS - Truy cap khan cap
// ===========================================================================================

// Truy cap khan cap ho so benh nhan (co ghi log)
app.post('/emergencyAccess', async function (req, res, next){
    try {
        const {userId, patientId, reason} = req.body;
        const result = await invoke.invokeTransaction('emergencyAccess', {patientId, reason}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// Xem log truy cap khan cap
app.post('/getEmergencyLogs', async function (req, res, next){
    try {
        const {userId, patientId} = req.body;
        const result = await query.getQuery('getEmergencyLogs', {patientId}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// ===========================================================================================
// ERROR HANDLER
// ===========================================================================================
app.use((err, req, res, next) => {
    console.error("Error:", err.message);

    let statusCode = 500;
    const msg = err.message || 'Internal server error';

    if (msg.includes('not found') || msg.includes('not exist') || msg.includes('Not found')) {
        statusCode = 404;
    } else if (msg.includes('Missing') || msg.includes('Invalid') || msg.includes('Only ')
        || msg.includes('already') || msg.includes('Caller is not') || msg.includes('not authorized')) {
        statusCode = 400;
    }

    res.status(statusCode).json({ success: false, error: msg });
})
