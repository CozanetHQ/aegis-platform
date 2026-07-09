# Balance Types

The Portfolio Engine calculates and exposes 8 balance types separately. The UI decides which to display.

## Balance Types

| Type | Description |
|------|-------------|
| **Available** | Funds immediately spendable |
| **Pending** | Funds in pending transfers |
| **Locked** | Funds locked in smart contracts or staking |
| **Reserved** | Funds reserved for pending payments |
| **Staked** | Funds in staking (future) |
| **Reward** | Unclaimed reward balances |
| **Business** | Business-related balances |
| **Treasury** | Treasury-managed funds |

## Rules

1. Balance types are never merged internally — each is exposed separately
2. `Total = Available + Pending + Locked + Reserved`
3. `Spendable = Available - Reserved`
4. All balances include both token amounts and fiat values
5. Prices come from the Market Engine (never invented)

## Transfer Flow

When previewing a transfer:
- `Current Balance` — what the wallet has now
- `Spendable Balance` — what can actually be spent
- `Remaining After Transfer` — balance minus transfer amount
- `Remaining After Network Fee` — balance minus transfer minus gas
- `Remaining Fiat Value` — remaining balance in fiat terms

## Payment Flow

When previewing a payment:
- `Available Funds` — total available across all wallets
- `Can Afford` — boolean affordability check
- `Balance After Payment` — remaining after payment amount
- `Balance After Fees` — remaining after payment + fees
- `Portfolio Impact` — net change to portfolio value
