/**
 * Branded HTML email templates for AEGIS transactional emails.
 * Each template returns a full HTML document with AEGIS branding,
 * responsive layout, and inline styles (email-client safe).
 */

const SHELL = (content: string, opts?: { previewText?: string }): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AEGIS</title>
  ${opts?.previewText ? `<meta name="description" content="${escapeHtml(opts.previewText)}">` : ''}
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header / Logo -->
          <tr>
            <td style="background:linear-gradient(135deg,#6d28d9 0%,#8b5cf6 100%);padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;background:#ffffff;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#6d28d9;">A</div>
                <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">AEGIS</span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 8px 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 36px 40px;">
              <div style="border-top:1px solid #e5e7eb;padding-top:20px;">
                <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;line-height:1.6;">
                  AEGIS Financial — The Smart Router for your financial intentions.
                </p>
                <p style="margin:0;font-size:12px;color:#9ca3af;">
                  © ${new Date().getFullYear()} Cozanet. All rights reserved.<br>
                  This is an automated message — please do not reply.
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ctaButton(href: string, label: string): string {
  return `<div style="margin:28px 0 8px 0;text-align:center;">
    <a href="${href}" style="display:inline-block;padding:14px 36px;background:#7c3aed;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
  </div>`;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function otpCodeEmail(code: string): EmailTemplate {
  const digits = code.split('');
  const digitBoxes = digits
    .map(
      (d) =>
        `<td style="width:44px;height:56px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;text-align:center;vertical-align:middle;font-size:26px;font-weight:700;color:#111827;font-family:'Courier New',monospace;">${escapeHtml(d)}</td>`
    )
    .join('<td style="width:8px;"></td>');

  const body = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#111827;">Your verification code</h1>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#374151;">
      Enter this code to verify your email address. It expires in 10 minutes.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 20px auto;">
      <tr>${digitBoxes}</tr>
    </table>
    <p style="margin:0;font-size:15px;font-weight:700;letter-spacing:4px;text-align:center;color:#111827;font-family:'Courier New',monospace;">${escapeHtml(code)}</p>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:16px;margin:24px 0 0 0;">
      <p style="margin:0;font-size:14px;color:#92400e;line-height:1.6;">
        Didn't request this code? Someone may be trying to sign up with your email address. You can safely ignore this message — no account will be created without verifying this code.
      </p>
    </div>`;

  return {
    subject: `${code} is your AEGIS verification code`,
    html: SHELL(body, { previewText: `Your AEGIS verification code is ${code}` }),
    text: `Your AEGIS verification code is: ${code}\n\nEnter this code to verify your email address. It expires in 10 minutes.\n\nDidn't request this? You can safely ignore this message — no account will be created without verifying this code.`,
  };
}

export function welcomeEmail(firstName: string): EmailTemplate {
  const name = firstName || 'there';
  const body = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#111827;">Welcome to AEGIS, ${escapeHtml(name)}! 🎉</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#374151;">
      Your account is ready. AEGIS is your smart router for financial transactions —
      send, swap, and manage crypto across multiple chains with bank-grade security.
    </p>
    <p style="margin:0 0 8px 0;font-size:15px;line-height:1.7;color:#374151;">
      Here's what you can do right now:
    </p>
    <ul style="margin:0 0 16px 0;padding-left:24px;font-size:15px;line-height:1.8;color:#374151;">
      <li><strong>Create wallets</strong> on BSC, Ethereum, Polygon, and Arbitrum</li>
      <li><strong>Send & receive</strong> crypto with two-layer security (ASK + TSK)</li>
      <li><strong>Swap tokens</strong> via ChangeNOW integration</li>
      <li><strong>Buy CZN</strong> — the native loyalty token of AEGIS</li>
      <li><strong>Earn rewards</strong> through the CZN loyalty program</li>
    </ul>
    ${ctaButton('https://aegis.cozanet.net', 'Open AEGIS Dashboard')}
    <p style="margin:20px 0 0 0;font-size:13px;color:#6b7280;">
      If you didn't create this account, please ignore this email or contact support at support@cozanet.net.
    </p>`;

  return {
    subject: 'Welcome to AEGIS 🎉',
    html: SHELL(body, { previewText: `Welcome to AEGIS, ${name}! Your account is ready.` }),
    text: `Welcome to AEGIS, ${name}!\n\nYour account is ready. AEGIS is your smart router for financial transactions — send, swap, and manage crypto across multiple chains with bank-grade security.\n\nHere's what you can do:\n- Create wallets on BSC, Ethereum, Polygon, and Arbitrum\n- Send & receive crypto with two-layer security\n- Swap tokens via ChangeNOW\n- Buy CZN — the native loyalty token\n- Earn rewards through the CZN loyalty program\n\nOpen your dashboard: https://aegis.cozanet.net\n\nIf you didn't create this account, please contact support@cozanet.net.`,
  };
}

export function securityLoginEmail(email: string, deviceInfo?: string, ipAddress?: string, timestamp?: string): EmailTemplate {
  const time = timestamp ? new Date(timestamp).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }) : new Date().toLocaleString();
  const device = deviceInfo || 'Unknown device';
  const ip = ipAddress || 'Unknown IP';

  const body = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#111827;">New Sign-In Detected</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#374151;">
      We noticed a new sign-in to your AEGIS account. If this was you, no action is needed.
    </p>
    <table style="width:100%;margin:0 0 16px 0;font-size:14px;color:#374151;">
      <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Account:</td><td style="padding:6px 0;">${escapeHtml(email)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">When:</td><td style="padding:6px 0;">${escapeHtml(time)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Device:</td><td style="padding:6px 0;">${escapeHtml(device)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">IP Address:</td><td style="padding:6px 0;">${escapeHtml(ip)}</td></tr>
    </table>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#92400e;line-height:1.6;">
        <strong>Wasn't you?</strong> Someone may have access to your password. Change your password immediately and enable two-factor authentication if you haven't already.
      </p>
    </div>
    ${ctaButton('https://aegis.cozanet.net', 'Review Account Security')}`;

  return {
    subject: '⚠️ New sign-in to your AEGIS account',
    html: SHELL(body, { previewText: 'A new sign-in was detected on your AEGIS account.' }),
    text: `New Sign-In Detected\n\nWe noticed a new sign-in to your AEGIS account. If this was you, no action is needed.\n\nAccount: ${email}\nWhen: ${time}\nDevice: ${device}\nIP Address: ${ip}\n\nWasn't you? Change your password immediately and enable 2FA.\n\nReview security: https://aegis.cozanet.net`,
  };
}

