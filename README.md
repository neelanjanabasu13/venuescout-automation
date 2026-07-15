# VenueScout Automation

Finding a party venue means opening a dozen tabs, emailing half of them, and losing track of who replied. VenueScout is for anyone doing that kind of outreach research — it watches a Notion database of venue leads and turns each promising one into a ready-to-send Gmail draft, so the tedious part (writing a personalised first email) is done before you sit down. It drafts only; a human still reviews and hits send.

## How to use

Add a venue to Notion with `Outreach Status = NEW`. Within about five minutes the script drafts a personalised email (or a manual-send fallback if there's no direct contact email) and updates the record to `DRAFTED`. If something fails, the record becomes `ERROR` with details in `Sync Error` — fix it and reset the status to `NEW` to retry. `SENT` stays a human-approved terminal state; this automation never sends mail on its own.

**Required Notion properties** (exact names):

| Property | Notion type | Purpose |
| --- | --- | --- |
| `Venue Name` | Title | Venue name |
| `Contact Email` | Email | Direct email recipient |
| `Contact URL` | URL | Form/page fallback when email is missing |
| `Venue Detail` | Rich text | Personalisation detail for the email |
| `Outreach Status` | Select | `NEW`, `DRAFTED`, `ERROR`, `SENT` |
| `Draft Subject` / `Draft Body` | Rich text | Generated email content |
| `Gmail Draft ID` | Rich text | Gmail draft identifier |
| `Sync Error` | Rich text | Failure details |
| `Last Synced At` | Date | Last execution timestamp |

**Setup:**

1. Create a Notion integration, copy its internal integration token, and share the target database with it.
2. Create a Google Apps Script project and add `Code.gs` and `appsscript.json` from this repo.
3. In Apps Script **Project Settings > Script properties**, add `NOTION_TOKEN`, `NOTION_DB_ID`, `OWNER_NAME`, `OWNER_EMAIL`, `OWNER_PHONE`, `PARTY_DATE_OPTIONS`.
4. Run `syncNewVenuesToDrafts` once and approve the Gmail/Notion/trigger permissions.
5. Run `createFiveMinuteTrigger` once to schedule recurring sync.

Before enabling a full batch: add one test venue as `NEW`, run `syncNewVenuesToDrafts` manually, and confirm a Gmail draft plus a clean `DRAFTED` record before turning on the five-minute trigger.

## How it's built

Google Apps Script (`Code.gs`) as the runtime, polling the Notion REST API on a five-minute trigger, and Gmail's built-in `GmailApp` service to create — never send — drafts. No third-party email middleware, no stored credentials beyond Apps Script's own Script Properties.

## Security

Never commit Script Properties, Notion tokens, or Gmail credentials. Treat any token pasted into chat or source control as compromised and rotate it immediately.

## Build story

Read the full story: [Building an AI agent to find my toddler's birthday party venue](https://neelanjana.substack.com/p/building-an-ai-agent-to-find-my-toddlers)

---

Built with AI tools (Lovable, Claude, Codex). My work here is the product thinking: the spec, the scope decisions, and the iteration.
