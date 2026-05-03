// ============================================================
// Audit — append-only log of every mutation
// ============================================================
// Every create/update/delete in Entries.gs writes here so nothing
// silently disappears from the CPD register. Used as the defensible
// trail for the annual Trustee CPD submission.

function ensureAuditSheet_(ss) {
  let sheet = ss.getSheetByName(AUDIT_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(AUDIT_SHEET);
    sheet.getRange(1, 1, 1, AUDIT_HEADERS.length).setValues([AUDIT_HEADERS]);
    sheet.getRange(1, 1, 1, AUDIT_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function logAudit_(action, entryId, field, oldValue, newValue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureAuditSheet_(ss);
  const actor = Session.getActiveUser().getEmail() || 'unknown';
  sheet.appendRow([
    new Date(),
    actor,
    action,
    entryId,
    field,
    oldValue === undefined || oldValue === null ? '' : String(oldValue),
    newValue === undefined || newValue === null ? '' : String(newValue)
  ]);
}

function logCreate_(entryId, row) {
  logAudit_('create', entryId, '*', '', JSON.stringify(row));
}

function logDelete_(entryId, row) {
  logAudit_('delete', entryId, '*', JSON.stringify(row), '');
}

function logUpdate_(entryId, oldRow, newRow) {
  for (let i = 0; i < ENTRY_HEADERS.length; i++) {
    const field = ENTRY_HEADERS[i];
    const before = oldRow[i];
    const after = newRow[i];
    if (String(before) !== String(after)) {
      logAudit_('update', entryId, field, before, after);
    }
  }
}
