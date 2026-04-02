import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerPatient } from '../services/api'
import { toast } from 'react-toastify'
import { FiActivity, FiUser, FiUserPlus, FiCalendar, FiMapPin } from 'react-icons/fi'

export default function Register() {
  const [form, setForm] = useState({
    adminId: '',
    doctorId: '',
    patientId: '',
    name: '',
    dob: '',
    city: '',
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.adminId || !form.doctorId || !form.patientId || !form.name) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc')
      return
    }
    setLoading(true)
    try {
      const res = await registerPatient({
        adminId: form.adminId,
        doctorId: form.doctorId,
        patientId: form.patientId,
        args: [form.patientId, form.name, form.dob, form.city],
      })
      if (res.data.result) {
        toast.success('Đăng ký thành công! Vui lòng đăng nhập.')
        navigate('/login')
      } else {
        toast.error(res.data.error || 'Đăng ký thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const update = (key, value) => setForm({ ...form, [key]: value })

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiActivity className="text-white text-3xl" />
          </div>
          <h1 className="text-3xl font-bold text-white">Đăng ký</h1>
          <p className="text-primary-200 mt-2">Tạo tài khoản bệnh nhân mới</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin ID *</label>
                <input type="text" value={form.adminId} onChange={(e) => update('adminId', e.target.value)} className="input-field" placeholder="admin1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doctor ID *</label>
                <input type="text" value={form.doctorId} onChange={(e) => update('doctorId', e.target.value)} className="input-field" placeholder="doctor1" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID *</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={form.patientId} onChange={(e) => update('patientId', e.target.value)} className="input-field pl-10" placeholder="patient001" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên *</label>
              <div className="relative">
                <FiUserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} className="input-field pl-10" placeholder="Nguyễn Văn A" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="date" value={form.dob} onChange={(e) => update('dob', e.target.value)} className="input-field pl-10" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thành phố</label>
              <div className="relative">
                <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={form.city} onChange={(e) => update('city', e.target.value)} className="input-field pl-10" placeholder="TP. Hồ Chí Minh" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FiUserPlus />
                  Đăng ký
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
