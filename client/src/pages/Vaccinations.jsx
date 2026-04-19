import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getVaccinationsByPatient, addVaccination, reportAdverseReaction, getMyPatients } from '../services/api'
import { toast } from 'react-toastify'
import {
  FiShield, FiPlus, FiSearch, FiAlertTriangle, FiCalendar,
  FiClock, FiMapPin, FiUser, FiX, FiChevronRight
} from 'react-icons/fi'
import PatientIdInput from '../components/PatientIdInput'

// Vaccine CVX code phổ biến (CDC standard)
const COMMON_VACCINES = [
  { code: '208', name: 'COVID-19 Pfizer-BioNTech (Comirnaty)' },
  { code: '207', name: 'COVID-19 Moderna (Spikevax)' },
  { code: '210', name: 'COVID-19 AstraZeneca' },
  { code: '08', name: 'Hepatitis B (HepB)' },
  { code: '03', name: 'MMR (Sởi - Quai bị - Rubella)' },
  { code: '20', name: 'DTaP (Bạch hầu - Ho gà - Uốn ván)' },
  { code: '10', name: 'IPV (Bại liệt)' },
  { code: '83', name: 'Hepatitis A (HepA)' },
  { code: '21', name: 'Varicella (Thủy đậu)' },
  { code: '17', name: 'Hib (Haemophilus influenzae b)' },
  { code: '133', name: 'PCV13 (Phế cầu)' },
  { code: '88', name: 'Influenza (Cúm mùa)' },
  { code: '136', name: 'HPV9 (Human Papillomavirus)' },
  { code: '62', name: 'HPV (4-valent)' },
  { code: '111', name: 'Tetanus (Uốn ván)' },
]

const SITE_LABELS = {
  'left-arm': 'Cánh tay trái', 'right-arm': 'Cánh tay phải',
  'left-thigh': 'Đùi trái', 'right-thigh': 'Đùi phải',
  'left-deltoid': 'Cơ delta trái', 'right-deltoid': 'Cơ delta phải',
  'oral': 'Đường uống', 'nasal': 'Đường mũi'
}

const SEVERITY_LABELS = {
  mild: { label: 'Nhẹ', classes: 'bg-yellow-100 text-yellow-700' },
  moderate: { label: 'Vừa', classes: 'bg-orange-100 text-orange-700' },
  severe: { label: 'Nặng', classes: 'bg-red-100 text-red-700' },
  'life-threatening': { label: 'Nguy hiểm tính mạng', classes: 'bg-red-200 text-red-800' }
}

