// ============================================================
// Auth — single-user allowlist
// ============================================================
// Belt-and-braces with appsscript.json (access: MYSELF). The deployment
// setting blocks anonymous traffic; this allowlist blocks any future
// misconfig from accidentally widening access.

const ALLOWED_USERS = [
  'darcybeans@googlemail.com'
];

function assertAllowedUser_() {
  const email = Session.getActiveUser().getEmail();
  if (!email || ALLOWED_USERS.indexOf(email) === -1) {
    throw new Error('Not authorised');
  }
}

function getUserInfo() {
  assertAllowedUser_();
  const email = Session.getActiveUser().getEmail();
  return { email: email, name: email };
}
