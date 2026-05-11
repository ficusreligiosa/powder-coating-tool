import { useState, useEffect } from 'react'
import axios from 'axios'
import Layout from '../components/Layout'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'

export default function Admin() {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [parties, setParties] = useState([])
  const [cities, setCities] = useState([])
  const [salespersons, setSalespersons] = useState([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importCreatedBy, setImportCreatedBy] = useState('')

  const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', role: 'data_entry', salesperson_id: '' })
  const [newParty, setNewParty] = useState({ party_name: '', phone_number: '', sales_person_name: '' })
  const [newCity, setNewCity] = useState({ name: '', state: '', is_moradabad: false })
  const [newSP, setNewSP] = useState({ name: '', phone_number: '' })

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [u, p, c, s] = await Promise.all([
        axios.get(`${API}/users`, { headers }),
        axios.get(`${API}/parties`, { headers }),
        axios.get(`${API}/cities`, { headers }),
        axios.get(`${API}/salespersons`, { headers }),
      ])
      setUsers(u.data)
      setParties(p.data)
      setCities(c.data)
      setSalespersons(s.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  const showError = (msg) => { setError(msg); setTimeout(() => setError(''), 3000) }

  const handleImport = async (type, file) => {
    if (!file) return
    if (type === 'samples' && !importCreatedBy) { showError('Please select whose sheet you are importing'); return }
    setImporting(true)
    setImportResult(null)
    const formData = new FormData()
    formData.append('file', file)
    if (type === 'samples') formData.append('created_by', importCreatedBy)
    try {
      const res = await axios.post(`${API}/import/${type}`, formData, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } })
      setImportResult({ type: 'success', ...res.data })
      setImportCreatedBy('')
      fetchAll()
    } catch (err) {
      setImportResult({ type: 'error', message: err.response?.data?.message || 'Import failed' })
    } finally {
      setImporting(false)
    }
  }

  const addUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.full_name) { showError('Sab fields bharo'); return }
    try {
      await axios.post(`${API}/users`, newUser, { headers })
      showSuccess('User add ho gaya!')
      setNewUser({ username: '', password: '', full_name: '', role: 'data_entry', salesperson_id: '' })
      fetchAll()
    } catch (err) { showError(err.response?.data?.message || 'Error adding user') }
  }

  const addParty = async () => {
    if (!newParty.party_name) { showError('Party name daalo'); return }
    try {
      await axios.post(`${API}/parties`, newParty, { headers })
      showSuccess('Party add ho gayi!')
      setNewParty({ party_name: '', phone_number: '', sales_person_name: '' })
      fetchAll()
    } catch (err) { showError(err.response?.data?.message || 'Error adding party') }
  }

  const addCity = async () => {
    if (!newCity.name) { showError('City name daalo'); return }
    try {
      await axios.post(`${API}/cities`, newCity, { headers })
      showSuccess('City add ho gayi!')
      setNewCity({ name: '', state: '', is_moradabad: false })
      fetchAll()
    } catch (err) { showError(err.response?.data?.message || 'Error adding city') }
  }

  const addSP = async () => {
    if (!newSP.name) { showError('Name daalo'); return }
    try {
      await axios.post(`${API}/salespersons`, newSP, { headers })
      showSuccess('Salesperson add ho gaya!')
      setNewSP({ name: '', phone_number: '' })
      fetchAll()
    } catch (err) { showError(err.response?.data?.message || 'Error adding salesperson') }
  }

  const tabs = [
    { id: 'users', label: 'Users', icon: '👤' },
    { id: 'parties', label: 'Parties', icon: '🏢' },
    { id: 'salespersons', label: 'Salespersons', icon: '🧑‍💼' },
    { id: 'cities', label: 'Cities', icon: '📍' },
    { id: 'import', label: 'Import', icon: '📥' },
  ]

  const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
  const btnCls = "px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all"

  return (
    <Layout>
      <div className="max-w-5xl space-y-5">

        {/* Alerts */}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">✅ {success}</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">❌ {error}</div>}

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Add User Form */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4">➕ Naya User Add Karo</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Full Name *" value={newUser.full_name} onChange={e => setNewUser(u => ({ ...u, full_name: e.target.value }))} />
                <input className={inputCls} placeholder="Username *" value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} />
                <input className={inputCls} type="password" placeholder="Password *" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
                <select className={inputCls} value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                  <option value="data_entry">Data Entry</option>
                  <option value="salesperson">Salesperson</option>
                  <option value="calculation">Calculation</option>
                  <option value="admin">Admin</option>
                </select>
                {newUser.role === 'salesperson' && (
                  <select className={inputCls} value={newUser.salesperson_id} onChange={e => setNewUser(u => ({ ...u, salesperson_id: e.target.value }))}>
                    <option value="">Link Salesperson (optional)</option>
                    {salespersons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>
              <button onClick={addUser} className={`${btnCls} mt-4`} style={{ background: '#7C3AED' }}>
                Add User
              </button>
            </div>

            {/* Users List */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700">Users ({users.length})</h3>
              </div>
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {users.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #7C3AED, #059669)' }}>
                          {u.full_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{u.full_name}</p>
                          <p className="text-xs text-slate-400">@{u.username}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        u.role === 'admin' ? 'bg-violet-100 text-violet-700' :
                        u.role === 'salesperson' ? 'bg-blue-100 text-blue-700' :
                        u.role === 'data_entry' ? 'bg-green-100 text-green-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {u.role?.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PARTIES TAB */}
        {activeTab === 'parties' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4">➕ Nayi Party Add Karo</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Party Name *" value={newParty.party_name} onChange={e => setNewParty(p => ({ ...p, party_name: e.target.value }))} />
                <input className={inputCls} placeholder="Phone Number" value={newParty.phone_number} onChange={e => setNewParty(p => ({ ...p, phone_number: e.target.value }))} />
                <input className={inputCls} placeholder="Sales Person Name" value={newParty.sales_person_name} onChange={e => setNewParty(p => ({ ...p, sales_person_name: e.target.value }))} />
              </div>
              <button onClick={addParty} className={`${btnCls} mt-4`} style={{ background: '#7C3AED' }}>
                Add Party
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700">Parties ({parties.length})</h3>
              </div>
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {parties.slice(0, 100).map(p => (
                    <div key={p.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{p.party_name}</p>
                        <p className="text-xs text-slate-400 font-mono">{p.party_code}</p>
                      </div>
                      {p.phone_number && <span className="text-xs text-slate-400">{p.phone_number}</span>}
                    </div>
                  ))}
                  {parties.length > 100 && (
                    <div className="px-5 py-3 text-xs text-slate-400 text-center">
                      +{parties.length - 100} more parties
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SALESPERSONS TAB */}
        {activeTab === 'salespersons' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4">➕ Naya Salesperson Add Karo</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Name *" value={newSP.name} onChange={e => setNewSP(s => ({ ...s, name: e.target.value }))} />
                <input className={inputCls} placeholder="Phone Number" value={newSP.phone_number} onChange={e => setNewSP(s => ({ ...s, phone_number: e.target.value }))} />
              </div>
              <button onClick={addSP} className={`${btnCls} mt-4`} style={{ background: '#7C3AED' }}>
                Add Salesperson
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700">Salespersons ({salespersons.length})</h3>
              </div>
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {salespersons.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold">
                          {s.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                          {s.phone_number && <p className="text-xs text-slate-400">{s.phone_number}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CITIES TAB */}
        {activeTab === 'cities' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4">➕ Nayi City Add Karo</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={inputCls} placeholder="City Name *" value={newCity.name} onChange={e => setNewCity(c => ({ ...c, name: e.target.value }))} />
                <input className={inputCls} placeholder="State" value={newCity.state} onChange={e => setNewCity(c => ({ ...c, state: e.target.value }))} />
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={newCity.is_moradabad} onChange={e => setNewCity(c => ({ ...c, is_moradabad: e.target.checked }))} className="rounded" />
                  Moradabad city hai?
                </label>
              </div>
              <button onClick={addCity} className={`${btnCls} mt-4`} style={{ background: '#7C3AED' }}>
                Add City
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700">Cities ({cities.length})</h3>
              </div>
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {cities.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                        <p className="text-xs text-slate-400">{c.state}</p>
                      </div>
                      {c.is_moradabad && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">MBD</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* IMPORT TAB */}
        {activeTab === 'import' && (
          <div className="space-y-4">
            {importResult && (
              <div className={`px-4 py-3 rounded-xl text-sm border ${
                importResult.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {importResult.type === 'success' ? (
                  <div>
                    <p className="font-semibold">✅ {importResult.message}</p>
                    <p className="mt-1">Imported: {importResult.success} | Skipped: {importResult.skipped}</p>
                    {importResult.errors?.length > 0 && <p className="mt-1 text-xs text-red-500">Errors: {importResult.errors.join(', ')}</p>}
                  </div>
                ) : <p>❌ {importResult.message}</p>}
              </div>
            )}

            {/* Party Import */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Import Party Master</h3>
                  <p className="text-xs text-slate-400 mt-0.5">CSV: UNIQUE ID, PARTY NAME, PHONE NUMBER, STATION, SALES PERSON NAME</p>
                </div>
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium flex-shrink-0">Party Master Sheet</span>
              </div>
              <input type="file" accept=".csv" onChange={e => handleImport('parties', e.target.files[0])} disabled={importing}
                className="text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100" />
              {importing && <span className="text-xs text-slate-400 animate-pulse ml-3">Importing...</span>}
            </div>

            {/* Sample Import */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Import Sample History</h3>
                  <p className="text-xs text-slate-400 mt-0.5">CSV: Timestamp, Sales Person Name, Party Name, Station, Order Recieved Date, Product Name 1, Product 1 Qty, Matched With</p>
                </div>
                <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full font-medium flex-shrink-0">Dev Status Sheet</span>
              </div>

              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <label className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-2">
                  Select whose sheet you are importing
                </label>
                <select value={importCreatedBy} onChange={e => setImportCreatedBy(e.target.value)}
                  className="px-3 py-2 border border-amber-300 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                  <option value="">-- Select --</option>
                  <option value="2">Shushil Kumar</option>
                  <option value="3">Mukesh Shukla</option>
                </select>
              </div>

              <input type="file" accept=".csv"
                onChange={e => handleImport('samples', e.target.files[0])}
                disabled={importing || !importCreatedBy}
                className={`text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium ${
                  importCreatedBy ? 'file:bg-green-50 file:text-green-700 hover:file:bg-green-100' : 'file:bg-slate-100 file:text-slate-400 opacity-50 cursor-not-allowed'
                }`} />
              {!importCreatedBy && <span className="text-xs text-amber-500 font-medium ml-3">Select user first</span>}
              {importing && <span className="text-xs text-slate-400 animate-pulse ml-3">Importing...</span>}
            </div>

            {/* Instructions */}
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Import Instructions</h3>
              <div className="space-y-1.5 text-xs text-slate-500">
                <p>1. Download CSV from Google Sheets</p>
                <p>2. Import Party Master first</p>
                <p>3. Then import Sample History</p>
                <p>4. Select whose sheet you are importing</p>
                <p>5. Duplicate entries will be skipped automatically</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}