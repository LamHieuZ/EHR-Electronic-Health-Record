import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { grantAccess, revokeAccess, getPatientById } from '../services/api'
import { toast } from 'react-toastify'
import { FiShield, FiUserCheck, FiUserX, FiUser, FiRefreshCw } from 'react-icons/fi'

export default function AccessControl() {
  const { user } = useAuth()
  const [doctorId, setDoctorId] = useState('')
  const [loading, setLoading] = useState(false)
  const [authorizedDoctors, setAuthorizedDoctors] = useState([])
  const [loadingDoctors, setLoadingDoctors] = useState(false)

  useEffect(() => {
    loadAuthorizedDoctors()
  }, [])

  const loadAuthorizedDoctors = async () => {
    setLoadingDoctors(true)
    try {
      const res = await getPatientById({ userId: user.userId, patientId: user.userId })
      const raw = res.data.data
      const patientData = typeof raw === 'string' ? JSON.parse(raw) : (raw || {})
      setAuthorizedDoctors(patientData.authorizedDoctors || [])
    } catch (err) {
      console.error('loadAuthorizedDoctors error:', err?.response?.data || err?.message)
      toast.error('Không tải được danh sách bác sĩ')
    } finally {
      setLoadingDoctors(false)
    }
  }

  const handleGrant = async () => {
    if (!doctorId.trim()) return toast.error('Vui lòng nhập Doctor ID')
    setLoading(true)
    try {
      const res = await grantAccess({ userId: user.userId, patientId: user.userId, doctorIdToGrant: doctorId })
      if (res.data.success || res.data.data) {
        toast.success(`Đã cấp quyền cho bác sĩ ${doctorId}`)
        setDoctorId('')
        loadAuthorizedDoctors()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async () => {
    if (!doctorId.trim()) return toast.error('Vui lòng nhập Doctor ID')
    setLoading(true)
    try {
      const res = await revokeAccess({ userId: user.userId, patientId: user.userId, doctorIdToRevoke: doctorId })
      if (res.data.success || res.data.data) {
        toast.success(`Đã thu hồi quyền của bác sĩ ${doctorId}`)
        setDoctorId('')
        loadAuthorizedDoctors()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeById = async (id) => {
    setLoading(true)
    try {
      const res = await revokeAccess({ userId: user.userId, patientId: user.userId, doctorIdToRevoke: id })
      if (res.data.success || res.data.data) {
        toast.success(`Đã thu hồi quyền của bác sĩ ${id}`)
        loadAuthorizedDoctors()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quản lý quyền truy cập</h1>
        <p className="text-gray-500 mt-1">Cấp hoặc thu hồi quyền truy cập hồ sơ cho bác sĩ</p>
      </div>

      <div className="card max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
            <FiShield className="text-primary-600 text-xl" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Phân quyền bác sĩ</h2>
            <p className="text-sm text-gray-500">Chỉ bác sĩ được cấp quyền mới có thể xem hồ sơ của bạn</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doctor ID</label>
            <input
              type="text"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="input-field"
              placeholder="Nhập ID bác sĩ"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={handleGrant} disabled={loading} className="btn-success flex-1 flex items-center justify-center gap-2">
              <FiUserCheck /> Cấp quyền
            </button>
            <button onClick={handleRevoke} disabled={loading} className="btn-danger flex-1 flex items-center justify-center gap-2">
              <FiUserX /> Thu hồi
            </button>
          </div>
        </div>
      </div>

      {/* Authorized doctors list */}
      <div className="card max-w-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Bác sĩ đã được cấp quyền</h3>
          <button onClick={loadAuthorizedDoctors} disabled={loadingDoctors} className="text-gray-400 hover:text-gray-600">
            <FiRefreshCw className={`text-sm ${loadingDoctors ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {authorizedDoctors.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Chưa cấp quyền cho bác sĩ nào</p>
        ) : (
          <div className="space-y-2">
            {authorizedDoctors.map((id) => (
              <div key={id} className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2">
                  <FiUser className="text-blue-500 text-sm" />
                  <span className="text-sm font-medium text-blue-700">{id}</span>
                </div>
                <button
                  onClick={() => handleRevokeById(id)}
                  disabled={loading}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <FiUserX className="text-xs" /> Thu hồi
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card max-w-lg bg-blue-50 border-blue-100">
        <h3 className="font-medium text-blue-900 mb-2">Lưu ý về quyền truy cập</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>- Mọi thao tác cấp/thu hồi quyền đều được ghi lại trên blockchain</li>
          <li>- Bác sĩ chỉ xem được hồ sơ khi được bạn cho phép</li>
          <li>- Bạn có thể thu hồi quyền bất cứ lúc nào</li>
          <li>- Trường hợp khẩn cấp, bác sĩ có thể truy cập tạm thời (có ghi log)</li>
        </ul>
      </div>
    </div>
  )
}
