# VenueScout Automation

An Apps Script automation that turns `NEW` venue records in a Notion database into Gmail drafts and writes the generated draft metadata back to Notion.

## What it does

1. Queries Notion for venue rows where `Outreach Status` is `NEW`.
2. Creates a personalised Gmail draft if `Contact Email` is present.
3. Creates a manual-send draft to the owner if contact email is missing, preserving the alternative contact URL and paste-ready message.
4. Updates the Notion record with draft subject, body, Gmail draft ID, sync time, and status.
5. Uses a script lock and a status transition (`NEW` to `DRAFTED` or `ERROR`) to avoid duplicate work.

## Required Notion properties

Use these exact property names:

| Property | Notion type | Purpose |
| --- | --- | --- |
| `Venue Name` | Title | Venue name |
| `Contact Email` | Email | Direct email recipient |
| `Contact URL` | URL | Form/page fallback when email is missing |
| `Venue Detail` | Rich text | Personalisation detail for the email |
| `Outreach Status` | Select | `NEW`, `DRAFTED`, `ERROR`, `SENT` |
| `Draft Subject` | Rich text | Generated subject |
| `Draft Body` | Rich text | Generated draft text |
| `Gmail Draft ID` | Rich text | Gmail draft identifier |
| `Sync Error` | Rich text | Failure details |
| `Last Synced At` | Date | Last execution timestamp |

`Contact Method` is optional but useful for reporting.

## Setup

1. Create a Notion integration, copy its internal integration token, and share the target database with it.
2. Create a Google Apps Script project and add `Code.gs` and `appsscript.json` from this repository.
3. In Apps Script **Project Settings > Script properties**, add:

| Key | Value |
| --- | --- |
| `NOTION_TOKEN` | Notion internal integration token |
| `NOTION_DB_ID` | Notion database ID |
| `OWNER_NAME` | Sender name |
| `OWNER_EMAIL` | Sender email / manual-send fallback recipient |
| `OWNER_PHONE` | Sender phone |
| `PARTY_DATE_OPTIONS` | Preferred dates, one date per line |

4. Run `syncNewVenuesToDrafts` once and approve Gmail, Notion API, and trigger permissions.
5. Run `createFiveMinuteTrigger` once to schedule recurring sync.

## Operating model

- Add a venue to Notion with `Outreach Status = NEW`.
- Within about five minutes, the script creates a Gmail draft and updates the Notion record to `DRAFTED`.
- If processing fails, the record becomes `ERROR`; inspect `Sync Error`, fix the data/configuration, then reset the status to `NEW`.
- Keep `SENT` as a human-approved terminal state. This script creates drafts only; it does not send email.

## Security

- Never commit Script Properties, Notion tokens, Gmail credentials, or production data.
- Treat any token copied into chat or source control as compromised and rotate it.
- The repository uses no third-party Gmail middleware; Gmail access is through Google Apps Script's built-in `GmailApp` service.

## Health check

Before enabling a large batch:

1. Add one test venue as `NEW`.
2. Run `syncNewVenuesToDrafts` manually.
3. Confirm one Gmail draft exists.
4. Confirm its Notion record has `DRAFTED`, a Gmail Draft ID, and no Sync Error.
5. Only then enable the five-minute trigger.
