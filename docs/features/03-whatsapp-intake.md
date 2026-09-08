# 3. WhatsApp as a reporting channel

**Status:** implemented · **Effort:** M · **Changes:** who will actually use it

## What the giants do

WhatsApp is not a nice-to-have channel in this region. Penetration is near
total — 97% in Kenya, 96% in South Africa — with over 100 million users across
the continent, and 80% of large enterprises are expected to have the WhatsApp
Business API in their support stack by 2026. Deployments report FAQ bots
handling 60–80% of common queries with no human involved
([ChakraHQ](https://chakrahq.com/article/top-10-whatsapp-api-solutions-in-africa-2026/),
[Arkesel](https://arkesel.com/ai-chatbot-whatsapp-business-africa/),
[YCloud statistics](https://www.ycloud.com/blog/whatsapp-statistics-for-businesses)).

## What is missing

Outbound only: email via `services/notify.js` and SMS via
`services/sms.js` (Africa's Talking). Nothing inbound. Every ticket requires a
teacher to open a browser, remember a password, and fill a nine-field form.

That form is good. It is also the single largest adoption barrier in the
system, and no amount of polish removes it — the teacher is already in WhatsApp
and is not going to leave it to file a form.

## Design

### The flow

```
teacher: photo of the router + "wifi haiwaki tangu asubuhi"
   │
   ▼  POST /api/whatsapp/webhook   (HMAC over the raw body, per request)
   │
   ├─ known number? → resolve school + reporter from users/teachers
   │  unknown?      → ask for the school code once, then remember it
   │
   ├─ the assistant answers with the first steps, in the language written,
   │  and the offer to log it rides on the SAME message
   │
   └─ "ndio" / "yes" → errors row, intake_channel='whatsapp'
```

### Why the AI answers first

The assistant already has the guides, the manuals and the school's own open
faults as context (feature: `aiChatController`). Half of what arrives will be
"tablet won't charge", which guide 2 answers in seven steps. Answering first
and filing second is what turns the channel into deflection rather than a
firehose — and it is the mechanism behind the 60–80% figures above.

The ticket is still offered every time, and always on request. Deflection must
never mean "harder to reach a human".

### Identity, honestly

A phone number is not authentication. So:

- A number matched to a `users.phone` or a teacher record files as that person.
- An unmatched number can file **only** against a school code it supplies, the
  ticket is marked `reporter_role = 'whatsapp-unverified'`, and it cannot read
  anything back — no ticket lists, no school data, no other people's faults.
- Nothing sensitive is ever pushed to an unverified number.

### Language

The assistant already mirrors the language of the question, refusals included.
WhatsApp is where that matters most: this is the channel where people write
Swahili, or Swahili mixed with English technical words, and it is already
handled.

### Vendor

Africa's Talking is already integrated for SMS and offers WhatsApp, so the
account, billing and support relationship exist. Worth confirming their
template-approval turnaround before committing — Meta's 24-hour customer
service window and template rules apply whoever the provider is, and they shape
what can be sent unprompted.

### Cost control

Inbound is free within the service window; outbound outside it needs an
approved template and costs per message. So: reply inside the window, use
templates only for the notifications SMS already sends, and never for chat.

## Not built

- A menu-driven bot ("reply 1 for WiFi"). People write sentences; the assistant
  reads sentences.
- WhatsApp as a read channel for ticket lists or reports. The web app is the
  read surface; that boundary keeps the identity story honest.
- Voice notes in the first pass. Common here and worth adding, but
  transcription is a separate dependency. An audio message gets a plain reply
  asking for text instead of being silently ignored.
- **Attaching the photo to the ticket.** `whatsapp.fetchMedia()` is written and
  the conversation draft records the `media_id`, but nothing yet pushes the
  bytes to Cloudinary — and it cannot be verified without real Meta
  credentials, since the download goes through graph.facebook.com. The caption
  is captured today; the image is not. Left explicitly unwired rather than
  shipped untested.

## What testing changed about the design

**One inbound message, one reply.** The school-code step originally sent two
messages — an acknowledgement, then the answer. Every WhatsApp message is billed
and notifies the recipient, so that is a real cost, not a style question. It
also made the flow race against itself: the acknowledgement landed while the
assistant call for the answer was still running. Now the acknowledgement is a
prefix on the single reply.

**A voice note is media, but it is not readable.** The unsupported-kind guard
was written as "no text and not media", which let an audio message through
because audio *is* media — and it reached the assistant as an empty question.
A photo stands on its own because it shows the fault; a voice note or bare
document does not. The guard is now "no text and not an image".

**"I do not recognise this number" was wrong for staff.** An admin or sub-admin
covers several schools, so they have no single `school_id` and must be asked
which school — but they were told their number was unrecognised, which is both
false and alarming. Verified numbers now get a plain "Which school is this
about?".

**Students blocked from the platform is high, not medium.** "wanafunzi hawawezi
kutumia Quest" landed on `medium` — a 72-hour target for a class that cannot
work today. Teaching stopped is high whoever counted the students, so that
wording now routes to `high` in both languages.

Two things about testing itself, since they will matter next time:

- The endpoint acknowledges before processing, because Meta retries anything
  slower, and the assistant step is a real network call taking seconds. A fixed
  sleep in the suite was a coin flip; it now waits for the reply to be recorded
  and for the count to stop rising.
- `new RegExp(undefined)` is `/(?:)/` and matches everything, so one assertion
  passed even when no ticket had been filed. Worth remembering as a class of
  false green.

## Verification plan

- Signature verification rejects a forged webhook.
- A known number files a ticket end to end, photo attached, correct school and
  reporter.
- An unknown number is asked for a school code once, then remembered.
- An unverified number cannot retrieve any ticket or school data.
- A Swahili message gets a Swahili reply; a mixed message gets a mixed reply.
- A duplicate webhook delivery (Meta retries) does not file two tickets —
  dedupe on the provider message id.
- Measured: how many conversations end without a ticket, which is the number
  the feature is for.
