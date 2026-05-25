// ============================================================
// CPD Agenda Pipeline — one-time provisioning
// ============================================================
// Run setup() ONCE, from the Apps Script editor or `clasp run`,
// after the project is created. It is idempotent: safe to re-run.
//
// setup() will:
//   1. generate the shared secret (if absent) and store it
//   2. create /CPD-Inbox/ + inbox, processed, failed, logs
//   3. seed logs/manifest.json and logs/run-log.md
//   4. append columns O-R to CPD_Entries
//   5. create the _audit tab
//   6. print the shared secret and folder IDs to the execution log
//
// showConfig() re-prints the secret and folder IDs at any time.
// ============================================================

function setup() {
  var props = PropertiesService.getScriptProperties();
  var report = [];

  // 1. Shared secret -----------------------------------------
  var token = props.getProperty(PROP_AUTH_TOKEN);
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '') +
            Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    props.setProperty(PROP_AUTH_TOKEN, token);
    report.push('Shared secret: generated.');
  } else {
    report.push('Shared secret: already present (kept).');
  }

  // 2. Drive folders -----------------------------------------
  var root = getOrCreateChildFolder_(DriveApp.getRootFolder(), INBOX_ROOT);
  props.setProperty(PROP_FOLDER.ROOT, root.getId());
  var subFolders = {};
  SUBFOLDERS.forEach(function (name) {
    var f = getOrCreateChildFolder_(root, name);
    subFolders[name] = f;
    props.setProperty(PROP_FOLDER[name], f.getId());
  });
  report.push('Drive folders: /' + INBOX_ROOT + '/ + ' + SUBFOLDERS.join(', ') + ' ready.');

  // 3. Seed log files ----------------------------------------
  seedFile_(subFolders.logs, MANIFEST_NAME, '{"processed":[]}', 'application/json');
  seedFile_(subFolders.logs, RUNLOG_NAME,
            '# CPD Agenda Pipeline — run log\n', 'text/plain');
  report.push('Log files: ' + MANIFEST_NAME + ', ' + RUNLOG_NAME + ' ready.');

  // 4. CPD_Entries columns O-R -------------------------------
  report.push(ensurePipelineColumns_());

  // 5. _audit tab --------------------------------------------
  report.push(ensureAuditSheet_());

  // 6. Print everything Claude Code needs to report back -----
  var lines = [
    '=== CPD AGENDA PIPELINE — SETUP COMPLETE ===',
    '',
    'SHARED_SECRET=' + token,
    '',
    'SPREADSHEET_ID=' + SPREADSHEET_ID,
    'FOLDER_ROOT_ID=' + props.getProperty(PROP_FOLDER.ROOT),
    'FOLDER_INBOX_ID=' + props.getProperty(PROP_FOLDER.inbox),
    'FOLDER_PROCESSED_ID=' + props.getProperty(PROP_FOLDER.processed),
    'FOLDER_FAILED_ID=' + props.getProperty(PROP_FOLDER.failed),
    'FOLDER_LOGS_ID=' + props.getProperty(PROP_FOLDER.logs),
    '',
    report.join('\n'),
    '',
    'NEXT: deploy as a web app (Anyone, Execute as Me), then give the',
    'deployment URL + SHARED_SECRET to the Cowork session.'
  ];
  var out = lines.join('\n');
  Logger.log(out);
  return out;
}

// Re-print the secret and folder IDs without re-provisioning.
function showConfig() {
  var props = PropertiesService.getScriptProperties();
  var out = [
    'SHARED_SECRET=' + props.getProperty(PROP_AUTH_TOKEN),
    'SPREADSHEET_ID=' + SPREADSHEET_ID,
    'FOLDER_ROOT_ID=' + props.getProperty(PROP_FOLDER.ROOT),
    'FOLDER_INBOX_ID=' + props.getProperty(PROP_FOLDER.inbox),
    'FOLDER_PROCESSED_ID=' + props.getProperty(PROP_FOLDER.processed),
    'FOLDER_FAILED_ID=' + props.getProperty(PROP_FOLDER.failed),
    'FOLDER_LOGS_ID=' + props.getProperty(PROP_FOLDER.logs)
  ].join('\n');
  Logger.log(out);
  return out;
}

// ---- helpers -----------------------------------------------

function getOrCreateChildFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function seedFile_(folder, name, content, mime) {
  var it = folder.getFilesByName(name);
  if (it.hasNext()) return it.next();        // keep existing content
  return folder.createFile(name, content, mime);
}

// Append the four pipeline columns O-R to CPD_Entries if missing.
// Never touches the existing base columns A-N.
function ensurePipelineColumns_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(ENTRIES_SHEET);
  if (!sheet) throw new Error('missing_sheet: ' + ENTRIES_SHEET);

  var firstPipelineCol = COL.LAST_UPDATED + 1;          // column 15 (O)
  var header = sheet.getRange(1, firstPipelineCol, 1, PIPELINE_HEADERS.length)
                    .getValues()[0];

  if (String(header[0]) === PIPELINE_HEADERS[0]) {
    return 'CPD_Entries columns O-R: already present.';
  }
  sheet.getRange(1, firstPipelineCol, 1, PIPELINE_HEADERS.length)
       .setValues([PIPELINE_HEADERS])
       .setFontWeight('bold');
  return 'CPD_Entries columns O-R: added (' + PIPELINE_HEADERS.join(', ') + ').';
}

// Create the _audit tab with a header row if it does not exist.
function ensureAuditSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(AUDIT_SHEET);
  if (sheet) return '_audit tab: already present.';

  sheet = ss.insertSheet(AUDIT_SHEET);
  sheet.getRange(1, 1, 1, AUDIT_HEADERS.length)
       .setValues([AUDIT_HEADERS])
       .setFontWeight('bold');
  sheet.setFrozenRows(1);
  return '_audit tab: created.';
}
