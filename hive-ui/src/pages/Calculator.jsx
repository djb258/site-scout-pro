import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { 
  Calculator as CalcIcon, Loader2, AlertCircle, ArrowLeft,
  DollarSign, TrendingUp, Building2, Settings, ChevronDown, ChevronUp
} from 'lucide-react'
import WithId from '../components/WithId'

const API_BASE = import.meta.env.VITE_API_URL || ''

function Calculator() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialCounty = searchParams.get('county') || ''

  const [counties, setCounties] = useState([])
  const [selectedCounty, setSelectedCounty] = useState(initialCounty)
  const [countyData, setCountyData] = useState(null)
  const [buildConstants, setBuildConstants] = useState(null)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [showConstants, setShowConstants] = useState(false)

  const [inputs, setInputs] = useState({
    market_rent: 105,
    land_cost: 85000,
    payback_years: 4
  })

  const [result, setResult] = useState(null)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (selectedCounty) {
      fetchCountyData(selectedCounty)
    }
  }, [selectedCounty])

  const fetchInitialData = async () => {
    try {
      const [countiesRes, constantsRes] = await Promise.all([
        fetch(`${API_BASE}/api/calculator/inputs`),
        fetch(`${API_BASE}/api/build-constants`)
      ])
      
      if (countiesRes.ok) {
        const data = await countiesRes.json()
        setCounties(data)
        if (initialCounty) {
          const found = data.find(c => c.county_fips === initialCounty)
          if (found) {
            setCountyData(found)
            setInputs(prev => ({
              ...prev,
              land_cost: found.land_cost_mid || 85000
            }))
          }
        }
      }
      
      if (constantsRes.ok) {
        setBuildConstants(await constantsRes.json())
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCountyData = async (fips) => {
    try {
      const response = await fetch(`${API_BASE}/api/calculator/inputs/${fips}`)
      if (response.ok) {
        const data = await response.json()
        setCountyData(data)
        setInputs(prev => ({
          ...prev,
          land_cost: data.land_cost_mid || prev.land_cost
        }))
        setResult(null)
      }
    } catch (err) {
      console.error('Error fetching county:', err)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setInputs(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }))
  }

  const calculate = async () => {
    if (!selectedCounty) return
    
    setCalculating(true)
    try {
      const response = await fetch(`${API_BASE}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          county_fips: selectedCounty,
          market_rent: inputs.market_rent,
          land_cost: inputs.land_cost,
          payback_years: inputs.payback_years
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setResult(data)
      } else {
        const err = await response.json()
        console.error('Calculation error:', err)
      }
    } catch (err) {
      console.error('Error calculating:', err)
    } finally {
      setCalculating(false)
    }
  }

  const getVerdictBg = (verdict) => {
    const v = verdict?.toLowerCase()?.replace('_', '-')
    switch (v) {
      case 'go': return 'bg-green-500/20 border-green-500 text-green-400'
      case 'marginal': return 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
      case 'no-go': return 'bg-red-500/20 border-red-500 text-red-400'
      default: return 'bg-gray-500/20 border-gray-600 text-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading calculator...</p>
        </div>
      </div>
    )
  }

  return (
    <WithId id="CALC-001" name="Calculator Page" className="flex-1 bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link 
            to="/dashboard"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>

        <WithId id="CALC-HEAD-001" name="Calculator Header" className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalcIcon className="w-6 h-6 text-amber-500" />
            Reverse Feasibility Calculator
          </h1>
          <p className="text-gray-400 mt-1">Calculate maximum land price for target returns</p>
        </WithId>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                Select Market
              </h2>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">County</label>
                <select
                  value={selectedCounty}
                  onChange={(e) => setSelectedCounty(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select a county...</option>
                  {counties.map(c => (
                    <option key={c.county_fips} value={c.county_fips}>
                      {c.county_name}, {c.state}
                    </option>
                  ))}
                </select>
              </div>

              {countyData && (
                <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Population</span>
                      <p className="text-white font-medium">{countyData.population?.toLocaleString() || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Median Income</span>
                      <p className="text-white font-medium">${countyData.median_income?.toLocaleString() || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Land Cost (est.)</span>
                      <p className="text-white font-medium">${countyData.land_cost_mid?.toLocaleString() || 'N/A'}/acre</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Avg Rent</span>
                      <p className="text-white font-medium">${countyData.avg_rent || 'N/A'}/unit</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <WithId id="CALC-INP-001" name="Input Panel" className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" />
                Input Parameters
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Market Rent ($/unit/mo)</label>
                  <input
                    type="number"
                    name="market_rent"
                    value={inputs.market_rent}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Land Cost ($/acre)</label>
                  <input
                    type="number"
                    name="land_cost"
                    value={inputs.land_cost}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Target Payback (years)</label>
                  <input
                    type="number"
                    name="payback_years"
                    value={inputs.payback_years}
                    onChange={handleInputChange}
                    min="1"
                    max="10"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                onClick={calculate}
                disabled={!selectedCounty || calculating}
                className="w-full mt-6 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                {calculating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <CalcIcon className="w-5 h-5" />
                    Calculate Feasibility
                  </>
                )}
              </button>
            </WithId>

            {buildConstants && (
              <WithId id="CALC-SENS-001" name="Sensitivity Analysis" className="bg-gray-800 rounded-xl border border-gray-700">
                <button
                  onClick={() => setShowConstants(!showConstants)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Settings className="w-5 h-5 text-gray-400" />
                    Build Constants
                  </span>
                  {showConstants ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                
                {showConstants && (
                  <div className="px-4 pb-4 border-t border-gray-700 pt-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Build Cost/SF</span>
                        <p className="text-white">${buildConstants.build_cost_per_sqft}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Target SF</span>
                        <p className="text-white">{buildConstants.target_sqft?.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Occupancy Rate</span>
                        <p className="text-white">{(buildConstants.occupancy_rate * 100).toFixed(0)}%</p>
                      </div>
                      <div>
                        <span className="text-gray-500">OpEx Ratio</span>
                        <p className="text-white">{(buildConstants.opex_ratio * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                )}
              </WithId>
            )}
          </div>

          <div>
            {result ? (
              <WithId id="CALC-RES-001" name="Results Panel" className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                  Feasibility Results
                </h2>

                <div className={`p-4 rounded-lg border-2 mb-6 text-center ${getVerdictBg(result.verdict)}`}>
                  <div className="text-3xl font-bold">{result.verdict}</div>
                  <div className="text-sm opacity-80 mt-1">Market Verdict</div>
                </div>

                <div className="space-y-4">
                  <ResultRow 
                    label="Max Land Cost" 
                    value={`$${result.max_land_cost?.toLocaleString()}/acre`}
                    highlight
                  />
                  <ResultRow 
                    label="Your Input Land Cost" 
                    value={`$${inputs.land_cost?.toLocaleString()}/acre`}
                  />
                  <ResultRow 
                    label="Land Cost Headroom" 
                    value={`$${(result.max_land_cost - inputs.land_cost)?.toLocaleString()}`}
                    positive={result.max_land_cost > inputs.land_cost}
                  />
                  
                  <div className="border-t border-gray-700 pt-4 mt-4">
                    <ResultRow 
                      label="Gross Revenue (Annual)" 
                      value={`$${result.gross_revenue?.toLocaleString()}`}
                    />
                    <ResultRow 
                      label="Net Operating Income" 
                      value={`$${result.noi?.toLocaleString()}`}
                    />
                    <ResultRow 
                      label="Total Project Cost" 
                      value={`$${result.total_cost?.toLocaleString()}`}
                    />
                    <ResultRow 
                      label="Yield on Cost" 
                      value={`${(result.yield_on_cost * 100)?.toFixed(1)}%`}
                    />
                  </div>

                  {result.sensitivity && (
                    <div className="border-t border-gray-700 pt-4 mt-4">
                      <h3 className="text-sm font-semibold text-gray-400 mb-3">Sensitivity Analysis</h3>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        {result.sensitivity.map((s, i) => (
                          <div key={i} className="bg-gray-700/50 rounded p-2 text-center">
                            <div className="text-gray-400 text-xs">{s.scenario}</div>
                            <div className="text-white font-medium">${s.max_land?.toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </WithId>
            ) : (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <CalcIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Select a county and enter parameters to calculate feasibility</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </WithId>
  )
}

function ResultRow({ label, value, highlight, positive }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-400">{label}</span>
      <span className={`font-medium ${
        highlight ? 'text-amber-400 text-lg' : 
        positive === true ? 'text-green-400' : 
        positive === false ? 'text-red-400' : 
        'text-white'
      }`}>
        {value}
      </span>
    </div>
  )
}

export default Calculator
