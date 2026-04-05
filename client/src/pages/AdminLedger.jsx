import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchLedger } from '../services/api'
import { toast } from 'react-toastify'
import { FiDatabase, FiDownload, FiSearch, FiRefreshCw, FiUser, FiFileText, FiShield, FiDollarSign, FiPackage, FiActivity, FiAlertCircle, FiGift, FiLayers } from 'react-icons/fi'

const TYPE_META = {
  patient:    { label: 'Bệnh nhân',    color: 'blue',   icon: FiUser },
  record:     { label: 'Bệnh án',      color: 'green',  icon: FiFileText },
  doctor:     { label: 'Bác sĩ',       color: 'purple', icon: FiActivity },
  hospital:   { label: 'Bệnh viện',    color: 'cyan',   icon: FiShield },
  claim:      { label: 'Bảo hiểm',     color: 'yellow', icon: FiDollarSign },
  dispense:   { label: 'Cấp thuốc',    color: 'teal',   icon: FiPackage },
  emergency:  { label: 'Khẩn cấp',    color: 'red',    icon: FiAlertCircle },
  reward:     { label: 'Phần thưởng', color: 'pink',   icon: FiGift },
  researcher: { label: 'Nghiên cứu',  color: 'indigo', icon: FiDatabase },
}

const COLOR_MAP = {
  blue:   { badge: 'bg-blue-100 text-blue-700',     card: 'bg-blue-50 border-blue-200',   icon: 'bg-blue-100 text-blue-600',   num: 'text-blue-600' },
  green:  { badge: 'bg-green-100 text-green-700',   card: 'bg-green-50 border-green-200', icon: 'bg-green-100 text-green-600', num: 'text-green-600' },
  purple: { badge: 'bg-purple-100 text-purple-700', card: 'bg-purple-50 border-purple-200', icon: 'bg-purple-100 text-purple-600', num: 'text-purple-600' },
  cyan:   { badge: 'bg-cyan-100 text-cyan-700',     card: 'bg-cyan-50 border-cyan-200',   icon: 'bg-cyan-100 text-cyan-600',   num: 'text-cyan-600' },
  yellow: { badge: 'bg-yellow-100 text-yellow-700', card: 'bg-yellow-50 border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', num: 'text-yellow-600' },
  teal:   { badge: 'bg-teal-100 text-teal-700',     card: 'bg-teal-50 border-teal-200',   icon: 'bg-teal-100 text-teal-600',   num: 'text-teal-600' },
  red:    { badge: 'bg-red-100 text-red-700',       card: 'bg-red-50 border-red-200',     icon: 'bg-red-100 text-red-600',     num: 'text-red-600' },
  pink:   { badge: 'bg-pink-100 text-pink-700',     card: 'bg-pink-50 border-pink-200',   icon: 'bg-pink-100 text-pink-600',   num: 'text-pink-600' },
  indigo: { badge: 'bg-indigo-100 text-indigo-700', card: 'bg-indigo-50 border-indigo-200', icon: 'bg-indigo-100 text-indigo-600', num: 'text-indigo-600' },
  gray:   { badge: 'bg-gray-100 text-gray-700',     card: 'bg-gray-50 border-gray-200',   icon: 'bg-gray-100 text-gray-600',   num: 'text-gray-600' },
}

function getDocType(item) {
  const val = item.Value || item
  if (val.docType) return val.docType
  if (val.patientId && val.authorizedDoctors !== undefined) return 'patient'
  if (val.recordId && val.diagnosis) return 'record'
  if (val.claimId) return 'claim'
  if (val.dispenseId) return 'dispense'
  if (val.rewardId) return 'reward'
  if (val.hospitalId && val.name && !val.patientId && !val.doctorId) return 'hospital'
  if (val.doctorId && val.hospitalId) return 'doctor'
  if (val.pharmacyId) return 'dispense'
  if (val.researcherId) return 'researcher'
  return 'data'
}

function getEntryId(item) {
  const val = item.Value || item
  if (item.Key) return item.Key
  return val.recordId || val.claimId || val.dispenseId || val.rewardId
    || val.patientId || val.doctorId || val.hospitalId || val.pharmacyId
    || val.researcherId || null
}

function EntryPreview({ val, docType }) {
  if (docType === 'patient') return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
      <span>ID: <strong className="text-gray-700">{val.patientId}</strong></span>
      {val.name && <span>Tên: <strong className="text-gray-700">{val.name}</strong></span>}
      {val.dob && <span>Ngày sinh: {val.dob}</span>}
      {val.authorizedDoctors?.length > 0 && <span>Bác sĩ được cấp: {val.authorizedDoctors.join(', ')}</span>}
    </div>
  )
  if (docType === 'record') return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
      <span>Bệnh nhân: <strong className="text-gray-700">{val.patientId}</strong></span>
      <span>Bác sĩ: <strong className="text-gray-700">{val.doctorId}</strong></span>
      {val.diagnosis?.primary?.icdCode && <span>ICD: <strong className="text-gray-700">{val.diagnosis.primary.icdCode}</strong> {val.diagnosis.primary.description}</span>}
      {val.timestamp && <span>{new Date(val.timestamp).toLocaleDateString('vi-VN')}</span>}
    </div>
  )
  if (docType === 'claim') return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
      <span>Bệnh nhân: <strong className="text-gray-700">{val.patientId}</strong></span>
      {val.amount && <span>Số tiền: <strong className="text-green-700">{val.amount?.toLocaleString()} VND</strong></span>}
      {val.status && <span>Trạng thái: <strong>{val.status}</strong></span>}
    </div>
  )
  if (docType === 'dispense') return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
      <span>Record: <strong className="text-gray-700">{val.recordId}</strong></span>
      {val.dispensedBy && <span>Cấp bởi: <strong className="text-gray-700">{val.dispensedBy}</strong></span>}
      {val.timestamp && <span>{new Date(val.timestamp).toLocaleDateString('vi-VN')}</span>}
    </div>
  )
  return (
    <div className="text-xs text-gray-400 mt-1 truncate">
      {Object.entries(val).slice(0, 3).map(([k, v]) => typeof v !== 'object' && `${k}: ${v}`).filter(Boolean).join(' · ')}
    </div>
  )
}

