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
    const tz = Session.getScriptTimeZone();
    return data.slice(1).map(row => {
      const entry = {};
      headers.forEach((h, i) => {
        const v = row[i];
        // google.script.run cannot serialise Date objects — convert all to strings.
        if (v instanceof Date) {
          entry[h] = h === 'Date'
            ? Utilities.formatDate(v, tz, 'yyyy-MM-dd')
            : Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm');
        } else {
          entry[h] = v;
        }
      });
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

// Neutralise spreadsheet formula injection: Sheets evaluates a string
// that starts with = + - @ as a formula (IMPORTXML, HYPERLINK, ...).
// A leading apostrophe stores it as literal text; Sheets hides the
// apostrophe and getValues() returns the original string.
function cellText_(value) {
  const s = value === undefined || value === null ? '' : String(value);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

// Build a row array from an entry object, in ENTRY_HEADERS order.
function buildRow_(id, data, createdAt) {
  return [
    id,
    new Date(data.date || data['Date']),
    cellText_(data.title   || data['Title']               || ''),
    cellText_(data.provider || data['Provider / Source']   || ''),
    cellText_(data.category || data['Category']            || ''),
    cellText_(data.roleContext || data['Role Context']      || ''),
    cellText_(data.cpdType    || data['CPD Type']           || ''),
    parseFloat(data.duration || data['Duration (hours)']) || 0,
    cellText_(data.description || data['Description / Impact'] || ''),
    cellText_(data.attachmentName || data['Attachment Name'] || ''),
    cellText_(data.attachmentUrl  || data['Attachment URL']  || ''),
    cellText_(data.linkUrl        || data['Link URL']        || ''),
    cellText_(Array.isArray(data.tags)
      ? data.tags.join(', ')
      : (data['Tags'] || '')),
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
