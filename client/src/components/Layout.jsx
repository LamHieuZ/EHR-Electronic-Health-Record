import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  FiHome, FiFileText, FiShield, FiActivity, FiDollarSign, FiDatabase,
  FiAlertTriangle, FiLogOut, FiMenu, FiSearch, FiUsers, FiPackage,
  FiX, FiWifi, FiWifiOff, FiLoader, FiSettings,
} from 'react-icons/fi'
import { useState, useEffect } from 'react'
import ProfileModal from './ProfileModal'

const roleLabels = {
  patient: 'Benh nhan',
  doctor: 'Bac si',
  admin: 'Quan tri vien',
  hospital: 'Benh vien',
  pharmacy: 'Nha thuoc',
  insuranceAdmin: 'Cong ty bao hiem',
  insurance: 'Cong ty bao hiem',
  agent: 'Chi nhanh bao hiem',
}

const roleColors = {
  patient: 'from-blue-400 to-blue-600',
  doctor: 'from-purple-400 to-purple-600',
  admin: 'from-primary-400 to-primary-600',
  hospital: 'from-cyan-400 to-cyan-600',
  pharmacy: 'from-teal-400 to-teal-600',
  insuranceAdmin: 'from-amber-400 to-amber-600',
  insurance: 'from-amber-400 to-amber-600',
  agent: 'from-orange-400 to-orange-600',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [blockchainStatus, setBlockchainStatus] = useState('checking')
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    const check = () => {
      fetch('/api/status')
        .then(r => r.ok ? setBlockchainStatus('connected') : setBlockchainStatus('disconnected'))
        .catch(() => setBlockchainStatus('disconnected'))
    }
    check()
    const interval = setInterval(check, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = getNavItems(user)
  const gradientColor = roleColors[user?.role] || 'from-primary-400 to-primary-600'

  return (
    <div className="h-screen flex bg-surface-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-sidebar transform transition-all duration-300 ease-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col relative overflow-hidden">
          {/* Decorative bg */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-400 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400 rounded-full blur-3xl" />
          </div>

          {/* Logo */}
          <div className="relative p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 bg-gradient-to-br ${gradientColor} rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20`}>
                <FiActivity className="text-white text-xl" />
              </div>
              <div>
                <h1 className="font-bold text-white text-lg tracking-tight">EHR Blockchain</h1>
                <p className="text-xs text-gray-400 font-medium">Ho so suc khoe dien tu</p>
              </div>
            </div>

            {/* Mobile close */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden absolute top-5 right-4 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-colors"
            >
              <FiX className="text-lg" />
            </button>
          </div>

          {/* Divider */}
          <div className="mx-5 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />

          {/* Nav */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto relative">
            {navItems.map(({ to, icon: Icon, label }, idx) => (
              <NavLink
                key={to}
                to={to}
                end
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-white/10 text-white shadow-inner-glow'
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }`
                }
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200`}>
                  <Icon className="text-[17px]" />
                </div>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Divider */}
          <div className="mx-5 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />

          {/* User info */}
          <div className="relative p-4">
            <button
              onClick={() => setProfileOpen(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 mb-2 hover:bg-white/10 transition-colors cursor-pointer text-left group"
            >
              <div className={`w-10 h-10 bg-gradient-to-br ${gradientColor} rounded-xl flex items-center justify-center shadow-lg flex-shrink-0`}>
                <span className="text-white font-bold text-sm">
                  {(user?.name || user?.userId || '?')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name || user?.userId}</p>
                <p className="text-xs text-gray-400">{roleLabels[user?.role] || user?.role}</p>
              </div>
              <FiSettings className="text-gray-500 group-hover:text-gray-300 transition-colors text-sm flex-shrink-0" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-400 transition-all duration-200 w-full px-3 py-2 rounded-xl hover:bg-red-500/10"
            >
              <FiLogOut className="text-[15px]" />
              Dang xuat
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 glass border-b border-gray-200/50 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <FiMenu className="text-xl" />
            </button>

            {/* Breadcrumb area */}
            <div className="flex-1" />

            {/* Status badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
              blockchainStatus === 'connected'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : blockchainStatus === 'disconnected'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-gray-50 text-gray-500 border border-gray-200'
            }`}>
              {blockchainStatus === 'connected' && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Blockchain Connected
                </>
              )}
              {blockchainStatus === 'disconnected' && (
                <>
                  <FiWifiOff className="text-xs" />
                  Disconnected
                </>
              )}
              {blockchainStatus === 'checking' && (
                <>
                  <FiLoader className="text-xs animate-spin" />
                  Dang kiem tra...
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}

function getNavItems(user) {
  const role = user?.role
  const userId = user?.userId
  const items = []

  if (role === 'doctor') {
    items.push({ to: '/doctor', icon: FiHome, label: 'Bang dieu khien' })
    items.push({ to: '/records', icon: FiFileText, label: 'Ho so benh an' })
    items.push({ to: '/procedures', icon: FiActivity, label: 'Phau thuat' })
    items.push({ to: '/vaccinations', icon: FiShield, label: 'Tiem chung' })
    items.push({ to: '/prescriptions', icon: FiActivity, label: 'Don thuoc' })
    items.push({ to: '/emergency', icon: FiAlertTriangle, label: 'Truy cap khan cap' })
  } else if (role === 'patient') {
    items.push({ to: '/dashboard', icon: FiHome, label: 'Tong quan' })
    items.push({ to: '/records', icon: FiFileText, label: 'Ho so benh an' })
    items.push({ to: '/procedures', icon: FiActivity, label: 'Phau thuat' })
    items.push({ to: '/vaccinations', icon: FiShield, label: 'Tiem chung' })
    items.push({ to: '/access', icon: FiShield, label: 'Quyen truy cap' })
    items.push({ to: '/prescriptions', icon: FiActivity, label: 'Don thuoc' })
    items.push({ to: '/insurance', icon: FiDollarSign, label: 'Bao hiem' })
    items.push({ to: '/emergency', icon: FiAlertTriangle, label: 'Nhat ky khan cap' })
  } else if (role === 'pharmacy') {
    items.push({ to: '/prescriptions', icon: FiActivity, label: 'Don thuoc' })
  } else if (role === 'insuranceAdmin' || role === 'insurance') {
    items.push({ to: '/insurance/agents', icon: FiUsers, label: 'Chi nhanh' })
    items.push({ to: '/insurance/blockchain', icon: FiDatabase, label: 'So cai Blockchain' })
  } else if (role === 'agent') {
    items.push({ to: '/insurance/pending', icon: FiDollarSign, label: 'Cho xu ly' })
    items.push({ to: '/insurance/reviewed', icon: FiFileText, label: 'Da xu ly' })
    items.push({ to: '/insurance/search', icon: FiSearch, label: 'Tra cuu' })
  } else if (role === 'admin' || role === 'hospital') {
    if (['hospitalAdmin', 'hospital2Admin'].includes(userId)) {
      items.push({ to: '/admin/doctors', icon: FiActivity, label: 'Bac si' })
      items.push({ to: '/admin/pharmacies', icon: FiPackage, label: 'Nha thuoc' })
      items.push({ to: '/admin/ledger', icon: FiDatabase, label: 'So cai Blockchain' })
    } else {
      items.push({ to: '/admin/doctors', icon: FiShield, label: 'Benh vien' })
    }
  }

  return items
}
