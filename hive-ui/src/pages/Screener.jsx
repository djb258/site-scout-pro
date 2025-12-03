import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  CheckCircle, AlertCircle, Clock, XCircle, Loader2,
  MapPin, FileText, ArrowLeft, Search, Building2, TreePine, Factory, Settings
} from 'lucide-react'
import WithId from '../components/WithId'

const API_BASE = import.meta.env.VITE_API_URL || ''

const initialChecklist = [
  { id: 'geo_boundary', category: 'GEOGRAPHY', label: 'ZIP boundary loaded', status: 'pending', value: null },
  { id: 'geo_county', category: 'GEOGRAPHY', label: 'County identified', status: 'pending', value: null },
  { id: 'geo_coords', category: 'GEOGRAPHY', label: 'Coordinates', status: 'pending', value: null },
  { id: 'demo_pop', category: 'DEMOGRAPHICS', label: 'Population', status: 'pending', value: null },
  { id: 'demo_density', category: 'DEMOGRAPHICS', label: 'Density', status: 'pending', value: null },
  { id: 'demo_hhi', category: 'DEMOGRAPHICS', label: 'Median HHI', status: 'pending', value: null },
  { id: 'supply_facilities', category: 'SUPPLY', label: 'Storage facilities', status: 'pending', value: null },
  { id: 'supply_details', category: 'SUPPLY', label: 'Facility details', status: 'pending', value: null },
  { id: 'demand_housing', category: 'DEMAND', label: 'Housing communities', status: 'pending', value: null },
  { id: 'demand_pipeline', category: 'DEMAND', label: 'Pipeline projects', status: 'pending', value: null },
  { id: 'anchor_hospitals', category: 'ANCHORS', label: 'Hospitals & Employers', status: 'pending', value: null },
  { id: 'anchor_universities', category: 'ANCHORS', label: 'Universities', status: 'pending', value: null },
  { id: 'anchor_campgrounds', category: 'ANCHORS', label: 'RV Parks/Campgrounds', status: 'pending', value: null },
  { id: 'market_counties', category: 'MARKET', label: 'Top counties', status: 'pending', value: null },
]

