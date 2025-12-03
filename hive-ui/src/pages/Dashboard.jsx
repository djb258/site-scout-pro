import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { Plus, Loader2, AlertCircle, Building2, TrendingUp, Map } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import WithId from '../components/WithId'

const API_BASE = import.meta.env.VITE_API_URL || ''

function Dashboard() {
  const navigate = useNavigate()
  const [dashboardData, setDashboardData] = useState([])
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, summaryRes] = await Promise.all([
          fetch(`${API_BASE}/api/dashboard`),
          fetch(`${API_BASE}/api/dashboard/summary`)
        ])
        
        if (!dashRes.ok || !summaryRes.ok) {
          throw new Error('Failed to fetch data')
        }
        
        const dashData = await dashRes.json()
        const summaryData = await summaryRes.json()
        
        setDashboardData(dashData)
        setSummary(summaryData)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])

  const normalizeVerdict = (verdict) => {
    return verdict?.toUpperCase()?.replace('_', '-')
  }

  const getVerdictColor = (verdict) => {
    switch (normalizeVerdict(verdict)) {
      case 'GO': return '#22c55e'
      case 'MARGINAL': return '#eab308'
      case 'NO-GO': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const getVerdictBg = (verdict) => {
    switch (normalizeVerdict(verdict)) {
      case 'GO': return 'bg-green-500/20 border-green-500 text-green-400'
      case 'MARGINAL': return 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
      case 'NO-GO': return 'bg-red-500/20 border-red-500 text-red-400'
      default: return 'bg-gray-500/20 border-gray-500 text-gray-400'
    }
  }

  const getDifficultyBg = (rating) => {
    switch (rating?.toLowerCase()) {
      case 'easy': return 'bg-green-500/20 text-green-400'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400'
      case 'hard': return 'bg-red-500/20 text-red-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading dashboard...</p>
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
            onClick={() => window.location.reload()}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold px-6 py-2 rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <WithId id="DASH-001" name="Dashboard Page" className="flex-1 bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <WithId id="DASH-HEAD-001" name="Dashboard Header" className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-amber-500" />
              Market Dashboard
            </h1>
            <p className="text-gray-400 mt-1">Feasibility analysis across all markets</p>
          </div>
          <button 
            onClick={() => navigate('/jurisdiction/new')}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold px-4 py-2 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Add County
          </button>
        </WithId>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-green-500/20 border border-green-500 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-400">{summary.go_count || 0}</div>
            <div className="text-green-400/80 text-sm font-medium">GO</div>
          </div>
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-yellow-400">{summary.marginal_count || 0}</div>
            <div className="text-yellow-400/80 text-sm font-medium">MARGINAL</div>
          </div>
          <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-400">{summary.no_go_count || 0}</div>
            <div className="text-red-400/80 text-sm font-medium">NO-GO</div>
          </div>
          <div className="bg-gray-500/20 border border-gray-600 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-gray-400">{summary.no_data_count || 0}</div>
            <div className="text-gray-400/80 text-sm font-medium">NO DATA</div>
          </div>
        </div>

        <WithId id="DASH-MAP-001" name="Verdict Map" className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-700">
            <h2 className="font-semibold flex items-center gap-2">
              <Map className="w-5 h-5 text-amber-500" />
              Market Coverage Map
            </h2>
          </div>
          <div className="h-[400px]">
            <MapContainer
              center={[39.8, -78.5]}
              zoom={8}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {dashboardData.map((county, idx) => (
                county.lat && county.lng && (
                  <CircleMarker
                    key={idx}
                    center={[county.lat, county.lng]}
                    radius={12}
                    pathOptions={{
                      color: getVerdictColor(county.verdict),
                      fillColor: getVerdictColor(county.verdict),
                      fillOpacity: 0.7,
                      weight: 2
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong>{county.county_name}, {county.state}</strong>
                        <br />
                        Verdict: <span style={{ color: getVerdictColor(county.verdict) }}>
                          {county.verdict || 'N/A'}
                        </span>
                        <br />
                        Score: {county.score || 'N/A'}
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              ))}
            </MapContainer>
          </div>
        </WithId>

        <WithId id="DASH-TBL-001" name="Summary Table" className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500" />
              Market Summary
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-700/50">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">County</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">State</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium">Verdict</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Score</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium">Difficulty</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.map((county, idx) => (
                  <tr 
                    key={idx} 
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 transition cursor-pointer"
                    onClick={() => navigate(`/jurisdiction/${county.id}`)}
                  >
                    <td className="py-3 px-4 text-white font-medium">{county.county_name}</td>
                    <td className="py-3 px-4 text-gray-400">{county.state}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${getVerdictBg(county.verdict)}`}>
                        {county.verdict || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-white">{county.score || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getDifficultyBg(county.difficulty_rating)}`}>
                        {county.difficulty_rating || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/calculator?county=${county.county_fips}`)
                        }}
                        className="text-amber-400 hover:text-amber-300 text-sm font-medium"
                      >
                        Calculate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WithId>
      </div>
    </WithId>
  )
}

export default Dashboard
