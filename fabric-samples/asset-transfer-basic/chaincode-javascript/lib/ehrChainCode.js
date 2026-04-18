'use strict';

// Deterministic stringify()
const stringify  = require('json-stringify-deterministic');
const sortKeysRecursive  = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

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

    // Kiem tra benh nhan co cap quyen cho bat ky bac si nao thuoc benh vien hospitalId khong
    // Dung de xac dinh hospital admin co duoc xem ho so benh nhan do hay khong
    async patientBelongsToHospital(ctx, patient, hospitalId) {
        if (!hospitalId || !Array.isArray(patient.authorizedDoctors)) {
            return false;
        }
        for (const doctorId of patient.authorizedDoctors) {
            const doctorJSON = await ctx.stub.getState(`doctor-${doctorId}`);
            if (!doctorJSON || doctorJSON.length === 0) continue;
            const doctor = JSON.parse(doctorJSON.toString());
            if (doctor.hospitalId === hospitalId) {
                return true;
            }
        }
        return false;
    }

    // ACL: kiem tra caller co quyen doc ho so cua benh nhan khong
    // - patient: chi xem cua chinh minh
    // - doctor: phai duoc benh nhan cap quyen (nam trong authorizedDoctors)
    // - hospital admin: chi duoc xem benh nhan co it nhat 1 bac si thuoc BV minh da duoc cap quyen
    // - cac role khac: tu choi
    async assertCanReadPatient(ctx, patient) {
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role === 'patient' && callerId === patient.patientId) {
            return;
        }
        if (role === 'doctor' && Array.isArray(patient.authorizedDoctors)
            && patient.authorizedDoctors.includes(callerId)) {
            return;
        }
        if (role === 'hospital') {
            // callerId cua hospital admin chinh la hospitalId cua BV do
            const belongs = await this.patientBelongsToHospital(ctx, patient, callerId);
            if (belongs) {
                return;
            }
            throw new Error(`Access denied: hospital ${callerId} has no authorized doctor for patient ${patient.patientId}`);
        }
        if (role === 'pharmacy') {
            // Pharmacy can xem prescription de dispense.
            // PDC se tu loc: pharmacy Org1 chi thay prescription cua BV1, v.v.
            const { hospitalId: pharmHospital } = this.getCallerAttributes(ctx);
            const belongs = await this.patientBelongsToHospital(ctx, patient, pharmHospital);
            if (belongs) {
                return;
            }
            throw new Error(`Access denied: pharmacy ${callerId} (hospital ${pharmHospital}) has no link to patient ${patient.patientId}`);
        }
        throw new Error(`Access denied: ${role} ${callerId} is not authorized to read patient ${patient.patientId}`);
    }

    // Tai patient tu state va kiem tra ACL truoc khi tra ve
    async loadPatientWithAcl(ctx, patientId) {
        const patientJSON = await ctx.stub.getState(`patient-${patientId}`);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientId} not found`);
        }
        const patient = JSON.parse(patientJSON.toString());
        await this.assertCanReadPatient(ctx, patient);
        return patient;
    }

    // ===========================================================================================
    // PRIVATE DATA COLLECTION (PDC) HELPERS
    // ===========================================================================================

    // Map hospitalId -> collection name. BV1 & BV3 co collection rieng.
    // Du lieu lam sang (diagnosis, prescription) chi luu o collection cua BV dieu tri.
    getCollectionForHospital(hospitalId) {
        const map = {
            'hospitalAdmin': 'hospital1Collection',   // BV1 (Org1)
            'hospital3Admin': 'hospital3Collection'   // BV3 (Org3)
        };
        return map[hospitalId] || null;
    }

    // Bam SHA-256 cua private part - dung de luu tren public ledger cho audit
    hashPrivatePart(privatePart) {
        const canonical = stringify(sortKeysRecursive(privatePart));
        return crypto.createHash('sha256').update(canonical).digest('hex');
    }

    // Tra ve collection rieng cua record (noi luu du lieu goc, chi BV dieu tri doc duoc)
    // va collection chia se (shared, khi record da duoc share cho BV khac)
    getReadableCollections(publicRecord) {
        const owning = this.getCollectionForHospital(publicRecord.hospitalId);
        const collections = [];
        if (owning) collections.push(owning);
        collections.push('sharedClinicalCollection');
        return collections;
    }

    // Thu doc private data tu 1 collection. Tra ve null neu peer khong thuoc
    // collection hoac chua co du lieu.
    async tryGetPrivateData(ctx, collection, key) {
        try {
            const bytes = await ctx.stub.getPrivateData(collection, key);
            if (bytes && bytes.length > 0) return bytes;
            return null;
        } catch (_) {
            return null;
        }
    }

    // Ghep public record (tu ledger) voi private part (tu PDC).
    // Thu lan luot: collection cua BV so huu -> sharedClinicalCollection.
    // Neu caller khong thuoc collection nao, tra ve metadata + privateDataVisible=false.
    async loadRecordWithPrivate(ctx, publicRecord) {
        const recordKey = ctx.stub.createCompositeKey('record', [publicRecord.patientId, publicRecord.recordId]);
        const collections = this.getReadableCollections(publicRecord);

        for (const collection of collections) {
            const bytes = await this.tryGetPrivateData(ctx, collection, recordKey);
            if (bytes) {
                const privatePart = JSON.parse(bytes.toString());
                return {
                    ...publicRecord,
                    ...privatePart,
                    privateDataVisible: true,
                    privateSource: collection
                };
            }
        }

        return {
            ...publicRecord,
            diagnosis: null,
            prescription: null,
            privateDataVisible: false
        };
    }

    // Chia se private data cua 1 record sang sharedClinicalCollection de BV khac doc duoc.
    // Chi cho phep:
    //   - Chinh benh nhan so huu record
    //   - Hospital admin cua BV so huu record
    // Transaction phai duoc endorse boi peer cua BV so huu (vi can doc collection goc).
    async shareRecordWithHospital(ctx, args) {
        const { patientId, recordId } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        const recordKey = ctx.stub.createCompositeKey('record', [patientId, recordId]);
        const publicJSON = await ctx.stub.getState(recordKey);
        if (!publicJSON || publicJSON.length === 0) {
            throw new Error(`Record ${recordId} not found for patient ${patientId}`);
        }
        const publicRecord = JSON.parse(publicJSON.toString());

        if (role === 'patient') {
            if (callerId !== patientId) {
                throw new Error('Only the patient owner can share this record');
            }
        } else if (role === 'hospital') {
            if (callerId !== publicRecord.hospitalId) {
                throw new Error(`Hospital ${callerId} cannot share record owned by ${publicRecord.hospitalId}`);
            }
        } else {
            throw new Error(`Role ${role} is not allowed to share records`);
        }

        const sourceCollection = this.getCollectionForHospital(publicRecord.hospitalId);
        if (!sourceCollection) {
            throw new Error(`No source collection for hospital ${publicRecord.hospitalId}`);
        }

        // Doc private data tu collection goc - peer endorse phai thuoc BV so huu
        const privBytes = await ctx.stub.getPrivateData(sourceCollection, recordKey);
        if (!privBytes || privBytes.length === 0) {
            throw new Error(`Cannot read private data from ${sourceCollection}. Ensure the transaction is endorsed by a peer of the owning hospital.`);
        }

        // Copy sang shared collection
        await ctx.stub.putPrivateData('sharedClinicalCollection', recordKey, privBytes);

        // Cap nhat public record de danh dau da share
        publicRecord.sharedCollections = publicRecord.sharedCollections || [];
        if (!publicRecord.sharedCollections.includes('sharedClinicalCollection')) {
            publicRecord.sharedCollections.push('sharedClinicalCollection');
        }
        publicRecord.sharedAt = this.getTimestamp(ctx);
        publicRecord.sharedBy = callerId;
        publicRecord.sharedByRole = role;

        await ctx.stub.putState(recordKey, Buffer.from(stringify(sortKeysRecursive(publicRecord))));

        return JSON.stringify({
            message: `Record ${recordId} shared via sharedClinicalCollection`,
            recordId,
            sharedBy: callerId
        });
    }

    // Chia se TOAN BO history cua 1 benh nhan 1 lan. Dung khi bo chuyen vien / export EHR.
    // - Patient: share records cua chinh minh (peer endorser chi doc duoc PDC cua org minh
    //   nen records thuoc BV khac se bi skip kem ly do)
    // - Hospital admin: chi share duoc records cua BV minh
    async shareAllRecordsWithHospital(ctx, args) {
        const { patientId } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role === 'patient') {
            if (callerId !== patientId) {
                throw new Error('Only the patient owner can share their records');
            }
        } else if (role !== 'hospital') {
            throw new Error(`Role ${role} cannot bulk-share records`);
        }

        const iterator = await ctx.stub.getStateByPartialCompositeKey('record', [patientId]);
        const shared = [];
        const skipped = [];
        const timestamp = this.getTimestamp(ctx);

        let res = await iterator.next();
        while (!res.done) {
            const publicRecord = JSON.parse(res.value.value.toString('utf8'));
            const recordId = publicRecord.recordId;
            const recordKey = ctx.stub.createCompositeKey('record', [patientId, recordId]);

            // Hospital admin chi share records cua BV minh
            if (role === 'hospital' && callerId !== publicRecord.hospitalId) {
                skipped.push({ recordId, reason: `not owned by hospital ${callerId}` });
                res = await iterator.next();
                continue;
            }

            const sourceCollection = this.getCollectionForHospital(publicRecord.hospitalId);
            if (!sourceCollection) {
                skipped.push({ recordId, reason: 'no source collection mapped' });
                res = await iterator.next();
                continue;
            }

            // Neu record da share roi -> bo qua (idempotent)
            if (Array.isArray(publicRecord.sharedCollections)
                && publicRecord.sharedCollections.includes('sharedClinicalCollection')) {
                skipped.push({ recordId, reason: 'already shared' });
                res = await iterator.next();
                continue;
            }

            const privBytes = await ctx.stub.getPrivateData(sourceCollection, recordKey);
            if (!privBytes || privBytes.length === 0) {
                skipped.push({
                    recordId,
                    reason: `private data not accessible (peer endorser may not belong to ${publicRecord.hospitalId})`
                });
                res = await iterator.next();
                continue;
            }

            await ctx.stub.putPrivateData('sharedClinicalCollection', recordKey, privBytes);

            publicRecord.sharedCollections = publicRecord.sharedCollections || [];
            publicRecord.sharedCollections.push('sharedClinicalCollection');
            publicRecord.sharedAt = timestamp;
            publicRecord.sharedBy = callerId;
            publicRecord.sharedByRole = role;

            await ctx.stub.putState(recordKey, Buffer.from(stringify(sortKeysRecursive(publicRecord))));
            shared.push(recordId);

            res = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify({
            message: `Shared ${shared.length} records, skipped ${skipped.length}`,
            sharedCount: shared.length,
            skippedCount: skipped.length,
            shared,
            skipped
        });
    }

    // Thu hoi share cho TOAN BO records da share cua 1 benh nhan
    async unshareAllRecordsFromHospital(ctx, args) {
        const { patientId } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        if (role === 'patient') {
            if (callerId !== patientId) {
                throw new Error('Only the patient owner can unshare their records');
            }
        } else if (role !== 'hospital') {
            throw new Error(`Role ${role} cannot bulk-unshare records`);
        }

        const iterator = await ctx.stub.getStateByPartialCompositeKey('record', [patientId]);
        const unshared = [];
        const skipped = [];
        const timestamp = this.getTimestamp(ctx);

        let res = await iterator.next();
        while (!res.done) {
            const publicRecord = JSON.parse(res.value.value.toString('utf8'));
            const recordId = publicRecord.recordId;
            const recordKey = ctx.stub.createCompositeKey('record', [patientId, recordId]);

            if (role === 'hospital' && callerId !== publicRecord.hospitalId) {
                skipped.push({ recordId, reason: `not owned by hospital ${callerId}` });
                res = await iterator.next();
                continue;
            }

            if (!Array.isArray(publicRecord.sharedCollections)
                || !publicRecord.sharedCollections.includes('sharedClinicalCollection')) {
                skipped.push({ recordId, reason: 'not currently shared' });
                res = await iterator.next();
                continue;
            }

            await ctx.stub.deletePrivateData('sharedClinicalCollection', recordKey);

            publicRecord.sharedCollections = publicRecord.sharedCollections
                .filter(c => c !== 'sharedClinicalCollection');
            publicRecord.unsharedAt = timestamp;
            publicRecord.unsharedBy = callerId;

            await ctx.stub.putState(recordKey, Buffer.from(stringify(sortKeysRecursive(publicRecord))));
            unshared.push(recordId);

            res = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify({
            message: `Unshared ${unshared.length} records, skipped ${skipped.length}`,
            unsharedCount: unshared.length,
            skippedCount: skipped.length,
            unshared,
            skipped
        });
    }

    // Thu hoi share: xoa private data khoi sharedClinicalCollection
    async unshareRecordFromHospital(ctx, args) {
        const { patientId, recordId } = JSON.parse(args);
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        const recordKey = ctx.stub.createCompositeKey('record', [patientId, recordId]);
        const publicJSON = await ctx.stub.getState(recordKey);
        if (!publicJSON || publicJSON.length === 0) {
            throw new Error(`Record ${recordId} not found for patient ${patientId}`);
        }
        const publicRecord = JSON.parse(publicJSON.toString());

        if (role === 'patient') {
            if (callerId !== patientId) {
                throw new Error('Only the patient owner can unshare this record');
            }
        } else if (role === 'hospital') {
            if (callerId !== publicRecord.hospitalId) {
                throw new Error(`Hospital ${callerId} cannot unshare record owned by ${publicRecord.hospitalId}`);
            }
        } else {
            throw new Error(`Role ${role} is not allowed to unshare records`);
        }

        await ctx.stub.deletePrivateData('sharedClinicalCollection', recordKey);

        publicRecord.sharedCollections = (publicRecord.sharedCollections || [])
            .filter(c => c !== 'sharedClinicalCollection');
        publicRecord.unsharedAt = this.getTimestamp(ctx);
        publicRecord.unsharedBy = callerId;

        await ctx.stub.putState(recordKey, Buffer.from(stringify(sortKeysRecursive(publicRecord))));

        return JSON.stringify({
            message: `Record ${recordId} unshared from sharedClinicalCollection`,
            recordId
        });
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
    // Public part (metadata + hash) luu tren ledger; private part (diagnosis, prescription)
    // luu o PDC cua BV dieu tri -> peer BV khac khong nhan duoc du lieu goc.
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

        const collection = this.getCollectionForHospital(hospitalId);
        if (!collection) {
            throw new Error(`No private data collection mapped for hospital ${hospitalId}`);
        }

        const txId = ctx.stub.getTxID();
        const recordId = `R-${txId}`;
        const timestamp = this.getTimestamp(ctx);

        const recordKey = ctx.stub.createCompositeKey('record', [patientId, recordId]);

        // Tach public / private
        const privatePart = { diagnosis, prescription };
        const privateHash = this.hashPrivatePart(privatePart);

        const publicRecord = {
            recordId,
            patientId,
            doctorId: callerId,
            hospitalId: hospitalId || '',
            privateHash,
            privateCollection: collection,
            timestamp,
            updatedAt: timestamp,
            version: 1
        };

        await ctx.stub.putState(recordKey, Buffer.from(stringify(sortKeysRecursive(publicRecord))));
        await ctx.stub.putPrivateData(collection, recordKey, Buffer.from(stringify(sortKeysRecursive(privatePart))));

        return JSON.stringify({ message: `Record ${recordId} added for patient ${patientId}`, recordId, collection });
    }

    // Bac si cap nhat ho so benh an - phai la bac si da tao record hoac duoc cap quyen
    // Chi BV so huu record moi sua duoc private part (diagnosis, prescription)
    async updateRecord(ctx, args) {
        const { patientId, recordId, diagnosis, prescription } = JSON.parse(args);
        const { role, uuid: callerId, hospitalId } = this.getCallerAttributes(ctx);

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

        // Lay public record hien tai
        const recordKey = ctx.stub.createCompositeKey('record', [patientId, recordId]);
        const recordJSON = await ctx.stub.getState(recordKey);
        if (!recordJSON || recordJSON.length === 0) {
            throw new Error(`Record ${recordId} not found for patient ${patientId}`);
        }
        const existingRecord = JSON.parse(recordJSON.toString());

        // Chi BV so huu record moi duoc sua
        if (existingRecord.hospitalId !== hospitalId) {
            throw new Error(`Doctor from hospital ${hospitalId} cannot update record owned by ${existingRecord.hospitalId}`);
        }

        const collection = existingRecord.privateCollection || this.getCollectionForHospital(existingRecord.hospitalId);
        if (!collection) {
            throw new Error(`No private collection for record ${recordId}`);
        }

        // Load private part hien tai de merge
        const privBytes = await ctx.stub.getPrivateData(collection, recordKey);
        const privatePart = (privBytes && privBytes.length > 0)
            ? JSON.parse(privBytes.toString())
            : { diagnosis: null, prescription: null };

        // Validate du lieu moi neu co
        if (diagnosis) {
            this.validateDiagnosis(diagnosis);
            privatePart.diagnosis = diagnosis;
        }
        if (prescription) {
            this.validatePrescription(prescription);
            privatePart.prescription = prescription;
        }

        // Cap nhat hash + metadata tren public ledger
        existingRecord.privateHash = this.hashPrivatePart(privatePart);
        existingRecord.updatedAt = this.getTimestamp(ctx);
        existingRecord.updatedBy = callerId;
        existingRecord.version = (existingRecord.version || 1) + 1;

        await ctx.stub.putState(recordKey, Buffer.from(stringify(sortKeysRecursive(existingRecord))));
        await ctx.stub.putPrivateData(collection, recordKey, Buffer.from(stringify(sortKeysRecursive(privatePart))));

        return JSON.stringify({ message: `Record ${recordId} updated`, version: existingRecord.version });
    }

    // ===========================================================================================
    // QUERY FUNCTIONS - Truy van du lieu
    // ===========================================================================================

    // Lay tat ca ho so cua 1 benh nhan
    // Tra ve: public metadata + (diagnosis/prescription neu caller thuoc org duoc PDC phuc vu)
    async getAllRecordsByPatientId(ctx, args) {
        const { patientId } = JSON.parse(args);
        await this.loadPatientWithAcl(ctx, patientId);

        const iterator = await ctx.stub.getStateByPartialCompositeKey('record', [patientId]);
        const results = [];

        let _res = await iterator.next();
        while (!_res.done) {
            const publicRecord = JSON.parse(_res.value.value.toString('utf8'));
            const merged = await this.loadRecordWithPrivate(ctx, publicRecord);
            results.push(merged);
            _res = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify(results);
    }

    // Lay 1 ho so cu the theo ID
    async getRecordById(ctx, args) {
        const { patientId, recordId } = JSON.parse(args);
        await this.loadPatientWithAcl(ctx, patientId);

        const recordKey = ctx.stub.createCompositeKey('record', [patientId, recordId]);
        const recordJSON = await ctx.stub.getState(recordKey);

        if (!recordJSON || recordJSON.length === 0) {
            throw new Error(`Record ${recordId} not found for patient ${patientId}`);
        }

        const publicRecord = JSON.parse(recordJSON.toString());
        const merged = await this.loadRecordWithPrivate(ctx, publicRecord);
        return JSON.stringify(merged);
    }

    // Lay thong tin benh nhan theo ID
    async getPatientById(ctx, args) {
        const { patientId } = JSON.parse(args);
        const patient = await this.loadPatientWithAcl(ctx, patientId);
        return JSON.stringify(patient);
    }

    // Lay tat ca benh nhan
    async getAllPatients(ctx) {
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);
        if (role !== 'hospital') {
            throw new Error('Only hospital admin can list all patients');
        }

        const iterator = await ctx.stub.getStateByRange('', '');
        const results = [];

        let _res = await iterator.next();
        while (!_res.done) {
            if (_res.value.key.startsWith('patient-')) {
                const patient = JSON.parse(_res.value.value.toString());
                // chi liet ke benh nhan co it nhat 1 bac si thuoc BV nay duoc cap quyen
                if (await this.patientBelongsToHospital(ctx, patient, callerId)) {
                    results.push(patient);
                }
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
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        // Chinh bac si do: OK
        // Hospital admin: chi duoc xem neu doctor do thuoc BV minh
        if (role === 'doctor' && callerId === doctorId) {
            // OK
        } else if (role === 'hospital') {
            const doctorJSON = await ctx.stub.getState(`doctor-${doctorId}`);
            if (!doctorJSON || doctorJSON.length === 0) {
                throw new Error(`Doctor ${doctorId} not found`);
            }
            const doctor = JSON.parse(doctorJSON.toString());
            if (doctor.hospitalId !== callerId) {
                throw new Error(`Access denied: hospital ${callerId} cannot read records of doctor from another hospital`);
            }
        } else {
            throw new Error(`Access denied: ${role} ${callerId} cannot read records of doctor ${doctorId}`);
        }

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
        const { role, uuid: callerId } = this.getCallerAttributes(ctx);

        // Patient: chi xem lich su cua chinh ho so minh
        // Hospital admin: chi xem lich su cua benh nhan ma BV minh co bac si duoc cap quyen
        // Cac role khac: tu choi
        if (role === 'patient' && assetId === `patient-${callerId}`) {
            // OK
        } else if (role === 'hospital' && assetId.startsWith('patient-')) {
            const patientId = assetId.substring('patient-'.length);
            const patientJSON = await ctx.stub.getState(assetId);
            if (!patientJSON || patientJSON.length === 0) {
                throw new Error(`Patient ${patientId} not found`);
            }
            const patient = JSON.parse(patientJSON.toString());
            const belongs = await this.patientBelongsToHospital(ctx, patient, callerId);
            if (!belongs) {
                throw new Error(`Access denied: hospital ${callerId} cannot view history of patient ${patientId}`);
            }
        } else if (role === 'hospital') {
            // Cac asset khac (hospital-, doctor- thuoc BV minh, ...): tam thoi cho phep
            // TODO: siet chat hon neu can (vd chi xem doctor-/pharmacy- cua BV minh)
        } else {
            throw new Error(`Access denied: ${role} ${callerId} cannot view history of ${assetId}`);
        }

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

    // Lay tat ca don thuoc cua 1 benh nhan (trich xuat tu records + PDC)
    // Chi tra ve prescription cho caller thuoc org duoc PDC phuc vu; cac records khac bi loc ra.
    async getPrescriptionsByPatient(ctx, args) {
        const { patientId } = JSON.parse(args);
        await this.loadPatientWithAcl(ctx, patientId);

        const iterator = await ctx.stub.getStateByPartialCompositeKey('record', [patientId]);
        const prescriptions = [];

        let _res = await iterator.next();
        while (!_res.done) {
            const publicRecord = JSON.parse(_res.value.value.toString('utf8'));
            const merged = await this.loadRecordWithPrivate(ctx, publicRecord);

            if (merged.privateDataVisible && merged.prescription && merged.prescription.medications) {
                prescriptions.push({
                    recordId: merged.recordId,
                    patientId: merged.patientId,
                    doctorId: merged.doctorId,
                    prescription: merged.prescription,
                    diagnosis: merged.diagnosis && merged.diagnosis.primary,
                    timestamp: merged.timestamp,
                    dispensed: merged.dispensed || false,
                    dispensedBy: merged.dispensedBy || null,
                    dispensedAt: merged.dispensedAt || null,
                    dispensedNotes: merged.dispensedNotes || null,
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
