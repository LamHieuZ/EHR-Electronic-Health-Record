'use strict';

// Deterministic stringify()
const stringify  = require('json-stringify-deterministic');
const sortKeysRecursive  = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');

class ehrChainCode extends Contract {

    // ===========================================================================================
    // ACTORS & ROLES:
    //   1. Government - network owner - admin access
    //   2. Hospital - Network organization - Read/Write (doctor data)
    //   3. Practicing physician/Doctor - Read/Write (Patient data w.r.t to hospital)
    //   4. Diagnostics center - Read/Write (Patient records w.r.t to diagnostics center)
    //   5. Pharmacies - Read/Write (Patient prescriptions w.r.t to pharma center)
    //   6. Researchers / R&D - Read data of hospital content, patient based on consent
    //   7. Insurance companies - Read/Write (Patient claims)
    //   8. Patient - Read/Write (All generated patient data)
    // ===========================================================================================

    // ===========================================================================================
    // DATA STRUCTURES (Chuẩn hóa theo ICD-10 & ATC code):
    //
    // patient-{patientId}: {
    //     patientId, name, dob, city,
    //     authorizedDoctors: ["D001", "D002"],
    //     consentRequests: [{ requestId, researcherId, purpose, status, timestamp }]
    // }
    //
    // record (composite key: record/{patientId}/{recordId}): {
    //     recordId, patientId, doctorId,
    //     diagnosis: {
    //         primary: { icdCode: "J11", description: "Influenza" },
    //         secondary: [{ icdCode: "R50.9", description: "Fever" }],
    //         notes: "free text"
    //     },
    //     prescription: {
    //         medications: [{
    //             drugCode: "N02BE01",    // ATC code
    //             drugName: "Paracetamol", // Generic name
    //             strength: "500",
    //             unit: "mg",
    //             dosage: { quantity: 1, frequency: 3, route: "oral", timing: "after_meal", duration: 5, durationUnit: "days" }
    //         }],
    //         notes: "free text"
    //     },
    //     timestamp, updatedAt, version
    // }
    //
    // claim (composite key: claim/{patientId}/{claimId}): {
    //     claimId, patientId, recordId, agentId,
    //     claimType, amount, description,
    //     status: "pending" | "approved" | "rejected",
    //     reviewedBy, reviewNotes, timestamp, updatedAt
    // }
    //
    // researcher-{researcherId}: { researcherId, name, institution, field, timestamp }
    //
    // emergency-log (composite key: emergency/{patientId}/{logId}): {
    //     logId, patientId, accessedBy, reason, timestamp
    // }
    // ===========================================================================================

    // ===========================================================================================
    // HELPER FUNCTIONS
    // ===========================================================================================

    // Tao recordId tu transaction ID (luon unique)
    recordIdGenerator(ctx) {
        const txId = ctx.stub.getTxID();
        return `record-${txId}`;
    }

    // Lay role va uuid tu client certificate
    getCallerAttributes(ctx) {
        const role = ctx.clientIdentity.getAttributeValue('role');
        const uuid = ctx.clientIdentity.getAttributeValue('uuid');

        if (!role || !uuid) {
            throw new Error('Missing role or uuid in client certificate');
        }

        return { role, uuid };
    }

    // Lay timestamp chuan ISO tu transaction
    getTimestamp(ctx) {
        return new Date(ctx.stub.getTxTimestamp().seconds.low * 1000).toISOString();
    }

    // ===========================================================================================
    // VALIDATION FUNCTIONS - Chuan hoa du lieu y te
    // ===========================================================================================

    // Validate ma ICD-10 (format: A00-Z99, co the co .0-.9)
    // Vi du hop le: "J11", "J11.1", "A09", "R50.9", "M54.5"
    validateIcdCode(code) {
        if (!code || typeof code !== 'string') return false;
        return /^[A-Z]\d{2}(\.\d{1,2})?$/.test(code);
    }

    // Validate ma ATC code (format: 1 chu cai + 2 so + 2 chu cai + 2 so)
    // Vi du hop le: "N02BE01" (Paracetamol), "A02BC01" (Omeprazole), "J01CA04" (Amoxicillin)
    validateAtcCode(code) {
        if (!code || typeof code !== 'string') return false;
        return /^[A-Z]\d{2}[A-Z]{2}\d{2}$/.test(code);
    }

    // Danh sach duong dung thuoc hop le
    // oral: uong, iv: tiem tinh mach, im: tiem bap, sc: tiem duoi da
    // topical: boi ngoai, inhaled: hit, rectal: dat truc trang, ophthalmic: nho mat
    getValidRoutes() {
        return ['oral', 'iv', 'im', 'sc', 'topical', 'inhaled', 'rectal', 'ophthalmic', 'nasal', 'sublingual'];
    }

