import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Auth
export const registerPatient = (data) => api.post('/registerPatient', data)
export const loginPatient = (data) => api.post('/loginPatient', data)

// Records
export const addRecord = (data) => api.post('/addRecord', data)
export const updateRecord = (data) => api.post('/updateRecord', data)
export const getAllRecordsByPatientId = (data) => api.post('/getAllRecordsByPatientId', data)
export const getRecordById = (data) => api.post('/getRecordById', data)
export const queryHistoryOfAsset = (data) => api.post('/queryHistoryOfAsset', data)

// Access Control
export const getAllPrescriptions = (data) => api.post('/getAllPrescriptions', data)
export const getMyPatients = (data) => api.post('/getMyPatients', data)
export const getPatientById = (data) => api.post('/getPatientById', data)
export const grantAccess = (data) => api.post('/grantAccess', data)
export const revokeAccess = (data) => api.post('/revokeAccess', data)

// Prescriptions
export const getPrescriptionsByPatient = (data) => api.post('/getPrescriptionsByPatient', data)
export const verifyPrescription = (data) => api.post('/verifyPrescription', data)

// Insurance
export const createClaim = (data) => api.post('/createClaim', data)
export const getClaim = (data) => api.post('/getClaim', data)
export const getClaimsByPatient = (data) => api.post('/getClaimsByPatient', data)
export const approveClaim = (data) => api.post('/approveClaim', data)
export const rejectClaim = (data) => api.post('/rejectClaim', data)
export const getAllClaims = (data) => api.post('/getAllClaims', data)

// Research
export const onboardResearcher = (data) => api.post('/onboardResearcher', data)
export const requestConsent = (data) => api.post('/requestConsent', data)
export const approveConsent = (data) => api.post('/approveConsent', data)
export const getAnonymizedData = (data) => api.post('/getAnonymizedData', data)

// Emergency
export const emergencyAccess = (data) => api.post('/emergencyAccess', data)
export const getEmergencyLogs = (data) => api.post('/getEmergencyLogs', data)

// Rewards
export const issueReward = (data) => api.post('/issueReward', data)
export const claimReward = (data) => api.post('/claimReward', data)
export const getRewardsByPatient = (data) => api.post('/getRewardsByPatient', data)

// Admin
export const fetchLedger = (data) => api.post('/fetchLedger', data)
export const fetchInsuranceLedger = (data) => api.post('/fetchInsuranceLedger', data)

// Multi-org management
export const onboardHospital = (data) => api.post('/onboardHospital', data)
export const onboardDoctor = (data) => api.post('/onboardDoctor', data)
export const onboardPharmacy = (data) => api.post('/onboardPharmacy', data)
export const onboardInsuranceCompany = (data) => api.post('/onboardInsuranceCompany', data)
export const onboardInsuranceAgent = (data) => api.post('/onboardInsuranceAgent', data)
export const getAllHospitals = (data) => api.post('/getAllHospitals', data)
export const getAllDoctors = (data) => api.post('/getAllDoctors', data)
export const getAllPharmacies = (data) => api.post('/getAllPharmacies', data)
export const getAllInsuranceCompanies = (data) => api.post('/getAllInsuranceCompanies', data)
export const getAllAgents = (data) => api.post('/getAllAgents', data)

export default api
