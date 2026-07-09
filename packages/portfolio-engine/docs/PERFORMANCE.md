# Performance Metrics

## Time Ranges

| Range | Value | Description |
|-------|-------|-------------|
| 1 Hour | `1h` | Last hour of data |
| 24 Hours | `24h` | Last 24 hours |
| 7 Days | `7d` | Last 7 days |
| 30 Days | `30d` | Last 30 days |
| 90 Days | `90d` | Last 90 days |
| 1 Year | `1y` | Last 365 days |
| All Time | `all` | All available data |

## Calculated Metrics

For each time range:

- **Start Value** — Portfolio value at the beginning of the range
- **End Value** — Current portfolio value
- **Absolute Change** — End - Start (in fiat)
- **Percentage Change** — ((End - Start) / Start) × 100
- **Unrealized P/L** — Paper gains/losses on current holdings
- **Realized P/L** — Gains/losses from completed transactions
- **Total P/L** — Unrealized + Realized
- **Snapshot Count** — Number of snapshots in this range

## Dashboard Performance

The dashboard summary includes three pre-calculated performance ranges:
- **Daily** (24h) — Today's gain/loss
- **Weekly** (7d) — This week's gain/loss
- **Monthly** (30d) — This month's gain/loss

## Historical Snapshots

Snapshots are stored in `portfolio_snapshots` table. Each snapshot captures:
- Total, available, pending, locked, reserved values
- Wallet count, chain count
- Top holdings (JSON)
- Net worth

Snapshots are immutable — they represent a point-in-time record and are never updated or deleted.
