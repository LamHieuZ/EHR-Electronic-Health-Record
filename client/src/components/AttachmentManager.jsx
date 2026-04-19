import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { uploadAttachment, getAttachmentsByPatient, downloadAttachment } from '../services/api'
import { toast } from 'react-toastify'
import { FiUpload, FiDownload, FiFile, FiImage, FiFileText, FiLock, FiEyeOff, FiCheck, FiClock } from 'react-icons/fi'

const FILE_TYPE_LABELS = {
  'xray': { label: 'X-quang', icon: FiImage, color: 'blue' },
  'mri': { label: 'MRI', icon: FiImage, color: 'purple' },
  'ct-scan': { label: 'CT Scan', icon: FiImage, color: 'indigo' },
  'ultrasound': { label: 'Siêu âm', icon: FiImage, color: 'cyan' },
  'ecg': { label: 'Điện tim', icon: FiFileText, color: 'red' },
  'lab-report': { label: 'Xét nghiệm', icon: FiFileText, color: 'emerald' },
  'prescription-pdf': { label: 'Đơn thuốc PDF', icon: FiFileText, color: 'orange' },
  'discharge-summary': { label: 'Giấy ra viện', icon: FiFileText, color: 'amber' },
  'other': { label: 'Khác', icon: FiFile, color: 'gray' }
}

const COLOR_CLASSES = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  gray: 'bg-gray-50 text-gray-700 border-gray-200'
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export default function AttachmentManager({ patientId, recordId, canUpload = false, compact = false }) {
  const { user } = useAuth()
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileType, setFileType] = useState('xray')
  const [selectedFile, setSelectedFile] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  useEffect(() => {
    if (patientId) loadAttachments()
    // eslint-disable-next-line
  }, [patientId, recordId])

  const loadAttachments = async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const res = await getAttachmentsByPatient({
        userId: user.userId,
        patientId,
        recordId: recordId || undefined
      })
      const raw = res.data.data
      const data = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
      setAttachments(data)
    } catch {
      // Silent fail: no access or empty
      setAttachments([])
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!selectedFile) { toast.error('Chưa chọn file'); return }
    if (selectedFile.size > 100 * 1024 * 1024) { toast.error('File quá lớn (max 100MB)'); return }

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('userId', user.userId)
    formData.append('patientId', patientId)
    if (recordId) formData.append('recordId', recordId)
    formData.append('fileType', fileType)

    setUploading(true)
    setUploadProgress(0)
    try {
      const res = await uploadAttachment(formData, (evt) => {
        if (evt.total) setUploadProgress(Math.round((evt.loaded / evt.total) * 100))
      })
      const data = res.data.data
      toast.success(`Upload thành công! CID: ${data.cid?.slice(0, 12)}…`)
      setSelectedFile(null)
      await loadAttachments()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload thất bại')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDownload = async (att) => {
    setDownloadingId(att.attId)
    try {
      const res = await downloadAttachment({
        userId: user.userId,
        patientId: att.patientId,
        recordId: att.recordId || undefined,
        attId: att.attId
      })
      // Blob download
      const blob = new Blob([res.data])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = att.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Tải + verify hash thành công')
    } catch (err) {
      const msg = err.response?.data?.error
        || (err.response?.data instanceof Blob
            ? 'Không có quyền giải mã (org không thuộc PDC)'
            : err.message)
      toast.error(msg || 'Download thất bại')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {canUpload && (
        <form onSubmit={handleUpload} className="flex items-center gap-2 flex-wrap p-3 bg-gray-50 rounded-lg border border-gray-200">
          <select value={fileType} onChange={(e) => setFileType(e.target.value)}
            className="input-field text-sm" style={{ maxWidth: 160 }}>
            {Object.entries(FILE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <input type="file" onChange={(e) => setSelectedFile(e.target.files[0])}
            className="text-sm flex-1 min-w-0" accept="image/*,application/pdf,.dcm" />
          <button type="submit" disabled={uploading || !selectedFile}
            className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50">
            {uploading ? `${uploadProgress}%` : <><FiUpload /> Upload</>}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-gray-400">Đang tải attachments...</p>
      ) : attachments.length === 0 ? (
        !compact && <p className="text-xs text-gray-400 italic">Chưa có file đính kèm</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => {
            const typeInfo = FILE_TYPE_LABELS[att.fileType] || FILE_TYPE_LABELS.other
            const Icon = typeInfo.icon
            return (
              <div key={att.attId} className={`flex items-center gap-3 p-2.5 border rounded-lg ${COLOR_CLASSES[typeInfo.color]}`}>
                <Icon className="text-lg flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{att.fileName}</p>
                  <div className="flex items-center gap-2 text-xs opacity-75 flex-wrap mt-0.5">
                    <span className="font-semibold">{typeInfo.label}</span>
                    <span>·</span>
                    <span>{formatSize(att.size)}</span>
                    {att.cid && (
                      <>
                        <span>·</span>
                        <code className="text-xs">CID {att.cid.slice(0, 10)}…</code>
                      </>
                    )}
                    {att.timestamp && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5"><FiClock /> {new Date(att.timestamp).toLocaleDateString('vi-VN')}</span>
                      </>
                    )}
                  </div>
                  {att.plainHash && (
                    <p className="text-xs opacity-60 font-mono mt-0.5 truncate">
                      <FiCheck className="inline text-xs" /> sha256: {att.plainHash.slice(0, 16)}…
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDownload(att)}
                  disabled={downloadingId === att.attId}
                  className="text-sm font-medium px-2 py-1 rounded hover:bg-white/50 flex items-center gap-1 disabled:opacity-50"
                  title="Tải xuống (auto decrypt + verify hash)"
                >
                  {downloadingId === att.attId
                    ? <span className="text-xs">...</span>
                    : <><FiDownload /> Tải</>
                  }
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
