import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { requestConsent, approveConsent, getAnonymizedData, getPatientById } from '../services/api'
import { toast } from 'react-toastify'
import {
  FiUsers, FiSend, FiCheck, FiX, FiDatabase, FiClock,
  FiCheckCircle, FiXCircle, FiRefreshCw, FiSearch, FiAlertCircle,
} from 'react-icons/fi'

function StatusBadge({ status }) {
  const map = {
    pending:  { label: 'Chờ duyệt', icon: FiClock,        cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
    approved: { label: 'Đã đồng ý', icon: FiCheckCircle,  cls: 'bg-green-50 text-green-700 border border-green-200' },
    rejected: { label: 'Từ chối',   icon: FiXCircle,      cls: 'bg-red-50 text-red-700 border border-red-200' },
  }
  const s = map[status] || { label: status, icon: FiAlertCircle, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${s.cls}`}>
      <s.icon className="text-xs" /> {s.label}
    </span>
  )
}

// ============================================================
// Patient view — danh sách yêu cầu đồng ý
// ============================================================
function PatientView({ user }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => { loadRequests() }, [])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const res = await getPatientById({ userId: user.userId, patientId: user.userId })
      const raw = res.data?.data
      const patient = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {})
      setRequests(patient.consentRequests || [])
    } catch {
      toast.error('Lỗi tải danh sách yêu cầu')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (requestId, approved) => {
    setActionLoading(requestId)
    try {
      const res = await approveConsent({ userId: user.userId, patientId: user.userId, requestId, approved })
      if (res.data.success || res.data.data) {
        toast.success(approved ? 'Đã đồng ý!' : 'Đã từ chối!')
        loadRequests()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi')
    } finally {
      setActionLoading(null)
    }
  }

  const pending  = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status !== 'pending')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Đồng ý nghiên cứu</h1>
          <p className="text-gray-500 mt-1">Quản lý quyền chia sẻ dữ liệu cho nghiên cứu</p>
        </div>
        <button onClick={loadRequests} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Chờ duyệt', value: pending.length,   cls: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Đã đồng ý', value: requests.filter(r => r.status === 'approved').length, cls: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Từ chối',   value: requests.filter(r => r.status === 'rejected').length, cls: 'text-red-600',   bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`card py-4 text-center ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="card text-center py-12">
          <FiUsers className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Chưa có yêu cầu đồng ý nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <>
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <FiClock className="text-yellow-500" /> Chờ xử lý ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((req, i) => (
                  <div key={i} className="card border-l-4 border-yellow-400 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">Nhà nghiên cứu: <span className="font-mono text-primary-600">{req.researcherId}</span></p>
                        {req.purpose && <p className="text-sm text-gray-500 mt-1">{req.purpose}</p>}
                        {req.timestamp && (
                          <p className="text-xs text-gray-400 mt-1">
                            <FiClock className="inline text-xs mr-1" />
                            {new Date(req.timestamp).toLocaleString('vi-VN')}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-800">
                      Khi đồng ý, dữ liệu của bạn sẽ được <strong>ẩn danh hóa</strong> trước khi chia sẻ.
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(req.requestId, true)}
                        disabled={actionLoading === req.requestId}
                        className="btn-success flex items-center gap-1.5 text-sm flex-1"
                      >
                        {actionLoading === req.requestId
                          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <FiCheck />}
                        Đồng ý
                      </button>
                      <button
                        onClick={() => handleAction(req.requestId, false)}
                        disabled={actionLoading === req.requestId}
                        className="btn-danger flex items-center gap-1.5 text-sm flex-1"
                      >
                        <FiX /> Từ chối
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {resolved.length > 0 && (
            <>
              <h2 className="font-semibold text-gray-800 mt-2">Đã xử lý ({resolved.length})</h2>
              <div className="space-y-2">
                {resolved.map((req, i) => (
                  <div key={i} className="card flex items-center gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        Nhà nghiên cứu: <span className="font-mono">{req.researcherId}</span>
                      </p>
                      {req.purpose && <p className="text-xs text-gray-400 truncate">{req.purpose}</p>}
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Researcher view
// ============================================================
function ResearcherView({ user }) {
  const [tab, setTab] = useState('request')
  const [loading, setLoading] = useState(false)
  const [reqForm, setReqForm] = useState({ patientId: '', purpose: '' })
  const [anonPatientId, setAnonPatientId] = useState('')
  const [anonData, setAnonData] = useState(null)

  const handleRequestConsent = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await requestConsent({
        userId: user.userId,
        researcherId: user.userId,
        patientId: reqForm.patientId,
        purpose: reqForm.purpose,
      })
      if (res.data.success || res.data.data) {
        const data = typeof res.data.data === 'string' ? JSON.parse(res.data.data) : res.data.data
        toast.success(`Đã gửi yêu cầu! Request ID: ${data?.requestId || ''}`)
        setReqForm({ patientId: '', purpose: '' })
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi gửi yêu cầu')
    } finally {
      setLoading(false)
    }
  }

  const handleGetAnonymized = async () => {
    if (!anonPatientId.trim()) return
    setLoading(true)
    setAnonData(null)
    try {
      const res = await getAnonymizedData({
        userId: user.userId,
        researcherId: user.userId,
        patientId: anonPatientId,
      })
      const raw = res.data?.data
      setAnonData(typeof raw === 'string' ? JSON.parse(raw || 'null') : (raw || null))
      toast.success('Tải dữ liệu ẩn danh thành công')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không có quyền hoặc chưa được đồng ý')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nghiên cứu y tế</h1>
        <p className="text-gray-500 mt-1">{user.userId} — Yêu cầu đồng ý và truy cập dữ liệu ẩn danh</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('request')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'request' ? 'border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <FiSend className="text-xs" /> Gửi yêu cầu đồng ý
        </button>
        <button
          onClick={() => setTab('data')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'data' ? 'border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <FiDatabase className="text-xs" /> Dữ liệu ẩn danh
        </button>
      </div>

      {tab === 'request' && (
        <div className="card max-w-xl space-y-4">
          <p className="text-sm text-gray-500">Gửi yêu cầu xin phép truy cập dữ liệu bệnh nhân (ẩn danh hóa)</p>
          <form onSubmit={handleRequestConsent} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID *</label>
              <input
                type="text"
                value={reqForm.patientId}
                onChange={(e) => setReqForm({ ...reqForm, patientId: e.target.value })}
                className="input-field"
                placeholder="VD: patient01"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mục đích nghiên cứu *</label>
              <textarea
                value={reqForm.purpose}
                onChange={(e) => setReqForm({ ...reqForm, purpose: e.target.value })}
                className="input-field h-28 resize-none"
                placeholder="Mô tả rõ mục đích và cách sử dụng dữ liệu..."
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <FiSend />}
              Gửi yêu cầu
            </button>
          </form>
        </div>
      )}

      {tab === 'data' && (
        <div className="space-y-4">
          <div className="card max-w-xl space-y-3">
            <p className="text-sm text-gray-500">Chỉ truy cập được khi bệnh nhân đã đồng ý</p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={anonPatientId}
                  onChange={(e) => setAnonPatientId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGetAnonymized()}
                  className="input-field pl-10"
                  placeholder="Nhập Patient ID"
                />
              </div>
              <button onClick={handleGetAnonymized} disabled={loading || !anonPatientId.trim()} className="btn-primary flex items-center gap-2">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <FiDatabase />}
                Lấy dữ liệu
              </button>
            </div>
          </div>

          {anonData && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <FiCheckCircle className="text-green-500" />
                <h3 className="font-semibold text-gray-900">Dữ liệu ẩn danh — {anonPatientId}</h3>
              </div>
              <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap border border-gray-100">
                {JSON.stringify(anonData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Root
// ============================================================
export default function ResearchConsent() {
  const { user } = useAuth()
  if (user.role === 'researcher') return <ResearcherView user={user} />
  return <PatientView user={user} />
}
