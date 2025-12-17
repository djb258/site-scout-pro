# PRD Canonical Map

**Generated:** 2025-12-17
**Purpose:** Source of truth for repository structure alignment

---

## PRD Registry

| PRD ID | Pass | Hub Name | Doctrine ID | Spokes |
|--------|------|----------|-------------|--------|
| PRD_PASS0_RADAR_HUB | 0 | PASS0_RADAR_HUB | SS.00.00 | 6 |
| PRD_PASS1_STRUCTURE_HUB | 1 | PASS1_STRUCTURE_HUB | SS.01.00 | 8 |
| PRD_PASS15_RENT_RECON_HUB | 1.5 | PASS15_RENT_RECON_HUB | SS.015.00 | 5 |
| PRD_PASS2_UNDERWRITING_HUB | 2 | PASS2_UNDERWRITING_HUB | SS.02.00 | 11 |
| PRD_PASS3_DESIGN_HUB | 3 | PASS3_DESIGN_HUB | SS.03.00 | 9 |
| PRD_DATA_LAYER_HUB | N/A | DATA_LAYER_HUB | SS.DL.00 | 2 |

---

## Pass-0 Radar Hub (SS.00.00)

**PRD:** `docs/prd/PRD_PASS0_RADAR_HUB.md`
**Directory:** `/src/pass0/radar_hub/`

### Spokes
| Spoke | Doctrine ID | File |
|-------|-------------|------|
| TrendSignal | SS.00.01 | `spokes/TrendSignal.ts` |
| PermitActivity | SS.00.02 | `spokes/PermitActivity.ts` |
| NewsEvents | SS.00.03 | `spokes/NewsEvents.ts` |
| IndustrialLogistics | SS.00.04 | `spokes/IndustrialLogistics.ts` |
| HousingPipeline | SS.00.05 | `spokes/HousingPipeline.ts` |
| MomentumFusion | SS.00.06 | `spokes/MomentumFusion.ts` |

### Entry Points
| Entry Point | File |
|-------------|------|
| Orchestrator | `orchestrator/Pass0Orchestrator.ts` |
| Edge Function | `edge/start_pass0.ts` |

### Outputs
- MomentumAnalysis object
- Fused momentum score (0-100)

---

## Pass-1 Structure Hub (SS.01.00)

**PRD:** `docs/prd/PRD_PASS1_STRUCTURE_HUB.md`
**Directory:** `/src/pass1/structure_hub/`

### Spokes
| Spoke | Doctrine ID | File |
|-------|-------------|------|
| ZipHydration | SS.01.01 | `spokes/ZipHydration.ts` |
| RadiusBuilder | SS.01.02 | `spokes/RadiusBuilder.ts` |
| MacroDemand | SS.01.03 | `spokes/MacroDemand.ts` |
| MacroSupply | SS.01.04 | `spokes/MacroSupply.ts` |
| CompetitorRegistry | SS.01.05 | `spokes/CompetitorRegistry.ts` |
| LocalScan | SS.01.06 | `spokes/LocalScan.ts` |
| HotspotScoring | SS.01.07 | `spokes/HotspotScoring.ts` |
| ValidationGate | SS.01.08 | `spokes/ValidationGate.ts` |

### Entry Points
| Entry Point | File |
|-------------|------|
| Orchestrator | `orchestrator/Pass1Orchestrator.ts` |
| Edge Function | `edge/start_pass1.ts` |

### Outputs
- OpportunityObject (enriched)
- Hotspot score and tier

---

## Pass-1.5 Rent Recon Hub (SS.015.00)

**PRD:** `docs/prd/PRD_PASS15_RENT_RECON_HUB.md`
**Directory:** `/src/pass15/rent_recon_hub/`

### Spokes
| Spoke | Doctrine ID | File |
|-------|-------------|------|
| PublishedRateScraper | SS.015.01 | `spokes/PublishedRateScraper.ts` |
| AICallWorkOrders | SS.015.02 | `spokes/AICallWorkOrders.ts` |
| RateEvidenceNormalizer | SS.015.03 | `spokes/RateEvidenceNormalizer.ts` |
| CoverageConfidence | SS.015.04 | `spokes/CoverageConfidence.ts` |
| PromotionGate | SS.015.05 | `spokes/PromotionGate.ts` |

