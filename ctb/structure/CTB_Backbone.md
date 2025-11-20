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
5. **Neon-Powered**: Permanent vault for all candidate data and scoring results

## Component Map

- **Backend**: FastAPI + asyncpg async engine
- **Database**: Neon PostgreSQL (permanent vault)
- **Frontend**: Lovable.dev (thin presentation layer)
- **Scoring Engine**: Modular calculation modules
- **Process Logging**: Full audit trail

## Integration Points

- Neon Database: All persistent storage
- External Services: Census, U-Haul, Rent, DOT, Geospatial
- API Endpoints: RESTful interface for frontend
- Process Logging: Complete audit trail

