import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  addProcedure, updateProcedureOutcome, getProceduresByPatient, getMyPatients
} from '../services/api'
import { toast } from 'react-toastify'
import {
  FiScissors, FiPlus, FiSearch, FiCheck, FiAlertTriangle, FiX,
  FiCalendar, FiClock, FiUser, FiUsers, FiMapPin, FiFileText, FiEdit
} from 'react-icons/fi'
import PatientIdInput from '../components/PatientIdInput'

// ICD-10-PCS code phổ biến ở VN (7 ký tự, không có I/O để tránh nhầm 1/0)
const COMMON_PROCEDURES = [
  { code: '0DTJ4ZZ', name: 'Cắt ruột thừa nội soi', category: 'surgery' },
  { code: '0FT40ZZ', name: 'Cắt túi mật mở', category: 'surgery' },
  { code: '0FT44ZZ', name: 'Cắt túi mật nội soi', category: 'surgery' },
  { code: '0SRD0J9', name: 'Thay khớp gối toàn bộ', category: 'surgery' },
  { code: '02703DZ', name: 'Nong mạch vành đặt stent', category: 'intervention' },
  { code: '0DB68ZX', name: 'Nội soi dạ dày sinh thiết', category: 'endoscopy' },
  { code: '0DBE8ZX', name: 'Nội soi đại tràng sinh thiết', category: 'endoscopy' },
  { code: '0HBT3ZX', name: 'Sinh thiết vú kim lõi', category: 'biopsy' },
  { code: '0B1108F', name: 'Đặt ống nội khí quản', category: 'minor' },
  { code: '0W9G3ZX', name: 'Chọc hút dịch ổ bụng', category: 'minor' },
]