export default function Vaccinations() {
  const { user } = useAuth()
  const [vaccinations, setVaccinations] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchPatientId, setSearchPatientId] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showReactionModal, setShowReactionModal] = useState(null)
  const [addForm, setAddForm] = useState(initialAddForm())
  const [reactionForm, setReactionForm] = useState({ reaction: '', severity: 'mild' })
  const [myPatients, setMyPatients] = useState([])

  function initialAddForm() {
    return {
      patientId: '',
      vaccineCode: '', vaccineName: '',
      manufacturer: '', lotNumber: '',
      doseNumber: 1, siteOfInjection: 'left-arm',
      nextDoseDue: '', notes: ''
    }
  }

  useEffect(() => {
    if (user.role === 'patient') {
      loadVax(user.userId)
    } else if (user.role === 'doctor' || user.role === 'hospital') {
      // Load patients ma caller co quyen xem de autocomplete
      getMyPatients({ userId: user.userId })
        .then(res => setMyPatients(res.data.data || []))
        .catch(() => {})
    }
  }, [])

  const loadVax = async (patientId) => {
    setLoading(true)
    try {
      const res = await getVaccinationsByPatient({ userId: user.userId, patientId })
      const raw = res.data.data
      const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
      setVaccinations(data)
    } catch (err) {
      toast.error('Không thể tải lịch sử tiêm chủng')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (searchPatientId.trim()) loadVax(searchPatientId.trim())
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!addForm.patientId || !addForm.vaccineCode || !addForm.vaccineName) {
      toast.error('Vui lòng nhập Patient ID, CVX code và tên vaccine')
      return
    }
    try {
      await addVaccination({ userId: user.userId, ...addForm })
      toast.success('Đã ghi nhận mũi tiêm')
      setShowAddForm(false)
      setAddForm(initialAddForm())
      await loadVax(addForm.patientId)
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Thêm thất bại')
    }
  }

  const handlePickCommonVaccine = (v) => {
    setAddForm({ ...addForm, vaccineCode: v.code, vaccineName: v.name })
  }

  const handleReportReaction = async (e) => {
    e.preventDefault()
    const { vaxId, patientId } = showReactionModal
    if (!reactionForm.reaction || reactionForm.reaction.length < 3) {
      toast.error('Mô tả phản ứng tối thiểu 3 ký tự')
      return
    }
    try {
      await reportAdverseReaction({
        userId: user.userId, patientId, vaxId,
        reaction: reactionForm.reaction,
        severity: reactionForm.severity
      })
      toast.success('Đã báo cáo phản ứng')
      setShowReactionModal(null)
      setReactionForm({ reaction: '', severity: 'mild' })
      await loadVax(patientId)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Báo cáo thất bại')
    }
  }

  const isOverdue = (v) => v.nextDoseDue && new Date(v.nextDoseDue) < new Date()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FiShield className="text-emerald-600" /> Lịch sử tiêm chủng
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">Sổ tiêm điện tử - chuẩn CVX code (CDC)</p>
        </div>
        {user.role === 'doctor' && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary flex items-center gap-2"
          >
            <FiPlus /> {showAddForm ? 'Ẩn form' : 'Thêm mũi tiêm'}
          </button>
        )}
      </div>

      {/* Search (doctor + hospital admin) - autocomplete tu myPatients */}
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
          <h2 className="text-sm font-semibold mb-4">Ghi nhận mũi tiêm mới</h2>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Vaccine phổ biến (click để chọn)</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_VACCINES.slice(0, 10).map((v) => (
                  <button key={v.code} type="button" onClick={() => handlePickCommonVaccine(v)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      addForm.vaccineCode === v.code
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}>
                    {v.code} · {v.name.split('(')[0].trim()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CVX code *</label>
                <input type="text" value={addForm.vaccineCode}
                  onChange={(e) => setAddForm({ ...addForm, vaccineCode: e.target.value })}
                  className="input-field" placeholder="208" pattern="\d{1,3}" maxLength={3} required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên vaccine *</label>
                <input type="text" value={addForm.vaccineName}
                  onChange={(e) => setAddForm({ ...addForm, vaccineName: e.target.value })}
                  className="input-field" placeholder="Comirnaty" required />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Liều số</label>
                <input type="number" min="1" value={addForm.doseNumber}
                  onChange={(e) => setAddForm({ ...addForm, doseNumber: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí tiêm</label>
                <select value={addForm.siteOfInjection}
                  onChange={(e) => setAddForm({ ...addForm, siteOfInjection: e.target.value })}
                  className="input-field">
                  {Object.entries(SITE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hãng SX</label>
                <input type="text" value={addForm.manufacturer}
                  onChange={(e) => setAddForm({ ...addForm, manufacturer: e.target.value })}
                  className="input-field" placeholder="Pfizer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số lô</label>
                <input type="text" value={addForm.lotNumber}
                  onChange={(e) => setAddForm({ ...addForm, lotNumber: e.target.value })}
                  className="input-field" placeholder="EN5860" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày hẹn mũi tiếp</label>
                <input type="date" value={addForm.nextDoseDue}
                  onChange={(e) => setAddForm({ ...addForm, nextDoseDue: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <input type="text" value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  className="input-field" placeholder="Tiêm tại phòng tiêm A2..." />
              </div>
            </div>

            <button type="submit" className="btn-primary flex items-center gap-2">
              <FiPlus /> Ghi nhận
            </button>
          </form>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : vaccinations.length === 0 ? (
        <div className="card text-center py-10">
          <FiShield className="text-3xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Chưa có mũi tiêm nào</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gradient-to-b from-emerald-200 via-emerald-300 to-transparent" />
          <div className="space-y-4">
            {vaccinations.map((v, i) => {
              const overdue = isOverdue(v)
              const hasReactions = v.adverseReactions && v.adverseReactions.length > 0
              return (
                <div key={i} className="relative pl-12">
                  <div className={`absolute left-0 top-3 w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow ${
                    hasReactions ? 'bg-red-500' : overdue ? 'bg-yellow-500' : 'bg-emerald-500'
                  }`}>
                    <FiShield className="text-white text-sm" />
                  </div>

                  <div className="card">
                    <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{v.vaccineName}</h3>
                          <span className="text-xs font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                            CVX {v.vaccineCode}
                          </span>
                          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                            Liều {v.doseNumber}
                          </span>
                          {overdue && (
                            <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded flex items-center gap-1">
                              <FiAlertTriangle /> Quá hạn mũi tiếp
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 font-mono">{v.vaxId}</p>
                      </div>
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
                        <FiCalendar className="text-xs" />
                        {v.administeredAt ? new Date(v.administeredAt).toLocaleDateString('vi-VN') : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600 mt-3">
                      {v.manufacturer && (
                        <div><span className="text-gray-400">Hãng:</span> <b>{v.manufacturer}</b></div>
                      )}
                      {v.lotNumber && (
                        <div><span className="text-gray-400">Lô:</span> <b className="font-mono">{v.lotNumber}</b></div>
                      )}
                      {v.siteOfInjection && (
                        <div className="flex items-center gap-1"><FiMapPin className="text-xs" />
                          {SITE_LABELS[v.siteOfInjection] || v.siteOfInjection}
                        </div>
                      )}
                      {v.administeredBy && (
                        <div className="flex items-center gap-1"><FiUser className="text-xs" />
                          {v.administeredBy}
                        </div>
                      )}
                    </div>

                    {v.nextDoseDue && (
                      <div className={`mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                        overdue ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}>
                        <FiClock />
                        Mũi tiếp theo: <b>{new Date(v.nextDoseDue).toLocaleDateString('vi-VN')}</b>
                      </div>
                    )}

                    {v.notes && (
                      <p className="mt-3 text-sm text-gray-600 italic">{v.notes}</p>
                    )}

                    {hasReactions && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                          <FiAlertTriangle /> Phản ứng phụ ({v.adverseReactions.length})
                        </p>
                        <div className="space-y-1.5">
                          {v.adverseReactions.map((r, j) => {
                            const sev = SEVERITY_LABELS[r.severity] || SEVERITY_LABELS.mild
                            return (
                              <div key={j} className="flex items-start gap-2 text-sm bg-red-50/50 rounded p-2">
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${sev.classes}`}>
                                  {sev.label}
                                </span>
                                <div className="flex-1">
                                  <p className="text-gray-800">{r.reaction}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {r.reportedByRole} · {r.reportedAt ? new Date(r.reportedAt).toLocaleDateString('vi-VN') : ''}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {(user.role === 'patient' || user.role === 'doctor') && (
                      <button
                        onClick={() => setShowReactionModal({ vaxId: v.vaxId, patientId: v.patientId })}
                        className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                      >
                        <FiAlertTriangle /> Báo cáo phản ứng phụ
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reaction modal */}
      {showReactionModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <button onClick={() => setShowReactionModal(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
              <FiX />
            </button>
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiAlertTriangle className="text-red-500" /> Báo cáo phản ứng phụ
            </h3>
            <form onSubmit={handleReportReaction} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mức độ</label>
                <select value={reactionForm.severity}
                  onChange={(e) => setReactionForm({ ...reactionForm, severity: e.target.value })}
                  className="input-field">
                  {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả *</label>
                <textarea value={reactionForm.reaction}
                  onChange={(e) => setReactionForm({ ...reactionForm, reaction: e.target.value })}
                  className="input-field" rows="3"
                  placeholder="VD: Sốt 38.5°C, đau vai, sưng tại vị trí tiêm..." required minLength={3} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">Gửi báo cáo</button>
                <button type="button" onClick={() => setShowReactionModal(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
