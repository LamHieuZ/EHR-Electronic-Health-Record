import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loginPatient } from '../services/api'
import { toast } from 'react-toastify'
import { FiActivity, FiUser, FiLock, FiArrowRight } from 'react-icons/fi'

export default function Login() {
  const [form, setForm] = useState({ userId: '', role: 'patient' })
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const roles = [
    { value: 'patient', label: 'Bệnh nhân' },
    { value: 'doctor', label: 'Bác sĩ' },
    { value: 'admin', label: 'Quản trị viên' },
    { value: 'hospital', label: 'Bệnh viện' },
    { value: 'pharmacy', label: 'Nhà thuốc' },
    { value: 'insurance', label: 'Bảo hiểm' },
    { value: 'researcher', label: 'Nghiên cứu' },
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.userId.trim()) {
      toast.error('Vui lòng nhập User ID')
      return
    }
    setLoading(true)
    try {
      const res = await loginPatient({ userId: form.userId })
      if (res.data.result) {
        login({ userId: form.userId, role: form.role })
        toast.success('Đăng nhập thành công!')
        navigate('/')
      } else {
        toast.error(res.data.error || 'Đăng nhập thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi kết nối server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiActivity className="text-white text-3xl" />
          </div>
          <h1 className="text-3xl font-bold text-white">EHR Blockchain</h1>
          <p className="text-primary-200 mt-2">Hệ thống Hồ Sơ Sức Khỏe Điện Tử</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Đăng nhập</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  className="input-field pl-10"
                  placeholder="Nhập User ID"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="input-field"
              >
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Đăng nhập
                  <FiArrowRight />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Đăng ký
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
