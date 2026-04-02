import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createClaim, getClaimsByPatient, approveClaim, rejectClaim } from '../services/api'
import { toast } from 'react-toastify'
import { FiDollarSign, FiPlus, FiSearch, FiCheck, FiX } from 'react-icons/fi'

const claimTypes = ['hospitalization', 'outpatient', 'medication', 'surgery', 'diagnostic', 'emergency', 'other']
const claimTypeLabels = {
  hospitalization: 'Nội trú', outpatient: 'Ngoại trú', medication: 'Thuốc',
  surgery: 'Phẫu thuật', diagnostic: 'Chẩn đoán', emergency: 'Cấp cứu', other: 'Khác',
}
const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function InsuranceClaims() {
  const { user } = useAuth()
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [searchId, setSearchId] = useState(user.role === 'patient' ? user.userId : '')
  const [form, setForm] = useState({ patientId: '', recordId: '', claimType: 'hospitalization', amount: '', description: '' })
  const [reviewForm, setReviewForm] = useState(null)

  const loadClaims = async () => {
    if (!searchId.trim()) return
    setLoading(true)
    try {
      const res = await getClaimsByPatient({ userId: user.userId, args: [searchId] })
      setClaims(JSON.parse(res.data.data || '[]'))
    } catch {
      toast.error('Lỗi tải yêu cầu bảo hiểm')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await createClaim({
        userId: user.userId,
        args: [form.patientId, form.recordId, form.claimType, form.amount, form.description],
      })
      if (res.data.success || res.data.data) {
        toast.success('Tạo yêu cầu bảo hiểm thành công!')
        setShowCreate(false)
        setForm({ patientId: '', recordId: '', claimType: 'hospitalization', amount: '', description: '' })
        if (searchId) loadClaims()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (action) => {
    if (!reviewForm) return
    setLoading(true)
    try {
      const fn = action === 'approve' ? approveClaim : rejectClaim
      const res = await fn({
        userId: user.userId,
        args: [reviewForm.patientId, reviewForm.claimId, reviewForm.notes],
      })
      if (res.data.success || res.data.data) {
        toast.success(action === 'approve' ? 'Đã duyệt!' : 'Đã từ chối!')
        setReviewForm(null)
        loadClaims()
      } else {
        toast.error(res.data.error || 'Thất bại')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bảo hiểm y tế</h1>
          <p className="text-gray-500 mt-1">Quản lý yêu cầu bồi thường bảo hiểm</p>
        </div>
        {(user.role === 'patient' || user.role === 'doctor') && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
            <FiPlus /> Tạo yêu cầu
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card max-w-xl">
          <h2 className="text-lg font-semibold mb-4">Tạo yêu cầu bảo hiểm</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
                <input type="text" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Record ID</label>
                <input type="text" value={form.recordId} onChange={(e) => setForm({ ...form, recordId: e.target.value })} className="input-field" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
                <select value={form.claimType} onChange={(e) => setForm({ ...form, claimType: e.target.value })} className="input-field">
                  {claimTypes.map((t) => <option key={t} value={t}>{claimTypeLabels[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền (VNĐ)</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field h-24" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary">Gửi yêu cầu</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Hủy</button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="card">
        <div className="flex gap-3">
          <input type="text" value={searchId} onChange={(e) => setSearchId(e.target.value)} className="input-field flex-1" placeholder="Patient ID" onKeyDown={(e) => e.key === 'Enter' && loadClaims()} readOnly={user.role === 'patient'} />
          <button onClick={loadClaims} disabled={loading} className="btn-primary flex items-center gap-2">
            <FiSearch /> Tra cứu
          </button>
        </div>
      </div>

      {/* Claims list */}
      {claims.length > 0 && (
        <div className="space-y-4">
          {claims.map((claim, i) => {
            const val = claim.Value || claim
            return (
              <div key={i} className="card">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiDollarSign className="text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">{claim.Key || val.claimId || `Claim #${i + 1}`}</h3>
                      <span className={`badge ${statusColors[val.status] || 'bg-gray-100 text-gray-700'}`}>
                        {val.status === 'pending' ? 'Chờ duyệt' : val.status === 'approved' ? 'Đã duyệt' : val.status === 'rejected' ? 'Từ chối' : val.status || 'N/A'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600 space-y-1">
                      <p>Loại: <strong>{claimTypeLabels[val.claimType] || val.claimType}</strong></p>
                      <p>Số tiền: <strong>{Number(val.amount).toLocaleString('vi-VN')} VNĐ</strong></p>
                      <p>Mô tả: {val.description}</p>
                    </div>

                    {/* Insurance review */}
                    {user.role === 'insurance' && val.status === 'pending' && (
                      <div className="mt-3">
                        {reviewForm?.claimId === (val.claimId || claim.Key) ? (
                          <div className="space-y-2">
                            <input type="text" value={reviewForm.notes} onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })} className="input-field" placeholder="Ghi chú xét duyệt..." />
                            <div className="flex gap-2">
                              <button onClick={() => handleReview('approve')} className="btn-success flex items-center gap-1 text-sm"><FiCheck /> Duyệt</button>
                              <button onClick={() => handleReview('reject')} className="btn-danger flex items-center gap-1 text-sm"><FiX /> Từ chối</button>
                              <button onClick={() => setReviewForm(null)} className="btn-secondary text-sm">Hủy</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setReviewForm({ claimId: val.claimId || claim.Key, patientId: val.patientId || searchId, notes: '' })} className="btn-primary text-sm">
                            Xét duyệt
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
