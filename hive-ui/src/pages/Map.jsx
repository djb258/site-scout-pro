import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const createEmojiIcon = (emoji, size = 20) => {
  return L.divIcon({
    html: `<div style="font-size: ${size}px; line-height: 1; text-align: center;">${emoji}</div>`,
    className: 'emoji-marker',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  })
}

const createTextLabel = (text, type = 'county') => {
  const styles = {
    county: 'font-size: 11px; font-weight: 600; color: #1a365d; text-shadow: 1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white; white-space: nowrap;',
    zip: 'font-size: 9px; font-weight: 500; color: #2d3748; text-shadow: 1px 1px 1px white, -1px -1px 1px white; white-space: nowrap;'
  }
  return L.divIcon({
    html: `<div style="${styles[type]}">${text}</div>`,
    className: 'text-label',
    iconSize: [100, 20],
    iconAnchor: [50, 10]
  })
}

const API_BASE = ''

function calculateScore(pipeline) {
  const units = pipeline.total_units || 0
  const status = pipeline.status || 'permit'
  
  const demand = {
    units: units >= 100 ? 10 : units >= 50 ? 5 : 2,
    status: status === 'vertical' ? 10 : status === 'site_work' ? 6 : 3,
    housing: 5,
  }
  demand.total = demand.units + demand.status + demand.housing

  const supply = {
    distance: pipeline.distance_miles > 3 ? 10 : pipeline.distance_miles > 2 ? 6 : 3,
    buffer: pipeline.distance_miles > 3 ? 10 : 3,
    rating: 5,
  }
  supply.total = supply.distance + supply.buffer + supply.rating

  const anchors = {
    college: 0,
    military: 0,
    hospital: 5,
    employer: 5,
  }
  anchors.total = anchors.college + anchors.military + anchors.hospital + anchors.employer

  const market = {
    rent: 8,
    vsModel: 4,
    countyTier: 8,
  }
  market.total = market.rent + market.vsModel + market.countyTier

  const site = {
    flood: 3,
    zoning: 3,
    utilities: 4,
  }
  site.total = site.flood + site.zoning + site.utilities

  const total = Math.min(demand.total + supply.total + anchors.total + market.total + site.total, 100)

  return { demand, supply, anchors, market, site, total }
}

function getVerdict(score) {
  if (score >= 75) return { text: 'GO', icon: '✅', color: '#38a169' }
  if (score >= 60) return { text: 'PROMISING', icon: '⚠️', color: '#ecc94b' }
  if (score >= 45) return { text: 'CAUTION', icon: '⚠️', color: '#ed8936' }
  return { text: 'NO-GO', icon: '❌', color: '#e53e3e' }
}

function MapUpdater({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 8)
    }
  }, [center, zoom, map])
  return null
}