### Entry Points
| Entry Point | File |
|-------------|------|
| Orchestrator | `orchestrator/Pass15Orchestrator.ts` |
| Edge Function | `edge/start_pass15.ts` |

### Outputs
- RateEvidencePackage
- Coverage confidence score

---

## Pass-2 Underwriting Hub (SS.02.00)

**PRD:** `docs/prd/PRD_PASS2_UNDERWRITING_HUB.md`
**Directory:** `/src/pass2/underwriting_hub/`

### Spokes
| Spoke | Doctrine ID | File |
|-------|-------------|------|
| Zoning | SS.02.01 | `spokes/Zoning.ts` |
| CivilConstraints | SS.02.02 | `spokes/CivilConstraints.ts` |
| PermitsStatic | SS.02.03 | `spokes/PermitsStatic.ts` |
| PricingVerification | SS.02.04 | `spokes/PricingVerification.ts` |
| FusionDemand | SS.02.05 | `spokes/FusionDemand.ts` |
| CompetitivePressure | SS.02.06 | `spokes/CompetitivePressure.ts` |
| Feasibility | SS.02.07 | `spokes/Feasibility.ts` |
| ReverseFeasibility | SS.02.08 | `spokes/ReverseFeasibility.ts` |
| MomentumReader | SS.02.09 | `spokes/MomentumReader.ts` |
| Verdict | SS.02.10 | `spokes/Verdict.ts` |
| VaultMapper | SS.02.11 | `spokes/VaultMapper.ts` |

### Entry Points
| Entry Point | File |
|-------------|------|
| Orchestrator | `orchestrator/Pass2Orchestrator.ts` |
| Edge Function | `edge/start_pass2.ts` |

### Outputs
- UnderwritingPackage
- GO/NO_GO/MAYBE verdict
- STAMPED vault record

---

## Pass-3 Design/Calculator Hub (SS.03.00)

**PRD:** `docs/prd/PRD_PASS3_DESIGN_HUB.md`
**Directory:** `/src/pass3/design_hub/`

### Spokes
| Spoke | Doctrine ID | File |
|-------|-------------|------|
| SetbackEngine | SS.03.01 | `spokes/SetbackEngine.ts` |
| CoverageEngine | SS.03.02 | `spokes/CoverageEngine.ts` |
| UnitMixOptimizer | SS.03.03 | `spokes/UnitMixOptimizer.ts` |
| PhasePlanner | SS.03.04 | `spokes/PhasePlanner.ts` |
| BuildCostModel | SS.03.05 | `spokes/BuildCostModel.ts` |
| NOIEngine | SS.03.06 | `spokes/NOIEngine.ts` |
| DebtModel | SS.03.07 | `spokes/DebtModel.ts` |
| MaxLandPrice | SS.03.08 | `spokes/MaxLandPrice.ts` |
| IRRModel | SS.03.09 | `spokes/IRRModel.ts` |

### Entry Points
| Entry Point | File |
|-------------|------|
| Orchestrator | `orchestrator/Pass3Orchestrator.ts` |
| Edge Function | `edge/start_pass3.ts` |

### Outputs
- ProFormaSummary
- Investment memo data

---

## Data Layer Hub (SS.DL.00)

**PRD:** `docs/prd/PRD_DATA_LAYER_HUB.md`
**Directory:** `/src/shared/data_layer/`

### Components
| Component | Doctrine ID | File | Status |
|-----------|-------------|------|--------|
| LovableAdapter | SS.DL.01 | `adapters/LovableAdapter.ts` | Implemented |
| NeonAdapter | SS.DL.02 | `adapters/NeonAdapter.ts` | Stub (by design) |

**Note:** Firebase is NOT used in this repository. FirebaseAdapter is intentionally excluded.

### Shared Dependencies
| Dependency | File |
|------------|------|
| MasterFailureLogger | `failures/masterFailureLogger.ts` |
| MasterFailureHub | `failures/MasterFailureHub.ts` |
| OpportunityObject | `types/OpportunityObject.ts` |

---

## Target Directory Structure

