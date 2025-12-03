import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Menu, X, Home, Target, Search, Map, FileText, 
  LayoutDashboard, Building2, Calculator, Settings
} from 'lucide-react'

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/cockpit', label: 'Cockpit', icon: Target },
  { path: '/screener', label: 'Screener', icon: Search },
  { path: '/map', label: 'Map', icon: Map },
  { path: '/report', label: 'Report', icon: FileText },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/jurisdictions', label: 'Jurisdictions', icon: Building2 },
  { path: '/calculator', label: 'Calculator', icon: Calculator },
  { path: '/admin', label: 'Admin', icon: Settings },
]

function GlobalToc() {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem('hive-toc-open')
    return saved !== null ? JSON.parse(saved) : false
  })

  useEffect(() => {
    localStorage.setItem('hive-toc-open', JSON.stringify(isOpen))
  }, [isOpen])

  const currentPath = location.pathname

  return (
    <div className="fixed top-16 left-4 z-40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center w-10 h-10 rounded-lg shadow-lg transition-all ${
          isOpen 
            ? 'bg-amber-500 text-gray-900' 
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
        }`}
        title={isOpen ? 'Close navigation' : 'Open navigation'}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div className="absolute top-12 left-0 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden min-w-48 animate-in slide-in-from-top-2 duration-200">
          <div className="p-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
              Navigation
            </div>
            {navItems.map(item => {
              const Icon = item.icon
              const isActive = currentPath === item.path || 
                (item.path !== '/' && currentPath.startsWith(item.path))
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-gray-500'}`} />
                  <span className="text-sm">{item.label}</span>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-auto" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default GlobalToc
