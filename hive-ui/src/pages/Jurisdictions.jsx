import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Plus, Loader2, AlertCircle, Building2, List, LayoutGrid,
  MapPin, Clock, FileText
} from 'lucide-react'
import WithId from '../components/WithId'

const API_BASE = import.meta.env.VITE_API_URL || ''

function Jurisdictions() {
  const navigate = useNavigate()
  const [jurisdictions, setJurisdictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('cards')

  useEffect(() => {
    fetchJurisdictions()
  }, [])

  const fetchJurisdictions = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/jurisdictions`)
      if (!response.ok) throw new Error('Failed to fetch jurisdictions')
      const data = await response.json()
      setJurisdictions(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getDifficultyBg = (rating) => {
    switch (rating?.toLowerCase()) {
      case 'easy': return 'bg-green-500/20 text-green-400 border-green-500'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500'
      case 'hard': return 'bg-red-500/20 text-red-400 border-red-500'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading jurisdictions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">Error: {error}</p>
          <button 
            onClick={fetchJurisdictions}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold px-6 py-2 rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <WithId id="JURI-001" name="Jurisdictions Page" className="flex-1 bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <WithId id="JURI-HEAD-001" name="Jurisdictions Header" className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-amber-500" />
              Jurisdiction Intel
            </h1>
            <p className="text-gray-400 mt-1">Regulatory research and zoning intelligence</p>
          </div>
          <div className="flex items-center gap-3">
            <WithId id="JURI-TOG-001" name="View Toggle" className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
              <button 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === 'cards' 
                    ? 'bg-gray-700 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="w-4 h-4" />
                Cards
              </button>
              <button 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === 'table' 
                    ? 'bg-gray-700 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setViewMode('table')}
              >
                <List className="w-4 h-4" />
                Table
              </button>
            </WithId>
            <button 
              onClick={() => navigate('/jurisdiction/new')}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Add Jurisdiction
            </button>
          </div>
        </WithId>

        {viewMode === 'cards' ? (
          <WithId id="JURI-CARD-001" name="Card Grid View" className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jurisdictions.map((j) => (
              <div 
                key={j.id} 
                className="bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 p-5 cursor-pointer transition"
                onClick={() => navigate(`/jurisdiction/${j.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{j.county_name}</h3>
                    <span className="text-sm text-gray-400">{j.state}</span>
                  </div>
                  <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                    {j.jurisdiction_type || 'County'}
                  </span>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Difficulty</span>
                    <span className={`px-2 py-0.5 rounded border text-xs font-medium ${getDifficultyBg(j.difficulty_rating)}`}>
                      {j.difficulty_rating || 'Unknown'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Approval Path</span>
                    <span className="text-gray-300">{j.approval_path || 'Not specified'}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Timeline</span>
                    <span className="text-gray-300">{j.typical_timeline || 'Unknown'}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">By-Right Zone</span>
                    <span className="text-gray-300">{j.by_right_zone || 'N/A'}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    Updated {j.updated_at ? new Date(j.updated_at).toLocaleDateString() : 'N/A'}
                  </div>
                  <span className="text-amber-400 text-sm font-medium">View Details</span>
                </div>
              </div>
            ))}
          </WithId>
        ) : (
          <WithId id="JURI-TBL-001" name="Table View" className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-700/50">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">County</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">State</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Type</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-medium">Difficulty</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Approval Path</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">By-Right Zone</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Timeline</th>
                  </tr>
                </thead>
                <tbody>
                  {jurisdictions.map((j) => (
                    <tr 
                      key={j.id} 
                      className="border-b border-gray-700/50 hover:bg-gray-700/30 transition cursor-pointer"
                      onClick={() => navigate(`/jurisdiction/${j.id}`)}
                    >
                      <td className="py-3 px-4 text-white font-medium">{j.county_name}</td>
                      <td className="py-3 px-4 text-gray-400">{j.state}</td>
                      <td className="py-3 px-4 text-gray-400">{j.jurisdiction_type || 'County'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${getDifficultyBg(j.difficulty_rating)}`}>
                          {j.difficulty_rating || 'Unknown'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300">{j.approval_path || '-'}</td>
                      <td className="py-3 px-4 text-gray-300">{j.by_right_zone || '-'}</td>
                      <td className="py-3 px-4 text-gray-300">{j.typical_timeline || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WithId>
        )}

        {jurisdictions.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No Jurisdictions Yet</h3>
            <p className="text-gray-500 mb-6">Start adding regulatory intel for your target markets</p>
            <button 
              onClick={() => navigate('/jurisdiction/new')}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold px-6 py-3 rounded-lg transition"
            >
              <Plus className="w-5 h-5" />
              Add First Jurisdiction
            </button>
          </div>
        )}
      </div>
    </WithId>
  )
}

export default Jurisdictions
