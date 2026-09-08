# 3. WhatsApp as a reporting channel

**Status:** designed · **Effort:** M · **Changes:** who will actually use it

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
   ▼  webhook POST /api/whatsapp/inbound   (signature-verified)
   │
   ├─ known number? → resolve school + reporter from users/teachers
   │  unknown?      → reply asking for the school code once, then remember it
   │
   ├─ the AI assistant answers with the first steps, in the language written
   │
   └─ "shall I log this for an engineer?" → yes → errors row + photo to Cloudinary
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
  transcription is a separate dependency.

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
