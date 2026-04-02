import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAllRecordsByPatientId, getRecordById, queryHistoryOfAsset } from '../services/api'
import { toast } from 'react-toastify'
import { FiFileText, FiSearch, FiClock, FiChevronDown, FiChevronUp } from 'react-icons/fi'

export default function PatientRecords() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [history, setHistory] = useState({})
  const [searchPatientId, setSearchPatientId] = useState('')

  useEffect(() => {
    if (user.role === 'patient') {
      loadRecords(user.userId)
    }
  }, [])

  const loadRecords = async (patientId) => {
    setLoading(true)
    try {
      const res = await getAllRecordsByPatientId({ userId: user.userId, args: [patientId] })
      const data = JSON.parse(res.data.result || '[]')
      setRecords(data)
    } catch {
      toast.error('Không thể tải hồ sơ')
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async (assetId) => {
    if (history[assetId]) {
      setExpandedId(expandedId === assetId ? null : assetId)
      return
    }
    try {
      const res = await queryHistoryOfAsset({ userId: user.userId, args: [assetId] })
      const data = JSON.parse(res.data.result || '[]')
      setHistory((prev) => ({ ...prev, [assetId]: data }))
      setExpandedId(assetId)
    } catch {
      toast.error('Không thể tải lịch sử')
    }
  }

  const handleSearch = () => {
    if (searchPatientId.trim()) loadRecords(searchPatientId.trim())
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hồ sơ bệnh án</h1>
        <p className="text-gray-500 mt-1">Xem và theo dõi lịch sử khám bệnh</p>
      </div>

      {/* Search for doctors/admins */}
      {user.role !== 'patient' && (
        <div className="card">
          <div className="flex gap-3">
            <input
              type="text"
              value={searchPatientId}
              onChange={(e) => setSearchPatientId(e.target.value)}
              className="input-field flex-1"
              placeholder="Nhập Patient ID để tra cứu"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="btn-primary flex items-center gap-2">
              <FiSearch /> Tìm kiếm
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="card text-center py-12">
          <FiFileText className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Chưa có hồ sơ bệnh án nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record, i) => {
            const val = record.Value || record
            const key = record.Key || `record-${i}`
            const isExpanded = expandedId === key

            return (
              <div key={i} className="card">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <FiFileText className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">{key}</h3>
                      <span className="text-xs text-gray-400">
                        {val.createdAt ? new Date(val.createdAt).toLocaleDateString('vi-VN') : ''}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Chẩn đoán</p>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                            {typeof val.diagnosis === 'object' ? JSON.stringify(val.diagnosis, null, 2) : val.diagnosis || 'N/A'}
                          </pre>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Đơn thuốc</p>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                            {typeof val.prescription === 'object' ? JSON.stringify(val.prescription, null, 2) : val.prescription || 'N/A'}
                          </pre>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      <span>Bác sĩ: <strong>{val.doctorId || 'N/A'}</strong></span>
                      {val.version && <span>Phiên bản: {val.version}</span>}
                    </div>

                    {/* History toggle */}
                    <button
                      onClick={() => loadHistory(key)}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                    >
                      <FiClock />
                      Lịch sử thay đổi
                      {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                    </button>

                    {isExpanded && history[key] && (
                      <div className="mt-3 border-l-2 border-primary-200 pl-4 space-y-3">
                        {history[key].map((h, j) => (
                          <div key={j} className="text-sm">
                            <p className="text-gray-500">TxId: <code className="text-xs">{h.TxId?.slice(0, 16)}...</code></p>
                            <pre className="bg-gray-50 rounded p-2 mt-1 text-xs overflow-x-auto">
                              {JSON.stringify(h.Value, null, 2)}
                            </pre>
                          </div>
                        ))}
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
