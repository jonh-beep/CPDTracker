// ============================================================
// Schema constants — sheet names, column layout, reference lists
// ============================================================
// Column names here match exactly what the frontend reads/writes.
// Do not rename them without updating index.html in step.

const SHEET_NAME = 'CPD_Entries';
const SETTINGS_SHEET = 'Settings';
const AUDIT_SHEET = 'CPD_Audit';
const FOLDER_NAME = 'CPD Tracker Attachments';

// 14-column entry schema — matches original spec and frontend field names
const ENTRY_HEADERS = [
  'ID',
  'Date',
  'Title',
  'Provider / Source',
  'Category',
  'Role Context',
  'CPD Type',
  'Duration (hours)',
  'Description / Impact',
  'Attachment Name',
  'Attachment URL',
  'Link URL',
  'Tags',
  'Created At'
];

const AUDIT_HEADERS = [
  'Timestamp', 'Actor', 'Action', 'EntryID', 'Field', 'OldValue', 'NewValue'
];

const CATEGORIES = [
  'Governance & Trusteeship',
  'Investments & ESG',
  'DC Pensions & Master Trusts',
  'Administration & Technology',
  'Legal & Regulatory',
  'Member Communications',
  'Cyber Security & Data',
  'Financial Management',
  'Equality, Diversity & Inclusion',
  'Industry Events & Networking',
  'Other'
];

const TYPES = [
  'Structured',
  'Unstructured'
];

function getCategories() {
  assertAllowedUser_();
  return CATEGORIES;
}

function getTypes() {
  assertAllowedUser_();
  return TYPES;
}
