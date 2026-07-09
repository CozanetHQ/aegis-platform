# Aegis Wallet Vault Engine

Engine #2 in the Aegis V2 architecture. Owns custody: wallet generation (HD derivation),
private key envelope encryption, and transaction signing on behalf of other engines.

Clean Architecture: domain → application → infrastructure → interface (Next.js API routes).
