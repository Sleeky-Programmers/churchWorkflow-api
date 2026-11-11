export interface EmailButton {
  text: string;
  link: string;
}

export interface EmailInfoRow {
  label: string;
  value: string;
}

export interface EmailLayoutOptions {
  /** Hidden preview text shown next to the subject line in inbox lists. */
  previewText?: string;
  heading: string;
  greeting?: string;
  paragraphs?: string[];
  /** Rendered as a bold, brand-colored callout (e.g. a role name or OTP code). */
  highlight?: string;
  /** Rendered as a left-aligned label/value list (e.g. reason, actor, timestamp). */
  infoRows?: EmailInfoRow[];
  button?: EmailButton;
  fineprint?: string;
  footerNote?: string;
  footerLinkUrl?: string;
  footerLinkLabel?: string;
}

const LOGO_URL =
  'https://res.cloudinary.com/dlw6sowno/image/upload/v1769148983/cw-logo_apjjxi.png';
const BRAND_COLOR = '#0C5FB3';

/**
 * Renders the shared Church Workflow transactional email layout.
 * All outgoing emails should be built with this function so that
 * branding, spacing, and typography stay consistent across the system.
 */
export function renderEmailLayout(options: EmailLayoutOptions): string {
  const {
    previewText,
    heading,
    greeting,
    paragraphs = [],
    highlight,
    infoRows = [],
    button,
    fineprint,
    footerNote = 'This notification was sent via Church Workflow.',
    footerLinkUrl = 'https://www.churchworkflow.com',
    footerLinkLabel = 'www.churchworkflow.com',
  } = options;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8" />
    <title>Church Workflow</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #F7F7F8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #000000; line-height: 1.5; }
      .email-wrapper { max-width: 640px; margin: 40px auto; background: #ffffff; }
      .preheader { display: none; max-height: 0; overflow: hidden; opacity: 0; }
      .header { background-color: ${BRAND_COLOR}; padding: 28px 32px; text-align: center; }
      .logo-image { height: 42px; width: auto; display: inline-block; }
      .content { padding: 48px 48px 40px; text-align: center; }
      .content h1 { font-size: 26px; font-weight: 700; margin-bottom: 24px; }
      .content p { font-size: 16px; margin-bottom: 16px; }
      .badge { color: ${BRAND_COLOR}; font-weight: 600; font-size: 18px; margin: 4px 0 16px; }
      .info-list { text-align: left; margin: 8px auto 24px; max-width: 420px; }
      .info-row { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid #EEEEEE; font-size: 14px; }
      .info-row:last-child { border-bottom: none; }
      .info-label { color: #737373; }
      .info-value { font-weight: 600; color: #000000; text-align: right; }
      .button-wrapper { margin: 32px 0; display: inline-block; background-color: ${BRAND_COLOR}; border-radius: 8px; }
      .btn { color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 16px; display: block; padding: 14px 28px; }
      .fine-print { font-size: 14px; color: #737373; margin-top: 24px; }
      .footer { text-align: center; padding: 0 40px 40px; font-size: 13px; color: #737373; }
      .footer a { color: ${BRAND_COLOR}; text-decoration: none; }
      .copyright { margin-top: 16px; font-size: 12px; }
    </style>
    </head>
    <body>
      ${previewText ? `<span class="preheader">${previewText}</span>` : ''}
      <div class="email-wrapper">
        <div class="header">
          <img src="${LOGO_URL}" alt="Church Workflow" class="logo-image" />
        </div>

        <div class="content">
          <h1>${heading}</h1>

          ${greeting ? `<p>${greeting}</p>` : ''}
          ${paragraphs
            .map((p) => {
              return `<p>${p}</p>`;
            })
            .join('\n')}

          ${highlight ? `<div class="badge">${highlight}</div>` : ''}

          ${
            infoRows.length
              ? `<div class="info-list">
                  ${infoRows
                    .map((row) => {
                      return `<div class="info-row">
                        <span class="info-label">${row.label}</span>
                        <span class="info-value">${row.value}</span>
                      </div>`;
                    })
                    .join('\n')}
                </div>`
              : ''
          }

          ${
            button
              ? `<div class="button-wrapper">
                  <a href="${button.link}" class="btn">${button.text}</a>
                </div>`
              : ''
          }

          ${fineprint ? `<p class="fine-print">${fineprint}</p>` : ''}
        </div>

        <div class="footer">
          <p>${footerNote}</p>
          <p>
            <a href="${footerLinkUrl}" target="_blank" rel="noopener noreferrer">
              ${footerLinkLabel}
            </a>
          </p>
          <div class="copyright">
            © ${new Date().getFullYear()} Church Workflow. All rights reserved.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
