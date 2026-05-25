// ============================================================
// AgendaQueue — send agendas to the CPD Agenda Pipeline inbox
// ============================================================
// Replaces the old AI extraction (Import.gs). Instead of calling
// the Claude API (which costs credits), the app drops the agenda
// straight into the pipeline's Drive inbox:
//
//   - a URL  -> saved as a small .txt file containing the URL
//   - a file -> the uploaded PDF / screenshot itself
//
// The scheduled Cowork pipeline task picks the file up on its next
// run (weekdays 19:00), extracts the CPD details, and writes the
// row into CPD_Entries. Nothing in this file costs API credits.
//
// Folder layout (created by the pipeline's own setup()):
//   /CPD-Inbox/inbox/   <- files are dropped here

var PIPELINE_ROOT_FOLDER  = 'CPD-Inbox';
var PIPELINE_INBOX_FOLDER = 'inbox';

// Resolve the /CPD-Inbox/inbox/ folder, caching its ID in Script
// Properties so we do not pay a Drive search on every call.
// Throws a clear error if the pipeline folders do not exist yet.
function getPipelineInboxFolder_() {
  var props = PropertiesService.getScriptProperties();
  var cached = props.getProperty('PIPELINE_INBOX_ID');
  if (cached) {
    try { return DriveApp.getFolderById(cached); } catch (e) { /* re-resolve */ }
  }

  var roots = DriveApp.getFoldersByName(PIPELINE_ROOT_FOLDER);
  if (!roots.hasNext()) {
    throw new Error('Pipeline folder "/' + PIPELINE_ROOT_FOLDER +
      '/" not found in Drive. Has the CPD Agenda Pipeline been set up?');
  }
  var inboxes = roots.next().getFoldersByName(PIPELINE_INBOX_FOLDER);
  if (!inboxes.hasNext()) {
    throw new Error('Pipeline folder "/' + PIPELINE_ROOT_FOLDER + '/' +
      PIPELINE_INBOX_FOLDER + '/" not found. Has the pipeline been set up?');
  }
  var inbox = inboxes.next();
  props.setProperty('PIPELINE_INBOX_ID', inbox.getId());
  return inbox;
}

// Called by the frontend: queue a web address.
// Writes a .txt file containing just the URL into the pipeline inbox.
function queueAgendaUrl(url) {
  assertAllowedUser_();
  try {
    url = String(url || '').trim();
    if (!/^https?:\/\/\S+/i.test(url)) {
      return { error: 'Enter a valid web address starting with http:// or https://' };
    }
    var inbox = getPipelineInboxFolder_();
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
    var name = 'agenda-url-' + stamp + '.txt';
    var file = inbox.createFile(name, url, 'text/plain');
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    return { success: true, name: name, kind: 'url' };
  } catch (err) {
    return { error: err.message };
  }
}

// Called by the frontend: queue an uploaded file.
// base64Data: raw base64 (no data: prefix)
// mimeType:   'application/pdf' | 'image/png' | 'image/jpeg' | ...
function queueAgendaFile(base64Data, mimeType, fileName) {
  assertAllowedUser_();
  try {
    if (!base64Data) return { error: 'No file data was received.' };
    mimeType = String(mimeType || '');
    var ok = mimeType === 'application/pdf' || mimeType.indexOf('image/') === 0;
    if (!ok) return { error: 'Queue a PDF, JPEG, or PNG.' };

    var inbox = getPipelineInboxFolder_();
    var decoded = Utilities.base64Decode(base64Data);
    var safeName = String(fileName || 'agenda').replace(/[\/\\]/g, '_');
    var blob = Utilities.newBlob(decoded, mimeType, safeName);
    var file = inbox.createFile(blob);
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    return { success: true, name: file.getName(), kind: 'file' };
  } catch (err) {
    return { error: err.message };
  }
}
