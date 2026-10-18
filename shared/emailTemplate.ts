import { escapeHtml, renderEmailBody } from './emailBody';
export { escapeHtml } from './emailBody';
export function renderEmail(subject: string, body: string, unsubscribeUrl: string, test: boolean, logoUrl = 'https://azuki.mame-app.com/email-logo.png', voltaLogoUrl = 'https://azuki.mame-app.com/volta-email-logo.png') {
  const content=renderEmailBody(body);
  const paragraphs=content.html;
  const stopLabel=test?'メール通知の設定':'アップデート通知を停止する';
  const footer=`Volta Technologies / Azuki\nお問い合わせ: support@volta.jp\n${stopLabel}: ${unsubscribeUrl}`;
  return {textContent:`${subject}\n\n${content.text}\n\n${footer}`,htmlContent:`<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title>
<style>@media only screen and (max-width:600px){.email-shell{padding:16px 10px!important}.email-main{padding:32px 24px 24px!important}.email-heading{font-size:25px!important;margin:28px 0 36px!important}.email-footer{padding:28px 24px!important}}</style></head>
<body style="margin:0;padding:0;background:#f5ece2;font-family:Arial,'Hiragino Kaku Gothic ProN',Meiryo,sans-serif;color:#282521;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5ece2"><tr><td class="email-shell" align="center" style="padding:40px 20px">
<!--[if mso]><table role="presentation" width="640"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden">
<tr><td class="email-main" style="padding:44px 48px 32px">
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr><td><img src="${escapeHtml(logoUrl)}" width="144" height="44" alt="azuki" style="display:block;border:0;width:144px;height:44px"></td></tr></table>
<h1 class="email-heading" style="margin:36px 0 44px;text-align:center;font-size:29px;line-height:1.5;letter-spacing:-.5px;font-weight:700;color:#282521;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(subject)}</h1>
${paragraphs}
</td></tr>
<tr><td class="email-footer" align="center" style="padding:32px 40px;background:#fbf6f0;border-top:1px solid #eee2d5;font-size:12px;line-height:1.9;color:#796d62">

<p style="margin:0 0 18px"><img src="${escapeHtml(voltaLogoUrl)}" width="260" alt="Volta Technologies" style="display:block;border:0;width:260px;max-width:100%;height:auto;margin:0 auto"></p>
<p style="margin:0 0 20px">英単語帳アプリ Azuki<br><a href="mailto:support@volta.jp" style="color:#796d62;text-decoration:underline">support@volta.jp</a></p>
<p style="margin:0"><a href="https://azuki.mame-app.com/privacy" style="color:#796d62;text-decoration:underline">プライバシーポリシー</a><br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#972d31;text-decoration:underline">${stopLabel}</a></p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`};
}
