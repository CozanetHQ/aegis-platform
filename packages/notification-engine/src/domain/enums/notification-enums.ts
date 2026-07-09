// Domain enums — the fixed vocabulary this engine reasons in.
// Adding a new value here is a domain decision, not an infra one.

export const CHANNELS = ['IN_APP', 'EMAIL', 'PUSH', 'SMS', 'WEBHOOK'] as const;
export type Channel = (typeof CHANNELS)[number];

/** Channels with a real provider implementation today. Others are recognized
 * by the domain/DB but rejected by delivery until a provider is wired. */
export const IMPLEMENTED_CHANNELS: readonly Channel[] = ['IN_APP', 'EMAIL'];

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const NOTIFICATION_STATUSES = [
  'PENDING',
  'QUEUED',
  'SENDING',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_CATEGORIES = [
  'SECURITY',
  'TRANSACTIONS',
  'AI_INSIGHTS',
  'BILLS',
  'PRICE_ALERTS',
  'PROMOTIONS',
  'NEWS',
  'MARKETING',
  'SYSTEM',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Categories that a user is never allowed to silence — critical account/security
 * notices always reach at least the IN_APP channel regardless of preferences. */
export const NON_SUPPRESSIBLE_CATEGORIES: readonly NotificationCategory[] = ['SECURITY'];

export const DELIVERY_RESULTS = ['SUCCESS', 'FAILURE', 'SKIPPED_BY_PREFERENCE', 'PROVIDER_NOT_CONFIGURED'] as const;
export type DeliveryResult = (typeof DELIVERY_RESULTS)[number];

/** The full catalog of event types this engine understands, per the ecosystem
 * event spec. Kept as a plain string union rather than free text so a typo in
 * a producing engine's payload fails loudly instead of silently no-op'ing. */
export const EVENT_TYPES = [
  'UserRegistered',
  'WalletCreated',
  'TransferCompleted',
  'TransferFailed',
  'SecurityLogin',
  'SecurityLoginFailed',
  'AskStatusChanged',
  'TskStatusChanged',
  'AiInsightReady',
  'PriceAlertTriggered',
  'AdminBroadcast',
  'EmailOtpRequested',
  'SwapExecuted',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
