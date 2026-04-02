import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAllRecordsByPatientId, getPrescriptionsByPatient, getClaimsByPatient, getRewardsByPatient } from '../services/api'
import { FiFileText, FiActivity, FiDollarSign, FiGift, FiTrendingUp, FiClock } from 'react-icons/fi'
import { Link } from 'react-router-dom'

export default function PatientDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ records: 0, prescriptions: 0, claims: 0, rewards: 0 })
  const [recentRecords, setRecentRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const [recordsRes, prescRes, claimsRes, rewardsRes] = await Promise.allSettled([
        getAllRecordsByPatientId({ userId: user.userId, args: [user.userId] }),
        getPrescriptionsByPatient({ userId: user.userId, args: [user.userId] }),
        getClaimsByPatient({ userId: user.userId, args: [user.userId] }),
        getRewardsByPatient({ userId: user.userId, args: [user.userId] }),
      ])

      const records = recordsRes.status === 'fulfilled' ? JSON.parse(recordsRes.value.data.data || '[]') : []
      const prescriptions = prescRes.status === 'fulfilled' ? JSON.parse(prescRes.value.data.data || '[]') : []
      const claims = claimsRes.status === 'fulfilled' ? JSON.parse(claimsRes.value.data.data || '[]') : []
      const rewards = rewardsRes.status === 'fulfilled' ? JSON.parse(rewardsRes.value.data.data || '[]') : []

      setStats({
        records: records.length,
        prescriptions: prescriptions.length,
        claims: claims.length,
        rewards: rewards.length,
      })
      setRecentRecords(records.slice(-5).reverse())
    } catch {
      // Dashboard loads best-effort
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { label: 'Hồ sơ bệnh án', value: stats.records, icon: FiFileText, color: 'blue', to: '/records' },
    { label: 'Đơn thuốc', value: stats.prescriptions, icon: FiActivity, color: 'green', to: '/prescriptions' },
    { label: 'Yêu cầu bảo hiểm', value: stats.claims, icon: FiDollarSign, color: 'yellow', to: '/insurance' },
    { label: 'Phần thưởng', value: stats.rewards, icon: FiGift, color: 'purple', to: '/rewards' },
  ]

  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Xin chào, {user.userId}</h1>
        <p className="text-gray-500 mt-1">Tổng quan hồ sơ sức khỏe của bạn</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Link key={s.label} to={s.to} className="card hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorMap[s.color]}`}>
                <s.icon className="text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500">{s.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Records */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Bệnh án gần đây</h2>
          <Link to="/records" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Xem tất cả
          </Link>
        </div>
        {recentRecords.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Chưa có hồ sơ bệnh án nào</p>
        ) : (
          <div className="space-y-3">
            {recentRecords.map((record, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <FiFileText className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {record.Value?.diagnosis?.code || record.Value?.diagnosis || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Bác sĩ: {record.Value?.doctorId || 'N/A'}
                  </p>
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <FiClock />
                  {record.Value?.createdAt ? new Date(record.Value.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
