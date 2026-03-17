import { emailColors } from './emailColors.js';

const COMPANY_NAME = 'Szczypta Smaku';

/**
 * Client email: order confirmation (successfully placed order).
 * @param {object} variables - orderNumber, clientName, orderItems, totalPrice, companyName (optional)
 * @returns {string} HTML
 */
export function orderPlacedClientTemplate(variables) {
    const c = emailColors;
    const companyName = variables.companyName || COMPANY_NAME;
    const clientName = variables.clientName ? String(variables.clientName).trim() : 'Kliencie';
    const orderItems = Array.isArray(variables.orderItems) ? variables.orderItems : [];
    const totalPrice = variables.totalPrice != null ? Number(variables.totalPrice) : 0;
    const totalFormatted = totalPrice.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let itemsList = '';
    orderItems.forEach((item) => {
        const name = item.name ?? '';
        const qty = item.quantity != null ? item.quantity : 1;
        const unit = item.unit ?? 'szt.';
        const total = item.total != null ? Number(item.total).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
        itemsList += `<li style="margin: 4px 0; font-size: 14px; color: ${c.foreground};">${escapeHtml(name)} — ${qty} ${unit}, ${total} zł</li>`;
    });
    if (orderItems.length === 0) {
        itemsList = `<li style="font-size: 14px; color: ${c.mutedForeground};">Brak pozycji</li>`;
    }

    return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Potwierdzenie zamówienia | ${companyName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Raleway', Arial, sans-serif; background-color: ${c.background};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${c.background};">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto;">
          <tr>
            <td style="padding: 20px;">
              <p style="font-size: 15px; line-height: 1.6; color: ${c.foreground}; margin: 0 0 16px 0;">Szanowny ${escapeHtml(clientName)},</p>
              <p style="font-size: 15px; line-height: 1.6; color: ${c.foreground}; margin: 0 0 16px 0;">dziękujemy za złożenie zamówienia. Oto potwierdzenie:</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 2px solid ${c.primary}; background-color: ${c.accentBg};">
                <tr>
                  <td style="padding: 24px;">
                    <p style="font-size: 18px; font-weight: 600; color: ${c.foreground}; margin: 0 0 16px 0;">Numer zamówienia: ${escapeHtml(String(variables.orderNumber ?? ''))}</p>
                    <p style="font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase; letter-spacing: 0.05em; margin: 16px 0 8px 0;">Podsumowanie</p>
                    <ul style="list-style: none; padding: 0; margin: 0;">${itemsList}</ul>
                    <p style="font-size: 16px; font-weight: 600; color: ${c.foreground}; margin: 16px 0 0 0;">Razem: ${totalFormatted} zł</p>
                  </td>
                </tr>
              </table>
              <p style="font-size: 15px; line-height: 1.6; color: ${c.foreground}; margin: 24px 0 0 0;">Skontaktujemy się w celu potwierdzenia szczegółów.</p>
              <p style="font-size: 15px; line-height: 1.6; color: ${c.foreground}; margin: 16px 0 0 0;">Z wyrazami szacunku,<br><strong>${companyName}</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str) {
    if (str == null) return '';
    const s = String(str);
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
