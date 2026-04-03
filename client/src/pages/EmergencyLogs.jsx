import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { emergencyAccess, getEmergencyLogs } from '../services/api'
import { toast } from 'react-toastify'
import { FiAlertTriangle, FiSearch, FiClock } from 'react-icons/fi'

export default function EmergencyLogs() {
  const { user } = useAuth()
  const [patientId, setPatientId] = useState(user.role === 'patient' ? user.userId : '')
  const [reason, setReason] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)

  const handleEmergencyAccess = async () => {
    if (!patientId.trim() || !reason.trim()) {
      return toast.error('Vui lòng nhập Patient ID và lý do')
    }
    setLoading(true)
    try {
      const res = await emergencyAccess({ userId: user.userId, patientId, reason })
      if (res.data.success || res.data.data) {
        toast.success('Truy cập khẩn cấp đã được ghi nhận')
        setReason('')
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  const handleGetLogs = async () => {
    if (!patientId.trim()) return
    setLoading(true)
    try {
      const res = await getEmergencyLogs({ userId: user.userId, patientId })
      const raw = res.data.data
      setLogs(typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []))
    } catch {
      toast.error('Lỗi tải nhật ký')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Truy cập khẩn cấp</h1>
        <p className="text-gray-500 mt-1">Nhật ký truy cập khẩn cấp hồ sơ bệnh nhân</p>
      </div>

      {/* Emergency access (for doctors) */}
      {user.role === 'doctor' && (
        <div className="card max-w-xl border-red-200 bg-red-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <FiAlertTriangle className="text-red-600" />
            </div>
            <div>
              <h2 className="font-semibold text-red-900">Truy cập khẩn cấp</h2>
              <p className="text-sm text-red-700">Chỉ sử dụng trong trường hợp cấp cứu. Mọi truy cập đều được ghi log.</p>
            </div>
          </div>
          <div className="space-y-3">
            <input type="text" value={patientId} onChange={(e) => setPatientId(e.target.value)} className="input-field" placeholder="Patient ID" />
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="input-field h-20" placeholder="Lý do truy cập khẩn cấp..." />
            <button onClick={handleEmergencyAccess} disabled={loading} className="btn-danger flex items-center gap-2">
              <FiAlertTriangle /> Xác nhận truy cập khẩn cấp
            </button>
          </div>
        </div>
      )}

      {/* View logs */}
      <div className="card max-w-xl">
        <h2 className="text-lg font-semibold mb-4">Nhật ký truy cập</h2>
        <div className="flex gap-3 mb-4">
          <input type="text" value={patientId} onChange={(e) => setPatientId(e.target.value)} className="input-field flex-1" placeholder="Patient ID" readOnly={user.role === 'patient'} />
          <button onClick={handleGetLogs} disabled={loading} className="btn-primary flex items-center gap-2">
            <FiSearch /> Xem log
          </button>
        </div>

        {logs.length > 0 ? (
          <div className="space-y-3">
            {logs.map((log, i) => {
              const val = log.Value || log
              return (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <FiClock className="text-gray-400 mt-1 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">
                      Truy cập bởi: {val.accessedBy || val.doctorId || 'N/A'}
                    </p>
                    <p className="text-gray-600">Lý do: {val.reason || 'N/A'}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      {val.timestamp ? new Date(val.timestamp).toLocaleString('vi-VN') : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-4">Chưa có nhật ký truy cập khẩn cấp</p>
        )}
      </div>
    </div>
  )
}
