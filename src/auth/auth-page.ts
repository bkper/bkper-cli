/**
 * OAuth callback page generation for Bkper CLI.
 * Renders styled HTML pages for authentication success/error states.
 */

/**
 * Bkper CLI logo URL (from GitHub raw)
 */
const LOGO_URL = 'https://raw.githubusercontent.com/bkper/bkper-cli/main/assets/bkper-cli-logo.svg';

/**
 * Generates a styled HTML page for OAuth callback responses.
 * Uses the Bkper logo and brand colors for a professional appearance.
 */
export function generateAuthPage(options: {
    type: 'success' | 'error';
    title: string;
    message: string;
}): string {
    const { type, title, message } = options;
    const isSuccess = type === 'success';

    // Colors from Bkper brand
    const accentColor = isSuccess ? '#3aaa57' : '#d14836';

    // Status icons (checkmark for success, X for error)
    const icon = isSuccess
        ? `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
        : `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Bkper CLI</title>
    <style>
        *, *::before, *::after {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.5;
        }
        @media (prefers-color-scheme: dark) {
            body {
                background: #1a1a1a;
                color: #e0e0e0;
            }
            .card {
                background: #2d2d2d;
                box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
            }
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 48px 40px;
            max-width: 420px;
            width: 90%;
            text-align: center;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
        }
        .logo {
            width: 100px;
            height: 100px;
            margin-bottom: 24px;
        }
        .status-icon {
            width: 56px;
            height: 56px;
            margin-bottom: 16px;
        }
        h1 {
            margin: 0 0 12px;
            font-size: 24px;
            font-weight: 600;
            color: ${accentColor};
        }
        p {
            margin: 0;
            font-size: 16px;
            color: #555;
        }
        @media (prefers-color-scheme: dark) {
            p {
                color: #ccc;
            }
        }
        .hint {
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid rgba(128, 128, 128, 0.2);
            font-size: 14px;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="card">
        <img class="logo" src="${LOGO_URL}" alt="Bkper CLI" />
        ${icon}
        <h1>${title}</h1>
        <p>${message}</p>
        ${
            isSuccess
                ? '<p class="hint">You can close this window and return to the terminal.</p>'
                : ''
        }
    </div>
</body>
</html>`;
}
