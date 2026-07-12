const { exec } = require('child_process');
const path = require('path');

module.exports = async function globalTeardown() {
  const dashboard = path.resolve(__dirname, 'docs', 'datalayer-report.html');

  // Open the custom dashboard in the default browser
  // Works on Windows (start), Mac (open), Linux (xdg-open)
  const cmd =
    process.platform === 'win32'  ? `powershell -Command "Start-Process '${dashboard}'"` :
    process.platform === 'darwin' ? `open "${dashboard}"` :
                                    `xdg-open "${dashboard}"`;

  exec(cmd, err => {
    if (err) console.error('[teardown] Could not open dashboard:', err.message);
    else console.log('[teardown] Dashboard opened:', dashboard);
  });
};
