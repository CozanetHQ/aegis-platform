import type { EventType } from '../domain/enums/notification-enums';
import type { NotificationCategory, Priority } from '../domain/enums/notification-enums';

export interface RenderedTemplate {
  title: string;
  body: string;
  category: NotificationCategory;
  priority: Priority;
}

/**
 * MVP template resolution: one hardcoded renderer per known event type, kept
 * pure and unit-testable. NOT the final design — the full spec calls for a
 * DB-backed, admin-editable NotificationTemplate entity so copy can change
 * without a redeploy. That's flagged as backlog (see README "Known gaps").
 * Swapping this file for a DB-backed lookup later won't change any use-case
 * signatures — only this module's internals.
 */
export function resolveTemplate(eventType: EventType, payload: Record<string, unknown>): RenderedTemplate {
  const str = (key: string, fallback = '') => (typeof payload[key] === 'string' ? (payload[key] as string) : fallback);

  switch (eventType) {
    case 'UserRegistered':
      return {
        title: 'Welcome to AEGIS',
        body: 'Your account has been created. Verify your email to get started.',
        category: 'SYSTEM',
        priority: 'NORMAL',
      };
    case 'WalletCreated':
      return {
        title: 'New wallet ready',
        body: `A new ${str('blockchain', 'wallet')} wallet has been created for your account.`,
        category: 'SYSTEM',
        priority: 'NORMAL',
      };
    case 'TransferCompleted':
      return {
        title: 'Transfer completed',
        body: `Your transfer ${str('transferRef')} has settled.`,
        category: 'TRANSACTIONS',
        priority: 'NORMAL',
      };
    case 'TransferFailed':
      return {
        title: 'Transfer failed',
        body: `Your transfer ${str('transferRef')} could not be completed.`,
        category: 'TRANSACTIONS',
        priority: 'HIGH',
      };
    case 'SecurityLogin':
      return {
        title: 'New sign-in detected',
        body: `A new sign-in was recorded${str('deviceName') ? ` from ${str('deviceName')}` : ''}.`,
        category: 'SECURITY',
        priority: 'HIGH',
      };
    case 'SecurityLoginFailed':
      return {
        title: 'Failed sign-in attempt',
        body: 'Someone tried to sign in to your account and failed. If this wasn\'t you, review your security settings.',
        category: 'SECURITY',
        priority: 'CRITICAL',
      };
    case 'AskStatusChanged':
      return {
        title: 'ASK status updated',
        body: `Your Account Security Key status changed to ${str('status', 'unknown')}.`,
        category: 'SECURITY',
        priority: 'HIGH',
      };
    case 'TskStatusChanged':
      return {
        title: 'TSK status updated',
        body: `Your Transaction Security Key status changed to ${str('status', 'unknown')}.`,
        category: 'SECURITY',
        priority: 'HIGH',
      };
    case 'AiInsightReady':
      return {
        title: 'New AI insight available',
        body: str('headline', 'Your latest financial insight is ready to view.'),
        category: 'AI_INSIGHTS',
        priority: 'LOW',
      };
    case 'PriceAlertTriggered':
      return {
        title: `${str('symbol', 'Asset')} price alert`,
        body: `${str('symbol', 'Your asset')} hit your target price of ${str('targetPrice')}.`,
        category: 'PRICE_ALERTS',
        priority: 'NORMAL',
      };
    case 'AdminBroadcast':
      return {
        title: str('title', 'Announcement'),
        body: str('body', ''),
        category: 'NEWS',
        priority: 'NORMAL',
      };
    case 'SwapExecuted':
      return {
        title: 'Swap completed',
        body: `Swapped ${str('amountIn')} ${str('tokenInSymbol', 'token')} for ${str('tokenOutSymbol', 'CZN')} on PancakeSwap V2.`,
        category: 'TRANSACTIONS',
        priority: 'NORMAL',
      };
    case 'EmailOtpRequested':
      // SECURITY category — non-suppressible (see NON_SUPPRESSIBLE_CATEGORIES),
      // so this always reaches the user regardless of notification preferences.
      // The IN_APP copy intentionally omits the code itself (in-app feed isn't
      // a secure enough surface to assume only the account owner sees it on a
      // shared/unlocked device) — the real code only ever goes out over EMAIL.
      return {
        title: 'Your verification code',
        body: 'A one-time verification code was sent to your email.',
        category: 'SECURITY',
        priority: 'CRITICAL',
      };
    default: {
      const _exhaustive: never = eventType;
      throw new Error(`No template for event type: ${_exhaustive}`);
    }
  }
}
