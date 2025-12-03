import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { 
  ArrowLeft, MapPin, Printer, Loader2, AlertCircle,
  Users, Building2, TrendingUp, DollarSign, Map
} from 'lucide-react'
import WithId from '../components/WithId'

const API_BASE = import.meta.env.VITE_API_URL || ''

function Report() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const storedZip = localStorage.getItem('hive_current_zip')
  const zip = searchParams.get('zip') || storedZip || '15522'
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reportData, setReportData] = useState(null)

  useEffect(() => {
    async function fetchReport() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_BASE}/api/report/${zip}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch report: ${response.status}`)
        }
        const data = await response.json()
        setReportData(data)
      } catch (err) {
        console.error('Error fetching report:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [zip])

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-'
    return num.toLocaleString()
  }

  const formatCurrency = (num) => {
    if (!num) return '-'
    return `$${num.toLocaleString()}`
  }

  const formatSqft = (num) => {
    if (!num) return '-'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
    return num.toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Generating market report for ZIP {zip}...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Report</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/screener')}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold px-6 py-2 rounded-lg transition"
          >
            Try Another ZIP
          </button>
        </div>
      </div>
    )
  }

  const { zip: zipInfo, analysis, nearby_facilities } = reportData
  const radii = ['1mi', '3mi', '5mi', '10mi', '25mi']

  return (
    <WithId id="RPT-001" name="Report Page" className="flex-1 bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link 
            to="/screener"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            New Search
          </Link>
          <div className="flex gap-2">
            <button 
              onClick={() => navigate(`/map?zip=${zip}`)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold px-4 py-2 rounded-lg transition"
            >
              <Map className="w-4 h-4" />
              View Map
            </button>
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        <WithId id="RPT-HEAD-001" name="Report Header" className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
          <h1 className="text-2xl font-bold mb-1">Market Intelligence Report</h1>
          <p className="text-gray-400">Self-Storage Site Analysis</p>
          
          <div className="mt-6 flex flex-wrap items-center gap-4 p-4 bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" />
              <span className="text-2xl font-bold text-amber-400">{zip}</span>
            </div>
            <div className="text-lg text-gray-300">
              {zipInfo.city}, {zipInfo.state}
            </div>
            <div className="text-gray-500">
              {zipInfo.county_name} County
            </div>
            <div className="ml-auto text-gray-500 text-sm">
              {zipInfo.lat?.toFixed(4)}, {zipInfo.lng?.toFixed(4)}
            </div>
          </div>
        </WithId>

        <Section id="RPT-DEMO-001" name="Demographics Section" title="Demographics" icon={Users}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 text-gray-400 font-medium">Metric</th>
                <th className="text-right py-3 text-gray-400 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              <TableRow label="Population" value={formatNumber(zipInfo.population)} />
              <TableRow label="Population Density (per sq mi)" value={formatNumber(Math.round(zipInfo.density || 0))} />
              <TableRow label="Median Household Income" value={formatCurrency(zipInfo.income_household_median)} />
              <TableRow label="Home Ownership Rate" value={zipInfo.home_ownership ? `${zipInfo.home_ownership}%` : '-'} />
              <TableRow label="Median Age" value={zipInfo.age_median || '-'} />
            </tbody>
          </table>
        </Section>

        <Section id="RPT-SUPP-001" name="Existing Supply" title="Existing Supply by Radius" icon={Building2}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 text-gray-400 font-medium">Metric</th>
                  {radii.map(r => (
                    <th key={r} className="text-right py-3 text-gray-400 font-medium">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-300">Facility Count</td>
                  {radii.map(r => (
                    <td key={r} className="text-right py-3 text-white font-medium">
                      {analysis?.[r]?.supply?.facility_count || 0}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-300">Net Rentable SF</td>
                  {radii.map(r => (
                    <td key={r} className="text-right py-3 text-white font-medium">
                      {formatSqft(analysis?.[r]?.supply?.total_sqft)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-300">SF per Person</td>
                  {radii.map(r => (
                    <td key={r} className="text-right py-3 text-white font-medium">
                      {analysis?.[r]?.supply?.sqft_per_person?.toFixed(2) || '-'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 text-gray-300">Avg Rating</td>
                  {radii.map(r => (
                    <td key={r} className="text-right py-3 text-amber-400 font-medium">
                      {analysis?.[r]?.supply?.avg_rating?.toFixed(1) || '-'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="RPT-PIPE-001" name="Development Pipeline" title="Development Pipeline" icon={TrendingUp}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 text-gray-400 font-medium">Status</th>
                  {radii.map(r => (
                    <th key={r} className="text-right py-3 text-gray-400 font-medium">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span className="text-gray-300">Permit/Approved</span>
                    </span>
                  </td>
                  {radii.map(r => (
                    <td key={r} className="text-right py-3 text-white font-medium">
                      {analysis?.[r]?.pipeline?.permit_count || 0}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                      <span className="text-gray-300">Site Work</span>
                    </span>
                  </td>
                  {radii.map(r => (
                    <td key={r} className="text-right py-3 text-white font-medium">
                      {analysis?.[r]?.pipeline?.site_work_count || 0}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <span className="text-gray-300">Vertical Construction</span>
                    </span>
                  </td>
                  {radii.map(r => (
                    <td key={r} className="text-right py-3 text-white font-medium">
                      {analysis?.[r]?.pipeline?.vertical_count || 0}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="RPT-GAP-001" name="Supply/Demand Gap" title="Supply/Demand Gap Analysis" icon={TrendingUp}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 text-gray-400 font-medium">Demand Scenario</th>
                  {radii.map(r => (
                    <th key={r} className="text-right py-3 text-gray-400 font-medium">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[5, 7, 10].map(sqft => (
                  <tr key={sqft} className="border-b border-gray-700/50">
                    <td className="py-3 text-gray-300">{sqft} SF/person demand</td>
                    {radii.map(r => {
                      const gap = analysis?.[r]?.gap?.[`gap_at_${sqft}_sqft`]
                      const isPositive = gap > 0
                      return (
                        <td 
                          key={r} 
                          className={`text-right py-3 font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}
                        >
                          {gap ? formatSqft(gap) : '-'}
                          {gap && <span className="text-xs ml-1">{isPositive ? '(under)' : '(over)'}</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="RPT-PRICE-001" name="Pricing Analysis" title="Pricing Analysis" icon={DollarSign}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 text-gray-400 font-medium">Unit Type</th>
                  {radii.map(r => (
                    <th key={r} className="text-right py-3 text-gray-400 font-medium">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-300">Avg 10x10 Rent</td>
                  {radii.map(r => (
                    <td key={r} className="text-right py-3 text-white font-medium">
                      {analysis?.[r]?.pricing?.avg_10x10 ? `$${analysis[r].pricing.avg_10x10}` : '-'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 text-gray-300">Avg 10x20 Rent</td>
                  {radii.map(r => (
                    <td key={r} className="text-right py-3 text-white font-medium">
                      {analysis?.[r]?.pricing?.avg_10x20 ? `$${analysis[r].pricing.avg_10x20}` : '-'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {nearby_facilities && nearby_facilities.length > 0 && (
          <Section id="RPT-COMP-001" name="Nearby Competitors" title="Nearby Competitors (within 10mi)" icon={Building2}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 text-gray-400 font-medium">Facility</th>
                    <th className="text-left py-3 text-gray-400 font-medium">City</th>
                    <th className="text-right py-3 text-gray-400 font-medium">Distance</th>
                    <th className="text-right py-3 text-gray-400 font-medium">Est. SF</th>
                    <th className="text-right py-3 text-gray-400 font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {nearby_facilities.slice(0, 15).map((f, i) => (
                    <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-3 text-white">{f.name || 'Unknown'}</td>
                      <td className="py-3 text-gray-400">{f.city}</td>
                      <td className="text-right py-3 text-gray-300">{f.distance_miles?.toFixed(1)}mi</td>
                      <td className="text-right py-3 text-gray-300">{formatSqft(f.estimated_sqft)}</td>
                      <td className="text-right py-3 text-amber-400">{f.rating ? `${f.rating.toFixed(1)}★` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>
    </WithId>
  )
}

function Section({ id, name, title, icon: Icon, children }) {
  return (
    <WithId id={id} name={name} className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
        {Icon && <Icon className="w-5 h-5 text-amber-500" />}
        {title}
      </h2>
      {children}
    </WithId>
  )
}

function TableRow({ label, value }) {
  return (
    <tr className="border-b border-gray-700/50">
      <td className="py-3 text-gray-300">{label}</td>
      <td className="text-right py-3 text-white font-medium">{value}</td>
    </tr>
  )
}

export default Report
