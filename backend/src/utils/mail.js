import nodeMailer from 'nodemailer';

/**
 * Build SMTP transport options (shared by createTransporter and getSharedTransporter)
 * @returns {object} - Nodemailer transport options
 */
const getTransportOptions = () => {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_PORT || !process.env.EMAIL_ADMIN || !process.env.EMAIL_PASS) {
        throw new Error('Brakuje wymaganych zmiennych środowiskowych dla SMTP (EMAIL_HOST, EMAIL_PORT, EMAIL_ADMIN, EMAIL_PASS)');
    }

    const port = parseInt(process.env.EMAIL_PORT, 10);
    if (isNaN(port)) {
        throw new Error(`Nieprawidłowy port SMTP: ${process.env.EMAIL_PORT}`);
    }

    const poolMax = parseInt(process.env.EMAIL_POOL_MAX || '5', 10);
    const maxMessages = parseInt(process.env.EMAIL_MAX_MESSAGES || '100', 10);

    return {
        host: (process.env.EMAIL_HOST || '').trim(),
        port: port,
        secure: port === 465,
        requireTLS: port === 587,
        auth: {
            user: process.env.EMAIL_ADMIN,
            pass: process.env.EMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production',
            minVersion: 'TLSv1.2',
        },
        connectionTimeout: parseInt(process.env.EMAIL_CONNECTION_TIMEOUT || '30000', 10),
        greetingTimeout: parseInt(process.env.EMAIL_GREETING_TIMEOUT || '10000', 10),
        socketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT || '30000', 10),
        pool: true,
        maxConnections: Number.isNaN(poolMax) ? 5 : Math.max(1, poolMax),
        maxMessages: Number.isNaN(maxMessages) ? 100 : Math.max(1, maxMessages),
    };
};

/** @type {import('nodemailer').Transporter | null} */
let sharedTransporter = null;
let sharedTransporterVerified = false;

/**
 * Get shared SMTP transporter (lazy singleton with connection pool).
 * Verifies connection once on first creation.
 * @returns {Promise<import('nodemailer').Transporter>}
 */
export const getSharedTransporter = async () => {
    if (sharedTransporter) {
        return sharedTransporter;
    }
    const options = getTransportOptions();
    sharedTransporter = nodeMailer.createTransport(options);
    if (!sharedTransporterVerified) {
        await verifyConnection(sharedTransporter);
        sharedTransporterVerified = true;
    }
    return sharedTransporter;
};

/**
 * Optional SMTP connection verification (called once when shared transporter is created)
 * @param {import('nodemailer').Transporter} transporter - Transporter nodemailer
 */
const verifyConnection = async (transporter) => {
    const skipVerify = process.env.SKIP_SMTP_VERIFY == 'true';

    if (skipVerify) {
        console.log('Pominięto weryfikację SMTP (SKIP_SMTP_VERIFY=true)');
        return;
    }

    try {
        console.log(`Próba weryfikacji połączenia SMTP z ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}...`);
        await transporter.verify();
        console.log('Połączenie SMTP zweryfikowane pomyślnie');
    } catch (verifyError) {
        console.warn('Błąd weryfikacji połączenia SMTP (to nie blokuje wysyłania):', verifyError.message);
    }
};

const isRetryableError = (err) => {
    const msg = (err && err.message) ? String(err.message) : '';
    const code = err && err.code;
    return msg.includes('Unexpected socket close') || code === 'ECONNRESET' || code === 'ETIMEDOUT';
};

/**
 * Send mail with retry on transient socket errors
 * @param {import('nodemailer').Transporter} transporter
 * @param {import('nodemailer').SendMailOptions} mailOptions
 * @param {{ maxRetries?: number, delayMs?: number }} options
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
const sendMailWithRetry = async (transporter, mailOptions, options = {}) => {
    const maxRetries = options.maxRetries ?? 2;
    const delayMs = options.delayMs ?? 500;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await transporter.sendMail(mailOptions);
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries && isRetryableError(err)) {
                await new Promise((r) => setTimeout(r, delayMs));
                continue;
            }
            throw err;
        }
    }
    throw lastError;
};

/**
 * Send degustation email to admin
 * @param {string} subject - Temat wiadomości
 * @param {object} variables - Zmienne do szablonu HTML
 * @returns {Promise<object>} - Informacje o wysłanym mailu
 */
