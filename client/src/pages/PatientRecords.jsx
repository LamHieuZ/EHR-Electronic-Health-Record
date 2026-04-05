import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAllRecordsByPatientId, queryHistoryOfAsset } from '../services/api'
import { toast } from 'react-toastify'
import { FiFileText, FiSearch, FiClock, FiChevronDown, FiChevronUp, FiUser, FiActivity, FiPackage } from 'react-icons/fi'

const routeLabel = { oral: 'Uống', iv: 'Tiêm TM', im: 'Tiêm bắp', sc: 'Tiêm dưới da', topical: 'Bôi ngoài', inhaled: 'Hít', rectal: 'Trực tràng', sublingual: 'Ngậm lưỡi' }
const timingLabel = { before_meal: 'Trước ăn', after_meal: 'Sau ăn', with_meal: 'Trong khi ăn', empty_stomach: 'Lúc đói', bedtime: 'Trước ngủ', morning: 'Buổi sáng', as_needed: 'Khi cần' }
const durationUnitLabel = { days: 'ngày', weeks: 'tuần', months: 'tháng' }

function DiagnosisCard({ diagnosis }) {
  const d = typeof diagnosis === 'string' ? JSON.parse(diagnosis) : diagnosis
  if (!d) return <p className="text-gray-400 text-sm">Không có dữ liệu</p>
  const primary = d.primary || {}
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">{primary.icdCode || '—'}</span>
        <span className="text-sm font-medium text-gray-800">{primary.description || '—'}</span>
      </div>
      {d.secondary?.length > 0 && (
        <div className="space-y-1">
          {d.secondary.map((s, i) => (
            <div key={i} className="flex items-center gap-2 pl-4">
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{s.icdCode}</span>
              <span className="text-xs text-gray-600">{s.description}</span>
            </div>
          ))}
        </div>
      )}
      {d.notes && <p className="text-xs text-gray-500 italic">Ghi chú: {d.notes}</p>}
    </div>
  )
}

function PrescriptionCard({ prescription }) {
  const p = typeof prescription === 'string' ? JSON.parse(prescription) : prescription
  const meds = p?.medications || []
  if (meds.length === 0) return <p className="text-gray-400 text-sm">Không có đơn thuốc</p>
  return (
    <div className="space-y-2">
      {meds.map((m, i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-lg p-3 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiPackage className="text-green-500 text-sm flex-shrink-0" />
              <span className="text-sm font-medium text-gray-800">{m.drugName}</span>
              {m.drugCode && <span className="text-xs text-gray-400">({m.drugCode})</span>}
            </div>
            <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">
              {m.strength}{m.unit}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-500 pl-5">
            {m.dosage?.quantity && <span>{m.dosage.quantity} viên/lần</span>}
            {m.dosage?.frequency && <span>· {m.dosage.frequency} lần/ngày</span>}
            {m.dosage?.route && <span>· {routeLabel[m.dosage.route] || m.dosage.route}</span>}
            {m.dosage?.timing && <span>· {timingLabel[m.dosage.timing] || m.dosage.timing}</span>}
            {m.dosage?.duration && (
              <span>· {m.dosage.duration} {durationUnitLabel[m.dosage.durationUnit] || m.dosage.durationUnit}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function PatientRecords() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [history, setHistory] = useState({})
  const [searchPatientId, setSearchPatientId] = useState('')

  useEffect(() => {
    if (user.role === 'patient') loadRecords(user.userId)
  }, [])

  const loadRecords = async (patientId) => {
    setLoading(true)
    try {
      const res = await getAllRecordsByPatientId({ userId: user.userId, patientId })
      const raw = res.data.data
      const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
      setRecords(data)
    } catch {
      toast.error('Không thể tải hồ sơ')
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async (assetId) => {
    if (expandedId === assetId) { setExpandedId(null); return }
    if (history[assetId]) { setExpandedId(assetId); return }
    try {
      const res = await queryHistoryOfAsset({ userId: user.userId, recordId: assetId })
      const raw = res.data
      const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw?.data || []))
      setHistory((prev) => ({ ...prev, [assetId]: data }))
      setExpandedId(assetId)
    } catch {
      toast.error('Không thể tải lịch sử')
    }
  }

  const handleSearch = () => {
    if (searchPatientId.trim()) loadRecords(searchPatientId.trim())
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hồ sơ bệnh án</h1>
        <p className="text-gray-500 mt-1">Xem và theo dõi lịch sử khám bệnh</p>
      </div>

      {user.role !== 'patient' && (
        <div className="card">
          <div className="flex gap-3">
            <input
              type="text"
              value={searchPatientId}
              onChange={(e) => setSearchPatientId(e.target.value)}
              className="input-field flex-1"
              placeholder="Nhập Patient ID để tra cứu"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="btn-primary flex items-center gap-2">
              <FiSearch /> Tìm kiếm
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="card text-center py-12">
          <FiFileText className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Chưa có hồ sơ bệnh án nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record, i) => {
            const val = record.Value || record
            const key = record.Key || `record-${i}`
            const isExpanded = expandedId === key

            return (
              <div key={i} className="card">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FiFileText className="text-primary-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{key}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1"><FiUser className="text-xs" /> {val.doctorId || 'N/A'}</span>
                        {val.version && <span className="flex items-center gap-1"><FiActivity className="text-xs" /> v{val.version}</span>}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                    {val.createdAt ? new Date(val.createdAt).toLocaleDateString('vi-VN') : ''}
                  </span>
                </div>

                {/* Body */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Chẩn đoán</p>
                    <div className="bg-blue-50/50 rounded-xl p-3">
                      <DiagnosisCard diagnosis={val.diagnosis} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Đơn thuốc</p>
                    <div className="bg-green-50/50 rounded-xl p-3">
                      <PrescriptionCard prescription={val.prescription} />
                    </div>
                  </div>
                </div>

                {/* History toggle */}
                <button
                  onClick={() => loadHistory(key)}
                  className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  <FiClock />
                  Lịch sử thay đổi
                  {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                </button>

                {isExpanded && history[key] && (
                  <div className="mt-3 border-l-2 border-primary-100 pl-4 space-y-3">
                    {history[key].map((h, j) => (
                      <div key={j} className="text-sm">
                        <p className="text-gray-400 text-xs">
                          TxId: <code>{h.TxId?.slice(0, 20)}…</code>
                          {h.Timestamp && <span className="ml-2">{new Date(h.Timestamp).toLocaleString('vi-VN')}</span>}
                        </p>
                        <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-blue-50/50 rounded-lg p-2">
                            <DiagnosisCard diagnosis={h.Value?.diagnosis} />
                          </div>
                          <div className="bg-green-50/50 rounded-lg p-2">
                            <PrescriptionCard prescription={h.Value?.prescription} />
                          </div>
                        </div>
                      </div>
                    ))}
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
