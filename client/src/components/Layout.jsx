import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiHome, FiFileText, FiShield, FiActivity, FiDollarSign, FiDatabase, FiGift, FiAlertTriangle, FiLogOut, FiMenu, FiX, FiUsers } from 'react-icons/fi'
import { useState, useEffect } from 'react'

const roleLabels = {
  patient: 'Bệnh nhân',
  doctor: 'Bác sĩ',
  admin: 'Quản trị viên',
  hospital: 'Bệnh viện',
  pharmacy: 'Nhà thuốc',
  insuranceAdmin: 'Công ty bảo hiểm',
  insurance: 'Công ty bảo hiểm',
  agent: 'Chi nhánh bảo hiểm',
  researcher: 'Nghiên cứu',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [blockchainStatus, setBlockchainStatus] = useState('checking')

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

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <FiActivity className="text-white text-xl" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900">EHR Blockchain</h1>
                <p className="text-xs text-gray-500">Hồ sơ sức khỏe</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Icon className="text-lg" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-700 font-semibold text-sm">
                  {(user?.userId || user?.username || '?')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.userId || user?.username}</p>
                <p className="text-xs text-gray-500">{roleLabels[user?.role] || user?.role}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors w-full px-3 py-2 rounded-lg hover:bg-red-50">
              <FiLogOut />
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 lg:px-6 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900">
            <FiMenu className="text-xl" />
          </button>
          <div className="flex-1" />
          {blockchainStatus === 'connected' && (
            <span className="badge bg-green-100 text-green-700">Blockchain Connected</span>
          )}
          {blockchainStatus === 'disconnected' && (
            <span className="badge bg-red-100 text-red-700">Blockchain Disconnected</span>
          )}
          {blockchainStatus === 'checking' && (
            <span className="badge bg-gray-100 text-gray-500">Đang kiểm tra...</span>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function getNavItems(user) {
  const role = user?.role
  const userId = user?.userId
  const items = []

  if (role === 'doctor') {
    items.push({ to: '/doctor', icon: FiHome, label: 'Bảng điều khiển' })
    items.push({ to: '/records', icon: FiFileText, label: 'Hồ sơ bệnh án' })
    items.push({ to: '/prescriptions', icon: FiActivity, label: 'Đơn thuốc' })
    items.push({ to: '/emergency', icon: FiAlertTriangle, label: 'Truy cập khẩn cấp' })
  } else if (role === 'patient') {
    items.push({ to: '/dashboard', icon: FiHome, label: 'Tổng quan' })
    items.push({ to: '/records', icon: FiFileText, label: 'Hồ sơ bệnh án' })
    items.push({ to: '/access', icon: FiShield, label: 'Quyền truy cập' })
    items.push({ to: '/prescriptions', icon: FiActivity, label: 'Đơn thuốc' })
    items.push({ to: '/insurance', icon: FiDollarSign, label: 'Bảo hiểm' })
    items.push({ to: '/research', icon: FiUsers, label: 'Nghiên cứu' })
    items.push({ to: '/rewards', icon: FiGift, label: 'Phần thưởng' })
    items.push({ to: '/emergency', icon: FiAlertTriangle, label: 'Nhật ký khẩn cấp' })
  } else if (role === 'pharmacy') {
    items.push({ to: '/prescriptions', icon: FiActivity, label: 'Đơn thuốc' })
  } else if (role === 'insuranceAdmin' || role === 'insurance') {
    items.push({ to: '/insurance', icon: FiUsers, label: 'Chi nhánh' })
    items.push({ to: '/insurance', icon: FiDatabase, label: 'Sổ cái Blockchain' })
  } else if (role === 'agent') {
    items.push({ to: '/insurance', icon: FiDollarSign, label: 'Yêu cầu bảo hiểm' })
  } else if (role === 'researcher') {
    items.push({ to: '/research', icon: FiUsers, label: 'Nghiên cứu' })
  } else if (role === 'admin' || role === 'hospital') {
    if (userId === 'hospitalAdmin') {
      items.push({ to: '/admin/ledger', icon: FiUsers, label: 'Bệnh viện & Bác sĩ' })
      items.push({ to: '/admin/ledger', icon: FiGift, label: 'Phần thưởng' })
      items.push({ to: '/admin/ledger', icon: FiDatabase, label: 'Sổ cái Blockchain' })
    } else {
      items.push({ to: '/admin/ledger', icon: FiShield, label: 'Bệnh viện' })
    }
  }

  return items
}
