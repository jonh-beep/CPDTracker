// ============================================================
// Auth — single-user allowlist
// ============================================================

const ALLOWED_USERS = [
  'darcybeans@googlemail.com'
];

function assertAllowedUser_() {
  const email = Session.getActiveUser().getEmail();
  if (!email || ALLOWED_USERS.indexOf(email) === -1) {
    throw new Error('Not authorised');
  }
}

// Returns the signed-in user's email as a plain string.
// Called by the frontend header to display "Signed in as …"
function getCurrentUser() {
  assertAllowedUser_();
  return Session.getActiveUser().getEmail();
}
