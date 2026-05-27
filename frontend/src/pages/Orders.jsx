import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import axios from 'axios'
import Layout from '../components/Layout'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'

const SHUSHIL_ID = 2
const MUKESH_ID = 3

// ── Quantity parser ────────────────────────────────────────────────────────────
// Handles: "500 gm", "2 x 500 gm", "1.5 kg", "500g", "2x500g", plain numbers
function parseQuantityToKg(raw) {
  if (!raw && raw !== 0) return null
  const str = String(raw).trim().toLowerCase()

  // Plain number → treat as kg
  if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str)

  // "N x M gm/g/kg" or "NxM gm/g/kg"
  const multiMatch = str.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|gm|g)?$/)
  if (multiMatch) {
    const count = parseFloat(multiMatch[1])
    const qty = parseFloat(multiMatch[2])
    const unit = multiMatch[3] || 'g'
    const kg = unit === 'kg' ? qty : qty / 1000
    return parseFloat((count * kg).toFixed(3))
  }

  // "N gm/g/kg"
  const singleMatch = str.match(/^(\d+(?:\.\d+)?)\s*(kg|gm|g)$/)
  if (singleMatch) {
    const qty = parseFloat(singleMatch[1])
    const unit = singleMatch[2]
    return unit === 'kg' ? qty : parseFloat((qty / 1000).toFixed(3))
  }

  return null
}

