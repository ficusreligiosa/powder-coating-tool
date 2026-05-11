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

  // Import state
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importCreatedBy, setImportCreatedBy] = useState('')

  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'data_entry',
    salesperson_id: ''
  })

  const [newParty, setNewParty] = useState({
    party_name: '',
    phone_number: '',
    sales_person_name: ''
  })

  const [newCity, setNewCity] = useState({
    name: '',
    state: '',
    is_moradabad: false
  })

  const [newSP, setNewSP] = useState({
    name: '',
    phone_number: ''
  })

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

  useEffect(() => {
    fetchAll()
  }, [])

  const showSuccess = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const showError = (msg) => {
    setError(msg)
    setTimeout(() => setError(''), 3000)
  }

  // IMPORT FUNCTION
  const handleImport = async (type, file) => {
    if (!file) return

    if (type === 'samples' && !importCreatedBy) {
      showError('Please select whose sheet you are importing')
      return
    }

    setImporting(true)
    setImportResult(null)

    const formData = new FormData()
    formData.append('file', file)

    if (type === 'samples') {
      formData.append('created_by', importCreatedBy)
    }

    try {
      const res = await axios.post(
        `${API}/import/${type}`,
        formData,
        {
          headers: {
            ...headers,
            'Content-Type': 'multipart/form-data'
          }
        }
      )

      setImportResult({
        type: 'success',
        ...res.data
      })

      setImportCreatedBy('')
      fetchAll()

    } catch (err) {

      setImportResult({
        type: 'error',
        message: err.response?.data?.message || 'Import failed'
      })

    } finally {
      setImporting(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-5 max-w-5xl">

        {/* IMPORT TAB */}
        <div className="space-y-4">

          {importResult && (
            <div
              className={`px-4 py-3 rounded-xl text-sm border ${
                importResult.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {importResult.type === 'success' ? (
                <div>
                  <p className="font-semibold">
                    ✅ {importResult.message}
                  </p>

                  <p className="mt-1">
                    Imported: {importResult.success} |
                    Skipped: {importResult.skipped}
                  </p>

                  {importResult.errors?.length > 0 && (
                    <p className="mt-1 text-xs text-red-500">
                      Errors: {importResult.errors.join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <p>❌ {importResult.message}</p>
              )}
            </div>
          )}

          {/* PARTY MASTER IMPORT */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">

            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">
                  Import Party Master
                </h3>

                <p className="text-xs text-slate-400 mt-0.5">
                  CSV columns:
                  UNIQUE ID, PARTY NAME, PHONE NUMBER,
                  STATION, SALES PERSON NAME
                </p>
              </div>

              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium">
                Party Master Sheet
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".csv"
                onChange={(e) =>
                  handleImport('parties', e.target.files[0])
                }
                disabled={importing}
                className="text-sm text-slate-600
                  file:mr-3
                  file:py-2
                  file:px-4
                  file:rounded-lg
                  file:border-0
                  file:text-sm
                  file:font-medium
                  file:bg-violet-50
                  file:text-violet-700
                  hover:file:bg-violet-100"
              />

              {importing && (
                <span className="text-xs text-slate-400 animate-pulse">
                  Importing...
                </span>
              )}
            </div>
          </div>

          {/* SAMPLE HISTORY IMPORT */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">

            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">
                  Import Sample History
                </h3>

                <p className="text-xs text-slate-400 mt-0.5">
                  CSV columns:
                  Timestamp, Sales Person Name,
                  Party Name, Station,
                  Order Recieved Date,
                  Product Name 1,
                  Product 1 Qty,
                  Matched With
                </p>
              </div>

              <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full font-medium">
                Development Status Sheet
              </span>
            </div>

            {/* SELECT WHOSE SHEET */}
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">

              <label className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-2">
                Select whose sheet you are importing
              </label>

              <select
                value={importCreatedBy}
                onChange={(e) => setImportCreatedBy(e.target.value)}
                className="px-3 py-2 border border-amber-300 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="">
                  -- Select --
                </option>

                <option value="2">
                  Shushil Kumar
                </option>

                <option value="3">
                  Mukesh Shukla
                </option>
              </select>

              {importCreatedBy && (
                <p className="text-xs text-amber-600 mt-2">
                  ✓ This import will be counted under{' '}
                  <strong>
                    {importCreatedBy === '2'
                      ? 'Shushil Kumar'
                      : 'Mukesh Shukla'}
                  </strong>
                </p>
              )}
            </div>

            {/* FILE INPUT */}
            <div className="flex items-center gap-3">

              <input
                type="file"
                accept=".csv"
                onChange={(e) =>
                  handleImport('samples', e.target.files[0])
                }
                disabled={importing || !importCreatedBy}
                className={`text-sm text-slate-600
                  file:mr-3
                  file:py-2
                  file:px-4
                  file:rounded-lg
                  file:border-0
                  file:text-sm
                  file:font-medium
                  ${
                    importCreatedBy
                      ? 'file:bg-green-50 file:text-green-700 hover:file:bg-green-100'
                      : 'file:bg-slate-100 file:text-slate-400 opacity-50 cursor-not-allowed'
                  }`}
              />

              {!importCreatedBy && (
                <span className="text-xs text-amber-500 font-medium">
                  Select user first
                </span>
              )}

              {importing && (
                <span className="text-xs text-slate-400 animate-pulse">
                  Importing...
                </span>
              )}
            </div>
          </div>

          {/* INSTRUCTIONS */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">

            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Import Instructions
            </h3>

            <div className="space-y-2 text-xs text-slate-500">
              <p>
                1. Download CSV from Google Sheets
              </p>

              <p>
                2. Import Party Master first
              </p>

              <p>
                3. Then import Sample History
              </p>

              <p>
                4. Select whose sheet you are importing
              </p>

              <p>
                5. Duplicate entries will be skipped automatically
              </p>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  )
}