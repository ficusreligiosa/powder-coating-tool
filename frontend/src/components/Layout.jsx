import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const menuItems = {
  admin: [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/samples', label: 'Samples', icon: '🧪' },
    { path: '/samples/add', label: 'Add Sample', icon: '➕' },
    { path: '/orders', label: 'Orders', icon: '📦' },
    { path: '/admin', label: 'Admin Panel', icon: '⚙️' },
  ],
  data_entry: [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/samples', label: 'Samples', icon: '🧪' },
    { path: '/samples/add', label: 'Add Sample', icon: '➕' },
  ],
  calculation: [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/samples', label: 'Samples', icon: '🧪' },
    { path: '/orders', label: 'Orders', icon: '📦' },
  ],
  salesperson: [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/samples/add', label: 'New Request', icon: '➕' },
    { path: '/samples', label: 'My Requests', icon: '📋' },
  ],
}

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const items = menuItems[user.role] || menuItems.data_entry
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const handleNav = (path) => {
    navigate(path)
    setSidebarOpen(false)
  }

  const currentLabel = menuItems[user.role]?.find(i => i.path === location.pathname)?.label || 'Dashboard'

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full z-30 flex flex-col transition-transform duration-300 w-64
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:w-60`}
        style={{ background: '#0F172A' }}>

        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #059669)' }}>
                <span className="text-sm">🎨</span>
              </div>
              <div>
                <h1 className="text-white font-semibold text-sm tracking-wide">Surface Paints</h1>
                <p className="text-slate-400 text-xs">Powder Coating</p>
              </div>
            </div>
            {/* Close button mobile */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #059669)' }}>
              {user.full_name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="text-slate-200 text-sm font-medium">{user.full_name}</p>
              <p className="text-slate-500 text-xs capitalize">{user.role?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${
                location.pathname === item.path
                  ? 'bg-violet-600 text-white font-medium'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-400 hover:bg-red-900 hover:text-red-300 transition-all duration-150"
          >
            <span>🚪</span>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 md:ml-60 flex flex-col min-w-0">

        {/* Top Bar */}
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <div className="w-5 h-0.5 bg-slate-600 mb-1"></div>
              <div className="w-5 h-0.5 bg-slate-600 mb-1"></div>
              <div className="w-5 h-0.5 bg-slate-600"></div>
            </button>
            <h2 className="text-base font-semibold text-slate-800">{currentLabel}</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-slate-400 hidden sm:block">Online</span>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}