function Toggle({ enabled, onChange, label, icon: Icon }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group py-2 px-3 rounded-lg hover:bg-gray-700/50 transition">
      <div className="flex items-center gap-4">
        {Icon && <Icon className="w-5 h-5 text-gray-400 group-hover:text-amber-400 transition" />}
        <span className="text-gray-300 group-hover:text-white transition text-base">{label}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ml-4 ${
          enabled ? 'bg-amber-500' : 'bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  )
}

function Screener() {
  const navigate = useNavigate()
  const [state, setState] = useState('input')
  const [zipCode, setZipCode] = useState('')
  const [zipError, setZipError] = useState('')
  const [checklist, setChecklist] = useState(initialChecklist)
  const [apiData, setApiData] = useState(null)
  const abortRef = useRef(false)

  const [urbanExclude, setUrbanExclude] = useState(false)
  const [multifamilyPriority, setMultifamilyPriority] = useState(false)
  const [recreationLoad, setRecreationLoad] = useState(false)
  const [industrialMomentum, setIndustrialMomentum] = useState(false)
  const [analysisMode, setAnalysisMode] = useState('compare')
  const inputRef = useRef(null)

  useEffect(() => {
    setState('input')
    setChecklist(initialChecklist)
    const savedZip = localStorage.getItem('hive_current_zip')
    if (savedZip) {
      setZipCode(savedZip)
    }
  }, [])

  useEffect(() => {
    if (state === 'input' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [state])

  const completedCount = checklist.filter(item => item.status === 'complete').length
  const totalCount = checklist.length
  const progressPercent = (completedCount / totalCount) * 100
  const isComplete = completedCount === totalCount

  const validateZip = (zip) => {
    return /^\d{5}$/.test(zip)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validateZip(zipCode)) {
      setZipError('Please enter a valid 5-digit ZIP code')
      return
    }
    setZipError('')
    setState('loading')
    abortRef.current = false
    localStorage.setItem('hive_current_zip', zipCode)
    startDataFetch()
  }

  const updateChecklistItem = (itemId, status, value = null) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, status, value } : item
    ))
  }

  const startDataFetch = async () => {
    try {
      updateChecklistItem('geo_boundary', 'loading')
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const payload = {
        zip: zipCode,
        urban_exclude: urbanExclude,
        multifamily_priority: multifamilyPriority,
        recreation_load: recreationLoad,
        industrial_momentum: industrialMomentum,
        analysis_mode: analysisMode
      }
      
      const response = await fetch(`${API_BASE}/api/map-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        if (response.status === 404) {
          setZipError('ZIP code not found in database')
          setState('input')
          setChecklist(initialChecklist)
          return
        }
        throw new Error('Failed to fetch data')
      }
      
      const data = await response.json()
      setApiData(data)
      
      if (abortRef.current) return
      updateChecklistItem('geo_boundary', 'complete', 'loaded')
      await new Promise(resolve => setTimeout(resolve, 150))
      
      if (abortRef.current) return
      updateChecklistItem('geo_county', 'loading')
      await new Promise(resolve => setTimeout(resolve, 200))
      updateChecklistItem('geo_county', 'complete', `${data.zip.county_name}, ${data.zip.state}`)
      
      if (abortRef.current) return
      updateChecklistItem('geo_coords', 'loading')
      await new Promise(resolve => setTimeout(resolve, 150))
      updateChecklistItem('geo_coords', 'complete', `${data.zip.lat?.toFixed(4)}, ${data.zip.lng?.toFixed(4)}`)
      
      if (abortRef.current) return
      updateChecklistItem('demo_pop', 'loading')
      await new Promise(resolve => setTimeout(resolve, 200))
      updateChecklistItem('demo_pop', 'complete', data.zip.population?.toLocaleString() || 'N/A')
      
      if (abortRef.current) return
      updateChecklistItem('demo_density', 'loading')
      await new Promise(resolve => setTimeout(resolve, 150))
      updateChecklistItem('demo_density', 'complete', `${data.zip.density?.toFixed(1) || 'N/A'}/sq mi`)
      
      if (abortRef.current) return
      updateChecklistItem('demo_hhi', 'loading')
      await new Promise(resolve => setTimeout(resolve, 200))
      updateChecklistItem('demo_hhi', 'complete', data.zip.income_household_median ? `$${data.zip.income_household_median.toLocaleString()}` : 'N/A')
      
      if (abortRef.current) return
      updateChecklistItem('supply_facilities', 'loading')
      await new Promise(resolve => setTimeout(resolve, 300))
      updateChecklistItem('supply_facilities', 'complete', `${data.facilities?.length || 0} found`)
      
      if (abortRef.current) return
      updateChecklistItem('supply_details', 'loading')
      await new Promise(resolve => setTimeout(resolve, 200))
      const avgRating = data.facilities?.filter(f => f.rating).reduce((sum, f) => sum + f.rating, 0) / (data.facilities?.filter(f => f.rating).length || 1)
      updateChecklistItem('supply_details', 'complete', `Avg rating: ${avgRating.toFixed(1)}`)
      
      if (abortRef.current) return
      updateChecklistItem('demand_housing', 'loading')
      await new Promise(resolve => setTimeout(resolve, 250))
      updateChecklistItem('demand_housing', 'complete', `${data.housing?.length || 0} communities`)
      
      if (abortRef.current) return
      updateChecklistItem('demand_pipeline', 'loading')
      await new Promise(resolve => setTimeout(resolve, 200))
      const pipelineCount = data.housing?.filter(h => h.status && ['permit', 'approved', 'site_work', 'vertical', 'under_construction'].includes(h.status.toLowerCase())).length || 0
      updateChecklistItem('demand_pipeline', 'complete', `${pipelineCount} active`)
      
      if (abortRef.current) return
      updateChecklistItem('anchor_hospitals', 'loading')
      await new Promise(resolve => setTimeout(resolve, 200))
      updateChecklistItem('anchor_hospitals', 'complete', `${data.anchors?.length || 0} found`)
      
      if (abortRef.current) return
      updateChecklistItem('anchor_universities', 'loading')
      await new Promise(resolve => setTimeout(resolve, 150))
      updateChecklistItem('anchor_universities', 'complete', `${data.universities?.length || 0} found`)
      
      if (abortRef.current) return
      updateChecklistItem('anchor_campgrounds', 'loading')
      await new Promise(resolve => setTimeout(resolve, 150))
      updateChecklistItem('anchor_campgrounds', 'complete', `${data.campgrounds?.length || 0} found`)
      
      if (abortRef.current) return
      updateChecklistItem('market_counties', 'loading')
      await new Promise(resolve => setTimeout(resolve, 200))
      updateChecklistItem('market_counties', 'complete', `${data.counties?.length || 0} analyzed`)
      
      if (!abortRef.current) {
        setState('complete')
        setTimeout(() => {
          navigate(`/map?zip=${zipCode}`)
        }, 500)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setZipError('Error fetching data. Please try again.')
      setState('input')
      setChecklist(initialChecklist)
    }
  }

  const handleCancel = () => {
    abortRef.current = true
    setState('input')
    setChecklist(initialChecklist)
    setApiData(null)
  }

  const handleNewSearch = () => {
    setState('input')
    setZipCode('')
    setChecklist(initialChecklist)
    setApiData(null)
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'loading': return <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />
      default: return <Clock className="w-5 h-5 text-gray-600" />
    }
  }

  const groupedChecklist = checklist.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  return (
    <WithId id="SCRN-001" name="Screener Page" className="flex-1 bg-gray-900 text-white min-h-screen">
      <div className="w-full px-12 py-10">
        <div className="flex justify-between items-center mb-10">
          {state === 'input' && (
            <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition text-lg">
              <ArrowLeft className="w-5 h-5" />
              Back
            </Link>
          )}
          {state === 'loading' && (
            <button 
              onClick={handleCancel}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 transition text-lg"
            >
              <XCircle className="w-5 h-5" />
              Cancel
            </button>
          )}
          {state === 'complete' && (
            <button 
              onClick={handleNewSearch}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition text-lg"
            >
              <ArrowLeft className="w-5 h-5" />
              New Search
            </button>
          )}
          <div></div>
        </div>

        {state === 'input' && (
          <div className="py-6">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-bold mb-4">Analyze a Location</h2>
              <p className="text-gray-400 text-xl">Enter a ZIP code and configure analysis options</p>
            </div>
            
            <form onSubmit={handleSubmit} className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <WithId id="SCRN-ZIP-001" name="ZIP Input" className="bg-gray-800 rounded-2xl p-10 border border-gray-700">
                  <label htmlFor="zipCode" className="block text-lg font-medium text-gray-300 mb-4">
                    ZIP Code
                  </label>
                  <div className="relative mb-8">
                    <input
                      ref={inputRef}
                      type="text"
                      id="zipCode"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      placeholder="e.g., 15522"
                      maxLength={5}
                      autoFocus
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl px-6 py-5 text-2xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
                    />
                    <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-7 h-7 text-gray-500" />
                  </div>

                  <div className="border-t border-gray-700 pt-8">
                    <h3 className="text-lg font-semibold text-gray-300 tracking-wider mb-6">ANALYSIS MODE</h3>
                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { value: 'build', label: 'Build New', desc: 'Analyze sites for new construction' },
                        { value: 'buy', label: 'Acquire Existing', desc: 'Find acquisition opportunities' },
                        { value: 'compare', label: 'Compare Both', desc: 'Full market analysis' },
                      ].map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setAnalysisMode(option.value)}
                          className={`py-5 px-6 rounded-xl text-left transition ${
                            analysisMode === option.value
                              ? 'bg-amber-500 text-gray-900'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          <div className="font-semibold text-lg">{option.label}</div>
                          <div className={`text-sm mt-1 ${analysisMode === option.value ? 'text-gray-800' : 'text-gray-400'}`}>
                            {option.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </WithId>

                <WithId id="SCRN-OPT-001" name="Analysis Options" className="bg-gray-800 rounded-2xl p-10 border border-gray-700">
                  <div className="flex items-center gap-3 mb-8">
                    <Settings className="w-6 h-6 text-amber-500" />
                    <h3 className="text-lg font-semibold text-gray-300 tracking-wider">ANALYSIS OPTIONS</h3>
                  </div>
                  
                  <div className="space-y-6">
                    <Toggle
                      enabled={urbanExclude}
                      onChange={setUrbanExclude}
                      label="Exclude urban areas from analysis"
                      icon={Building2}
                    />
                    <Toggle
                      enabled={multifamilyPriority}
                      onChange={setMultifamilyPriority}
                      label="Prioritize multifamily housing demand"
                      icon={Building2}
                    />
                    <Toggle
                      enabled={recreationLoad}
                      onChange={setRecreationLoad}
                      label="Include recreational demand (lakes, RV parks)"
                      icon={TreePine}
                    />
                    <Toggle
                      enabled={industrialMomentum}
                      onChange={setIndustrialMomentum}
                      label="Include industrial growth (factories, logistics)"
                      icon={Factory}
                    />
                  </div>

                  <div className="mt-10 pt-8 border-t border-gray-700">
                    {zipError && (
                      <p className="text-red-400 text-base mb-6">{zipError}</p>
                    )}
                    
                    <button 
                      type="submit" 
                      className="w-full bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold py-5 rounded-xl transition flex items-center justify-center gap-3 text-xl"
                    >
                      <Search className="w-6 h-6" />
                      Analyze Location
                    </button>
                    
                    <p className="text-gray-500 text-base mt-6 text-center">
                      Try: 15522 (Bedford, PA) or 25401 (Martinsburg, WV)
                    </p>
                  </div>
                </WithId>
              </div>
            </form>
          </div>
        )}

        {(state === 'loading' || state === 'complete') && (
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold">Analyzing ZIP: {zipCode}</h2>
              {apiData?.zip && (
                <p className="text-gray-400 mt-2 text-xl">{apiData.zip.city}, {apiData.zip.state}</p>
              )}
              {apiData?.from_cache && (
                <span className="inline-block mt-3 text-sm bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg">
                  Loaded from cache
                </span>
              )}
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {urbanExclude && <span className="text-sm bg-gray-700 text-amber-400 px-3 py-1.5 rounded-lg">Urban Excluded</span>}
                {multifamilyPriority && <span className="text-sm bg-gray-700 text-amber-400 px-3 py-1.5 rounded-lg">Multifamily Priority</span>}
                {recreationLoad && <span className="text-sm bg-gray-700 text-amber-400 px-3 py-1.5 rounded-lg">Recreation</span>}
                {industrialMomentum && <span className="text-sm bg-gray-700 text-amber-400 px-3 py-1.5 rounded-lg">Industrial</span>}
                <span className="text-sm bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg border border-amber-500/50">
                  Mode: {analysisMode === 'build' ? 'Build New' : analysisMode === 'buy' ? 'Acquire' : 'Compare Both'}
                </span>
              </div>
            </div>
            
            <WithId id="SCRN-CHK-001" name="Animated Checklist" className="bg-gray-800 rounded-2xl border border-gray-700 p-10">
              <h3 className="text-lg font-semibold text-gray-400 mb-8 tracking-wider">DATA CHECKLIST</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {Object.entries(groupedChecklist).map(([category, items]) => (
                  <div key={category} className="bg-gray-700/30 rounded-xl p-6">
                    <h4 className="text-sm font-semibold text-amber-500 mb-4 tracking-wider">{category}</h4>
                    <div className="space-y-3">
                      {items.map(item => (
                        <div 
                          key={item.id} 
                          className={`flex items-center gap-3 py-3 px-4 rounded-lg ${
                            item.status === 'complete' ? 'bg-gray-800' : 'bg-transparent'
                          }`}
                        >
                          {getStatusIcon(item.status)}
                          <span className={`flex-1 ${item.status === 'complete' ? 'text-white' : 'text-gray-400'}`}>
                            {item.label}
                          </span>
                          {item.value && item.status === 'complete' && (
                            <span className="text-amber-400 text-sm font-medium">
                              {item.value}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {!isComplete && (
                <div className="mt-10 pt-8 border-t border-gray-700">
                  <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="text-gray-500 text-base mt-4 text-center">
                    {completedCount} / {totalCount} complete
                  </p>
                </div>
              )}

              {isComplete && (
                <WithId id="SCRN-RES-001" name="Results Preview" className="mt-10 pt-8 border-t border-gray-700">
                  <div className="bg-green-900/30 border border-green-700 rounded-xl p-8 text-center">
                    <div className="flex items-center justify-center gap-3 text-green-400 font-semibold mb-6 text-xl">
                      <CheckCircle className="w-7 h-7" />
                      All Data Loaded
                    </div>
                    <div className="flex gap-4 justify-center flex-wrap">
                      <button 
                        onClick={() => navigate(`/map?zip=${zipCode}`)}
                        className="flex items-center gap-3 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold px-8 py-4 rounded-xl transition text-lg"
                      >
                        <MapPin className="w-5 h-5" />
                        View Map
                      </button>
                      <button 
                        onClick={() => navigate(`/report?zip=${zipCode}`)}
                        className="flex items-center gap-3 bg-gray-700 hover:bg-gray-600 text-white font-bold px-8 py-4 rounded-xl transition text-lg"
                      >
                        <FileText className="w-5 h-5" />
                        View Report
                      </button>
                    </div>
                  </div>
                </WithId>
              )}
            </WithId>
          </div>
        )}
      </div>
    </WithId>
  )
}

export default Screener
