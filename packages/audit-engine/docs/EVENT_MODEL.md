# Audit Engine — Event Model

## Event Structure

Every audit record contains these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| eventId | string | Auto | Unique event ID (`aev_` prefix) |
| timestamp | ISO 8601 | Auto | When the event occurred |
| engine | enum | Yes | Source engine (IDENTITY, TRANSFER, etc.) |
| category | enum | Yes | Event category (AUTHENTICATION, SECURITY, etc.) |
| eventName | string | Yes | Specific event name (USER_LOGIN, WALLET_FROZEN, etc.) |
| severity | enum | No | INFO, LOW, MEDIUM, HIGH, CRITICAL (default: INFO) |
| correlationId | string | Yes | Cross-engine trace ID |
| userId | string | No | AEGIS user ID |
| actorId | string | No | Who triggered the event |
| actorType | enum | No | USER, ADMIN, SUPER_ADMIN, SYSTEM, ENGINE, SCHEDULED_JOB, WEBHOOK |
| walletId | string | No | Wallet ID involved |
| walletAddress | string | No | Wallet address involved |
| deviceId | string | No | Device identifier |
| ipAddress | string | No | IP address |
| country | string | No | Country code (from header or provided) |
| platform | enum | No | WEB, IOS, ANDROID, API, ADMIN_CONSOLE, UNKNOWN |
| metadata | JSON | No | Arbitrary key-value metadata |
| requestId | string | No | Request trace ID |
| sessionId | string | No | Session ID |
| previousState | JSON | No | State before the event |
| newState | JSON | No | State after the event |
| outcome | enum | No | SUCCESS, FAILURE, PARTIAL, PENDING, BLOCKED |
| notes | string | No | Human-readable notes |
| correctionFor | string | No | EventId this event corrects |

## Event Examples

### Authentication
```json
{ "engine": "IDENTITY", "category": "AUTHENTICATION", "eventName": "USER_LOGIN", "severity": "INFO", "outcome": "SUCCESS" }
{ "engine": "IDENTITY", "category": "AUTHENTICATION", "eventName": "FAILED_LOGIN", "severity": "MEDIUM", "outcome": "FAILURE" }
{ "engine": "IDENTITY", "category": "AUTHENTICATION", "eventName": "USER_LOGOUT", "severity": "INFO", "outcome": "SUCCESS" }
```

### Wallet
```json
{ "engine": "WALLET_VAULT", "category": "WALLET", "eventName": "WALLET_CREATED", "severity": "INFO" }
{ "engine": "WALLET_VAULT", "category": "WALLET", "eventName": "WALLET_FROZEN", "severity": "HIGH" }
{ "engine": "WALLET_VAULT", "category": "WALLET", "eventName": "WALLET_IMPORTED", "severity": "LOW" }
```

### Transfer
```json
{ "engine": "TRANSFER", "category": "TRANSFER", "eventName": "TRANSFER_CREATED", "severity": "INFO" }
{ "engine": "TRANSFER", "category": "TRANSFER", "eventName": "TRANSFER_EXECUTED", "severity": "INFO" }
{ "engine": "TRANSFER", "category": "TRANSFER", "eventName": "TRANSFER_FAILED", "severity": "HIGH", "outcome": "FAILURE" }
```

### Administration
```json
{ "engine": "ADMIN_CONSOLE", "category": "ADMINISTRATION", "eventName": "ADMIN_LOGIN", "severity": "MEDIUM" }
{ "engine": "ADMIN_CONSOLE", "category": "ADMINISTRATION", "eventName": "USER_SUSPENDED", "severity": "HIGH" }
{ "engine": "ADMIN_CONSOLE", "category": "SECURITY", "eventName": "API_KEY_ROTATED", "severity": "HIGH" }
{ "engine": "ADMIN_CONSOLE", "category": "INFRASTRUCTURE", "eventName": "MAINTENANCE_ENABLED", "severity": "CRITICAL" }
```

## Correlation ID Lifecycle

```
corr_abc123:
  10:05 IDENTITY     USER_LOGIN          SUCCESS
  10:06 WALLET_VAULT WALLET_OPENED       SUCCESS
  10:07 TRANSFER     TRANSFER_CREATED    SUCCESS
  10:07 PAYMENT      FEE_CALCULATED      SUCCESS
  10:08 WALLET_VAULT WALLET_SIGNED       SUCCESS
  10:08 TRANSFER     TRANSFER_EXECUTED   SUCCESS
  10:09 NOTIFICATION NOTIFICATION_DELIVERED SUCCESS
```

Searching `corr_abc123` via `GET /history/correlations/corr_abc123` returns:
- All 7 events in chronological order
- A journey array with step numbers, engines, and outcomes
