import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { requestConsent, approveConsent, getAnonymizedData } from '../services/api'
import { toast } from 'react-toastify'
import { FiUsers, FiSend, FiCheck, FiX, FiDatabase } from 'react-icons/fi'

export default function ResearchConsent() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  // Researcher: request consent
  const [reqForm, setReqForm] = useState({ patientId: '', purpose: '' })
  // Patient: approve consent
  const [approveForm, setApproveForm] = useState({ requestId: '', approved: true })
  // Researcher: get anonymized data
  const [anonForm, setAnonForm] = useState({ patientId: '' })
  const [anonData, setAnonData] = useState(null)

  const handleRequestConsent = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await requestConsent({ userId: user.userId, args: [user.userId, reqForm.patientId, reqForm.purpose] })
      if (res.data.success || res.data.data) {
        toast.success('Đã gửi yêu cầu đồng ý nghiên cứu!')
        setReqForm({ patientId: '', purpose: '' })
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveConsent = async (approved) => {
    if (!approveForm.requestId.trim()) return toast.error('Nhập Request ID')
    setLoading(true)
    try {
      const res = await approveConsent({ userId: user.userId, args: [user.userId, approveForm.requestId, approved.toString()] })
      if (res.data.success || res.data.data) {
        toast.success(approved ? 'Đã đồng ý!' : 'Đã từ chối!')
        setApproveForm({ requestId: '', approved: true })
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi')
    } finally {
      setLoading(false)
    }
  }

  const handleGetAnonymized = async () => {
    if (!anonForm.patientId.trim()) return
    setLoading(true)
    try {
      const res = await getAnonymizedData({ userId: user.userId, args: [user.userId, anonForm.patientId] })
      setAnonData(JSON.parse(res.data.data || 'null'))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không có quyền hoặc chưa được đồng ý')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nghiên cứu & Đồng ý</h1>
        <p className="text-gray-500 mt-1">
          {user.role === 'researcher' ? 'Yêu cầu đồng ý và truy cập dữ liệu ẩn danh' : 'Quản lý đồng ý chia sẻ dữ liệu nghiên cứu'}
        </p>
      </div>

      {/* Researcher: Request consent */}
      {user.role === 'researcher' && (
        <>
          <div className="card max-w-xl">
            <div className="flex items-center gap-3 mb-4">
              <FiSend className="text-primary-600 text-xl" />
              <h2 className="text-lg font-semibold">Yêu cầu đồng ý</h2>
            </div>
            <form onSubmit={handleRequestConsent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
                <input type="text" value={reqForm.patientId} onChange={(e) => setReqForm({ ...reqForm, patientId: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mục đích nghiên cứu</label>
                <textarea value={reqForm.purpose} onChange={(e) => setReqForm({ ...reqForm, purpose: e.target.value })} className="input-field h-24" placeholder="Mô tả mục đích nghiên cứu..." required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary">Gửi yêu cầu</button>
            </form>
          </div>

          <div className="card max-w-xl">
            <div className="flex items-center gap-3 mb-4">
              <FiDatabase className="text-green-600 text-xl" />
              <h2 className="text-lg font-semibold">Truy cập dữ liệu ẩn danh</h2>
            </div>
            <div className="flex gap-3">
              <input type="text" value={anonForm.patientId} onChange={(e) => setAnonForm({ patientId: e.target.value })} className="input-field flex-1" placeholder="Patient ID" />
              <button onClick={handleGetAnonymized} disabled={loading} className="btn-primary">Truy cập</button>
            </div>
            {anonData && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <pre className="text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(anonData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </>
      )}

      {/* Patient: Approve consent */}
      {user.role === 'patient' && (
        <div className="card max-w-xl">
          <div className="flex items-center gap-3 mb-4">
            <FiUsers className="text-primary-600 text-xl" />
            <h2 className="text-lg font-semibold">Phê duyệt yêu cầu nghiên cứu</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Request ID</label>
              <input type="text" value={approveForm.requestId} onChange={(e) => setApproveForm({ ...approveForm, requestId: e.target.value })} className="input-field" placeholder="Nhập Request ID từ nhà nghiên cứu" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleApproveConsent(true)} disabled={loading} className="btn-success flex items-center gap-2 flex-1">
                <FiCheck /> Đồng ý
              </button>
              <button onClick={() => handleApproveConsent(false)} disabled={loading} className="btn-danger flex items-center gap-2 flex-1">
                <FiX /> Từ chối
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-100">
            <p className="text-sm text-amber-800">
              <strong>Lưu ý:</strong> Khi đồng ý, dữ liệu của bạn sẽ được ẩn danh hóa theo tiêu chuẩn HIPAA trước khi chia sẻ cho nhà nghiên cứu.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
