'use strict';

const express = require('express');
const query = require('./query');
const router = express.Router();

// FHIR Content-Type middleware
router.use('/fhir', (req, res, next) => {
    res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
    next();
});

// ============================================================
// Helper: map internal Patient -> FHIR R4 Patient
// ============================================================
function toFhirPatient(p) {
    return {
        resourceType: 'Patient',
        id: p.patientId,
        meta: { lastUpdated: p.timestamp || new Date().toISOString() },
        identifier: [{ system: 'urn:ehr-blockchain:patient', value: p.patientId }],
        name: [{ text: p.name }],
        birthDate: p.dob,
        address: p.city ? [{ city: p.city }] : [],
    };
}

// ============================================================
// Helper: map internal Record.diagnosis -> FHIR R4 Observation
// ============================================================
function toFhirObservation(record) {
    const coding = [];
    if (record.diagnosis?.primary) {
        coding.push({
            system: 'http://hl7.org/fhir/sid/icd-10',
            code: record.diagnosis.primary.icdCode,
            display: record.diagnosis.primary.description,
        });
    }
    if (record.diagnosis?.secondary) {
        for (const sec of record.diagnosis.secondary) {
            coding.push({
                system: 'http://hl7.org/fhir/sid/icd-10',
                code: sec.icdCode,
                display: sec.description,
            });
        }
    }

    return {
        resourceType: 'Observation',
        id: record.recordId,
        meta: { lastUpdated: record.updatedAt || record.timestamp },
        status: 'final',
        code: { coding },
        subject: { reference: `Patient/${record.patientId}` },
        performer: [{ reference: `Practitioner/${record.doctorId}` }],
        effectiveDateTime: record.timestamp,
        note: record.diagnosis?.notes ? [{ text: record.diagnosis.notes }] : [],
    };
}

// ============================================================
// Helper: map internal Record.prescription -> FHIR R4 MedicationRequest
// ============================================================
function toFhirMedicationRequest(record, medication, index) {
    const med = medication;
    const dosageText = `${med.strength}${med.unit} ${med.dosage?.route || ''} ${med.dosage?.frequency || ''}x/day`;

    return {
        resourceType: 'MedicationRequest',
        id: `${record.recordId}-med-${index}`,
        meta: { lastUpdated: record.updatedAt || record.timestamp },
        status: 'active',
        intent: 'order',
        subject: { reference: `Patient/${record.patientId}` },
        requester: { reference: `Practitioner/${record.doctorId}` },
        medicationCodeableConcept: {
            coding: [{
                system: 'http://www.whocc.no/atc',
                code: med.drugCode,
                display: med.drugName,
            }],
        },
        dosageInstruction: [{
            text: dosageText.trim(),
            timing: med.dosage?.timing ? { code: { text: med.dosage.timing } } : undefined,
            route: med.dosage?.route ? { coding: [{ display: med.dosage.route }] } : undefined,
            doseAndRate: [{
                doseQuantity: {
                    value: med.strength,
                    unit: med.unit,
                },
            }],
        }],
    };
}

// ============================================================
// Helper: map internal Claim -> FHIR R4 Claim
// ============================================================
function toFhirClaim(claim) {
    const statusMap = { pending: 'active', approved: 'active', rejected: 'cancelled' };
    return {
        resourceType: 'Claim',
        id: claim.claimId,
        meta: { lastUpdated: claim.updatedAt || claim.timestamp },
        status: statusMap[claim.status] || 'active',
        type: {
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/claim-type',
                code: claim.claimType === 'outpatient' ? 'professional' : 'institutional',
                display: claim.claimType,
            }],
        },
        patient: { reference: `Patient/${claim.patientId}` },
        created: claim.timestamp,
        total: { value: claim.amount, currency: 'VND' },
        item: claim.description ? [{ sequence: 1, productOrService: { text: claim.description } }] : [],
    };
}

// ============================================================
// Helper: map internal Doctor -> FHIR R4 Practitioner
// ============================================================
function toFhirPractitioner(doctor) {
    return {
        resourceType: 'Practitioner',
        id: doctor.doctorId,
        meta: { lastUpdated: doctor.timestamp },
        identifier: [{ system: 'urn:ehr-blockchain:practitioner', value: doctor.doctorId }],
        name: [{ text: doctor.name }],
        address: doctor.city ? [{ city: doctor.city }] : [],
    };
}

