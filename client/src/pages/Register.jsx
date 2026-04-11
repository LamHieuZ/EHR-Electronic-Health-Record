import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerPatient } from '../services/api'
import { toast } from 'react-toastify'
import { FiActivity, FiUserPlus, FiCalendar, FiMapPin } from 'react-icons/fi'

// Tu dong tao Patient ID tu ten (bo dau, viet thuong, them so ngau nhien)
function generatePatientId(name) {
  const normalized = name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase().trim().replace(/\s+/g, '')
  const suffix = Date.now().toString(36).slice(-4)
  return `P-${normalized.slice(0, 10)}-${suffix}`
}

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    dob: '',
    city: '',
  })
  const [generatedId, setGeneratedId] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) {
      toast.error('Vui lòng nhập họ tên')
      return
    }
    setLoading(true)
    const patientId = generatePatientId(form.name)
    try {
      const res = await registerPatient({
        userId: patientId,
        name: form.name,
        dob: form.dob,
        city: form.city,
      })
      if (res.data.statusCode === 200 || res.data.userID) {
        setGeneratedId(patientId)
        toast.success(`Đăng ký thành công!`, { autoClose: 3000 })
        // Khong redirect ngay, cho benh nhan copy ID
      } else {
        toast.error(res.data.error || 'Đăng ký thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const copyId = () => {
    navigator.clipboard.writeText(generatedId)
    toast.success('Đã copy ID!')
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
          {generatedId ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Đăng ký thành công!</h2>
              <p className="text-sm text-gray-500">Đây là ID đăng nhập của bạn. Hãy ghi nhớ hoặc copy lại.</p>
              <div className="bg-gray-50 rounded-xl p-4 border-2 border-primary-200">
                <p className="text-xs text-gray-400 mb-1">Patient ID</p>
                <p className="text-2xl font-bold font-mono text-primary-700 tracking-wide">{generatedId}</p>
              </div>
              <button onClick={copyId} className="btn-secondary w-full flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy ID
              </button>
              <Link to="/login" className="btn-primary w-full flex items-center justify-center gap-2">
                Đăng nhập ngay
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          ) : (<>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên *</label>
              <div className="relative">
                <FiUserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} className="input-field pl-10" placeholder="Nguyễn Văn A" required />
              </div>
              {form.name.trim().length >= 2 && (
                <p className="text-xs text-gray-400 mt-1">
                  ID sẽ được tạo tự động: <span className="font-mono text-primary-600">{generatePatientId(form.name)}</span>
                </p>
              )}
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
          </>)}
        </div>
      </div>
    </div>
  )
}
