import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  createClaim, getClaimsByPatient, getAllClaims,
  approveClaim, rejectClaim, getAllRecordsByPatientId, fetchInsuranceLedger, fetchOrg2Ledger, getAllAgents,
} from '../services/api'
import { toast } from 'react-toastify'
import {
  FiDollarSign, FiPlus, FiCheck, FiX, FiClock, FiFileText,
  FiChevronDown, FiCheckCircle, FiXCircle, FiUser, FiFilter, FiMapPin, FiBriefcase,
  FiTrendingUp, FiAlertCircle, FiDatabase, FiRefreshCw, FiSearch, FiLayers,
} from 'react-icons/fi'
import BlockchainView, { ViewModeToggle } from '../components/BlockchainView'

// ============================================================
// Constants
// ============================================================
const claimTypes = ['hospitalization', 'outpatient', 'medication', 'surgery', 'diagnostic', 'emergency', 'other']
const claimTypeLabels = {
  hospitalization: 'Nội trú', outpatient: 'Ngoại trú', medication: 'Thuốc',
  surgery: 'Phẫu thuật', diagnostic: 'Chẩn đoán', emergency: 'Cấp cứu', other: 'Khác',
}
const claimTypeColors = {
  hospitalization: 'bg-blue-50 text-blue-700',
  outpatient: 'bg-indigo-50 text-indigo-700',
  medication: 'bg-green-50 text-green-700',
  surgery: 'bg-red-50 text-red-700',
  diagnostic: 'bg-purple-50 text-purple-700',
  emergency: 'bg-orange-50 text-orange-700',
  other: 'bg-gray-100 text-gray-700',
}

