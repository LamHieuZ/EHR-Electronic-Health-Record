import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchLedger, getAllHospitals, getAllDoctors, getAllPharmacies, onboardHospital, onboardDoctor, onboardPharmacy } from '../services/api'
import { toast } from 'react-toastify'
import {
  FiDatabase, FiDownload, FiSearch, FiRefreshCw, FiUser, FiFileText,
  FiShield, FiDollarSign, FiPackage, FiActivity, FiAlertCircle,
  FiLayers, FiMapPin, FiChevronDown, FiChevronRight, FiUsers, FiPlus, FiCheck, FiBriefcase,
} from 'react-icons/fi'
import BlockchainView, { ViewModeToggle } from '../components/BlockchainView'

// ============================================================
// Ledger helpers
// ============================================================
const TYPE_META = {
  patient:   { label: 'Bệnh nhân',       color: 'blue',   icon: FiUser },
  record:    { label: 'Bệnh án',          color: 'green',  icon: FiFileText },
  doctor:    { label: 'Bác sĩ',           color: 'purple', icon: FiActivity },
  hospital:  { label: 'Bệnh viện',        color: 'cyan',   icon: FiShield },
  insurance: { label: 'Công ty BH',       color: 'yellow', icon: FiDollarSign },
  agent:     { label: 'Chi nhánh BH',     color: 'orange', icon: FiBriefcase },
  claim:     { label: 'Yêu cầu BH',       color: 'amber',  icon: FiDollarSign },
  dispense:  { label: 'Cấp thuốc',        color: 'teal',   icon: FiPackage },
  emergency: { label: 'Khẩn cấp',         color: 'red',    icon: FiAlertCircle },
}

const COLOR_MAP = {
  blue:   { badge: 'bg-blue-100 text-blue-700',     icon: 'bg-blue-100 text-blue-600',     num: 'text-blue-600' },
  green:  { badge: 'bg-green-100 text-green-700',   icon: 'bg-green-100 text-green-600',   num: 'text-green-600' },
  purple: { badge: 'bg-purple-100 text-purple-700', icon: 'bg-purple-100 text-purple-600', num: 'text-purple-600' },
  cyan:   { badge: 'bg-cyan-100 text-cyan-700',     icon: 'bg-cyan-100 text-cyan-600',     num: 'text-cyan-600' },
  yellow: { badge: 'bg-yellow-100 text-yellow-700', icon: 'bg-yellow-100 text-yellow-600', num: 'text-yellow-600' },
  amber:  { badge: 'bg-amber-100 text-amber-700',   icon: 'bg-amber-100 text-amber-600',   num: 'text-amber-600' },
  orange: { badge: 'bg-orange-100 text-orange-700', icon: 'bg-orange-100 text-orange-600', num: 'text-orange-600' },
  teal:   { badge: 'bg-teal-100 text-teal-700',     icon: 'bg-teal-100 text-teal-600',     num: 'text-teal-600' },
  red:    { badge: 'bg-red-100 text-red-700',       icon: 'bg-red-100 text-red-600',       num: 'text-red-600' },
  pink:   { badge: 'bg-pink-100 text-pink-700',     icon: 'bg-pink-100 text-pink-600',     num: 'text-pink-600' },
  indigo: { badge: 'bg-indigo-100 text-indigo-700', icon: 'bg-indigo-100 text-indigo-600', num: 'text-indigo-600' },
  gray:   { badge: 'bg-gray-100 text-gray-700',     icon: 'bg-gray-100 text-gray-600',     num: 'text-gray-600' },
}

function getDocType(item) {
  const val = item.Value || item
  if (val.docType) return val.docType
  if (val.patientId && val.authorizedDoctors !== undefined) return 'patient'
  if (val.recordId && val.diagnosis) return 'record'
  if (val.claimId) return 'claim'
  if (val.dispenseId) return 'dispense'
  if (val.agentId) return 'agent'
  if (val.companyId && !val.agentId) return 'insurance'
  if (val.doctorId && val.hospitalId) return 'doctor'
  if (val.hospitalId && val.name && !val.patientId && !val.doctorId) return 'hospital'
  if (val.pharmacyId) return 'dispense'
  return 'data'
}

