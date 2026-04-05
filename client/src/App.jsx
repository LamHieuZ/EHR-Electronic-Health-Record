import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import PatientDashboard from './pages/PatientDashboard'
import DoctorDashboard from './pages/DoctorDashboard'
import PatientRecords from './pages/PatientRecords'
import AccessControl from './pages/AccessControl'
import Prescriptions from './pages/Prescriptions'
import InsuranceClaims from './pages/InsuranceClaims'
import ResearchConsent from './pages/ResearchConsent'
import EmergencyLogs from './pages/EmergencyLogs'
import Rewards from './pages/Rewards'
import AdminLedger from './pages/AdminLedger'

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />
  return children
}

export default function App() {
  const { user } = useAuth()

  const getHomeRedirect = () => {
    if (!user) return '/login'
    switch (user.role) {
      case 'doctor': return '/doctor'
      case 'admin': case 'hospital': return '/admin/ledger'
      case 'pharmacy': return '/prescriptions'
      case 'insuranceAdmin': case 'insurance': case 'agent': return '/insurance'
      case 'researcher': return '/research'
      default: return '/dashboard'
    }
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={getHomeRedirect()} /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={getHomeRedirect()} /> : <Register />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<ProtectedRoute roles={['patient']}><PatientDashboard /></ProtectedRoute>} />
        <Route path="/doctor" element={<ProtectedRoute roles={['doctor']}><DoctorDashboard /></ProtectedRoute>} />
        <Route path="/records" element={<PatientRecords />} />
        <Route path="/access" element={<ProtectedRoute roles={['patient']}><AccessControl /></ProtectedRoute>} />
        <Route path="/prescriptions" element={<Prescriptions />} />
        <Route path="/insurance" element={<InsuranceClaims />} />
        <Route path="/research" element={<ResearchConsent />} />
        <Route path="/emergency" element={<EmergencyLogs />} />
        <Route path="/rewards" element={<ProtectedRoute roles={['patient']}><Rewards /></ProtectedRoute>} />
        <Route path="/admin/ledger" element={<ProtectedRoute roles={['admin', 'hospital']}><AdminLedger /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to={getHomeRedirect()} />} />
    </Routes>
  )
}
