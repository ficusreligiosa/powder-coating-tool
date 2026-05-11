import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Layout from '../components/Layout'

const API = '${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'}'

export default function AddSample() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const [salespersons, setSalespersons] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Party search
  const [partySearch, setPartySearch] = useState('')
  const [partyResults, setPartyResults] = useState([])
  const [selectedParty, setSelectedParty] = useState(null)
  const [showAddParty, setShowAddParty] = useState(false)
  const [newParty, setNewParty] = useState({ party_name: '', phone_number: '' })
  const [addingParty, setAddingParty] = useState(false)

  // City search
  const [citySearch, setCitySearch] = useState('')
  const [cityResults, setCityResults] = useState([])
  const [selectedCity, setSelectedCity] = useState(null)
  const [selectedState, setSelectedState] = useState('')

  const [form, setForm] = useState({
    sales_person_id: '',
    party_id: '',
    party_name_direct: '',
    city_id: '',
    salesperson_remark: '',
    products: [{ product_name: '', quantity: '', matched_with: '' }]
  })

  useEffect(() => {
    if (user.role === 'admin') {
      axios.get(`${API}/salespersons`, { headers }).then(r => setSalespersons(r.data))
    }
  }, [])

  // Party search
  useEffect(() => {
    if (partySearch.length < 1) {
      setPartyResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/parties/search?q=${partySearch}`, { headers })
        setPartyResults(res.data)
      } catch (err) {
        console.error(err)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [partySearch])

  // City search
  useEffect(() => {
    if (citySearch.length < 1) {
      setCityResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/cities/search?q=${citySearch}`, { headers })
        setCityResults(res.data)
      } catch (err) {
        console.error(err)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [citySearch])

  const selectParty = (party) => {
    setSelectedParty(party)
    setPartySearch(party.party_name)
    setPartyResults([])
    setForm(f => ({ ...f, party_id: party.id, party_name_direct: '' }))
    setShowAddParty(false)
  }

  const selectCity = async (city) => {
    setCitySearch(city.name)
    setSelectedState(city.state || '')
    setCityResults([])

    if (city.from_db && city.id) {
      setSelectedCity(city)
      setForm(f => ({ ...f, city_id: city.id }))
    } else {
      // DB mein add karo
      try {
        const res = await axios.post(`${API}/cities/add-or-get`, {
          name: city.name,
          state: city.state
        }, { headers })
        setSelectedCity(res.data)
        setForm(f => ({ ...f, city_id: res.data.id }))
      } catch (err) {
        console.error(err)
      }
    }
  }

  const handleAddParty = async () => {
    if (!newParty.party_name) return
    setAddingParty(true)
    try {
      const res = await axios.post(`${API}/parties`, {
        party_name: newParty.party_name,
        phone_number: newParty.phone_number,
      }, { headers })
      selectParty(res.data)
      setShowAddParty(false)
      setNewParty({ party_name: '', phone_number: '' })
    } catch (err) {
      setError(err.response?.data?.message || 'Error adding party')
    } finally {
      setAddingParty(false)
    }
  }

  const addProduct = () => {
    setForm(f => ({
      ...f,
      products: [...f.products, { product_name: '', quantity: '', matched_with: '' }]
    }))
  }

  const removeProduct = (index) => {
    setForm(f => ({
      ...f,
      products: f.products.filter((_, i) => i !== index)
    }))
  }

  const updateProduct = (index, field, value) => {
    setForm(f => ({
      ...f,
      products: f.products.map((p, i) => i === index ? { ...p, [field]: value } : p)
    }))
  }

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const payload = {
        city_id: form.city_id ? parseInt(form.city_id) : null,
        salesperson_remark: form.salesperson_remark,
        products: form.products
      }

      // Salesperson
      if (user.role === 'admin') {
        payload.sales_person_id = parseInt(form.sales_person_id)
      } else {
        // Salesperson ka apna ID use karo
        const userData = JSON.parse(localStorage.getItem('user') || '{}')
        payload.sales_person_id = userData.salesperson_id
      }

      // Party
      if (form.party_id) payload.party_id = form.party_id
      else if (form.party_name_direct) payload.party_name_direct = form.party_name_direct
      else {
        setError('Party select karo ya party name daalo')
        setLoading(false)
        return
      }

      await axios.post(`${API}/samples`, payload, { headers })
      setSuccess('Sample request submitted!')
      setTimeout(() => navigate('/samples'), 1500)
    } catch (err) {
      setError(err.response?.data?.message || 'Error adding sample')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">New Sample Request</h1>
          <p className="text-slate-400 text-sm mt-0.5">Fill in the sample details below</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl mb-4 text-sm">
            {success}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">

          {/* Sales Person — sirf admin ke liye */}
          {user.role === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Sales Person <span className="text-red-500">*</span>
              </label>
              <select
                value={form.sales_person_id}
                onChange={e => setForm(f => ({ ...f, sales_person_id: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Select sales person...</option>
                {salespersons.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Party Search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Party <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={partySearch}
                onChange={e => {
                  setPartySearch(e.target.value)
                  setSelectedParty(null)
                  setForm(f => ({ ...f, party_id: '' }))
                  setShowAddParty(false)
                }}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Search party by name or code..."
              />

              {partyResults.length > 0 && !selectedParty && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {partyResults.map(party => (
                    <button
                      key={party.id}
                      onClick={() => selectParty(party)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                    >
                      <span className="text-sm font-medium text-slate-800">{party.party_name}</span>
                      {user.role !== 'salesperson' && (
                        <span className="text-xs text-slate-400 ml-2 font-mono">{party.party_code}</span>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowAddParty(true)
                      setNewParty(p => ({ ...p, party_name: partySearch }))
                      setPartyResults([])
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-violet-50 text-violet-600 text-sm font-medium"
                  >
                    + Party not found? Add "{partySearch}"
                  </button>
                </div>
              )}

              {partySearch.length > 0 && partyResults.length === 0 && !selectedParty && !showAddParty && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  <button
                    onClick={() => {
                      setShowAddParty(true)
                      setNewParty(p => ({ ...p, party_name: partySearch }))
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-violet-50 text-violet-600 text-sm font-medium"
                  >
                    + Party not found? Add "{partySearch}"
                  </button>
                </div>
              )}
            </div>

            {selectedParty && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
                  ✅ {selectedParty.party_name} {user.role !== 'salesperson' && `(${selectedParty.party_code})`}
                </span>
                <button
                  onClick={() => {
                    setSelectedParty(null)
                    setPartySearch('')
                    setForm(f => ({ ...f, party_id: '' }))
                  }}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Change
                </button>
              </div>
            )}

            {showAddParty && (
              <div className="mt-3 p-4 bg-violet-50 rounded-xl border border-violet-100">
                <p className="text-xs font-semibold text-violet-700 mb-3 uppercase tracking-wider">
                  Add New Party
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Party Name *"
                    value={newParty.party_name}
                    onChange={e => setNewParty(p => ({ ...p, party_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-violet-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Phone Number"
                    value={newParty.phone_number}
                    onChange={e => setNewParty(p => ({ ...p, phone_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-violet-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddParty}
                      disabled={addingParty || !newParty.party_name}
                      className="px-4 py-2 rounded-lg text-white text-xs font-medium disabled:opacity-50"
                      style={{ background: '#7C3AED' }}
                    >
                      {addingParty ? 'Adding...' : 'Add Party'}
                    </button>
                    <button
                      onClick={() => setShowAddParty(false)}
                      className="px-4 py-2 rounded-lg text-slate-600 text-xs border border-slate-200 bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* City Live Search */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Station/City <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={citySearch}
                  onChange={e => {
                    setCitySearch(e.target.value)
                    setSelectedCity(null)
                    setSelectedState('')
                    setForm(f => ({ ...f, city_id: '' }))
                  }}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Search city..."
                />
                {cityResults.length > 0 && !selectedCity && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {cityResults.map((city, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectCity(city)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <span className="text-sm font-medium text-slate-800">{city.name}</span>
                        <span className="text-xs text-slate-400 ml-2">{city.state}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* State auto-fill */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                State
              </label>
              <input
                type="text"
                value={selectedState}
                readOnly
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500"
                placeholder="Auto-filled..."
              />
            </div>
          </div>

          {/* Remark */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Remark (Optional)
            </label>
            <input
              type="text"
              value={form.salesperson_remark}
              onChange={e => setForm(f => ({ ...f, salesperson_remark: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Any special instructions..."
            />
          </div>

          {/* Products */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-700">
                Products <span className="text-red-500">*</span>
              </label>
              <button
                onClick={addProduct}
                className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800"
              >
                <span className="text-lg leading-none">+</span> Add Product
              </button>
            </div>

            <div className="space-y-3">
              {form.products.map((product, index) => (
                <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Product {index + 1}
                    </span>
                    {form.products.length > 1 && (
                      <button
                        onClick={() => removeProduct(index)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={product.product_name}
                      onChange={e => updateProduct(index, 'product_name', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                      placeholder="Product name"
                    />
                    <input
                      type="text"
                      value={product.quantity}
                      onChange={e => updateProduct(index, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                      placeholder="Quantity"
                    />
                    <input
                      type="text"
                      value={product.matched_with}
                      onChange={e => updateProduct(index, 'matched_with', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                      placeholder="Matched with"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
              style={{ background: '#7C3AED' }}
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
            <button
              onClick={() => navigate('/samples')}
              className="px-6 py-2.5 rounded-xl text-slate-600 text-sm font-medium border border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}