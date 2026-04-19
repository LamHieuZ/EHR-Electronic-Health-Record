import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerPatient } from '../services/api'
import { toast } from 'react-toastify'
import { FiActivity, FiUserPlus, FiCalendar, FiMapPin, FiArrowLeft, FiCopy, FiArrowRight, FiCheck, FiLock, FiChevronDown, FiChevronUp, FiPhone, FiHeart, FiCreditCard } from 'react-icons/fi'

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
    name: '', dob: '', city: '', password: '', confirmPassword: '',
    // Tier 1 fields
    gender: '', phone: '', idCard: '', bhytNumber: '', bloodType: '',
    allergies: '', chronicConditions: ''
  })
  const [generatedId, setGeneratedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showMedical, setShowMedical] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) { toast.error('Vui long nhap ho ten'); return }
    if (!form.password || form.password.length < 4) { toast.error('Mat khau phai co it nhat 4 ky tu'); return }
    if (form.password !== form.confirmPassword) { toast.error('Mat khau xac nhan khong khop'); return }
    setLoading(true)
    const patientId = generatePatientId(form.name)
    try {
      // Parse comma-separated strings thanh array
      const allergies = form.allergies.trim()
        ? form.allergies.split(',').map(s => s.trim()).filter(Boolean) : []
      const chronicConditions = form.chronicConditions.trim()
        ? form.chronicConditions.split(',').map(s => s.trim()).filter(Boolean) : []

      const payload = {
        userId: patientId,
        name: form.name, dob: form.dob, city: form.city,
        password: form.password,
        gender: form.gender || undefined,
        phone: form.phone || undefined,
        idCard: form.idCard || undefined,
        bhytNumber: form.bhytNumber || undefined,
        bloodType: form.bloodType || undefined,
        allergies, chronicConditions
      }
      const res = await registerPatient(payload)
      if (res.data.statusCode === 200 || res.data.userID) {
        setGeneratedId(patientId)
        toast.success('Dang ky thanh cong!', { autoClose: 3000 })
      } else {
        toast.error(res.data.error || 'Dang ky that bai')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Loi ket noi server')
    } finally {
      setLoading(false)
    }
  }

  const copyId = () => {
    navigator.clipboard.writeText(generatedId)
    setCopied(true)
    toast.success('Da copy ID!')
    setTimeout(() => setCopied(false), 2000)
  }

  const update = (key, value) => setForm({ ...form, [key]: value })

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Background matching login */}
      <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar-light to-primary-950 animate-gradient" style={{ backgroundSize: '200% 200%' }} />
      <div className="absolute inset-0 bg-mesh opacity-50" />
      <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/3 left-1/3 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-float-delayed" />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        {/* Header */}
        <div className="text-center mb-5 animate-slide-up">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <FiUserPlus className="text-white text-2xl" />
          </div>
          <h1 className="text-xl font-extrabold text-white mt-4 tracking-tight">Dang ky</h1>
          <p className="text-gray-400 mt-1 font-medium">Tao tai khoan benh nhan moi</p>
        </div>

        {/* Form */}
        <div className="relative">
          <div className="absolute -inset-px bg-gradient-to-b from-white/20 to-white/5 rounded-3xl" />
          <div className="relative glass-dark rounded-3xl shadow-glass-lg p-6">
            {generatedId ? (
              <div className="text-center space-y-4 animate-scale-in">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-glow">
                  <FiCheck className="text-white text-2xl" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Dang ky thanh cong!</h2>
                  <p className="text-sm text-gray-400 mt-1">Hay ghi nho hoac copy ID dang nhap cua ban</p>
                </div>

                <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                  <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Patient ID</p>
                  <p className="text-lg font-bold font-mono text-primary-400 tracking-wider">{generatedId}</p>
                </div>

                <button
                  onClick={copyId}
                  className={`w-full py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                    copied
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {copied ? <FiCheck /> : <FiCopy />}
                  {copied ? 'Da copy!' : 'Copy ID'}
                </button>

                <Link
                  to="/login"
                  className="block w-full text-center py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold hover:from-primary-600 hover:to-primary-700 hover:shadow-glow transition-all duration-300 active:scale-[0.98]"
                >
                  <span className="flex items-center justify-center gap-2">
                    Dang nhap ngay
                    <FiArrowRight />
                  </span>
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Link to="/login" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                    <FiArrowLeft />
                  </Link>
                  <div>
                    <h2 className="text-lg font-bold text-white">Thong tin benh nhan</h2>
                    <p className="text-sm text-gray-400">Dien thong tin de tao tai khoan</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ho ten *</label>
                    <div className="relative group">
                      <FiUserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => update('name', e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/40 focus:bg-white/10 transition-all duration-200"
                        placeholder="Nguyen Van A"
                        required
                      />
                    </div>
                    {form.name.trim().length >= 2 && (
                      <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                        ID tu dong: <span className="font-mono text-primary-400">{generatePatientId(form.name)}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ngay sinh</label>
                    <div className="relative group">
                      <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                      <input
                        type="date"
                        value={form.dob}
                        onChange={(e) => update('dob', e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/40 focus:bg-white/10 transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Thanh pho</label>
                    <div className="relative group">
                      <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                      <input
                        type="text"
                        value={form.city}
                        onChange={(e) => update('city', e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/40 focus:bg-white/10 transition-all duration-200"
                        placeholder="TP. Ho Chi Minh"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Mat khau *</label>
                    <div className="relative group">
                      <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => update('password', e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/40 focus:bg-white/10 transition-all duration-200"
                        placeholder="It nhat 4 ky tu"
                        required
                        minLength={4}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Xac nhan mat khau *</label>
                    <div className="relative group">
                      <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                      <input
                        type="password"
                        value={form.confirmPassword}
                        onChange={(e) => update('confirmPassword', e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/40 focus:bg-white/10 transition-all duration-200"
                        placeholder="Nhap lai mat khau"
                        required
                        minLength={4}
                      />
                    </div>
                  </div>

                  {/* Thong tin y te - Tier 1 optional */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowMedical(!showMedical)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <FiHeart className="text-emerald-400" />
                        Thong tin y te (tuy chon)
                      </span>
                      {showMedical ? <FiChevronUp /> : <FiChevronDown />}
                    </button>

                    {showMedical && (
                      <div className="mt-3 space-y-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Gioi tinh</label>
                            <select
                              value={form.gender}
                              onChange={(e) => update('gender', e.target.value)}
                              className="dark-select w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                            >
                              <option value="">--</option>
                              <option value="male">Nam</option>
                              <option value="female">Nu</option>
                              <option value="other">Khac</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Nhom mau</label>
                            <select
                              value={form.bloodType}
                              onChange={(e) => update('bloodType', e.target.value)}
                              className="dark-select w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                            >
                              <option value="">--</option>
                              <option value="A+">A+</option><option value="A-">A-</option>
                              <option value="B+">B+</option><option value="B-">B-</option>
                              <option value="AB+">AB+</option><option value="AB-">AB-</option>
                              <option value="O+">O+</option><option value="O-">O-</option>
                              <option value="unknown">Chua biet</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1.5">So dien thoai</label>
                          <div className="relative">
                            <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                            <input
                              type="tel"
                              value={form.phone}
                              onChange={(e) => update('phone', e.target.value)}
                              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                              placeholder="0912345678"
                              pattern="0\d{9}"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1.5">So CCCD</label>
                          <div className="relative">
                            <FiCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                            <input
                              type="text"
                              value={form.idCard}
                              onChange={(e) => update('idCard', e.target.value)}
                              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                              placeholder="12 chu so"
                              pattern="\d{12}"
                              maxLength={12}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1.5">So the BHYT</label>
                          <input
                            type="text"
                            value={form.bhytNumber}
                            onChange={(e) => update('bhytNumber', e.target.value.toUpperCase())}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                            placeholder="15 ky tu (VD: HS4797520123456)"
                            maxLength={15}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1.5">Di ung (phan cach bang dau phay)</label>
                          <input
                            type="text"
                            value={form.allergies}
                            onChange={(e) => update('allergies', e.target.value)}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                            placeholder="penicillin, dau phong, lac"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1.5">Benh man tinh (phan cach bang dau phay)</label>
                          <input
                            type="text"
                            value={form.chronicConditions}
                            onChange={(e) => update('chronicConditions', e.target.value)}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                            placeholder="tieu duong, tang huyet ap"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <FiUserPlus />
                        Dang ky
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-6">
                  Da co tai khoan?{' '}
                  <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                    Dang nhap
                  </Link>
                </p>
              </>
            )}
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
