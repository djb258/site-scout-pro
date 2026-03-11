# 5k Operations - Operational Flow

## Input Flow

1. **Frontend (Figma UI → CF Workers/Pages)** submits candidate data
2. **API Layer** receives request (CF Workers)
3. **Validation** via Pydantic schemas
4. **CF D1 Insertion** creates candidate record (working), Neon (vault/archive)
5. **Status**: Set to 'pending'

## Processing Flow

1. **Screening Endpoint** triggered
   - Fetch external data (Census, U-Haul)
   - Calculate population metrics
   - Update status to 'screening' or 'eliminated'

2. **Saturation Endpoint** triggered
   - Calculate required sqft (population * 6)
   - Fetch existing storage sqft
   - Calculate saturation ratio
   - Update saturation_score

3. **Scoring Endpoint** triggered
   - Run parcel screening
   - Calculate county difficulty
   - Calculate financial score
   - Calculate final weighted score
   - Update status to 'completed'

## Status Transitions

```
pending → screening → saturation → scoring → completed
                              ↓
                          eliminated
```

## Logging

**Process Log**: Every stage transition logged
- Candidate ID
- Stage name
- Timestamp
- Input/output data
- Status change

**Error Log**: All errors captured
- Error type
- Stack trace
- Context data
- Timestamp

## Database Operations

- **Connection Pool**: CF D1 bindings (working), asyncpg (Neon vault)
- **Transactions**: All writes in transactions
- **Retries**: Automatic retry on connection errors
- **Health Checks**: Periodic connection validation

## Monitoring

- **Response Times**: Track endpoint performance
- **Error Rates**: Monitor error frequency
- **Database Health**: Connection pool metrics
- **Process Completion**: Track status transitions

## Deployment

- **Environment Variables**: CF D1/KV bindings (working), Neon connection string (vault)
- **Startup**: Initialize connection pool
- **Shutdown**: Graceful pool closure
- **Health Endpoint**: `/health` for monitoring

## Error Handling

- **Validation Errors**: Return 422 with details
- **Database Errors**: Log and return 500
- **External Service Errors**: Log and continue with defaults
- **Timeout Handling**: Configurable timeouts

