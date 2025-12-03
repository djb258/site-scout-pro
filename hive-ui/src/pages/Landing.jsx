import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Database, Building2, Map, FileText, Shield, 
  ArrowRight, MapPin, Layers, Target 
} from 'lucide-react'
import WithId from '../components/WithId'

const API_BASE = import.meta.env.VITE_API_URL || ''

function Landing() {
  const [stats, setStats] = useState({
    jurisdictions: 0,
    states: 0,
    facilities: 0,
    pipeline: 0
  })

  useEffect(() => {
    fetch(`${API_BASE}/api/hive/stats`)
      .then(res => res.json())
      .then(setStats)
      .catch(() => {
        setStats({ jurisdictions: 74, states: 4, facilities: 2351, pipeline: 6698 })
      })
  }, [])

  const dataSources = [
    {
      icon: Building2,
      title: 'Housing Pipeline',
      source: 'County permit portals (Tyler-EnerGov, MGO Connect, OneStop)',
      update: 'Weekly incremental + monthly full',
      coverage: 'Multi-family, townhome, apartment permits',
      signal: 'RED = vertical construction (imminent demand)',
      color: 'text-red-500'
    },
    {
      icon: Map,
      title: 'Existing Facilities',
      source: 'Google Places API, manual verification',
      update: 'Monthly refresh',
      coverage: 'Location, estimated SF, review sentiment',
      signal: 'Competitor density and quality assessment',
      color: 'text-blue-500'
    },
    {
      icon: FileText,
      title: 'Regulatory Intelligence',
      source: 'Multi-LLM research (6 models per jurisdiction)',
      update: 'Quarterly review',
      coverage: 'Zoning codes, permit systems, TPA contacts',
      signal: 'By-right zones, conditional use requirements',
      color: 'text-purple-500'
    },
    {
      icon: Shield,
      title: 'Risk Layers',
      source: 'FEMA, County GIS portals',
      update: 'Annual refresh',
      coverage: 'Flood zones, wetlands, environmental',
      signal: 'Parcel-level risk assessment',
      color: 'text-orange-500'
    }
  ]

  const counties = {
    PA: ['Bedford', 'Blair', 'Cambria'],
    WV: ['Morgan', 'Jefferson', 'Berkeley'],
    MD: ['Allegany'],
    VA: ['Frederick']
  }

  return (
    <WithId id="LAND-001" name="Landing Page" className="flex-1 bg-gray-900 text-white">
      <WithId id="LAND-HERO-001" name="Hero Section" className="relative py-20 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"></div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Database className="w-14 h-14 text-amber-500" />
            <h1 className="text-6xl font-bold tracking-tight">HIVE</h1>
          </div>
          <p className="text-2xl text-gray-300 mb-2">
            Secondary Market Intelligence
          </p>
          <p className="text-xl text-gray-400 mb-6">
            Self-Storage Site Selection System
          </p>
          <p className="text-lg text-amber-400 italic mb-12">
            "Find tomorrow's storage demand today"
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link 
              to="/cockpit"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold px-8 py-4 rounded-lg transition shadow-lg shadow-amber-500/20"
            >
              <Target className="w-5 h-5" />
              Scouting Cockpit
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              to="/screener"
              className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold px-8 py-4 rounded-lg transition"
            >
              Quick Screener
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              to="/map"
              className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold px-8 py-4 rounded-lg transition"
            >
              <MapPin className="w-5 h-5" />
              View Map
            </Link>
          </div>
        </div>
      </WithId>

      <WithId id="LAND-STAT-001" name="Stats Bar" className="bg-gray-800 py-8 border-y border-gray-700">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-6">
          <div>
            <div className="text-4xl font-bold text-amber-500">{stats.jurisdictions || 74}</div>
            <div className="text-gray-400 text-sm mt-1">Counties Researched</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-amber-500">{stats.states || 4}</div>
            <div className="text-gray-400 text-sm mt-1">States Covered</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-amber-500">{(stats.facilities || 2351).toLocaleString()}</div>
            <div className="text-gray-400 text-sm mt-1">Storage Facilities</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-amber-500">{(stats.pipeline || 6698).toLocaleString()}</div>
            <div className="text-gray-400 text-sm mt-1">Pipeline Records</div>
          </div>
        </div>
      </WithId>

      <WithId id="LAND-DATA-001" name="Data Sources Grid" className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Data Sources & Methodology
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Our thesis: Townhome and apartment residents have significantly higher storage needs than single-family homeowners. Track housing pipeline permits to identify imminent demand before competitors.
          </p>
          <div className="grid gap-6">
            {dataSources.map((source, idx) => (
              <DataSourceCard key={idx} {...source} />
            ))}
          </div>
        </div>
      </WithId>

      <WithId id="LAND-COV-001" name="Coverage Area" className="py-16 px-6 bg-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2 flex items-center justify-center gap-2">
            <Layers className="w-6 h-6 text-amber-500" />
            Coverage Area
          </h2>
          <p className="text-gray-400 text-center mb-8">120-mile radius from Bedford, PA</p>
          
          <div className="bg-gray-700/30 rounded-xl border border-gray-700 p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {Object.entries(counties).map(([state, list]) => (
                <div key={state}>
                  <div className="text-lg font-bold text-amber-400 mb-2">{state}</div>
                  <div className="text-gray-400 text-sm space-y-1">
                    {list.map(county => (
                      <div key={county}>{county}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link 
              to="/dashboard"
              className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 font-semibold transition"
            >
              View Market Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </WithId>

      <WithId id="LAND-FOOT-001" name="Footer" className="py-8 px-6 border-t border-gray-800">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-gray-500 text-sm">
            Data Sources: Census Bureau • FEMA • USGS • Google Places • County Records
          </p>
        </div>
      </WithId>
    </WithId>
  )
}

function DataSourceCard({ icon: Icon, title, source, update, coverage, signal, color }) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg bg-gray-700/50 ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold mb-3 text-white">{title}</h3>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-gray-500">Source:</span>
              <span className="text-gray-300 ml-2">{source}</span>
            </div>
            <div>
              <span className="text-gray-500">Update:</span>
              <span className="text-gray-300 ml-2">{update}</span>
            </div>
            <div>
              <span className="text-gray-500">Coverage:</span>
              <span className="text-gray-300 ml-2">{coverage}</span>
            </div>
            <div>
              <span className="text-gray-500">Signal:</span>
              <span className="text-gray-300 ml-2">{signal}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Landing
