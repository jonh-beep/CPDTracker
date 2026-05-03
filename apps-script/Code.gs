// ============================================================
// CPD Tracker — Web app entry point
// ============================================================
// Bound to the "CPD Tracker Data" Google Sheet. Deployed via clasp.
// All callable functions enforce the allowlist in Auth.gs.
//
// Deploy:
//   cd apps-script && clasp push && clasp deploy
//
// Web app settings (appsscript.json):
//   executeAs: USER_ACCESSING   — runs as the calling user
//   access:    MYSELF           — only the deploying account can call

function doGet(e) {
  assertAllowedUser_();
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('CPD Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0');
}
