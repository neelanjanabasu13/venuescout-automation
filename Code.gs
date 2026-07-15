/**
 * VenueScout Notion -> Gmail Draft Sync
 *
 * Purpose:
 * - Detect NEW venue rows in a Notion database
 * - Generate outreach draft text
 * - Create Gmail draft
 * - Write draft back to Notion (subject/body + status + draft ID)
 *
 * Required Script Properties:
 * - NOTION_TOKEN      (internal integration token, starts with "secret_")
 * - NOTION_DB_ID      (Notion database ID containing venue rows)
 * - OWNER_NAME        (sender name, e.g. "Alex Smith")
 * - OWNER_EMAIL       (sender email and fallback recipient for manual-send drafts)
 * - OWNER_PHONE       (sender phone number)
 * - PARTY_DATE_OPTIONS (optional; newline-separated preferred dates)
 *
 * Required Notion properties (exact names):
 * - Venue Name         (title)
 * - Contact Email      (email)
 * - Contact Method     (select)    // optional but recommended
 * - Contact URL        (url)       // optional but recommended
 * - Venue Detail       (rich_text) // one specific personalization detail
 * - Outreach Status    (select)    // values: NEW, DRAFTED, ERROR, SENT
 * - Draft Subject      (rich_text)
 * - Draft Body         (rich_text)
 * - Gmail Draft ID     (rich_text)
 * - Sync Error         (rich_text)
 * - Last Synced At     (date)
 */

const NOTION_VERSION = "2022-06-28";
const STATUS_NEW = "NEW";
const STATUS_DRAFTED = "DRAFTED";
const STATUS_ERROR = "ERROR";

function syncNewVenuesToDrafts() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("Could not acquire lock; another sync may be running.");
  }

  try {
    const cfg = getConfig_();
    let cursor = null;
    let processed = 0;

    do {
      const query = {
        page_size: 50,
        ...(cursor ? { start_cursor: cursor } : {}),
        filter: {
          property: "Outreach Status",
          select: { equals: STATUS_NEW }
        }
      };

      const res = notionRequest_(
        "POST",
        `/v1/databases/${cfg.dbId}/query`,
        query
      );

      for (const page of res.results || []) {
        processed++;
        processVenuePage_(cfg, page);
      }

      cursor = res.has_more ? res.next_cursor : null;
    } while (cursor);

    Logger.log(`Sync finished. Processed NEW rows: ${processed}`);
  } finally {
    lock.releaseLock();
  }
}

function processVenuePage_(cfg, page) {
  const p = page.properties || {};
  const venueName = getTitle_(p["Venue Name"]) || "Venue";
  const email = (p["Contact Email"] && p["Contact Email"].email) || "";
  const contactUrl = (p["Contact URL"] && p["Contact URL"].url) || "";
  const detail = getRichText_(p["Venue Detail"]) || "your venue looks like a good fit for a 4th birthday";

  try {
    const draft = buildDraft_(cfg, venueName, detail, email, contactUrl);
    const gmailDraft = GmailApp.createDraft(draft.to, draft.subject, draft.body);
    const draftId = gmailDraft.getId();

    notionRequest_("PATCH", `/v1/pages/${page.id}`, {
      properties: {
        "Outreach Status": { select: { name: STATUS_DRAFTED } },
        "Draft Subject": { rich_text: [{ type: "text", text: { content: truncate_(draft.subject, 1900) } }] },
        "Draft Body": { rich_text: [{ type: "text", text: { content: truncate_(draft.body, 1900) } }] },
        "Gmail Draft ID": { rich_text: [{ type: "text", text: { content: draftId } }] },
        "Sync Error": { rich_text: [] },
        "Last Synced At": { date: { start: new Date().toISOString() } }
      }
    });
  } catch (err) {
    notionRequest_("PATCH", `/v1/pages/${page.id}`, {
      properties: {
        "Outreach Status": { select: { name: STATUS_ERROR } },
        "Sync Error": { rich_text: [{ type: "text", text: { content: truncate_(String(err), 1900) } }] },
        "Last Synced At": { date: { start: new Date().toISOString() } }
      }
    });
  }
}

