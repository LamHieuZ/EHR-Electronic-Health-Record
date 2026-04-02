import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getRewardsByPatient, claimReward } from '../services/api'
import { toast } from 'react-toastify'
import { FiGift, FiStar, FiCheck } from 'react-icons/fi'

export default function Rewards() {
  const { user } = useAuth()
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRewards()
  }, [])

  const loadRewards = async () => {
    try {
      const res = await getRewardsByPatient({ userId: user.userId, args: [user.userId] })
      setRewards(JSON.parse(res.data.data || '[]'))
    } catch {
      // best effort
    } finally {
      setLoading(false)
    }
  }

  const handleClaim = async (rewardId) => {
    try {
      const res = await claimReward({ userId: user.userId, args: [user.userId, rewardId] })
      if (res.data.success || res.data.data) {
        toast.success('Đã nhận phần thưởng!')
        loadRewards()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi')
    }
  }

  const totalPoints = rewards.reduce((sum, r) => {
    const val = r.Value || r
    return sum + (Number(val.amount) || 0)
  }, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Phần thưởng</h1>
        <p className="text-gray-500 mt-1">Điểm thưởng từ việc chia sẻ dữ liệu sức khỏe</p>
      </div>

      {/* Total */}
      <div className="card bg-gradient-to-r from-purple-500 to-purple-700 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
            <FiStar className="text-2xl" />
          </div>
          <div>
            <p className="text-purple-100 text-sm">Tổng điểm thưởng</p>
            <p className="text-3xl font-bold">{totalPoints.toLocaleString('vi-VN')}</p>
          </div>
        </div>
      </div>

      {/* Rewards list */}
      {rewards.length === 0 ? (
        <div className="card text-center py-12">
          <FiGift className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Chưa có phần thưởng nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rewards.map((reward, i) => {
            const val = reward.Value || reward
            const isClaimed = val.claimed || val.status === 'claimed'

            return (
              <div key={i} className="card flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isClaimed ? 'bg-gray-100' : 'bg-purple-100'}`}>
                  <FiGift className={isClaimed ? 'text-gray-400' : 'text-purple-600'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">+{val.amount} điểm</p>
                    {isClaimed ? (
                      <span className="badge bg-gray-100 text-gray-500"><FiCheck className="mr-1" /> Đã nhận</span>
                    ) : (
                      <button onClick={() => handleClaim(val.rewardId || reward.Key)} className="btn-primary text-sm py-1">
                        Nhận thưởng
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{val.reason || 'N/A'}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
