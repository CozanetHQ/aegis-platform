// ── Audit Engine · Domain Enums ──────────────────────────────────────

export type EventCategory =
  | 'AUTHENTICATION'
  | 'SECURITY'
  | 'WALLET'
  | 'TRANSFER'
  | 'PAYMENT'
  | 'NOTIFICATION'
  | 'AI'
  | 'BUSINESS'
  | 'PORTFOLIO'
  | 'REWARDS'
  | 'SETTINGS'
  | 'ADMINISTRATION'
  | 'COMPLIANCE'
  | 'SYSTEM'
  | 'PROVIDER'
  | 'API'
  | 'DATABASE'
  | 'INFRASTRUCTURE';

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  'AUTHENTICATION', 'SECURITY', 'WALLET', 'TRANSFER', 'PAYMENT',
  'NOTIFICATION', 'AI', 'BUSINESS', 'PORTFOLIO', 'REWARDS',
  'SETTINGS', 'ADMINISTRATION', 'COMPLIANCE', 'SYSTEM',
  'PROVIDER', 'API', 'DATABASE', 'INFRASTRUCTURE',
] as const;

export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export const SEVERITIES: readonly Severity[] = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export type ActorType = 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'SYSTEM' | 'ENGINE' | 'SCHEDULED_JOB' | 'WEBHOOK';
export const ACTOR_TYPES: readonly ActorType[] = ['USER', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM', 'ENGINE', 'SCHEDULED_JOB', 'WEBHOOK'] as const;

export type EventOutcome = 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'PENDING' | 'BLOCKED';
export const EVENT_OUTCOMES: readonly EventOutcome[] = ['SUCCESS', 'FAILURE', 'PARTIAL', 'PENDING', 'BLOCKED'] as const;

export type EngineSource =
  | 'IDENTITY' | 'WALLET_VAULT' | 'TRANSFER' | 'PAYMENT'
  | 'NOTIFICATION' | 'PORTFOLIO' | 'MARKET' | 'REWARDS'
  | 'BUSINESS' | 'GATEWAY' | 'AI' | 'ADMIN_CONSOLE'
  | 'AUDIT' | 'FUTURE';

export const ENGINE_SOURCES: readonly EngineSource[] = [
  'IDENTITY', 'WALLET_VAULT', 'TRANSFER', 'PAYMENT',
  'NOTIFICATION', 'PORTFOLIO', 'MARKET', 'REWARDS',
  'BUSINESS', 'GATEWAY', 'AI', 'ADMIN_CONSOLE',
  'AUDIT', 'FUTURE',
] as const;

export type ExportFormat = 'JSON' | 'CSV' | 'PDF';
export const EXPORT_FORMATS: readonly ExportFormat[] = ['JSON', 'CSV', 'PDF'] as const;

export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
export const EXPORT_STATUSES: readonly ExportStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'] as const;

export type InvestigationStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
export const INVESTIGATION_STATUSES: readonly InvestigationStatus[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'] as const;

export type Platform = 'WEB' | 'IOS' | 'ANDROID' | 'API' | 'ADMIN_CONSOLE' | 'UNKNOWN';
export const PLATFORMS: readonly Platform[] = ['WEB', 'IOS', 'ANDROID', 'API', 'ADMIN_CONSOLE', 'UNKNOWN'] as const;
