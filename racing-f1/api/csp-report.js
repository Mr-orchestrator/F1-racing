// CSP Violation Report endpoint
// Receives reports from browsers when a script/resource violates the CSP policy.
// Logs violations to Vercel function logs — visible in Vercel dashboard → Functions tab.

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const report = body['csp-report'] || body;

    console.log('[CSP-VIOLATION]', JSON.stringify({
      blockedURI: report['blocked-uri'],
      violatedDirective: report['violated-directive'],
      effectiveDirective: report['effective-directive'],
      documentURI: report['document-uri'],
      sourceFile: report['source-file'],
      lineNumber: report['line-number'],
      columnNumber: report['column-number'],
      timestamp: new Date().toISOString()
    }));

    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
  }
}

export const config = { runtime: 'edge' };
