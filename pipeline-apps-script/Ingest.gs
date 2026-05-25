// ============================================================
// CPD Agenda Pipeline — ingest, validation & dedup
// ============================================================
// handleIngest_  — validate an extracted record, dedup it against
//                  CPD_Entries, write/merge a row, move the source
//                  file to /processed/, and log everything.
// handleFail_    — the runner could not extract a file; quarantine
//                  it to /failed/ with a sidecar.
//
// Dedup decision (per the agreed design) compares ONLY the pipeline
// columns P (Source_Hash) and Q (Logical_Key). Rows entered by hand
// in the CPDTracker app leave those columns blank and so never
// match — i.e. dedup is scoped to pipeline-created rows only.
// ============================================================

// ---- ingest -------------------------------------------------
function handleIngest_(rec) {
  var v = validateRecord_(rec);
  if (!v.ok) {
    // Could not be trusted as data — quarantine to /failed/.
    quarantine_(rec || {}, v.reason);
    return { status: 'error', reason: v.reason, disposition: 'failed' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(ENTRIES_SHEET);
  if (!sheet) throw new Error('missing_sheet: ' + ENTRIES_SHEET);

  var result = dedupAndWrite_(sheet, rec);

  // Successfully handled — move the source file out of /inbox/.
  var processedUrl = '';
  try {
    processedUrl = moveToFolder_(rec.source_file_id, getFolderId_(PROP_FOLDER.processed));
  } catch (err) {
    // The row is written; record that the move failed but do not fail
    // the whole call. The runner's manifest check prevents reprocessing.
    auditLog_('ingest', 'move_warning', rec, result.entryId,
              'row written but file move failed: ' + err);
  }

  // Backfill the processed-file URL into column K if we have it.
  if (processedUrl && result.rowIndex) {
    sheet.getRange(result.rowIndex, COL.ATTACH_URL + 1).setValue(processedUrl);
  }

  appendManifest_(rec, result.status, result.entryId);
  appendRunLog_('• ' + result.status + ' — ' + rec.source_filename +
                ' → ' + result.entryId);
  auditLog_('ingest', result.status, rec, result.entryId, v.note || '');

  return { status: result.status, entry_id: result.entryId, disposition: 'processed' };
}

// ---- runner-side failure -----------------------------------
// The runner failed before it could build a valid record (parse
// error, web fetch failed, taxonomy mapping failed, ambiguous data).
function handleFail_(body) {
  var rec = {
    source_file_id: body.source_file_id,
    source_filename: body.source_filename || 'unknown',
    source_hash: body.source_hash || ''
  };
  var reason = body.reason || 'unspecified';
  quarantine_(rec, reason);
  return { status: 'ok', disposition: 'failed', reason: reason };
}

// ---- validation --------------------------------------------
// Returns { ok:true } or { ok:false, reason:'...' }.
function validateRecord_(rec) {
  if (!rec || typeof rec !== 'object') return { ok: false, reason: 'missing_record' };
  if (!rec.source_file_id)  return { ok: false, reason: 'missing_source_file_id' };
  if (!rec.source_filename) return { ok: false, reason: 'missing_source_filename' };
  if (!rec.source_hash)     return { ok: false, reason: 'missing_source_hash' };

  if (!rec.title || String(rec.title).trim() === '')
    return { ok: false, reason: 'missing_title' };
  if (!rec.organiser || String(rec.organiser).trim() === '')
    return { ok: false, reason: 'missing_organiser' };

  if (parseDate_(rec.event_date) === null)
    return { ok: false, reason: 'bad_event_date' };

  var mins = Number(rec.duration_minutes);
  if (!isFinite(mins) || mins <= 0)
    return { ok: false, reason: 'bad_duration_minutes' };

  if (!Array.isArray(rec.themes) || rec.themes.length === 0)
    return { ok: false, reason: 'missing_themes' };
  for (var i = 0; i < rec.themes.length; i++) {
    if (CATEGORIES.indexOf(rec.themes[i]) === -1)
      return { ok: false, reason: 'theme_not_in_taxonomy: ' + rec.themes[i] };
  }
  return { ok: true };
}

// ---- dedup + write -----------------------------------------
function dedupAndWrite_(sheet, rec) {
  var logicalKey = makeLogicalKey_(rec);
  var lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLUMNS).getValues();

    // (a) identical source file already ingested -> skip.
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][COL.SOURCE_HASH]) === String(rec.source_hash) &&
          String(rec.source_hash) !== '') {
        return {
          status: 'skipped_identical',
          entryId: values[i][COL.ID],
          rowIndex: i + 2
        };
      }
    }
    // (b) same logical key, different file -> additive merge.
    for (var j = 0; j < values.length; j++) {
      if (String(values[j][COL.LOGICAL_KEY]) === logicalKey && logicalKey !== '') {
        mergeRow_(sheet, j + 2, values[j], rec);
        return {
          status: 'merged',
          entryId: values[j][COL.ID],
          rowIndex: j + 2
        };
      }
    }
  }

  // (c) new -> append.
  var entryId = 'CPD_' + Date.now();
  var row = buildRow_(entryId, rec, logicalKey);
  sheet.appendRow(row);
  return { status: 'created', entryId: entryId, rowIndex: sheet.getLastRow() };
}

