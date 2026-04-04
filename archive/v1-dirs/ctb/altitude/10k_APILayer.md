# 10k API Layer - Endpoint Specifications

## API Architecture

**Framework**: FastAPI (fully async)
**Database**: Neon PostgreSQL via asyncpg
**Format**: JSON request/response

## Endpoint Specifications

### POST /candidate
**Purpose**: Create new site candidate

**Request**:
```json
{
  "address": "string",
  "county": "string",
  "state": "string",
  "zipcode": "string",
  "acreage": "number"
}
```

**Response**:
```json
{
  "id": "integer",
  "status": "pending",
  "created_at": "timestamp"
}
```

### POST /screening
**Purpose**: Run initial screening process

**Request**:
```json
{
  "candidate_id": "integer"
}
```

**Response**:
```json
{
  "candidate_id": "integer",
  "status": "screening|eliminated",
  "population": "integer",
  "households": "integer",
  "uhaul_index": "integer"
}
```

### POST /saturation
**Purpose**: Calculate saturation metrics

**Request**:
```json
{
  "candidate_id": "integer"
}
```

**Response**:
```json
{
  "candidate_id": "integer",
  "sqft_required": "integer",
  "sqft_existing": "integer",
  "saturation_ratio": "number",
  "saturation_score": "integer"
}
```

### POST /score
**Purpose**: Calculate final scoring

**Request**:
```json
{
  "candidate_id": "integer"
}
```

**Response**:
```json
{
  "candidate_id": "integer",
  "parcel_score": "integer",
  "county_difficulty": "integer",
  "financial_score": "integer",
  "final_score": "integer",
  "status": "completed"
}
```

### GET /results/{id}
**Purpose**: Retrieve candidate results

**Response**:
```json
{
  "id": "integer",
  "address": "string",
  "county": "string",
  "state": "string",
  "all_scores": {...},
  "status": "string",
  "created_at": "timestamp"
}
```

## Error Handling

All endpoints return standardized error format:
```json
{
  "error": "string",
  "detail": "string",
  "status_code": "integer"
}
```

## Authentication

Currently open (add auth layer as needed)

## Rate Limiting

To be implemented in operations layer

