import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { 
  ArrowLeft, Loader2, AlertCircle, CheckCircle, Save,
  Building2, FileText, Map, DollarSign, Clock, Users, Link as LinkIcon, StickyNote
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || ''

const defaultData = {
  county_fips: '',
  county_name: '',
  state: '',
  jurisdiction: '',
  jurisdiction_type: 'county',
  zoning_districts_allowed: [],
  zoning_code_section: '',
  storage_use_definition: '',
  storage_use_category: '',
  by_right: false,
  sup_required: false,
  cup_required: false,
  public_hearing_required: false,
  planning_commission_review: false,
  board_of_zoning_appeals: false,
  approval_code_section: '',
  setback_front_ft: '',
  setback_side_ft: '',
  setback_rear_ft: '',
  setback_code_section: '',
  max_height_ft: '',
  max_height_code_section: '',
  max_lot_coverage_pct: '',
  min_lot_size_acres: '',
  max_building_size_sqft: '',
  landscaping_required: false,
  landscaping_code_section: '',
  landscaping_notes: '',
  buffer_required: false,
  buffer_width_ft: '',
  buffer_code_section: '',
  screening_required: false,
  screening_type: '',
  fencing_required: false,
  fencing_height_ft: '',
  stormwater_required: false,
  stormwater_authority: '',
  stormwater_notes: '',
  architectural_standards: false,
  architectural_notes: '',
  facade_materials_restricted: false,
  parking_spaces_required: '',
  parking_ratio: '',
  loading_space_required: false,
  signage_restrictions: false,
  max_sign_sqft: '',
  signage_notes: '',
  lighting_restrictions: false,
  lighting_notes: '',
  permit_fee_zoning: '',
  permit_fee_building: '',
  permit_fee_site_plan: '',
  permit_fee_other: '',
  permit_fee_other_desc: '',
  permit_fees_total: '',
  fee_schedule_code_section: '',
  impact_fee: '',
  impact_fee_type: '',
  impact_fee_code_section: '',
  timeline_estimate_days: '',
  timeline_notes: '',
  zoning_ordinance_url: '',
  zoning_map_url: '',
  fee_schedule_url: '',
  application_url: '',
  gis_portal_url: '',
  zoning_ordinance_date: '',
  fee_schedule_date: '',
  planning_contact_name: '',
  planning_contact_title: '',
  planning_contact_phone: '',
  planning_contact_email: '',
  building_contact_name: '',
  building_contact_phone: '',
  building_contact_email: '',
  engineering_contact_name: '',
  engineering_contact_phone: '',
  engineering_contact_email: '',
  difficulty_score: '',
  difficulty_rating: '',
  gotchas: '',
  tips: '',
  general_notes: '',
  call_date: '',
  collected_by: '',
  verified: false,
  verified_date: ''
}

function JurisdictionForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isNew = !id || id === 'new'
  
  const [formData, setFormData] = useState(defaultData)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [activeSection, setActiveSection] = useState('basic')

  useEffect(() => {
    if (!isNew && id) {
      fetchJurisdiction()
    }
  }, [id])

  const fetchJurisdiction = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/jurisdictions/${id}`)
      if (!response.ok) throw new Error('Failed to fetch jurisdiction')
      const data = await response.json()
      const formatted = { ...defaultData }
      Object.keys(data).forEach(key => {
        if (data[key] !== null) {
          formatted[key] = data[key]
        }
      })
      setFormData(formatted)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleArrayChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value.split(',').map(s => s.trim()).filter(Boolean)
    }))
  }

  const calculateTotal = () => {
    const zoning = parseFloat(formData.permit_fee_zoning) || 0
    const building = parseFloat(formData.permit_fee_building) || 0
    const sitePlan = parseFloat(formData.permit_fee_site_plan) || 0
    const other = parseFloat(formData.permit_fee_other) || 0
    const impact = parseFloat(formData.impact_fee) || 0
    return zoning + building + sitePlan + other + impact
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const dataToSend = { ...formData }
      dataToSend.permit_fees_total = calculateTotal()
      
      Object.keys(dataToSend).forEach(key => {
        if (dataToSend[key] === '' || dataToSend[key] === null) {
          delete dataToSend[key]
        }
        if (typeof dataToSend[key] === 'string' && (key.includes('_ft') || key.includes('_pct') || key.includes('_sqft') || key.includes('_days') || key.includes('fee'))) {
          const num = parseFloat(dataToSend[key])
          if (!isNaN(num)) dataToSend[key] = num
        }
      })

      const url = isNew 
        ? `${API_BASE}/api/jurisdictions`
        : `${API_BASE}/api/jurisdictions/${id}`
      
      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Failed to save')
      }

      const result = await response.json()
      setSuccess(result.message)
      
      if (isNew && result.id) {
        setTimeout(() => navigate(`/jurisdiction/${result.id}`), 1000)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const sections = [
    { id: 'basic', label: 'Basic', icon: Building2 },
    { id: 'zoning', label: 'Zoning', icon: Map },
    { id: 'approval', label: 'Approval', icon: CheckCircle },
    { id: 'dimensional', label: 'Dimensional', icon: FileText },
    { id: 'site', label: 'Site Req', icon: Building2 },
    { id: 'costs', label: 'Costs', icon: DollarSign },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'urls', label: 'URLs', icon: LinkIcon },
    { id: 'notes', label: 'Notes', icon: StickyNote }
  ]

  if (loading) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading jurisdiction...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-gray-900 text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link 
            to="/jurisdictions"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to List
          </Link>
          <h1 className="text-xl font-bold">
            {isNew ? 'Add New Jurisdiction' : `Edit: ${formData.county_name}, ${formData.state}`}
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}

        <div className="flex flex-wrap gap-1 mb-6 bg-gray-800 rounded-lg p-1 border border-gray-700">
          {sections.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                activeSection === s.id 
                  ? 'bg-amber-500 text-gray-900' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <s.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
            {activeSection === 'basic' && (
              <FormSection title="Basic Information">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormInput label="County FIPS *" name="county_fips" value={formData.county_fips} onChange={handleChange} required />
                  <FormInput label="County Name *" name="county_name" value={formData.county_name} onChange={handleChange} required />
                  <FormSelect 
                    label="State *" 
                    name="state" 
                    value={formData.state} 
                    onChange={handleChange}
                    options={[
                      { value: '', label: 'Select...' },
                      { value: 'PA', label: 'PA' },
                      { value: 'WV', label: 'WV' },
                      { value: 'MD', label: 'MD' },
                      { value: 'VA', label: 'VA' }
                    ]}
                    required
                  />
                  <FormInput label="Jurisdiction Name" name="jurisdiction" value={formData.jurisdiction} onChange={handleChange} placeholder="Leave blank for county" />
                  <FormSelect 
                    label="Type" 
                    name="jurisdiction_type" 
                    value={formData.jurisdiction_type} 
                    onChange={handleChange}
                    options={[
                      { value: 'county', label: 'County' },
                      { value: 'city', label: 'City' },
                      { value: 'town', label: 'Town' },
                      { value: 'township', label: 'Township' }
                    ]}
                  />
                </div>
              </FormSection>
            )}

            {activeSection === 'zoning' && (
              <FormSection title="Zoning Information">
                <div className="space-y-4">
                  <FormInput 
                    label="Zoning Districts Allowed" 
                    name="zoning_districts_allowed" 
                    value={Array.isArray(formData.zoning_districts_allowed) ? formData.zoning_districts_allowed.join(', ') : formData.zoning_districts_allowed} 
                    onChange={handleArrayChange}
                    placeholder="I-1, I-2, C-3 (comma separated)"
                    fullWidth
                  />
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormInput label="Zoning Code Section" name="zoning_code_section" value={formData.zoning_code_section} onChange={handleChange} placeholder="e.g., Section 405.2" />
                    <FormInput label="Storage Use Category" name="storage_use_category" value={formData.storage_use_category} onChange={handleChange} placeholder="e.g., Warehousing" />
                  </div>
                  <FormTextarea label="Storage Use Definition" name="storage_use_definition" value={formData.storage_use_definition} onChange={handleChange} rows={3} />
                </div>
              </FormSection>
            )}

            {activeSection === 'approval' && (
              <FormSection title="Approval Path">
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <FormCheckbox label="By-Right (No Review)" name="by_right" checked={formData.by_right} onChange={handleChange} />
                  <FormCheckbox label="Special Use Permit (SUP)" name="sup_required" checked={formData.sup_required} onChange={handleChange} />
                  <FormCheckbox label="Conditional Use Permit (CUP)" name="cup_required" checked={formData.cup_required} onChange={handleChange} />
                  <FormCheckbox label="Public Hearing Required" name="public_hearing_required" checked={formData.public_hearing_required} onChange={handleChange} />
                  <FormCheckbox label="Planning Commission Review" name="planning_commission_review" checked={formData.planning_commission_review} onChange={handleChange} />
                  <FormCheckbox label="Board of Zoning Appeals" name="board_of_zoning_appeals" checked={formData.board_of_zoning_appeals} onChange={handleChange} />
                </div>
                <FormInput label="Approval Code Section" name="approval_code_section" value={formData.approval_code_section} onChange={handleChange} />
              </FormSection>
            )}

            {activeSection === 'dimensional' && (
              <FormSection title="Dimensional Standards">
                <div className="grid md:grid-cols-3 gap-4">
                  <FormInput label="Front Setback (ft)" name="setback_front_ft" value={formData.setback_front_ft} onChange={handleChange} type="number" />
                  <FormInput label="Side Setback (ft)" name="setback_side_ft" value={formData.setback_side_ft} onChange={handleChange} type="number" />
                  <FormInput label="Rear Setback (ft)" name="setback_rear_ft" value={formData.setback_rear_ft} onChange={handleChange} type="number" />
                  <FormInput label="Setback Code Section" name="setback_code_section" value={formData.setback_code_section} onChange={handleChange} />
                  <FormInput label="Max Height (ft)" name="max_height_ft" value={formData.max_height_ft} onChange={handleChange} type="number" />
                  <FormInput label="Height Code Section" name="max_height_code_section" value={formData.max_height_code_section} onChange={handleChange} />
                  <FormInput label="Max Lot Coverage (%)" name="max_lot_coverage_pct" value={formData.max_lot_coverage_pct} onChange={handleChange} type="number" />
                  <FormInput label="Min Lot Size (acres)" name="min_lot_size_acres" value={formData.min_lot_size_acres} onChange={handleChange} type="number" step="0.01" />
                  <FormInput label="Max Building Size (sqft)" name="max_building_size_sqft" value={formData.max_building_size_sqft} onChange={handleChange} type="number" />
                </div>
              </FormSection>
            )}

            {activeSection === 'site' && (
              <FormSection title="Site Requirements">
                <div className="space-y-6">
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <FormCheckbox label="Landscaping Required" name="landscaping_required" checked={formData.landscaping_required} onChange={handleChange} />
                    <FormCheckbox label="Buffer Required" name="buffer_required" checked={formData.buffer_required} onChange={handleChange} />
                    <FormCheckbox label="Screening Required" name="screening_required" checked={formData.screening_required} onChange={handleChange} />
                    <FormCheckbox label="Fencing Required" name="fencing_required" checked={formData.fencing_required} onChange={handleChange} />
                    <FormCheckbox label="Stormwater Required" name="stormwater_required" checked={formData.stormwater_required} onChange={handleChange} />
                    <FormCheckbox label="Architectural Standards" name="architectural_standards" checked={formData.architectural_standards} onChange={handleChange} />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormInput label="Buffer Width (ft)" name="buffer_width_ft" value={formData.buffer_width_ft} onChange={handleChange} type="number" />
                    <FormInput label="Fencing Height (ft)" name="fencing_height_ft" value={formData.fencing_height_ft} onChange={handleChange} type="number" />
                    <FormInput label="Parking Spaces Required" name="parking_spaces_required" value={formData.parking_spaces_required} onChange={handleChange} />
                    <FormInput label="Stormwater Authority" name="stormwater_authority" value={formData.stormwater_authority} onChange={handleChange} />
                  </div>
                  <FormTextarea label="Landscaping Notes" name="landscaping_notes" value={formData.landscaping_notes} onChange={handleChange} rows={2} />
                  <FormTextarea label="Architectural Notes" name="architectural_notes" value={formData.architectural_notes} onChange={handleChange} rows={2} />
                </div>
              </FormSection>
            )}

            {activeSection === 'costs' && (
              <FormSection title="Costs & Fees">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormInput label="Zoning Permit Fee ($)" name="permit_fee_zoning" value={formData.permit_fee_zoning} onChange={handleChange} type="number" />
                  <FormInput label="Building Permit Fee ($)" name="permit_fee_building" value={formData.permit_fee_building} onChange={handleChange} type="number" />
                  <FormInput label="Site Plan Fee ($)" name="permit_fee_site_plan" value={formData.permit_fee_site_plan} onChange={handleChange} type="number" />
                  <FormInput label="Other Fees ($)" name="permit_fee_other" value={formData.permit_fee_other} onChange={handleChange} type="number" />
                  <FormInput label="Other Fee Description" name="permit_fee_other_desc" value={formData.permit_fee_other_desc} onChange={handleChange} />
                  <FormInput label="Impact Fee ($)" name="impact_fee" value={formData.impact_fee} onChange={handleChange} type="number" />
                  <FormInput label="Impact Fee Type" name="impact_fee_type" value={formData.impact_fee_type} onChange={handleChange} />
                  <FormInput label="Fee Schedule Code Section" name="fee_schedule_code_section" value={formData.fee_schedule_code_section} onChange={handleChange} />
                </div>
                <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
                  <div className="text-sm text-gray-400">Estimated Total Fees</div>
                  <div className="text-2xl font-bold text-amber-400">${calculateTotal().toLocaleString()}</div>
                </div>
              </FormSection>
            )}

            {activeSection === 'timeline' && (
              <FormSection title="Timeline">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormInput label="Timeline Estimate (days)" name="timeline_estimate_days" value={formData.timeline_estimate_days} onChange={handleChange} type="number" />
                </div>
                <FormTextarea label="Timeline Notes" name="timeline_notes" value={formData.timeline_notes} onChange={handleChange} rows={3} placeholder="Typical process steps, delays to expect..." />
              </FormSection>
            )}

            {activeSection === 'contacts' && (
              <FormSection title="Contacts">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-amber-400 mb-3">Planning Department</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormInput label="Name" name="planning_contact_name" value={formData.planning_contact_name} onChange={handleChange} />
                      <FormInput label="Title" name="planning_contact_title" value={formData.planning_contact_title} onChange={handleChange} />
                      <FormInput label="Phone" name="planning_contact_phone" value={formData.planning_contact_phone} onChange={handleChange} />
                      <FormInput label="Email" name="planning_contact_email" value={formData.planning_contact_email} onChange={handleChange} type="email" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-amber-400 mb-3">Building Department</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      <FormInput label="Name" name="building_contact_name" value={formData.building_contact_name} onChange={handleChange} />
                      <FormInput label="Phone" name="building_contact_phone" value={formData.building_contact_phone} onChange={handleChange} />
                      <FormInput label="Email" name="building_contact_email" value={formData.building_contact_email} onChange={handleChange} type="email" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-amber-400 mb-3">Engineering Department</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      <FormInput label="Name" name="engineering_contact_name" value={formData.engineering_contact_name} onChange={handleChange} />
                      <FormInput label="Phone" name="engineering_contact_phone" value={formData.engineering_contact_phone} onChange={handleChange} />
                      <FormInput label="Email" name="engineering_contact_email" value={formData.engineering_contact_email} onChange={handleChange} type="email" />
                    </div>
                  </div>
                </div>
              </FormSection>
            )}

            {activeSection === 'urls' && (
              <FormSection title="URLs & Documents">
                <div className="space-y-4">
                  <UrlInput label="Zoning Ordinance URL" name="zoning_ordinance_url" value={formData.zoning_ordinance_url} onChange={handleChange} />
                  <UrlInput label="Zoning Map URL" name="zoning_map_url" value={formData.zoning_map_url} onChange={handleChange} />
                  <UrlInput label="Fee Schedule URL" name="fee_schedule_url" value={formData.fee_schedule_url} onChange={handleChange} />
                  <UrlInput label="Application URL" name="application_url" value={formData.application_url} onChange={handleChange} />
                  <UrlInput label="GIS Portal URL" name="gis_portal_url" value={formData.gis_portal_url} onChange={handleChange} />
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormInput label="Zoning Ordinance Date" name="zoning_ordinance_date" value={formData.zoning_ordinance_date} onChange={handleChange} type="date" />
                    <FormInput label="Fee Schedule Date" name="fee_schedule_date" value={formData.fee_schedule_date} onChange={handleChange} type="date" />
                  </div>
                </div>
              </FormSection>
            )}

            {activeSection === 'notes' && (
              <FormSection title="Notes & Rating">
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <FormSelect 
                    label="Difficulty Rating" 
                    name="difficulty_rating" 
                    value={formData.difficulty_rating} 
                    onChange={handleChange}
                    options={[
                      { value: '', label: 'Select...' },
                      { value: 'easy', label: 'Easy' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'hard', label: 'Hard' }
                    ]}
                  />
                  <FormInput label="Difficulty Score (1-100)" name="difficulty_score" value={formData.difficulty_score} onChange={handleChange} type="number" min="1" max="100" />
                </div>
                <div className="space-y-4">
                  <FormTextarea label="Gotchas (Watch Out For)" name="gotchas" value={formData.gotchas} onChange={handleChange} rows={3} placeholder="Hidden requirements, unusual processes..." />
                  <FormTextarea label="Tips (What Works)" name="tips" value={formData.tips} onChange={handleChange} rows={3} placeholder="Best approaches, helpful contacts..." />
                  <FormTextarea label="General Notes" name="general_notes" value={formData.general_notes} onChange={handleChange} rows={4} />
                </div>
                <div className="grid md:grid-cols-4 gap-4 mt-6">
                  <FormInput label="Call Date" name="call_date" value={formData.call_date} onChange={handleChange} type="date" />
                  <FormInput label="Collected By" name="collected_by" value={formData.collected_by} onChange={handleChange} />
                  <FormCheckbox label="Verified" name="verified" checked={formData.verified} onChange={handleChange} />
                  <FormInput label="Verified Date" name="verified_date" value={formData.verified_date} onChange={handleChange} type="date" />
                </div>
              </FormSection>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => navigate('/jurisdictions')}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-gray-900 font-semibold rounded-lg transition"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Jurisdiction
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FormSection({ title, children }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-amber-400 mb-4">{title}</h2>
      {children}
    </div>
  )
}

function FormInput({ label, fullWidth, ...props }) {
  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input 
        {...props}
        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
      />
    </div>
  )
}

function FormTextarea({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <textarea 
        {...props}
        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
      />
    </div>
  )
}

function FormSelect({ label, options, ...props }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <select 
        {...props}
        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

function FormCheckbox({ label, ...props }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input 
        type="checkbox"
        {...props}
        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-gray-800"
      />
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  )
}

function UrlInput({ label, value, ...props }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <div className="flex gap-2">
        <input 
          type="url"
          value={value}
          {...props}
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
        />
        {value && (
          <a 
            href={value} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-amber-400 rounded-lg transition"
          >
            Open
          </a>
        )}
      </div>
    </div>
  )
}

export default JurisdictionForm
