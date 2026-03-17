import { formatPolishDate } from './exportables.js';
import { emailColors } from './emailColors.js';

const COMPANY_NAME = 'Szczypta Smaku';

/**
 * Admin email: new order/offer notification.
 * @param {object} variables - orderNumber, status, clientName, clientEmail, clientPhone, deliveryAddress, eventDate, eventType, guestCount, paymentMethod, notes, orderItems, totalPrice, companyName (optional)
 * @returns {string} HTML
 */
export function orderPlacedAdminTemplate(variables) {
    const c = emailColors;
    const companyName = variables.companyName || COMPANY_NAME;
    const eventDateFormatted = variables.eventDate
        ? formatPolishDate(variables.eventDate)
        : '—';
    const orderItems = Array.isArray(variables.orderItems) ? variables.orderItems : [];
    const totalPrice = variables.totalPrice != null ? Number(variables.totalPrice) : 0;
    const totalFormatted = totalPrice.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let itemsRows = '';
    orderItems.forEach((item) => {
        const name = item.name ?? '';
        const qty = item.quantity != null ? item.quantity : 1;
        const unit = item.unit ?? 'szt.';
        const pricePerUnit = item.pricePerUnit != null ? Number(item.pricePerUnit).toFixed(2) : '0.00';
        const total = item.total != null ? Number(item.total).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
        itemsRows += `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid ${c.borderLight}; font-size: 14px; color: ${c.foreground}; font-family: 'Raleway', Arial, sans-serif;">${escapeHtml(name)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid ${c.borderLight}; font-size: 14px; color: ${c.foreground}; font-family: 'Raleway', Arial, sans-serif; text-align: right;">${qty} ${unit}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid ${c.borderLight}; font-size: 14px; color: ${c.foreground}; font-family: 'Raleway', Arial, sans-serif; text-align: right;">${pricePerUnit} zł</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid ${c.borderLight}; font-size: 14px; color: ${c.foreground}; font-family: 'Raleway', Arial, sans-serif; text-align: right;">${total} zł</td>
        </tr>`;
    });
    if (orderItems.length === 0) {
        itemsRows = `<tr><td colspan="4" style="padding: 12px; font-size: 14px; color: ${c.mutedForeground}; font-family: 'Raleway', Arial, sans-serif;">Brak pozycji</td></tr>`;
    }

    const notesLine = variables.notes && String(variables.notes).trim()
        ? `<p style="font-size: 14px; color: ${c.foreground}; margin: 8px 0 0 0; font-family: 'Raleway', Arial, sans-serif;">Uwagi: ${escapeHtml(String(variables.notes).trim())}</p>`
        : '';

    return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${variables.status ?? 'Zamówienie'} | ${companyName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Raleway', Arial, sans-serif; background-color: ${c.background};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${c.background};">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto;">
          <tr>
            <td style="padding: 20px;">
              <p style="font-size: 15px; line-height: 1.6; color: ${c.foreground}; margin: 0 0 16px 0;">Otrzymano ${variables.status === 'Nowa oferta' ? 'nową ofertę' : 'nowe zamówienie'}.</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 2px solid ${c.primary}; background-color: ${c.accentBg};">
                <tr>
                  <td style="padding: 24px;">
                    <p style="font-size: 18px; font-weight: 600; color: ${c.foreground}; margin: 0 0 16px 0;">Numer: ${escapeHtml(String(variables.orderNumber ?? ''))}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${c.border};">
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase; letter-spacing: 0.05em;">KLIENT</span>
                          <p style="font-size: 14px; color: ${c.foreground}; margin: 4px 0 0 0;">${escapeHtml(String(variables.clientName ?? ''))}</p>
                          <p style="font-size: 14px; color: ${c.foreground}; margin: 2px 0 0 0;">${escapeHtml(String(variables.clientEmail ?? ''))}</p>
                          <p style="font-size: 14px; color: ${c.foreground}; margin: 2px 0 0 0;">${escapeHtml(String(variables.clientPhone ?? ''))}</p>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${c.border};">
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase;">ADRES DOSTAWY</span>
                          <p style="font-size: 14px; color: ${c.foreground}; margin: 4px 0 0 0;">${escapeHtml(String(variables.deliveryAddress ?? '—'))}</p>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${c.border};">
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase;">DATA WYDARZENIA</span>
                          <p style="font-size: 14px; color: ${c.foreground}; margin: 4px 0 0 0;">${eventDateFormatted}</p>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${c.border};">
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase;">RODZAJ WYDARZENIA / LICZBA GOŚCI</span>
                          <p style="font-size: 14px; color: ${c.foreground}; margin: 4px 0 0 0;">${escapeHtml(String(variables.eventType ?? '—'))}${variables.guestCount != null ? `, ${variables.guestCount} os.` : ''}</p>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${c.border};">
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase;">PŁATNOŚĆ</span>
                          <p style="font-size: 14px; color: ${c.foreground}; margin: 4px 0 0 0;">${escapeHtml(String(variables.paymentMethod ?? '—'))}</p>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px; border-collapse: collapse;">
                      <thead>
                        <tr style="background-color: ${c.tableHeaderBg};">
                          <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase;">Pozycja</th>
                          <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase;">Ilość</th>
                          <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase;">Cena jedn.</th>
                          <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase;">Suma</th>
                        </tr>
                      </thead>
                      <tbody>${itemsRows}</tbody>
                    </table>
                    <p style="font-size: 16px; font-weight: 600; color: ${c.foreground}; margin: 16px 0 0 0;">Razem: ${totalFormatted} zł</p>
                    ${notesLine}
                  </td>
                </tr>
              </table>
              <p style="font-size: 14px; color: ${c.mutedForeground}; margin: 24px 0 0 0;">${companyName}</p>
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
