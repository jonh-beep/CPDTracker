// ============================================================
// Attachments — Drive uploads, hardened to private
// ============================================================

function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(FOLDER_NAME);
}

// Called by the frontend as: uploadFile(base64String, mimeType, fileName)
// Returns { url, name } which the frontend uses to populate the entry.
function uploadFile(base64Data, mimeType, fileName) {
  assertAllowedUser_();
  try {
    const folder = getOrCreateFolder();
    const decoded = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decoded, mimeType, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    return {
      success: true,
      fileId: file.getId(),
      name: file.getName(),
      url: 'https://drive.google.com/file/d/' + file.getId() + '/view'
    };
  } catch (err) {
    return { error: err.message };
  }
}

function deleteFile(fileId) {
  assertAllowedUser_();
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

// One-shot maintenance: revoke ANYONE_WITH_LINK on pre-existing attachments.
// Run manually from the Apps Script editor after the first deploy.
function lockdownExistingAttachments_() {
  assertAllowedUser_();
  const folder = getOrCreateFolder();
  const files = folder.getFiles();
  let count = 0;
  while (files.hasNext()) {
    files.next().setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    count++;
  }
  return { success: true, lockedDown: count };
}
