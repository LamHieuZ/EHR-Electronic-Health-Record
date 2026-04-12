import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loginPatient, getPatientById, getAllDoctors, getAllHospitals } from '../services/api'
import { toast } from 'react-toastify'
import { FiActivity, FiUser, FiArrowRight, FiShield, FiLock } from 'react-icons/fi'

export default function Login() {
  const [form, setForm] = useState({ userId: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.userId.trim()) {
      toast.error('Vui long nhap User ID')
      return
    }
    setLoading(true)
    try {
      const res = await loginPatient({ userId: form.userId.trim(), password: form.password })
      if (res.data.userID) {
        const userData = { userId: res.data.userID, role: res.data.role }
        try {
          const id = res.data.userID
          const role = res.data.role
          if (role === 'patient') {
            const pRes = await getPatientById({ userId: id, patientId: id })
            const p = typeof pRes.data?.data === 'string' ? JSON.parse(pRes.data.data) : pRes.data?.data
            if (p?.name) userData.name = p.name
          } else if (role === 'doctor') {
            const dRes = await getAllDoctors({ userId: id, hospitalId: '' })
            const docs = typeof dRes.data?.data === 'string' ? JSON.parse(dRes.data.data) : dRes.data?.data
            const doc = Array.isArray(docs) && docs.find(d => d.doctorId === id)
            if (doc?.name) userData.name = doc.name
          } else if (role === 'hospital') {
            const hRes = await getAllHospitals({ userId: id })
            const hospitals = typeof hRes.data?.data === 'string' ? JSON.parse(hRes.data.data) : hRes.data?.data
            const h = Array.isArray(hospitals) && hospitals.find(h => h.hospitalId === id)
            if (h?.name) userData.name = h.name
          }
        } catch { /* ignore - fallback to userId */ }
        login(userData)
        toast.success('Dang nhap thanh cong!')
        navigate('/')
      } else {
        toast.error(res.data.message || 'Dang nhap that bai')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Loi ket noi server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar-light to-primary-950 animate-gradient" style={{ backgroundSize: '200% 200%' }} />

      {/* Mesh overlay */}
      <div className="absolute inset-0 bg-mesh opacity-50" />

      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary-500/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float-delayed" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-400/5 rounded-full blur-3xl" />

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        {/* Header */}
        <div className="text-center mb-5 animate-slide-up">
          <div className="relative inline-flex">
            <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-glow-lg">
              <FiActivity className="text-white text-2xl" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg border-2 border-sidebar">
              <FiShield className="text-white text-xs" />
            </div>
          </div>
          <h1 className="text-xl font-extrabold text-white mt-4 tracking-tight">EHR Blockchain</h1>
          <p className="text-gray-400 mt-1 font-medium">He thong Ho So Suc Khoe Dien Tu</p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-gray-600" />
            <span className="text-xs text-gray-500 font-medium uppercase tracking-widest">Hyperledger Fabric</span>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-gray-600" />
          </div>
        </div>

        {/* Form */}
        <div className="relative">
          <div className="absolute -inset-px bg-gradient-to-b from-white/20 to-white/5 rounded-3xl" />
          <div className="relative glass-dark rounded-3xl shadow-glass-lg p-6">
            <h2 className="text-lg font-bold text-white mb-1">Dang nhap</h2>
            <p className="text-sm text-gray-400 mb-4">Nhap User ID va mat khau de truy cap</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">User ID</label>
                <div className="relative group">
                  <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                  <input
                    type="text"
                    value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/40 focus:bg-white/10 transition-all duration-200"
                    placeholder="VD: Patient01, Doctor01..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mat khau</label>
                <div className="relative group">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/40 focus:bg-white/10 transition-all duration-200"
                    placeholder="Nhap mat khau"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:from-primary-600 hover:to-primary-700 hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Dang nhap
                    <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-transparent text-xs text-gray-500">hoac</span>
              </div>
            </div>

            <Link
              to="/register"
              className="block w-full text-center py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all duration-200 text-sm font-medium"
            >
              Tao tai khoan benh nhan moi
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-6">
          Bao mat boi Hyperledger Fabric &middot; X.509 Certificate
        </p>
      </div>
    </div>
  )
}
