import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { addRecord, updateRecord, getAllRecordsByPatientId, getMyPatients } from '../services/api'
import { toast } from 'react-toastify'
import { FiPlus, FiSearch, FiEdit, FiFileText, FiTrash2, FiUser, FiChevronDown, FiCalendar, FiActivity, FiPackage, FiClock } from 'react-icons/fi'

const emptyMed = { code: '', name: '', strength: '', unit: 'mg', quantity: '1', frequency: '', route: 'oral', timing: '', duration: '', durationUnit: 'days' }

const routeOptions = [
  { value: 'oral', label: 'Uống' },
  { value: 'iv', label: 'Tiêm tĩnh mạch (IV)' },
  { value: 'im', label: 'Tiêm bắp (IM)' },
  { value: 'sc', label: 'Tiêm dưới da' },
  { value: 'topical', label: 'Bôi ngoài da' },
  { value: 'inhaled', label: 'Hít' },
  { value: 'rectal', label: 'Đường trực tràng' },
  { value: 'sublingual', label: 'Ngậm dưới lưỡi' },
]

const timingOptions = [
  { value: '', label: '-- Không chọn --' },
  { value: 'before_meal', label: 'Trước ăn' },
  { value: 'after_meal', label: 'Sau ăn' },
  { value: 'with_meal', label: 'Trong khi ăn' },
  { value: 'empty_stomach', label: 'Lúc đói' },
  { value: 'bedtime', label: 'Trước ngủ' },
  { value: 'morning', label: 'Buổi sáng' },
  { value: 'as_needed', label: 'Khi cần' },
]