export function securityLoginFailedEmail(email: string, ipAddress?: string, timestamp?: string): EmailTemplate {
  const time = timestamp ? new Date(timestamp).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }) : new Date().toLocaleString();
  const ip = ipAddress || 'Unknown IP';

  const body = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#dc2626;">Failed Sign-In Attempt</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#374151;">
      Someone tried to sign in to your AEGIS account but failed. If this wasn't you, your account may be under attack.
    </p>
    <table style="width:100%;margin:0 0 16px 0;font-size:14px;color:#374151;">
      <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Account:</td><td style="padding:6px 0;">${escapeHtml(email)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">When:</td><td style="padding:6px 0;">${escapeHtml(time)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">IP Address:</td><td style="padding:6px 0;">${escapeHtml(ip)}</td></tr>
    </table>
    <div style="background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.6;">
        <strong>Security recommendation:</strong> Use a strong, unique password. Enable two-factor authentication for an extra layer of protection. If repeated attempts continue, consider changing your password.
      </p>
    </div>
    ${ctaButton('https://aegis.cozanet.net', 'Secure Your Account')}`;

  return {
    subject: '🚨 Failed sign-in attempt on your AEGIS account',
    html: SHELL(body, { previewText: 'A failed sign-in attempt was detected on your account.' }),
    text: `Failed Sign-In Attempt\n\nSomeone tried to sign in to your AEGIS account but failed. If this wasn't you, your account may be at risk.\n\nAccount: ${email}\nWhen: ${time}\nIP Address: ${ip}\n\nRecommendation: Use a strong password and enable 2FA.\n\nSecure your account: https://aegis.cozanet.net`,
  };
}

export function transferCompletedEmail(transferRef: string, amount?: string, asset?: string, recipient?: string): EmailTemplate {
  const ref = transferRef || 'unknown';
  const body = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#111827;">Transfer Completed ✅</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#374151;">
      Your transfer has been settled successfully.
    </p>
    <table style="width:100%;margin:0 0 16px 0;font-size:14px;color:#374151;">
      <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Reference:</td><td style="padding:6px 0;font-family:monospace;">${escapeHtml(ref)}</td></tr>
      ${amount ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Amount:</td><td style="padding:6px 0;">${escapeHtml(amount)} ${escapeHtml(asset || '')}</td></tr>` : ''}
      ${recipient ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">To:</td><td style="padding:6px 0;font-family:monospace;">${escapeHtml(recipient)}</td></tr>` : ''}
    </table>
    ${ctaButton('https://aegis.cozanet.net', 'View Transaction History')}`;

  return {
    subject: `✅ Transfer completed — ${ref}`,
    html: SHELL(body, { previewText: `Your transfer ${ref} has been completed.` }),
    text: `Transfer Completed\n\nYour transfer has been settled.\nReference: ${ref}\n${amount ? `Amount: ${amount} ${asset || ''}\n` : ''}${recipient ? `To: ${recipient}\n` : ''}\nView history: https://aegis.cozanet.net`,
  };
}