// ============================================================
// Shared UI
// ============================================================
function StatusBadge({ status }) {
  const map = {
    pending:  { label: 'Chờ duyệt', icon: FiClock,        cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
    approved: { label: 'Đã duyệt',  icon: FiCheckCircle,  cls: 'bg-green-50 text-green-700 border border-green-200' },
    rejected: { label: 'Từ chối',   icon: FiXCircle,      cls: 'bg-red-50 text-red-700 border border-red-200' },
  }
  const s = map[status] || { label: status, icon: FiAlertCircle, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${s.cls}`}>
      <s.icon className="text-xs" /> {s.label}
    </span>
  )
}

function ClaimCard({ claim, canReview, reviewForm, setReviewForm, onReview, loading }) {
  const val = claim.Value || claim
  const claimId = val.claimId || claim.Key || '—'
  const date = val.timestamp ? new Date(val.timestamp).toLocaleDateString('vi-VN') : null
  const updatedDate = val.updatedAt && val.updatedAt !== val.timestamp
    ? new Date(val.updatedAt).toLocaleDateString('vi-VN') : null

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <FiDollarSign className="text-yellow-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm font-mono">{claimId}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${claimTypeColors[val.claimType] || 'bg-gray-100 text-gray-600'}`}>
                {claimTypeLabels[val.claimType] || val.claimType}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
              {(val.patientId || claim.patientName) && (
                <span className="flex items-center gap-1 text-primary-600 font-medium">
                  <FiUser className="text-xs" />
                  {claim.patientName ? `${val.patientId} (${claim.patientName})` : val.patientId}
                </span>
              )}
              {date && <span className="flex items-center gap-1"><FiClock className="text-xs" />{date}</span>}
            </div>
          </div>
        </div>
        <StatusBadge status={val.status} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-400">Số tiền yêu cầu</p>
          <p className="text-lg font-bold text-gray-900">
            {Number(val.amount).toLocaleString('vi-VN')}
            <span className="text-sm font-normal text-gray-500 ml-1">VNĐ</span>
          </p>
        </div>
        {val.recordId && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
            <FiFileText className="text-xs flex-shrink-0" />
            <span className="font-mono truncate max-w-[200px]">{val.recordId}</span>
          </div>
        )}
      </div>

      {val.description && (
        <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border-l-4 border-yellow-200">
          {val.description}
        </p>
      )}

      {val.status !== 'pending' && (val.reviewedBy || val.reviewNotes) && (
        <div className={`rounded-lg px-3 py-2 text-xs space-y-0.5 ${val.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {val.reviewedBy && <p>Người xét duyệt: <strong>{val.reviewedBy}</strong></p>}
          {updatedDate && <p>Ngày duyệt: {updatedDate}</p>}
          {val.reviewNotes && <p>Ghi chú: {val.reviewNotes}</p>}
        </div>
      )}

      {canReview && val.status === 'pending' && (
        <div className="pt-1 border-t border-gray-100">
          {reviewForm?.claimId === claimId ? (
            <div className="space-y-2">
              <input
                type="text"
                value={reviewForm.notes}
                onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                className="input-field text-sm"
                placeholder="Ghi chú xét duyệt (không bắt buộc)..."
              />
              <div className="flex gap-2">
                <button onClick={() => onReview('approve')} disabled={loading} className="btn-success flex items-center gap-1 text-sm">
                  <FiCheck /> Duyệt
                </button>
                <button onClick={() => onReview('reject')} disabled={loading} className="btn-danger flex items-center gap-1 text-sm">
                  <FiX /> Từ chối
                </button>
                <button onClick={() => setReviewForm(null)} className="btn-secondary text-sm">Hủy</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setReviewForm({ claimId, patientId: val.patientId, notes: '' })}
              className="btn-primary text-sm"
            >
              Xét duyệt
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Type helpers cho Org2 ledger
// ============================================================
const ORG2_TYPE = {
  insurance: { label: 'Công ty BH',   bg: 'bg-yellow-100', text: 'text-yellow-700', icon: FiDollarSign },
  agent:     { label: 'Chi nhánh BH', bg: 'bg-orange-100', text: 'text-orange-700', icon: FiBriefcase },
  claim:     { label: 'Yêu cầu BH',  bg: 'bg-blue-100',   text: 'text-blue-700',   icon: FiFileText },
}

function getOrg2Type(item) {
  const val = item.Value || item
  if (val.claimId) return 'claim'
  if (val.agentId) return 'agent'
  if (val.companyId && !val.agentId) return 'insurance'
  return 'other'
}

function Org2EntryRow({ item, i }) {
  const val = item.Value || item
  const type = getOrg2Type(item)
  const meta = ORG2_TYPE[type] || { label: 'Khác', bg: 'bg-gray-100', text: 'text-gray-600', icon: FiDatabase }
  const Icon = meta.icon
  const entryId = val.claimId || val.agentId || val.companyId || item.Key || `entry-${i}`
  const date = val.timestamp ? new Date(val.timestamp).toLocaleDateString('vi-VN') : null

  return (
    <details className="card group p-0 overflow-hidden">
      <summary className="flex items-center gap-3 p-4 cursor-pointer list-none hover:bg-gray-50/50">
        <div className={`w-8 h-8 ${meta.bg} ${meta.text} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className="text-sm" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-gray-900 truncate">{entryId}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.bg} ${meta.text}`}>{meta.label}</span>
            {type === 'claim' && val.status && <StatusBadge status={val.status} />}
          </div>
          <div className="flex gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
            {val.name && <span>{val.name}</span>}
            {val.patientId && <span><FiUser className="inline text-xs" /> {val.patientId}</span>}
            {val.amount && <span>{Number(val.amount).toLocaleString('vi-VN')} VNĐ</span>}
            {date && <span>{date}</span>}
          </div>
        </div>
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
}

// ============================================================
// Org2 Ledger tab
// ============================================================
const ORG2_TYPE_META = {
  insurance: { label: 'Công ty BH',   color: 'yellow', icon: FiDollarSign },
  agent:     { label: 'Chi nhánh BH', color: 'orange', icon: FiBriefcase },
  claim:     { label: 'Yêu cầu BH',  color: 'blue',   icon: FiFileText },
}
const ORG2_COLOR_MAP = {
  yellow: { badge: 'bg-yellow-100 text-yellow-700', icon: 'bg-yellow-100 text-yellow-600' },
  orange: { badge: 'bg-orange-100 text-orange-700', icon: 'bg-orange-100 text-orange-600' },
  blue:   { badge: 'bg-blue-100 text-blue-700',     icon: 'bg-blue-100 text-blue-600' },
  gray:   { badge: 'bg-gray-100 text-gray-700',     icon: 'bg-gray-100 text-gray-600' },
}

function BlockchainTab({ userId }) {
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [activeType, setActiveType] = useState('all')
  const [viewMode, setViewMode] = useState('list')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetchOrg2Ledger({ userId })
      const raw = res.data?.data
      const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
      setLedger(data)
      toast.success(`Đã tải ${data.length} bản ghi Org2`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi tải blockchain')
    } finally {
      setLoading(false)
    }
  }

  const typeCounts = ledger.reduce((acc, item) => {
    const t = getOrg2Type(item)
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})

  const filtered = ledger.filter(item => {
    const matchType = activeType === 'all' || getOrg2Type(item) === activeType
    const matchFilter = !filter || JSON.stringify(item).toLowerCase().includes(filter.toLowerCase())
    return matchType && matchFilter
  })

  const pendingClaims  = ledger.filter(i => getOrg2Type(i) === 'claim' && (i.Value || i).status === 'pending').length
  const approvedClaims = ledger.filter(i => getOrg2Type(i) === 'claim' && (i.Value || i).status === 'approved').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Toàn bộ dữ liệu Org2 trên Hyperledger Fabric</p>
        <div className="flex gap-2">
          {ledger.length > 0 && (
            <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
          )}
          <button onClick={load} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            {ledger.length === 0 ? 'Tải blockchain' : 'Làm mới'}
          </button>
        </div>
      </div>

      {ledger.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Tổng bản ghi',  value: ledger.length,               cls: 'text-primary-600', bg: 'bg-primary-50',  icon: FiLayers },
              { label: 'Chi nhánh',     value: typeCounts.agent || 0,        cls: 'text-orange-600',  bg: 'bg-orange-50',   icon: FiBriefcase },
              { label: 'Claim chờ',     value: pendingClaims,                cls: 'text-yellow-600',  bg: 'bg-yellow-50',   icon: FiClock },
              { label: 'Claim duyệt',   value: approvedClaims,               cls: 'text-green-600',   bg: 'bg-green-50',    icon: FiCheckCircle },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 ${s.bg}`}>
                <s.icon className={`text-lg mb-1 ${s.cls}`} />
                <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Type filter */}
          <div className="flex gap-2 flex-wrap">
            {[{ id: 'all', label: 'Tất cả' }, ...Object.entries(ORG2_TYPE).map(([id, m]) => ({ id, label: m.label }))].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveType(t.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                  activeType === t.id
                    ? 'bg-primary-100 border-primary-300 text-primary-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {t.label} {t.id !== 'all' && typeCounts[t.id] ? `(${typeCounts[t.id]})` : ''}
              </button>
            ))}
          </div>

          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input-field pl-10"
              placeholder="Tìm theo tên, ID, trạng thái..."
            />
          </div>

          {viewMode === 'blocks' ? (
            <BlockchainView ledger={filtered} getDocType={getOrg2Type} typeMeta={ORG2_TYPE_META} colorMap={ORG2_COLOR_MAP} />
          ) : (
            <>
              <p className="text-xs text-gray-400">Hiển thị {filtered.length} / {ledger.length} bản ghi</p>
              <div className="space-y-2">
                {filtered.map((item, i) => <Org2EntryRow key={i} item={item} i={i} />)}
              </div>
            </>
          )}
        </>
      )}

      {ledger.length === 0 && !loading && (
        <div className="card text-center py-12">
          <FiDatabase className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Nhấn "Tải blockchain" để xem sổ cái Org2</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// VIEW: Công ty bảo hiểm (insuranceAdmin)
// ============================================================
function InsuranceAdminView({ user, tab: urlTab }) {
  const tab = urlTab === 'blockchain' ? 'blockchain' : 'agents'
  const [agents, setAgents] = useState([])
  const [loadingAgents, setLoadingAgents] = useState(false)

  useEffect(() => { loadAgents() }, [])

  const loadAgents = async () => {
    setLoadingAgents(true)
    try {
      const res = await getAllAgents({ userId: user.userId })
      const raw = res.data?.data
      const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
      setAgents(data)
    } catch {
      toast.error('Lỗi tải danh sách chi nhánh')
    } finally {
      setLoadingAgents(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {tab === 'agents' ? 'Chi nhánh bảo hiểm' : 'Sổ cái Blockchain'}
        </h1>
        <p className="text-gray-500 mt-1">{user.name || user.userId} — {tab === 'agents' ? 'Quản lý chi nhánh thuộc công ty' : 'Toàn bộ dữ liệu Org2 trên Hyperledger Fabric'}</p>
      </div>

      {tab === 'agents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Danh sách chi nhánh thuộc công ty</p>
            <button onClick={loadAgents} disabled={loadingAgents} className="btn-secondary flex items-center gap-2 text-sm">
              <FiRefreshCw className={loadingAgents ? 'animate-spin' : ''} /> Tải lại
            </button>
          </div>

          {loadingAgents ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <div className="card text-center py-12">
              <FiBriefcase className="text-4xl text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">Chưa có chi nhánh nào được đăng ký</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent, i) => (
                <div key={i} className="card space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FiBriefcase className="text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{agent.name || agent.agentId}</p>
                      <p className="text-xs text-gray-400 font-mono">{agent.agentId}</p>
                    </div>
                  </div>
                  {agent.city && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <FiMapPin className="text-xs flex-shrink-0" />{agent.city}
                    </div>
                  )}
                  {agent.timestamp && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <FiClock className="text-xs" />
                      Tham gia: {new Date(agent.timestamp).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'blockchain' && <BlockchainTab userId={user.userId} />}
    </div>
  )
}

// ============================================================
// VIEW: Chi nhánh bảo hiểm (agent)
// ============================================================
function AgentView({ user, tab: urlTab }) {
  const tab = ['pending', 'reviewed', 'search'].includes(urlTab) ? urlTab : 'pending'
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewForm, setReviewForm] = useState(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [searchPatient, setSearchPatient] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const res = await getAllClaims({ userId: user.userId })
      const raw = res.data?.data
      const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
      setClaims(data)
    } catch {
      toast.error('Lỗi tải danh sách yêu cầu')
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (action) => {
    if (!reviewForm) return
    setReviewLoading(true)
    try {
      const fn = action === 'approve' ? approveClaim : rejectClaim
      const res = await fn({ userId: user.userId, patientId: reviewForm.patientId, claimId: reviewForm.claimId, reviewNotes: reviewForm.notes })
      if (res.data.success || res.data.data) {
        toast.success(action === 'approve' ? 'Đã duyệt!' : 'Đã từ chối!')
        setReviewForm(null)
        loadAll()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi')
    } finally {
      setReviewLoading(false)
    }
  }

  const handleSearchPatient = async () => {
    if (!searchPatient.trim()) return
    setSearching(true)
    try {
      const res = await getClaimsByPatient({ userId: user.userId, patientId: searchPatient.trim() })
      const raw = res.data.data
      const data = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || [])
      setSearchResults(data)
      if (data.length === 0) toast.info('Không tìm thấy yêu cầu nào')
    } catch {
      toast.error('Lỗi tìm kiếm')
    } finally {
      setSearching(false)
    }
  }

  const pending  = claims.filter(c => (c.Value || c).status === 'pending')
  const reviewed = claims.filter(c => (c.Value || c).reviewedBy === user.userId)

  const mainTabs = [
    { id: 'pending',  label: 'Chờ xử lý', count: pending.length  },
    { id: 'reviewed', label: 'Đã xử lý',  count: reviewed.length },
    { id: 'search',   label: 'Tra cứu',   count: null },
  ]

  const displayList = tab === 'pending' ? pending : tab === 'reviewed' ? reviewed : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {tab === 'pending' ? 'Yêu cầu chờ xử lý' : tab === 'reviewed' ? 'Yêu cầu đã xử lý' : 'Tra cứu yêu cầu'}
          </h1>
          <p className="text-gray-500 mt-1">{user.name || user.userId} — Xử lý yêu cầu bồi thường</p>
        </div>
        <button onClick={loadAll} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
          {loading ? <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" /> : <FiRefreshCw />}
          Tải lại
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card py-4">
          <p className="text-2xl font-bold text-yellow-600">{pending.length}</p>
          <p className="text-sm text-gray-500 mt-0.5">Chờ xử lý</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-blue-600">{reviewed.length}</p>
          <p className="text-sm text-gray-500 mt-0.5">Tôi đã xử lý</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-gray-600">{claims.length}</p>
          <p className="text-sm text-gray-500 mt-0.5">Tổng claims</p>
        </div>
      </div>

      {/* Tab content */}
      {(tab === 'pending' || tab === 'reviewed') && (
        loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : displayList.length === 0 ? (
          <div className="card text-center py-12">
            <FiDollarSign className="text-4xl text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">{tab === 'pending' ? 'Không có yêu cầu chờ xử lý' : 'Chưa xử lý yêu cầu nào'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayList.map((claim, i) => (
              <ClaimCard
                key={i}
                claim={claim}
                canReview={tab === 'pending'}
                reviewForm={reviewForm}
                setReviewForm={setReviewForm}
                onReview={handleReview}
                loading={reviewLoading}
              />
            ))}
          </div>
        )
      )}

      {tab === 'search' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchPatient}
              onChange={(e) => setSearchPatient(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchPatient()}
              className="input-field flex-1"
              placeholder="Nhập Patient ID để tra cứu..."
            />
            <button onClick={handleSearchPatient} disabled={searching} className="btn-primary flex items-center gap-2">
              {searching ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiSearch />}
              Tìm
            </button>
          </div>
          {searchResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">{searchResults.length} yêu cầu của bệnh nhân <strong>{searchPatient}</strong></p>
              {searchResults.map((claim, i) => (
                <ClaimCard key={i} claim={claim} canReview={false} reviewForm={null} setReviewForm={() => {}} onReview={() => {}} loading={false} />
              ))}
            </div>
          ) : (
            <div className="card text-center py-10">
              <FiSearch className="text-3xl text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Nhập Patient ID và nhấn Tìm</p>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ============================================================
// VIEW: Patient / Doctor
// ============================================================
function PatientView({ user }) {
  const isPatient = user.role === 'patient'
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [searchId] = useState(isPatient ? user.userId : '')
  const [form, setForm] = useState({
    patientId: isPatient ? user.userId : '',
    recordId: '', claimType: 'outpatient', amount: '', description: '',
  })
  const [records, setRecords] = useState([])
  const [loadingRecords, setLoadingRecords] = useState(false)

  useEffect(() => { if (isPatient) loadClaims() }, [])

  useEffect(() => {
    if (!form.patientId.trim()) { setRecords([]); return }
    setLoadingRecords(true)
    getAllRecordsByPatientId({ userId: user.userId, patientId: form.patientId })
      .then(res => {
        const raw = res.data?.data
        setRecords(typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []))
      })
      .catch(() => setRecords([]))
      .finally(() => setLoadingRecords(false))
  }, [form.patientId])

  const loadClaims = async () => {
    if (!searchId.trim()) return
    setLoading(true)
    try {
      const res = await getClaimsByPatient({ userId: user.userId, patientId: searchId })
      const raw = res.data.data
      setClaims(typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []))
    } catch { toast.error('Lỗi tải yêu cầu bảo hiểm') }
    finally { setLoading(false) }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await createClaim({ userId: user.userId, ...form })
      if (res.data.success || res.data.data) {
        toast.success('Tạo yêu cầu bảo hiểm thành công!')
        setShowCreate(false)
        setForm({ patientId: isPatient ? user.userId : '', recordId: '', claimType: 'outpatient', amount: '', description: '' })
        loadClaims()
      } else { toast.error(res.data.error || 'Thất bại') }
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi kết nối') }
    finally { setLoading(false) }
  }

  const pending  = claims.filter(c => (c.Value || c).status === 'pending').length
  const approved = claims.filter(c => (c.Value || c).status === 'approved').length
  const rejected = claims.filter(c => (c.Value || c).status === 'rejected').length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bảo hiểm y tế</h1>
          <p className="text-gray-500 mt-1">Quản lý yêu cầu bồi thường bảo hiểm</p>
        </div>
        {(isPatient || user.role === 'doctor') && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
            <FiPlus /> Tạo yêu cầu
          </button>
        )}
      </div>

      {claims.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Chờ duyệt', value: pending,  cls: 'bg-yellow-50 border-yellow-200', valCls: 'text-yellow-700' },
            { label: 'Đã duyệt',  value: approved, cls: 'bg-green-50 border-green-200',   valCls: 'text-green-700' },
            { label: 'Từ chối',   value: rejected, cls: 'bg-red-50 border-red-200',       valCls: 'text-red-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
              <p className={`text-2xl font-bold ${s.valCls}`}>{s.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="card max-w-xl">
          <h2 className="text-lg font-semibold mb-4">Tạo yêu cầu bảo hiểm</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {!isPatient && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID *</label>
                <input type="text" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value, recordId: '' })} className="input-field" required />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hồ sơ bệnh án *</label>
              <div className="relative">
                <select value={form.recordId} onChange={(e) => setForm({ ...form, recordId: e.target.value })} className="input-field appearance-none pr-8" required disabled={!form.patientId || loadingRecords}>
                  <option value="">{loadingRecords ? 'Đang tải...' : !form.patientId ? '-- Nhập Patient ID trước --' : records.length === 0 ? '-- Không có hồ sơ --' : '-- Chọn hồ sơ --'}</option>
                  {records.map((r) => {
                    const diag = (() => { try { return typeof r.diagnosis === 'string' ? JSON.parse(r.diagnosis) : r.diagnosis } catch { return null } })()
                    const date = r.timestamp ? new Date(r.timestamp).toLocaleDateString('vi-VN') : ''
                    const icd = diag?.primary?.icdCode || ''
                    const desc = diag?.primary?.description || ''
                    return <option key={r.recordId} value={r.recordId}>{date} — {icd}{desc ? ` · ${desc}` : ''}</option>
                  })}
                </select>
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                  {loadingRecords ? <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" /> : <FiChevronDown />}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại yêu cầu</label>
                <select value={form.claimType} onChange={(e) => setForm({ ...form, claimType: e.target.value })} className="input-field">
                  {claimTypes.map((t) => <option key={t} value={t}>{claimTypeLabels[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền (VNĐ) *</label>
                <input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field" placeholder="VD: 1500000" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả *</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field h-20" placeholder="Mô tả lý do yêu cầu bồi thường..." required />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Gửi yêu cầu
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Hủy</button>
            </div>
          </form>
        </div>
      )}

      {loading && claims.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : claims.length === 0 ? (
        <div className="card text-center py-12">
          <FiDollarSign className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Chưa có yêu cầu bảo hiểm nào</p>
          {isPatient && (
            <button onClick={() => setShowCreate(true)} className="mt-4 btn-primary inline-flex items-center gap-2">
              <FiPlus /> Tạo yêu cầu đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim, i) => (
            <ClaimCard key={i} claim={claim} canReview={false} reviewForm={null} setReviewForm={() => {}} onReview={() => {}} loading={false} />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Root — chọn view theo role
// ============================================================
export default function InsuranceClaims() {
  const { user } = useAuth()
  const { tab } = useParams()
  if (user.role === 'insuranceAdmin' || user.role === 'insurance') return <InsuranceAdminView user={user} tab={tab} />
  if (user.role === 'agent')          return <AgentView user={user} tab={tab} />
  return <PatientView user={user} />
}