function buildDraft_(cfg, venueName, venueDetail, email, contactUrl) {
  const dateLines = cfg.partyDateOptions
    .split("\n")
    .filter(Boolean)
    .map(date => `- ${date}`)
    .join("\n");

  const signoff =
    `\n\n${cfg.ownerName}\n` +
    `${cfg.ownerPhone}\n` +
    cfg.ownerEmail;

  if (email) {
    const subject = `${venueName} Birthday Party Enquiry - 4th Birthday (Mid-April 2026 Weekends)`;
    const body =
      `Hello ${venueName} Team,\n\n` +
      `I am planning a 4th birthday party and ${venueDetail}.\n\n` +
      `Could you please confirm weekend availability for:\n${dateLines}\n\n` +
      `We are currently comparing multiple venue quotes, so please share:\n` +
      `- All-in pricing (including food and any additional fees)\n` +
      `- Package options, duration, and inclusions\n` +
      `- What can be customized\n` +
      `- Cake policy and any cake-related charges\n` +
      `- Deposit/payment and cancellation terms` +
      signoff;
    return { to: email, subject, body };
  }

  const subject = `MANUAL SEND: ${venueName} outreach (email missing)`;
  const body =
    `Venue: ${venueName}\n` +
    `Contact email: Not published\n` +
    `Alternative contact URL: ${contactUrl || "Not published"}\n\n` +
    `Draft message to paste:\n\n` +
    `Hello ${venueName} Team,\n\n` +
    `I am planning a 4th birthday party and ${venueDetail}.\n\n` +
    `Could you please confirm weekend availability for:\n${dateLines}\n\n` +
    `We are currently comparing multiple venue quotes, so please share:\n` +
    `- All-in pricing (including food and any additional fees)\n` +
    `- Package options, duration, and inclusions\n` +
    `- What can be customized\n` +
    `- Cake policy and any related charges\n` +
    `- Deposit/payment and cancellation terms` +
    signoff;
  return { to: cfg.ownerEmail, subject, body };
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("NOTION_TOKEN");
  const dbId = props.getProperty("NOTION_DB_ID");
  const ownerName = props.getProperty("OWNER_NAME");
  const ownerEmail = props.getProperty("OWNER_EMAIL");
  const ownerPhone = props.getProperty("OWNER_PHONE");
  const partyDateOptions = props.getProperty("PARTY_DATE_OPTIONS");

  if (!token) throw new Error("Missing Script Property: NOTION_TOKEN");
  if (!dbId) throw new Error("Missing Script Property: NOTION_DB_ID");
  if (!ownerName) throw new Error("Missing Script Property: OWNER_NAME");
  if (!ownerEmail) throw new Error("Missing Script Property: OWNER_EMAIL");
  if (!ownerPhone) throw new Error("Missing Script Property: OWNER_PHONE");
  if (!partyDateOptions) throw new Error("Missing Script Property: PARTY_DATE_OPTIONS");
  return { token, dbId, ownerName, ownerEmail, ownerPhone, partyDateOptions };
}

function notionRequest_(method, path, bodyObj) {
  const { token } = getConfig_();
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true,
    payload: bodyObj ? JSON.stringify(bodyObj) : undefined
  };

  const res = UrlFetchApp.fetch(`https://api.notion.com${path}`, options);
  const code = res.getResponseCode();
  const text = res.getContentText();
  const json = text ? JSON.parse(text) : {};

  if (code < 200 || code >= 300) {
    throw new Error(`Notion API ${code}: ${text}`);
  }
  return json;
}

function getTitle_(prop) {
  if (!prop || !prop.title || !prop.title.length) return "";
  return prop.title.map(t => t.plain_text || "").join("").trim();
}

function getRichText_(prop) {
  if (!prop || !prop.rich_text || !prop.rich_text.length) return "";
  return prop.rich_text.map(t => t.plain_text || "").join("").trim();
}

function truncate_(s, n) {
  return s.length > n ? s.slice(0, n - 3) + "..." : s;
}

function createFiveMinuteTrigger() {
  const fn = "syncNewVenuesToDrafts";
  const triggers = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === fn);
  for (const t of triggers) ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger(fn).timeBased().everyMinutes(5).create();
}
