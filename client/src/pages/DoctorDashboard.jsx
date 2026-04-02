import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { addRecord, updateRecord, getAllRecordsByPatientId } from '../services/api'
import { toast } from 'react-toastify'
import { FiPlus, FiSearch, FiEdit, FiFileText } from 'react-icons/fi'

export default function DoctorDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('add')
  const [searchId, setSearchId] = useState('')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  const [addForm, setAddForm] = useState({
    patientId: '',
    diagnosis: '',
    prescription: '',
  })

  const [updateForm, setUpdateForm] = useState({
    patientId: '',
    recordId: '',
    diagnosis: '',
    prescription: '',
  })

  const handleAddRecord = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await addRecord({
        userId: user.userId,
        args: [addForm.patientId, addForm.diagnosis, addForm.prescription],
      })
      if (res.data.result) {
        toast.success('Thêm bệnh án thành công!')
        setAddForm({ patientId: '', diagnosis: '', prescription: '' })
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
      const res = await updateRecord({
        userId: user.userId,
        args: [updateForm.patientId, updateForm.recordId, updateForm.diagnosis, updateForm.prescription],
      })
      if (res.data.result) {
        toast.success('Cập nhật bệnh án thành công!')
        setUpdateForm({ patientId: '', recordId: '', diagnosis: '', prescription: '' })
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
        args: [searchId],
      })
      const data = JSON.parse(res.data.result || '[]')
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
          <form onSubmit={handleAddRecord} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
              <input type="text" value={addForm.patientId} onChange={(e) => setAddForm({ ...addForm, patientId: e.target.value })} className="input-field" placeholder="patient001" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chẩn đoán (ICD-10 JSON)</label>
              <textarea value={addForm.diagnosis} onChange={(e) => setAddForm({ ...addForm, diagnosis: e.target.value })} className="input-field h-32 font-mono text-sm" placeholder='{"code":"J11","description":"Influenza","severity":"moderate"}' required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Đơn thuốc (ATC JSON)</label>
              <textarea value={addForm.prescription} onChange={(e) => setAddForm({ ...addForm, prescription: e.target.value })} className="input-field h-32 font-mono text-sm" placeholder='[{"code":"N02BE01","name":"Paracetamol","dosage":"500mg","frequency":"3 times/day"}]' required />
            </div>
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
          <form onSubmit={handleUpdateRecord} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
                <input type="text" value={updateForm.patientId} onChange={(e) => setUpdateForm({ ...updateForm, patientId: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Record ID</label>
                <input type="text" value={updateForm.recordId} onChange={(e) => setUpdateForm({ ...updateForm, recordId: e.target.value })} className="input-field" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chẩn đoán mới</label>
              <textarea value={updateForm.diagnosis} onChange={(e) => setUpdateForm({ ...updateForm, diagnosis: e.target.value })} className="input-field h-32 font-mono text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Đơn thuốc mới</label>
              <textarea value={updateForm.prescription} onChange={(e) => setUpdateForm({ ...updateForm, prescription: e.target.value })} className="input-field h-32 font-mono text-sm" required />
            </div>
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
