import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getPrescriptionsByPatient, verifyPrescription } from '../services/api'
import { toast } from 'react-toastify'
import { FiActivity, FiSearch, FiCheckCircle } from 'react-icons/fi'

export default function Prescriptions() {
  const { user } = useAuth()
  const [patientId, setPatientId] = useState(user.role === 'patient' ? user.userId : '')
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [verifyForm, setVerifyForm] = useState(null)

  const loadPrescriptions = async () => {
    if (!patientId.trim()) return
    setLoading(true)
    try {
      const res = await getPrescriptionsByPatient({ userId: user.userId, args: [patientId] })
      const data = JSON.parse(res.data.data || '[]')
      setPrescriptions(data)
      if (data.length === 0) toast.info('Không có đơn thuốc')
    } catch {
      toast.error('Lỗi tải đơn thuốc')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (recordId) => {
    if (!verifyForm?.notes) return toast.error('Vui lòng nhập ghi chú')
    setLoading(true)
    try {
      const res = await verifyPrescription({
        userId: user.userId,
        args: [patientId, recordId, user.userId, verifyForm.notes],
      })
      if (res.data.success || res.data.data) {
        toast.success('Xác nhận cấp thuốc thành công!')
        setVerifyForm(null)
        loadPrescriptions()
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
        <h1 className="text-2xl font-bold text-gray-900">Đơn thuốc</h1>
        <p className="text-gray-500 mt-1">
          {user.role === 'pharmacy' ? 'Xác nhận và cấp phát thuốc' : 'Xem danh sách đơn thuốc'}
        </p>
      </div>

      <div className="card">
        <div className="flex gap-3">
          <input
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="input-field flex-1"
            placeholder="Patient ID"
            onKeyDown={(e) => e.key === 'Enter' && loadPrescriptions()}
            readOnly={user.role === 'patient'}
          />
          <button onClick={loadPrescriptions} disabled={loading} className="btn-primary flex items-center gap-2">
            <FiSearch /> Tra cứu
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : prescriptions.length > 0 ? (
        <div className="space-y-4">
          {prescriptions.map((p, i) => (
            <div key={i} className="card">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiActivity className="text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">
                      {p.recordId || p.Key || `Đơn thuốc #${i + 1}`}
                    </h3>
                    {p.dispensed ? (
                      <span className="badge bg-green-100 text-green-700">Đã cấp</span>
                    ) : (
                      <span className="badge bg-yellow-100 text-yellow-700">Chờ cấp</span>
                    )}
                  </div>

                  <div className="mt-2 bg-gray-50 rounded-lg p-3">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                      {typeof p.prescription === 'object' ? JSON.stringify(p.prescription, null, 2) : p.prescription || JSON.stringify(p, null, 2)}
                    </pre>
                  </div>

                  {/* Pharmacy verify */}
                  {user.role === 'pharmacy' && !p.dispensed && (
                    <div className="mt-3">
                      {verifyForm?.recordId === (p.recordId || p.Key) ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={verifyForm.notes}
                            onChange={(e) => setVerifyForm({ ...verifyForm, notes: e.target.value })}
                            className="input-field flex-1"
                            placeholder="Ghi chú cấp thuốc..."
                          />
                          <button onClick={() => handleVerify(p.recordId || p.Key)} className="btn-success flex items-center gap-1">
                            <FiCheckCircle /> Xác nhận
                          </button>
                          <button onClick={() => setVerifyForm(null)} className="btn-secondary">Hủy</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setVerifyForm({ recordId: p.recordId || p.Key, notes: '' })}
                          className="btn-primary text-sm"
                        >
                          Cấp thuốc
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
