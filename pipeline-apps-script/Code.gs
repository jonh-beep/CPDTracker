// ============================================================
// CPD Agenda Pipeline — web app entry points
// ============================================================
// doGet  — unauthenticated health check.
// doPost — the pipeline endpoint. Every request must carry the
//          shared secret in its JSON body (Apps Script cannot read
//          custom HTTP headers, so the secret cannot live in one).
//
// Request body shape (application/json):
//   {
//     "token":  "<shared secret>",
//     "action": "ping" | "ingest" | "fail" | "report_failures",
//     ...action-specific fields...
//   }
//
// Responses are always HTTP 200. The "status" field carries the
// real outcome: "ok" | "created" | "merged" | "skipped_identical"
// | "error".
// ============================================================

function doGet(e) {
  // Public health check — reveals nothing sensitive. Used by the
  // Phase 2 round-trip test to confirm the deployment is live.
  return jsonOut_({
    status: 'ok',
    service: 'cpd-agenda-pipeline',
    time: nowIso_()
  });
}

function doPost(e) {
  // 1. Parse the body.
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ status: 'error', reason: 'invalid_json' });
  }

  // 2. Authenticate. A wrong/absent token reveals nothing further.
  var token = getAuthToken_();
  if (!token) {
    return jsonOut_({ status: 'error', reason: 'not_setup' });
  }
  if (!body || body.token !== token) {
    return jsonOut_({ status: 'error', reason: 'unauthorised' });
  }

  // 3. Route. A script-wide lock serialises the mutating actions so
  //    concurrent runs cannot corrupt the Sheet or manifest.
  try {
    switch (body.action) {
      case 'ping':
        return jsonOut_({ status: 'ok', action: 'ping', time: nowIso_() });

      case 'ingest': {
        var lock1 = LockService.getScriptLock();
        lock1.waitLock(30000);
        try { return jsonOut_(handleIngest_(body.record)); }
        finally { lock1.releaseLock(); }
      }

      case 'fail': {
        var lock2 = LockService.getScriptLock();
        lock2.waitLock(30000);
        try { return jsonOut_(handleFail_(body)); }
        finally { lock2.releaseLock(); }
      }

      case 'report_failures':
        return jsonOut_(handleReportFailures_(body));

      default:
        return jsonOut_({ status: 'error', reason: 'unknown_action' });
    }
  } catch (err) {
    return jsonOut_({
      status: 'error',
      reason: 'exception',
      detail: String((err && err.message) || err)
    });
  }
}