// Build a full 18-cell row for a new entry.
function buildRow_(entryId, rec, logicalKey) {
  var now = new Date();
  var row = new Array(TOTAL_COLUMNS).fill('');
  row[COL.ID]           = entryId;
  row[COL.DATE]         = parseDate_(rec.event_date);
  row[COL.TITLE]        = String(rec.title).trim();
  row[COL.PROVIDER]     = String(rec.organiser).trim();
  row[COL.CATEGORY]     = rec.themes[0];                       // primary theme
  row[COL.ROLE]         = '';                                   // left blank by design
  row[COL.CPD_TYPE]     = '';                                   // left blank by design
  row[COL.HOURS]        = Math.round((Number(rec.duration_minutes) / 60) * 100) / 100;
  row[COL.DESCRIPTION]  = rec.summary ? String(rec.summary).trim() : '';
  row[COL.ATTACH_NAME]  = rec.source_filename;
  row[COL.ATTACH_URL]   = '';                                   // backfilled after file move
  row[COL.LINK_URL]     = rec.source_url ? String(rec.source_url).trim() : '';
  row[COL.TAGS]         = rec.themes.join(', ');
  row[COL.CREATED]      = now;                                  // first_recorded
  row[COL.LAST_UPDATED] = now;
  row[COL.SOURCE_HASH]  = rec.source_hash;
  row[COL.LOGICAL_KEY]  = logicalKey;
  row[COL.REVISIONS]    = 0;
  return row;
}

// Additive merge: fill only EMPTY base cells (A-N) from the new
// record; never overwrite a value already present. Bump Revisions
// and Last_Updated. The original Source_Hash is kept.
function mergeRow_(sheet, rowIndex, existing, rec) {
  var candidates = {};
  candidates[COL.PROVIDER]    = String(rec.organiser || '').trim();
  candidates[COL.CATEGORY]    = rec.themes[0];
  candidates[COL.HOURS]       = Math.round((Number(rec.duration_minutes) / 60) * 100) / 100;
  candidates[COL.DESCRIPTION] = rec.summary ? String(rec.summary).trim() : '';
  candidates[COL.ATTACH_NAME] = rec.source_filename;
  candidates[COL.LINK_URL]    = rec.source_url ? String(rec.source_url).trim() : '';
  candidates[COL.TAGS]        = rec.themes.join(', ');

  var filled = [];
  Object.keys(candidates).forEach(function (idx) {
    var c = Number(idx);
    var current = existing[c];
    var isEmpty = (current === '' || current === null || current === undefined);
    if (isEmpty && candidates[c] !== '' && candidates[c] !== null) {
      sheet.getRange(rowIndex, c + 1).setValue(candidates[c]);
      filled.push(c);
    }
  });

  var revisions = Number(existing[COL.REVISIONS] || 0) + 1;
  sheet.getRange(rowIndex, COL.REVISIONS + 1).setValue(revisions);
  sheet.getRange(rowIndex, COL.LAST_UPDATED + 1).setValue(new Date());

  // The merge detail (which fields were filled, and the new file's
  // hash) is preserved in the _audit tab by the caller.
  return { filledColumns: filled, revisions: revisions };
}

// ---- normalisation -----------------------------------------
// logical_key = normalised(event_date) | normalised(organiser) | normalised(title)
function makeLogicalKey_(rec) {
  var d = parseDate_(rec.event_date);
  var dateIso = d ? Utilities.formatDate(d, 'Europe/London', 'yyyy-MM-dd') : '';
  return [dateIso, normaliseText_(rec.organiser), normaliseText_(rec.title)].join('|');
}

// lower-case, strip punctuation, collapse whitespace.
function normaliseText_(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Accepts ISO yyyy-mm-dd, dd/mm/yyyy, or anything Date can parse.
// Returns a Date (midnight) or null.
function parseDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? null : value;
  }
  var s = String(value).trim();

  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    var dIso = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(dIso.getTime()) ? null : dIso;
  }
  var dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    var dDmy = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(dDmy.getTime()) ? null : dDmy;
  }
  var fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}
