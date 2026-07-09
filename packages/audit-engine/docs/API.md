# Audit Engine — API Reference

## Authentication

### Engine-to-Engine (POST /events)
Uses API key authentication via `X-Audit-API-Key` header. The key is validated against `AUDIT_ENGINE_API_KEY` environment variable.

### User/Admin Queries (GET endpoints)
Uses Supabase JWT Bearer token via `Authorization: Bearer <token>` header.

## POST /api/v1/events

Create an audit event. Called by other engines.

### Request
```json
{
  "engine": "TRANSFER",
  "category": "TRANSFER",
  "eventName": "TRANSFER_CREATED",
  "severity": "INFO",
  "correlationId": "corr_abc123",
  "userId": "aegis_user_1",
  "actorId": "aegis_user_1",
  "actorType": "USER",
  "walletId": "wlt_123",
  "walletAddress": "0xabc...",
  "deviceId": "dev_1",
  "ipAddress": "192.168.1.1",
  "country": "NG",
  "platform": "WEB",
  "metadata": { "amount": "100", "token": "USDT" },
  "requestId": "req_1",
  "sessionId": "sess_1",
  "previousState": null,
  "newState": { "status": "CREATED" },
  "outcome": "SUCCESS",
  "notes": "Transfer initiated by user",
  "correctionFor": null
}
```

### Response (201)
```json
{
  "data": {
    "eventId": "aev_...",
    "timestamp": "2026-07-03T12:00:00.000Z",
    "engine": "TRANSFER",
    "category": "TRANSFER",
    "eventName": "TRANSFER_CREATED",
    ...
  }
}
```

## GET /api/v1/events

Search audit events. All query params are optional filters.

### Query Parameters
| Param | Type | Description |
|-------|------|-------------|
| userId | string | Filter by user ID |
| walletId | string | Filter by wallet ID |
| walletAddress | string | Filter by wallet address |
| engine | string | Filter by source engine |
| category | string | Filter by event category |
| eventName | string | Filter by event name |
| severity | string | Filter by severity (INFO/LOW/MEDIUM/HIGH/CRITICAL) |
| outcome | string | Filter by outcome (SUCCESS/FAILURE/PARTIAL/PENDING/BLOCKED) |
| correlationId | string | Filter by correlation ID |
| sessionId | string | Filter by session ID |
| deviceId | string | Filter by device ID |
| ipAddress | string | Filter by IP address |
| country | string | Filter by country |
| actorId | string | Filter by actor ID |
| actorType | string | Filter by actor type |
| platform | string | Filter by platform |
| startDate | ISO 8601 | Events after this timestamp |
| endDate | ISO 8601 | Events before this timestamp |
| limit | integer | Results per page (max 500, default 50) |
| offset | integer | Pagination offset |
| orderBy | string | Sort field (default: timestamp) |
| orderDir | asc/desc | Sort direction (default: desc) |

## GET /api/v1/timeline

Build a chronological timeline.

### Query Parameters
At least one of: `userId`, `correlationId`, `walletId`, `walletAddress`, `sessionId`
Optional: `limit` (max 500, default 100)

## POST /api/v1/investigations

Start a new investigation (admin only).

### Request
```json
{
  "initiatedBy": "aegis_admin_1",
  "pivotType": "USER_ID",
  "pivotValue": "aegis_user_123",
  "title": "Suspicious activity investigation",
  "description": "User reported unauthorized access"
}
```

### Pivot Types
USER_ID | WALLET_ADDRESS | TX_HASH | CORRELATION_ID | DEVICE_ID | EMAIL | PHONE

## POST /api/v1/exports

Export filtered audit data.

### Request
```json
{
  "requestedBy": "aegis_admin_1",
  "format": "JSON",
  "filters": {
    "userId": "aegis_user_1",
    "startDate": "2026-07-01T00:00:00Z"
  }
}
```

### Formats
JSON | CSV | PDF (PDF delegates to JSON for MVP)
