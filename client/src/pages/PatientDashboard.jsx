import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAllRecordsByPatientId, getPrescriptionsByPatient, getClaimsByPatient, getPatientById, getAllDoctors } from '../services/api'
import { FiFileText, FiActivity, FiDollarSign, FiClock, FiUser, FiShield, FiPackage, FiCheckCircle, FiHeart, FiArrowRight } from 'react-icons/fi'
import { Link } from 'react-router-dom'

export default function PatientDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ records: 0, prescriptions: 0, claims: 0 })
  const [patientName, setPatientName] = useState('')
  const [recentRecords, setRecentRecords] = useState([])
  const [authorizedDoctors, setAuthorizedDoctors] = useState([])
  const [doctorMap, setDoctorMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const [recordsRes, prescRes, claimsRes, patientRes, doctorsRes] = await Promise.allSettled([
        getAllRecordsByPatientId({ userId: user.userId, patientId: user.userId }),
        getPrescriptionsByPatient({ userId: user.userId, patientId: user.userId }),
        getClaimsByPatient({ userId: user.userId, patientId: user.userId }),
        getPatientById({ userId: user.userId, patientId: user.userId }),
        getAllDoctors({ userId: user.userId }),
      ])

      const parseData = (raw, fallback = []) => {
        if (!raw) return fallback
        if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return fallback } }
        return raw
      }

      const records = recordsRes.status === 'fulfilled' ? parseData(recordsRes.value.data.data, []) : []
      const prescriptions = prescRes.status === 'fulfilled' ? parseData(prescRes.value.data.data, []) : []
      const claims = claimsRes.status === 'fulfilled' ? parseData(claimsRes.value.data.data, []) : []

      if (patientRes.status === 'fulfilled') {
        const patientData = parseData(patientRes.value.data.data, {})
        setAuthorizedDoctors(patientData.authorizedDoctors || [])
        setPatientName(patientData.name || '')
      }

      if (doctorsRes.status === 'fulfilled') {
        const doctors = parseData(doctorsRes.value.data.data, [])
        const map = {}
        doctors.forEach(d => { map[d.doctorId] = d })
        setDoctorMap(map)
      }

      setStats({
        records: records.length,
        prescriptions: prescriptions.length,
        claims: claims.length,
      })
      setRecentRecords(records.slice(-5).reverse())
    } catch {
      // Dashboard loads best-effort
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { label: 'Ho so benh an', value: stats.records, icon: FiFileText, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', text: 'text-blue-600', to: '/records' },
    { label: 'Don thuoc', value: stats.prescriptions, icon: FiActivity, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-600', to: '/prescriptions' },
    { label: 'Yeu cau bao hiem', value: stats.claims, icon: FiDollarSign, gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-50', text: 'text-amber-600', to: '/insurance' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400 mt-3">Dang tai du lieu...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 stagger-children">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary-600 via-primary-700 to-blue-700 p-4 lg:p-5 text-white">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
            <FiHeart className="text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg lg:text-xl font-bold truncate">Xin chao, {patientName || user.userId}</h1>
            <p className="text-primary-200 text-xs lg:text-sm">Tong quan ho so suc khoe cua ban</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {statCards.map((s) => (
          <Link key={s.label} to={s.to} className="card-hover group">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                <s.icon className={`text-lg ${s.text}`} />
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              </div>
              <FiArrowRight className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        ))}
      </div>

      {/* Authorized Doctors */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <FiShield className="text-blue-600 text-sm" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Bac si duoc cap quyen</h2>
              <p className="text-xs text-gray-400">{authorizedDoctors.length} bac si co quyen truy cap</p>
            </div>
          </div>
          <Link to="/access" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1 group">
            Quan ly
            <FiArrowRight className="text-xs group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
        {authorizedDoctors.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center mx-auto mb-2">
              <FiUser className="text-gray-300 text-lg" />
            </div>
            <p className="text-gray-400 text-xs">Chua cap quyen cho bac si nao</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {authorizedDoctors.map((doctorId) => {
              const doc = doctorMap[doctorId]
              return (
                <div key={doctorId} className="flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 transition-all hover:shadow-sm hover:-translate-y-0.5">
                  <div className="w-7 h-7 bg-blue-500 rounded-md flex items-center justify-center flex-shrink-0">
                    <FiUser className="text-white text-xs" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-blue-700">{doc?.name || doctorId}</span>
                      <span className="text-xs text-gray-400 font-mono">{doctorId}</span>
                    </div>
                    {doc && (doc.department || doc.position || doc.specialization) && (
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
                        {doc.department && <span className="bg-white/70 px-2 py-0.5 rounded-md">Khoa: {doc.department}</span>}
                        {doc.position && <span className="bg-white/70 px-2 py-0.5 rounded-md">CV: {doc.position}</span>}
                        {doc.specialization && <span className="bg-white/70 px-2 py-0.5 rounded-md">CK: {doc.specialization}</span>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent Records */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
              <FiFileText className="text-primary-600 text-sm" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Benh an gan day</h2>
              <p className="text-xs text-gray-400">{recentRecords.length} ban ghi gan nhat</p>
            </div>
          </div>
          <Link to="/records" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1 group">
            Xem tat ca
            <FiArrowRight className="text-xs group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
        {recentRecords.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center mx-auto mb-2">
              <FiFileText className="text-gray-300 text-lg" />
            </div>
            <p className="text-gray-400 text-xs">Chua co ho so benh an nao</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentRecords.map((record, i) => {
              const r = record.Value || record
              const diag = (() => { try { return typeof r.diagnosis === 'string' ? JSON.parse(r.diagnosis) : r.diagnosis } catch { return null } })()
              const pres = (() => { try { return typeof r.prescription === 'string' ? JSON.parse(r.prescription) : r.prescription } catch { return null } })()
              const icdCode = diag?.primary?.icdCode
              const icdDesc = diag?.primary?.description
              const medCount = pres?.medications?.length || 0
              const date = r.timestamp ? new Date(r.timestamp).toLocaleDateString('vi-VN') : null

              return (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-50 hover:bg-surface-100 transition-all duration-200 group cursor-default">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100 mt-0.5">
                    <FiFileText className="text-primary-500 text-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {icdCode && (
                        <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-semibold">
                          {icdCode}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {icdDesc || 'Khong co chan doan'}
                      </span>
                      {r.dispensed && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-medium">
                          <FiCheckCircle className="text-xs" /> Da cap thuoc
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                      {r.doctorId && (
                        <span className="flex items-center gap-1">
                          <FiUser className="text-xs" /> {r.doctorId}
                        </span>
                      )}
                      {medCount > 0 && (
                        <span className="flex items-center gap-1">
                          <FiPackage className="text-xs" /> {medCount} thuoc
                        </span>
                      )}
                      {date && (
                        <span className="flex items-center gap-1">
                          <FiClock className="text-xs" /> {date}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
