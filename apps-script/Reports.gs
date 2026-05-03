// ============================================================
// Reports — filtered views over entries
// ============================================================

function getReportData(role, yearStartDate) {
  assertAllowedUser_();
  try {
    const entries = getAllEntries();
    if (entries.error) return entries;

    const startDate = new Date(yearStartDate);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

    const filtered = entries.filter(e => {
      const d = new Date(e.Date);
      const inRange = d >= startDate && d < endDate;
      if (!inRange) return false;
      if (role === 'EPMI') return e.EPMI_Relevant === 'Yes';
      if (role === 'MasterTrust') return e.MasterTrust_Relevant === 'Yes';
      return true;
    });

    const totalHours = filtered.reduce((sum, e) => sum + (parseFloat(e.Hours) || 0), 0);

    const byCategory = {};
    filtered.forEach(e => {
      const cat = e.Category || 'Uncategorised';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, hours: 0 };
      byCategory[cat].count++;
      byCategory[cat].hours += parseFloat(e.Hours) || 0;
    });

    const byType = {};
    filtered.forEach(e => {
      const t = e.Type || 'Other';
      if (!byType[t]) byType[t] = { count: 0, hours: 0 };
      byType[t].count++;
      byType[t].hours += parseFloat(e.Hours) || 0;
    });

    const byMonth = {};
    filtered.forEach(e => {
      const d = new Date(e.Date);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (!byMonth[key]) byMonth[key] = { count: 0, hours: 0 };
      byMonth[key].count++;
      byMonth[key].hours += parseFloat(e.Hours) || 0;
    });

    return {
      success: true,
      entries: filtered,
      summary: {
        totalEntries: filtered.length,
        totalHours: Math.round(totalHours * 10) / 10,
        byCategory: byCategory,
        byType: byType,
        byMonth: byMonth
      }
    };
  } catch (err) {
    return { error: err.message };
  }
}
