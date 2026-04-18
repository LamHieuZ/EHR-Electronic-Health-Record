import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAllRecordsByPatientId, queryHistoryOfAsset, shareRecord, unshareRecord, shareAllRecords, unshareAllRecords } from '../services/api'
import { toast } from 'react-toastify'
import { FiFileText, FiSearch, FiClock, FiChevronDown, FiChevronUp, FiUser, FiActivity, FiPackage, FiShare2, FiLock, FiEyeOff } from 'react-icons/fi'

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
  const [sharingId, setSharingId] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)

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

  const refreshRecord = async () => {
    const targetId = user.role === 'patient' ? user.userId : searchPatientId.trim()
    if (targetId) await loadRecords(targetId)
  }

  const handleBulkShare = async (isShareAll) => {
    const targetPatientId = user.role === 'patient' ? user.userId : searchPatientId.trim()
    if (!targetPatientId) { toast.error('Thiếu patientId'); return }
    const action = isShareAll ? 'chia sẻ toàn bộ hồ sơ' : 'thu hồi chia sẻ toàn bộ'
    if (!window.confirm(`Xác nhận ${action} của ${targetPatientId} với các bệnh viện khác?`)) return
    setBulkLoading(true)
    try {
      const fn = isShareAll ? shareAllRecords : unshareAllRecords
      const res = await fn({ userId: user.userId, patientId: targetPatientId })
      // Parse response — chaincode trả JSON string với sharedCount / skippedCount
      let payload = res.data.data
      try { payload = typeof payload === 'string' ? JSON.parse(payload) : payload } catch {}
      const done = payload?.sharedCount ?? payload?.unsharedCount ?? 0
      const skip = payload?.skippedCount ?? 0
      toast.success(`${isShareAll ? 'Đã chia sẻ' : 'Đã thu hồi'} ${done} hồ sơ${skip > 0 ? `, bỏ qua ${skip}` : ''}`)
      if (skip > 0 && payload?.skipped?.length) {
        console.log('Skipped records:', payload.skipped)
      }
      await refreshRecord()
    } catch (err) {
      toast.error(`Không thể ${action}: ${err.response?.data?.message || err.message}`)
    } finally {
      setBulkLoading(false)
    }
  }

  const handleShare = async (patientId, recordId, isShared) => {
    const action = isShared ? 'thu hồi chia sẻ' : 'chia sẻ'
    if (!window.confirm(`Xác nhận ${action} hồ sơ ${recordId} với các bệnh viện khác?`)) return
    setSharingId(recordId)
    try {
      if (isShared) {
        await unshareRecord({ userId: user.userId, patientId, recordId })
        toast.success('Đã thu hồi chia sẻ')
      } else {
        await shareRecord({ userId: user.userId, patientId, recordId })
        toast.success('Đã chia sẻ hồ sơ với các bệnh viện khác')
      }
      await refreshRecord()
      // Reload history nếu đang mở
      if (expandedId) {
        setHistory((prev) => ({ ...prev, [expandedId]: undefined }))
      }
    } catch (err) {
      toast.error(`Không thể ${action}: ${err.response?.data?.message || err.message}`)
    } finally {
      setSharingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Hồ sơ bệnh án</h1>
        <p className="text-gray-500 mt-0.5">Xem và theo dõi lịch sử khám bệnh</p>
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

      {/* Bulk share bar - chi hien cho patient chinh chu hoac hospital admin */}
      {records.length > 0 && (
        (user.role === 'patient') ||
        (user.role === 'hospital')
      ) && (() => {
        const targetPid = user.role === 'patient' ? user.userId : searchPatientId.trim()
        // Dem so records da share / tong so records ma caller co the thao tac
        const manageable = records.filter(r => {
          const v = r.Value || r
          if (user.role === 'patient') return (v.patientId || targetPid) === targetPid
          if (user.role === 'hospital') return v.hospitalId === user.userId
          return false
        })
        const sharedCount = manageable.filter(r => {
          const v = r.Value || r
          return Array.isArray(v.sharedCollections) && v.sharedCollections.includes('sharedClinicalCollection')
        }).length
        if (manageable.length === 0) return null

        return (
          <div className="card bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-start gap-3">
                <FiShare2 className="text-blue-600 text-xl mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Chia sẻ toàn bộ lịch sử khám bệnh</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Đã chia sẻ <b>{sharedCount}</b> / {manageable.length} hồ sơ với các bệnh viện khác qua <code className="text-xs">sharedClinicalCollection</code>.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkShare(true)}
                  disabled={bulkLoading || sharedCount === manageable.length}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <FiShare2 /> Chia sẻ tất cả
                </button>
                <button
                  onClick={() => handleBulkShare(false)}
                  disabled={bulkLoading || sharedCount === 0}
                  className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium hover:bg-red-100 flex items-center gap-2 disabled:opacity-50"
                >
                  <FiLock /> Thu hồi tất cả
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="card text-center py-8">
          <FiFileText className="text-2xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Chưa có hồ sơ bệnh án nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record, i) => {
            const val = record.Value || record
            const key = record.Key || val.recordId || `record-${i}`
            const isExpanded = expandedId === key
            const patientId = val.patientId || (user.role === 'patient' ? user.userId : searchPatientId.trim())
            const recordId = val.recordId || key

            const isShared = Array.isArray(val.sharedCollections) && val.sharedCollections.includes('sharedClinicalCollection')
            const canSeePrivate = val.privateDataVisible !== false && (val.diagnosis || val.prescription)
            const viaShared = val.privateSource === 'sharedClinicalCollection'

            // Quyen share: chinh benh nhan, hoac hospital admin cua BV so huu
            const canShare =
              (user.role === 'patient' && user.userId === patientId) ||
              (user.role === 'hospital' && user.userId === val.hospitalId)

            return (
              <div key={i} className="card">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FiFileText className="text-primary-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{recordId}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1"><FiUser className="text-xs" /> {val.doctorId || 'N/A'}</span>
                        {val.hospitalId && <span className="text-gray-400">BV: {val.hospitalId}</span>}
                        {val.version && <span className="flex items-center gap-1"><FiActivity className="text-xs" /> v{val.version}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Badge trang thai chia se */}
                    {isShared ? (
                      <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded flex items-center gap-1">
                        <FiShare2 className="text-xs" /> Đã chia sẻ
                      </span>
                    ) : canSeePrivate ? (
                      <span className="text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded flex items-center gap-1">
                        <FiLock className="text-xs" /> Riêng BV
                      </span>
                    ) : null}
                    {viaShared && (
                      <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        qua shared
                      </span>
                    )}
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                      {val.timestamp ? new Date(val.timestamp).toLocaleDateString('vi-VN') : ''}
                    </span>
                  </div>
                </div>

                {/* Body */}
                {canSeePrivate ? (
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
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-3">
                    <FiEyeOff className="text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800">Dữ liệu y tế đang được bảo vệ</p>
                      <p className="text-yellow-700 mt-1 text-xs">
                        Hồ sơ này thuộc sở hữu của <code className="font-mono">{val.hospitalId}</code>.
                        Bệnh viện của bạn chưa được chia sẻ dữ liệu chẩn đoán/đơn thuốc.
                        Hash xác thực:&nbsp;
                        <code className="font-mono text-xs">{(val.privateHash || '').slice(0, 16)}…</code>
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
                  <button
                    onClick={() => loadHistory(key)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  >
                    <FiClock />
                    Lịch sử thay đổi
                    {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                  </button>

                  {canShare && (
                    <button
                      onClick={() => handleShare(patientId, recordId, isShared)}
                      disabled={sharingId === recordId}
                      className={`text-sm font-medium px-3 py-1.5 rounded-lg flex items-center gap-2 disabled:opacity-50 ${
                        isShared
                          ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      }`}
                    >
                      {isShared ? <><FiLock /> Thu hồi chia sẻ</> : <><FiShare2 /> Chia sẻ với BV khác</>}
                    </button>
                  )}
                </div>

                {isExpanded && history[key] && (
                  <div className="mt-3 border-l-2 border-primary-100 pl-4 space-y-3">
                    {history[key].map((h, j) => {
                      const hVal = h.Value || h.asset
                      const shareEvent = hVal?.sharedAt || hVal?.unsharedAt
                      const isShareTx = hVal?.sharedCollections !== undefined
                      return (
                        <div key={j} className="text-sm">
                          <p className="text-gray-400 text-xs">
                            TxId: <code>{(h.TxId || h.txId)?.slice(0, 20)}…</code>
                            {(h.Timestamp || h.timestamp) && <span className="ml-2">{new Date(h.Timestamp || h.timestamp).toLocaleString('vi-VN')}</span>}
                            {isShareTx && hVal?.sharedCollections?.includes('sharedClinicalCollection') && (
                              <span className="ml-2 text-green-600 font-medium">• Đã chia sẻ bởi {hVal.sharedBy}</span>
                            )}
                            {isShareTx && hVal?.unsharedAt && (!hVal?.sharedCollections || hVal.sharedCollections.length === 0) && (
                              <span className="ml-2 text-red-600 font-medium">• Đã thu hồi bởi {hVal.unsharedBy}</span>
                            )}
                          </p>
                          {hVal?.privateHash && (
                            <p className="text-xs text-gray-400 mt-1">
                              Hash: <code className="font-mono">{hVal.privateHash.slice(0, 24)}…</code>
                              {hVal.version && <span className="ml-2">v{hVal.version}</span>}
                            </p>
                          )}
                        </div>
                      )
                    })}
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
