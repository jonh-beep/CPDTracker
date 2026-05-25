// ============================================================
// CPD Agenda Pipeline — Drive file operations & logging
// ============================================================
// All Drive mutations live here because the Cowork runner's Drive
// connector cannot move or delete files. This script runs as the
// owner and uses DriveApp, which can.
//
// Nothing is ever deleted. Files are only moved between folders;
// failures additionally get a sidecar .error.json.
// ============================================================

// ---- file moves --------------------------------------------
// Move a Drive file into the given folder. Returns the file's URL.
function moveToFolder_(fileId, folderId) {
  var file = DriveApp.getFileById(fileId);
  var folder = DriveApp.getFolderById(folderId);
  file.moveTo(folder);            // DriveApp move — no copy, no delete
  return file.getUrl();
}

// ---- quarantine (failed files) -----------------------------
// Move a file to /failed/ and drop a sidecar describing the cause.
// Safe to call even when source_file_id is missing or invalid.
function quarantine_(rec, reason) {
  var filename = (rec && rec.source_filename) || 'unknown';
  var movedUrl = '';

  if (rec && rec.source_file_id) {
    try {
      movedUrl = moveToFolder_(rec.source_file_id, getFolderId_(PROP_FOLDER.failed));
    } catch (err) {
      reason = reason + ' | move_failed: ' + err;
    }
  }

  // Sidecar: <filename>.error.json in the /failed/ folder.
  var sidecar = {
    source_filename: filename,
    source_hash: (rec && rec.source_hash) || '',
    failed_at: nowIso_(),
    reason: reason,
    moved_file_url: movedUrl
  };
  try {
    writeFailedSidecar_(filename + '.error.json', JSON.stringify(sidecar, null, 2));
  } catch (err2) {
    // Sidecar is best-effort; the _audit tab is the durable record.
  }

  appendManifest_(rec || {}, 'failed', '');
  appendRunLog_('• failed — ' + filename + ' — ' + reason);
  auditLog_('fail', 'failed', rec || {}, '', reason);
}

// Create (or overwrite) a sidecar file in the /failed/ folder.
function writeFailedSidecar_(name, content) {
  var folder = DriveApp.getFolderById(getFolderId_(PROP_FOLDER.failed));
  var existing = folder.getFilesByName(name);
  if (existing.hasNext()) {
    existing.next().setContent(content);
  } else {
    folder.createFile(name, content, 'application/json');
  }
}

// ---- logs folder -------------------------------------------
// Return a named file from the /logs/ folder, creating it (with the
// supplied seed content) if it does not yet exist.
function getLogFile_(name, seedContent) {
  var folder = DriveApp.getFolderById(getFolderId_(PROP_FOLDER.logs));
  var it = folder.getFilesByName(name);
  if (it.hasNext()) return it.next();
  var mime = (name.slice(-5) === '.json') ? 'application/json' : 'text/plain';
  return folder.createFile(name, seedContent || '', mime);
}

// ---- manifest.json -----------------------------------------
// Append one entry to the processed-file ledger. Keyed by hash so
// the runner can detect already-processed files and stay idempotent.
function appendManifest_(rec, status, entryId) {
  var file = getLogFile_(MANIFEST_NAME, '{"processed":[]}');
  var data;
  try {
    data = JSON.parse(file.getBlob().getDataAsString() || '{"processed":[]}');
  } catch (err) {
    data = { processed: [] };
  }
  if (!Array.isArray(data.processed)) data.processed = [];

  data.processed.push({
    source_hash: (rec && rec.source_hash) || '',
    logical_key: (rec && rec.title) ? makeLogicalKey_(rec) : '',
    source_filename: (rec && rec.source_filename) || '',
    status: status,
    entry_id: entryId || '',
    extracted: rec ? {
      event_date: rec.event_date || '',
      duration_minutes: rec.duration_minutes || '',
      title: rec.title || '',
      organiser: rec.organiser || '',
      themes: rec.themes || []
    } : {},
    timestamp: nowIso_()
  });

  file.setContent(JSON.stringify(data, null, 2));
}

// ---- run-log.md --------------------------------------------
// Append a human-readable line to the run history.
function appendRunLog_(line) {
  var file = getLogFile_(RUNLOG_NAME, '# CPD Agenda Pipeline — run log\n');
  var current = file.getBlob().getDataAsString();
  file.setContent(current + '\n' + nowIso_() + '  ' + line);
}

// ---- _audit tab --------------------------------------------
// Append one row to the pipeline audit tab. This is the durable,
// always-readable record of every call's outcome.
function auditLog_(action, status, rec, entryId, detail) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(AUDIT_SHEET);
    if (!sheet) return;            // setup() not yet run; skip quietly
    sheet.appendRow([
      nowIso_(),
      action,
      status,
      (rec && rec.source_filename) || '',
      (rec && rec.source_hash) || '',
      (rec && rec.title) ? makeLogicalKey_(rec) : '',
      entryId || '',
      detail || ''
    ]);
  } catch (err) {
    // Auditing must never break the main flow.
  }
}
