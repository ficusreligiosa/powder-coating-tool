import { useState, useEffect } from 'react'
import axios from 'axios'
import Layout from '../components/Layout'

const API = 'http://127.0.0.1:5000/api'

export default function Samples() {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [duration, setDuration] = useState('')
  const [location, setLocation] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchSamples = async () => {
    setLoading(true)
    try {
      let url = `${API}/samples?`
      if (duration) url += `duration=${duration}&`
      if (location !== 'all') url += `location=${location}&`
      if (statusFilter !== 'all') url += `status=${statusFilter}`
      const res = await axios.get(url, { headers })
      setSamples(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSamples() }, [duration, location, statusFilter])

  const renderParty = (sample) => {
    if (user.role === 'data_entry') {
      return (
        <span className="font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-sm font-semibold">
          {sample.party_code || '—'}
        </span>
      )
    }
    if (user.role === 'salesperson') {
      return (
        <span className="text-base font-semibold text-slate-800">
          {sample.party_name || '—'}
        </span>
      )
    }
    // admin + calculation — dono dikhe
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-semibold text-slate-800">
          {sample.party_name || '—'}
        </span>
        {sample.party_code && (
          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded w-fit">
            {sample.party_code}
          </span>
        )}
      </div>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {user.role === 'salesperson' ? 'My Requests' : 'Samples'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {samples.length} records found
            </p>
          </div>
          {(user.role === 'admin' || user.role === 'data_entry' || user.role === 'salesperson') && (
            <a
              href="/samples/add"
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
              style={{ background: '#7C3AED' }}
            >
              + New Request
            </a>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex flex-wrap items-end gap-6">

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Duration
              </label>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
              >
                <option value="">All Time</option>
                <option value="1">Last 1 Month</option>
                <option value="3">Last 3 Months</option>
                <option value="6">Last 6 Months</option>
                <option value="12">Last 12 Months</option>
              </select>
            </div>

            {user.role !== 'salesperson' && (
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Location
                </label>
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

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Status
              </label>
              <div className="flex gap-1.5">
                {['all', 'pending', 'completed'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize ${
                      statusFilter === s
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {s === 'all' ? 'All' : s === 'pending' ? 'Pending' : 'Completed'}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-slate-400 text-base">Loading...</div>
            </div>
          ) : samples.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <span className="text-5xl mb-4">🧪</span>
              <p className="text-slate-400 text-base">No samples found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-100 bg-slate-50">
                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Date
                    </th>
                    {user.role !== 'salesperson' && (
                      <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Sales Person
                      </th>
                    )}
                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {user.role === 'data_entry' ? 'Party Code' : 'Party'}
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      City
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Products
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {samples.map(sample => (
                    <tr key={sample.id} className="hover:bg-violet-50/30 transition-colors">

                      {/* Date */}
                      <td className="px-6 py-5 text-sm font-medium text-slate-500 whitespace-nowrap">
                        {new Date(sample.order_received_date).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })}
                      </td>

                      {/* Sales Person */}
                      {user.role !== 'salesperson' && (
                        <td className="px-6 py-5">
                          <span className="text-base font-semibold text-slate-800">
                            {sample.sales_person_name || '—'}
                          </span>
                        </td>
                      )}

                      {/* Party */}
                      <td className="px-6 py-5">
                        {renderParty(sample)}
                      </td>

                      {/* City */}
                      <td className="px-6 py-5">
                        <span className="text-base font-medium text-slate-700">
                          {sample.city_name || '—'}
                        </span>
                      </td>

                      {/* Products */}
                      <td className="px-6 py-5">
                        <div className="space-y-3">
                          {sample.products?.map((p, idx) => (
                            <div key={p.id} className="flex items-start gap-3">
                              {/* Product number badge */}
                              <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-xs font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <div className="flex flex-col gap-1">
                                <span className="text-base font-semibold text-slate-800 leading-tight">
                                  {p.product_name}
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-0.5 rounded-lg font-semibold">
                                    {p.quantity}
                                  </span>
                                  {p.matched_with && (
                                    <span className="text-sm text-slate-400 italic">
                                      {p.matched_with}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-5">
                        <span className={`text-sm px-3 py-1.5 rounded-full font-semibold ${
                          sample.status === 'completed'
                            ? 'bg-green-50 text-green-700 border border-green-100'
                            : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {sample.status === 'completed' ? '✓ Completed' : '⏳ Pending'}
                        </span>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}