    // Thoi diem uong thuoc hop le
    getValidTimings() {
        return ['before_meal', 'after_meal', 'with_meal', 'empty_stomach', 'bedtime', 'morning', 'as_needed'];
    }

    // Don vi thoi gian hop le
    getValidDurationUnits() {
        return ['days', 'weeks', 'months'];
    }

    // Don vi thuoc hop le
    getValidUnits() {
        return ['mg', 'g', 'ml', 'mcg', 'IU', 'unit', 'tablet', 'capsule', 'drop', 'puff'];
    }

    // Validate 1 loai thuoc trong don
    validateMedication(med) {
        if (!med.drugCode || !this.validateAtcCode(med.drugCode)) {
            throw new Error(`Invalid ATC drug code: ${med.drugCode}. Format: 1 letter + 2 digits + 2 letters + 2 digits (e.g. N02BE01)`);
        }
        if (!med.drugName || typeof med.drugName !== 'string' || med.drugName.trim().length === 0) {
            throw new Error('Drug name is required');
        }
        if (!med.strength || isNaN(Number(med.strength)) || Number(med.strength) <= 0) {
            throw new Error(`Invalid strength: ${med.strength}. Must be a positive number`);
        }
        if (!med.unit || !this.getValidUnits().includes(med.unit)) {
            throw new Error(`Invalid unit: ${med.unit}. Valid: ${this.getValidUnits().join(', ')}`);
        }
        if (!med.dosage || typeof med.dosage !== 'object') {
            throw new Error('Dosage information is required');
        }

        const d = med.dosage;
        if (!d.quantity || d.quantity <= 0) {
            throw new Error('Dosage quantity must be positive');
        }
        if (!d.frequency || d.frequency <= 0) {
            throw new Error('Dosage frequency must be positive');
        }
        if (!d.route || !this.getValidRoutes().includes(d.route)) {
            throw new Error(`Invalid route: ${d.route}. Valid: ${this.getValidRoutes().join(', ')}`);
        }
        if (d.timing && !this.getValidTimings().includes(d.timing)) {
            throw new Error(`Invalid timing: ${d.timing}. Valid: ${this.getValidTimings().join(', ')}`);
        }
        if (d.duration && (d.duration <= 0 || !this.getValidDurationUnits().includes(d.durationUnit))) {
            throw new Error(`Invalid duration. durationUnit must be: ${this.getValidDurationUnits().join(', ')}`);
        }
    }

    // Validate toan bo don thuoc (prescription object)
    validatePrescription(prescription) {
        if (!prescription || typeof prescription !== 'object') {
            throw new Error('Prescription must be an object');
        }
        if (!prescription.medications || !Array.isArray(prescription.medications) || prescription.medications.length === 0) {
            throw new Error('Prescription must have at least one medication');
        }
        for (const med of prescription.medications) {
            this.validateMedication(med);
        }
    }

    // Validate chan doan (diagnosis object)
    validateDiagnosis(diagnosis) {
        if (!diagnosis || typeof diagnosis !== 'object') {
            throw new Error('Diagnosis must be an object');
        }
        if (!diagnosis.primary || typeof diagnosis.primary !== 'object') {
            throw new Error('Primary diagnosis is required');
        }
        if (!this.validateIcdCode(diagnosis.primary.icdCode)) {
            throw new Error(`Invalid ICD-10 code: ${diagnosis.primary.icdCode}. Format: 1 letter + 2 digits, optional .1-2 digits (e.g. J11, R50.9)`);
        }
        if (!diagnosis.primary.description || diagnosis.primary.description.trim().length === 0) {
            throw new Error('Primary diagnosis description is required');
        }
        if (diagnosis.secondary && Array.isArray(diagnosis.secondary)) {
            for (const sec of diagnosis.secondary) {
                if (!this.validateIcdCode(sec.icdCode)) {
                    throw new Error(`Invalid secondary ICD-10 code: ${sec.icdCode}`);
                }
            }
        }
    }

    // ===========================================================================================
    // ONBOARDING FUNCTIONS
    // ===========================================================================================

    // Dang ky bac si vao ledger - chi hospital moi co quyen
    async onboardDoctor(ctx, args) {
        const { doctorId, hospitalName, name, city } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);
        const orgMSP = ctx.clientIdentity.getMSPID();

        if (orgMSP !== 'Org1MSP' || role !== 'hospital') {
            throw new Error('Only hospital can onboard doctor.');
        }

        const doctorJSON = await ctx.stub.getState(doctorId);
        if (doctorJSON && doctorJSON.length > 0) {
            throw new Error(`Doctor ${doctorId} already registered by ${callerId}`);
        }

        const recordId = this.recordIdGenerator(ctx);
        const record = {
            recordId,
            doctorId,
            hospitalId: callerId,
            name,
            hospitalName,
            city,
            timestamp: this.getTimestamp(ctx)
        };

