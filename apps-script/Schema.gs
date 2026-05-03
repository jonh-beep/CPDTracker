// ============================================================
// Schema constants — sheet names, column layout, reference lists
// ============================================================
// Apps Script concatenates all .gs files at runtime, so these
// constants are visible to every other file in the project.

const SHEET_NAME = 'CPD_Entries';
const SETTINGS_SHEET = 'Settings';
const AUDIT_SHEET = 'CPD_Audit';
const FOLDER_NAME = 'CPD Tracker Attachments';

const ENTRY_HEADERS = [
  'ID', 'Date', 'Title', 'Description', 'Category',
  'Type', 'Hours', 'Provider', 'Role',
  'EPMI_Relevant', 'MasterTrust_Relevant',
  'Links', 'Attachments', 'Notes', 'Created', 'Modified'
];

const AUDIT_HEADERS = [
  'Timestamp', 'Actor', 'Action', 'EntryID', 'Field', 'OldValue', 'NewValue'
];

const CATEGORIES = [
  'Pensions Law & Legislation',
  'Investment & Financial',
  'Governance & Risk',
  'Administration & Operations',
  'Technology & Cyber',
  'ESG & Responsible Investment',
  'Member Outcomes & Communications',
  'DC & Master Trust Specific',
  'Pensions Dashboard',
  'Professional Development',
  'Industry Events & Networking',
  'Other'
];

const TYPES = [
  'Structured – Course / Webinar',
  'Structured – Conference',
  'Structured – Formal Training',
  'Unstructured – Reading / Research',
  'Unstructured – Peer Discussion',
  'Unstructured – Industry Group',
  'On-the-Job Learning',
  'Speaking / Presenting',
  'Other'
];

function getCategories() {
  assertAllowedUser_();
  return CATEGORIES;
}

function getTypes() {
  assertAllowedUser_();
  return TYPES;
}