function Map() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const storedZip = localStorage.getItem('hive_current_zip')
  const zip = searchParams.get('zip') || storedZip || '15522'
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mapData, setMapData] = useState(null)
  const [feasibility, setFeasibility] = useState(null)
  const [centerCoords, setCenterCoords] = useState([40.0185, -78.5039])
  
  const [layers, setLayers] = useState({
    radius: true,
    counties: true,
    facilities: true,
    buffers: false,
    townhomes: true,
    apartments: true,
    condos: true,
    mobile: false,
    pipelinePermit: true,
    pipelineSite: true,
    pipelineVertical: true,
    colleges: true,
    military: true,
    hospitals: true,
    employers: true,
    rvParks: true,
    flood: false,
    countyLabels: true,
    zipLabels: false,
  })
  
  const [selectedPipeline, setSelectedPipeline] = useState(null)
  const [shortlist, setShortlist] = useState([])
  const [showExport, setShowExport] = useState(false)
  const [expandedStates, setExpandedStates] = useState({})
  const [expandedCounties, setExpandedCounties] = useState({})
  const [mapZoom, setMapZoom] = useState(8)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [mapResponse, feasibilityResponse] = await Promise.all([
          fetch(`${API_BASE}/api/map-data/${zip}`),
          fetch(`${API_BASE}/api/feasibility`)
        ])
        
        if (!mapResponse.ok) {
          throw new Error(`Failed to fetch data: ${mapResponse.status}`)
        }
        const data = await mapResponse.json()
        setMapData(data)
        if (data.zip && data.zip.lat && data.zip.lng) {
          setCenterCoords([data.zip.lat, data.zip.lng])
        }
        
        if (feasibilityResponse.ok) {
          const feasibilityData = await feasibilityResponse.json()
          setFeasibility(feasibilityData)
        }
      } catch (err) {
        console.error('Error fetching map data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [zip])

  const toggleLayer = (layer) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }))
  }

  const addToShortlist = (item) => {
    if (!shortlist.find(s => s.id === item.id)) {
      setShortlist([...shortlist, { ...item, score: calculateScore(item).total }])
    }
  }

  const viewShortlistItem = (item) => {
    const fullPipeline = mapData?.housing?.find(p => p.id === item.id)
    if (fullPipeline) {
      setSelectedPipeline(fullPipeline)
    }
  }

  const removeFromShortlist = (id) => {
    setShortlist(shortlist.filter(s => s.id !== id))
  }

  const getStatusColor = (status) => {
    if (status === 'vertical' || status === 'under_construction') return '#e53e3e'
    if (status === 'site_work' || status === 'approved') return '#ecc94b'
    return '#38a169'
  }

  const getStatusIcon = (status) => {
    if (status === 'vertical' || status === 'under_construction') return '🔴'
    if (status === 'site_work' || status === 'approved') return '🟡'
    return '🟢'
  }

  const getCommunityTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'townhome': return '#ed8936'
      case 'apartment': return '#805ad5'
      case 'condo': return '#3182ce'
      case 'mobile_home': return '#744210'
      default: return '#718096'
    }
  }

  const getCountyVerdict = (countyFips) => {
    if (!feasibility) return null
    const goMarket = feasibility.go_markets?.find(m => m.county_fips === countyFips)
    if (goMarket) return { verdict: 'GO', color: '#38a169', data: goMarket }
    const marginalMarket = feasibility.marginal_markets?.find(m => m.county_fips === countyFips)
    if (marginalMarket) return { verdict: 'MARGINAL', color: '#ecc94b', data: marginalMarket }
    const nogoMarket = feasibility.nogo_markets?.find(m => m.county_fips === countyFips)
    if (nogoMarket) return { verdict: 'NO-GO', color: '#e53e3e', data: nogoMarket }
    return null
  }

  const getVerdictBadge = (verdict) => {
    if (!verdict) return null
    const badges = {
      'GO': { icon: '✓', bg: '#38a169', text: 'GO' },
      'MARGINAL': { icon: '~', bg: '#ecc94b', text: 'MARG' },
      'NO-GO': { icon: '✗', bg: '#e53e3e', text: 'NO' }
    }
    return badges[verdict] || null
  }

  const zipInfo = mapData?.zip || {}
  const facilities = mapData?.facilities || []
  const housing = mapData?.housing || []
  const anchors = mapData?.anchors || []
  const universities = mapData?.universities || []
  const campgrounds = mapData?.campgrounds || []
  const counties = mapData?.counties || []
  const states = mapData?.states || []

  const toggleState = (state) => {
    setExpandedStates(prev => ({ ...prev, [state]: !prev[state] }))
  }

  const toggleCounty = (countyFips, county) => {
    const isExpanding = !expandedCounties[countyFips]
    setExpandedCounties(prev => ({ ...prev, [countyFips]: !prev[countyFips] }))
    
    if (isExpanding && county?.zips?.length > 0) {
      const zipsWithCoords = county.zips.filter(z => z.lat && z.lng)
      if (zipsWithCoords.length > 0) {
        const avgLat = zipsWithCoords.reduce((sum, z) => sum + z.lat, 0) / zipsWithCoords.length
        const avgLng = zipsWithCoords.reduce((sum, z) => sum + z.lng, 0) / zipsWithCoords.length
        setCenterCoords([avgLat, avgLng])
        setMapZoom(10)
      }
    }
  }

  const focusOnZip = (zipData) => {
    if (zipData?.lat && zipData?.lng) {
      setCenterCoords([zipData.lat, zipData.lng])
      setMapZoom(12)
    }
  }

  const formatNumber = (num) => {
    if (!num) return '0'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K'
    return num.toLocaleString()
  }

  const pipelineHousing = housing.filter(h => 
    h.status && ['permit', 'approved', 'site_work', 'vertical', 'under_construction'].includes(h.status.toLowerCase())
  )
  
  const existingHousing = housing.filter(h => 
    !h.status || h.status.toLowerCase() === 'completed' || h.status.toLowerCase() === 'occupied'
  )

  const stats = {
    counties: counties.length || 0,
    facilities: facilities.length || 0,
    housing: housing.length || 0,
    anchors: (anchors.length || 0) + (universities.length || 0) + (campgrounds.length || 0),
  }

  if (loading) {
    return (
      <div className="map-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#718096' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>Loading map data...</div>
          <div>Fetching data for ZIP {zip}</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="map-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#e53e3e' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Error loading data</div>
          <div>{error}</div>
          <button 
            onClick={() => navigate('/screener')} 
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#38a169', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Try Another ZIP
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="map-container">
      <div className="map-sidebar">
        <div className="sidebar-header">
          <button className="sidebar-action" onClick={() => navigate('/screener')}>
            ← New Search
          </button>
          <button className="sidebar-action" onClick={() => navigate(`/report?zip=${zip}`)}>
            View Report
          </button>
          <div className="export-wrapper">
            <button className="sidebar-action" onClick={() => setShowExport(!showExport)}>
              Export ▼
            </button>
            {showExport && (
              <div className="export-dropdown">
                <button>Export to KML</button>
                <button>Export to GeoJSON</button>
                <button>Generate PDF Report</button>
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-section zip-info">
          <div className="zip-label">ANALYZED ZIP</div>
          <div className="zip-value">{zip}</div>
          <div className="zip-location">{zipInfo.city}, {zipInfo.state}</div>
        </div>

        <div className="sidebar-section stats-grid">
          <div className="stat-box">
            <div className="stat-value">{stats.counties}</div>
            <div className="stat-label">COUNTIES</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{stats.facilities}</div>
            <div className="stat-label">FACILITIES</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{stats.housing}</div>
            <div className="stat-label">HOUSING</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{stats.anchors}</div>
            <div className="stat-label">ANCHORS</div>
          </div>
        </div>

        {feasibility && (
          <div className="sidebar-section feasibility-summary">
            <div className="section-title">FEASIBILITY ANALYSIS</div>
            <div className="feasibility-grid">
              <div className="feasibility-box go">
                <div className="feasibility-value">{feasibility.summary?.go_count || 0}</div>
                <div className="feasibility-label">GO</div>
              </div>
              <div className="feasibility-box marginal">
                <div className="feasibility-value">{feasibility.summary?.marginal_count || 0}</div>
                <div className="feasibility-label">MARGINAL</div>
              </div>
              <div className="feasibility-box nogo">
                <div className="feasibility-value">{feasibility.summary?.nogo_count || 0}</div>
                <div className="feasibility-label">NO-GO</div>
              </div>
            </div>
          </div>
        )}

        <div className="sidebar-section">
          <div className="section-title">MAP LAYERS</div>
          
          <div className="layer-group">
            <div className="layer-group-title">BASE</div>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.radius} onChange={() => toggleLayer('radius')} />
              <span>120mi Radius</span>
            </label>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.counties} onChange={() => toggleLayer('counties')} />
              <span>Counties (by tier)</span>
            </label>
          </div>

          <div className="layer-group">
            <div className="layer-group-title">SUPPLY</div>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.facilities} onChange={() => toggleLayer('facilities')} />
              <span>Storage Facilities ({facilities.length})</span>
            </label>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.buffers} onChange={() => toggleLayer('buffers')} />
              <span>3-Mile Buffers</span>
            </label>
          </div>

          <div className="layer-group">
            <div className="layer-group-title">DEMAND - EXISTING</div>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.townhomes} onChange={() => toggleLayer('townhomes')} />
              <span>Townhomes</span>
            </label>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.apartments} onChange={() => toggleLayer('apartments')} />
              <span>Apartments</span>
            </label>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.condos} onChange={() => toggleLayer('condos')} />
              <span>Condos</span>
            </label>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.mobile} onChange={() => toggleLayer('mobile')} />
              <span>Mobile Homes</span>
            </label>
          </div>

          <div className="layer-group">
            <div className="layer-group-title">DEMAND - PIPELINE ({pipelineHousing.length})</div>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.pipelinePermit} onChange={() => toggleLayer('pipelinePermit')} />
              <span>🟢 Permit/Approved</span>
            </label>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.pipelineSite} onChange={() => toggleLayer('pipelineSite')} />
              <span>🟡 Site Work</span>
            </label>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.pipelineVertical} onChange={() => toggleLayer('pipelineVertical')} />
              <span>🔴 Vertical/Construction</span>
            </label>
          </div>

          <div className="layer-group">
            <div className="layer-group-title">ANCHORS</div>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.colleges} onChange={() => toggleLayer('colleges')} />
              <span>Colleges ({universities.length})</span>
            </label>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.hospitals} onChange={() => toggleLayer('hospitals')} />
              <span>Hospitals</span>
            </label>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.employers} onChange={() => toggleLayer('employers')} />
              <span>Employers</span>
            </label>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.rvParks} onChange={() => toggleLayer('rvParks')} />
              <span>RV Parks ({campgrounds.length})</span>
            </label>
          </div>

          <div className="layer-group">
            <div className="layer-group-title">RISK</div>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.flood} onChange={() => toggleLayer('flood')} />
              <span>Flood Zones</span>
            </label>
          </div>

          <div className="layer-group">
            <div className="layer-group-title">LABELS</div>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.countyLabels} onChange={() => toggleLayer('countyLabels')} />
              <span>County Names</span>
            </label>
            <label className="layer-toggle">
              <input type="checkbox" checked={layers.zipLabels} onChange={() => toggleLayer('zipLabels')} />
              <span>ZIP Codes</span>
            </label>
          </div>
        </div>

        <div className="sidebar-section region-accordion">
          <div className="section-title">REGION ANALYSIS ({states.length} States)</div>
          <div className="accordion-container">
            {states.map(stateData => (
              <div key={stateData.state} className="accordion-item state-item">
                <div 
                  className={`accordion-header state-header ${expandedStates[stateData.state] ? 'expanded' : ''}`}
                  onClick={() => toggleState(stateData.state)}
                >
                  <span className="accordion-toggle">{expandedStates[stateData.state] ? '▼' : '▶'}</span>
                  <span className="accordion-title">{stateData.state}</span>
                  <span className="accordion-meta">{stateData.county_count} counties</span>
                </div>
                
                {expandedStates[stateData.state] && (
                  <div className="accordion-content state-content">
                    <div className="state-stats">
                      <div className="stat-row">
                        <span>Population:</span>
                        <span>{formatNumber(stateData.total_population)}</span>
                      </div>
                      <div className="stat-row">
                        <span>Demand:</span>
                        <span>{formatNumber(stateData.total_demand_sqft)} sqft</span>
                      </div>
                    </div>
                    
                    {stateData.counties.map(county => {
                      const verdictInfo = getCountyVerdict(county.county_fips)
                      const badge = verdictInfo ? getVerdictBadge(verdictInfo.verdict) : null
                      return (
                        <div key={county.county_fips} className="accordion-item county-item">
                        <div 
                          className={`accordion-header county-header ${expandedCounties[county.county_fips] ? 'expanded' : ''}`}
                          onClick={() => toggleCounty(county.county_fips, county)}
                          style={verdictInfo ? { borderLeft: `3px solid ${verdictInfo.color}` } : {}}
                        >
                          <span className="accordion-toggle">{expandedCounties[county.county_fips] ? '▼' : '▶'}</span>
                          <span className="accordion-title">{county.county_name}</span>
                          {badge && (
                            <span 
                              className="verdict-badge"
                              style={{ 
                                background: badge.bg, 
                                color: 'white', 
                                padding: '2px 6px', 
                                borderRadius: '3px', 
                                fontSize: '10px',
                                fontWeight: '600',
                                marginLeft: '4px'
                              }}
                            >
                              {badge.text}
                            </span>
                          )}
                          <span className="accordion-meta">{county.zip_count} ZIPs</span>
                        </div>
                        
                        {expandedCounties[county.county_fips] && (
                          <div className="accordion-content county-content">
                            <div className="county-stats">
                              <div className="stat-grid">
                                <div className="stat-box">
                                  <div className="stat-label">Population</div>
                                  <div className="stat-value">{formatNumber(county.total_population)}</div>
                                </div>
                                <div className="stat-box">
                                  <div className="stat-label">Demand</div>
                                  <div className="stat-value">{formatNumber(county.demand_sqft)} sqft</div>
                                </div>
                                <div className="stat-box">
                                  <div className="stat-label">Housing Units</div>
                                  <div className="stat-value">{formatNumber(county.total_housing_units)}</div>
                                </div>
                                <div className="stat-box">
                                  <div className="stat-label">Avg Income</div>
                                  <div className="stat-value">${formatNumber(county.avg_income)}</div>
                                </div>
                              </div>
                              <div className="housing-breakdown">
                                <div className="breakdown-title">Housing Mix:</div>
                                <div className="breakdown-row">
                                  <span>🏠 SFH: {formatNumber(county.total_sfh)}</span>
                                  <span>🏘️ Townhome: {formatNumber(county.total_townhome)}</span>
                                </div>
                                <div className="breakdown-row">
                                  <span>🏢 Apartment: {formatNumber(county.total_apartment)}</span>
                                  <span>🏕️ Mobile: {formatNumber(county.total_mobile_home)}</span>
                                </div>
                              </div>
                              
                              <div className="zip-list">
                                <div className="zip-list-title">Towns/ZIPs ({county.zips?.length || 0})</div>
                                {county.zips?.slice(0, 10).map(z => (
                                  <div 
                                    key={z.zip} 
                                    className="zip-item"
                                    onClick={() => navigate(`/report?zip=${z.zip}`)}
                                  >
                                    <span className="zip-name">{z.city} ({z.zip})</span>
                                    <span className="zip-pop">Pop: {formatNumber(z.population)}</span>
                                  </div>
                                ))}
                                {(county.zips?.length || 0) > 10 && (
                                  <div className="zip-more">+{county.zips.length - 10} more</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )})}
                    
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {shortlist.length > 0 && (
          <div className="sidebar-section shortlist">
            <div className="section-title">MY SHORTLIST ({shortlist.length})</div>
            {shortlist.map(item => (
              <div key={item.id} className="shortlist-item">
                <div className="shortlist-header">
                  <span>{getStatusIcon(item.status)} {item.name}</span>
                  <span className="shortlist-score">{item.score} pts</span>
                </div>
                <div className="shortlist-actions">
                  <span>{item.city}, {item.state}</span>
                  <button onClick={() => viewShortlistItem(item)}>View</button>
                  <button onClick={() => removeFromShortlist(item.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="map-main">
        <MapContainer
          center={centerCoords}
          zoom={8}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater center={centerCoords} zoom={mapZoom} />

          {layers.radius && (
            <Circle
              center={centerCoords}
              radius={193121}
              pathOptions={{ color: '#3182ce', fillColor: '#3182ce', fillOpacity: 0.05, weight: 2, dashArray: '10, 5' }}
            />
          )}

          {layers.facilities && facilities.filter(f => f.lat && f.lon).map(f => (
            <CircleMarker
              key={f.id}
              center={[f.lat, f.lon]}
              radius={f.total_sqft ? (f.total_sqft > 40000 ? 10 : f.total_sqft > 30000 ? 8 : 6) : 6}
              pathOptions={{ color: '#e53e3e', fillColor: '#e53e3e', fillOpacity: 0.8 }}
            >
              <Tooltip>
                <div className="marker-tooltip">
                  <strong>{f.name}</strong>
                  <div>{f.total_sqft ? f.total_sqft.toLocaleString() + ' sq ft' : 'Size N/A'} • {f.rating || 'N/A'}★</div>
                </div>
              </Tooltip>
              <Popup>
                <div className="facility-popup">
                  <h4>{f.name}</h4>
                  <div className="popup-address">{f.address}</div>
                  <div className="popup-details">
                    <div>Size: {f.total_sqft ? f.total_sqft.toLocaleString() + ' sq ft' : 'N/A'}</div>
                    <div>Rating: {f.rating || 'N/A'} ★</div>
                    <div>Distance: {f.distance_miles?.toFixed(1)} mi</div>
                  </div>
                  {(f.asking_rent_10x10 || f.asking_rent_10x20) && (
                    <div className="popup-section">
                      <strong>ASKING RENTS</strong>
                      {f.asking_rent_10x10 && <div>10×10: ${f.asking_rent_10x10}/mo</div>}
                      {f.asking_rent_10x20 && <div>10×20: ${f.asking_rent_10x20}/mo</div>}
                    </div>
                  )}
                  <a href={`https://maps.google.com/?q=${f.lat},${f.lon}`} target="_blank" rel="noopener noreferrer" className="popup-link">
                    View on Google Maps
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {layers.buffers && facilities.filter(f => f.lat && f.lon).map(f => (
            <Circle
              key={`buffer-${f.id}`}
              center={[f.lat, f.lon]}
              radius={4828}
              pathOptions={{ color: '#e53e3e', fillColor: '#e53e3e', fillOpacity: 0.1, weight: 1, dashArray: '5, 5' }}
            />
          ))}

          {existingHousing.map(h => {
            const type = h.community_type?.toLowerCase() || ''
            const showMarker = 
              (type.includes('townhome') && layers.townhomes) ||
              (type.includes('apartment') && layers.apartments) ||
              (type.includes('condo') && layers.condos) ||
              (type.includes('mobile') && layers.mobile) ||
              (!type && layers.townhomes)
            
            if (!showMarker || !h.lat || !h.lon) return null
            
            return (
              <CircleMarker
                key={h.id}
                center={[h.lat, h.lon]}
                radius={5}
                pathOptions={{ 
                  color: getCommunityTypeColor(h.community_type), 
                  fillColor: getCommunityTypeColor(h.community_type), 
                  fillOpacity: 0.7 
                }}
              >
                <Tooltip>
                  <div className="marker-tooltip">
                    <strong>{h.name}</strong>
                    <div>{h.total_units || 0} units • {h.community_type || 'Housing'}</div>
                  </div>
                </Tooltip>
                <Popup>
                  <h4>{h.name}</h4>
                  <div>{h.city}, {h.state}</div>
                  <div>Type: {h.community_type || 'N/A'}</div>
                  <div>Units: {h.total_units || 'N/A'}</div>
                </Popup>
              </CircleMarker>
            )
          })}

          {pipelineHousing.map(p => {
            const status = p.status?.toLowerCase() || ''
            const showMarker = 
              ((status === 'permit' || status === 'approved') && layers.pipelinePermit) ||
              (status === 'site_work' && layers.pipelineSite) ||
              ((status === 'vertical' || status === 'under_construction') && layers.pipelineVertical)
            
            if (!showMarker || !p.lat || !p.lon) return null
            
            return (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lon]}
                radius={8}
                pathOptions={{
                  color: getStatusColor(status),
                  fillColor: getStatusColor(status),
                  fillOpacity: 0.9,
                  weight: 3
                }}
                eventHandlers={{
                  click: () => setSelectedPipeline(p)
                }}
              >
                <Tooltip>
                  <div className="marker-tooltip">
                    <strong>{getStatusIcon(status)} {p.name}</strong>
                    <div>{p.total_units || 0} units • {p.status}</div>
                  </div>
                </Tooltip>
              </CircleMarker>
            )
          })}

          {layers.colleges && universities.map(u => (
            <Marker
              key={u.id}
              position={[u.lat, u.lng]}
              icon={createEmojiIcon('🎓', 22)}
            >
              <Tooltip>🎓 {u.name}<br/>{u.total_enrollment?.toLocaleString() || 0} students</Tooltip>
              <Popup>
                <h4>🎓 {u.name}</h4>
                <div>{u.city}, {u.state}</div>
                <div>Enrollment: {u.total_enrollment?.toLocaleString() || 'N/A'}</div>
                <div>Has Dorms: {u.has_dorms ? 'Yes' : 'No'}</div>
              </Popup>
            </Marker>
          ))}

          {layers.hospitals && anchors.filter(a => a.anchor_type?.toLowerCase() === 'hospital').map(a => (
            <Marker
              key={a.id}
              position={[a.lat, a.lon]}
              icon={createEmojiIcon('🏥', 20)}
            >
              <Tooltip>🏥 {a.name}</Tooltip>
              <Popup><h4>🏥 {a.name}</h4><div>{a.city}, {a.state}</div></Popup>
            </Marker>
          ))}

          {layers.employers && anchors.filter(a => a.anchor_type?.toLowerCase() === 'employer' || a.anchor_type?.toLowerCase() === 'distribution_center').map(a => (
            <Marker
              key={a.id}
              position={[a.lat, a.lon]}
              icon={createEmojiIcon('🏭', 18)}
            >
              <Tooltip>🏭 {a.name}<br/>{a.employee_count?.toLocaleString() || 'N/A'} employees</Tooltip>
              <Popup><h4>🏭 {a.name}</h4><div>{a.city}, {a.state}</div><div>{a.employee_count?.toLocaleString() || 'N/A'} employees</div></Popup>
            </Marker>
          ))}

          {layers.rvParks && campgrounds.map(c => (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={createEmojiIcon('🚐', 18)}
            >
              <Tooltip>🚐 {c.name}<br/>{c.rv_sites || 0} RV sites</Tooltip>
              <Popup>
                <h4>🚐 {c.name}</h4>
                <div>{c.city}, {c.state}</div>
                <div>RV Sites: {c.rv_sites || 0}</div>
                <div>Has Hookups: {c.has_hookups ? 'Yes' : 'No'}</div>
              </Popup>
            </Marker>
          ))}

          {layers.countyLabels && counties.map(county => {
            const countyZips = states.flatMap(s => s.counties).find(c => c.county_fips === county.county_fips)?.zips || []
            const validZips = countyZips.filter(z => z.lat && z.lng)
            if (validZips.length === 0) return null
            const avgLat = validZips.reduce((sum, z) => sum + z.lat, 0) / validZips.length
            const avgLng = validZips.reduce((sum, z) => sum + z.lng, 0) / validZips.length
            return (
              <Marker
                key={`county-label-${county.county_fips}`}
                position={[avgLat, avgLng]}
                icon={createTextLabel(`${county.county_name} Co.`, 'county')}
                interactive={false}
              />
            )
          })}

          {layers.zipLabels && states.flatMap(s => s.counties).flatMap(c => c.zips || []).filter(z => z.lat && z.lng).map(z => (
            <Marker
              key={`zip-label-${z.zip}`}
              position={[z.lat, z.lng]}
              icon={createTextLabel(z.zip, 'zip')}
            >
              <Tooltip>{z.city}, {z.state} ({z.zip})<br/>Pop: {z.population?.toLocaleString()}</Tooltip>
            </Marker>
          ))}
        </MapContainer>

        <div className="map-legend">
          🔴 Storage Facility | 🟠 Townhome | 🟣 Apartment | 🔵 Condo | 🟤 Mobile | 🎓 College | 🏥 Hospital | 🏭 Employer | 🚐 RV Park
        </div>
      </div>

      {selectedPipeline && (() => {
        const scores = calculateScore(selectedPipeline)
        const verdict = getVerdict(scores.total)
        return (
          <div className="scorecard-panel">
            <div className="scorecard-header">
              <h3>{getStatusIcon(selectedPipeline.status)} {selectedPipeline.name}</h3>
              <button className="close-btn" onClick={() => setSelectedPipeline(null)}>×</button>
            </div>
            <div className="scorecard-location">
              {selectedPipeline.city}, {selectedPipeline.state}
            </div>

            <div className="scorecard-section">
              <div className="section-header">
                <span>DEMAND</span>
                <span className="section-score">+{scores.demand.total}</span>
              </div>
              <div className={`score-item ${scores.demand.units >= 5 ? 'positive' : 'warning'}`}>
                {scores.demand.units >= 5 ? '✅' : '⚠️'} Units: {selectedPipeline.total_units || 0} (+{scores.demand.units})
              </div>
              <div className={`score-item ${scores.demand.status >= 6 ? 'positive' : 'warning'}`}>
                {scores.demand.status >= 6 ? '✅' : '⚠️'} Status: {selectedPipeline.status} (+{scores.demand.status})
              </div>
              <div className="score-item positive">✅ Community Type: {selectedPipeline.community_type || 'N/A'}</div>
            </div>

            <div className="scorecard-section">
              <div className="section-header">
                <span>SUPPLY</span>
                <span className="section-score">+{scores.supply.total}</span>
              </div>
              <div className={`score-item ${scores.supply.distance >= 6 ? 'positive' : 'warning'}`}>
                {scores.supply.distance >= 6 ? '✅' : '⚠️'} Distance from center: {selectedPipeline.distance_miles?.toFixed(1)}mi (+{scores.supply.distance})
              </div>
              <div className="score-item positive">✅ Competition analysis (+{scores.supply.buffer})</div>
            </div>

            <div className="scorecard-section">
              <div className="section-header">
                <span>DEMAND ANCHORS</span>
                <span className="section-score">+{scores.anchors.total}</span>
              </div>
              <div className="score-item positive">✅ Nearby universities: {universities.length}</div>
              <div className="score-item positive">✅ RV parks in area: {campgrounds.length}</div>
            </div>

            <div className="scorecard-section">
              <div className="section-header">
                <span>MARKET</span>
                <span className="section-score">+{scores.market.total}</span>
              </div>
              <div className="score-item positive">✅ Market conditions favorable (+{scores.market.rent})</div>
              <div className="score-item positive">✅ County tier bonus (+{scores.market.countyTier})</div>
            </div>

            <div className="scorecard-section">
              <div className="section-header">
                <span>SITE FACTORS</span>
                <span className="section-score">+{scores.site.total}</span>
              </div>
              <div className="score-item pending">⬜ Flood zone: Check FEMA (+{scores.site.flood})</div>
              <div className="score-item pending">⬜ Zoning: Check County (+{scores.site.zoning})</div>
            </div>

            <div className="scorecard-total">
              <div className="total-score">SCORE: {scores.total} / 100</div>
              <div className="verdict" style={{ color: verdict.color }}>
                VERDICT: {verdict.text} {verdict.icon}
              </div>
            </div>

            <div className="scorecard-section">
              <div className="section-header">LAND LISTINGS</div>
              <div className="land-links">
                <a href={`https://www.zillow.com/homes/${selectedPipeline.city?.replace(/,?\s+/g, '-')}-${selectedPipeline.state}_rb/`} target="_blank" rel="noopener noreferrer">Zillow</a>
                <a href="https://www.landwatch.com" target="_blank" rel="noopener noreferrer">LandWatch</a>
                <a href="https://www.land.com" target="_blank" rel="noopener noreferrer">Land.com</a>
              </div>
            </div>

            <div className="scorecard-actions">
              <button className="action-btn primary" onClick={() => addToShortlist(selectedPipeline)}>
                Add to Shortlist
              </button>
              <button className="action-btn">Export</button>
              <button className="action-btn">Notes</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default Map