// ============================================================
// Helper: wrap entries in a FHIR Bundle
// ============================================================
function toFhirBundle(type, entries) {
    return {
        resourceType: 'Bundle',
        type,
        total: entries.length,
        entry: entries.map(resource => ({
            resource,
            fullUrl: `urn:uuid:${resource.resourceType}/${resource.id}`,
        })),
    };
}

// ============================================================
// GET /fhir/Patient/:patientId
// ============================================================
router.get('/fhir/Patient/:patientId', async (req, res, next) => {
    try {
        const { patientId } = req.params;
        const userId = req.query.userId || 'hospitalAdmin';
        const result = await query.getQuery('getPatientById', { patientId }, userId);
        if (!result || result.status === false) {
            return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: `Patient ${patientId} not found` }] });
        }
        res.json(toFhirPatient(result));
    } catch (err) {
        next(err);
    }
});

// ============================================================
// GET /fhir/Patient/:patientId/$everything  (Bundle of all resources)
// ============================================================
router.get('/fhir/Patient/:patientId/\\$everything', async (req, res, next) => {
    try {
        const { patientId } = req.params;
        const userId = req.query.userId || 'hospitalAdmin';

        const patient = await query.getQuery('getPatientById', { patientId }, userId);
        if (!patient || patient.status === false) {
            return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: `Patient ${patientId} not found` }] });
        }

        const records = await query.getQuery('getAllRecordsByPatientId', { patientId }, userId);
        const entries = [toFhirPatient(patient)];

        if (Array.isArray(records)) {
            for (const r of records) {
                entries.push(toFhirObservation(r));
                if (r.prescription?.medications) {
                    r.prescription.medications.forEach((med, i) => {
                        entries.push(toFhirMedicationRequest(r, med, i));
                    });
                }
            }
        }

        res.json(toFhirBundle('searchset', entries));
    } catch (err) {
        next(err);
    }
});

// ============================================================
// GET /fhir/Observation/:patientId/:recordId
// ============================================================
router.get('/fhir/Observation/:patientId/:recordId', async (req, res, next) => {
    try {
        const { patientId, recordId } = req.params;
        const userId = req.query.userId || 'hospitalAdmin';
        const result = await query.getQuery('getRecordById', { patientId, recordId }, userId);
        if (!result || result.status === false) {
            return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: `Record ${recordId} not found` }] });
        }
        res.json(toFhirObservation(result));
    } catch (err) {
        next(err);
    }
});

// ============================================================
// GET /fhir/MedicationRequest/:patientId/:recordId
// ============================================================
router.get('/fhir/MedicationRequest/:patientId/:recordId', async (req, res, next) => {
    try {
        const { patientId, recordId } = req.params;
        const userId = req.query.userId || 'hospitalAdmin';
        const result = await query.getQuery('getRecordById', { patientId, recordId }, userId);
        if (!result || result.status === false) {
            return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: `Record ${recordId} not found` }] });
        }
        const meds = result.prescription?.medications || [];
        if (meds.length === 0) {
            return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'No medications in this record' }] });
        }
        if (meds.length === 1) {
            return res.json(toFhirMedicationRequest(result, meds[0], 0));
        }
        res.json(toFhirBundle('collection', meds.map((m, i) => toFhirMedicationRequest(result, m, i))));
    } catch (err) {
        next(err);
    }
});

// ============================================================
// GET /fhir/Claim/:patientId/:claimId
// ============================================================
router.get('/fhir/Claim/:patientId/:claimId', async (req, res, next) => {
    try {
        const { patientId, claimId } = req.params;
        const userId = req.query.userId || 'insuranceAgent-Rama';
        const result = await query.getQuery('getClaim', { patientId, claimId }, userId);
        if (!result || result.status === false) {
            return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: `Claim ${claimId} not found` }] });
        }
        res.json(toFhirClaim(result));
    } catch (err) {
        next(err);
    }
});