```
/src
  /pass0
    /radar_hub
      /orchestrator
        Pass0Orchestrator.ts
      /spokes
        TrendSignal.ts
        PermitActivity.ts
        NewsEvents.ts
        IndustrialLogistics.ts
        HousingPipeline.ts
        MomentumFusion.ts
      /edge
        start_pass0.ts
      /types
        pass0_types.ts
      README.md

  /pass1
    /structure_hub
      /orchestrator
        Pass1Orchestrator.ts
      /spokes
        ZipHydration.ts
        RadiusBuilder.ts
        MacroDemand.ts
        MacroSupply.ts
        CompetitorRegistry.ts
        LocalScan.ts
        HotspotScoring.ts
        ValidationGate.ts
      /edge
        start_pass1.ts
      /types
        pass1_types.ts
      README.md

  /pass15
    /rent_recon_hub
      /orchestrator
        Pass15Orchestrator.ts
      /spokes
        PublishedRateScraper.ts
        AICallWorkOrders.ts
        RateEvidenceNormalizer.ts
        CoverageConfidence.ts
        PromotionGate.ts
      /edge
        start_pass15.ts
      /types
        pass15_types.ts
      README.md

  /pass2
    /underwriting_hub
      /orchestrator
        Pass2Orchestrator.ts
      /spokes
        Zoning.ts
        CivilConstraints.ts
        PermitsStatic.ts
        PricingVerification.ts
        FusionDemand.ts
        CompetitivePressure.ts
        Feasibility.ts
        ReverseFeasibility.ts
        MomentumReader.ts
        Verdict.ts
        VaultMapper.ts
      /edge
        start_pass2.ts
        save_to_vault.ts
      /types
        pass2_types.ts
      README.md

  /pass3
    /design_hub
      /orchestrator
        Pass3Orchestrator.ts
      /spokes
        SetbackEngine.ts
        CoverageEngine.ts
        UnitMixOptimizer.ts
        PhasePlanner.ts
        BuildCostModel.ts
        NOIEngine.ts
        DebtModel.ts
        MaxLandPrice.ts
        IRRModel.ts
      /edge
        start_pass3.ts
      /types
        pass3_types.ts
      README.md

  /shared
    /data_layer
      /adapters
        LovableAdapter.ts
        NeonAdapter.ts
        FirebaseAdapter.ts
      README.md
    /failures
      MasterFailureHub.ts
      masterFailureLogger.ts
    /types
      OpportunityObject.ts
      shared_types.ts
    /config
      GlobalConfig.ts

  /ui
    /components
      [all UI components]
    /pages
      [all page components]
    /hooks
      [custom hooks]
    /contexts
      [React contexts]
    /services
      [UI service layer]

/tests
  /pass0
  /pass1
  /pass15
  /pass2
  /pass3
  /shared
```

---

## Files NOT Owned by Any PRD

All files have been moved to their PRD-aligned locations. No orphaned files remain.

| Original Location | New Location | Status |
|-------------------|--------------|--------|
| `src/services/pass1Calculators.ts` | `/shared/calculators/pass1Calculators.ts` | ✅ Moved |
| `src/services/pass2Calculators.ts` | `/shared/calculators/pass2Calculators.ts` | ✅ Moved |
| `src/pipeline/Pass1ToPass2Validator.ts` | `/shared/validators/Pass1ToPass2Validator.ts` | ✅ Moved |
| `src/engine/*` | `/src/ui/pages/engine/` | ✅ Moved |

---

## Validation Checklist

For each PRD:
- [x] Directory exists at correct path
- [x] All spokes present
- [x] Orchestrator present
- [x] Edge function present
- [x] Types file present
- [x] README.md present
- [x] Tests exist in `/tests/{pass}/`

### Per-Hub Validation Status

| Hub | Directory | Spokes | Orchestrator | Edge | Types | README |
|-----|-----------|--------|--------------|------|-------|--------|
| Pass-0 | ✅ | ✅ 6/6 | ✅ | ✅ | ✅ | ✅ |
| Pass-1 | ✅ | ✅ 8/8 | ✅ | ✅ | ✅ | ✅ |
| Pass-1.5 | ✅ | ✅ 5/5 | ✅ | ✅ | ✅ | ✅ |
| Pass-2 | ✅ | ✅ 11/11 | ✅ | ✅ | ✅ | ✅ |
| Pass-3 | ✅ | ✅ 9/9 | ✅ | ✅ | ✅ | ✅ |
| Data Layer | ✅ | ⚠️ 1/3 | N/A | N/A | N/A | ✅ |
