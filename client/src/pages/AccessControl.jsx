import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { grantAccess, revokeAccess } from '../services/api'
import { toast } from 'react-toastify'
import { FiShield, FiUserCheck, FiUserX } from 'react-icons/fi'

export default function AccessControl() {
  const { user } = useAuth()
  const [doctorId, setDoctorId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGrant = async () => {
    if (!doctorId.trim()) return toast.error('Vui lòng nhập Doctor ID')
    setLoading(true)
    try {
      const res = await grantAccess({ userId: user.userId, args: [user.userId, doctorId] })
      if (res.data.result) {
        toast.success(`Đã cấp quyền cho bác sĩ ${doctorId}`)
        setDoctorId('')
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
      const res = await revokeAccess({ userId: user.userId, args: [user.userId, doctorId] })
      if (res.data.result) {
        toast.success(`Đã thu hồi quyền của bác sĩ ${doctorId}`)
        setDoctorId('')
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
