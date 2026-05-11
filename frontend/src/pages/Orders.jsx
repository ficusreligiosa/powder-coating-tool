import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import Layout from '../components/Layout'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'

const SHUSHIL_ID = 2
const MUKESH_ID = 3

export default function Orders() {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [duration, setDuration] = useState('3')
  const [entryBy, setEntryBy] = useState('all')       // all | shushil | mukesh
  const [location, setLocation] = useState('all')     // all | mbd | rest
  const [saving, setSaving] = useState({})
  const [savedIds, setSavedIds] = useState(new Set())
  const [orderEdits, setOrderEdits] = useState({})

  const fetchSamples = async () => {
    setLoading(true)
    try {
      let url = `${API}/samples/?duration=${duration}`

      // Entry By filter
      if (entryBy === 'shushil') url += `&created_by=${SHUSHIL_ID}`
      else if (entryBy === 'mukesh') url += `&created_by=${MUKESH_ID}`

      // Location filter — sirf Shushil ke liye
      if (entryBy === 'shushil' && location !== 'all') {
        url += `&location=${location}`
      }

      const res = await axios.get(url, { headers })
      const data = res.data
      const edits = {}
      data.forEach(sample => {
        sample.products?.forEach(p => {
          edits[p.id] = {
            order_yes_no: p.order_detail?.order_yes_no ?? null,
            quantity_kg: p.order_detail?.quantity_kg ?? '',
            notes: p.order_detail?.notes ?? '',
          }
        })
      })
      setOrderEdits(edits)
      setSamples(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Location reset when entryBy changes away from shushil
    if (entryBy !== 'shushil') setLocation('all')
    fetchSamples()
  }, [duration, entryBy, location])

  const handleEdit = (productId, field, value) => {
    setOrderEdits(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
        ...(field === 'order_yes_no' && !value ? { quantity_kg: 0 } : {})
      }
    }))
  }

  const saveOrder = async (productId) => {
    setSaving(prev => ({ ...prev, [productId]: true }))
    try {
      const detail = orderEdits[productId] || {}
      await axios.put(`${API}/orders/${productId}`, {
        order_yes_no: detail.order_yes_no ?? false,
        quantity_kg: detail.quantity_kg || 0,
        notes: detail.notes || ''
      }, { headers })
      setSavedIds(prev => new Set([...prev, productId]))
      setTimeout(() => setSavedIds(prev => {
        const n = new Set(prev); n.delete(productId); return n
      }), 2000)
      fetchSamples()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(prev => ({ ...prev, [productId]: false }))
    }
  }

  // ── Flatten rows ───────────────────────────────────────────────
  const allRows = useMemo(() => {
    const rows = []
    samples.forEach(sample => {
      sample.products?.forEach(p => {
        const edit = orderEdits[p.id] || {}
        rows.push({
          productId: p.id,
          partyName: sample.party_name || sample.party_name_direct || 'Unknown',
          partyCode: sample.party_code,
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

  // ── Group by party ─────────────────────────────────────────────
  const partyGroups = useMemo(() => {
    const map = {}
    allRows.forEach(row => {
      if (!map[row.partyName]) map[row.partyName] = { partyName: row.partyName, partyCode: row.partyCode, rows: [] }
      map[row.partyName].rows.push(row)
    })
    return Object.values(map).map(g => {
      const totalSamples = g.rows.length
      const orderedRows = g.rows.filter(r => r.orderYesNo === true)
      const totalOrderQty = orderedRows.reduce((sum, r) => sum + (parseFloat(r.quantityKg) || 0), 0)
      const estimatedQtyPerSample = totalSamples > 0 ? (totalOrderQty / totalSamples).toFixed(1) : '0'
      const conversionPct = totalSamples > 0 ? ((orderedRows.length / totalSamples) * 100).toFixed(1) : '0'
      return { ...g, totalSamples, totalOrderQty, estimatedQtyPerSample, conversionPct, orderedCount: orderedRows.length }
    }).sort((a, b) => a.partyName.localeCompare(b.partyName))
  }, [allRows])

  // ── Summary stats ─────────────────────────────────────────────
  const totalSamples = allRows.length
  const totalOrders = allRows.filter(r => r.orderYesNo === true).length
  const totalQty = allRows.filter(r => r.orderYesNo === true).reduce((s, r) => s + (parseFloat(r.quantityKg) || 0), 0)
  const overallConversion = totalSamples > 0 ? ((totalOrders / totalSamples) * 100).toFixed(1) : '0'

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
          <p className="text-slate-400 text-sm mt-1">Track sample conversions and order quantities</p>
        </div>

        {/* Filters + Summary */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-end gap-4 flex-wrap">

            {/* Duration */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Duration</label>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
              >
                <option value="1">Last 1 Month</option>
                <option value="3">Last 3 Months</option>
                <option value="6">Last 6 Months</option>
                <option value="12">Last 12 Months</option>
              </select>
            </div>

            {/* Entry By */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Entry By</label>
              <select
                value={entryBy}
                onChange={e => setEntryBy(e.target.value)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
              >
                <option value="all">All</option>
                <option value="shushil">Shushil Kumar</option>
                <option value="mukesh">Mukesh Shukla</option>
              </select>
            </div>

            {/* Location — sirf Shushil ke liye */}
            {entryBy === 'shushil' && (
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Location</label>
                <select
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
                >
                  <option value="all">All Locations</option>
                  <option value="mbd">Moradabad</option>
                  <option value="rest">Other Locations</option>
                </select>
              </div>
            )}

            {/* Summary pills */}
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

        {/* Table */}
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
                    <th className="w-4 px-4 py-3.5"></th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Sales Person</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">City</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Product</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Sample Qty</th>
                    <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Order?</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Order Qty (kg)</th>
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
                      {/* Party header */}
                      <tr key={`ph-${gi}`} className="bg-slate-100/80 border-t-2 border-slate-200">
                        <td colSpan={13} className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-700">{group.partyName}</span>
                            {group.partyCode && (
                              <span className="text-xs font-mono bg-white text-slate-500 border border-slate-200 px-2 py-0.5 rounded">
                                {group.partyCode}
                              </span>
                            )}
                            <span className="text-xs text-slate-400 ml-1">
                              {group.totalSamples} sample{group.totalSamples > 1 ? 's' : ''}
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

                        return (
                          <tr key={row.productId} className="border-b border-slate-100 hover:bg-violet-50/20 transition-colors">
                            <td className="px-4 py-3.5 border-r border-slate-100" />

                            <td className="px-4 py-3.5 text-sm font-semibold text-slate-700 whitespace-nowrap">
                              {row.salesPerson || '—'}
                            </td>

                            <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                              {row.city || '—'}
                            </td>

                            <td className="px-4 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                              {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>

                            <td className="px-4 py-3.5">
                              <p className="text-sm font-semibold text-slate-800">{row.productName}</p>
                              {row.matchedWith && (
                                <p className="text-xs text-slate-400 mt-0.5 italic">{row.matchedWith}</p>
                              )}
                            </td>

                            <td className="px-4 py-3.5">
                              <span className="text-sm bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap">
                                {row.quantity}
                              </span>
                            </td>

                            <td className="px-4 py-3.5 text-center">
                              <div className="flex justify-center gap-1.5">
                                <button
                                  onClick={() => handleEdit(row.productId, 'order_yes_no', true)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    edit.order_yes_no === true
                                      ? 'bg-green-500 text-white shadow-sm'
                                      : 'bg-slate-100 text-slate-400 hover:bg-green-50 hover:text-green-600'
                                  }`}
                                >Yes</button>
                                <button
                                  onClick={() => handleEdit(row.productId, 'order_yes_no', false)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    edit.order_yes_no === false
                                      ? 'bg-red-400 text-white shadow-sm'
                                      : 'bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500'
                                  }`}
                                >No</button>
                              </div>
                            </td>

                            <td className="px-4 py-3.5">
                              {edit.order_yes_no === true ? (
                                <input
                                  type="number"
                                  value={edit.quantity_kg}
                                  onChange={e => handleEdit(row.productId, 'quantity_kg', parseFloat(e.target.value) || '')}
                                  className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                  placeholder="0"
                                  min="0"
                                />
                              ) : (
                                <span className="text-sm text-slate-300">
                                  {edit.order_yes_no === false ? '0 kg' : '—'}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5">
                              <input
                                type="text"
                                value={edit.notes || ''}
                                onChange={e => handleEdit(row.productId, 'notes', e.target.value)}
                                className="w-36 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                placeholder="Add remark..."
                              />
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
                                    <span className={`text-base font-black ${
                                      parseFloat(group.conversionPct) === 100 ? 'text-green-600' :
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
                                <button
                                  onClick={() => saveOrder(row.productId)}
                                  disabled={isSaving || edit.order_yes_no === null}
                                  className="px-3 py-1.5 rounded-lg text-white text-xs font-bold disabled:opacity-40 transition-all hover:opacity-90"
                                  style={{ background: '#7C3AED' }}
                                >
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

      </div>
    </Layout>
  )
}