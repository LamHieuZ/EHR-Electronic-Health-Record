import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { addRecord, updateRecord, getAllRecordsByPatientId } from '../services/api'
import { toast } from 'react-toastify'
import { FiPlus, FiSearch, FiEdit, FiFileText, FiTrash2 } from 'react-icons/fi'

const severityOptions = [
  { value: 'mild', label: 'Nhẹ' },
  { value: 'moderate', label: 'Trung bình' },
  { value: 'severe', label: 'Nặng' },
  { value: 'critical', label: 'Nguy kịch' },
]

const emptyMed = { code: '', name: '', dosage: '', unit: 'mg', frequency: '', route: 'oral' }

const routeOptions = [
  { value: 'oral', label: 'Uống' },
  { value: 'IV', label: 'Tiêm tĩnh mạch (IV)' },
  { value: 'IM', label: 'Tiêm bắp (IM)' },
  { value: 'subcutaneous', label: 'Tiêm dưới da' },
  { value: 'topical', label: 'Bôi ngoài da' },
  { value: 'inhalation', label: 'Hít' },
]

export default function DoctorDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('add')
  const [searchId, setSearchId] = useState('')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  // Add form
  const [addForm, setAddForm] = useState({
    patientId: '',
    diagCode: '',
    diagDesc: '',
    diagSeverity: 'moderate',
    notes: '',
    medications: [{ ...emptyMed }],
  })

  // Update form
  const [updateForm, setUpdateForm] = useState({
    patientId: '',
    recordId: '',
    diagCode: '',
    diagDesc: '',
    diagSeverity: 'moderate',
    notes: '',
    medications: [{ ...emptyMed }],
  })

  // Build JSON from form fields
  const buildDiagnosis = (form) =>
    JSON.stringify({
      code: form.diagCode,
      description: form.diagDesc,
      severity: form.diagSeverity,
      ...(form.notes ? { notes: form.notes } : {}),
    })

  const buildPrescription = (meds) =>
    JSON.stringify(
      meds
        .filter((m) => m.name)
        .map((m) => ({
          code: m.code,
          name: m.name,
          dosage: `${m.dosage}${m.unit}`,
          frequency: m.frequency,
          route: m.route,
        }))
    )

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
          diagSeverity: 'moderate',
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
          diagSeverity: 'moderate',
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

  // Reusable diagnosis fields
  const DiagnosisFields = ({ form, setForm }) => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Chẩn đoán</h3>
      <div className="grid grid-cols-2 gap-4">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Mức độ *</label>
          <select
            value={form.diagSeverity}
            onChange={(e) => setForm({ ...form, diagSeverity: e.target.value })}
            className="input-field"
          >
            {severityOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
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

  // Reusable medication fields
  const MedicationFields = ({ medications, formType }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Đơn thuốc</h3>
        <button
          type="button"
          onClick={() => addMed(formType)}
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
              <button type="button" onClick={() => removeMed(formType, i)} className="text-red-400 hover:text-red-600">
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
                onChange={(e) => updateMed(formType, i, 'code', e.target.value.toUpperCase())}
                className="input-field text-sm"
                placeholder="VD: N02BE01"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tên thuốc *</label>
              <input
                type="text"
                value={med.name}
                onChange={(e) => updateMed(formType, i, 'name', e.target.value)}
                className="input-field text-sm"
                placeholder="VD: Paracetamol"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Liều lượng *</label>
              <div className="flex">
                <input
                  type="text"
                  value={med.dosage}
                  onChange={(e) => updateMed(formType, i, 'dosage', e.target.value)}
                  className="input-field text-sm rounded-r-none flex-1"
                  placeholder="500"
                  required
                />
                <select
                  value={med.unit}
                  onChange={(e) => updateMed(formType, i, 'unit', e.target.value)}
                  className="input-field text-sm rounded-l-none border-l-0 w-20"
                >
                  <option value="mg">mg</option>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="mcg">mcg</option>
                  <option value="IU">IU</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tần suất *</label>
              <input
                type="text"
                value={med.frequency}
                onChange={(e) => updateMed(formType, i, 'frequency', e.target.value)}
                className="input-field text-sm"
                placeholder="3 lần/ngày"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Đường dùng</label>
              <select
                value={med.route}
                onChange={(e) => updateMed(formType, i, 'route', e.target.value)}
                className="input-field text-sm"
              >
                {routeOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

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
              <input type="text" value={addForm.patientId} onChange={(e) => setAddForm({ ...addForm, patientId: e.target.value })} className="input-field" placeholder="patient001" required />
            </div>

            <hr className="border-gray-200" />
            <DiagnosisFields form={addForm} setForm={setAddForm} />

            <hr className="border-gray-200" />
            <MedicationFields medications={addForm.medications} formType="add" />

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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID *</label>
                <input type="text" value={updateForm.patientId} onChange={(e) => setUpdateForm({ ...updateForm, patientId: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Record ID *</label>
                <input type="text" value={updateForm.recordId} onChange={(e) => setUpdateForm({ ...updateForm, recordId: e.target.value })} className="input-field" required />
              </div>
            </div>

            <hr className="border-gray-200" />
            <DiagnosisFields form={updateForm} setForm={setUpdateForm} />

            <hr className="border-gray-200" />
            <MedicationFields medications={updateForm.medications} formType="update" />

            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiEdit />}
              Cập nhật
            </button>
          </form>
        </div>
      )}

      {/* Search Records */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="card max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">Tra cứu hồ sơ bệnh nhân</h2>
            <div className="flex gap-3">
              <input type="text" value={searchId} onChange={(e) => setSearchId(e.target.value)} className="input-field flex-1" placeholder="Nhập Patient ID" onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              <button onClick={handleSearch} disabled={loading} className="btn-primary flex items-center gap-2">
                <FiSearch /> Tìm
              </button>
            </div>
          </div>

          {records.length > 0 && (
            <div className="space-y-3">
              {records.map((record, i) => (
                <div key={i} className="card">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FiFileText className="text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">Record: {record.Key || 'N/A'}</p>
                      <pre className="text-sm text-gray-600 mt-2 bg-gray-50 p-3 rounded-lg overflow-x-auto">
                        {JSON.stringify(record.Value || record, null, 2)}
                      </pre>
                    </div>
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