function getEntryId(item) {
  const val = item.Value || item
  if (item.Key) return item.Key
  return val.recordId || val.claimId || val.dispenseId
    || val.agentId || val.companyId
    || val.patientId || val.doctorId || val.hospitalId || val.pharmacyId
    || null
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
  if (docType === 'insurance') return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
      <span>ID: <strong className="text-gray-700">{val.companyId}</strong></span>
      {val.name && <span>Tên: <strong className="text-gray-700">{val.name}</strong></span>}
      {val.city && <span>Thành phố: {val.city}</span>}
    </div>
  )
  if (docType === 'agent') return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
      <span>ID: <strong className="text-gray-700">{val.agentId}</strong></span>
      {val.name && <span>Tên: <strong className="text-gray-700">{val.name}</strong></span>}
      {val.city && <span>Thành phố: {val.city}</span>}
      {val.companyId && <span>Công ty: <strong className="text-gray-700">{val.companyId}</strong></span>}
    </div>
  )
  return (
    <div className="text-xs text-gray-400 mt-1 truncate">
      {Object.entries(val).slice(0, 3).map(([k, v]) => typeof v !== 'object' && `${k}: ${v}`).filter(Boolean).join(' · ')}
    </div>
  )
}

// ============================================================
// Hospital + Doctor view
// ============================================================
function HospitalRow({ hospital, userId }) {
  const [open, setOpen] = useState(false)
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const toggleDoctors = async () => {
    if (!open && !loaded) {
      setLoading(true)
      try {
        const res = await getAllDoctors({ userId, hospitalId: hospital.hospitalId })
        const raw = res.data?.data
        const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
        setDoctors(data)
        setLoaded(true)
      } catch {
        toast.error('Lỗi tải danh sách bác sĩ')
      } finally {
        setLoading(false)
      }
    }
    setOpen(prev => !prev)
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* Hospital header */}
      <button
        onClick={toggleDoctors}
        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors text-left"
      >
        <div className="w-9 h-9 bg-cyan-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <FiShield className="text-cyan-600 text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{hospital.name || hospital.hospitalId}</p>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
            <span className="font-mono">{hospital.hospitalId}</span>
            {hospital.city && (
              <span className="flex items-center gap-1">
                <FiMapPin className="text-xs" />{hospital.city}
              </span>
            )}
            {hospital.timestamp && (
              <span>Tham gia: {new Date(hospital.timestamp).toLocaleDateString('vi-VN')}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {loaded && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              {doctors.length} bác sĩ
            </span>
          )}
          {loading
            ? <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
            : open
              ? <FiChevronDown className="text-gray-400" />
              : <FiChevronRight className="text-gray-400" />
          }
        </div>
      </button>

      {/* Doctors list */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50/40 p-4">
          {doctors.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Chưa có bác sĩ nào được đăng ký</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {doctors.map((doc, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 flex items-start gap-3">
                  <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiActivity className="text-purple-600 text-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{doc.name || doc.doctorId}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{doc.doctorId}</p>
                    {doc.city && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <FiMapPin className="text-xs" />{doc.city}
                      </p>
                    )}
                    {doc.timestamp && (
                      <p className="text-xs text-gray-300 mt-0.5">
                        {new Date(doc.timestamp).toLocaleDateString('vi-VN')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HospitalsTab({ userId }) {
  const [hospitals, setHospitals] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ hospitalId: '', name: '', city: '', password: '' })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAllHospitals({ userId })
      const raw = res.data?.data
      const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
      setHospitals(data)
      toast.success(`Đã tải ${data.length} bệnh viện`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi tải danh sách bệnh viện')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await onboardHospital({ adminId: userId, hospitalId: form.hospitalId, name: form.name, city: form.city, password: form.password })
      if (res.data.success || res.data.message) {
        toast.success(`Đã thêm bệnh viện ${form.name}!`)
        setForm({ hospitalId: '', name: '', city: '', password: '' })
        setShowForm(false)
        load()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi thêm bệnh viện')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = hospitals.filter(h =>
    !filter || JSON.stringify(h).toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {hospitals.length > 0 ? `${hospitals.length} bệnh viện — bấm vào để xem bác sĩ` : 'Tải danh sách bệnh viện từ blockchain'}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(v => !v)} className="btn-secondary flex items-center gap-2 text-sm">
            <FiPlus /> Thêm bệnh viện
          </button>
          <button onClick={load} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            {hospitals.length === 0 ? 'Tải dữ liệu' : 'Làm mới'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card border-2 border-cyan-100">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiShield className="text-cyan-600" /> Thêm bệnh viện mới
          </h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hospital ID *</label>
                <input
                  type="text"
                  value={form.hospitalId}
                  onChange={(e) => setForm(f => ({ ...f, hospitalId: e.target.value }))}
                  className="input-field"
                  placeholder="VD: Hospital02"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên bệnh viện *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field"
                  placeholder="VD: Bệnh viện Đa khoa Trung Ương"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thành phố</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                  className="input-field"
                  placeholder="VD: Hà Nội"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  className="input-field"
                  placeholder="Ít nhất 4 ký tự"
                  required
                  minLength={4}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <FiPlus />}
                Thêm bệnh viện
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Hủy</button>
            </div>
          </form>
        </div>
      )}

      {hospitals.length > 0 && (
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-field pl-10"
            placeholder="Tìm theo tên bệnh viện, ID, thành phố..."
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : hospitals.length === 0 ? (
        <div className="card text-center py-10">
          <FiShield className="text-3xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-400">Nhấn "Tải dữ liệu" để xem danh sách bệnh viện</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-400">Không tìm thấy kết quả</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((h, i) => (
            <HospitalRow key={i} hospital={h} userId={userId} />
          ))}
        </div>
      )}
    </div>
  )
}


// ============================================================
// Doctors tab — Admin quan ly bac si truc tiep
// ============================================================
const DEPARTMENTS = ['Nội khoa', 'Ngoại khoa', 'Sản khoa', 'Nhi khoa', 'Tim mạch', 'Thần kinh', 'Da liễu', 'Mắt', 'Tai Mũi Họng', 'Răng Hàm Mặt', 'Ung bướu', 'Chấn thương chỉnh hình', 'Hồi sức cấp cứu', 'Khác']
const POSITIONS = ['Bác sĩ', 'Bác sĩ chuyên khoa I', 'Bác sĩ chuyên khoa II', 'Thạc sĩ', 'Tiến sĩ', 'Phó Giáo sư', 'Giáo sư', 'Trưởng khoa', 'Phó khoa']

function DoctorsTab({ userId }) {
  const [doctors, setDoctors] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', dob: '', department: '', position: '', specialization: '', phone: '', password: '' })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [docRes, hosRes] = await Promise.all([
        getAllDoctors({ userId, hospitalId: '' }),
        getAllHospitals({ userId }),
      ])
      const docs = docRes.data?.data
      setDoctors(Array.isArray(docs) ? docs : (typeof docs === 'string' ? JSON.parse(docs || '[]') : []))
      const hos = hosRes.data?.data
      setHospitals(Array.isArray(hos) ? hos : (typeof hos === 'string' ? JSON.parse(hos || '[]') : []))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.name) return
    setSubmitting(true)
    try {
      const normalized = form.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim().replace(/\s+/g, '')
      const doctorId = `D-${normalized.slice(0, 10)}-${Date.now().toString(36).slice(-4)}`
      const res = await onboardDoctor({
        hospitalUserId: userId,
        hospitalId: userId,
        doctorId,
        name: form.name,
        city: form.city,
        dob: form.dob,
        department: form.department,
        position: form.position,
        specialization: form.specialization,
        phone: form.phone,
        password: form.password,
      })
      if (res.data.success || res.data.message || res.data.userID) {
        toast.success(`Đã thêm bác sĩ ${form.name} — ID: ${doctorId}`, { autoClose: false })
        setForm({ name: '', city: '', dob: '', department: '', position: '', specialization: '', phone: '', password: '' })
        setShowForm(false)
        load()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi thêm bác sĩ')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = doctors.filter(d =>
    !filter || JSON.stringify(d).toLowerCase().includes(filter.toLowerCase())
  )

  // Group by hospital
  const grouped = {}
  filtered.forEach(d => {
    const hId = d.hospitalId || 'Không rõ'
    if (!grouped[hId]) grouped[hId] = []
    grouped[hId].push(d)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {doctors.length > 0 ? `${doctors.length} bác sĩ trong hệ thống` : 'Tải danh sách bác sĩ từ blockchain'}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(v => !v)} className="btn-secondary flex items-center gap-2 text-sm">
            <FiPlus /> Thêm bác sĩ
          </button>
          <button onClick={load} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            {doctors.length === 0 ? 'Tải dữ liệu' : 'Làm mới'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card border-2 border-purple-100">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiActivity className="text-purple-600" /> Thêm bác sĩ mới
          </h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên *</label>
                <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="VD: Nguyễn Văn B" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
                <input type="date" value={form.dob} onChange={(e) => setForm(f => ({ ...f, dob: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" placeholder="VD: 0912345678" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Khoa</label>
                <select value={form.department} onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))} className="input-field">
                  <option value="">-- Chọn khoa --</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chức vụ</label>
                <select value={form.position} onChange={(e) => setForm(f => ({ ...f, position: e.target.value }))} className="input-field">
                  <option value="">-- Chọn chức vụ --</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chuyên khoa</label>
                <input type="text" value={form.specialization} onChange={(e) => setForm(f => ({ ...f, specialization: e.target.value }))} className="input-field" placeholder="VD: Phẫu thuật tim" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thành phố</label>
                <input type="text" value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} className="input-field" placeholder="VD: Hà Nội" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu *</label>
                <input type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} className="input-field" placeholder="Ít nhất 4 ký tự" required minLength={4} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <FiPlus />}
                Thêm bác sĩ
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Hủy</button>
            </div>
          </form>
        </div>
      )}

      {doctors.length > 0 && (
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-field pl-10"
            placeholder="Tìm theo tên, ID bác sĩ, bệnh viện..."
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : doctors.length === 0 ? (
        <div className="card text-center py-10">
          <FiActivity className="text-3xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-400">Nhấn "Tải dữ liệu" để xem danh sách bác sĩ</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-400">Không tìm thấy kết quả</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([hospitalId, docs]) => {
            const hospital = hospitals.find(h => h.hospitalId === hospitalId)
            return (
              <div key={hospitalId}>
                <div className="flex items-center gap-2 mb-3">
                  <FiShield className="text-cyan-600" />
                  <h3 className="font-semibold text-gray-700">{hospital?.name || hospitalId}</h3>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{docs.length} bác sĩ</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {docs.map((doc, i) => (
                    <div key={i} className="card flex items-start gap-3">
                      <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FiActivity className="text-purple-600 text-lg" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{doc.name || doc.doctorId}</p>
                        <p className="text-xs text-gray-400 font-mono">{doc.doctorId}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {doc.position && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{doc.position}</span>}
                          {doc.department && <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{doc.department}</span>}
                          {doc.specialization && <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{doc.specialization}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 text-xs text-gray-400 mt-1">
                          {doc.phone && <span>{doc.phone}</span>}
                          {doc.city && <span className="flex items-center gap-0.5"><FiMapPin className="text-[10px]" />{doc.city}</span>}
                          {doc.dob && <span>NS: {doc.dob}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Pharmacies tab — Admin quan ly nha thuoc
// ============================================================
function PharmaciesTab({ userId }) {
  const [pharmacies, setPharmacies] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', password: '' })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAllPharmacies({ userId, hospitalId: '' })
      const raw = res.data?.data
      const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
      setPharmacies(data)
      toast.success(`Đã tải ${data.length} nhà thuốc`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi tải danh sách nhà thuốc')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.name) return
    setSubmitting(true)
    try {
      const normalized = form.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim().replace(/\s+/g, '')
      const pharmacyId = `PH-${normalized.slice(0, 10)}-${Date.now().toString(36).slice(-4)}`
      const res = await onboardPharmacy({
        hospitalUserId: userId,
        hospitalId: userId,
        pharmacyId,
        name: form.name,
        city: form.city,
        password: form.password,
      })
      if (res.data.success || res.data.message || res.data.userID) {
        toast.success(`Đã thêm nhà thuốc ${form.name} — ID: ${pharmacyId}`, { autoClose: false })
        setForm({ name: '', city: '', password: '' })
        setShowForm(false)
        load()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi thêm nhà thuốc')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = pharmacies.filter(p =>
    !filter || JSON.stringify(p).toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {pharmacies.length > 0 ? `${pharmacies.length} nhà thuốc trong hệ thống` : 'Tải danh sách nhà thuốc từ blockchain'}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(v => !v)} className="btn-secondary flex items-center gap-2 text-sm">
            <FiPlus /> Thêm nhà thuốc
          </button>
          <button onClick={load} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            {pharmacies.length === 0 ? 'Tải dữ liệu' : 'Làm mới'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card border-2 border-teal-100">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiPackage className="text-teal-600" /> Thêm nhà thuốc mới
          </h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên nhà thuốc *</label>
                <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="VD: Nhà Thuốc An Khang" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thành phố</label>
                <input type="text" value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} className="input-field" placeholder="VD: TP. Hồ Chí Minh" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu *</label>
                <input type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} className="input-field" placeholder="Ít nhất 4 ký tự" required minLength={4} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <FiPlus />}
                Thêm nhà thuốc
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Hủy</button>
            </div>
          </form>
        </div>
      )}

      {pharmacies.length > 0 && (
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-field pl-10"
            placeholder="Tìm theo tên, ID nhà thuốc, thành phố..."
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : pharmacies.length === 0 ? (
        <div className="card text-center py-10">
          <FiPackage className="text-3xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-400">Nhấn "Tải dữ liệu" để xem danh sách nhà thuốc</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-400">Không tìm thấy kết quả</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((ph, i) => (
            <div key={i} className="card flex items-start gap-3">
              <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <FiPackage className="text-teal-600 text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{ph.name || ph.pharmacyId}</p>
                <p className="text-xs text-gray-400 font-mono">{ph.pharmacyId}</p>
                <div className="flex flex-wrap gap-x-3 text-xs text-gray-400 mt-1">
                  {ph.city && <span className="flex items-center gap-0.5"><FiMapPin className="text-[10px]" />{ph.city}</span>}
                  {ph.hospitalId && <span>BV: {ph.hospitalId}</span>}
                  {ph.timestamp && <span>{new Date(ph.timestamp).toLocaleDateString('vi-VN')}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Ledger tab
// ============================================================
function LedgerTab({ userId }) {
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [activeType, setActiveType] = useState('all')
  const [viewMode, setViewMode] = useState('list') // 'list' or 'blocks'

  const loadLedger = async () => {
    setLoading(true)
    try {
      const res = await fetchLedger({ userId, args: [] })
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Toàn bộ dữ liệu trên Hyperledger Fabric</p>
        <div className="flex gap-2">
          {ledger.length > 0 && (
            <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
          )}
          <button onClick={loadLedger} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            {ledger.length === 0 ? 'Tải sổ cái' : 'Làm mới'}
          </button>
          {ledger.length > 0 && (
            <button onClick={exportJSON} className="btn-secondary flex items-center gap-2 text-sm">
              <FiDownload /> Xuất JSON
            </button>
          )}
        </div>
      </div>

      {ledger.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

            {Object.entries(typeCounts).map(([type, count]) => {
              const meta = TYPE_META[type] || { label: type, color: 'gray', icon: FiDatabase }
              const c = COLOR_MAP[meta.color] || COLOR_MAP.gray
              const Icon = meta.icon
              const isActive = activeType === type
              return (
                <button
                  key={type}
                  onClick={() => setActiveType(isActive ? 'all' : type)}
                  className={`card text-center transition-all ${isActive ? 'ring-2 ring-offset-1 shadow-md' : 'hover:shadow-md'}`}
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

          {viewMode === 'blocks' ? (
            <BlockchainView ledger={filteredLedger} getDocType={getDocType} typeMeta={TYPE_META} colorMap={COLOR_MAP} EntryPreview={EntryPreview} />
          ) : (
            <>
              <p className="text-sm text-gray-400">Hiển thị {filteredLedger.length} / {ledger.length} bản ghi</p>

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
        </>
      )}

      {ledger.length === 0 && !loading && (
        <div className="card text-center py-10">
          <FiDatabase className="text-3xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Nhấn "Tải sổ cái" để xem dữ liệu blockchain</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// VIEW: Bệnh viện (hospital role) — chỉ hiện bác sĩ của bệnh viện mình
// ============================================================
function HospitalView({ user }) {
  const [doctors, setDoctors] = useState([])
  const [pharmacies, setPharmacies] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [showDoctorForm, setShowDoctorForm] = useState(false)
  const [showPharmacyForm, setShowPharmacyForm] = useState(false)
  const [doctorForm, setDoctorForm] = useState({ name: '', city: '', dob: '', department: '', position: '', specialization: '', phone: '' })
  const [pharmacyForm, setPharmacyForm] = useState({ name: '', city: '' })
  const [submitting, setSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState('doctors')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [docRes, phRes] = await Promise.all([
        getAllDoctors({ userId: user.userId, hospitalId: user.userId }),
        getAllPharmacies({ userId: user.userId, hospitalId: user.userId }),
      ])
      const rawDoc = docRes.data?.data
      setDoctors(Array.isArray(rawDoc) ? rawDoc : (typeof rawDoc === 'string' ? JSON.parse(rawDoc || '[]') : []))
      const rawPh = phRes.data?.data
      setPharmacies(Array.isArray(rawPh) ? rawPh : (typeof rawPh === 'string' ? JSON.parse(rawPh || '[]') : []))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  const handleAddDoctor = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const normalized = doctorForm.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim().replace(/\s+/g, '')
      const doctorId = `D-${normalized.slice(0, 10)}-${Date.now().toString(36).slice(-4)}`
      const res = await onboardDoctor({
        hospitalUserId: user.userId,
        hospitalId: user.userId,
        doctorId,
        name: doctorForm.name,
        city: doctorForm.city,
        dob: doctorForm.dob,
        department: doctorForm.department,
        position: doctorForm.position,
        specialization: doctorForm.specialization,
        phone: doctorForm.phone,
      })
      if (res.data.success || res.data.message) {
        toast.success(`Đã thêm bác sĩ ${doctorForm.name} — ID: ${doctorId}`, { autoClose: false })
        setDoctorForm({ name: '', city: '', dob: '', department: '', position: '', specialization: '', phone: '' })
        setShowDoctorForm(false)
        loadAll()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi thêm bác sĩ')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddPharmacy = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const normalized = pharmacyForm.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim().replace(/\s+/g, '')
      const pharmacyId = `PH-${normalized.slice(0, 10)}-${Date.now().toString(36).slice(-4)}`
      const res = await onboardPharmacy({
        hospitalUserId: user.userId,
        hospitalId: user.userId,
        pharmacyId,
        name: pharmacyForm.name,
        city: pharmacyForm.city,
      })
      if (res.data.success || res.data.message) {
        toast.success(`Đã thêm nhà thuốc ${pharmacyForm.name} — ID: ${pharmacyId}`, { autoClose: false })
        setPharmacyForm({ name: '', city: '' })
        setShowPharmacyForm(false)
        loadAll()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi thêm nhà thuốc')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredDoctors = doctors.filter(d =>
    !filter || JSON.stringify(d).toLowerCase().includes(filter.toLowerCase())
  )
  const filteredPharmacies = pharmacies.filter(p =>
    !filter || JSON.stringify(p).toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Bệnh viện</h1>
        <p className="text-gray-500 mt-0.5">{user.name || user.userId} — Quản lý bác sĩ & nhà thuốc</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={() => setActiveSection('doctors')} className={`card text-left transition-all ${activeSection === 'doctors' ? 'bg-gradient-to-r from-cyan-500 to-cyan-700 text-white' : 'hover:shadow-md'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 ${activeSection === 'doctors' ? 'bg-white/20' : 'bg-purple-50'} rounded-xl flex items-center justify-center`}>
              <FiActivity className={`text-2xl ${activeSection === 'doctors' ? '' : 'text-purple-600'}`} />
            </div>
            <div>
              <p className={`text-sm ${activeSection === 'doctors' ? 'text-cyan-100' : 'text-gray-500'}`}>Tổng bác sĩ</p>
              <p className="text-3xl font-bold">{doctors.length}</p>
            </div>
          </div>
        </button>
        <button onClick={() => setActiveSection('pharmacies')} className={`card text-left transition-all ${activeSection === 'pharmacies' ? 'bg-gradient-to-r from-teal-500 to-teal-700 text-white' : 'hover:shadow-md'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 ${activeSection === 'pharmacies' ? 'bg-white/20' : 'bg-teal-50'} rounded-xl flex items-center justify-center`}>
              <FiPackage className={`text-2xl ${activeSection === 'pharmacies' ? '' : 'text-teal-600'}`} />
            </div>
            <div>
              <p className={`text-sm ${activeSection === 'pharmacies' ? 'text-teal-100' : 'text-gray-500'}`}>Tổng nhà thuốc</p>
              <p className="text-3xl font-bold">{pharmacies.length}</p>
            </div>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => activeSection === 'doctors' ? setShowDoctorForm(v => !v) : setShowPharmacyForm(v => !v)}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <FiPlus /> {activeSection === 'doctors' ? 'Thêm bác sĩ' : 'Thêm nhà thuốc'}
        </button>
        <button
          onClick={loadAll}
          disabled={loading}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </div>

      {/* Doctor form */}
      {activeSection === 'doctors' && showDoctorForm && (
        <div className="card border-2 border-purple-100">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiActivity className="text-purple-600" /> Thêm bác sĩ mới
          </h3>
          <form onSubmit={handleAddDoctor} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên *</label>
                <input type="text" value={doctorForm.name} onChange={(e) => setDoctorForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="VD: Nguyễn Văn B" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
                <input type="date" value={doctorForm.dob} onChange={(e) => setDoctorForm(f => ({ ...f, dob: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input type="tel" value={doctorForm.phone} onChange={(e) => setDoctorForm(f => ({ ...f, phone: e.target.value }))} className="input-field" placeholder="VD: 0912345678" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Khoa</label>
                <select value={doctorForm.department} onChange={(e) => setDoctorForm(f => ({ ...f, department: e.target.value }))} className="input-field">
                  <option value="">-- Chọn khoa --</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chức vụ</label>
                <select value={doctorForm.position} onChange={(e) => setDoctorForm(f => ({ ...f, position: e.target.value }))} className="input-field">
                  <option value="">-- Chọn chức vụ --</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chuyên khoa</label>
                <input type="text" value={doctorForm.specialization} onChange={(e) => setDoctorForm(f => ({ ...f, specialization: e.target.value }))} className="input-field" placeholder="VD: Phẫu thuật tim" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thành phố</label>
                <input type="text" value={doctorForm.city} onChange={(e) => setDoctorForm(f => ({ ...f, city: e.target.value }))} className="input-field" placeholder="VD: TP. Hồ Chí Minh" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <FiPlus />}
                Thêm bác sĩ
              </button>
              <button type="button" onClick={() => setShowDoctorForm(false)} className="btn-secondary">Hủy</button>
            </div>
          </form>
        </div>
      )}

      {/* Pharmacy form */}
      {activeSection === 'pharmacies' && showPharmacyForm && (
        <div className="card border-2 border-teal-100">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiPackage className="text-teal-600" /> Thêm nhà thuốc mới
          </h3>
          <form onSubmit={handleAddPharmacy} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên nhà thuốc *</label>
                <input type="text" value={pharmacyForm.name} onChange={(e) => setPharmacyForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="VD: Nhà Thuốc An Khang" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thành phố</label>
                <input type="text" value={pharmacyForm.city} onChange={(e) => setPharmacyForm(f => ({ ...f, city: e.target.value }))} className="input-field" placeholder="VD: TP. Hồ Chí Minh" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <FiPlus />}
                Thêm nhà thuốc
              </button>
              <button type="button" onClick={() => setShowPharmacyForm(false)} className="btn-secondary">Hủy</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {(activeSection === 'doctors' ? doctors : pharmacies).length > 0 && (
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="input-field pl-10"
                placeholder={activeSection === 'doctors' ? 'Tìm theo tên, ID bác sĩ...' : 'Tìm theo tên, ID nhà thuốc...'}
              />
            </div>
          )}

          {/* Doctors list */}
          {activeSection === 'doctors' && (
            filteredDoctors.length === 0 ? (
              <div className="card text-center py-10">
                <FiActivity className="text-3xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-400">
                  {doctors.length === 0 ? 'Chưa có bác sĩ nào được đăng ký' : 'Không tìm thấy kết quả'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDoctors.map((doc, i) => (
                  <div key={i} className="card flex items-start gap-3">
                    <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FiActivity className="text-purple-600 text-lg" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{doc.name || doc.doctorId}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {doc.position && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{doc.position}</span>}
                        {doc.department && <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{doc.department}</span>}
                        {doc.specialization && <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{doc.specialization}</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-xs text-gray-400 mt-1">
                        {doc.phone && <span>{doc.phone}</span>}
                        {doc.city && <span className="flex items-center gap-0.5"><FiMapPin className="text-[10px]" />{doc.city}</span>}
                        {doc.dob && <span>NS: {doc.dob}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Pharmacies list */}
          {activeSection === 'pharmacies' && (
            filteredPharmacies.length === 0 ? (
              <div className="card text-center py-10">
                <FiPackage className="text-3xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-400">
                  {pharmacies.length === 0 ? 'Chưa có nhà thuốc nào được đăng ký' : 'Không tìm thấy kết quả'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPharmacies.map((ph, i) => (
                  <div key={i} className="card flex items-start gap-3">
                    <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FiPackage className="text-teal-600 text-lg" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{ph.name || ph.pharmacyId}</p>
                      <p className="text-xs text-gray-400 font-mono">{ph.pharmacyId}</p>
                      <div className="flex flex-wrap gap-x-3 text-xs text-gray-400 mt-1">
                        {ph.city && <span className="flex items-center gap-0.5"><FiMapPin className="text-[10px]" />{ph.city}</span>}
                        {ph.timestamp && <span>{new Date(ph.timestamp).toLocaleDateString('vi-VN')}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// Root
// ============================================================
export default function AdminLedger() {
  const { user } = useAuth()
  const location = useLocation()

  const isHospitalAdmin = ['hospitalAdmin', 'hospital3Admin'].includes(user.userId)
  if (user.role === 'hospital' && !isHospitalAdmin) {
    return <HospitalView user={user} />
  }

  const tab = location.pathname.includes('/admin/ledger') ? 'ledger'
    : location.pathname.includes('/admin/pharmacies') ? 'pharmacies'
    : 'doctors'

  const TAB_TITLES = {
    doctors: 'Quản lý bác sĩ',
    pharmacies: 'Quản lý nhà thuốc',
    ledger: 'Sổ cái Blockchain',
  }
  const TAB_DESCS = {
    doctors: 'Quản lý bác sĩ trong hệ thống',
    pharmacies: 'Quản lý nhà thuốc trong hệ thống',
    ledger: 'Toàn bộ dữ liệu trên Hyperledger Fabric',
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">{TAB_TITLES[tab]}</h1>
        <p className="text-gray-500 mt-0.5">{user.name || user.userId} — {TAB_DESCS[tab]}</p>
      </div>

      {tab === 'doctors'    && <DoctorsTab userId={user.userId} />}
      {tab === 'pharmacies' && <PharmaciesTab userId={user.userId} />}
      {tab === 'ledger'     && <LedgerTab  userId={user.userId} />}
    </div>
  )
}
