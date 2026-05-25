// ============================================================
// Import.gs — removed (AI extraction retired)
// ============================================================
// The AI-powered CPD extraction (Claude API) that used to live here
// — extractCpdFromUrl(), extractCpdFromFile(), callClaude_() — has
// been replaced by the CPD Agenda Pipeline.
//
// Agendas are now queued to /CPD-Inbox/inbox/ by AgendaQueue.gs and
// processed by the scheduled Cowork pipeline task, instead of
// costing Anthropic API credits on every import.
//
// This file is intentionally left as an empty placeholder. It can be
// deleted from the project entirely; the previous implementation
// remains in git history if it is ever needed again.
//
// Note: the ANTHROPIC_API_KEY / ANTHROPIC_MODEL Script Properties are
// no longer used and may be removed from Project Settings.
