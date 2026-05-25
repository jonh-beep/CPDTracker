// ============================================================
// CPD Agenda Pipeline — failure notification
// ============================================================
// The Cowork runner cannot send email (its Gmail connector only
// creates drafts), so the consolidated end-of-run alert is sent
// here via MailApp, which runs as the owner.
//
// Request body for action "report_failures":
//   {
//     "token": "...", "action": "report_failures",
//     "run_id": "2026-05-25T19:00",
//     "failures": [ { "filename": "...", "reason": "..." }, ... ]
//   }
// An empty or absent failures list sends nothing.
// ============================================================

function handleReportFailures_(body) {
  var failures = Array.isArray(body.failures) ? body.failures : [];
  var runId = body.run_id || nowIso_();

  if (failures.length === 0) {
    auditLog_('report_failures', 'ok', {}, '', 'run ' + runId + ': no failures');
    return { status: 'ok', emailed: 0 };
  }

  sendFailureEmail_(failures, runId);
  appendRunLog_('• run ' + runId + ' finished — ' + failures.length +
                ' failure(s), alert email sent');
  auditLog_('report_failures', 'ok', {}, '',
            'run ' + runId + ': ' + failures.length + ' failure(s), email sent');

  return { status: 'ok', emailed: failures.length };
}

function sendFailureEmail_(failures, runId) {
  var subject = 'CPD agenda pipeline — ' + failures.length +
                ' file(s) failed (run ' + runId + ')';

  var lines = [];
  lines.push('The CPD agenda processing run "' + runId + '" finished with ' +
             failures.length + ' file(s) that could not be processed.');
  lines.push('');
  lines.push('Each file has been moved to /CPD-Inbox/failed/ with a');
  lines.push('matching .error.json sidecar describing the cause.');
  lines.push('');
  lines.push('Failed files:');
  failures.forEach(function (f, i) {
    lines.push('  ' + (i + 1) + '. ' + (f.filename || 'unknown') +
               '  —  ' + (f.reason || 'unspecified'));
  });
  lines.push('');
  lines.push('No action is required for the pipeline to continue; the next');
  lines.push('scheduled run will process any new files in /CPD-Inbox/inbox/.');
  lines.push('Review the failed files at your convenience.');

  MailApp.sendEmail(ALERT_EMAIL, subject, lines.join('\n'));
}
