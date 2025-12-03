import { Zap, Factory, Building2, Users } from 'lucide-react'

function FusionScoreCard({ fusion, compact = false }) {
  if (!fusion) return null

  const score = fusion.score || 0
  const industrial = fusion.industrial || {}
  const housingUnits = fusion.housing_units || 0
  const population = fusion.population || 0

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-green-400'
    if (score >= 40) return 'text-amber-400'
    return 'text-red-400'
  }

  const getScoreBg = (score) => {
    if (score >= 70) return 'bg-green-500/20 border-green-500/30'
    if (score >= 40) return 'bg-amber-500/20 border-amber-500/30'
    return 'bg-red-500/20 border-red-500/30'
  }

  const getScoreLabel = (score) => {
    if (score >= 70) return 'HIGH DEMAND'
    if (score >= 40) return 'MODERATE'
    return 'LOW SIGNAL'
  }

  if (compact) {
    return (
      <div className={`rounded-lg border p-3 ${getScoreBg(score)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className={`w-4 h-4 ${getScoreColor(score)}`} />
            <span className="text-sm font-medium text-gray-300">Fusion Score</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-bold ${getScoreColor(score)}`}>{score}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${getScoreBg(score)} ${getScoreColor(score)}`}>
              {getScoreLabel(score)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border p-4 ${getScoreBg(score)}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className={`w-5 h-5 ${getScoreColor(score)}`} />
          <span className="font-semibold text-white">Fusion Demand Score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</span>
          <span className="text-gray-400 text-sm">/100</span>
        </div>
      </div>

      <div className={`text-center py-2 rounded-lg mb-4 ${getScoreBg(score)}`}>
        <span className={`text-sm font-semibold ${getScoreColor(score)}`}>
          {getScoreLabel(score)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-gray-800/50 rounded-lg p-2">
          <Factory className="w-4 h-4 text-amber-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{industrial.project_count || 0}</div>
          <div className="text-xs text-gray-500">Industrial</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <Building2 className="w-4 h-4 text-blue-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{housingUnits.toLocaleString()}</div>
          <div className="text-xs text-gray-500">MF Units</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <Users className="w-4 h-4 text-purple-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{(population / 1000).toFixed(0)}K</div>
          <div className="text-xs text-gray-500">Population</div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-700/50">
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>Industrial Momentum</span>
            <span className="text-gray-400">55%</span>
          </div>
          <div className="flex justify-between">
            <span>Absorption Pressure</span>
            <span className="text-gray-400">25%</span>
          </div>
          <div className="flex justify-between">
            <span>Population Baseline</span>
            <span className="text-gray-400">20%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FusionScoreCard