        await ctx.stub.putState(doctorId, Buffer.from(stringify(record)));
        return stringify(record);
    }

    // Dang ky dai ly bao hiem - chi insurance admin moi co quyen
    async onboardInsurance(ctx, args) {
        const { agentId, insuranceCompany, name, city } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);
        const orgMSP = ctx.clientIdentity.getMSPID();

        if (orgMSP !== 'Org2MSP' || role !== 'insuranceAdmin') {
            throw new Error('Only insurance org admin can onboard insurance agent');
        }

        const insuranceJSON = await ctx.stub.getState(agentId);
        if (insuranceJSON && insuranceJSON.length > 0) {
            throw new Error(`Insurance ${agentId} already registered by ${callerId}`);
        }

        const recordId = this.recordIdGenerator(ctx);
        const record = {
            recordId,
            agentId,
            insuranceId: callerId,
            name,
            insuranceCompany,
            city,
            timestamp: this.getTimestamp(ctx)
        };

        await ctx.stub.putState(agentId, Buffer.from(stringify(record)));
        return stringify(record);
    }

    // Dang ky benh nhan vao ledger
    async onboardPatient(ctx, args) {
        const { patientId, name, dob, city } = JSON.parse(args);
        const key = `patient-${patientId}`;

        const existing = await ctx.stub.getState(key);
        if (existing && existing.length > 0) {
            throw new Error(`Patient ${patientId} already exists`);
        }

        const patient = {
            patientId,
            name,
            dob,
            city,
            authorizedDoctors: [],
            consentRequests: []
        };

        await ctx.stub.putState(key, Buffer.from(JSON.stringify(patient)));
        return `Patient ${patientId} registered`;
    }

    // Dang ky nha nghien cuu - chi hospital admin moi co quyen
    async onboardResearcher(ctx, args) {
        const { researcherId, name, institution, field } = JSON.parse(args);
        const { role } = this.getCallerAttributes(ctx);

        if (role !== 'hospital') {
            throw new Error('Only hospital admin can onboard researcher');
        }

        const key = `researcher-${researcherId}`;
        const existing = await ctx.stub.getState(key);
        if (existing && existing.length > 0) {
            throw new Error(`Researcher ${researcherId} already exists`);
        }

        const researcher = {
            researcherId,
            name,
            institution,
            field,
            approvedPatients: [],
            timestamp: this.getTimestamp(ctx)
        };

        await ctx.stub.putState(key, Buffer.from(JSON.stringify(researcher)));
        return JSON.stringify({ message: `Researcher ${researcherId} registered`, data: researcher });
    }

    // ===========================================================================================
    // ACCESS CONTROL - Cap quyen & thu hoi quyen
    // ===========================================================================================

    // Benh nhan cap quyen cho bac si truy cap ho so
    async grantAccess(ctx, args) {
        const { patientId, doctorIdToGrant } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'patient') {
            throw new Error('Only patients can grant access');
        }
        if (callerId !== patientId) {
            throw new Error('Caller is not the owner of this patient record');
        }

        const patientJSON = await ctx.stub.getState(`patient-${patientId}`);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientId} not found`);
        }

        const patient = JSON.parse(patientJSON.toString());

        if (patient.authorizedDoctors.includes(doctorIdToGrant)) {
            throw new Error(`Doctor ${doctorIdToGrant} already authorized`);
        }

        patient.authorizedDoctors.push(doctorIdToGrant);
        await ctx.stub.putState(`patient-${patientId}`, Buffer.from(stringify(patient)));

        return JSON.stringify({ message: `Access granted to doctor ${doctorIdToGrant}` });
    }

    // Benh nhan THU HOI quyen cua bac si
    async revokeAccess(ctx, args) {
        const { patientId, doctorIdToRevoke } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'patient') {
            throw new Error('Only patients can revoke access');
        }
        if (callerId !== patientId) {
            throw new Error('Caller is not the owner of this patient record');
        }

        const patientJSON = await ctx.stub.getState(`patient-${patientId}`);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientId} not found`);
        }

        const patient = JSON.parse(patientJSON.toString());
        const index = patient.authorizedDoctors.indexOf(doctorIdToRevoke);

        if (index === -1) {
            throw new Error(`Doctor ${doctorIdToRevoke} is not in authorized list`);
        }

        patient.authorizedDoctors.splice(index, 1);
        await ctx.stub.putState(`patient-${patientId}`, Buffer.from(stringify(patient)));

        return JSON.stringify({ message: `Access revoked for doctor ${doctorIdToRevoke}` });
    }

    // ===========================================================================================
    // MEDICAL RECORDS - Ho so y te (CHUAN HOA ICD-10 & ATC code)
    // ===========================================================================================

    // Bac si them ho so benh an - DU LIEU CHUAN HOA
    // diagnosis phai dung ma ICD-10, prescription phai dung ma ATC code
    // Chi bac si duoc benh nhan cap quyen moi co the them
    async addRecord(ctx, args) {
        const { patientId, diagnosis, prescription } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'doctor') {
            throw new Error('Only doctors can add records');
        }

        const patientJSON = await ctx.stub.getState(`patient-${patientId}`);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientId} not found`);
        }

        const patient = JSON.parse(patientJSON.toString());
        if (!patient.authorizedDoctors.includes(callerId)) {
            throw new Error(`Doctor ${callerId} is not authorized for patient ${patientId}`);
        }

        // Validate diagnosis theo chuan ICD-10
        this.validateDiagnosis(diagnosis);

        // Validate prescription theo chuan ATC code
        this.validatePrescription(prescription);

        const txId = ctx.stub.getTxID();
        const recordId = `R-${txId}`;
        const timestamp = this.getTimestamp(ctx);

        const recordKey = ctx.stub.createCompositeKey('record', [patientId, recordId]);

        const record = {
            recordId,
            patientId,
            doctorId: callerId,
            diagnosis,
            prescription,
            timestamp,
            updatedAt: timestamp,
            version: 1
        };

        await ctx.stub.putState(recordKey, Buffer.from(JSON.stringify(record)));
        return JSON.stringify({ message: `Record ${recordId} added for patient ${patientId}`, recordId });
    }

    // Bac si cap nhat ho so benh an - phai la bac si da tao record hoac duoc cap quyen
    async updateRecord(ctx, args) {
        const { patientId, recordId, diagnosis, prescription } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'doctor') {
            throw new Error('Only doctors can update records');
        }

        // Kiem tra benh nhan ton tai va bac si co quyen
        const patientJSON = await ctx.stub.getState(`patient-${patientId}`);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientId} not found`);
        }
        const patient = JSON.parse(patientJSON.toString());
        if (!patient.authorizedDoctors.includes(callerId)) {
            throw new Error(`Doctor ${callerId} is not authorized for patient ${patientId}`);
        }

        // Lay record hien tai
        const recordKey = ctx.stub.createCompositeKey('record', [patientId, recordId]);
        const recordJSON = await ctx.stub.getState(recordKey);
        if (!recordJSON || recordJSON.length === 0) {
            throw new Error(`Record ${recordId} not found for patient ${patientId}`);
        }

        const existingRecord = JSON.parse(recordJSON.toString());

        // Validate du lieu moi neu co
        if (diagnosis) {
            this.validateDiagnosis(diagnosis);
            existingRecord.diagnosis = diagnosis;
        }
        if (prescription) {
            this.validatePrescription(prescription);
            existingRecord.prescription = prescription;
        }

        existingRecord.updatedAt = this.getTimestamp(ctx);
        existingRecord.updatedBy = callerId;
        existingRecord.version = (existingRecord.version || 1) + 1;

        await ctx.stub.putState(recordKey, Buffer.from(JSON.stringify(existingRecord)));
        return JSON.stringify({ message: `Record ${recordId} updated`, version: existingRecord.version });
    }

    // ===========================================================================================
    // QUERY FUNCTIONS - Truy van du lieu
    // ===========================================================================================

    // Lay tat ca ho so cua 1 benh nhan
    async getAllRecordsByPatientId(ctx, args) {
        const { patientId } = JSON.parse(args);
        const iterator = await ctx.stub.getStateByPartialCompositeKey('record', [patientId]);
        const results = [];

        for await (const res of iterator) {
            results.push(JSON.parse(res.value.toString('utf8')));
        }

        return JSON.stringify(results);
    }

    // Lay 1 ho so cu the theo ID
    async getRecordById(ctx, args) {
        const { patientId, recordId } = JSON.parse(args);
        const recordKey = ctx.stub.createCompositeKey('record', [patientId, recordId]);
        const recordJSON = await ctx.stub.getState(recordKey);

        if (!recordJSON || recordJSON.length === 0) {
            throw new Error(`Record ${recordId} not found for patient ${patientId}`);
        }

        return recordJSON.toString();
    }

    // Lay thong tin benh nhan theo ID
    async getPatientById(ctx, args) {
        const { patientId } = JSON.parse(args);
        const patientJSON = await ctx.stub.getState(`patient-${patientId}`);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientId} not found`);
        }
        return patientJSON.toString();
    }

    // Lay tat ca benh nhan
    async getAllPatients(ctx) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const results = [];

        for await (const res of iterator) {
            if (res.key.startsWith('patient-')) {
                results.push(JSON.parse(res.value.toString()));
            }
        }

        return JSON.stringify(results);
    }

    // Lay tat ca ho so do 1 bac si tao
    async getRecordsByDoctor(ctx, args) {
        const { doctorId } = JSON.parse(args);
        const results = [];
        const iterator = await ctx.stub.getStateByRange('', '');

        for await (const res of iterator) {
            if (res.key.startsWith('\x00record')) {
                const record = JSON.parse(res.value.toString());
                if (record.doctorId === doctorId) {
                    results.push(record);
                }
            }
        }

        return JSON.stringify(results);
    }

    // Admin (hospital) xem toan bo ledger
    async fetchLedger(ctx) {
        const { role } = this.getCallerAttributes(ctx);

        if (role !== 'hospital') {
            throw new Error('Only hospital can fetch blockchain ledger');
        }

        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push(record);
            result = await iterator.next();
        }
        return stringify(allResults);
    }

    // Xem lich su thay doi cua 1 asset
    async queryHistoryOfAsset(ctx, args) {
        const { assetId } = JSON.parse(args);
        const iterator = await ctx.stub.getHistoryForKey(assetId);
        const results = [];

        while (true) {
            const res = await iterator.next();

            if (res.value) {
                const tx = {
                    txId: res.value.txId,
                    timestamp: res.value.timestamp ? res.value.timestamp.toISOString() : null,
                    isDelete: res.value.isDelete,
                };
                try {
                    if (res.value.value && res.value.value.length > 0 && !res.value.isDelete) {
                        tx.asset = JSON.parse(res.value.value.toString('utf8'));
                    }
                } catch (err) {
                    tx.asset = null;
                }
                results.push(tx);
            }

            if (res.done) {
                await iterator.close();
                break;
            }
        }

        return JSON.stringify(results);
    }

    // ===========================================================================================
    // PRESCRIPTION MANAGEMENT - Quan ly don thuoc
    // ===========================================================================================

    // Lay tat ca don thuoc cua 1 benh nhan (trich xuat tu records)
    async getPrescriptionsByPatient(ctx, args) {
        const { patientId } = JSON.parse(args);
        const iterator = await ctx.stub.getStateByPartialCompositeKey('record', [patientId]);
        const prescriptions = [];

        for await (const res of iterator) {
            const record = JSON.parse(res.value.toString('utf8'));
            if (record.prescription && record.prescription.medications) {
                prescriptions.push({
                    recordId: record.recordId,
                    patientId: record.patientId,
                    doctorId: record.doctorId,
                    prescription: record.prescription,
                    diagnosis: record.diagnosis.primary,
                    timestamp: record.timestamp
                });
            }
        }

        return JSON.stringify(prescriptions);
    }

    // Nha thuoc xac nhan da phat thuoc theo don
    // Tao ban ghi "dispensed" lien ket voi record goc
    async verifyPrescription(ctx, args) {
        const { patientId, recordId, dispensedBy, dispensedNotes } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'pharmacy') {
            throw new Error('Only pharmacy can verify/dispense prescriptions');
        }

        // Kiem tra record ton tai
        const recordKey = ctx.stub.createCompositeKey('record', [patientId, recordId]);
        const recordJSON = await ctx.stub.getState(recordKey);
        if (!recordJSON || recordJSON.length === 0) {
            throw new Error(`Record ${recordId} not found for patient ${patientId}`);
        }

        const txId = ctx.stub.getTxID();
        const dispenseId = `DISP-${txId}`;
        const dispenseKey = ctx.stub.createCompositeKey('dispense', [patientId, dispenseId]);

        const dispenseRecord = {
            dispenseId,
            recordId,
            patientId,
            dispensedBy: dispensedBy || callerId,
            pharmacyId: callerId,
            dispensedNotes: dispensedNotes || '',
            status: 'dispensed',
            timestamp: this.getTimestamp(ctx)
        };

        await ctx.stub.putState(dispenseKey, Buffer.from(JSON.stringify(dispenseRecord)));
        return JSON.stringify({ message: `Prescription ${recordId} dispensed`, dispenseId });
    }

    // ===========================================================================================
    // INSURANCE MODULE - Bao hiem
    // ===========================================================================================

    // Tao yeu cau bao hiem (benh nhan hoac bac si tao)
    async createClaim(ctx, args) {
        const { patientId, recordId, claimType, amount, description } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        // Chi benh nhan hoac bac si moi co the tao claim
        if (role !== 'patient' && role !== 'doctor') {
            throw new Error('Only patient or doctor can create insurance claim');
        }

        // Neu la benh nhan, phai la chinh benh nhan do
        if (role === 'patient' && callerId !== patientId) {
            throw new Error('Patient can only create claims for themselves');
        }

        // Kiem tra benh nhan ton tai
        const patientJSON = await ctx.stub.getState(`patient-${patientId}`);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientId} not found`);
        }

        // Kiem tra record ton tai (neu co)
        if (recordId) {
            const recordKey = ctx.stub.createCompositeKey('record', [patientId, recordId]);
            const recordJSON = await ctx.stub.getState(recordKey);
            if (!recordJSON || recordJSON.length === 0) {
                throw new Error(`Record ${recordId} not found for patient ${patientId}`);
            }
        }

        // Validate so tien
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            throw new Error('Claim amount must be a positive number');
        }

        const validClaimTypes = ['hospitalization', 'outpatient', 'medication', 'surgery', 'diagnostic', 'emergency', 'other'];
        if (!claimType || !validClaimTypes.includes(claimType)) {
            throw new Error(`Invalid claim type. Valid: ${validClaimTypes.join(', ')}`);
        }

        const txId = ctx.stub.getTxID();
        const claimId = `CLM-${txId}`;
        const claimKey = ctx.stub.createCompositeKey('claim', [patientId, claimId]);

        const claim = {
            claimId,
            patientId,
            recordId: recordId || null,
            createdBy: callerId,
            createdByRole: role,
            claimType,
            amount: Number(amount),
            description: description || '',
            status: 'pending',
            reviewedBy: null,
            reviewNotes: null,
            timestamp: this.getTimestamp(ctx),
            updatedAt: null
        };

        await ctx.stub.putState(claimKey, Buffer.from(JSON.stringify(claim)));
        return JSON.stringify({ message: `Claim ${claimId} created`, claimId });
    }

    // Xem chi tiet 1 claim
    async getClaim(ctx, args) {
        const { patientId, claimId } = JSON.parse(args);
        const claimKey = ctx.stub.createCompositeKey('claim', [patientId, claimId]);
        const claimJSON = await ctx.stub.getState(claimKey);

        if (!claimJSON || claimJSON.length === 0) {
            throw new Error(`Claim ${claimId} not found for patient ${patientId}`);
        }

        return claimJSON.toString();
    }

    // Lay tat ca claim cua 1 benh nhan
    async getClaimsByPatient(ctx, args) {
        const { patientId } = JSON.parse(args);
        const iterator = await ctx.stub.getStateByPartialCompositeKey('claim', [patientId]);
        const results = [];

        for await (const res of iterator) {
            results.push(JSON.parse(res.value.toString('utf8')));
        }

        return JSON.stringify(results);
    }

    // Dai ly bao hiem DUYET claim
    async approveClaim(ctx, args) {
        const { patientId, claimId, reviewNotes } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'agent' && role !== 'insuranceAdmin') {
            throw new Error('Only insurance agent or admin can approve claims');
        }

        const claimKey = ctx.stub.createCompositeKey('claim', [patientId, claimId]);
        const claimJSON = await ctx.stub.getState(claimKey);
        if (!claimJSON || claimJSON.length === 0) {
            throw new Error(`Claim ${claimId} not found for patient ${patientId}`);
        }

        const claim = JSON.parse(claimJSON.toString());
        if (claim.status !== 'pending') {
            throw new Error(`Claim ${claimId} is already ${claim.status}`);
        }

        claim.status = 'approved';
        claim.reviewedBy = callerId;
        claim.reviewNotes = reviewNotes || '';
        claim.updatedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(claimKey, Buffer.from(JSON.stringify(claim)));
        return JSON.stringify({ message: `Claim ${claimId} approved`, claim });
    }

    // Dai ly bao hiem TU CHOI claim
    async rejectClaim(ctx, args) {
        const { patientId, claimId, reviewNotes } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'agent' && role !== 'insuranceAdmin') {
            throw new Error('Only insurance agent or admin can reject claims');
        }

        const claimKey = ctx.stub.createCompositeKey('claim', [patientId, claimId]);
        const claimJSON = await ctx.stub.getState(claimKey);
        if (!claimJSON || claimJSON.length === 0) {
            throw new Error(`Claim ${claimId} not found for patient ${patientId}`);
        }

        const claim = JSON.parse(claimJSON.toString());
        if (claim.status !== 'pending') {
            throw new Error(`Claim ${claimId} is already ${claim.status}`);
        }

        claim.status = 'rejected';
        claim.reviewedBy = callerId;
        claim.reviewNotes = reviewNotes || 'Claim rejected';
        claim.updatedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(claimKey, Buffer.from(JSON.stringify(claim)));
        return JSON.stringify({ message: `Claim ${claimId} rejected`, claim });
    }

    // ===========================================================================================
    // RESEARCHER MODULE - Nghien cuu y te
    // ===========================================================================================

    // Nha nghien cuu gui yeu cau xin phep truy cap du lieu benh nhan
    async requestConsent(ctx, args) {
        const { researcherId, patientId, purpose } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'researcher') {
            throw new Error('Only researchers can request consent');
        }

        // Kiem tra researcher ton tai
        const researcherJSON = await ctx.stub.getState(`researcher-${researcherId}`);
        if (!researcherJSON || researcherJSON.length === 0) {
            throw new Error(`Researcher ${researcherId} not found`);
        }

        // Kiem tra benh nhan ton tai
        const patientJSON = await ctx.stub.getState(`patient-${patientId}`);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientId} not found`);
        }

        const patient = JSON.parse(patientJSON.toString());
        if (!patient.consentRequests) {
            patient.consentRequests = [];
        }

        // Kiem tra da co request chua
        const existingRequest = patient.consentRequests.find(
            r => r.researcherId === researcherId && r.status === 'pending'
        );
        if (existingRequest) {
            throw new Error(`Pending consent request already exists from researcher ${researcherId}`);
        }

        const txId = ctx.stub.getTxID();
        const requestId = `CONSENT-${txId}`;

        patient.consentRequests.push({
            requestId,
            researcherId,
            purpose: purpose || '',
            status: 'pending',
            timestamp: this.getTimestamp(ctx)
        });

        await ctx.stub.putState(`patient-${patientId}`, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify({ message: `Consent request sent to patient ${patientId}`, requestId });
    }

    // Benh nhan duyet hoac tu choi yeu cau consent
    async approveConsent(ctx, args) {
        const { patientId, requestId, approved } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'patient') {
            throw new Error('Only patients can approve/reject consent requests');
        }
        if (callerId !== patientId) {
            throw new Error('Caller is not the owner of this patient record');
        }

        const patientJSON = await ctx.stub.getState(`patient-${patientId}`);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientId} not found`);
        }

        const patient = JSON.parse(patientJSON.toString());
        const request = patient.consentRequests.find(r => r.requestId === requestId);

        if (!request) {
            throw new Error(`Consent request ${requestId} not found`);
        }
        if (request.status !== 'pending') {
            throw new Error(`Consent request ${requestId} is already ${request.status}`);
        }

        request.status = approved ? 'approved' : 'rejected';
        request.respondedAt = this.getTimestamp(ctx);

        // Neu duyet, them researcher vao danh sach approved cua researcher
        if (approved) {
            const researcherJSON = await ctx.stub.getState(`researcher-${request.researcherId}`);
            if (researcherJSON && researcherJSON.length > 0) {
                const researcher = JSON.parse(researcherJSON.toString());
                if (!researcher.approvedPatients.includes(patientId)) {
                    researcher.approvedPatients.push(patientId);
                    await ctx.stub.putState(`researcher-${request.researcherId}`, Buffer.from(JSON.stringify(researcher)));
                }
            }
        }

        await ctx.stub.putState(`patient-${patientId}`, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify({ message: `Consent request ${requestId} ${request.status}` });
    }

    // Nha nghien cuu lay du lieu AN DANH cua benh nhan da dong y
    // Du lieu duoc loai bo thong tin ca nhan (ten, ngay sinh cu the)
    async getAnonymizedData(ctx, args) {
        const { researcherId, patientId } = JSON.parse(args);
        const { role } = this.getCallerAttributes(ctx);

        if (role !== 'researcher') {
            throw new Error('Only researchers can access anonymized data');
        }

        // Kiem tra researcher co quyen truy cap khong
        const researcherJSON = await ctx.stub.getState(`researcher-${researcherId}`);
        if (!researcherJSON || researcherJSON.length === 0) {
            throw new Error(`Researcher ${researcherId} not found`);
        }

        const researcher = JSON.parse(researcherJSON.toString());
        if (!researcher.approvedPatients.includes(patientId)) {
            throw new Error(`Researcher ${researcherId} does not have consent from patient ${patientId}`);
        }

        // Lay du lieu benh nhan
        const patientJSON = await ctx.stub.getState(`patient-${patientId}`);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientId} not found`);
        }

        const patient = JSON.parse(patientJSON.toString());

        // Lay tat ca record
        const iterator = await ctx.stub.getStateByPartialCompositeKey('record', [patientId]);
        const records = [];
        for await (const res of iterator) {
            const record = JSON.parse(res.value.toString('utf8'));
            // An danh hoa: chi giu lai du lieu y te, bo thong tin dinh danh
            records.push({
                recordId: record.recordId,
                diagnosis: record.diagnosis,
                prescription: record.prescription,
                timestamp: record.timestamp
            });
        }

        // Tra ve du lieu an danh
        const anonymized = {
            anonymousId: `ANON-${patientId.substring(0, 4)}`,
            ageRange: this.calculateAgeRange(patient.dob),
            city: patient.city,
            totalRecords: records.length,
            records
        };

        return JSON.stringify(anonymized);
    }

    // Tinh khoang tuoi de an danh (khong tra ve tuoi chinh xac)
    calculateAgeRange(dob) {
        if (!dob) return 'unknown';
        const birth = new Date(dob);
        const now = new Date();
        const age = now.getFullYear() - birth.getFullYear();
        if (age < 18) return '0-17';
        if (age < 30) return '18-29';
        if (age < 45) return '30-44';
        if (age < 60) return '45-59';
        return '60+';
    }

    // ===========================================================================================
    // EMERGENCY ACCESS - Truy cap khan cap
    // ===========================================================================================

    // Truy cap ho so benh nhan trong truong hop khan cap
    // Chi hospital admin co quyen, moi lan truy cap deu duoc ghi log
    async emergencyAccess(ctx, args) {
        const { patientId, reason } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'hospital' && role !== 'doctor') {
            throw new Error('Only hospital admin or doctor can use emergency access');
        }

        if (!reason || reason.trim().length < 10) {
            throw new Error('Emergency access requires a detailed reason (min 10 characters)');
        }

        // Lay du lieu benh nhan
        const patientJSON = await ctx.stub.getState(`patient-${patientId}`);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientId} not found`);
        }

        // Ghi log truy cap khan cap (audit trail)
        const txId = ctx.stub.getTxID();
        const logId = `EMER-${txId}`;
        const logKey = ctx.stub.createCompositeKey('emergency', [patientId, logId]);

        const emergencyLog = {
            logId,
            patientId,
            accessedBy: callerId,
            accessedByRole: role,
            reason,
            timestamp: this.getTimestamp(ctx)
        };

        await ctx.stub.putState(logKey, Buffer.from(JSON.stringify(emergencyLog)));

        // Lay tat ca record cua benh nhan
        const iterator = await ctx.stub.getStateByPartialCompositeKey('record', [patientId]);
        const records = [];
        for await (const res of iterator) {
            records.push(JSON.parse(res.value.toString('utf8')));
        }

        const patient = JSON.parse(patientJSON.toString());

        return JSON.stringify({
            emergencyLogId: logId,
            patient: {
                patientId: patient.patientId,
                name: patient.name,
                dob: patient.dob,
                city: patient.city
            },
            records
        });
    }

    // Xem log truy cap khan cap cua 1 benh nhan (chi hospital admin)
    async getEmergencyLogs(ctx, args) {
        const { patientId } = JSON.parse(args);
        const { role } = this.getCallerAttributes(ctx);

        if (role !== 'hospital') {
            throw new Error('Only hospital admin can view emergency access logs');
        }

        const iterator = await ctx.stub.getStateByPartialCompositeKey('emergency', [patientId]);
        const results = [];

        for await (const res of iterator) {
            results.push(JSON.parse(res.value.toString('utf8')));
        }

        return JSON.stringify(results);
    }

    // ===========================================================================================
    // REWARD SYSTEM - He thong thuong cho benh nhan chia se du lieu
    // ===========================================================================================

    // Cap thuong cho benh nhan khi dong y chia se du lieu nghien cuu
    async issueReward(ctx, args) {
        const { patientId, amount, reason } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'hospital' && role !== 'researcher') {
            throw new Error('Only hospital or researcher can issue rewards');
        }

        const patientJSON = await ctx.stub.getState(`patient-${patientId}`);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientId} not found`);
        }

        const txId = ctx.stub.getTxID();
        const rewardId = `RWD-${txId}`;
        const rewardKey = ctx.stub.createCompositeKey('reward', [patientId, rewardId]);

        const reward = {
            rewardId,
            patientId,
            amount: Number(amount),
            reason: reason || 'Data sharing reward',
            issuedBy: callerId,
            status: 'unclaimed',
            timestamp: this.getTimestamp(ctx),
            claimedAt: null
        };

        await ctx.stub.putState(rewardKey, Buffer.from(JSON.stringify(reward)));
        return JSON.stringify({ message: `Reward ${rewardId} issued to patient ${patientId}`, rewardId });
    }

    // Benh nhan nhan thuong
    async claimReward(ctx, args) {
        const { patientId, rewardId } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'patient') {
            throw new Error('Only patients can claim rewards');
        }
        if (callerId !== patientId) {
            throw new Error('Patient can only claim their own rewards');
        }

        const rewardKey = ctx.stub.createCompositeKey('reward', [patientId, rewardId]);
        const rewardJSON = await ctx.stub.getState(rewardKey);
        if (!rewardJSON || rewardJSON.length === 0) {
            throw new Error(`Reward ${rewardId} not found for patient ${patientId}`);
        }

        const reward = JSON.parse(rewardJSON.toString());
        if (reward.status === 'claimed') {
            throw new Error(`Reward ${rewardId} already claimed`);
        }

        reward.status = 'claimed';
        reward.claimedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(rewardKey, Buffer.from(JSON.stringify(reward)));
        return JSON.stringify({ message: `Reward ${rewardId} claimed successfully`, reward });
    }

    // Xem tat ca reward cua 1 benh nhan
    async getRewardsByPatient(ctx, args) {
        const { patientId } = JSON.parse(args);
        const iterator = await ctx.stub.getStateByPartialCompositeKey('reward', [patientId]);
        const results = [];

        for await (const res of iterator) {
            results.push(JSON.parse(res.value.toString('utf8')));
        }

        return JSON.stringify(results);
    }
}

module.exports = ehrChainCode;