function PatientIdInput({ value, onChange, patients, placeholder = 'patient001' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const filtered = patients.filter(
    (p) => p.patientId.toLowerCase().includes(value.toLowerCase()) || (p.name && p.name.toLowerCase().includes(value.toLowerCase()))
  )

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="input-field"
        placeholder={placeholder}
        required
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((p) => (
            <li
              key={p.patientId}
              onMouseDown={() => { onChange(p.patientId); setOpen(false) }}
              className="flex items-center gap-2 px-3 py-2 hover:bg-primary-50 cursor-pointer text-sm"
            >
              <FiUser className="text-primary-400 flex-shrink-0" />
              <span className="font-medium text-gray-800">{p.patientId}</span>
              {p.name && <span className="text-gray-400 truncate">— {p.name}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DiagnosisFields({ form, setForm }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Chẩn đoán</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mã ICD-10 *</label>
        <input
          type="text"
          value={form.diagCode}
          onChange={(e) => setForm({ ...form, diagCode: e.target.value.toUpperCase() })}
          className="input-field"
          placeholder="VD: J11, A09, I10"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả chẩn đoán *</label>
        <input
          type="text"
          value={form.diagDesc}
          onChange={(e) => setForm({ ...form, diagDesc: e.target.value })}
          className="input-field"
          placeholder="VD: Cúm mùa, Viêm phổi, Tăng huyết áp"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú thêm</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="input-field h-16"
          placeholder="Ghi chú bổ sung (không bắt buộc)"
        />
      </div>
    </div>
  )
}

function MedicationFields({ medications, formType, onAdd, onRemove, onUpdate }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Đơn thuốc</h3>
        <button
          type="button"
          onClick={() => onAdd(formType)}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          <FiPlus className="text-xs" /> Thêm thuốc
        </button>
      </div>
      {medications.map((med, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Thuốc #{i + 1}</span>
            {medications.length > 1 && (
              <button type="button" onClick={() => onRemove(formType, i)} className="text-red-400 hover:text-red-600">
                <FiTrash2 className="text-sm" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Mã ATC</label>
              <input
                type="text"
                value={med.code}
                onChange={(e) => onUpdate(formType, i, 'code', e.target.value.toUpperCase())}
                className="input-field text-sm"
                placeholder="VD: N02BE01"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tên thuốc *</label>
              <input
                type="text"
                value={med.name}
                onChange={(e) => onUpdate(formType, i, 'name', e.target.value)}
                className="input-field text-sm"
                placeholder="VD: Paracetamol"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hàm lượng *</label>
              <div className="flex">
                <input
                  type="number"
                  min="0"
                  value={med.strength}
                  onChange={(e) => onUpdate(formType, i, 'strength', e.target.value)}
                  className="input-field text-sm rounded-r-none flex-1"
                  placeholder="500"
                  required
                />
                <select
                  value={med.unit}
                  onChange={(e) => onUpdate(formType, i, 'unit', e.target.value)}
                  className="input-field text-sm rounded-l-none border-l-0 w-20"
                >
                  <option value="mg">mg</option>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="mcg">mcg</option>
                  <option value="IU">IU</option>
                  <option value="unit">unit</option>
                  <option value="tablet">tablet</option>
                  <option value="capsule">capsule</option>
                  <option value="drop">drop</option>
                  <option value="puff">puff</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Số lượng/lần *</label>
              <input
                type="number"
                min="1"
                value={med.quantity}
                onChange={(e) => onUpdate(formType, i, 'quantity', e.target.value)}
                className="input-field text-sm"
                placeholder="1"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Lần/ngày *</label>
              <input
                type="number"
                min="1"
                value={med.frequency}
                onChange={(e) => onUpdate(formType, i, 'frequency', e.target.value)}
                className="input-field text-sm"
                placeholder="3"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Đường dùng</label>
              <select
                value={med.route}
                onChange={(e) => onUpdate(formType, i, 'route', e.target.value)}
                className="input-field text-sm"
              >
                {routeOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Thời điểm uống</label>
              <select
                value={med.timing}
                onChange={(e) => onUpdate(formType, i, 'timing', e.target.value)}
                className="input-field text-sm"
              >
                {timingOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Số ngày dùng</label>
              <div className="flex">
                <input
                  type="number"
                  min="1"
                  value={med.duration}
                  onChange={(e) => onUpdate(formType, i, 'duration', e.target.value)}
                  className="input-field text-sm rounded-r-none flex-1"
                  placeholder="7"
                />
                <select
                  value={med.durationUnit}
                  onChange={(e) => onUpdate(formType, i, 'durationUnit', e.target.value)}
                  className="input-field text-sm rounded-l-none border-l-0 w-24"
                >
                  <option value="days">ngày</option>
                  <option value="weeks">tuần</option>
                  <option value="months">tháng</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DoctorDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('add')
  const [myPatients, setMyPatients] = useState([])
  const [searchId, setSearchId] = useState('')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  // Add form
  const [addForm, setAddForm] = useState({
    patientId: '',
    diagCode: '',
    diagDesc: '',
    notes: '',
    medications: [{ ...emptyMed }],
  })

  // Update form
  const [updateForm, setUpdateForm] = useState({
    patientId: '',
    recordId: '',
    diagCode: '',
    diagDesc: '',
    notes: '',
    medications: [{ ...emptyMed }],
  })
  const [patientRecords, setPatientRecords] = useState([])
  const [loadingPatientRecords, setLoadingPatientRecords] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    getMyPatients({ userId: user.userId })
      .then(res => setMyPatients(res.data.data || []))
      .catch(() => {})
  }, [])

  // Khi đổi patientId → tự load danh sách records để chọn
  useEffect(() => {
    if (!updateForm.patientId.trim()) {
      setPatientRecords([])
      setUpdateForm(prev => ({ ...prev, recordId: '', diagCode: '', diagDesc: '', notes: '', medications: [{ ...emptyMed }] }))
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoadingPatientRecords(true)
      try {
        const res = await getAllRecordsByPatientId({ userId: user.userId, patientId: updateForm.patientId })
        const raw = res.data?.data
        const data = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || [])
        setPatientRecords(data)
        if (data.length === 0) toast.info('Bệnh nhân chưa có hồ sơ nào')
      } catch {
        setPatientRecords([])
      } finally {
        setLoadingPatientRecords(false)
      }
    }, 500)
  }, [updateForm.patientId])

  // Khi chọn record từ dropdown → điền sẵn toàn bộ form
  const handleSelectRecord = (recordId) => {
    if (!recordId) {
      setUpdateForm(prev => ({ ...prev, recordId: '', diagCode: '', diagDesc: '', notes: '', medications: [{ ...emptyMed }] }))
      return
    }
    const record = patientRecords.find(r => r.recordId === recordId)
    if (!record) return
    const diag = typeof record.diagnosis === 'string' ? JSON.parse(record.diagnosis) : record.diagnosis
    const pres = typeof record.prescription === 'string' ? JSON.parse(record.prescription) : record.prescription
    setUpdateForm(prev => ({
      ...prev,
      recordId: record.recordId,
      diagCode: diag?.primary?.icdCode || '',
      diagDesc: diag?.primary?.description || '',
      notes: diag?.notes || '',
      medications: pres?.medications?.map(m => ({
        code: m.drugCode || '',
        name: m.drugName || '',
        strength: String(m.strength || ''),
        unit: m.unit || 'mg',
        quantity: String(m.dosage?.quantity || '1'),
        frequency: String(m.dosage?.frequency || ''),
        route: m.dosage?.route || 'oral',
        timing: m.dosage?.timing || '',
        duration: m.dosage?.duration ? String(m.dosage.duration) : '',
        durationUnit: m.dosage?.durationUnit || 'days',
      })) || [{ ...emptyMed }],
    }))
  }

  // Build JSON from form fields
  const buildDiagnosis = (form) =>
    JSON.stringify({
      primary: { icdCode: form.diagCode, description: form.diagDesc },
      ...(form.notes ? { notes: form.notes } : {}),
    })

  const buildPrescription = (meds) =>
    JSON.stringify({
      medications: meds
        .filter((m) => m.name)
        .map((m) => ({
          drugCode: m.code,
          drugName: m.name,
          strength: Number(m.strength),
          unit: m.unit,
          dosage: {
            quantity: Number(m.quantity) || 1,
            frequency: Number(m.frequency),
            route: m.route,
            ...(m.timing ? { timing: m.timing } : {}),
            ...(m.duration ? { duration: Number(m.duration), durationUnit: m.durationUnit || 'days' } : {}),
          },
        })),
    })

  // Medication helpers
  const addMed = (formType) => {
    if (formType === 'add') {
      setAddForm({ ...addForm, medications: [...addForm.medications, { ...emptyMed }] })
    } else {
      setUpdateForm({ ...updateForm, medications: [...updateForm.medications, { ...emptyMed }] })
    }
  }

  const removeMed = (formType, index) => {
    if (formType === 'add') {
      setAddForm({ ...addForm, medications: addForm.medications.filter((_, i) => i !== index) })
    } else {
      setUpdateForm({ ...updateForm, medications: updateForm.medications.filter((_, i) => i !== index) })
    }
  }

  const updateMed = (formType, index, field, value) => {
    if (formType === 'add') {
      const meds = [...addForm.medications]
      meds[index] = { ...meds[index], [field]: value }
      setAddForm({ ...addForm, medications: meds })
    } else {
      const meds = [...updateForm.medications]
      meds[index] = { ...meds[index], [field]: value }
      setUpdateForm({ ...updateForm, medications: meds })
    }
  }

  const handleAddRecord = async (e) => {
    e.preventDefault()
    if (!addForm.diagCode || !addForm.diagDesc) {
      return toast.error('Vui lòng nhập mã ICD-10 và mô tả chẩn đoán')
    }
    if (!addForm.medications.some((m) => m.name)) {
      return toast.error('Vui lòng nhập ít nhất một loại thuốc')
    }
    setLoading(true)
    try {
      const diagnosis = buildDiagnosis(addForm)
      const prescription = buildPrescription(addForm.medications)
      const res = await addRecord({
        userId: user.userId,
        patientId: addForm.patientId,
        diagnosis,
        prescription,
      })
      if (res.data.success || res.data.data) {
        toast.success('Thêm bệnh án thành công!')
        setAddForm({
          patientId: '',
          diagCode: '',
          diagDesc: '',
          notes: '',
          medications: [{ ...emptyMed }],
        })
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRecord = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const diagnosis = buildDiagnosis(updateForm)
      const prescription = buildPrescription(updateForm.medications)
      const res = await updateRecord({
        userId: user.userId,
        patientId: updateForm.patientId,
        recordId: updateForm.recordId,
        diagnosis,
        prescription,
      })
      if (res.data.success || res.data.data) {
        toast.success('Cập nhật bệnh án thành công!')
        setUpdateForm({
          patientId: '',
          recordId: '',
          diagCode: '',
          diagDesc: '',
          notes: '',
          medications: [{ ...emptyMed }],
        })
        setPatientRecords([])
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchId.trim()) return
    setLoading(true)
    try {
      const res = await getAllRecordsByPatientId({
        userId: user.userId,
        patientId: searchId,
      })
      const raw = res.data.data
      const data = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || [])
      setRecords(data)
      if (data.length === 0) toast.info('Không tìm thấy hồ sơ')
    } catch (err) {
      toast.error('Lỗi truy vấn')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'add', label: 'Thêm bệnh án', icon: FiPlus },
    { id: 'update', label: 'Cập nhật', icon: FiEdit },
    { id: 'search', label: 'Tra cứu', icon: FiSearch },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bảng điều khiển Bác sĩ</h1>
        <p className="text-gray-500 mt-1">Quản lý hồ sơ bệnh án bệnh nhân</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === id ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon /> {label}
          </button>
        ))}
      </div>

      {/* Add Record */}
      {activeTab === 'add' && (
        <div className="card max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Thêm bệnh án mới</h2>
          <form onSubmit={handleAddRecord} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID *</label>
              <PatientIdInput value={addForm.patientId} onChange={(v) => setAddForm({ ...addForm, patientId: v })} patients={myPatients} />
            </div>

            <hr className="border-gray-200" />
            <DiagnosisFields form={addForm} setForm={setAddForm} />

            <hr className="border-gray-200" />
            <MedicationFields medications={addForm.medications} formType="add" onAdd={addMed} onRemove={removeMed} onUpdate={updateMed} />

            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiPlus />}
              Thêm bệnh án
            </button>
          </form>
        </div>
      )}

      {/* Update Record */}
      {activeTab === 'update' && (
        <div className="card max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Cập nhật bệnh án</h2>
          <form onSubmit={handleUpdateRecord} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID *</label>
                <PatientIdInput value={updateForm.patientId} onChange={(v) => setUpdateForm({ ...updateForm, patientId: v })} patients={myPatients} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn hồ sơ *</label>
                <div className="relative">
                  <select
                    value={updateForm.recordId}
                    onChange={(e) => handleSelectRecord(e.target.value)}
                    className="input-field appearance-none pr-8"
                    required
                    disabled={!updateForm.patientId || loadingPatientRecords}
                  >
                    <option value="">
                      {loadingPatientRecords
                        ? 'Đang tải...'
                        : !updateForm.patientId
                        ? '-- Chọn bệnh nhân trước --'
                        : patientRecords.length === 0
                        ? '-- Không có hồ sơ --'
                        : '-- Chọn hồ sơ --'}
                    </option>
                    {patientRecords.map((r) => {
                      const diag = typeof r.diagnosis === 'string' ? JSON.parse(r.diagnosis) : r.diagnosis
                      const date = r.timestamp ? new Date(r.timestamp).toLocaleDateString('vi-VN') : ''
                      const icd = diag?.primary?.icdCode || ''
                      const desc = diag?.primary?.description || ''
                      return (
                        <option key={r.recordId} value={r.recordId}>
                          {date} — {icd}{desc ? ` · ${desc}` : ''}
                        </option>
                      )
                    })}
                  </select>
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    {loadingPatientRecords
                      ? <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                      : <FiChevronDown />}
                  </div>
                </div>
              </div>
            </div>

            {updateForm.recordId && (
              <>
                <hr className="border-gray-200" />
                <DiagnosisFields form={updateForm} setForm={setUpdateForm} />

                <hr className="border-gray-200" />
                <MedicationFields medications={updateForm.medications} formType="update" onAdd={addMed} onRemove={removeMed} onUpdate={updateMed} />

                <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiEdit />}
                  Cập nhật
                </button>
              </>
            )}
          </form>
        </div>
      )}

      {/* Search Records */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="card max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">Tra cứu hồ sơ bệnh nhân</h2>
            <div className="flex gap-3">
              <PatientIdInput
                value={searchId}
                onChange={setSearchId}
                patients={myPatients}
                placeholder="Nhập Patient ID"
              />
              <button onClick={handleSearch} disabled={loading} className="btn-primary flex items-center gap-2 whitespace-nowrap">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <FiSearch />}
                Tìm
              </button>
            </div>
          </div>

          {records.length > 0 && (
            <div className="space-y-3 max-w-2xl">
              <p className="text-sm text-gray-500">{records.length} hồ sơ tìm thấy</p>
              {records.map((r, i) => {
                const record = r.Value || r
                const diag = (() => { try { return typeof record.diagnosis === 'string' ? JSON.parse(record.diagnosis) : record.diagnosis } catch { return null } })()
                const pres = (() => { try { return typeof record.prescription === 'string' ? JSON.parse(record.prescription) : record.prescription } catch { return null } })()
                const date = record.timestamp ? new Date(record.timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null
                const time = record.timestamp ? new Date(record.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : null
                const meds = pres?.medications || []

                return (
                  <div key={i} className="card space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FiFileText className="text-primary-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {diag?.primary?.icdCode
                              ? <span className="inline-flex items-center gap-1"><span className="bg-blue-100 text-blue-700 text-xs font-mono px-1.5 py-0.5 rounded">{diag.primary.icdCode}</span> {diag.primary.description}</span>
                              : 'Không có chẩn đoán'}
                          </p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{record.recordId || r.Key}</p>
                        </div>
                      </div>
                      {date && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                          <FiCalendar className="text-xs" /> {date}
                          {time && <><FiClock className="text-xs ml-1" /> {time}</>}
                        </div>
                      )}
                    </div>

                    {/* Diagnosis notes */}
                    {diag?.notes && (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border-l-4 border-blue-200">
                        {diag.notes}
                      </p>
                    )}

                    {/* Secondary diagnoses */}
                    {diag?.secondary?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-xs text-gray-500 self-center">Chẩn đoán phụ:</span>
                        {diag.secondary.map((s, si) => (
                          <span key={si} className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">
                            <span className="font-mono">{s.icdCode}</span> {s.description}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Medications */}
                    {meds.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          <FiPackage className="text-xs" /> Đơn thuốc ({meds.length})
                        </div>
                        <div className="space-y-2">
                          {meds.map((med, mi) => (
                            <div key={mi} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-gray-800 text-sm">{med.drugName}</span>
                                  <span className="text-xs text-gray-500">{med.strength}{med.unit}</span>
                                  {med.drugCode && <span className="font-mono text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{med.drugCode}</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                                  {med.dosage?.quantity && <span>{med.dosage.quantity} viên/lần</span>}
                                  {med.dosage?.frequency && <span>{med.dosage.frequency} lần/ngày</span>}
                                  {med.dosage?.route && <span>{med.dosage.route}</span>}
                                  {med.dosage?.timing && <span>{timingOptions.find(t => t.value === med.dosage.timing)?.label || med.dosage.timing}</span>}
                                  {med.dosage?.duration && <span>{med.dosage.duration} {med.dosage.durationUnit === 'weeks' ? 'tuần' : med.dosage.durationUnit === 'months' ? 'tháng' : 'ngày'}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-4 text-xs text-gray-400 pt-1 border-t border-gray-100">
                      {record.doctorId && <span className="flex items-center gap-1"><FiUser className="text-xs" /> {record.doctorId}</span>}
                      {record.hospitalId && <span className="flex items-center gap-1"><FiActivity className="text-xs" /> {record.hospitalId}</span>}
                      {record.version && <span>v{record.version}</span>}
                      {record.updatedAt && record.updatedAt !== record.timestamp && (
                        <span>Cập nhật: {new Date(record.updatedAt).toLocaleDateString('vi-VN')}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
