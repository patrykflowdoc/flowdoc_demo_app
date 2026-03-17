import { formatPolishDate, formatPolishWeddingDate } from './exportables.js';
import { emailColors } from './emailColors.js';

export const emailTemplate = (variables) => {
    const c = emailColors;
    const isIndividual = variables.TASTING_TYPE === "INDIVIDUAL";
    const tastingTypeLabel = isIndividual ? "Degustacja indywidualna" : "Degustacja ogólna";
    
    const formattedTastingDate = formatPolishDate(variables.TASTING_DATE, variables.TASTING_TIME);
    const formattedWeddingDate = formatPolishWeddingDate(variables.WEDDING_DATE);
    
    const peopleCount = variables.PEOPLE_COUNT || 0;
    const extraPeople = peopleCount > 2 ? peopleCount - 2 : 0;
    const extraCost = extraPeople * 150;
    const peopleLabel = peopleCount === 1 ? 'osoba' : (peopleCount < 5 ? 'osoby' : 'osób');
    const peopleText = `${peopleCount} ${peopleLabel}${extraPeople > 0 ? ` (+${extraCost} zł za dodatkowych gości)` : ''}`;
    
    const peopleSection = peopleCount > 0 ? `
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${c.border};">
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase; letter-spacing: 0.05em; display: block; font-family: 'Raleway', Arial, sans-serif;">LICZBA OSÓB</span>
                          <p style="font-size: 14px; color: ${c.foreground}; font-weight: 500; margin: 4px 0 0 0; font-family: 'Raleway', Arial, sans-serif;">${peopleText}</p>
                        </td>
                      </tr>
                    </table>` : '';

    // Generuj sekcję dań pogrupowanych po kategoriach
    const hasMenuItems = isIndividual && variables.MENU_ITEMS && typeof variables.MENU_ITEMS === 'object' && Object.keys(variables.MENU_ITEMS).length > 0;
    
    let dishesRows = '';
    if (hasMenuItems) {
        Object.entries(variables.MENU_ITEMS).forEach(([category, dishes]) => {
            dishesRows += `
                                <p style="font-size: 14px; color: ${c.foreground}; font-weight: 600; margin: 12px 0 6px 0; font-family: 'Raleway', Arial, sans-serif;">${category}</p>`;
            dishes.forEach(dish => {
                dishesRows += `
                                <p style="font-size: 14px; color: ${c.foreground}; margin: 2px 0 2px 16px; font-family: 'Raleway', Arial, sans-serif;">• ${dish}</p>`;
            });
        });
    }

    const dishesSection = hasMenuItems ? `
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${c.border};">
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase; letter-spacing: 0.05em; display: block; font-family: 'Raleway', Arial, sans-serif; margin-bottom: 8px;">WYBRANE DANIA</span>
                          ${dishesRows}
                        </td>
                      </tr>
                    </table>` : '';

    const notesSection = variables.NOTES_LINE 
        ? `<p style="font-size: 14px; color: ${c.mutedForeground}; margin: 8px 0 0 0; font-family: 'Raleway', Arial, sans-serif;">${variables.NOTES_LINE}</p>` 
        : '';
    
    return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zgłoszenie na degustację | Szczypta Smaku</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Raleway', Arial, sans-serif; background-color: ${c.background};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${c.background};">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto;">
          <tr>
            <td style="padding: 20px;">
              
              <p style="font-size: 15px; line-height: 1.6; color: ${c.foreground}; margin: 0 0 16px 0; font-family: 'Raleway', Arial, sans-serif;">Szanowni Państwo,</p>
              
              <p style="font-size: 15px; line-height: 1.6; color: ${c.foreground}; margin: 0 0 16px 0; font-family: 'Raleway', Arial, sans-serif;">
                dziękujemy za wypełnienie formularza degustacyjnego oraz przesłanie zgłoszenia.
              </p>
              
              <p style="font-size: 15px; line-height: 1.6; color: ${c.foreground}; margin: 0 0 24px 0; font-family: 'Raleway', Arial, sans-serif;">
                Potwierdzamy zapisanie się na wybraną formę spotkania degustacyjnego.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 2px solid ${c.primary}; background-color: ${c.accentBg}; font-family: 'Raleway', Arial, sans-serif;">
                <tr>
                  <td style="padding: 24px;">
                    
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <span style="font-size: 18px; font-weight: 600; color: ${c.foreground}; font-family: 'Raleway', Arial, sans-serif;">Podsumowanie</span>
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase; letter-spacing: 0.05em; display: block; font-family: 'Raleway', Arial, sans-serif;">RODZAJ DEGUSTACJI</span>
                          <p style="font-size: 14px; color: ${c.foreground}; font-weight: 500; margin: 4px 0 0 0; font-family: 'Raleway', Arial, sans-serif;">${tastingTypeLabel}</p>
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${c.border};">
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase; letter-spacing: 0.05em; display: block; font-family: 'Raleway', Arial, sans-serif;">TERMIN DEGUSTACJI</span>
                          <p style="font-size: 14px; color: ${c.foreground}; font-weight: 500; margin: 4px 0 0 0; font-family: 'Raleway', Arial, sans-serif;">${formattedTastingDate}</p>
                        </td>
                      </tr>
                    </table>

                    ${peopleSection}
                    
                    ${dishesSection}

                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${c.border};">
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="font-size: 12px; color: ${c.mutedForeground}; text-transform: uppercase; letter-spacing: 0.05em; display: block; font-family: 'Raleway', Arial, sans-serif; margin-bottom: 8px;">DANE KONTAKTOWE</span>
                          <p style="font-size: 14px; color: ${c.foreground}; margin: 0 0 4px 0; font-family: 'Raleway', Arial, sans-serif;">Pani Młoda: ${variables.BRIDE_NAME || ''}${variables.BRIDE_PHONE ? `, tel. ${variables.BRIDE_PHONE}` : ''}</p>
                          <p style="font-size: 14px; color: ${c.foreground}; margin: 0 0 4px 0; font-family: 'Raleway', Arial, sans-serif;">Pan Młody: ${variables.GROOM_NAME || ''}${variables.GROOM_PHONE ? `, tel. ${variables.GROOM_PHONE}` : ''}</p>
                          <p style="font-size: 14px; color: ${c.mutedForeground}; margin: 0 0 4px 0; font-family: 'Raleway', Arial, sans-serif;">Miejsce: ${variables.VENUE || ''}</p>
                          <p style="font-size: 14px; color: ${c.mutedForeground}; margin: 0; font-family: 'Raleway', Arial, sans-serif;">Data wesela: ${formattedWeddingDate}</p>
                          ${notesSection}
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <p style="font-size: 15px; line-height: 1.6; color: ${c.foreground}; margin: 32px 0 24px 0; font-family: 'Raleway', Arial, sans-serif;">Z wyrazami szacunku</p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${c.borderLight};">
                <tr>
                  <td style="padding-top: 20px;">
                    <p style="font-size: 14px; color: ${c.foreground}; margin: 0 0 4px 0; font-family: 'Raleway', Arial, sans-serif;">Dominika Grzywa-Łaptaś</p>
                    <p style="font-size: 14px; color: ${c.foreground}; margin: 0 0 4px 0; font-family: 'Raleway', Arial, sans-serif;">Event Manager</p>
                    <p style="font-size: 14px; color: ${c.foreground}; margin: 0 0 16px 0; font-family: 'Raleway', Arial, sans-serif;">tel. 791 846 444</p>
                    
                    <p style="font-size: 14px; color: ${c.foreground}; margin: 0 0 4px 0; font-family: 'Raleway', Arial, sans-serif;">SZCZYPTA SMAKU</p>
                    <p style="font-size: 14px; color: ${c.foreground}; margin: 0 0 4px 0; font-family: 'Raleway', Arial, sans-serif;">ul. Sportowa 27A, 32-031 Mogilany</p>
                    <a href="https://www.jurek-catering.pl/" style="font-size: 14px; color: ${c.primary}; font-family: 'Raleway', Arial, sans-serif;">https://www.jurek-catering.pl/</a>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
