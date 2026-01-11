# PRD — Hub

## Conformance

| Field | Value |
|-------|-------|
| **Doctrine Version** | 1.2.0 |
| **CTB Version** | 1.0.0 |
| **CC Layer** | CC-02 |

---

## 1. Sovereign Reference (CC-01)

| Field | Value |
|-------|-------|
| **Sovereign ID** | SOV-BARTON |
| **Sovereign Boundary** | Barton Doctrine |

---

## 2. Hub Identity (CC-02)

| Field | Value |
|-------|-------|
| **Hub Name** | Storage Site Go/No-Go Engine |
| **Hub ID** | HUB-STORAGE-GONOGO |
| **Owner** | Barton Storage Development |
| **Version** | 1.0.0 |

---

## 3. Purpose

The Storage Site Go/No-Go Engine is a multi-pass evaluation system for self-storage development site assessment. This hub owns the complete evaluation pipeline from initial screening through vault storage of approved sites.

The hub receives site data through ingress spokes, processes it through multiple evaluation passes (Pass 0-3), and emits Go/No-Go decisions through egress spokes.

---

## 4. CTB Placement

| Field | Value | CC Layer |
|-------|-------|----------|
| **Trunk** | site-scout-pro | CC-02 |
| **Branch** | storage-evaluation | CC-02 |
| **Leaf** | go-nogo-engine | CC-02 |

---

## 5. IMO Structure (CC-02)

_This hub owns all three IMO layers internally. Spokes are external CC-03 interfaces only._

| Layer | Role | Description | CC Layer |
|-------|------|-------------|----------|
| **I — Ingress** | Dumb input only | Receives site data, census data, market data | CC-02 |
| **M — Middle** | Logic, decisions, state | Pass 0-3 evaluation pipeline, vault management | CC-02 |
| **O — Egress** | Output only | Emits Go/No-Go decisions, reports, vault exports | CC-02 |

---

## 6. Spokes (CC-03 Interfaces)

_Spokes are interfaces ONLY. They carry no logic, tools, or state. Each spoke is typed as Ingress (I) or Egress (O)._

| Spoke Name | Type | Direction | Contract | CC Layer |
|------------|------|-----------|----------|----------|
| SPOKE-I-CENSUS | I | Inbound | Census demographic data | CC-03 |
| SPOKE-I-MARKET-DATA | I | Inbound | Market and competitor data | CC-03 |
| SPOKE-O-VAULT-EXPORT | O | Outbound | Approved site exports | CC-03 |
| SPOKE-O-REPORT | O | Outbound | Evaluation reports | CC-03 |

---

## 7. Constants vs Variables

_Declare which elements are constants (ADR-gated) vs variables (configuration)._

| Element | Type | Mutability | CC Layer |
|---------|------|------------|----------|
| Hub ID | Constant | Immutable | CC-02 |
| Hub Name | Constant | ADR-gated | CC-02 |
| Pass Thresholds | Variable | Configuration | CC-03 |
| Scoring Weights | Variable | Configuration | CC-03 |

---

## 8. Tools

_All tools are scoped strictly INSIDE this hub's M layer. Spokes do not own tools._

| Tool | Solution Type | CC Layer | IMO Layer | ADR Reference |
|------|---------------|----------|-----------|---------------|
| Pass0 Radar | Deterministic | CC-02 | M | ADR-001 |
| Pass1 Structure | Deterministic | CC-02 | M | ADR-002 |
| Pass15 Rent Recon | Deterministic | CC-02 | M | ADR-003 |
| Pass2 Underwriting | Deterministic | CC-02 | M | ADR-004 |
| Pass3 Design | Deterministic | CC-02 | M | ADR-005 |
| CCA Recon Agent | LLM-tail | CC-02 | M | ADR-006 |
| Vault Guardian | Deterministic | CC-02 | M | ADR-025 |

---

## 9. Guard Rails

| Guard Rail | Type | Threshold | CC Layer |
|------------|------|-----------|----------|
| API Rate Limit | Rate Limit | 100/min | CC-03 |
| Evaluation Timeout | Timeout | 30s per pass | CC-03 |
| Input Validation | Validation | Schema-enforced | CC-03 |

---

## 10. Kill Switch

| Field | Value |
|-------|-------|
| **Activation Criteria** | Failed evaluation count > 10/hour |
| **Trigger Authority** | CC-02 (Hub) / CC-01 (Sovereign) |
| **Emergency Contact** | Hub Owner |

---

## 11. Promotion Gates

| Gate | Artifact | CC Layer | Requirement |
|------|----------|----------|-------------|
| G1 | PRD | CC-02 | Hub definition approved |
| G2 | ADR | CC-03 | Architecture decision recorded |
| G3 | Work Item | CC-04 | Execution item created |
| G4 | PR | CC-04 | Code reviewed and merged |
| G5 | Checklist | CC-04 | Compliance verification complete |

---

## 12. Failure Modes

| Failure | Severity | CC Layer | Remediation |
|---------|----------|----------|-------------|
| Census data unavailable | High | CC-03 | Fallback to cached data |
| Evaluation timeout | Medium | CC-04 | Retry with backoff |
| Invalid input schema | Low | CC-03 | Reject with error message |

---

## 13. PID Scope (CC-04)

_Process ID is minted at CC-04 for each execution instance._

| Field | Value |
|-------|-------|
| **PID Pattern** | `HUB-STORAGE-GONOGO-${TIMESTAMP}-${RANDOM_HEX}` |
| **Retry Policy** | New PID per retry |
| **Audit Trail** | Required |

---

## 14. Human Override Rules

_When can a human bypass automation? Who approves? (Trigger authority must be CC-02 or CC-01)_

- Override for forced vault promotion requires CC-02 approval
- Override for threshold adjustment requires ADR and CC-01 approval

---

## 15. Observability

| Type | Description | CC Layer |
|------|-------------|----------|
| **Logs** | Evaluation pipeline logs | CC-04 |
| **Metrics** | Pass success rates, evaluation times | CC-04 |
| **Alerts** | Failed evaluation threshold, system errors | CC-03/CC-04 |

---

## Approval

| Role | Name | Date |
|------|------|------|
| Sovereign (CC-01) | Barton Doctrine | 2026-01-08 |
| Hub Owner (CC-02) | Storage Development | 2026-01-08 |
| Reviewer | | |

---

## Traceability

| Artifact | Reference |
|----------|-----------|
| Canonical Doctrine | CANONICAL_ARCHITECTURE_DOCTRINE.md |
| Hub/Spoke Doctrine | HUB_SPOKE_ARCHITECTURE.md |

---

## Component PRDs

Detailed PRDs for each pass are maintained in `docs/prd/`:

- [PRD_PASS0_RADAR_HUB.md](prd/PRD_PASS0_RADAR_HUB.md)
- [PRD_PASS1_STRUCTURE_HUB.md](prd/PRD_PASS1_STRUCTURE_HUB.md)
- [PRD_PASS15_RENT_RECON_HUB.md](prd/PRD_PASS15_RENT_RECON_HUB.md)
- [PRD_PASS2_UNDERWRITING_HUB.md](prd/PRD_PASS2_UNDERWRITING_HUB.md)
- [PRD_PASS3_DESIGN_HUB.md](prd/PRD_PASS3_DESIGN_HUB.md)
- [PRD_DATA_LAYER_HUB.md](prd/PRD_DATA_LAYER_HUB.md)
- [PRD_CCA_RECON_AGENT.md](prd/PRD_CCA_RECON_AGENT.md)
