import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchLedger } from '../services/api'
import { toast } from 'react-toastify'
import { FiDatabase, FiDownload, FiSearch, FiRefreshCw } from 'react-icons/fi'

export default function AdminLedger() {
  const { user } = useAuth()
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  const loadLedger = async () => {
    setLoading(true)
    try {
      const res = await fetchLedger({ userId: user.userId, args: [] })
      let raw = res.data.data
      const data = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw
      const list = Array.isArray(data) ? data : [data]
      setLedger(list)
      toast.success(`Đã tải ${list.length} bản ghi`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi tải sổ cái')
    } finally {
      setLoading(false)
    }
  }

  const filteredLedger = filter
    ? ledger.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(filter.toLowerCase())
      )
    : ledger

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ehr-ledger-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sổ cái Blockchain</h1>
          <p className="text-gray-500 mt-1">Xem toàn bộ dữ liệu trên blockchain</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadLedger} disabled={loading} className="btn-primary flex items-center gap-2">
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            {ledger.length === 0 ? 'Tải sổ cái' : 'Làm mới'}
          </button>
          {ledger.length > 0 && (
            <button onClick={exportJSON} className="btn-secondary flex items-center gap-2">
              <FiDownload /> Xuất JSON
            </button>
          )}
        </div>
      </div>

      {ledger.length > 0 && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-primary-600">{ledger.length}</p>
              <p className="text-sm text-gray-500">Tổng bản ghi</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-600">{filteredLedger.length}</p>
              <p className="text-sm text-gray-500">Kết quả lọc</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-purple-600">
                {new Set(ledger.map((l) => (l.Value || l)?.docType || (l.Value || l)?.type || 'unknown')).size}
              </p>
              <p className="text-sm text-gray-500">Loại dữ liệu</p>
            </div>
          </div>

          {/* Filter */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input-field pl-10"
              placeholder="Lọc theo từ khóa (Patient ID, Record ID, Doctor ID...)"
            />
          </div>

          {/* Ledger entries */}
          <div className="space-y-3">
            {filteredLedger.map((item, i) => {
              const val = item.Value || item
              const key = item.Key || `entry-${i}`
              const docType = val.docType || val.type || 'data'

              const typeColors = {
                patient: 'bg-blue-100 text-blue-700',
                record: 'bg-green-100 text-green-700',
                claim: 'bg-yellow-100 text-yellow-700',
                doctor: 'bg-purple-100 text-purple-700',
                emergency: 'bg-red-100 text-red-700',
                reward: 'bg-pink-100 text-pink-700',
                researcher: 'bg-indigo-100 text-indigo-700',
              }

              return (
                <details key={i} className="card group">
                  <summary className="flex items-center gap-3 cursor-pointer list-none">
                    <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                      <FiDatabase className="text-gray-500 text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-sm text-gray-900 truncate block">{key}</span>
                    </div>
                    <span className={`badge ${typeColors[docType] || 'bg-gray-100 text-gray-700'}`}>
                      {docType}
                    </span>
                    <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <pre className="text-sm text-gray-700 bg-gray-50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(val, null, 2)}
                    </pre>
                  </div>
                </details>
              )
            })}
          </div>
        </>
      )}

      {ledger.length === 0 && !loading && (
        <div className="card text-center py-16">
          <FiDatabase className="text-5xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Nhấn "Tải sổ cái" để xem dữ liệu blockchain</p>
        </div>
      )}
    </div>
  )
}
