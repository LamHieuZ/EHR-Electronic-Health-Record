import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateProfile, changePassword, getPatientById, getAllDoctors, getAllPharmacies, getAllHospitals } from '../services/api'
import { toast } from 'react-toastify'
import { FiX, FiUser, FiLock, FiSave, FiMapPin, FiCalendar, FiPhone, FiBriefcase, FiChevronRight } from 'react-icons/fi'

const roleLabels = {
  patient: 'Benh nhan',
  doctor: 'Bac si',
  hospital: 'Benh vien',
  pharmacy: 'Nha thuoc',
  insuranceAdmin: 'Cong ty bao hiem',
  insurance: 'Cong ty bao hiem',
  agent: 'Chi nhanh bao hiem',
}

const roleColors = {
  patient: 'from-blue-400 to-blue-600',
  doctor: 'from-purple-400 to-purple-600',
  hospital: 'from-cyan-400 to-cyan-600',
  pharmacy: 'from-teal-400 to-teal-600',
  insuranceAdmin: 'from-amber-400 to-amber-600',
  insurance: 'from-amber-400 to-amber-600',
  agent: 'from-orange-400 to-orange-600',
}

export default function ProfileModal({ open, onClose }) {
  const { user, login } = useAuth()
  const [tab, setTab] = useState('info')
  const [profile, setProfile] = useState({ name: '', dob: '', city: '', department: '', position: '', specialization: '', phone: '' })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    if (open && user) {
      setTab('info')
      loadProfile()
    }
  }, [open])

  const loadProfile = async () => {
    setLoadingProfile(true)
    try {
      let data = null
      if (user.role === 'patient') {
        const res = await getPatientById({ userId: user.userId, patientId: user.userId })
        data = typeof res.data?.data === 'string' ? JSON.parse(res.data.data) : res.data?.data
      } else if (user.role === 'doctor') {
        const res = await getAllDoctors({ userId: user.userId, hospitalId: '' })
        const docs = typeof res.data?.data === 'string' ? JSON.parse(res.data.data) : res.data?.data
        data = Array.isArray(docs) && docs.find(d => d.doctorId === user.userId)
      } else if (user.role === 'hospital') {
        const res = await getAllHospitals({ userId: user.userId })
        const list = typeof res.data?.data === 'string' ? JSON.parse(res.data.data) : res.data?.data
        data = Array.isArray(list) && list.find(h => h.hospitalId === user.userId)
      } else if (user.role === 'pharmacy') {
        const res = await getAllPharmacies({ userId: user.userId, hospitalId: '' })
        const list = typeof res.data?.data === 'string' ? JSON.parse(res.data.data) : res.data?.data
        data = Array.isArray(list) && list.find(p => p.pharmacyId === user.userId)
      }
      if (data) {
        setProfile({
          name: data.name || '',
          dob: data.dob || '',
          city: data.city || '',
          department: data.department || '',
          position: data.position || '',
          specialization: data.specialization || '',
          phone: data.phone || '',
        })
      }
    } catch { /* ignore */ }
    finally { setLoadingProfile(false) }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (!profile.name.trim()) return toast.error('Ten khong duoc de trong')
    setLoading(true)
    try {
      const res = await updateProfile({ userId: user.userId, ...profile })
      if (res.data.success) {
        toast.success('Cap nhat thong tin thanh cong!')
        login({ ...user, name: profile.name })
      } else {
        toast.error(res.data.error || 'That bai')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Loi ket noi')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!passwords.newPassword || passwords.newPassword.length < 4) {
      return toast.error('Mat khau moi phai co it nhat 4 ky tu')
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      return toast.error('Mat khau xac nhan khong khop')
    }
    setLoading(true)
    try {
      const res = await changePassword({
        userId: user.userId,
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      })
      if (res.data.success) {
        toast.success('Doi mat khau thanh cong!')
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        toast.error(res.data.error || 'That bai')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Loi ket noi')
    } finally {
      setLoading(false)
    }
  }

  const isDoctor = user?.role === 'doctor'
  const gradientColor = roleColors[user?.role] || 'from-primary-400 to-primary-600'
  const inputCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all'

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div className={`fixed inset-y-0 right-0 z-[61] w-full max-w-sm bg-white shadow-2xl transform transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          {/* Header with avatar */}
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiChevronRight />
              </button>
              <span className="text-xs text-gray-400 font-medium">Thong tin ca nhan</span>
              <div className="w-8" />
            </div>
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 bg-gradient-to-br ${gradientColor} rounded-2xl flex items-center justify-center shadow-lg mb-3`}>
                <span className="text-white font-bold text-xl">
                  {(user?.name || user?.userId || '?')[0].toUpperCase()}
                </span>
              </div>
              <h2 className="text-base font-bold text-gray-900">{user?.name || user?.userId}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{roleLabels[user?.role] || user?.role}</p>
              <p className="text-xs text-gray-300 font-mono mt-1">{user?.userId}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-5">
            <button
              onClick={() => setTab('info')}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === 'info' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <FiUser className="inline mr-1.5 text-sm -mt-0.5" />
              Thong tin
            </button>
            <button
              onClick={() => setTab('password')}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === 'password' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <FiLock className="inline mr-1.5 text-sm -mt-0.5" />
              Mat khau
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 px-5 py-4 overflow-y-auto">
            {tab === 'info' && (
              loadingProfile ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
              ) : (
                <form onSubmit={handleUpdateProfile} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ho ten *</label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                      <input type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className={`${inputCls} pl-9`} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ngay sinh</label>
                      <div className="relative">
                        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                        <input type="date" value={profile.dob} onChange={(e) => setProfile({ ...profile, dob: e.target.value })} className={`${inputCls} pl-9`} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Thanh pho</label>
                      <div className="relative">
                        <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                        <input type="text" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} className={`${inputCls} pl-9`} />
                      </div>
                    </div>
                  </div>
                  {isDoctor && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Khoa</label>
                          <input type="text" value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Chuc vu</label>
                          <input type="text" value={profile.position} onChange={(e) => setProfile({ ...profile, position: e.target.value })} className={inputCls} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Chuyen khoa</label>
                          <div className="relative">
                            <FiBriefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                            <input type="text" value={profile.specialization} onChange={(e) => setProfile({ ...profile, specialization: e.target.value })} className={`${inputCls} pl-9`} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">So dien thoai</label>
                          <div className="relative">
                            <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                            <input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className={`${inputCls} pl-9`} />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2 py-2.5 mt-1">
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiSave className="text-sm" />}
                    Luu thay doi
                  </button>
                </form>
              )
            )}

            {tab === 'password' && (
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mat khau hien tai</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="password"
                      value={passwords.currentPassword}
                      onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                      className={`${inputCls} pl-9`}
                      placeholder="De trong neu chua co mat khau"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mat khau moi *</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="password"
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                      className={`${inputCls} pl-9`}
                      placeholder="It nhat 4 ky tu"
                      required
                      minLength={4}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Xac nhan mat khau moi *</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="password"
                      value={passwords.confirmPassword}
                      onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                      className={`${inputCls} pl-9`}
                      placeholder="Nhap lai mat khau moi"
                      required
                      minLength={4}
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2 py-2.5 mt-1">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiLock className="text-sm" />}
                  Doi mat khau
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