export function transferFailedEmail(transferRef: string, reason?: string): EmailTemplate {
  const ref = transferRef || 'unknown';
  const body = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#dc2626;">Transfer Failed ❌</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#374151;">
      Your transfer could not be completed. No funds were lost — the transaction was reverted.
    </p>
    <table style="width:100%;margin:0 0 16px 0;font-size:14px;color:#374151;">
      <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Reference:</td><td style="padding:6px 0;font-family:monospace;">${escapeHtml(ref)}</td></tr>
      ${reason ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Reason:</td><td style="padding:6px 0;">${escapeHtml(reason)}</td></tr>` : ''}
    </table>
    <p style="margin:0;font-size:14px;color:#6b7280;">
      You can retry the transfer from your dashboard. If the issue persists, contact support@cozanet.net.
    </p>
    ${ctaButton('https://aegis.cozanet.net', 'Retry Transfer')}`;

  return {
    subject: `❌ Transfer failed — ${ref}`,
    html: SHELL(body, { previewText: `Your transfer ${ref} could not be completed.` }),
    text: `Transfer Failed\n\nYour transfer could not be completed. No funds were lost.\nReference: ${ref}\n${reason ? `Reason: ${reason}\n` : ''}\nRetry: https://aegis.cozanet.net`,
  };
}

export function swapExecutedEmail(amountIn?: string, tokenInSymbol?: string, tokenOutSymbol?: string, txHash?: string): EmailTemplate {
  const pair = `${amountIn || ''} ${tokenInSymbol || ''} → ${tokenOutSymbol || 'CZN'}`.trim();
  const explorerUrl = txHash ? `https://bscscan.com/tx/${txHash}` : 'https://aegis.cozanet.net';
  const body = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#111827;">Swap Completed ✅</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#374151;">
      Your swap on PancakeSwap V2 has been confirmed on-chain.
    </p>
    <table style="width:100%;margin:0 0 16px 0;font-size:14px;color:#374151;">
      ${amountIn ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Traded:</td><td style="padding:6px 0;">${escapeHtml(pair)}</td></tr>` : ''}
      ${txHash ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Tx Hash:</td><td style="padding:6px 0;font-family:monospace;">${escapeHtml(txHash.slice(0, 10))}...${escapeHtml(txHash.slice(-8))}</td></tr>` : ''}
    </table>
    ${ctaButton(explorerUrl, txHash ? 'View on BscScan' : 'View Dashboard')}`;

  return {
    subject: `✅ Swap completed${pair ? ` — ${pair}` : ''}`,
    html: SHELL(body, { previewText: `Your swap ${pair} has been confirmed.` }),
    text: `Swap Completed\n\nYour swap on PancakeSwap V2 has been confirmed.\n${amountIn ? `Traded: ${pair}\n` : ''}${txHash ? `Tx Hash: ${txHash}\n` : ''}\nView: ${explorerUrl}`,
  };
}

export function walletCreatedEmail(blockchain: string, address?: string): EmailTemplate {
  const chain = blockchain || 'wallet';
  const body = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#111827;">New Wallet Created 🔐</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#374151;">
      A new <strong>${escapeHtml(chain)}</strong> wallet has been created for your account.
    </p>
    ${address ? `
    <table style="width:100%;margin:0 0 16px 0;font-size:14px;color:#374151;">
      <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Address:</td><td style="padding:6px 0;font-family:monospace;font-size:13px;word-break:break-all;">${escapeHtml(address)}</td></tr>
    </table>` : ''}
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#1e40af;line-height:1.6;">
        <strong>Important:</strong> This wallet is permanently linked to your Aegis ID. Never share your private keys with anyone. AEGIS will never ask for your keys.
      </p>
    </div>
    ${ctaButton('https://aegis.cozanet.net', 'View My Wallets')}`;

  return {
    subject: `🔐 New ${chain} wallet created`,
    html: SHELL(body, { previewText: `A new ${chain} wallet has been created.` }),
    text: `New Wallet Created\n\nA new ${chain} wallet has been created for your account.\n${address ? `Address: ${address}\n` : ''}\nImportant: This wallet is permanently linked to your Aegis ID. Never share your private keys.\n\nView wallets: https://aegis.cozanet.net`,
  };
}

export function genericNotificationEmail(title: string, body: string): EmailTemplate {
  const content = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#111827;">${escapeHtml(title)}</h1>
    <p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">
      ${escapeHtml(body)}
    </p>`;

  return {
    subject: title,
    html: SHELL(content),
    text: `${title}\n\n${body}`,
  };
}
