import { useNavigate, useLocation } from 'react-router-dom'

const menuItems = {
  admin: [
    { path: '/', label: 'Dashboard' },
    { path: '/samples', label: 'Samples' },
    { path: '/samples/add', label: 'Add Sample' },
    { path: '/orders', label: 'Orders' },
    { path: '/admin', label: 'Admin Panel' },
  ],
  data_entry: [
    { path: '/', label: 'Dashboard' },
    { path: '/samples', label: 'Samples' },
    { path: '/samples/add', label: 'Add Sample' },
  ],
  calculation: [
    { path: '/', label: 'Dashboard' },
    { path: '/samples', label: 'Samples' },
    { path: '/orders', label: 'Orders' },
  ],
  salesperson: [
    { path: '/', label: 'Dashboard' },
    { path: '/samples/add', label: 'New Sample Request' },
    { path: '/samples', label: 'My Requests' },
  ],
}

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const items = menuItems[user.role] || menuItems.data_entry

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* Sidebar */}
      <div className="w-60 flex flex-col fixed h-full" style={{ background: '#0F172A' }}>

        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-700">
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
        </div>

        {/* User Info */}
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #059669)' }}>
              {user.full_name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="text-slate-200 text-xs font-medium">{user.full_name}</p>
              <p className="text-slate-500 text-xs capitalize">{user.role?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                location.pathname === item.path
                  ? 'bg-violet-600 text-white font-medium'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${location.pathname === item.path ? 'bg-white' : 'bg-slate-600'}`}></span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-red-900 hover:text-red-300 transition-all duration-150"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-60 flex flex-col">

        {/* Top Bar */}
        <div className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-base font-semibold text-slate-800">
            {menuItems[user.role]?.find(i => i.path === location.pathname)?.label || 'Dashboard'}
          </h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-slate-400">System Online</span>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </div>
    </div>
  )
}