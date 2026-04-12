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
    //   6. Insurance companies - Read/Write (Patient claims)
    //   7. Patient - Read/Write (All generated patient data)
    // ===========================================================================================

    // ===========================================================================================
    // DATA STRUCTURES (Chuẩn hóa theo ICD-10 & ATC code):
    //
    // hospital-{hospitalId}: { hospitalId, name, city, createdBy, timestamp }
    //
    // doctor-{doctorId}: { doctorId, hospitalId, name, city, timestamp }
    //
    // pharmacy-{pharmacyId}: { pharmacyId, hospitalId, name, city, timestamp }
    //
    // insurance-{companyId}: { companyId, name, city, timestamp }
    //
    // patient-{patientId}: {
    //     patientId, name, dob, city,
    //     authorizedDoctors: ["D001", "D002"]
    // }
    //
    // record (composite key: record/{patientId}/{recordId}): {
    //     recordId, patientId, doctorId, hospitalId,
    //     diagnosis: { primary: { icdCode, description }, secondary: [...], notes },
    //     prescription: { medications: [{ drugCode (ATC), drugName, strength, unit, dosage }], notes },
    //     timestamp, updatedAt, version
    // }
    //
    // claim (composite key: claim/{patientId}/{claimId}): {
    //     claimId, patientId, recordId, companyId,
    //     claimType, amount, description,
    //     status: "pending" | "approved" | "rejected",
    //     reviewedBy, reviewNotes, timestamp, updatedAt
    // }
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

    // Lay role, uuid, hospitalId, companyId tu client certificate
    getCallerAttributes(ctx) {
        const role = ctx.clientIdentity.getAttributeValue('role');
        const uuid = ctx.clientIdentity.getAttributeValue('uuid');

        if (!role || !uuid) {
            throw new Error('Missing role or uuid in client certificate');
        }

        const hospitalId = ctx.clientIdentity.getAttributeValue('hospitalId') || '';
        const companyId = ctx.clientIdentity.getAttributeValue('companyId') || '';

        return { role, uuid, hospitalId, companyId };
    }

    // Lay timestamp chuan ISO tu transaction
    getTimestamp(ctx) {
        return new Date(ctx.stub.getTxTimestamp().seconds.low * 1000).toISOString();
    }

    // Danh sach MSP cua cac to chuc benh vien (Org1, Org3, ...)
    getHospitalMSPs() {
        return ['Org1MSP', 'Org3MSP'];
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

    // Dang ky benh vien vao ledger - chi hospital admin moi co quyen
    async onboardHospital(ctx, args) {
        const { hospitalId, name, city } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'hospital') {
            throw new Error('Only hospital admin can onboard hospital');
        }

        const key = `hospital-${hospitalId}`;
        const existing = await ctx.stub.getState(key);
        if (existing && existing.length > 0) {
            throw new Error(`Hospital ${hospitalId} already exists`);
        }

        const hospital = {
            hospitalId, name, city,
            createdBy: callerId,
            timestamp: this.getTimestamp(ctx)
        };

        await ctx.stub.putState(key, Buffer.from(stringify(sortKeysRecursive(hospital))));
        return JSON.stringify({ message: `Hospital ${hospitalId} registered`, data: hospital });
    }

    // Dang ky bac si vao ledger - chi hospital moi co quyen
    // Bac si se thuoc ve hospitalId cua nguoi tao
    async onboardDoctor(ctx, args) {
        const { doctorId, name, city, dob, department, position, specialization, phone } = JSON.parse(args);
        const { role, uuid: callerId, hospitalId } = this.getCallerAttributes(ctx);

        if (role !== 'hospital') {
            throw new Error('Only hospital can onboard doctor');
        }

        const key = `doctor-${doctorId}`;
        const existing = await ctx.stub.getState(key);
        if (existing && existing.length > 0) {
            throw new Error(`Doctor ${doctorId} already registered`);
        }

        const doctor = {
            doctorId,
            hospitalId: hospitalId || callerId,
            name, city,
            dob: dob || '',
            department: department || '',
            position: position || '',
            specialization: specialization || '',
            phone: phone || '',
            createdBy: callerId,
            timestamp: this.getTimestamp(ctx)
        };

        await ctx.stub.putState(key, Buffer.from(stringify(sortKeysRecursive(doctor))));
        return JSON.stringify({ message: `Doctor ${doctorId} registered at hospital ${doctor.hospitalId}`, data: doctor });
    }

    // Dang ky cong ty bao hiem vao ledger
    async onboardInsuranceCompany(ctx, args) {
        const { companyId, name, city } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'insuranceAdmin') {
            throw new Error('Only insurance admin can onboard insurance company');
        }

        const key = `insurance-${companyId}`;
        const existing = await ctx.stub.getState(key);
        if (existing && existing.length > 0) {
            throw new Error(`Insurance company ${companyId} already exists`);
        }

        const company = {
            companyId, name, city,
            createdBy: callerId,
            timestamp: this.getTimestamp(ctx)
        };

        await ctx.stub.putState(key, Buffer.from(stringify(sortKeysRecursive(company))));
        return JSON.stringify({ message: `Insurance company ${companyId} registered`, data: company });
    }

    // Dang ky dai ly bao hiem - thuoc ve companyId cua nguoi tao
    async onboardInsurance(ctx, args) {
        const { agentId, name, city } = JSON.parse(args);
        const { role, uuid: callerId, companyId } = this.getCallerAttributes(ctx);

        if (role !== 'insuranceAdmin') {
            throw new Error('Only insurance admin can onboard insurance agent');
        }

        const key = `agent-${agentId}`;
        const existing = await ctx.stub.getState(key);
        if (existing && existing.length > 0) {
            throw new Error(`Agent ${agentId} already registered`);
        }

        const agent = {
            agentId,
            companyId: companyId || callerId,
            name, city,
            createdBy: callerId,
            timestamp: this.getTimestamp(ctx)
        };

        await ctx.stub.putState(key, Buffer.from(stringify(sortKeysRecursive(agent))));
        return JSON.stringify({ message: `Agent ${agentId} registered at company ${agent.companyId}`, data: agent });
    }

    // Dang ky nha thuoc vao ledger - chi hospital moi co quyen
    async onboardPharmacy(ctx, args) {
        const { pharmacyId, name, city } = JSON.parse(args);
        const { role, uuid: callerId, hospitalId } = this.getCallerAttributes(ctx);

        if (role !== 'hospital') {
            throw new Error('Only hospital can onboard pharmacy');
        }

        const key = `pharmacy-${pharmacyId}`;
        const existing = await ctx.stub.getState(key);
        if (existing && existing.length > 0) {
            throw new Error(`Pharmacy ${pharmacyId} already exists`);
        }

        const pharmacy = {
            pharmacyId,
            hospitalId: hospitalId || callerId,
            name, city,
            createdBy: callerId,
            timestamp: this.getTimestamp(ctx)
        };

        await ctx.stub.putState(key, Buffer.from(stringify(sortKeysRecursive(pharmacy))));
        return JSON.stringify({ message: `Pharmacy ${pharmacyId} registered`, data: pharmacy });
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
            timestamp: this.getTimestamp(ctx)
        };

        await ctx.stub.putState(key, Buffer.from(stringify(sortKeysRecursive(patient))));
        return `Patient ${patientId} registered`;
    }

    // Cap nhat thong tin ca nhan - moi role tu cap nhat chinh minh
    async updateProfile(ctx, args) {
        const { name, dob, city, department, position, specialization, phone } = JSON.parse(args);
        const { role, uuid: callerId, hospitalId } = this.getCallerAttributes(ctx);

        let key, data;
        if (role === 'patient') {
            key = `patient-${callerId}`;
        } else if (role === 'doctor') {
            key = `doctor-${callerId}`;
        } else if (role === 'hospital') {
            key = `hospital-${callerId}`;
        } else if (role === 'pharmacy') {
            key = `pharmacy-${callerId}`;
        } else {
            throw new Error(`Role ${role} does not support profile update`);
        }

        const existing = await ctx.stub.getState(key);
        if (!existing || existing.length === 0) {
            throw new Error(`Profile not found for ${callerId}`);
        }
        data = JSON.parse(existing.toString());

        // Chi cap nhat cac field duoc truyen vao (khong ghi de field cu neu khong truyen)
        if (name !== undefined) data.name = name;
        if (dob !== undefined) data.dob = dob;
        if (city !== undefined) data.city = city;
        if (role === 'doctor') {
            if (department !== undefined) data.department = department;
            if (position !== undefined) data.position = position;
            if (specialization !== undefined) data.specialization = specialization;
            if (phone !== undefined) data.phone = phone;
        }
        data.updatedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(key, Buffer.from(stringify(sortKeysRecursive(data))));
        return JSON.stringify({ message: `Profile updated for ${callerId}`, data });
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
        await ctx.stub.putState(`patient-${patientId}`, Buffer.from(stringify(sortKeysRecursive(patient))));

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
        await ctx.stub.putState(`patient-${patientId}`, Buffer.from(stringify(sortKeysRecursive(patient))));

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
        const { role, uuid: callerId, hospitalId } = this.getCallerAttributes(ctx);

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
            hospitalId: hospitalId || '',
            diagnosis,
            prescription,
            timestamp,
            updatedAt: timestamp,
            version: 1
        };

        await ctx.stub.putState(recordKey, Buffer.from(stringify(sortKeysRecursive(record))));
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

        await ctx.stub.putState(recordKey, Buffer.from(stringify(sortKeysRecursive(existingRecord))));
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

        let _res = await iterator.next();
        while (!_res.done) {
            results.push(JSON.parse(_res.value.value.toString('utf8')));
            _res = await iterator.next();
        }
        await iterator.close();

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

        let _res = await iterator.next();
        while (!_res.done) {
            if (_res.value.key.startsWith('patient-')) {
                results.push(JSON.parse(_res.value.value.toString()));
            }
            _res = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify(results);
    }

    // Lay tat ca benh vien
    async getAllHospitals(ctx) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const results = [];
        let _res = await iterator.next();
        while (!_res.done) {
            if (_res.value.key.startsWith('hospital-')) {
                results.push(JSON.parse(_res.value.value.toString()));
            }
            _res = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(results);
    }

    // Lay tat ca bac si (hoac theo hospitalId)
    async getAllDoctors(ctx, args) {
        const { hospitalId } = args ? JSON.parse(args) : {};
        const iterator = await ctx.stub.getStateByRange('', '');
        const results = [];
        let _res = await iterator.next();
        while (!_res.done) {
            if (_res.value.key.startsWith('doctor-')) {
                const doctor = JSON.parse(_res.value.value.toString());
                if (!hospitalId || doctor.hospitalId === hospitalId) {
                    results.push(doctor);
                }
            }
            _res = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(results);
    }

    // Lay tat ca nha thuoc (hoac theo hospitalId)
    async getAllPharmacies(ctx, args) {
        const { hospitalId } = args ? JSON.parse(args) : {};
        const iterator = await ctx.stub.getStateByRange('', '');
        const results = [];
        let _res = await iterator.next();
        while (!_res.done) {
            if (_res.value.key.startsWith('pharmacy-')) {
                const pharmacy = JSON.parse(_res.value.value.toString());
                if (!hospitalId || pharmacy.hospitalId === hospitalId) {
                    results.push(pharmacy);
                }
            }
            _res = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(results);
    }

    // Lay tat ca cong ty bao hiem
    async getAllInsuranceCompanies(ctx) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const results = [];
        let _res = await iterator.next();
        while (!_res.done) {
            if (_res.value.key.startsWith('insurance-')) {
                results.push(JSON.parse(_res.value.value.toString()));
            }
            _res = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(results);
    }

    // Lay tat ca chi nhanh bao hiem (agent)
    async getAllAgents(ctx) {
        const { role } = this.getCallerAttributes(ctx);
        if (role !== 'insuranceAdmin' && role !== 'insurance') {
            throw new Error('Only insurance admin can view all agents');
        }
        const iterator = await ctx.stub.getStateByRange('', '');
        const results = [];
        let _res = await iterator.next();
        while (!_res.done) {
            if (_res.value.key.startsWith('agent-')) {
                try {
                    results.push(JSON.parse(_res.value.value.toString()));
                } catch (e) { /* skip */ }
            }
            _res = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(results);
    }

    // Lay tat ca ho so do 1 bac si tao
    async getRecordsByDoctor(ctx, args) {
        const { doctorId } = JSON.parse(args);
        const results = [];
        const iterator = await ctx.stub.getStateByRange('', '');

        let _res = await iterator.next();
        while (!_res.done) {
            if (_res.value.key.startsWith('\x00record')) {
                const record = JSON.parse(_res.value.value.toString());
                if (record.doctorId === doctorId) {
                    results.push(record);
                }
            }
            _res = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify(results);
    }

    // Admin (hospital) xem toan bo ledger
    async fetchLedger(ctx) {
        const mspId = ctx.clientIdentity.getMSPID();
        if (!this.getHospitalMSPs().includes(mspId)) {
            throw new Error('Only hospital org members can fetch blockchain ledger');
        }

        const allResults = [];

        // Regular keys (patient-, hospital-, doctor-, insurance-, agent-, etc.)
        const rangeIterator = await ctx.stub.getStateByRange('', '');
        let rangeResult = await rangeIterator.next();
        while (!rangeResult.done) {
            const strValue = Buffer.from(rangeResult.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                record = strValue;
            }
            allResults.push({ Key: rangeResult.value.key, Value: record });
            rangeResult = await rangeIterator.next();
        }
        await rangeIterator.close();

        // Composite keys: records
        const recordIter = await ctx.stub.getStateByPartialCompositeKey('record', []);
        let rRes = await recordIter.next();
        while (!rRes.done) {
            try {
                const val = JSON.parse(rRes.value.value.toString('utf8'));
                allResults.push({ Key: rRes.value.key, Value: val });
            } catch (_) {}
            rRes = await recordIter.next();
        }
        await recordIter.close();

        // Composite keys: dispense
        const dispIter = await ctx.stub.getStateByPartialCompositeKey('dispense', []);
        let dRes = await dispIter.next();
        while (!dRes.done) {
            try {
                const val = JSON.parse(dRes.value.value.toString('utf8'));
                allResults.push({ Key: dRes.value.key, Value: val });
            } catch (_) {}
            dRes = await dispIter.next();
        }
        await dispIter.close();

        // Composite keys: claim
        const claimIter = await ctx.stub.getStateByPartialCompositeKey('claim', []);
        let cRes = await claimIter.next();
        while (!cRes.done) {
            try {
                const val = JSON.parse(cRes.value.value.toString('utf8'));
                allResults.push({ Key: cRes.value.key, Value: val });
            } catch (_) {}
            cRes = await claimIter.next();
        }
        await claimIter.close();

        return stringify(allResults);
    }

    // Org2 (insurance) xem sổ cái của tổ chức bảo hiểm
    async fetchOrg2Ledger(ctx) {
        const mspId = ctx.clientIdentity.getMSPID();
        const { role } = this.getCallerAttributes(ctx);
        if (mspId !== 'Org2MSP' && role !== 'insurance' && role !== 'insuranceAdmin') {
            throw new Error('Only Org2 (insurance) members can fetch Org2 ledger');
        }

        const allResults = [];

        // Regular keys: insurance-*, agent-*
        const rangeIterator = await ctx.stub.getStateByRange('', '');
        let rangeResult = await rangeIterator.next();
        while (!rangeResult.done) {
            const key = rangeResult.value.key;
            if (key.startsWith('insurance-') || key.startsWith('agent-')) {
                try {
                    const val = JSON.parse(rangeResult.value.value.toString('utf8'));
                    allResults.push({ Key: key, Value: val });
                } catch (_) {}
            }
            rangeResult = await rangeIterator.next();
        }
        await rangeIterator.close();

        // Composite keys: claim
        const claimIter = await ctx.stub.getStateByPartialCompositeKey('claim', []);
        let cRes = await claimIter.next();
        while (!cRes.done) {
            try {
                const val = JSON.parse(cRes.value.value.toString('utf8'));
                allResults.push({ Key: cRes.value.key, Value: val });
            } catch (_) {}
            cRes = await claimIter.next();
        }
        await claimIter.close();

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

        let _res = await iterator.next();
        while (!_res.done) {
            const record = JSON.parse(_res.value.value.toString('utf8'));
            if (record.prescription && record.prescription.medications) {
                prescriptions.push({
                    recordId: record.recordId,
                    patientId: record.patientId,
                    doctorId: record.doctorId,
                    prescription: record.prescription,
                    diagnosis: record.diagnosis.primary,
                    timestamp: record.timestamp,
                    dispensed: record.dispensed || false,
                    dispensedBy: record.dispensedBy || null,
                    dispensedAt: record.dispensedAt || null,
                    dispensedNotes: record.dispensedNotes || null,
                });
            }
            _res = await iterator.next();
        }
        await iterator.close();

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

        await ctx.stub.putState(dispenseKey, Buffer.from(stringify(sortKeysRecursive(dispenseRecord))));

        // Update original record with dispensed status so patients can see it
        const record = JSON.parse(recordJSON.toString());
        record.dispensed = true;
        record.dispensedBy = dispensedBy || callerId;
        record.dispensedAt = this.getTimestamp(ctx);
        record.dispensedNotes = dispensedNotes || '';
        await ctx.stub.putState(recordKey, Buffer.from(stringify(sortKeysRecursive(record))));

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

        await ctx.stub.putState(claimKey, Buffer.from(stringify(sortKeysRecursive(claim))));
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

        let _res = await iterator.next();
        while (!_res.done) {
            results.push(JSON.parse(_res.value.value.toString('utf8')));
            _res = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify(results);
    }

    // Dai ly bao hiem DUYET claim
    async approveClaim(ctx, args) {
        const { patientId, claimId, reviewNotes } = JSON.parse(args);
        const { role, uuid: callerId, companyId } = this.getCallerAttributes(ctx);

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
        claim.reviewedByCompany = companyId || '';
        claim.reviewNotes = reviewNotes || '';
        claim.updatedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(claimKey, Buffer.from(stringify(sortKeysRecursive(claim))));
        return JSON.stringify({ message: `Claim ${claimId} approved`, claim });
    }

    // Dai ly bao hiem TU CHOI claim
    async rejectClaim(ctx, args) {
        const { patientId, claimId, reviewNotes } = JSON.parse(args);
        const { role, uuid: callerId, companyId } = this.getCallerAttributes(ctx);

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
        claim.reviewedByCompany = companyId || '';
        claim.reviewNotes = reviewNotes || 'Claim rejected';
        claim.updatedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(claimKey, Buffer.from(stringify(sortKeysRecursive(claim))));
        return JSON.stringify({ message: `Claim ${claimId} rejected`, claim });
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

        await ctx.stub.putState(logKey, Buffer.from(stringify(sortKeysRecursive(emergencyLog))));

        // Lay tat ca record cua benh nhan
        const iterator = await ctx.stub.getStateByPartialCompositeKey('record', [patientId]);
        const records = [];
        let _res2 = await iterator.next();
        while (!_res2.done) {
            records.push(JSON.parse(_res2.value.value.toString('utf8')));
            _res2 = await iterator.next();
        }
        await iterator.close();

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

    // Xem log truy cap khan cap cua 1 benh nhan (hospital admin hoac chinh benh nhan do)
    async getEmergencyLogs(ctx, args) {
        const { patientId } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role !== 'hospital' && !(role === 'patient' && callerId === patientId)) {
            throw new Error('Only hospital admin or the patient themselves can view emergency logs');
        }

        const iterator = await ctx.stub.getStateByPartialCompositeKey('emergency', [patientId]);
        const results = [];

        let _res = await iterator.next();
        while (!_res.done) {
            results.push(JSON.parse(_res.value.value.toString('utf8')));
            _res = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify(results);
    }

}

module.exports = ehrChainCode;
