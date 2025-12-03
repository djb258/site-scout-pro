import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { 
  Settings, Search, ChevronRight, ChevronDown, Copy, Check,
  Folder, FolderOpen, FileCode, ArrowLeft, Eye, EyeOff
} from 'lucide-react'
import { componentIds, flattenIds, searchIds } from '../lib/componentIds'
import { useAdminMode } from '../components/WithId'

function Admin() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedNodes, setExpandedNodes] = useState(new Set(['landing', 'cockpit', 'screener', 'map', 'report']))
  const [selectedId, setSelectedId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const { adminMode, setAdminMode } = useAdminMode()

  const flatList = useMemo(() => flattenIds(), [])
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    return searchIds(searchQuery)
  }, [searchQuery])

  const toggleNode = (key) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedNodes(newExpanded)
  }

  const copyId = (id) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const renderTreeNode = (key, node, depth = 0, parentPath = "") => {
    const currentPath = parentPath ? `${parentPath}/${key}` : key
    const hasChildren = node.children && Object.keys(node.children).length > 0
    const isExpanded = expandedNodes.has(currentPath)
    const isSelected = selectedId === node.id

    return (
      <div key={currentPath}>
        <div 
          className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
            isSelected ? 'bg-purple-600/20 border border-purple-500/50' : 'hover:bg-gray-700/50'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (hasChildren) toggleNode(currentPath)
            setSelectedId(node.id)
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
            )
          ) : (
            <div className="w-4" />
          )}
          
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )
          ) : (
            <FileCode className="w-4 h-4 text-blue-400 flex-shrink-0" />
          )}
          
          <span className="text-sm text-gray-300 flex-1 truncate">{node.name}</span>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              copyId(node.id)
            }}
            className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 rounded hover:bg-gray-600 transition-opacity"
          >
            {copiedId === node.id ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3 text-gray-500" />
            )}
          </button>
          
          <code className="text-xs font-mono text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded">
            {node.id}
          </code>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {Object.entries(node.children).map(([childKey, childNode]) => 
              renderTreeNode(childKey, childNode, depth + 1, currentPath)
            )}
          </div>
        )}
      </div>
    )
  }

  const selectedComponent = flatList.find(item => item.id === selectedId)

  return (
    <div className="flex-1 bg-gray-900 text-white min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link 
              to="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="flex items-center gap-3">
              <Settings className="w-8 h-8 text-purple-500" />
              <div>
                <h1 className="text-2xl font-bold">Admin: Component Registry</h1>
                <p className="text-gray-400 text-sm">Reference IDs for all UI components</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setAdminMode(!adminMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
              adminMode 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {adminMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {adminMode ? 'ID Badges ON' : 'ID Badges OFF'}
          </button>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-400">
              When ID badges are <span className="text-purple-400 font-semibold">ON</span>, 
              you'll see purple ID tags on components throughout the app. 
              Click any tag to copy the ID, then share it when requesting changes.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search components by ID, name, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="p-4 max-h-[600px] overflow-y-auto">
              {searchResults ? (
                <div>
                  <div className="text-sm text-gray-400 mb-3">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                  </div>
                  {searchResults.map(item => (
                    <div 
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors mb-2 ${
                        selectedId === item.id 
                          ? 'bg-purple-600/20 border border-purple-500/50' 
                          : 'bg-gray-700/30 hover:bg-gray-700/50'
                      }`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <FileCode className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{item.name}</div>
                        <div className="text-xs text-gray-500 truncate">{item.path}</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          copyId(item.id)
                        }}
                        className="p-1 rounded hover:bg-gray-600"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                      <code className="text-xs font-mono text-purple-400 bg-purple-900/30 px-2 py-1 rounded">
                        {item.id}
                      </code>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {Object.entries(componentIds).map(([key, node]) => 
                    renderTreeNode(key, node, 0, "")
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-blue-400" />
              Component Details
            </h3>
            
            {selectedComponent ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">ID</div>
                  <div className="flex items-center gap-2">
                    <code className="text-lg font-mono text-purple-400">{selectedComponent.id}</code>
                    <button
                      onClick={() => copyId(selectedComponent.id)}
                      className="p-1 rounded hover:bg-gray-700"
                    >
                      {copiedId === selectedComponent.id ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Name</div>
                  <div className="text-white">{selectedComponent.name}</div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Path</div>
                  <div className="text-gray-400 text-sm font-mono">{selectedComponent.path}</div>
                </div>
                
                {selectedComponent.description && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</div>
                    <div className="text-gray-300 text-sm">{selectedComponent.description}</div>
                  </div>
                )}
                
                <div className="pt-4 border-t border-gray-700">
                  <div className="text-xs text-gray-500 mb-2">Quick Copy</div>
                  <button
                    onClick={() => copyId(selectedComponent.id)}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy ID
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <FileCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a component to view details</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-gray-800/50 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">How to Use Component IDs</h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="text-purple-400 font-semibold mb-2">1. Find the ID</div>
              <p className="text-gray-400">
                Search or browse the tree above, or turn on ID badges and click any purple tag in the app.
              </p>
            </div>
            <div>
              <div className="text-purple-400 font-semibold mb-2">2. Copy the ID</div>
              <p className="text-gray-400">
                Click the copy button or the ID badge itself. The ID is now in your clipboard.
              </p>
            </div>
            <div>
              <div className="text-purple-400 font-semibold mb-2">3. Reference in Requests</div>
              <p className="text-gray-400">
                When requesting changes, include the ID: "Please update <code className="text-purple-400">RPT-DEMO-001</code> to show..."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Admin
