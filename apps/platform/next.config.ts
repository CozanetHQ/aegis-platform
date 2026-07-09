import type { NextConfig } from 'next';
const config: NextConfig = { transpilePackages: ['@cozanethq/identity-engine','@cozanethq/wallet-vault-engine','@cozanethq/swap-engine','@cozanethq/treasury-engine','@cozanethq/audit-engine','@cozanethq/notification-engine','@cozanethq/portfolio-engine'] };
export default config;
