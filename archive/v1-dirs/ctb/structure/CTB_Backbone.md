# CTB (Christmas Tree Backbone) - Storage Site Scouting Engine

## Architecture Overview

The CTB model provides the structural foundation for the Storage Site Scouting & Process of Elimination Engine. This backbone connects all layers from high-level vision (40k) down to operational execution (5k).

## Layer Structure

```
40k Vision (Strategic)
    ↓
30k Category (Domain)
    ↓
20k Process Logic (Workflow)
    ↓
10k API Layer (Interface)
    ↓
5k Operations (Execution)
```

## Core Principles

1. **Doctrine-Driven**: Every decision follows the Barton Doctrine of systematic elimination
2. **Data-Driven**: All scoring based on quantifiable metrics (population, saturation, financials)
3. **Modular**: Each layer operates independently with clear interfaces
4. **Async-First**: Fully asynchronous architecture for scalability
5. **CF D1/KV + Neon**: CF D1/KV for working data, Neon vault for permanent archive

## Component Map

- **Backend**: CF Workers (compute + hosting)
- **Database**: CF D1/KV (working) + Neon PostgreSQL (vault/archive)
- **Frontend**: Figma UI (design) → CF Workers/Pages (hosting)
- **Scoring Engine**: Modular calculation modules
- **Process Logging**: Full audit trail
- **File Storage**: CF R2

## Integration Points

- CF D1/KV: Working database for active pipeline data
- Neon Database: Vault/archive for permanent storage
- External Services: Census, U-Haul, Rent, DOT, Geospatial
- API Endpoints: RESTful interface for frontend
- Process Logging: Complete audit trail

