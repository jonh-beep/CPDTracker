// ============================================================
// Entries — CRUD on the CPD_Entries sheet, with audit hooks
// ============================================================
// Bound script: uses the active spreadsheet, which is the
// "CPD Tracker Data" sheet that contains this script project.

function getOrCreateSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, ENTRY_HEADERS.length).setValues([ENTRY_HEADERS]);
    sheet.getRange(1, 1, 1, ENTRY_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  let settingsSheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SETTINGS_SHEET);
    settingsSheet.getRange('A1').setValue('Setting');
    settingsSheet.getRange('B1').setValue('Value');
    settingsSheet.getRange('A1:B1').setFontWeight('bold');
    settingsSheet.getRange('A2').setValue('EPMI_Annual_Target_Hours');
    settingsSheet.getRange('B2').setValue(35);
    settingsSheet.getRange('A3').setValue('MasterTrust_Annual_Target_Hours');
    settingsSheet.getRange('B3').setValue(15);
    settingsSheet.getRange('A4').setValue('CPD_Year_Start_Month');
    settingsSheet.getRange('B4').setValue(11);
  }

  ensureAuditSheet_(ss);
  return ss;
}

function getAllEntries() {
  assertAllowedUser_();
  try {
    const ss = getOrCreateSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data[0];
    return data.slice(1).map(row => {
      const entry = {};
      headers.forEach((h, i) => { entry[h] = row[i]; });
      try { entry.Links = entry.Links ? JSON.parse(entry.Links) : []; } catch (e) { entry.Links = []; }
      try { entry.Attachments = entry.Attachments ? JSON.parse(entry.Attachments) : []; } catch (e) { entry.Attachments = []; }
      if (entry.Date instanceof Date) {
        entry.Date = Utilities.formatDate(entry.Date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      if (entry.Created instanceof Date) {
        entry.Created = Utilities.formatDate(entry.Created, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
      }
      if (entry.Modified instanceof Date) {
        entry.Modified = Utilities.formatDate(entry.Modified, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
      }
      return entry;
    }).filter(e => e.ID);
  } catch (err) {
    return { error: err.message };
  }
}

function getSettings() {
  assertAllowedUser_();
  try {
    const ss = getOrCreateSpreadsheet();
    const sheet = ss.getSheetByName(SETTINGS_SHEET);
    const data = sheet.getDataRange().getValues();
    const settings = {};
    data.slice(1).forEach(row => { if (row[0]) settings[row[0]] = row[1]; });
    return settings;
  } catch (err) {
    return { error: err.message };
  }
}

function buildRow_(id, entryData, createdAt, modifiedAt) {
  return [
    id,
    new Date(entryData.date),
    entryData.title,
    entryData.description || '',
    entryData.category || '',
    entryData.type || '',
    parseFloat(entryData.hours) || 0,
    entryData.provider || '',
    entryData.role || 'Both',
    entryData.epmi_relevant ? 'Yes' : 'No',
    entryData.mastertrust_relevant ? 'Yes' : 'No',
    JSON.stringify(entryData.links || []),
    JSON.stringify(entryData.attachments || []),
    entryData.notes || '',
    createdAt,
    modifiedAt
  ];
}

function addEntry(entryData) {
  assertAllowedUser_();
  try {
    const ss = getOrCreateSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const now = new Date();
    const id = 'CPD_' + now.getTime();
    const row = buildRow_(id, entryData, now, now);
    sheet.appendRow(row);
    logCreate_(id, row);
    return { success: true, id: id };
  } catch (err) {
    return { error: err.message };
  }
}

function updateEntry(entryId, entryData) {
  assertAllowedUser_();
  try {
    const ss = getOrCreateSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === entryId) {
        const r = i + 1;
        const oldRow = data[i];
        const now = new Date();
        const created = oldRow[14]; // preserve original Created
        const newRow = buildRow_(entryId, entryData, created, now);
        sheet.getRange(r, 1, 1, ENTRY_HEADERS.length).setValues([newRow]);
        logUpdate_(entryId, oldRow, newRow);
        return { success: true };
      }
    }
    return { error: 'Entry not found' };
  } catch (err) {
    return { error: err.message };
  }
}

function deleteEntry(entryId) {
  assertAllowedUser_();
  try {
    const ss = getOrCreateSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === entryId) {
        logDelete_(entryId, data[i]);
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { error: 'Entry not found' };
  } catch (err) {
    return { error: err.message };
  }
}
