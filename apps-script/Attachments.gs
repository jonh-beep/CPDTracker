// ============================================================
// Attachments — Drive uploads, hardened to private
// ============================================================
// New uploads are PRIVATE / NONE. The owner (the script's deploying
// user) is the only one who can open them via Drive's normal viewer
// auth. There is no public link.

function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(FOLDER_NAME);
}

function uploadFile(fileData) {
  assertAllowedUser_();
  try {
    const folder = getOrCreateFolder();
    const decoded = Utilities.base64Decode(fileData.base64);
    const blob = Utilities.newBlob(decoded, fileData.mimeType, fileData.name);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    return {
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      viewUrl: 'https://drive.google.com/file/d/' + file.getId() + '/view'
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

// One-shot maintenance: flip every file in the attachments folder to
// PRIVATE. Run manually from the Apps Script editor after the first
// deploy of this hardened code, to revoke any pre-existing public
// links granted by the old uploadFile().
function lockdownExistingAttachments_() {
  assertAllowedUser_();
  const folder = getOrCreateFolder();
  const files = folder.getFiles();
  let count = 0;
  while (files.hasNext()) {
    const f = files.next();
    f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    count++;
  }
  return { success: true, lockedDown: count };
}
