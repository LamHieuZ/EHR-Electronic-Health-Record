import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getPrescriptionsByPatient, verifyPrescription, getAllPrescriptions } from '../services/api'
import { toast } from 'react-toastify'
import { FiActivity, FiSearch, FiCheckCircle, FiPackage, FiUser, FiClock, FiAlertCircle } from 'react-icons/fi'

const routeLabel = { oral: 'Uống', iv: 'Tiêm TM', im: 'Tiêm bắp', sc: 'Tiêm dưới da', topical: 'Bôi ngoài', inhaled: 'Hít', rectal: 'Trực tràng', sublingual: 'Ngậm lưỡi' }
const timingLabel = { before_meal: 'Trước ăn', after_meal: 'Sau ăn', with_meal: 'Trong khi ăn', empty_stomach: 'Lúc đói', bedtime: 'Trước ngủ', morning: 'Buổi sáng', as_needed: 'Khi cần' }
const durationUnitLabel = { days: 'ngày', weeks: 'tuần', months: 'tháng' }

function MedicationList({ prescription }) {
  const p = typeof prescription === 'string' ? (() => { try { return JSON.parse(prescription) } catch { return null } })() : prescription
  const meds = p?.medications || []
  if (meds.length === 0) return <p className="text-gray-400 text-sm">Không có thuốc</p>
  return (
    <div className="space-y-3">
      {meds.map((m, i) => (
        <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <FiPackage className="text-green-600 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 text-sm">{m.drugName}</span>
                {m.drugCode && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{m.drugCode}</span>}
              </div>
              <span className="text-sm font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-lg">
                {m.strength}{m.unit}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
              {m.dosage?.quantity && <span>{m.dosage.quantity} viên/lần</span>}
              {m.dosage?.frequency && <span>· {m.dosage.frequency} lần/ngày</span>}
              {m.dosage?.route && <span>· {routeLabel[m.dosage.route] || m.dosage.route}</span>}
              {m.dosage?.timing && <span>· {timingLabel[m.dosage.timing] || m.dosage.timing}</span>}
              {m.dosage?.duration && (
                <span>· {m.dosage.duration} {durationUnitLabel[m.dosage.durationUnit] || m.dosage.durationUnit}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Prescriptions() {
  const { user } = useAuth()
  const [patientId, setPatientId] = useState(user.role === 'patient' ? user.userId : '')
  const [prescriptions, setPrescriptions] = useState([])
  const [dispensedIds, setDispensedIds] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [verifyForm, setVerifyForm] = useState(null)

  useEffect(() => {
    if (user.role === 'patient') loadPrescriptions()
    if (user.role === 'pharmacy') loadAllPrescriptions()
  }, [])

  const loadAllPrescriptions = async () => {
    setLoading(true)
    try {
      const res = await getAllPrescriptions({ userId: user.userId })
      const data = Array.isArray(res.data.data) ? res.data.data : []
      setPrescriptions(data)
    } catch {
      toast.error('Lỗi tải đơn thuốc')
    } finally {
      setLoading(false)
    }
  }

  const loadPrescriptions = async () => {
    if (!patientId.trim()) return
    setLoading(true)
    try {
      const res = await getPrescriptionsByPatient({ userId: user.userId, patientId: patientId.trim() })
      const raw = res.data.data
      const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
      setPrescriptions(data)
      if (data.length === 0) toast.info('Không có đơn thuốc')
    } catch {
      toast.error('Lỗi tải đơn thuốc')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (recordId) => {
    const pid = verifyForm.patientId || patientId.trim()
    if (!pid) return toast.error('Không xác định được Patient ID')
    setLoading(true)
    try {
      const res = await verifyPrescription({
        userId: user.userId,
        patientId: pid,
        recordId,
        dispensedBy: user.userId,
        dispensedNotes: verifyForm.notes,
      })
      if (res.data.success || res.data.data) {
        toast.success('Xác nhận cấp thuốc thành công!')
        setVerifyForm(null)
        setDispensedIds(prev => new Set([...prev, recordId]))
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Đơn thuốc</h1>
          <p className="text-gray-500 mt-1">
            {user.role === 'pharmacy' ? 'Xác nhận và cấp phát thuốc' : 'Xem danh sách đơn thuốc'}
          </p>
        </div>
        {user.role === 'pharmacy' && prescriptions.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl">
            <FiAlertCircle className="text-yellow-500" />
            <span className="text-sm font-medium text-yellow-700">
              {prescriptions.filter(p => !dispensedIds.has(p.recordId || p.Key)).length} chờ cấp
            </span>
          </div>
        )}
      </div>

      {user.role !== 'patient' && user.role !== 'pharmacy' && (
        <div className="card">
          <div className="flex gap-3">
            <input
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="input-field flex-1"
              placeholder="Nhập Patient ID"
              onKeyDown={(e) => e.key === 'Enter' && loadPrescriptions()}
            />
            <button onClick={loadPrescriptions} disabled={loading} className="btn-primary flex items-center gap-2">
              <FiSearch /> Tra cứu
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="card text-center py-12">
          <FiActivity className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Chưa có đơn thuốc nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((p, i) => {
            const val = p.Value || p
            const key = p.recordId || p.Key || `rx-${i}`
            const pid = p.patientId || val.patientId || ''
            const isDispensed = dispensedIds.has(key) || val.dispensed === true || p.dispensed === true
            return (
              <div key={i} className="card">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FiActivity className="text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{key}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        {(p.patientName || p.patientId || val.patientId) && (
                          <span className="flex items-center gap-1 text-primary-600 font-medium">
                            <FiUser className="text-xs" /> {p.patientName ? `${p.patientId} (${p.patientName})` : (p.patientId || val.patientId)}
                          </span>
                        )}
                        {(val.doctorId || p.doctorId) && (
                          <span className="flex items-center gap-1"><FiUser className="text-xs" /> {val.doctorId || p.doctorId}</span>
                        )}
                        {(val.createdAt || p.createdAt) && (
                          <span className="flex items-center gap-1"><FiClock className="text-xs" />{new Date(val.createdAt || p.createdAt).toLocaleDateString('vi-VN')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isDispensed ? (
                    <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                      <FiCheckCircle /> Đã cấp
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">
                      Chờ cấp
                    </span>
                  )}
                </div>

                {/* Medications */}
                <MedicationList prescription={val.prescription || p.prescription || p} />

                {/* Dispensed info */}
                {isDispensed && (
                  <div className="mt-3 p-3 bg-green-50 rounded-xl text-xs text-green-700 space-y-0.5">
                    {val.dispensedBy && <p>Người cấp: <strong>{val.dispensedBy}</strong></p>}
                    {val.dispensedAt && <p>Thời gian: {new Date(val.dispensedAt).toLocaleString('vi-VN')}</p>}
                    {val.dispensedNotes && <p>Ghi chú: {val.dispensedNotes}</p>}
                  </div>
                )}

                {/* Pharmacy verify */}
                {user.role === 'pharmacy' && !isDispensed && (
                  <div className="mt-4">
                    {verifyForm?.recordId === key ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={verifyForm.notes}
                          onChange={(e) => setVerifyForm({ ...verifyForm, notes: e.target.value })}
                          className="input-field flex-1"
                          placeholder="VD: Đã cấp đủ thuốc theo đơn (có thể để trống)"
                        />
                        <button onClick={() => handleVerify(key)} className="btn-success flex items-center gap-1">
                          <FiCheckCircle /> Xác nhận
                        </button>
                        <button onClick={() => setVerifyForm(null)} className="btn-secondary">Hủy</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setVerifyForm({ recordId: key, patientId: pid, notes: '' })}
                        className="btn-primary text-sm"
                      >
                        Cấp thuốc
                      </button>
                    )}
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
