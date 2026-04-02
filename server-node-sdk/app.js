'use strict';

const express = require('express');
const helper = require('./helper');
const invoke = require('./invoke');
const query = require('./query');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

app.listen(5000, function () {
    console.log('Node SDK server is running on 5000 port :) ');
});

app.get('/status', async function (req, res, next) {
    res.send("Server is up.");
})


app.post('/registerPatient', async function (req, res, next) {
    try {
        let {adminId, userId, name, dob, city} = req.body;

        console.log("Received request:", req.body);
        if (!userId) {
            throw new Error("Missing input data. Please enter userId.");
        }
        adminId = adminId || 'hospitalAdmin';
        // submitterId = identity dung de submit chaincode transaction
        const submitterId = req.body.submitterId || 'Hospital01';

        const result = await helper.registerUser(adminId, submitterId, userId, 'patient', {
            chaincodeFcn: 'onboardPatient',
            patientId: userId, name, dob, city
        });
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
        const {adminId, hospitalId, name, city} = req.body;
        if (!hospitalId || !name) {
            throw new Error("Missing hospitalId or name");
        }
        // Dang ky identity voi CA (role=hospital, hospitalId=chinh no)
        const result = await helper.registerUser(
            adminId || 'hospitalAdmin',
            adminId || 'hospitalAdmin',
            hospitalId,
            'hospital',
            { chaincodeFcn: 'onboardHospital', hospitalId, name, city },
            { hospitalId: hospitalId }
        );
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
        const {hospitalUserId, doctorId, name, city} = req.body;
        if (!doctorId || !name) {
            throw new Error("Missing doctorId or name");
        }
        const hospitalUser = hospitalUserId || 'Hospital01';
        // Dang ky identity voi CA (role=doctor, hospitalId tu hospital)
        const result = await helper.registerUser(
            'hospitalAdmin',
            hospitalUser,
            doctorId,
            'doctor',
            { chaincodeFcn: 'onboardDoctor', doctorId, name, city },
            { hospitalId: req.body.hospitalId || hospitalUser }
        );
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
        const {hospitalUserId, pharmacyId, name, city} = req.body;
        if (!pharmacyId || !name) {
            throw new Error("Missing pharmacyId or name");
        }
        const hospitalUser = hospitalUserId || 'Hospital01';
        const result = await helper.registerUser(
            'hospitalAdmin',
            hospitalUser,
            pharmacyId,
            'pharmacy',
            { chaincodeFcn: 'onboardPharmacy', pharmacyId, name, city },
            { hospitalId: req.body.hospitalId || hospitalUser }
        );
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
        const {companyId, name, city} = req.body;
        if (!companyId || !name) {
            throw new Error("Missing companyId or name");
        }
        const result = await helper.registerUser(
            'insuranceAdmin',
            'insuranceAdmin',
            companyId,
            'insuranceAdmin',
            { chaincodeFcn: 'onboardInsuranceCompany', companyId, name, city },
            { companyId: companyId }
        );
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
        const {companyUserId, agentId, name, city} = req.body;
        if (!agentId || !name) {
            throw new Error("Missing agentId or name");
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

app.post('/loginPatient', async function (req, res, next){
    try {
        let userId;

        // check request body        
        if (req.body.userId) {
            userId = req.body.userId;
            
        } else {
            console.log("Missing input data. Please enter all the user details.");
            throw new Error("Missing input data. Please enter all the user details.");
        }

        const result = await helper.login(userId);
        console.log("Result from user login function: ", result);
        //check response returned by login function and set API response accordingly
        res.status(200).send(result);
    } catch (error) {
        console.log("There was an error while logging in. Error is ", error);
        next(error);
    }

});


app.post('/queryHistoryOfAsset', async function (req, res, next){
    try {
        //  queryHistory(ctx, Id)
        let userId = req.body.userId;
        let recordId = req.body.recordId;
      
        const result = await query.getQuery('queryHistoryOfAsset',{recordId}, userId);
        // console.log("Response from chaincode", result);
        //check response returned by login function and set API response accordingly
        res.status(200).send(JSON.parse(result.data));
    } catch (error) {       
        next(error);
    }
});


app.post('/addRecord', async function (req, res, next){
    try {
        //  Only doctors can add records
        const {userId, patientId, diagnosis, prescription} = req.body;
        const result = await invoke.invokeTransaction('addRecord', {patientId, diagnosis, prescription}, userId);
              
        res.send({sucess:true, data: result})
                
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
        const result = await invoke.invokeTransaction('updateRecord', {patientId, recordId, diagnosis, prescription}, userId);
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

// ===========================================================================================
// RESEARCHER MODULE - Nghien cuu y te
// ===========================================================================================

// Dang ky nha nghien cuu (hospital admin)
app.post('/onboardResearcher', async function (req, res, next){
    try {
        const {userId, researcherId, name, institution, field} = req.body;
        const result = await invoke.invokeTransaction('onboardResearcher', {researcherId, name, institution, field}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// Nha nghien cuu gui yeu cau consent
app.post('/requestConsent', async function (req, res, next){
    try {
        const {userId, researcherId, patientId, purpose} = req.body;
        const result = await invoke.invokeTransaction('requestConsent', {researcherId, patientId, purpose}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// Benh nhan duyet/tu choi consent
app.post('/approveConsent', async function (req, res, next){
    try {
        const {userId, patientId, requestId, approved} = req.body;
        const result = await invoke.invokeTransaction('approveConsent', {patientId, requestId, approved}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// Nha nghien cuu lay du lieu an danh
app.post('/getAnonymizedData', async function (req, res, next){
    try {
        const {userId, researcherId, patientId} = req.body;
        const result = await query.getQuery('getAnonymizedData', {researcherId, patientId}, userId);
        res.status(200).send({ success: true, data: result});
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
// REWARD SYSTEM - He thong thuong
// ===========================================================================================

// Cap thuong cho benh nhan
app.post('/issueReward', async function (req, res, next){
    try {
        const {userId, patientId, amount, reason} = req.body;
        const result = await invoke.invokeTransaction('issueReward', {patientId, amount, reason}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// Benh nhan nhan thuong
app.post('/claimReward', async function (req, res, next){
    try {
        const {userId, patientId, rewardId} = req.body;
        const result = await invoke.invokeTransaction('claimReward', {patientId, rewardId}, userId);
        res.status(200).send({ success: true, data: result});
    } catch (error) {
        next(error);
    }
});

// Xem tat ca reward cua benh nhan
app.post('/getRewardsByPatient', async function (req, res, next){
    try {
        const {userId, patientId} = req.body;
        const result = await query.getQuery('getRewardsByPatient', {patientId}, userId);
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
    res.status(400).json({ success: false, error: err.message });
})
