/**
 * Portfolio Engine — External Engine Client Ports
 * 
 * The Portfolio Engine is a READ MODEL. It consumes data from other engines
 * via HTTP. It never duplicates their business logic.
 */

export interface WalletVaultClientPort {
  /** Get all wallets for a user */
  getWallets(userId: string): Promise<WalletVaultWallet[]>;

  /** Get a specific wallet with balances */
  getWallet(walletId: string): Promise<WalletVaultWallet | null>;

  /** Get wallet balances (token-level) */
  getWalletBalances(walletId: string): Promise<WalletVaultBalance[]>;
}

export interface WalletVaultWallet {
  id: string;
  address: string;
  chain: string;
  label: string;
  createdAt: string;
  lastActivity: string | null;
}

export interface WalletVaultBalance {
  symbol: string;
  contractAddress: string | null;
  balance: string;
  decimals: number;
}

export interface TransferClientPort {
  /** Get recent transfers for a user */
  getRecentTransfers(userId: string, limit: number): Promise<TransferRecord[]>;

  /** Get pending transfers (affects pending balance) */
  getPendingTransfers(userId: string): Promise<TransferRecord[]>;

  /** Preview a transfer — check spendable balance */
  previewTransfer(walletId: string, amount: string, token: string, chain: string): Promise<TransferPreviewResult>;
}

export interface TransferRecord {
  id: string;
  transferRef: string;
  direction: string;
  amount: string;
  token: string;
  chain: string;
  status: string;
  fee: string | null;
  createdAt: string;
  fromAddress: string;
  toAddress: string;
}

export interface TransferPreviewResult {
  currentBalance: string;
  spendableBalance: string;
  networkFee: string;
  sufficientFunds: boolean;
}

export interface MarketClientPort {
  /** Get current price for a token */
  getPrice(symbol: string, chain: string): Promise<PriceData | null>;

  /** Get prices for multiple tokens at once */
  getPrices(tokens: { symbol: string; chain: string }[]): Promise<Map<string, PriceData>>;

  /** Check if the Market Engine is available */
  isAvailable(): Promise<boolean>;
}

export interface PriceData {
  symbol: string;
  price: number;
  currency: string;
  timestamp: string;
  source: string;
  stale: boolean;
}

export interface PaymentClientPort {
  /** Preview a payment — check if user can afford it */
  previewPayment(userId: string, amount: number, fee: number, discount: number): Promise<PaymentPreviewResult>;
}

export interface PaymentPreviewResult {
  availableFunds: number;
  canAfford: boolean;
  balanceAfterPayment: number;
  balanceAfterFees: number;
}