export default function Orders() {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [duration, setDuration] = useState('3')
  const [entryBy, setEntryBy] = useState('all')
  const [location, setLocation] = useState('all')
  const [saving, setSaving] = useState({})
  const [savedIds, setSavedIds] = useState(new Set())
  const [orderEdits, setOrderEdits] = useState({})
  const [dirtyIds, setDirtyIds] = useState(new Set())
  const [qtyRaw, setQtyRaw] = useState({})
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(null)
  const [bulkSaving, setBulkSaving] = useState(false)

  const productRefs = useRef({})

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchSamples = useCallback(async () => {
    setLoading(true)
    try {
      let url = `${API}/samples/?duration=${duration}`
      if (entryBy === 'shushil') url += `&created_by=${SHUSHIL_ID}`
      else if (entryBy === 'mukesh') url += `&created_by=${MUKESH_ID}`
      if (entryBy === 'shushil' && location !== 'all') url += `&location=${location}`

      const res = await axios.get(url, { headers })
      const data = res.data
      const edits = {}
      const rawQty = {}

      data.forEach(sample => {
        sample.products?.forEach(p => {
          edits[p.id] = {
            order_yes_no: p.order_detail?.order_yes_no ?? null,
            quantity_kg: p.order_detail?.quantity_kg ?? '',
            notes: p.order_detail?.notes ?? '',
          }
          rawQty[p.id] = p.order_detail?.quantity_kg != null
            ? String(p.order_detail.quantity_kg)
            : ''
        })
      })

      setOrderEdits(edits)
      setQtyRaw(rawQty)
      setDirtyIds(new Set())
      setSamples(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [duration, entryBy, location])

  useEffect(() => {
    if (entryBy !== 'shushil') setLocation('all')
    fetchSamples()
  }, [duration, entryBy, location])

  // ── Edit handler ───────────────────────────────────────────────────────────
  const handleEdit = (productId, field, value) => {
    setOrderEdits(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
        ...(field === 'order_yes_no' && !value ? { quantity_kg: 0 } : {}),
      },
    }))
    setDirtyIds(prev => new Set([...prev, productId]))
    setSavedIds(prev => { const n = new Set(prev); n.delete(productId); return n })
  }

  // Qty raw string input — shows inline parsed value as hint
  const handleQtyInput = (productId, raw) => {
    setQtyRaw(prev => ({ ...prev, [productId]: raw }))
    const parsed = parseQuantityToKg(raw)
    if (parsed !== null) {
      handleEdit(productId, 'quantity_kg', parsed)
    }
  }

  // ── Save single ───────────────────────────────────────────────────────────
  const saveOrder = async (productId) => {
    setSaving(prev => ({ ...prev, [productId]: true }))
    try {
      const detail = orderEdits[productId] || {}
      await axios.put(`${API}/orders/${productId}`, {
        order_yes_no: detail.order_yes_no ?? false,
        quantity_kg: detail.quantity_kg || 0,
        notes: detail.notes || '',
      }, { headers })
      setSavedIds(prev => new Set([...prev, productId]))
      setDirtyIds(prev => { const n = new Set(prev); n.delete(productId); return n })
      setTimeout(() => setSavedIds(prev => {
        const n = new Set(prev); n.delete(productId); return n
      }), 2500)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(prev => ({ ...prev, [productId]: false }))
    }
  }

  // ── Bulk save ─────────────────────────────────────────────────────────────
  const bulkSaveGroup = async (group) => {
    setBulkSaving(true)
    try {
      const saveable = group.rows.filter(
        r => orderEdits[r.productId]?.order_yes_no !== null
      )
      await Promise.all(saveable.map(row => saveOrder(row.productId)))
      fetchSamples()
    } finally {
      setBulkSaving(false)
    }
  }

  // ── Flatten rows ──────────────────────────────────────────────────────────
  const allRows = useMemo(() => {
    const rows = []
    samples.forEach(sample => {
      sample.products?.forEach(p => {
        const edit = orderEdits[p.id] || {}
        rows.push({
          productId: p.id,
          partyName: sample.party_name || sample.party_name_direct || sample.party_code || 'Unknown',
          salesPerson: sample.sales_person_name,
          date: sample.order_received_date,
          city: sample.city_name,
          createdBy: sample.created_by,
          productName: p.product_name,
          quantity: p.quantity,
          matchedWith: p.matched_with,
          orderYesNo: edit.order_yes_no ?? p.order_detail?.order_yes_no ?? null,
          quantityKg: edit.quantity_kg !== '' ? edit.quantity_kg : (p.order_detail?.quantity_kg ?? ''),
          notes: edit.notes ?? p.order_detail?.notes ?? '',
        })
      })
    })
    return rows
  }, [samples, orderEdits])

  // ── Group by party ────────────────────────────────────────────────────────
  const partyGroups = useMemo(() => {
    const map = {}
    allRows.forEach(row => {
      if (!map[row.partyName]) map[row.partyName] = { partyName: row.partyName, rows: [] }
      map[row.partyName].rows.push(row)
    })
    return Object.values(map).map(g => {
      const totalSamples = g.rows.length
      const orderedRows = g.rows.filter(r => r.orderYesNo === true)
      const totalOrderQty = orderedRows.reduce((s, r) => s + (parseFloat(r.quantityKg) || 0), 0)
      const estimatedQtyPerSample = totalSamples > 0 ? (totalOrderQty / totalSamples).toFixed(1) : '0'
      const conversionPct = totalSamples > 0 ? ((orderedRows.length / totalSamples) * 100).toFixed(1) : '0'
      const hasDirty = g.rows.some(r => dirtyIds.has(r.productId))
      return { ...g, totalSamples, totalOrderQty, estimatedQtyPerSample, conversionPct, orderedCount: orderedRows.length, hasDirty }
    }).sort((a, b) => a.partyName.localeCompare(b.partyName))
  }, [allRows, dirtyIds])

  // ── Overall summary ───────────────────────────────────────────────────────
  const totalSamples = allRows.length
  const totalOrders = allRows.filter(r => r.orderYesNo === true).length
  const totalQty = allRows.filter(r => r.orderYesNo === true).reduce((s, r) => s + (parseFloat(r.quantityKg) || 0), 0)
  const overallConversion = totalSamples > 0 ? ((totalOrders / totalSamples) * 100).toFixed(1) : '0'

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const selectedGroup = selectedGroupIndex !== null ? partyGroups[selectedGroupIndex] : null

  const goPrev = useCallback(() => setSelectedGroupIndex(i => Math.max(0, i - 1)), [])
  const goNext = useCallback(() => setSelectedGroupIndex(i => Math.min(partyGroups.length - 1, i + 1)), [partyGroups.length])

  // Live modal stats — recalculate as user edits, no stale group values
  const modalStats = useMemo(() => {
    if (!selectedGroup) return null
    const orderedRows = selectedGroup.rows.filter(
      r => (orderEdits[r.productId]?.order_yes_no ?? r.orderYesNo) === true
    )
    const totalOrderQty = orderedRows.reduce((s, r) => {
      return s + (parseFloat(orderEdits[r.productId]?.quantity_kg) || 0)
    }, 0)
    const orderedCount = orderedRows.length
    const conversionPct = selectedGroup.totalSamples > 0
      ? ((orderedCount / selectedGroup.totalSamples) * 100).toFixed(1)
      : '0'
    const hasUnsaved = selectedGroup.rows.some(r => dirtyIds.has(r.productId))
    const anyDecided = selectedGroup.rows.some(
      r => (orderEdits[r.productId]?.order_yes_no ?? r.orderYesNo) !== null
    )
    return { totalOrderQty, orderedCount, conversionPct, hasUnsaved, anyDecided }
  }, [selectedGroup, orderEdits, dirtyIds])

  // Keyboard nav
  useEffect(() => {
    if (selectedGroupIndex === null) return
    const handler = (e) => {
      if (e.key === 'Escape') setSelectedGroupIndex(null)
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedGroupIndex, goPrev, goNext])

  const scrollToProduct = (productId) => {
    productRefs.current[productId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="space-y-6">

        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
          <p className="text-slate-400 text-sm mt-1">Track sample conversions and order quantities</p>
        </div>

        {/* Filters + Summary */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-end gap-4 flex-wrap">

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Duration</label>
              <select value={duration} onChange={e => setDuration(e.target.value)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50">
                <option value="1">Last 1 Month</option>
                <option value="3">Last 3 Months</option>
                <option value="6">Last 6 Months</option>
                <option value="12">Last 12 Months</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Entry By</label>
              <select value={entryBy} onChange={e => setEntryBy(e.target.value)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50">
                <option value="all">All</option>
                <option value="shushil">Shushil Kumar</option>
                <option value="mukesh">Mukesh Shukla</option>
              </select>
            </div>

            {entryBy === 'shushil' && (
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Location</label>
                <select value={location} onChange={e => setLocation(e.target.value)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50">
                  <option value="all">All Locations</option>
                  <option value="mbd">Moradabad</option>
                  <option value="rest">Other Locations</option>
                </select>
              </div>
            )}

            {!loading && (
              <div className="flex items-center gap-3 ml-auto flex-wrap">
                <div className="bg-slate-100 rounded-xl px-4 py-2 text-center">
                  <p className="text-xs text-slate-400 font-medium">Total Samples</p>
                  <p className="text-xl font-black text-slate-700">{totalSamples}</p>
                </div>
                <div className="bg-green-50 rounded-xl px-4 py-2 text-center">
                  <p className="text-xs text-green-500 font-medium">Orders</p>
                  <p className="text-xl font-black text-green-700">{totalOrders}</p>
                </div>
                <div className="bg-violet-50 rounded-xl px-4 py-2 text-center">
                  <p className="text-xs text-violet-500 font-medium">Total Qty</p>
                  <p className="text-xl font-black text-violet-700">{totalQty > 0 ? `${totalQty} kg` : '—'}</p>
                </div>
                <div className={`rounded-xl px-4 py-2 text-center ${parseFloat(overallConversion) >= 50 ? 'bg-amber-50' : 'bg-red-50'}`}>
                  <p className={`text-xs font-medium ${parseFloat(overallConversion) >= 50 ? 'text-amber-500' : 'text-red-400'}`}>Conversion</p>
                  <p className={`text-xl font-black ${parseFloat(overallConversion) >= 50 ? 'text-amber-700' : 'text-red-500'}`}>{overallConversion}%</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center py-20">
            <p className="text-slate-400 text-base">Loading samples...</p>
          </div>
        ) : allRows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-20">
            <span className="text-5xl mb-4">📦</span>
            <p className="text-slate-400 text-base">No samples found for selected filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-200">
                    <th className="w-4 px-4 py-3.5" />
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Sales Person</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">City</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Product</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Sample Qty</th>
                    <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Order?</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Order Qty</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Remark</th>
                    <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap border-l-2 border-slate-200">Total Qty</th>
                    <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap border-l border-slate-200">Est. Qty/Sample</th>
                    <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap border-l border-slate-200">Conversion %</th>
                    <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Save</th>
                  </tr>
                </thead>
                <tbody>
                  {partyGroups.map((group, gi) => (
                    <>
                      {/* Clickable party header */}
                      <tr
                        key={`ph-${gi}`}
                        onClick={() => setSelectedGroupIndex(gi)}
                        className="bg-slate-100/80 border-t-2 border-slate-200 cursor-pointer hover:bg-violet-50 transition-colors group"
                      >
                        <td colSpan={13} className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-700 group-hover:text-violet-700 transition-colors">
                              {group.partyName}
                            </span>
                            <span className="text-xs text-slate-400 ml-1">
                              {group.totalSamples} sample{group.totalSamples > 1 ? 's' : ''}
                            </span>
                            {group.hasDirty && (
                              <span className="text-xs font-bold text-amber-500 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                Unsaved
                              </span>
                            )}
                            <span className="text-xs text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to open ↗
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Product rows */}
                      {group.rows.map((row, ri) => {
                        const isLast = ri === group.rows.length - 1
                        const edit = orderEdits[row.productId] || {}
                        const isSaved = savedIds.has(row.productId)
                        const isSaving = saving[row.productId]
                        const isDirty = dirtyIds.has(row.productId)

                        return (
                          <tr key={row.productId}
                            className={`border-b border-slate-100 transition-colors ${isDirty ? 'bg-amber-50/30' : 'hover:bg-violet-50/20'}`}>
                            <td className="px-4 py-3.5 border-r border-slate-100" />
                            <td className="px-4 py-3.5 text-sm font-semibold text-slate-700 whitespace-nowrap">{row.salesPerson || '—'}</td>
                            <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">{row.city || '—'}</td>
                            <td className="px-4 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                              {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-sm font-semibold text-slate-800">{row.productName}</p>
                              {row.matchedWith && <p className="text-xs text-slate-400 mt-0.5 italic">{row.matchedWith}</p>}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="min-w-[120px]">
                                <input
                                  type="text"
                                  value={row.quantity || ''}
                                  readOnly
                                  className="w-full px-3 py-2 bg-violet-50 border border-violet-100 rounded-xl text-sm font-bold text-violet-700 outline-none"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <div className="flex justify-center gap-1.5">
                                <button onClick={() => handleEdit(row.productId, 'order_yes_no', true)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${edit.order_yes_no === true ? 'bg-green-500 text-white shadow-sm' : 'bg-slate-100 text-slate-400 hover:bg-green-50 hover:text-green-600'}`}>
                                  Yes
                                </button>
                                <button onClick={() => handleEdit(row.productId, 'order_yes_no', false)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${edit.order_yes_no === false ? 'bg-red-400 text-white shadow-sm' : 'bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500'}`}>
                                  No
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              {edit.order_yes_no === true ? (
                                <div>
                                  <input
                                    type="text"
                                    value={qtyRaw[row.productId] ?? ''}
                                    onChange={e => handleQtyInput(row.productId, e.target.value)}
                                    className="w-28 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                    placeholder="e.g. 2x500gm"
                                  />
                                  {qtyRaw[row.productId] && parseQuantityToKg(qtyRaw[row.productId]) !== null &&
                                    !/^\d+(\.\d+)?$/.test(String(qtyRaw[row.productId]).trim()) && (
                                      <p className="text-xs text-violet-500 mt-0.5 font-semibold">
                                        = {parseQuantityToKg(qtyRaw[row.productId])} kg
                                      </p>
                                    )}
                                </div>
                              ) : (
                                <span className="text-sm text-slate-300">{edit.order_yes_no === false ? '0 kg' : '—'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <input type="text" value={edit.notes || ''}
                                onChange={e => handleEdit(row.productId, 'notes', e.target.value)}
                                className="w-36 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                placeholder="Add remark..." />
                            </td>

                            {isLast ? (
                              <>
                                <td className="px-4 py-3.5 text-center border-l-2 border-slate-200 bg-slate-50/60">
                                  <span className="text-base font-bold text-slate-800">
                                    {group.totalOrderQty > 0 ? `${group.totalOrderQty} kg` : '—'}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-center border-l border-slate-200 bg-slate-50/60">
                                  <span className="text-base font-bold text-violet-700">
                                    {group.totalOrderQty > 0 ? `${group.estimatedQtyPerSample} kg` : '—'}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-center border-l border-slate-200 bg-slate-50/60">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className={`text-base font-black ${parseFloat(group.conversionPct) === 100 ? 'text-green-600' :
                                      parseFloat(group.conversionPct) >= 50 ? 'text-amber-500' :
                                        group.rows.some(r => r.orderYesNo !== null) ? 'text-red-400' : 'text-slate-300'
                                      }`}>
                                      {group.rows.some(r => r.orderYesNo !== null) ? `${group.conversionPct}%` : '—'}
                                    </span>
                                    <span className="text-xs text-slate-400">{group.orderedCount}/{group.totalSamples}</span>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="border-l-2 border-slate-200 bg-slate-50/60" />
                                <td className="border-l border-slate-200 bg-slate-50/60" />
                                <td className="border-l border-slate-200 bg-slate-50/60" />
                              </>
                            )}

                            <td className="px-4 py-3.5 text-center">
                              {isSaved ? (
                                <span className="text-green-500 text-sm font-bold">✓</span>
                              ) : (
                                <button onClick={() => saveOrder(row.productId)}
                                  disabled={isSaving || edit.order_yes_no === null}
                                  className="px-3 py-1.5 rounded-lg text-white text-xs font-bold disabled:opacity-40 transition-all hover:opacity-90"
                                  style={{ background: '#7C3AED' }}>
                                  {isSaving ? '...' : 'Save'}
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            FULLSCREEN PARTY MODAL
        ══════════════════════════════════════════════════════ */}
        {selectedGroup && modalStats && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
            onClick={e => e.target === e.currentTarget && setSelectedGroupIndex(null)}
          >
            <div className="bg-white w-full max-w-5xl h-[96vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">

              {/* ── MODAL HEADER ── */}
              <div className="px-4 sm:px-7 py-4 border-b border-slate-100 bg-white shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-xl font-black text-slate-800 truncate">
                        {selectedGroup.partyName}
                      </h2>
                      <span className="text-xs font-bold bg-violet-100 text-violet-600 px-2.5 py-1 rounded-full shrink-0">
                        {selectedGroupIndex + 1} / {partyGroups.length}
                      </span>
                      {modalStats.hasUnsaved && (
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0 animate-pulse">
                          ● Unsaved changes
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-slate-400">{selectedGroup.totalSamples} samples</span>
                      <span className="text-xs font-bold text-violet-600">
                        {modalStats.totalOrderQty > 0 ? `${modalStats.totalOrderQty} kg` : 'No orders yet'}
                      </span>
                      <span className={`text-xs font-bold ${parseFloat(modalStats.conversionPct) >= 50 ? 'text-amber-500' : 'text-red-400'}`}>
                        {modalStats.anyDecided ? `${modalStats.conversionPct}% conversion` : 'Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={goPrev} disabled={selectedGroupIndex === 0}
                      className="px-2.5 sm:px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs sm:text-sm font-bold disabled:opacity-30 hover:bg-slate-200 transition-colors">
                      ←
                    </button>
                    <button onClick={goNext} disabled={selectedGroupIndex === partyGroups.length - 1}
                      className="px-2.5 sm:px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs sm:text-sm font-bold disabled:opacity-30 hover:bg-slate-200 transition-colors">
                      →
                    </button>
                    <button onClick={() => setSelectedGroupIndex(null)}
                      className="w-9 h-9 rounded-xl bg-red-50 text-red-400 font-black text-sm hover:bg-red-100 transition-colors ml-1">
                      ✕
                    </button>
                  </div>
                </div>

                {/* Product quick-jump pills */}
                {selectedGroup.rows.length > 1 && (
                  <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                    {selectedGroup.rows.map((row, idx) => {
                      const edit = orderEdits[row.productId] || {}
                      const isDirty = dirtyIds.has(row.productId)
                      const isSaved = savedIds.has(row.productId)
                      return (
                        <button
                          key={row.productId}
                          onClick={() => scrollToProduct(row.productId)}
                          className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${isSaved ? 'bg-green-50 text-green-600 border-green-200' :
                            isDirty ? 'bg-amber-50 text-amber-600 border-amber-200' :
                              edit.order_yes_no === true ? 'bg-violet-50 text-violet-600 border-violet-200' :
                                edit.order_yes_no === false ? 'bg-red-50 text-red-400 border-red-200' :
                                  'bg-slate-50 text-slate-500 border-slate-200'
                            }`}
                        >
                          {idx + 1}. {row.productName.length > 14 ? row.productName.slice(0, 13) + '…' : row.productName}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── SCROLLABLE BODY ── */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-7 py-4 sm:py-5 bg-slate-50/50 space-y-3">
                {selectedGroup.rows.map(row => {
                  const edit = orderEdits[row.productId] || {}
                  const isSaved = savedIds.has(row.productId)
                  const isSaving = saving[row.productId]
                  const isDirty = dirtyIds.has(row.productId)
                  const parsedKg = parseQuantityToKg(qtyRaw[row.productId])
                  const showHint = edit.order_yes_no === true &&
                    qtyRaw[row.productId] &&
                    parsedKg !== null &&
                    !/^\d+(\.\d+)?$/.test(String(qtyRaw[row.productId]).trim())

                  return (
                    <div
                      key={row.productId}
                      ref={el => { productRefs.current[row.productId] = el }}
                      className={`bg-white rounded-xl sm:rounded-2xl border p-4 sm:p-5 shadow-sm transition-all ${isSaved ? 'border-green-300 bg-green-50/20' :
                        isDirty ? 'border-amber-300 bg-amber-50/10' :
                          'border-slate-200'
                        }`}
                    >
                      {/* Product name row */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="text-sm font-black text-slate-800 leading-snug">{row.productName}</p>
                          {row.matchedWith && (
                            <p className="text-xs text-slate-400 italic mt-0.5">{row.matchedWith}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="min-w-[110px]">
                            <input
                              type="text"
                              value={row.quantity || ''}
                              readOnly
                              className="w-full px-3 py-2 bg-violet-50 border border-violet-100 rounded-xl text-xs font-bold text-violet-700 outline-none"
                            />
                          </div>
                          {isSaved && <span className="text-green-500 text-xs font-black">✓ Saved</span>}
                          {!isSaved && isDirty && <span className="text-amber-500 text-xs font-bold">● Unsaved</span>}
                        </div>
                      </div>

                      {/* Controls — responsive 2-col on mobile, 4-col on sm+ */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

                        {/* Order? */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Order?</p>
                          <div className="flex gap-1.5">
                            <button onClick={() => handleEdit(row.productId, 'order_yes_no', true)}
                              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${edit.order_yes_no === true
                                ? 'bg-green-500 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-500 hover:bg-green-50 hover:text-green-600'
                                }`}>Yes</button>
                            <button onClick={() => handleEdit(row.productId, 'order_yes_no', false)}
                              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${edit.order_yes_no === false
                                ? 'bg-red-400 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500'
                                }`}>No</button>
                          </div>
                        </div>

                        {/* Qty input with live parse hint */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                            Qty
                            {showHint && (
                              <span className="ml-1 text-violet-500 normal-case font-normal">= {parsedKg} kg</span>
                            )}
                          </p>
                          {edit.order_yes_no === true ? (
                            <input
                              type="text"
                              value={qtyRaw[row.productId] ?? ''}
                              onChange={e => handleQtyInput(row.productId, e.target.value)}
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400"
                              placeholder="e.g. 2x500gm"
                            />
                          ) : (
                            <div className="h-[42px] flex items-center text-slate-300 text-sm font-semibold px-1">
                              {edit.order_yes_no === false ? '0 kg' : '—'}
                            </div>
                          )}
                        </div>

                        {/* Remarks */}
                        <div className="col-span-2 sm:col-span-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Remarks</p>
                          <input
                            type="text"
                            value={edit.notes || ''}
                            onChange={e => handleEdit(row.productId, 'notes', e.target.value)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
                            placeholder="Add remarks..."
                          />
                        </div>

                        {/* Save */}
                        <div className="col-span-2 sm:col-span-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Save</p>
                          {isSaved ? (
                            <div className="h-[42px] flex items-center text-green-500 font-black text-sm gap-1">✓ Saved</div>
                          ) : (
                            <button
                              onClick={() => saveOrder(row.productId)}
                              disabled={isSaving || edit.order_yes_no === null}
                              className="w-full py-2.5 rounded-lg text-white text-xs font-bold disabled:opacity-40 transition-all hover:opacity-90"
                              style={{ background: '#7C3AED' }}
                            >
                              {isSaving ? 'Saving...' : isDirty ? 'Save ●' : 'Save'}
                            </button>
                          )}
                        </div>

                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ── STICKY FOOTER ── */}
              <div className="px-4 sm:px-7 py-3 border-t border-slate-100 bg-white shrink-0">
                <div className="flex items-center gap-3 sm:gap-5 flex-wrap">

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Total Qty</span>
                    <span className="text-sm font-black text-slate-700">
                      {modalStats.totalOrderQty > 0 ? `${modalStats.totalOrderQty} kg` : '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Conversion</span>
                    <span className={`text-sm font-black ${parseFloat(modalStats.conversionPct) >= 50 ? 'text-amber-500' : 'text-red-400'}`}>
                      {modalStats.anyDecided ? `${modalStats.conversionPct}%` : '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Ordered</span>
                    <span className="text-sm font-black text-slate-600">
                      {modalStats.orderedCount}/{selectedGroup.totalSamples}
                    </span>
                  </div>

                  {/* Bulk Save */}
                  <button
                    onClick={() => bulkSaveGroup(selectedGroup)}
                    disabled={bulkSaving || !modalStats.anyDecided}
                    className="ml-auto px-4 sm:px-5 py-2 rounded-xl text-white text-xs sm:text-sm font-black disabled:opacity-40 transition-all hover:opacity-90 flex items-center gap-2"
                    style={{ background: '#7C3AED' }}
                  >
                    {bulkSaving
                      ? 'Saving all...'
                      : modalStats.hasUnsaved
                        ? 'Save All ●'
                        : 'Save All'}
                  </button>

                  <span className="hidden sm:block text-xs text-slate-300">Esc · ← →</span>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}