const CATEGORY_LABELS = {
  surgery: { label: 'Phẫu thuật', classes: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  endoscopy: { label: 'Nội soi', classes: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  biopsy: { label: 'Sinh thiết', classes: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  intervention: { label: 'Can thiệp', classes: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  minor: { label: 'Thủ thuật nhỏ', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
}

const OUTCOME_LABELS = {
  pending: { label: 'Đang theo dõi', classes: 'bg-gray-100 text-gray-700', icon: FiClock },
  success: { label: 'Thành công', classes: 'bg-emerald-100 text-emerald-700', icon: FiCheck },
  complication: { label: 'Có biến chứng', classes: 'bg-orange-100 text-orange-700', icon: FiAlertTriangle },
  failed: { label: 'Thất bại', classes: 'bg-red-100 text-red-700', icon: FiX },
}

const ANESTHESIA_LABELS = {
  general: 'Gây mê toàn thân',
  local: 'Gây tê tại chỗ',
  spinal: 'Gây tê tủy sống',
  sedation: 'An thần',
  none: 'Không gây tê',
}

export default function Procedures() {
  const { user } = useAuth()
  const [procedures, setProcedures] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchPatientId, setSearchPatientId] = useState('')
  const [myPatients, setMyPatients] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(initialAddForm())
  const [outcomeModal, setOutcomeModal] = useState(null)
  const [outcomeForm, setOutcomeForm] = useState({ outcome: 'success', complicationsText: '', followUpPlan: '', notes: '' })
  const [filterCategory, setFilterCategory] = useState('')

  function initialAddForm() {
    return {
      patientId: '',
      procedureCode: '', procedureName: '', category: 'surgery',
      performedDate: new Date().toISOString().slice(0, 16),
      duration: '',
      assistantsText: '',
      department: '',
      anesthesiaType: 'general',
      relatedRecordId: '',
      followUpPlan: '',
      notes: ''
    }
  }

  useEffect(() => {
    if (user.role === 'patient') {
      loadProcedures(user.userId)
    } else if (user.role === 'doctor' || user.role === 'hospital') {
      getMyPatients({ userId: user.userId })
        .then(res => setMyPatients(res.data.data || []))
        .catch(() => {})
    }
  }, [])

  const loadProcedures = async (patientId) => {
    setLoading(true)
    try {
      const res = await getProceduresByPatient({ userId: user.userId, patientId })
      const raw = res.data.data
      const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
      setProcedures(data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không thể tải lịch sử phẫu thuật')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (searchPatientId.trim()) loadProcedures(searchPatientId.trim())
  }

  const handlePickCommon = (p) => {
    setAddForm({ ...addForm, procedureCode: p.code, procedureName: p.name, category: p.category })
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!addForm.patientId || !addForm.procedureCode || !addForm.procedureName) {
      toast.error('Vui lòng nhập đủ Patient ID, mã ICD-10-PCS và tên thủ thuật')
      return
    }
    try {
      const payload = {
        userId: user.userId,
        patientId: addForm.patientId,
        procedureCode: addForm.procedureCode,
        procedureName: addForm.procedureName,
        category: addForm.category,
        performedDate: addForm.performedDate ? new Date(addForm.performedDate).toISOString() : undefined,
        duration: addForm.duration ? Number(addForm.duration) : undefined,
        assistants: addForm.assistantsText.trim()
          ? addForm.assistantsText.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        department: addForm.department || undefined,
        anesthesiaType: addForm.anesthesiaType,
        relatedRecordId: addForm.relatedRecordId || undefined,
        followUpPlan: addForm.followUpPlan || undefined,
        notes: addForm.notes || undefined,
      }
      await addProcedure(payload)
      toast.success('Đã ghi nhận thủ thuật')
      setShowAddForm(false)
      setAddForm(initialAddForm())
      await loadProcedures(addForm.patientId)
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Thêm thất bại')
    }
  }

  const handleUpdateOutcome = async (e) => {
    e.preventDefault()
    if (!outcomeModal) return
    try {
      const complications = outcomeForm.complicationsText.trim()
        ? outcomeForm.complicationsText.split(',').map(s => s.trim()).filter(Boolean)
        : []
      await updateProcedureOutcome({
        userId: user.userId,
        patientId: outcomeModal.patientId,
        procId: outcomeModal.procId,
        outcome: outcomeForm.outcome,
        complications,
        followUpPlan: outcomeForm.followUpPlan || undefined,
        notes: outcomeForm.notes || undefined,
      })
      toast.success('Đã cập nhật outcome')
      setOutcomeModal(null)
      setOutcomeForm({ outcome: 'success', complicationsText: '', followUpPlan: '', notes: '' })
      await loadProcedures(outcomeModal.patientId)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cập nhật thất bại')
    }
  }

  const openOutcomeModal = (proc) => {
    setOutcomeModal({ procId: proc.procId, patientId: proc.patientId, current: proc })
    setOutcomeForm({
      outcome: proc.outcome === 'pending' ? 'success' : proc.outcome,
      complicationsText: (proc.complications || []).join(', '),
      followUpPlan: proc.followUpPlan || '',
      notes: proc.notes || '',
    })
  }

  const filtered = filterCategory ? procedures.filter(p => p.category === filterCategory) : procedures

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FiScissors className="text-red-600" /> Lịch sử phẫu thuật & thủ thuật
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">Theo chuẩn ICD-10-PCS</p>
        </div>
        {user.role === 'doctor' && (
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary flex items-center gap-2">
            <FiPlus /> {showAddForm ? 'Ẩn form' : 'Thêm thủ thuật'}
          </button>
        )}
      </div>

      {/* Search cho doctor/hospital */}
      {user.role !== 'patient' && !showAddForm && (
        <div className="card">
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <PatientIdInput
                value={searchPatientId}
                onChange={setSearchPatientId}
                patients={myPatients}
                placeholder="Nhập Patient ID hoặc tên bệnh nhân"
                required={false}
              />
            </div>
            <button onClick={handleSearch} className="btn-primary flex items-center gap-2">
              <FiSearch /> Tra cứu
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAddForm && user.role === 'doctor' && (
        <div className="card">
          <h2 className="text-sm font-semibold mb-4">Ghi nhận thủ thuật mới</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID *</label>
              <PatientIdInput
                value={addForm.patientId}
                onChange={(v) => setAddForm({ ...addForm, patientId: v })}
                patients={myPatients}
                placeholder="P-xxx"
              />
            </div>

            {/* Quick pick */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thủ thuật phổ biến (click chọn)</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_PROCEDURES.map((p) => (
                  <button key={p.code} type="button" onClick={() => handlePickCommon(p)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      addForm.procedureCode === p.code
                        ? 'bg-primary-100 text-primary-700 border-primary-300'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}>
                    {p.code} · {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ICD-10-PCS *</label>
                <input type="text" value={addForm.procedureCode}
                  onChange={(e) => setAddForm({ ...addForm, procedureCode: e.target.value.toUpperCase() })}
                  className="input-field font-mono" placeholder="0DTJ4ZZ" pattern="[0-9A-HJ-NP-Z]{7}" maxLength={7} required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên thủ thuật *</label>
                <input type="text" value={addForm.procedureName}
                  onChange={(e) => setAddForm({ ...addForm, procedureName: e.target.value })}
                  className="input-field" placeholder="VD: Cắt ruột thừa nội soi" required />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại *</label>
                <select value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                  className="input-field" required>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phương pháp gây tê</label>
                <select value={addForm.anesthesiaType}
                  onChange={(e) => setAddForm({ ...addForm, anesthesiaType: e.target.value })}
                  className="input-field">
                  {Object.entries(ANESTHESIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thời lượng (phút)</label>
                <input type="number" min="1" max="1440" value={addForm.duration}
                  onChange={(e) => setAddForm({ ...addForm, duration: e.target.value })}
                  className="input-field" placeholder="45" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Khoa</label>
                <input type="text" value={addForm.department}
                  onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                  className="input-field" placeholder="Ngoại tổng hợp" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày giờ thực hiện</label>
                <input type="datetime-local" value={addForm.performedDate}
                  onChange={(e) => setAddForm({ ...addForm, performedDate: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Record ID liên quan (tùy chọn)</label>
                <input type="text" value={addForm.relatedRecordId}
                  onChange={(e) => setAddForm({ ...addForm, relatedRecordId: e.target.value })}
                  className="input-field font-mono" placeholder="R-xxxx" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bác sĩ phụ mổ (uuid, phân cách dấu phẩy)</label>
              <input type="text" value={addForm.assistantsText}
                onChange={(e) => setAddForm({ ...addForm, assistantsText: e.target.value })}
                className="input-field" placeholder="Doctor02, Doctor03" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kế hoạch theo dõi sau mổ</label>
              <input type="text" value={addForm.followUpPlan}
                onChange={(e) => setAddForm({ ...addForm, followUpPlan: e.target.value })}
                className="input-field" placeholder="Tái khám sau 7 ngày cắt chỉ" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
              <textarea value={addForm.notes}
                onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                className="input-field" rows="2"
                placeholder="Ghi chú chi tiết về quá trình thực hiện..." />
            </div>

            <button type="submit" className="btn-primary flex items-center gap-2">
              <FiPlus /> Ghi nhận
            </button>
          </form>
        </div>
      )}

      {/* Filter */}
      {procedures.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Lọc:</span>
          <button onClick={() => setFilterCategory('')}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              !filterCategory ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'
            }`}>
            Tất cả ({procedures.length})
          </button>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => {
            const count = procedures.filter(p => p.category === k).length
            if (count === 0) return null
            return (
              <button key={k} onClick={() => setFilterCategory(filterCategory === k ? '' : k)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  filterCategory === k ? 'bg-gray-800 text-white border-gray-800' : v.classes
                }`}>
                {v.label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-10">
          <FiScissors className="text-3xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Chưa có thủ thuật nào</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gradient-to-b from-red-200 via-red-300 to-transparent" />
          <div className="space-y-4">
            {filtered.map((p, i) => {
              const cat = CATEGORY_LABELS[p.category] || CATEGORY_LABELS.minor
              const out = OUTCOME_LABELS[p.outcome] || OUTCOME_LABELS.pending
              const OutIcon = out.icon
              const canUpdateOutcome =
                (user.role === 'doctor' && user.userId === p.performedBy) ||
                (user.role === 'hospital' && user.userId === p.hospitalId)
              return (
                <div key={i} className="relative pl-12">
                  <div className={`absolute left-0 top-3 w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow ${cat.dot}`}>
                    <FiScissors className="text-white text-sm" />
                  </div>

                  <div className="card">
                    <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{p.procedureName}</h3>
                          <span className={`text-xs font-mono border px-2 py-0.5 rounded ${cat.classes}`}>
                            {p.procedureCode}
                          </span>
                          <span className={`text-xs border px-2 py-0.5 rounded ${cat.classes}`}>
                            {cat.label}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${out.classes}`}>
                            <OutIcon className="text-xs" /> {out.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 font-mono">{p.procId}</p>
                      </div>
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
                        <FiCalendar className="text-xs" />
                        {p.performedDate ? new Date(p.performedDate).toLocaleString('vi-VN') : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600 mt-3">
                      {p.duration && (
                        <div className="flex items-center gap-1"><FiClock className="text-xs" /> {p.duration} phút</div>
                      )}
                      {p.performedBy && (
                        <div className="flex items-center gap-1"><FiUser className="text-xs" /> {p.performedBy}</div>
                      )}
                      {p.department && (
                        <div className="flex items-center gap-1"><FiMapPin className="text-xs" /> {p.department}</div>
                      )}
                      {p.anesthesiaType && (
                        <div><span className="text-gray-400">Gây tê:</span> {ANESTHESIA_LABELS[p.anesthesiaType] || p.anesthesiaType}</div>
                      )}
                    </div>

                    {p.assistants && p.assistants.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <FiUsers /> Phụ mổ: {p.assistants.join(', ')}
                      </div>
                    )}

                    {p.complications && p.complications.length > 0 && (
                      <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-2">
                        <p className="text-xs font-semibold text-orange-700 flex items-center gap-1">
                          <FiAlertTriangle /> Biến chứng
                        </p>
                        <ul className="mt-1 list-disc list-inside text-sm text-orange-800">
                          {p.complications.map((c, j) => <li key={j}>{c}</li>)}
                        </ul>
                      </div>
                    )}

                    {p.followUpPlan && (
                      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-2 text-sm text-blue-800">
                        <b>Theo dõi:</b> {p.followUpPlan}
                      </div>
                    )}

                    {p.relatedRecordId && (
                      <div className="mt-2 text-xs text-gray-500">
                        <FiFileText className="inline" /> Liên kết với record: <code className="font-mono">{p.relatedRecordId}</code>
                      </div>
                    )}

                    {p.notes && (
                      <p className="mt-3 text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">{p.notes}</p>
                    )}

                    {canUpdateOutcome && (
                      <button onClick={() => openOutcomeModal(p)}
                        className="mt-3 text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                        <FiEdit /> Cập nhật kết quả
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Outcome update modal */}
      {outcomeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <button onClick={() => setOutcomeModal(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
              <FiX />
            </button>
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiEdit className="text-primary-500" /> Cập nhật kết quả thủ thuật
            </h3>
            <p className="text-xs text-gray-500 mb-3 font-mono">{outcomeModal.procId}</p>
            <form onSubmit={handleUpdateOutcome} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kết quả *</label>
                <select value={outcomeForm.outcome}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, outcome: e.target.value })}
                  className="input-field" required>
                  {Object.entries(OUTCOME_LABELS).filter(([k]) => k !== 'pending').map(([k, v]) =>
                    <option key={k} value={k}>{v.label}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Biến chứng (phân cách bằng dấu phẩy)</label>
                <input type="text" value={outcomeForm.complicationsText}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, complicationsText: e.target.value })}
                  className="input-field" placeholder="nhiễm trùng vết mổ, chảy máu" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kế hoạch theo dõi</label>
                <input type="text" value={outcomeForm.followUpPlan}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, followUpPlan: e.target.value })}
                  className="input-field" placeholder="Tái khám sau 7 ngày" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú thêm</label>
                <textarea value={outcomeForm.notes}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, notes: e.target.value })}
                  className="input-field" rows="2" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">Lưu</button>
                <button type="button" onClick={() => setOutcomeModal(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
