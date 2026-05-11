import { useState, useEffect } from 'react'
import axios from 'axios'
import Layout from '../components/Layout'

const API = '${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'}'

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  const [pendingSamples, setPendingSamples] = useState([])
  const [remark, setRemark] = useState({})
  const [completing, setCompleting] = useState(null)
  const [success, setSuccess] = useState('')

  // Stats state
  const [statsLoading, setStatsLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [ordersThisMonth, setOrdersThisMonth] = useState(0)
  const [conversionRate, setConversionRate] = useState(null)

  useEffect(() => {
    fetchStats()
    if (user.role === 'data_entry' || user.role === 'admin') {
      fetchPending()
    }
  }, [])

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      // Fetch pending count
      const pendingRes = await axios.get(`${API}/samples/pending`, { headers })
      setPendingCount(pendingRes.data.length)

      // Fetch last 1 month samples for orders received + conversion
      const samplesRes = await axios.get(`${API}/samples/?duration=1`, { headers })
      const samples = samplesRes.data

      // Count order details
      let totalProducts = 0
      let orderedProducts = 0
      samples.forEach(s => {
        s.products?.forEach(p => {
          totalProducts++
          if (p.order_detail?.order_yes_no === true) orderedProducts++
        })
      })

      setOrdersThisMonth(orderedProducts)
      setConversionRate(
        totalProducts > 0 ? ((orderedProducts / totalProducts) * 100).toFixed(1) : 0
      )
    } catch (err) {
      console.error('Stats fetch error:', err)
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchPending = async () => {
    try {
      const res = await axios.get(`${API}/samples/pending`, { headers })
      setPendingSamples(res.data)
      setPendingCount(res.data.length)
    } catch (err) {
      console.error(err)
    }
  }

  const markComplete = async (sampleId) => {
    setCompleting(sampleId)
    try {
      await axios.put(`${API}/samples/${sampleId}/complete`, {
        shushil_remark: remark[sampleId] || ''
      }, { headers })
      setSuccess('Sample marked as complete!')
      setTimeout(() => setSuccess(''), 3000)
      fetchPending()
      fetchStats()
    } catch (err) {
      console.error(err)
    } finally {
      setCompleting(null)
    }
  }

  const stats = [
    {
      label: 'Pending Orders',
      value: statsLoading ? '...' : pendingCount,
      sub: 'Waiting for completion',
      color: '#F59E0B',
      bg: '#FEF3C7',
    },
    {
      label: 'Orders Received',
      value: statsLoading ? '...' : ordersThisMonth,
      sub: 'This month',
      color: '#059669',
      bg: '#D1FAE5',
    },
    {
      label: 'Conversion Rate',
      value: statsLoading ? '...' : conversionRate !== null ? `${conversionRate}%` : '--%',
      sub: 'Last 1 month',
      color: '#0EA5E9',
      bg: '#E0F2FE',
    },
  ]

  const actions = [
    { label: 'Add Sample', href: '/samples/add', color: '#7C3AED', roles: ['data_entry', 'admin', 'salesperson'], desc: 'Record new sample entry' },
    { label: 'View Samples', href: '/samples', color: '#059669', roles: ['data_entry', 'calculation', 'admin', 'salesperson'], desc: 'Browse all samples' },
    { label: 'Fill Orders', href: '/orders', color: '#0EA5E9', roles: ['calculation', 'admin'], desc: 'Update order details' },
    { label: 'Admin Panel', href: '/admin', color: '#64748B', roles: ['admin'], desc: 'Manage users & data' },
  ].filter(a => a.roles.includes(user.role))

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl">

        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Good day, {user.full_name?.split(' ')[0]}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Here's what's happening today.
          </p>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl text-sm">
            ✅ {success}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-5">
          {stats.map((stat) => (
            <div key={stat.label}
              className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <h3 className={`text-3xl font-black mt-2 ${statsLoading ? 'text-slate-300' : 'text-slate-800'}`}>
                    {stat.value}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: stat.bg }}>
                  <div className="w-4 h-4 rounded-full" style={{ background: stat.color }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {actions.map((action) => (
              <a key={action.label} href={action.href}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200 group">
                <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center"
                  style={{ background: action.color + '18' }}>
                  <div className="w-3.5 h-3.5 rounded-full" style={{ background: action.color }}></div>
                </div>
                <h3 className="font-bold text-slate-800 text-sm group-hover:text-violet-600 transition-colors">
                  {action.label}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{action.desc}</p>
              </a>
            ))}
          </div>
        </div>

        {/* Pending Orders — Shushil Ji / Admin only */}
        {(user.role === 'data_entry' || user.role === 'admin') && (
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Pending Orders ({pendingSamples.length})
            </h2>

            {pendingSamples.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
                <span className="text-3xl">✅</span>
                <p className="text-slate-400 text-sm mt-2">No pending orders!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingSamples.map(sample => (
                  <div key={sample.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">

                        {/* Header */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 font-semibold border border-amber-100">
                            ⏳ Pending
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(sample.order_received_date).toLocaleDateString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric'
                            })}
                          </span>
                        </div>

                        {/* Sales Person + City */}
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-base font-bold text-slate-800">
                            {sample.sales_person_name || '—'}
                          </p>
                          {sample.city_name && (
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                              📍 {sample.city_name}
                            </span>
                          )}
                        </div>

                        {/* Products */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {sample.products?.map(p => (
                            <span key={p.id}
                              className="text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-lg font-semibold">
                              {p.product_name} · {p.quantity}
                            </span>
                          ))}
                        </div>

                        {/* Salesperson Remark */}
                        {sample.salesperson_remark && (
                          <p className="text-xs text-slate-500 mt-2 italic">
                            💬 "{sample.salesperson_remark}"
                          </p>
                        )}

                        {/* Shushil Remark Input */}
                        <div className="mt-3">
                          <input
                            type="text"
                            placeholder="Add remark (optional)..."
                            value={remark[sample.id] || ''}
                            onChange={e => setRemark(r => ({ ...r, [sample.id]: e.target.value }))}
                            className="w-full max-w-sm px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                        </div>
                      </div>

                      {/* Mark Complete */}
                      <button
                        onClick={() => markComplete(sample.id)}
                        disabled={completing === sample.id}
                        className="flex-shrink-0 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all whitespace-nowrap"
                        style={{ background: '#059669' }}
                      >
                        {completing === sample.id ? 'Marking...' : '✅ Mark Complete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  )
}