export const sendEmailAdmin = async (subject, variables) => {
    try {
        const { emailTemplate } = await import('./emailTemplates/emailTemplate.js');
        const transporter = await getSharedTransporter();

        const info = await sendMailWithRetry(transporter, {
            from: process.env.EMAIL_ADMIN,
            to: process.env.EMAIL_ADMIN,
            subject: subject,
            html: emailTemplate(variables),
        });

        console.log('Degustation email sent to admin:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending degustation email to admin:', error.message);
        throw error;
    }
};

/**
 * Send degustation email to client
 * @param {string} email - Adres odbiorcy
 * @param {string} subject - Temat
 * @param {object} variables - Zmienne do szablonu HTML
 * @returns {Promise<object>} - Informacje o wysłanym mailu
 */
export const sendEmailClient = async (email, subject, variables) => {
    try {
        if (!email) {
            throw new Error('Missing recipient email');
        }

        const { emailTemplate } = await import('./emailTemplates/emailTemplate.js');
        const transporter = await getSharedTransporter();

        const info = await sendMailWithRetry(transporter, {
            from: process.env.EMAIL_ADMIN,
            to: email,
            subject: subject,
            html: emailTemplate(variables),
        });

        console.log(`Degustation email sent to client (${email}):`, info.messageId);
        return info;
    } catch (error) {
        console.error(`Error sending degustation email to client (${email}):`, error.message);
        throw error;
    }
};

/**
 * Send order-placed notification to admin (finalized order).
 * @param {object} variables - orderNumber, status, clientName, clientEmail, clientPhone, deliveryAddress, eventDate, eventType, guestCount, paymentMethod, notes, orderItems, totalPrice, companyName (optional)
 * @returns {Promise<object>}
 */
export const sendOrderPlacedAdminEmail = async (variables) => {
    try {
        const { orderPlacedAdminTemplate } = await import('./emailTemplates/orderPlacedAdminTemplate.js');
        const transporter = await getSharedTransporter();
        const subject = variables.submissionType === 'offer'
            ? `Nowa oferta ${variables.orderNumber}`
            : `Nowe zamówienie ${variables.orderNumber}`;
        const info = await sendMailWithRetry(transporter, {
            from: process.env.EMAIL_ADMIN,
            to: process.env.EMAIL_ADMIN,
            subject,
            html: orderPlacedAdminTemplate(variables),
        });
        console.log('Order placed email sent to admin:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending order-placed email to admin:', error.message);
        throw error;
    }
};

/**
 * Send order confirmation to client (successfully placed order).
 * @param {string} clientEmail - Recipient
 * @param {object} variables - orderNumber, clientName, orderItems, totalPrice, companyName (optional)
 * @returns {Promise<object>}
 */
export const sendOrderPlacedClientEmail = async (clientEmail, variables) => {
    try {
        if (!clientEmail || !String(clientEmail).trim()) {
            throw new Error('Missing recipient email');
        }
        const { orderPlacedClientTemplate } = await import('./emailTemplates/orderPlacedClientTemplate.js');
        const transporter = await getSharedTransporter();
        const subject = `Potwierdzenie zamówienia ${variables.orderNumber}`;
        const info = await sendMailWithRetry(transporter, {
            from: process.env.EMAIL_ADMIN,
            to: String(clientEmail).trim(),
            subject,
            html: orderPlacedClientTemplate(variables),
        });
        console.log(`Order confirmation email sent to client (${clientEmail}):`, info.messageId);
        return info;
    } catch (error) {
        console.error(`Error sending order confirmation to client (${clientEmail}):`, error.message);
        throw error;
    }
};
