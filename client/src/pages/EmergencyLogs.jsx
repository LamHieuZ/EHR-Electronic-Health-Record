import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { emergencyAccess, getEmergencyLogs, getMyPatients } from '../services/api'
import { toast } from 'react-toastify'
import {
  FiAlertTriangle, FiSearch, FiClock, FiRefreshCw,
  FiUser, FiFileText, FiShield, FiActivity,
} from 'react-icons/fi'

// ============================================================
// Doctor view — truy cập khẩn cấp
// ============================================================
function DoctorView({ user }) {
  const [patientId, setPatientId] = useState('')
  const [searchName, setSearchName] = useState('')
  const [patients, setPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => { loadPatients() }, [])

  const loadPatients = async () => {
    setLoadingPatients(true)
    try {
      const res = await getMyPatients({ userId: user.userId })
      const raw = res.data?.data
      setPatients(Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : []))
    } catch { /* ignore */ }
    finally { setLoadingPatients(false) }
  }

  const filteredPatients = patients.filter(p =>
    !searchName || (p.name || p.patientId || '').toLowerCase().includes(searchName.toLowerCase())
  )

  const handleAccess = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const res = await emergencyAccess({ userId: user.userId, patientId, reason })
      if (res.data.success || res.data.data) {
        const raw = res.data.data
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw
        setResult(data)
        toast.success(`Truy cập khẩn cấp đã được ghi nhận — Log ID: ${data?.emergencyLogId || ''}`)
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Truy cập khẩn cấp</h1>
        <p className="text-gray-500 mt-1">Chỉ sử dụng trong tình huống cấp cứu — mọi truy cập đều được ghi lại</p>
      </div>

      {/* Warning */}
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
        <FiAlertTriangle className="text-red-600 text-xl flex-shrink-0 mt-0.5" />
        <div className="text-sm text-red-800">
          <p className="font-semibold">Cảnh báo sử dụng trái phép</p>
          <p className="mt-0.5 text-red-700">Truy cập khẩn cấp sẽ được ghi lại vào blockchain kèm thông tin bác sĩ, thời gian và lý do. Sử dụng sai mục đích sẽ bị xử lý theo quy định.</p>
        </div>
      </div>

      <form onSubmit={handleAccess} className="card max-w-xl space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <FiShield className="text-red-500" /> Thông tin truy cập
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bệnh nhân *</label>
          {/* Tim kiem theo ten */}
          <div className="relative mb-2">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="input-field pl-10"
              placeholder="Tìm theo tên bệnh nhân..."
            />
          </div>
          {/* Danh sach benh nhan */}
          {loadingPatients ? (
            <p className="text-xs text-gray-400">Đang tải danh sách...</p>
          ) : patients.length === 0 ? (
            <div>
              <p className="text-xs text-gray-400 mb-2">Không có bệnh nhân đã cấp quyền. Nhập Patient ID trực tiếp:</p>
              <input
                type="text"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="input-field"
                placeholder="VD: P-nguyenvana-x7k2"
                required
              />
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {filteredPatients.length === 0 ? (
                <p className="text-xs text-gray-400 p-3 text-center">Không tìm thấy</p>
              ) : filteredPatients.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setPatientId(p.patientId); setSearchName(p.name || p.patientId) }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                    patientId === p.patientId ? 'bg-primary-50 border-l-2 border-primary-500' : ''
                  }`}
                >
                  <FiUser className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name || p.patientId}</p>
                    <p className="text-xs text-gray-400 font-mono">{p.patientId}</p>
                  </div>
                  {patientId === p.patientId && (
                    <span className="text-xs text-primary-600 font-medium">Đã chọn</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {patientId && (
            <p className="text-xs text-primary-600 mt-1">Đã chọn: <span className="font-mono">{patientId}</span></p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lý do truy cập * <span className="text-gray-400 font-normal">(tối thiểu 10 ký tự)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input-field h-24 resize-none"
            placeholder="Mô tả rõ tình trạng khẩn cấp và lý do cần truy cập hồ sơ..."
            required
            minLength={10}
          />
          <p className="text-xs text-gray-400 mt-1">{reason.length} ký tự</p>
        </div>
        <button
          type="submit"
          disabled={loading || reason.length < 10 || !patientId.trim()}
          className="btn-danger flex items-center gap-2 w-full justify-center"
        >
          {loading
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <FiAlertTriangle />}
          Xác nhận truy cập khẩn cấp
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="card bg-green-50 border border-green-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <FiUser className="text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{result.patient?.name || result.patient?.patientId}</p>
                <p className="text-xs text-gray-400 font-mono">{result.patient?.patientId}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {result.patient?.dob && (
                <div className="bg-white rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-400">Ngày sinh</p>
                  <p className="font-medium text-gray-800">{result.patient.dob}</p>
                </div>
              )}
              {result.patient?.city && (
                <div className="bg-white rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-400">Thành phố</p>
                  <p className="font-medium text-gray-800">{result.patient.city}</p>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Log ID: <span className="font-mono">{result.emergencyLogId}</span>
            </p>
          </div>

          {result.records?.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FiFileText className="text-primary-500" /> Hồ sơ bệnh án ({result.records.length})
              </h3>
              {result.records.map((rec, i) => {
                const diagnosis = typeof rec.diagnosis === 'string' ? JSON.parse(rec.diagnosis || '{}') : rec.diagnosis
                const primary = diagnosis?.primary || {}
                return (
                  <div key={i} className="card space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FiFileText className="text-primary-600 text-sm" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm font-mono">{rec.recordId}</p>
                        <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                          <span className="flex items-center gap-1"><FiActivity className="text-xs" /> {rec.doctorId}</span>
                          {rec.timestamp && <span>{new Date(rec.timestamp).toLocaleDateString('vi-VN')}</span>}
                        </div>
                      </div>
                    </div>
                    {primary.icdCode && (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">{primary.icdCode}</span>
                        <span className="text-sm text-gray-700">{primary.description}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Patient view — nhật ký khẩn cấp
// ============================================================
function PatientView({ user }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadLogs() }, [])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const res = await getEmergencyLogs({ userId: user.userId, patientId: user.userId })
      const raw = res.data?.data
      const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
      setLogs(data)
    } catch {
      toast.error('Lỗi tải nhật ký')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nhật ký khẩn cấp</h1>
          <p className="text-gray-500 mt-1">Lịch sử truy cập khẩn cấp vào hồ sơ của bạn</p>
        </div>
        <button onClick={loadLogs} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </div>

      <div className="card bg-amber-50 border border-amber-200 flex items-start gap-3">
        <FiAlertTriangle className="text-amber-600 text-xl flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Đây là danh sách các lần bác sĩ truy cập khẩn cấp vào hồ sơ của bạn. Nếu bạn thấy truy cập bất thường, hãy liên hệ bệnh viện.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card text-center py-12">
          <FiShield className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Chưa có lần truy cập khẩn cấp nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log, i) => {
            const val = log.Value || log
            return (
              <div key={i} className="card border-l-4 border-red-400 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FiAlertTriangle className="text-red-500 text-sm" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        Bác sĩ: <span className="font-mono text-primary-600">{val.accessedBy || val.doctorId || 'N/A'}</span>
                      </p>
                      {val.timestamp && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <FiClock className="text-xs" />
                          {new Date(val.timestamp).toLocaleString('vi-VN')}
                        </p>
                      )}
                    </div>
                  </div>
                  {val.logId && (
                    <span className="text-xs text-gray-400 font-mono flex-shrink-0">{val.logId}</span>
                  )}
                </div>
                {val.reason && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 border-l-2 border-gray-200">
                    {val.reason}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Hospital view — xem log theo patient
// ============================================================
function HospitalView({ user }) {
  const [patientId, setPatientId] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!patientId.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await getEmergencyLogs({ userId: user.userId, patientId })
      const raw = res.data?.data
      const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
      setLogs(data)
    } catch {
      toast.error('Lỗi tải nhật ký')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nhật ký truy cập khẩn cấp</h1>
        <p className="text-gray-500 mt-1">Kiểm tra lịch sử truy cập khẩn cấp của từng bệnh nhân</p>
      </div>

      <form onSubmit={handleSearch} className="card flex gap-3 max-w-xl">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="input-field pl-10"
            placeholder="Nhập Patient ID"
          />
        </div>
        <button type="submit" disabled={loading || !patientId.trim()} className="btn-primary flex items-center gap-2">
          {loading
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <FiSearch />}
          Tìm
        </button>
      </form>

      {searched && (
        logs.length === 0 ? (
          <div className="card text-center py-12">
            <FiShield className="text-4xl text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">Không có nhật ký truy cập khẩn cấp</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{logs.length} lần truy cập</p>
            {logs.map((log, i) => {
              const val = log.Value || log
              return (
                <div key={i} className="card border-l-4 border-red-400 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FiAlertTriangle className="text-red-500 text-sm" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">
                        Bác sĩ: <span className="font-mono text-primary-600">{val.accessedBy || val.doctorId || 'N/A'}</span>
                      </p>
                      {val.timestamp && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <FiClock className="text-xs" />
                          {new Date(val.timestamp).toLocaleString('vi-VN')}
                        </p>
                      )}
                    </div>
                    {val.logId && <span className="text-xs text-gray-400 font-mono">{val.logId}</span>}
                  </div>
                  {val.reason && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 border-l-2 border-gray-200">
                      {val.reason}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

// ============================================================
// Root
// ============================================================
export default function EmergencyLogs() {
  const { user } = useAuth()
  if (user.role === 'doctor') return <DoctorView user={user} />
  if (user.role === 'patient') return <PatientView user={user} />
  return <HospitalView user={user} />
}
