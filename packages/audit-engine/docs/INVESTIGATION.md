# Audit Engine — Investigation Mode

## Overview

Investigation Mode is an admin-only feature that provides a complete investigation toolkit for AEGIS Support and Security teams. It automatically gathers events across all engines, connects related activity, and highlights anomalies.

## Starting an Investigation

```
POST /api/v1/investigations
{
  "initiatedBy": "aegis_admin_1",
  "pivotType": "USER_ID",
  "pivotValue": "aegis_user_123"
}
```

## Pivot Types

| Pivot | Description | Use Case |
|-------|-------------|----------|
| USER_ID | Investigate all activity for a user | User reports unauthorized access |
| WALLET_ADDRESS | All events involving a wallet address | Suspicious wallet activity |
| TX_HASH | Events related to a transaction hash | Failed transaction investigation |
| CORRELATION_ID | Complete journey of a correlation | End-to-end transaction tracing |
| DEVICE_ID | All activity from a device | Device compromise investigation |
| EMAIL | Events involving an email | Account takeover investigation |
| PHONE | Events involving a phone number | SIM swap investigation |

## Anomaly Detection

When an investigation is started, the engine automatically detects:

### Multiple IP Addresses
Triggered when >3 distinct IP addresses are found for the pivot.
Severity: MEDIUM

### Failure Burst
Triggered when >5 failed events are found.
Severity: HIGH

### Critical Events
Triggered when any CRITICAL severity events are found.
Severity: CRITICAL

### Cross-Engine Activity
Triggered when events span >3 different engines.
Severity: LOW

## Investigation Lifecycle

1. **OPEN** — Investigation created, not yet started
2. **IN_PROGRESS** — Events gathered, anomalies detected
3. **COMPLETED** — Investigation finished, closed
4. **ARCHIVED** — Historical reference, no longer active

## Viewing Investigation Results

```
GET /api/v1/investigations/{investigationId}
```

Returns:
- Investigation metadata (status, anomalies, pivot info)
- All event details for every event in the investigation
- Anomaly list with types and severity levels
