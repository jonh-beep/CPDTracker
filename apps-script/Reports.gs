// ============================================================
// Reports — filtered array of entries for the report view
// ============================================================
// Returns a plain array of entry objects (same shape as getEntries).
// The frontend does its own aggregation (totals, category breakdown).

function getReport(role, startDate, endDate) {
  assertAllowedUser_();
  try {
    const entries = getEntries();
    if (entries.error) return entries;

    const start = new Date(startDate);
    const end   = new Date(endDate);
    // Include the full end date (set to end of day)
    end.setHours(23, 59, 59, 999);

    return entries.filter(e => {
      const d = new Date(e['Date']);
      if (d < start || d > end) return false;
      if (!role || role === 'All') return true;
      const rc = e['Role Context'] || '';
      return rc === role || rc === 'Both';
    });
  } catch (err) {
    return { error: err.message };
  }
}
