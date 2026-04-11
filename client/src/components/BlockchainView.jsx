import { useState } from 'react'
import {
  FiDatabase, FiFileText, FiLink, FiBox, FiHash, FiClock, FiList, FiGrid,
} from 'react-icons/fi'

function generateBlockHash(index, items) {
  let hash = 0
  const str = `block-${index}-${items.length}-${JSON.stringify(items[0] || {}).slice(0, 50)}`
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * BlockchainView - Hien thi du lieu ledger dang blockchain blocks
 *
 * Props:
 *   ledger: array of ledger items
 *   getDocType: (item) => string - function to detect type
 *   typeMeta: { [type]: { label, color, icon } } - type display info
 *   colorMap: { [color]: { badge, icon } } - color classes
 *   EntryPreview: component to preview entry (optional)
 */
export default function BlockchainView({ ledger, getDocType, typeMeta, colorMap, EntryPreview }) {
  const [expandedBlock, setExpandedBlock] = useState(null)

  const BLOCK_SIZE = 4
  const blocks = []
  for (let i = 0; i < ledger.length; i += BLOCK_SIZE) {
    const items = ledger.slice(i, i + BLOCK_SIZE)
    const blockIndex = Math.floor(i / BLOCK_SIZE)
    blocks.push({
      number: blockIndex + 1,
      items,
      hash: generateBlockHash(blockIndex, items),
      prevHash: blockIndex === 0 ? '00000000' : generateBlockHash(blockIndex - 1, ledger.slice((blockIndex - 1) * BLOCK_SIZE, blockIndex * BLOCK_SIZE)),
      txCount: items.length,
      timestamp: items[0]?.Value?.timestamp || items[0]?.timestamp || null,
    })
  }

  if (blocks.length === 0) return null

  const defaultColorMap = {
    gray: { badge: 'bg-gray-100 text-gray-700', icon: 'bg-gray-100 text-gray-600' },
  }
  const cMap = { ...defaultColorMap, ...colorMap }

  const getEntryId = (item) => {
    const val = item.Value || item
    if (item.Key) return item.Key
    return val.recordId || val.claimId || val.dispenseId
      || val.agentId || val.companyId
      || val.patientId || val.doctorId || val.hospitalId || val.pharmacyId
      || null
  }

  return (
    <div className="space-y-0">
      {/* Genesis */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 bg-primary-500 rounded-full" />
        <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Genesis</span>
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">{blocks.length} blocks, {ledger.length} transactions</span>
      </div>

      {blocks.map((block, idx) => {
        const isExpanded = expandedBlock === idx
        const isLast = idx === blocks.length - 1

        return (
          <div key={idx} className="relative">
            {/* Connector */}
            {idx > 0 && (
              <div className="flex items-center justify-center py-1">
                <div className="flex flex-col items-center">
                  <div className="w-px h-4 bg-gradient-to-b from-primary-300 to-primary-500" />
                  <FiLink className="text-primary-400 text-xs my-0.5" />
                  <div className="w-px h-4 bg-gradient-to-b from-primary-500 to-primary-300" />
                </div>
              </div>
            )}

            {/* Block */}
            <div
              className={`rounded-xl border-2 transition-all cursor-pointer ${
                isExpanded
                  ? 'border-primary-400 shadow-lg shadow-primary-100'
                  : isLast
                    ? 'border-primary-200 bg-primary-50/30 hover:shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
              onClick={() => setExpandedBlock(isExpanded ? null : idx)}
            >
              {/* Header */}
              <div className="flex items-center gap-3 p-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isLast ? 'bg-primary-100' : 'bg-gray-100'
                }`}>
                  <FiBox className={`text-xl ${isLast ? 'text-primary-600' : 'text-gray-500'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${isLast ? 'text-primary-700' : 'text-gray-900'}`}>
                      Block #{block.number}
                    </span>
                    {isLast && (
                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                        Latest
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                    <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
                      <FiHash className="text-[10px]" /> {block.hash}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <FiFileText className="text-[10px]" /> {block.txCount} tx
                    </span>
                    {block.timestamp && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <FiClock className="text-[10px]" /> {new Date(block.timestamp).toLocaleString('vi-VN')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Type badges */}
                <div className="flex flex-wrap gap-1 flex-shrink-0">
                  {(() => {
                    const types = {}
                    block.items.forEach(item => {
                      const t = getDocType(item)
                      types[t] = (types[t] || 0) + 1
                    })
                    return Object.entries(types).map(([type, count]) => {
                      const meta = typeMeta[type] || { label: type, color: 'gray' }
                      const c = cMap[meta.color] || cMap.gray
                      return (
                        <span key={type} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${c.badge}`}>
                          {count} {meta.label}
                        </span>
                      )
                    })
                  })()}
                </div>

                <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Prev hash */}
              <div className="px-4 pb-2 -mt-1">
                <span className="text-[10px] text-gray-300 font-mono">prev: {block.prevHash}</span>
              </div>

              {/* Expanded transactions */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-4 space-y-2 bg-gray-50/50" onClick={e => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Transactions trong block</p>
                  {block.items.map((item, i) => {
                    const val = item.Value || item
                    const docType = getDocType(item)
                    const key = getEntryId(item) || `tx-${i}`
                    const meta = typeMeta[docType] || { label: docType, color: 'gray', icon: FiDatabase }
                    const c = cMap[meta.color] || cMap.gray
                    const Icon = meta.icon || FiDatabase
                    return (
                      <details key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden group">
                        <summary className="flex items-center gap-3 p-3 cursor-pointer list-none hover:bg-gray-50 transition-colors">
                          <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-400">
                            {i + 1}
                          </div>
                          <div className={`w-7 h-7 ${c.icon} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <Icon className="text-xs" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-mono text-xs text-gray-700 truncate block">{key}</span>
                            {EntryPreview && <EntryPreview val={val} docType={docType} />}
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${c.badge}`}>
                            {meta.label}
                          </span>
                        </summary>
                        <div className="px-3 pb-3 border-t border-gray-100">
                          <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap mt-2">
                            {JSON.stringify(val, null, 2)}
                          </pre>
                        </div>
                      </details>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* End */}
      <div className="flex items-center gap-2 mt-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-300 uppercase tracking-wider">End of chain</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
    </div>
  )
}

/** Toggle button for list/blocks view mode */
export function ViewModeToggle({ viewMode, setViewMode }) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5">
      <button
        onClick={() => setViewMode('list')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <FiList /> Danh sách
      </button>
      <button
        onClick={() => setViewMode('blocks')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          viewMode === 'blocks' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <FiGrid /> Khối
      </button>
    </div>
  )
}
