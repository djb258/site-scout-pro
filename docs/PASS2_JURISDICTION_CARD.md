# PASS 2 — Jurisdiction Card
## County-Level Data Collection Requirements

**Purpose**
This document defines **everything that must be collected per county** for **Pass 2**.
Pass 2 represents a **digital jurisdiction card** that captures zoning, regulatory, and physical constraints needed for downstream feasibility and geometry calculations.

- Pass 2 defines **WHAT is true**
- Data may be **known or unknown**
- Absence of data is meaningful
- Pass 3 consumes this data without reinterpretation

---

## A. Jurisdiction Identity & Scope

**These fields define who governs and at what level.**

- County name
- State
- County FIPS
- Asset class (e.g. self-storage, RV storage, trailer yard)

**Authority Model**
- Authority model
  (`county | municipal | mixed | none`)
- Zoning model
  (`no_zoning | county | municipal | mixed`)
- Controlling authority name
- Controlling authority contact (dept / phone / email)

---

## B. Use Viability (Binary Gating)

**These fields answer: _should we even continue?_**

- Storage allowed somewhere in county
  (`yes | no | unknown`)
- Fatal prohibition present
  (`yes | no | unknown`)
- Fatal prohibition description (text)
- Conditional use permit required
  (`yes | no | unknown`)
- Discretionary / board approval required
  (`yes | no | unknown`)
- General zoning notes

---

## C. Zoning Envelope (REQUIRED_FOR_ENVELOPE)

> These are the **minimum numeric constraints** required to compute buildable geometry.
> All numeric fields must allow `unknown`.

### Setbacks
- Minimum front setback (ft)
- Minimum side setback (ft)
- Minimum rear setback (ft)

### Coverage / Intensity
- Maximum lot coverage (%)
- Maximum floor area ratio (FAR)
- Minimum open space (%)
- Maximum building height (ft)
- Maximum number of stories

### Buffers
- Residential buffer (ft)
- Waterway buffer (ft)
- Roadway buffer (ft)

---

## D. Fire & Life Safety

**Constraints affecting layout, circulation, and building footprint.**

- Fire lane required (`yes | no | unknown`)
- Minimum fire lane width (ft)
- Maximum hydrant spacing (ft)
- Fire department access required (`yes | no | unknown`)
- Sprinkler required (`yes | no | unknown`)
- Adopted fire code (e.g. IFC 2018)

---

## E. Stormwater & Environmental

**Constraints that reduce usable acreage.**

- Stormwater detention required (`yes | no | unknown`)
- Stormwater retention required (`yes | no | unknown`)
- Maximum impervious surface (%)
- Watershed overlay present (`yes | no | unknown`)
- Floodplain overlay present (`yes | no | unknown`)
- Environmental notes

---

## F. Parking & Access (When Applicable)

**Collected when applicable to the asset class.**

- Parking required (`yes | no | unknown`)
- Parking ratio (spaces per sq ft or unit)
- Truck access required (`yes | no | unknown`)
- Minimum driveway width (ft)

---

## G. Provenance & Verification (REQUIRED FOR ALL FIELDS)

Every populated field must record:

- Value
- Unit
- Knowledge state
  (`known | unknown | blocked`)
- Source type
  (`ordinance | pdf | portal | human`)
- Source reference
  (URL, document, section, page)
- Authority scope
  (`county | municipal | fire_district | state`)
- Verified date
- TTL / revalidation date

---

## Enforcement Rules

1. No numeric value may be inferred
2. `unknown` is valid and expected
3. REQUIRED_FOR_ENVELOPE fields must be known for Pass 3 geometry
4. This card is **county-scoped**, not parcel-scoped
5. New fields require explicit doctrine change

---

## Mental Model

This file represents **one paper card per county** that a planner might have filled out by hand.

If a planner would write it on paper, it belongs here.
If it is a calculation or derived value, it belongs in Pass 3.