// ============================================================
// Helper: map internal Procedure -> FHIR R4 Procedure
// ============================================================
function toFhirProcedure(p) {
    const categoryMap = {
        surgery: { code: '387713003', display: 'Surgical procedure' },
        endoscopy: { code: '423827005', display: 'Endoscopy' },
        biopsy: { code: '86273004', display: 'Biopsy' },
        intervention: { code: '277132007', display: 'Therapeutic procedure' },
        minor: { code: '71388002', display: 'Procedure' },
    };
    const cat = categoryMap[p.category] || categoryMap.minor;

    const statusMap = {
        pending: 'in-progress',
        success: 'completed',
        complication: 'completed',
        failed: 'stopped',
    };

    return {
        resourceType: 'Procedure',
        id: p.procId,
        meta: { lastUpdated: p.updatedAt || p.timestamp },
        status: statusMap[p.outcome] || 'completed',
        category: {
            coding: [{ system: 'http://snomed.info/sct', code: cat.code, display: cat.display }]
        },
        code: {
            coding: [{
                system: 'http://hl7.org/fhir/sid/icd-10-pcs',
                code: p.procedureCode,
                display: p.procedureName
            }]
        },
        subject: { reference: `Patient/${p.patientId}` },
        performedDateTime: p.performedDate,
        performer: [
            ...(p.performedBy ? [{
                function: { coding: [{ code: 'primary' }] },
                actor: { reference: `Practitioner/${p.performedBy}` }
            }] : []),
            ...((p.assistants || []).map(a => ({
                function: { coding: [{ code: 'assistant' }] },
                actor: { reference: `Practitioner/${a}` }
            })))
        ],
        outcome: p.outcome ? { text: p.outcome } : undefined,
        complication: (p.complications || []).map(c => ({ text: c })),
        followUp: p.followUpPlan ? [{ text: p.followUpPlan }] : undefined,
        note: p.notes ? [{ text: p.notes }] : undefined,
        reasonReference: p.relatedRecordId
            ? [{ reference: `Observation/${p.relatedRecordId}` }]
            : undefined,
    };
}

// ============================================================
// GET /fhir/Procedure/:patientId/:procId
// ============================================================
router.get('/fhir/Procedure/:patientId/:procId', async (req, res, next) => {
    try {
        const { patientId, procId } = req.params;
        const userId = req.query.userId || 'hospitalAdmin';
        const all = await query.getQuery('getProceduresByPatient', { patientId }, userId);
        const list = Array.isArray(all) ? all : (typeof all === 'string' ? JSON.parse(all || '[]') : []);
        const proc = list.find(x => x.procId === procId);
        if (!proc) {
            return res.status(404).json({
                resourceType: 'OperationOutcome',
                issue: [{ severity: 'error', code: 'not-found', diagnostics: `Procedure ${procId} not found` }]
            });
        }
        res.json(toFhirProcedure(proc));
    } catch (err) {
        next(err);
    }
});

// ============================================================
// GET /fhir/Practitioner/:doctorId
// ============================================================
router.get('/fhir/Practitioner/:doctorId', async (req, res, next) => {
    try {
        const { doctorId } = req.params;
        const userId = req.query.userId || 'hospitalAdmin';
        const result = await query.getQuery('getAllDoctors', { hospitalId: '' }, userId);
        if (!Array.isArray(result)) {
            return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: `Doctor ${doctorId} not found` }] });
        }
        const doctor = result.find(d => d.doctorId === doctorId);
        if (!doctor) {
            return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: `Doctor ${doctorId} not found` }] });
        }
        res.json(toFhirPractitioner(doctor));
    } catch (err) {
        next(err);
    }
});

// ============================================================
// GET /fhir/metadata  (CapabilityStatement)
// ============================================================
router.get('/fhir/metadata', (req, res) => {
    res.json({
        resourceType: 'CapabilityStatement',
        status: 'active',
        date: new Date().toISOString(),
        kind: 'instance',
        fhirVersion: '4.0.1',
        format: ['json'],
        rest: [{
            mode: 'server',
            resource: [
                { type: 'Patient', interaction: [{ code: 'read' }], operation: [{ name: '$everything', definition: 'http://hl7.org/fhir/OperationDefinition/Patient-everything' }] },
                { type: 'Observation', interaction: [{ code: 'read' }] },
                { type: 'MedicationRequest', interaction: [{ code: 'read' }] },
                { type: 'Procedure', interaction: [{ code: 'read' }] },
                { type: 'Claim', interaction: [{ code: 'read' }] },
                { type: 'Practitioner', interaction: [{ code: 'read' }] },
            ],
        }],
    });
});

module.exports = router;
