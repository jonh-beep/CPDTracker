// ============================================================
// Entries — CRUD on the CPD_Entries sheet, with audit hooks
// ============================================================

const SPREADSHEET_NAME = 'CPD Tracker Data';

function getOrCreateSpreadsheet() {
  // Standalone script — no active spreadsheet. Cache ID in Script Properties
  // so we don't pay a Drive search on every request after the first.
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('SPREADSHEET_ID');

  let ss = null;
  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ss = null; }
  }

  if (!ss) {
    const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    }
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }

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

function getEntries() {
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
      if (entry['Date'] instanceof Date) {
        entry['Date'] = Utilities.formatDate(
          entry['Date'], Session.getScriptTimeZone(), 'yyyy-MM-dd'
        );
      }
      if (entry['Created At'] instanceof Date) {
        entry['Created At'] = Utilities.formatDate(
          entry['Created At'], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'
        );
      }
      return entry;
    }).filter(e => e['ID']);
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

// Build a row array from an entry object, in ENTRY_HEADERS order.
function buildRow_(id, data, createdAt) {
  return [
    id,
    new Date(data.date || data['Date']),
    data.title   || data['Title']               || '',
    data.provider || data['Provider / Source']   || '',
    data.category || data['Category']            || '',
    data.roleContext || data['Role Context']      || '',
    data.cpdType    || data['CPD Type']           || '',
    parseFloat(data.duration || data['Duration (hours)']) || 0,
    data.description || data['Description / Impact'] || '',
    data.attachmentName || data['Attachment Name'] || '',
    data.attachmentUrl  || data['Attachment URL']  || '',
    data.linkUrl        || data['Link URL']        || '',
    Array.isArray(data.tags)
      ? data.tags.join(', ')
      : (data['Tags'] || ''),
    createdAt
  ];
}

function addEntry(entryData) {
  assertAllowedUser_();
  try {
    const ss = getOrCreateSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const now = new Date();
    const id = 'CPD_' + now.getTime();
    const row = buildRow_(id, entryData, now);
    sheet.appendRow(row);
    logCreate_(id, row);
    return { success: true, id: id };
  } catch (err) {
    return { error: err.message };
  }
}

// Frontend passes a single entry object; ID is at entry.ID or entry['ID'].
function updateEntry(entry) {
  assertAllowedUser_();
  try {
    const entryId = entry.ID || entry['ID'];
    if (!entryId) return { error: 'Missing entry ID' };

    const ss = getOrCreateSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === entryId) {
        const oldRow = data[i];
        const created = oldRow[ENTRY_HEADERS.indexOf('Created At')];
        const newRow = buildRow_(entryId, entry, created);
        sheet.getRange(i + 1, 1, 1, ENTRY_HEADERS.length).setValues([newRow]);
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
