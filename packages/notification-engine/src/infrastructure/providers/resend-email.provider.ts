import type { ChannelProvider, DeliveryOutcome } from '../../application/ports/channel-provider.port';
import type { Notification } from '../../domain/entities/notification.entity';
import {
  welcomeEmail,
  securityLoginEmail,
  securityLoginFailedEmail,
  transferCompletedEmail,
  transferFailedEmail,
  walletCreatedEmail,
  genericNotificationEmail,
  otpCodeEmail,
  swapExecutedEmail,
} from '../../application/email-templates';

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Sends via the Resend HTTP API directly. Uses branded HTML email templates
 * for all known event types, with a generic fallback for unknown types.
 * Supabase Auth's own OTP/magic-link emails keep going through its built-in
 * SMTP path unchanged; this is only for general-purpose transactional
 * notifications.
 */
export class ResendEmailProvider implements ChannelProvider {
  readonly channel = 'EMAIL' as const;
  private readonly apiKey: string;
  private readonly fromAddress: string;

  constructor(apiKey?: string, fromAddress?: string) {
    this.apiKey = apiKey ?? process.env.RESEND_API_KEY ?? '';
    this.fromAddress = fromAddress ?? process.env.NOTIFICATION_FROM_EMAIL ?? 'AEGIS <notifications@aegis.build>';
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Resolves the correct branded email template based on the notification's
   * source event type and payload data.
   */
  private resolveEmailTemplate(notification: Notification): {
    subject: string;
    html: string;
    text: string;
  } {
    const props = notification.toProps();
    const data = props.data ?? {};
    const eventType = data.eventType as string | undefined;
    const str = (key: string, fallback = '') =>
      typeof data[key] === 'string' ? (data[key] as string) : fallback;

    // Match on source event type if available
    switch (eventType ?? props.title) {
      case 'UserRegistered':
      case 'Welcome to AEGIS':
        return welcomeEmail(str('firstName'));

      case 'SecurityLogin':
      case 'New sign-in detected':
        return securityLoginEmail(
          str('email'),
          str('deviceName'),
          str('ipAddress'),
          str('timestamp')
        );

      case 'SecurityLoginFailed':
      case 'Failed sign-in attempt':
        return securityLoginFailedEmail(
          str('email'),
          str('ipAddress'),
          str('timestamp')
        );

      case 'TransferCompleted':
      case 'Transfer completed':
        return transferCompletedEmail(
          str('transferRef'),
          str('amount'),
          str('asset'),
          str('recipient')
        );

      case 'TransferFailed':
      case 'Transfer failed':
        return transferFailedEmail(str('transferRef'), str('reason'));

      case 'WalletCreated':
      case 'New wallet ready':
        return walletCreatedEmail(str('blockchain'), str('address'));

      case 'EmailOtpRequested':
        return otpCodeEmail(str('code'));

      case 'SwapExecuted':
      case 'Swap completed':
        return swapExecutedEmail(
          str('amountIn'),
          str('tokenInSymbol'),
          str('tokenOutSymbol'),
          str('txHash')
        );

      default:
        return genericNotificationEmail(props.title, props.body);
    }
  }

  async deliver(notification: Notification, recipientAddress: string | null): Promise<DeliveryOutcome> {
    if (!this.isConfigured) {
      return { result: 'PROVIDER_NOT_CONFIGURED', error: 'RESEND_API_KEY not set' };
    }
    if (!recipientAddress) {
      return { result: 'FAILURE', error: 'No recipient email address' };
    }

    const template = this.resolveEmailTemplate(notification);

    try {
      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [recipientAddress],
          subject: template.subject,
          html: template.html,
          text: template.text,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { result: 'FAILURE', error: `Resend responded ${res.status}: ${body.slice(0, 300)}` };
      }

      const json = (await res.json().catch(() => ({}))) as { id?: string };
      return { result: 'SUCCESS', providerRef: json.id ?? null };
    } catch (err) {
      return { result: 'FAILURE', error: err instanceof Error ? err.message : String(err) };
    }
  }
}