export default function AdminLedger() {
  const { user } = useAuth()
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [activeType, setActiveType] = useState('all')

  const loadLedger = async () => {
    setLoading(true)
    try {
      const res = await fetchLedger({ userId: user.userId, args: [] })
      let raw = res.data.data
      const data = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw
      const list = Array.isArray(data) ? data : [data]
      setLedger(list)
      toast.success(`Đã tải ${list.length} bản ghi`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi tải sổ cái')
    } finally {
      setLoading(false)
    }
  }

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ehr-ledger-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Count by type
  const typeCounts = ledger.reduce((acc, item) => {
    const t = getDocType(item)
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})

  const filteredLedger = ledger.filter(item => {
    const matchType = activeType === 'all' || getDocType(item) === activeType
    const matchFilter = !filter || JSON.stringify(item).toLowerCase().includes(filter.toLowerCase())
    return matchType && matchFilter
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sổ cái Blockchain</h1>
          <p className="text-gray-500 mt-1">Xem toàn bộ dữ liệu trên blockchain</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadLedger} disabled={loading} className="btn-primary flex items-center gap-2">
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            {ledger.length === 0 ? 'Tải sổ cái' : 'Làm mới'}
          </button>
          {ledger.length > 0 && (
            <button onClick={exportJSON} className="btn-secondary flex items-center gap-2">
              <FiDownload /> Xuất JSON
            </button>
          )}
        </div>
      </div>

      {ledger.length > 0 && (
        <>
          {/* Total + type blocks */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total card */}
            <button
              onClick={() => setActiveType('all')}
              className={`card text-center transition-all ${activeType === 'all' ? 'ring-2 ring-primary-400 shadow-md' : 'hover:shadow-md'}`}
            >
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <FiLayers className="text-primary-600" />
              </div>
              <p className="text-2xl font-bold text-primary-600">{ledger.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Tất cả</p>
            </button>

            {/* Per-type cards */}
            {Object.entries(typeCounts).map(([type, count]) => {
              const meta = TYPE_META[type] || { label: type, color: 'gray', icon: FiDatabase }
              const c = COLOR_MAP[meta.color] || COLOR_MAP.gray
              const Icon = meta.icon
              const isActive = activeType === type
              return (
                <button
                  key={type}
                  onClick={() => setActiveType(isActive ? 'all' : type)}
                  className={`card text-center transition-all ${isActive ? `ring-2 ring-offset-1 shadow-md` : 'hover:shadow-md'}`}
                >
                  <div className={`w-10 h-10 ${c.icon} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                    <Icon className="text-sm" />
                  </div>
                  <p className={`text-2xl font-bold ${c.num}`}>{count}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{meta.label}</p>
                </button>
              )
            })}
          </div>

          {/* Filter */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input-field pl-10"
              placeholder="Lọc theo từ khóa (Patient ID, Record ID, Doctor ID...)"
            />
          </div>

          <p className="text-sm text-gray-400">Hiển thị {filteredLedger.length} / {ledger.length} bản ghi</p>

          {/* Entries */}
          <div className="space-y-2">
            {filteredLedger.map((item, i) => {
              const val = item.Value || item
              const docType = getDocType(item)
              const key = getEntryId(item) || `entry-${i}`
              const meta = TYPE_META[docType] || { label: docType, color: 'gray', icon: FiDatabase }
              const c = COLOR_MAP[meta.color] || COLOR_MAP.gray
              const Icon = meta.icon

              return (
                <details key={i} className="card group p-0 overflow-hidden">
                  <summary className="flex items-center gap-3 p-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
                    <div className={`w-8 h-8 ${c.icon} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className="text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-sm text-gray-900 truncate block">{key}</span>
                      <EntryPreview val={val} docType={docType} />
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${c.badge}`}>
                      {meta.label}
                    </span>
                    <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap mt-3">
                      {JSON.stringify(val, null, 2)}
                    </pre>
                  </div>
                </details>
              )
            })}
          </div>
        </>
      )}

      {ledger.length === 0 && !loading && (
        <div className="card text-center py-16">
          <FiDatabase className="text-5xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Nhấn "Tải sổ cái" để xem dữ liệu blockchain</p>
        </div>
      )}
    </div>
  )
}
