import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { grantAccess, revokeAccess, getPatientById, getAllDoctors } from '../services/api'
import { toast } from 'react-toastify'
import { FiShield, FiUserCheck, FiUserX, FiUser, FiRefreshCw, FiSearch, FiActivity, FiMapPin } from 'react-icons/fi'

export default function AccessControl() {
  const { user } = useAuth()
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [searchName, setSearchName] = useState('')
  const [loading, setLoading] = useState(false)
  const [authorizedDoctors, setAuthorizedDoctors] = useState([])
  const [allDoctors, setAllDoctors] = useState([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoadingData(true)
    try {
      const [patientRes, doctorsRes] = await Promise.allSettled([
        getPatientById({ userId: user.userId, patientId: user.userId }),
        getAllDoctors({ userId: user.userId, hospitalId: '' }),
      ])

      if (patientRes.status === 'fulfilled') {
        const raw = patientRes.value.data.data
        const patientData = typeof raw === 'string' ? JSON.parse(raw) : (raw || {})
        setAuthorizedDoctors(patientData.authorizedDoctors || [])
      }

      if (doctorsRes.status === 'fulfilled') {
        const raw = doctorsRes.value.data.data
        setAllDoctors(Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : []))
      }
    } catch {
      toast.error('Không tải được dữ liệu')
    } finally {
      setLoadingData(false)
    }
  }

  // Doctors chua duoc cap quyen, loc theo ten
  const availableDoctors = allDoctors.filter(d =>
    !authorizedDoctors.includes(d.doctorId) &&
    (!searchName || (d.name || d.doctorId).toLowerCase().includes(searchName.toLowerCase()))
  )

  // Doctor info tu ID
  const getDoctorName = (id) => {
    const doc = allDoctors.find(d => d.doctorId === id)
    return doc?.name || id
  }

  const handleGrant = async (doctorId) => {
    setLoading(true)
    try {
      const res = await grantAccess({ userId: user.userId, patientId: user.userId, doctorIdToGrant: doctorId })
      if (res.data.success || res.data.data) {
        toast.success(`Đã cấp quyền cho ${getDoctorName(doctorId)}`)
        setSelectedDoctorId('')
        setSearchName('')
        loadData()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (doctorId) => {
    setLoading(true)
    try {
      const res = await revokeAccess({ userId: user.userId, patientId: user.userId, doctorIdToRevoke: doctorId })
      if (res.data.success || res.data.data) {
        toast.success(`Đã thu hồi quyền của ${getDoctorName(doctorId)}`)
        loadData()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Quản lý quyền truy cập</h1>
        <p className="text-gray-500 mt-0.5">Cấp hoặc thu hồi quyền truy cập hồ sơ cho bác sĩ</p>
      </div>

      {/* Authorized doctors */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <FiUserCheck className="text-green-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Bác sĩ đã được cấp quyền</h2>
              <p className="text-xs text-gray-400">{authorizedDoctors.length} bác sĩ</p>
            </div>
          </div>
          <button onClick={loadData} className="text-gray-400 hover:text-gray-600">
            <FiRefreshCw className="text-sm" />
          </button>
        </div>

        {authorizedDoctors.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Chưa cấp quyền cho bác sĩ nào</p>
        ) : (
          <div className="space-y-2">
            {authorizedDoctors.map((id) => {
              const doc = allDoctors.find(d => d.doctorId === id)
              return (
                <div key={id} className="flex items-center justify-between px-3 py-2 bg-green-50 rounded-xl border border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
                      <FiActivity className="text-green-600 text-sm" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{doc?.name || id}</p>
                      <p className="text-xs text-gray-400 font-mono">{id}</p>
                    </div>
                    {doc?.city && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <FiMapPin className="text-[10px]" />{doc.city}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRevoke(id)}
                    disabled={loading}
                    className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <FiUserX className="text-xs" /> Thu hồi
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Grant access - chon bac si */}
      <div className="card">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
            <FiShield className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Cấp quyền cho bác sĩ</h2>
            <p className="text-xs text-gray-400">Tìm và chọn bác sĩ để cấp quyền xem hồ sơ</p>
          </div>
        </div>

        <div className="relative mb-3">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="input-field pl-10"
            placeholder="Tìm bác sĩ theo tên..."
          />
        </div>

        {availableDoctors.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            {searchName ? 'Không tìm thấy bác sĩ' : allDoctors.length === 0 ? 'Chưa có bác sĩ nào trong hệ thống' : 'Tất cả bác sĩ đã được cấp quyền'}
          </p>
        ) : (
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
            {availableDoctors.map((doc, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center">
                    <FiActivity className="text-purple-600 text-sm" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.name || doc.doctorId}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="font-mono">{doc.doctorId}</span>
                      {doc.city && (
                        <span className="flex items-center gap-0.5">
                          <FiMapPin className="text-[10px]" />{doc.city}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleGrant(doc.doctorId)}
                  disabled={loading}
                  className="btn-success text-xs py-1.5 px-3 flex items-center gap-1"
                >
                  <FiUserCheck className="text-xs" /> Cấp quyền
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card bg-blue-50 border-blue-100">
        <h3 className="font-medium text-blue-900 mb-1.5">Lưu ý về quyền truy cập</h3>
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
