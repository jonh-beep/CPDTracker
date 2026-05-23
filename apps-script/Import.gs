// ============================================================
// Import — AI-powered CPD extraction via Claude API
// ============================================================
// API key and model stored in Script Properties (not in git).
// To configure: Apps Script editor → Project Settings →
//   Script Properties → add ANTHROPIC_API_KEY
// Optional: add ANTHROPIC_MODEL to override the default model.

var ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
var DEFAULT_CLAUDE_MODEL = 'claude-3-5-haiku-20241022';

// Called by the frontend when the user submits a URL.
function extractCpdFromUrl(url) {
  assertAllowedUser_();
  try {
    var resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (resp.getResponseCode() !== 200) {
      return { error: 'Could not fetch URL (HTTP ' + resp.getResponseCode() + '). Try saving the page as a PDF and uploading that instead.' };
    }
    var html = resp.getContentText('UTF-8');

    // Strip scripts, styles, and tags to get readable plain text.
    var text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000);

    return callClaude_([{
      type: 'text',
      text: 'Source URL: ' + url + '\n\nPage content:\n' + text
    }]);
  } catch (err) {
    return { error: err.message };
  }
}

// Called by the frontend when the user uploads a file (image or PDF).
// base64Data: raw base64 string (no data: prefix)
// mimeType:   e.g. 'application/pdf', 'image/jpeg', 'image/png'
function extractCpdFromFile(base64Data, mimeType) {
  assertAllowedUser_();
  try {
    var content;
    if (mimeType === 'application/pdf') {
      content = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64Data }
        },
        { type: 'text', text: 'Extract CPD information from this document.' }
      ];
    } else if (mimeType.indexOf('image/') === 0) {
      content = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64Data }
        },
        { type: 'text', text: 'Extract CPD information from this image.' }
      ];
    } else {
      return { error: 'Unsupported file type. Please upload a PDF, JPEG, or PNG.' };
    }
    return callClaude_(content);
  } catch (err) {
    return { error: err.message };
  }
}

function callClaude_(content) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return { error: 'ANTHROPIC_API_KEY not configured. Open the Apps Script editor → Project Settings → Script Properties and add it.' };
  }
  var model = props.getProperty('ANTHROPIC_MODEL') || DEFAULT_CLAUDE_MODEL;

  var systemPrompt =
    'You extract CPD (Continuing Professional Development) event information for a UK pension trustee.\n' +
    'The user holds two roles: EPMI (pension fund governance) and Master Trust Trustee (Aon MasterTrust, since July 2025).\n\n' +
    'Return ONLY a valid JSON object — no markdown fences, no explanation.\n' +
    'If a field cannot be determined, use an empty string or 0 for duration.\n\n' +
    'Required fields:\n' +
    '  title        - event or activity name\n' +
    '  date         - YYYY-MM-DD (best guess from document; empty if not found)\n' +
    '  provider     - who organised or delivered it\n' +
    '  category     - MUST be one of: Governance & Trusteeship | Investments & ESG | DC Pensions & Master Trusts | Administration & Technology | Legal & Regulatory | Member Communications | Cyber Security & Data | Financial Management | Equality, Diversity & Inclusion | Industry Events & Networking | Other\n' +
    '  cpdType      - "Structured" (formal training/webinar/conference with defined agenda) or "Unstructured" (reading, networking, informal)\n' +
    '  duration     - decimal hours (e.g. 1.5); estimate from agenda/schedule length if not stated explicitly\n' +
    '  description  - 2-3 sentences on what was covered and its relevance to UK pension governance\n' +
    '  roleContext  - "EPMI" or "Master Trust" or "Both"\n' +
    '  linkUrl      - source URL if one was provided, otherwise empty string\n' +
    '  tags         - comma-separated keywords, max 5 (e.g. "TPR, ESG, fiduciary duty")';

  var payload = {
    model: model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: content }]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var resp = UrlFetchApp.fetch(ANTHROPIC_API_URL, options);
  var code = resp.getResponseCode();
  var body = resp.getContentText();

  if (code !== 200) {
    var errObj = {};
    try { errObj = JSON.parse(body); } catch (e) {}
    return { error: 'Claude API error ' + code + ': ' + (errObj.error ? errObj.error.message : body.slice(0, 200)) };
  }

  var result = JSON.parse(body);
  var rawText = result.content && result.content[0] ? result.content[0].text : '';

  // Strip any accidental markdown fences
  rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    var extracted = JSON.parse(rawText);
    return { success: true, entry: extracted };
  } catch (e) {
    return { error: 'Could not parse AI response. Raw output: ' + rawText.slice(0, 300) };
  }
}
