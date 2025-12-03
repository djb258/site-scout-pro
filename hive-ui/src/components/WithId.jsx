import { useState, createContext, useContext } from 'react'

const AdminModeContext = createContext(false)

export function AdminModeProvider({ children }) {
  const [adminMode, setAdminMode] = useState(false)
  
  return (
    <AdminModeContext.Provider value={{ adminMode, setAdminMode }}>
      {children}
    </AdminModeContext.Provider>
  )
}

export function useAdminMode() {
  return useContext(AdminModeContext)
}

function WithId({ id, name, children, className = "" }) {
  const { adminMode } = useAdminMode()
  const [showTooltip, setShowTooltip] = useState(false)
  
  const handleCopyId = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(id)
  }
  
  return (
    <div 
      data-component-id={id}
      data-component-name={name}
      className={`relative ${className}`}
    >
      {adminMode && (
        <div 
          className="absolute -top-1 -left-1 z-50"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <button
            onClick={handleCopyId}
            className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow-lg border border-purple-400"
          >
            {id}
          </button>
          
          {showTooltip && (
            <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg p-2 shadow-xl min-w-48 z-50">
              <div className="text-xs text-gray-400 mb-1">Component ID</div>
              <div className="text-sm font-mono text-purple-400 mb-2">{id}</div>
              {name && (
                <>
                  <div className="text-xs text-gray-400 mb-1">Name</div>
                  <div className="text-sm text-white">{name}</div>
                </>
              )}
              <div className="text-xs text-gray-500 mt-2 italic">Click to copy ID</div>
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

export default WithId
