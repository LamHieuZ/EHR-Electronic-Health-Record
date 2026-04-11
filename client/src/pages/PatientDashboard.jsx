import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAllRecordsByPatientId, getPrescriptionsByPatient, getClaimsByPatient, getPatientById } from '../services/api'
import { FiFileText, FiActivity, FiDollarSign, FiClock, FiUser, FiShield, FiPackage, FiCheckCircle } from 'react-icons/fi'
import { Link } from 'react-router-dom'

export default function PatientDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ records: 0, prescriptions: 0, claims: 0 })
  const [patientName, setPatientName] = useState('')
  const [recentRecords, setRecentRecords] = useState([])
  const [authorizedDoctors, setAuthorizedDoctors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const [recordsRes, prescRes, claimsRes, patientRes] = await Promise.allSettled([
        getAllRecordsByPatientId({ userId: user.userId, patientId: user.userId }),
        getPrescriptionsByPatient({ userId: user.userId, patientId: user.userId }),
        getClaimsByPatient({ userId: user.userId, patientId: user.userId }),
        getPatientById({ userId: user.userId, patientId: user.userId }),
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
    { label: 'Hồ sơ bệnh án', value: stats.records, icon: FiFileText, color: 'blue', to: '/records' },
    { label: 'Đơn thuốc', value: stats.prescriptions, icon: FiActivity, color: 'green', to: '/prescriptions' },
    { label: 'Yêu cầu bảo hiểm', value: stats.claims, icon: FiDollarSign, color: 'yellow', to: '/insurance' },
  ]

  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Xin chào, {patientName || user.userId}</h1>
        <p className="text-gray-500 mt-1">Tổng quan hồ sơ sức khỏe của bạn</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Link key={s.label} to={s.to} className="card hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorMap[s.color]}`}>
                <s.icon className="text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500">{s.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Authorized Doctors */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Bác sĩ được cấp quyền</h2>
          <Link to="/access" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Quản lý quyền
          </Link>
        </div>
        {authorizedDoctors.length === 0 ? (
          <p className="text-gray-400 text-center py-6">Chưa cấp quyền cho bác sĩ nào</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {authorizedDoctors.map((doctorId) => (
              <div key={doctorId} className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                <FiUser className="text-blue-500 text-sm" />
                <span className="text-sm font-medium text-blue-700">{doctorId}</span>
                <FiShield className="text-blue-400 text-xs" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Records */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Bệnh án gần đây</h2>
          <Link to="/records" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Xem tất cả
          </Link>
        </div>
        {recentRecords.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Chưa có hồ sơ bệnh án nào</p>
        ) : (
          <div className="space-y-3">
            {recentRecords.map((record, i) => {
              const r = record.Value || record
              const diag = (() => { try { return typeof r.diagnosis === 'string' ? JSON.parse(r.diagnosis) : r.diagnosis } catch { return null } })()
              const pres = (() => { try { return typeof r.prescription === 'string' ? JSON.parse(r.prescription) : r.prescription } catch { return null } })()
              const icdCode = diag?.primary?.icdCode
              const icdDesc = diag?.primary?.description
              const medCount = pres?.medications?.length || 0
              const date = r.timestamp ? new Date(r.timestamp).toLocaleDateString('vi-VN') : null

              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiFileText className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {icdCode && (
                        <span className="text-xs font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          {icdCode}
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {icdDesc || 'Không có chẩn đoán'}
                      </span>
                      {r.dispensed && (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                          <FiCheckCircle className="text-xs" /> Đã cấp thuốc
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      {r.doctorId && (
                        <span className="flex items-center gap-1">
                          <FiUser className="text-xs" /> {r.doctorId}
                        </span>
                      )}
                      {medCount > 0 && (
                        <span className="flex items-center gap-1">
                          <FiPackage className="text-xs" /> {medCount} thuốc
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
