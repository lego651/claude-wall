# Discord Monitoring Guide (Deferred)

*Discord monitoring is lower priority; S9 focuses on the email pipeline and public firm timelines / industry news. This guide is for when we pick up Discord.*

---

How Discord servers work, why prop firm channels aren’t “private” in the way you might think, and how we can monitor them (with and without a bot).

---

## 1. How Prop Firm Discords Usually Work

- Many prop firms (FundingPips, FXIFY, Funded Next, etc.) run **community Discord servers**. They’re “public” in the sense that **anyone with an invite link can join** (link is on their site, in emails, or on social).
- Inside the server:
  - **Public channels** (e.g. `#announcements`, `#news`, `#rules`) are visible to **all members** who joined with that invite.
  - **Private channels** exist too (role-only, e.g. “funded traders only”). Those are only visible to people with the right role.
- So: the **server** is often joinable by the public; **announcements** are usually in a channel every member can see. They’re not “private” in the sense of “only employees”; they’re “member-only” once you’ve joined.

---

## 2. Can We Automatically Read Those Channels?

**Only if we have a bot in the server.**

- Discord does **not** expose a public API to read a channel without being in the server.
- **Bots cannot join by themselves.** A server admin must **invite the bot** (OAuth2 flow). So we cannot unilaterally “subscribe” to a firm’s Discord; we need the firm (or a server admin) to add our bot and grant it access to the right channel(s).
- **User-account automation** (“self-bots”) is against Discord’s ToS and can get accounts banned. We don’t use that.

So:

- **With cooperation:** Firm invites our bot → we can read the channels we’re allowed to (e.g. `#announcements`) and automate ingestion.
- **Without cooperation:** We rely on **manual** ingestion: staff join the server as normal users and paste content into our upload UI (S8 flow). We can still mark `source_type = discord` and store a Discord message URL for traceability.

---

## 3. What We Need to Build a Monitoring Bot

If we want to **automate** when a firm invites us:

| Requirement | Details |
|-------------|--------|
| **Discord Application + Bot** | Create an app in [Discord Developer Portal](https://discord.com/developers/applications), add a Bot, get a **Bot Token**. |
| **Privileged intent: MESSAGE_CONTENT** | Required to read message text, embeds, attachments. Enable in Developer Portal → Bot → Privileged Gateway Intents. For bots in **100+ servers** Discord may require an approval request. |
| **Gateway intents** | At minimum: `Guilds`, `GuildMessages`, `MessageContent` so we receive `messageCreate` in the channels we’re in. |
| **Invite link** | We give the firm an OAuth2 invite URL with scopes `bot` and permissions like “Read Message History” and “View Channel” for the channels we need. They open it and add the bot to their server. |
| **Channel → firm mapping** | We need to know which Discord `guild_id` + `channel_id` corresponds to which `firm_id` in our DB (config or table). |

The bot then:

1. Connects to Discord (e.g. with `discord.js`).
2. Listens for `messageCreate` (and optionally `messageUpdate`) in configured channels.
3. For each new (or updated) message, calls our ingest API (e.g. `POST /api/admin/content/from-discord` or internal service) with message content, author, link, attachments.
4. Our API maps channel to `firm_id`, runs AI categorization (S8), and creates a `firm_content_items` row (draft) so staff can review and publish.

---

## 4. Are Those Channels “Private”?

- **From Discord’s perspective:** “Private” usually means **channel-level permissions**: only certain roles/users can see the channel. Many **announcement** channels are **not** private—they’re visible to all server members.
- **From our perspective:** They’re “private” in the sense that **we have no access** until:
  - (A) We join as a normal user and manually copy content, or  
  - (B) Someone with admin rights invites our **bot** and grants it read access to the channel.

So “private” = “we need either human action (manual paste) or an invite (bot)”—not “Discord gives public API access.”

---

## 5. Recommended Approach for Sprint 9

1. **Document and support the manual flow**
   - Use existing S8 upload with `source_type = discord`.
   - Optionally add a “Discord message URL” field so we store a link back to the message (traceability and UX).

2. **Add a small “Discord readiness” layer**
   - Table or config: `firm_id` ↔ `discord_guild_id` + `discord_channel_id` (and optional invite URL). So when a firm *does* invite our bot, we know where to listen and which firm to attach content to.

3. **Build the bot and ingest hook**
   - A small Node service (e.g. `scripts/discord-bot` or `lib/discord/`) that:
     - Reads channel→firm mapping from config/DB.
     - Subscribes to `messageCreate` (and optionally `messageUpdate`) for those channels.
     - Sends message payloads to our ingest API; API creates draft `firm_content_items` and runs AI (S8).
   - Ingest API can be an internal route or a server-to-server endpoint (e.g. with a shared secret or service key).

4. **Outreach (product / ops)**
   - When ready: ask prop firms to add our bot to their announcement channel(s), using the invite link we generate. Until then, we still benefit from the improved manual flow and the ability to turn on automation per firm when they agree.

---

## 6. Summary

| Question | Answer |
|----------|--------|
| Are prop firm Discords “private”? | Servers are joinable by link; announcement channels are often visible to all members. We still need either manual copy or a bot invite to read them. |
| Can we monitor without the firm’s help? | Only manually (staff paste from Discord into our UI). Automation requires the firm to invite our bot. |
| What do we need for a bot? | Discord app + bot token, MESSAGE_CONTENT intent, channel→firm mapping, and an ingest API the bot calls when new messages appear. |
| What’s in scope for S9? | Guide (this doc), channel→firm config, bot service, ingest endpoint, and better manual “from Discord” UX. |

This guide is the basis for the Sprint 9 plan and tickets below.
