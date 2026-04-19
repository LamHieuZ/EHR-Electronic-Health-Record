import { useState, useRef, useEffect } from 'react'
import { FiUser } from 'react-icons/fi'

// Autocomplete Patient ID input. Truyen patients = [{ patientId, name }]
// lay tu /getMyPatients (doctor) hoac /getAllPatients (hospital admin).
export default function PatientIdInput({ value, onChange, patients = [], placeholder = 'patient001', required = true }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const filtered = patients.filter(
    (p) =>
      p.patientId.toLowerCase().includes(value.toLowerCase()) ||
      (p.name && p.name.toLowerCase().includes(value.toLowerCase()))
  )

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="input-field"
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((p) => (
            <li
              key={p.patientId}
              onMouseDown={() => { onChange(p.patientId); setOpen(false) }}
              className="flex items-center gap-2 px-3 py-2 hover:bg-primary-50 cursor-pointer text-sm"
            >
              <FiUser className="text-primary-400 flex-shrink-0" />
              <span className="font-medium text-gray-800">{p.patientId}</span>
              {p.name && <span className="text-gray-400 truncate">— {p.name}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
