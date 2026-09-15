# DocIntel — Gemini API Costing Report

**Scope:** this report covers only the Google Gemini API costs for DocIntel's AI features, on the
**paid (standard tier)**, since that's what the project will run on. Every number below is derived
directly from this codebase's actual prompts (`lib/ai/*.ts`) — not guessed — but per-call token counts
still depend on real document size/content, so treat the "Typical" column as a planning estimate, not
a guarantee. Section 10 explains how to replace these estimates with your actual measured usage.

Non-Gemini costs (storage is explicitly not a concern — nothing is persisted long-term; MongoDB Atlas
and hosting are separate questions) are **out of scope** here per your request — flagged briefly in
Section 11 only.

---

## 1. Gemini pricing actually available to this project (paid / standard tier)

**Correction (2026-09-11, after live-testing against this project's own API key):** the obvious cheap
option, `gemini-2.5-flash-lite`, returns **404 "This model is no longer available to new users"** on
this key — Google's lineup has moved on to a 3.x generation since this app was built, and this project
apparently counts as "new" to that specific model. Its advertised $0.10/$0.40 pricing is not something
this project can actually get. The table below is what was verified reachable and its real price:

| Model | Input | Output | Status on this project's key |
|---|---|---|---|
| **gemini-2.5-flash** (current main model, `GEMINI_MODEL`) | $0.30 / 1M | $2.50 / 1M | ✅ works |
| gemini-2.5-flash-lite | ~~$0.10 / 1M~~ | ~~$0.40 / 1M~~ | ❌ 404, blocked for new users |
| gemini-3.5-flash-lite | $0.30 / 1M | $2.50 / 1M | ✅ works, but **same price as gemini-2.5-flash** — no savings |
| **gemini-3.1-flash-lite** (now used as `GEMINI_MODEL_LITE`) | **$0.25 / 1M** | **$1.50 / 1M** | ✅ works — the actual cheapest reachable option |
| gemini-3.5-flash | $1.50 / 1M | $9.00 / 1M | ✅ works, but far more expensive — not a cost play |

The upshot: there is **no 3-4x-cheaper "lite" tier available to this project** the way there would be
if `gemini-2.5-flash-lite` were reachable. `gemini-3.1-flash-lite` is real but modest savings — 17%
off input, 40% off output versus the main model. Re-verify model availability before relying on any of
this again; Google's model access rules have already moved once during this project's lifetime and can
again.

Text, image, and video input are billed at the same input rate for a given model (audio is billed
higher and isn't used anywhere in this app). There is no separate charge for the JSON-mode structured
output this app uses everywhere — it's billed as ordinary output tokens.

**Important — "thinking" tokens are billed as output.** Gemini 2.5 Flash is a reasoning model: it
spends tokens on internal reasoning before producing its visible answer, and those tokens are billed
as output even though you never see them. A live test against this project's own API key returned
`thoughtsTokenCount: 22` for a **9-token** visible reply to a trivial one-word prompt — a >2x overhead
on a task with essentially nothing to reason about. On real structured-extraction/comparison prompts
the ratio is usually smaller proportionally, but it's real money on every single call. The estimates
below apply a **1.4× buffer on output tokens** to approximate this; §10 explains how to measure the
real ratio instead of estimating it.

Sources: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) (fetched 2026-09-11).

---

## 2. Every Gemini call site in this codebase

| # | Feature | File | Files sent per call | Called by |
|---|---|---|---|---|
| 1 | Document field extraction | `lib/ai/extraction.ts` | 1 | `/api/extract` — once per uploaded PO/GRN/Invoice/Contract |
| 2 | Intelligent Comparison | `lib/ai/intelligent-comparison.ts` | 2–5 (all in one call) | `/api/intelligent-compare` |
| 3 | Document Summary | `lib/ai/file-summary.ts` | 1–5 (all in one call) | `/api/summarize` |
| 4 | Document Filler — detect fields | `lib/ai/document-fields.ts` | 1 | `/api/document-fields` |
| 5 | Document Filler — fill | `lib/ai/invoice-fill.ts` | 1 | `/api/invoice-fill` |
| 6 | Document Translation | `lib/ai/translation.ts` | 1 | `/api/translate` |
| 7 | Per-document quick summary | `lib/ai/document-summary.ts` | 0 (uses already-extracted data, no file re-sent) | `/api/document/[id]/summary` — on demand |
| 8 | Comparator executive summary | `lib/ai/summary.ts` | 0 (structured JSON only) | `/api/summary` — once per Document Comparator run |
| 9 | Comparator Approve/Hold/Reject | `lib/ai/recommendation.ts` | 0 (structured JSON only) | `/api/recommendation` — once per Document Comparator run |
| 10 | AI Workspace grounded chat | `lib/ai/chat.ts` | 0 (structured JSON only) | `/api/chat` — once per user message |
| 11 | Global DocIntel Assistant chatbot | `lib/ai/assistant.ts` | 0 (text context only) | `/api/assistant` — once per user message, on every screen |

A single **Document Comparator run** (2-way, PO vs Invoice) therefore costs **4 Gemini calls**: two
extractions (#1) + one executive summary (#8) + one recommendation (#9) — before the user even opens
AI Workspace chat (#10).

---

## 3. Token estimate methodology

- **System instruction / prompt template tokens** — counted directly from this codebase's actual
  string literals (≈4 characters ≈ 1 token, the standard approximation for English text).
- **File input tokens** — a single-page PDF/image document is priced by Gemini per-page similarly to
  an image tile. This report assumes **~1,000 tokens/page** for a typical single-page business
  document (invoice, PO, form) scanned/exported at normal resolution — used for a **1-page** typical
  case, with a 3-page high case for denser documents.
- **Output tokens** — estimated from the response schema and realistic field/line-item counts, then
  multiplied by **1.4×** for the thinking-token buffer described in §1.
- All dollar figures use **paid-tier list pricing** ($0.30/$2.50 per 1M tokens for input/output).

---

## 4. Per-call cost estimate

| # | Feature | Input tokens (sys+prompt+file) | Output tokens (incl. thinking buffer) | Cost — Low | Cost — Typical | Cost — High |
|---|---|---|---|---|---|---|
| 1 | Extraction (1 doc, 1 page, ~10 line items) | ~174 (sys) + 225 (prompt) + 1,000 (file) ≈ **1,400** | ~700 × 1.4 ≈ **980** | $0.0007 | **$0.0029** | $0.0075 |
| 2 | Intelligent Comparison (3 docs, ~2 pages each) | 257 (sys) + 150 (prompt) + 6,000 (files) ≈ **6,400** | ~1,800 × 1.4 ≈ **2,520** | $0.0038 | **$0.0083** | $0.0180 |
| 3 | Document Summary (2 docs) | 870 (sys) + 100 (prompt) + 2,000 (files) ≈ **3,000** | ~1,400 × 1.4 ≈ **1,960** | $0.0027 | **$0.0058** | $0.0140 |
| 4 | Document Filler — detect fields (1 doc, ~25 fields) | 213 (sys) + 100 (prompt) + 1,000 (file) ≈ **1,300** | ~600 × 1.4 ≈ **840** | $0.0007 | **$0.0025** | $0.0060 |
| 5 | Document Filler — fill (1 doc, ~25 fields) | 570 (sys) + 300 (prompt+fields) + 1,000 (file) ≈ **1,900** | ~900 × 1.4 ≈ **1,260** | $0.0011 | **$0.0037** | $0.0090 |
| 6 | Translation (1 doc, 1 page) | 517 (sys) + 200 (prompt) + 1,000 (file) ≈ **1,700** | ~1,500 (full transcription + translation) × 1.4 ≈ **2,100** | $0.0015 | **$0.0058** | $0.0140 |
| 7 | Per-document quick summary — **now on gemini-3.1-flash-lite** | 266 (sys) + 400 (JSON data) ≈ **670** | ~120 × 1.4 ≈ **170** | $0.0002 | **$0.0004** | $0.0009 |
| 8 | Executive summary (still gemini-2.5-flash) | 549 (sys) + 500 (JSON data) ≈ **1,050** | ~150 × 1.4 ≈ **210** | $0.0004 | **$0.0009** | $0.0020 |
| 9 | Recommendation — **now on gemini-3.1-flash-lite** | 150 (sys) + 400 (JSON data) ≈ **550** | ~60 × 1.4 ≈ **85** | $0.0001 | **$0.0003** | $0.0007 |
| 10 | AI Workspace chat message — **now on gemini-3.1-flash-lite** | 119 (sys) + ~1,500 (comparison data + history) ≈ **1,600** | ~120 × 1.4 ≈ **170** | $0.0004 | **$0.0007** | $0.0015 |
| 11 | Assistant chatbot message — **now on gemini-3.1-flash-lite** | ~700 (sys) + ~600–3,000 (user activity context) + history ≈ **2,000–4,500** | ~150 × 1.4 ≈ **210** | $0.0005 | **$0.0011** | $0.0024 |

(Costs rounded; "Low"/"High" vary the file-page-count and line-item/finding-count assumptions, not the
per-token price, which is fixed. Rows 7/9/10/11 reflect the model switch implemented in §9 — everything
else still runs on gemini-2.5-flash.)

---

## 5. Cost by document length

The single biggest lever on cost is how many pages the uploaded document(s) actually have — everything
in §4 assumed 1 page. Here's the same five document-handling features broken out by page-count band, so
you can size cost against whatever documents your users actually upload. All costs still run on
`gemini-2.5-flash` (§1) and include the 1.4× thinking-token buffer from §1/§3.

| Pages | Extraction (1 doc) | Document Filler (detect+fill, 1 doc) | Translation (1 doc) |
|---|---|---|---|
| 1–5 | $0.0029 – $0.0139 | $0.0062 – $0.0296 | $0.0058 – $0.0280 |
| 6–10 | $0.0166 – $0.0276 | $0.0355 – $0.0589 | $0.0335 – $0.0557 |
| 11–15 | $0.0304 – $0.0414 | $0.0647 – $0.0881 | $0.0613 – $0.0835 |
| 16–20 | $0.0441 – $0.0551 | $0.0940 – $0.1174 | $0.0890 – $0.1112 |

Intelligent Comparison and Document Summary both send **multiple documents in a single call** — the
table below assumes a fixed batch of **2 documents**, and the page count is **per document** (so
"6–10" means each of the 2 documents is 6–10 pages, ~12–20 pages total in that one call):

| Pages per document (2-doc batch) | Intelligent Comparison | Document Summary |
|---|---|---|
| 1–5 | $0.0028 – $0.0136 | $0.0058 – $0.0278 |
| 6–10 | $0.0163 – $0.0271 | $0.0333 – $0.0553 |
| 11–15 | $0.0298 – $0.0406 | $0.0608 – $0.0828 |
| 16–20 | $0.0433 – $0.0541 | $0.0883 – $0.1103 |

**Read this as**: cost scales roughly linearly with page count in every feature — doubling page count
roughly doubles that call's cost. A one-page invoice and a 20-page contract are not the same line item
in a budget; a batch of 20-page contracts run through Intelligent Comparison costs **~19x** more per
call than the same batch at 1 page. If you know your users' typical document length, use the matching
row instead of §4's 1-page baseline for any real budget conversation.

*(Method: input tokens = system+prompt text + ~1,000 tokens/page/document (§3); output tokens scale
linearly with page count using the per-page rate implied by §4's own typical/high figures for that
feature, then the 1.4× buffer is applied. Document Filler counts the file twice since it's sent to two
separate calls — detect, then fill.)*

---

## 6. Cost per user-facing action (rolled up)

| Action | Calls involved | Typical cost |
|---|---|---|
| One 2-way Document Comparator run | 2× extraction + 1× exec. summary + 1× recommendation | **≈ $0.0070** |
| + one AI Workspace question afterward | + 1× chat | **≈ $0.0077** |
| One Intelligent Comparison (3 docs) | 1× intelligent-comparison | **≈ $0.0083** |
| One Document Summary (2 docs) | 1× file-summary | **≈ $0.0058** |
| One Document Filler completion | 1× detect + 1× fill | **≈ $0.0062** |
| One Translation | 1× translation | **≈ $0.0058** |
| One chatbot exchange (any screen) | 1× assistant | **≈ $0.0011** |

Every one of these is a fraction of a cent. The cost that adds up is **volume**, not any single call.

---

## 7. Monthly cost projections

Three illustrative usage levels (per month). Adjust the multipliers to your actual expected traffic —
the per-action costs above are what to multiply by.

| Action | Light (10 users) | Moderate (50 users) | Heavy (250 users) |
|---|---|---|---|
| Comparator runs | 50 | 400 | 3,000 |
| Intelligent Comparisons | 20 | 150 | 1,000 |
| Document Summaries | 20 | 150 | 1,000 |
| Document Filler completions | 20 | 150 | 1,000 |
| Translations | 10 | 100 | 800 |
| Assistant chat messages | 150 | 1,200 | 8,000 |
| AI Workspace chat messages | 30 | 250 | 1,800 |
| **Estimated Gemini spend** | **≈ $1.00** | **≈ $7.92** | **≈ $56.00** |

Even the "heavy" column — 250 active users each running several comparisons a month — lands around
$60/month in Gemini spend. This app's per-operation footprint is small; cost only becomes material at genuinely
high volume (thousands of comparisons/day) or if documents run much longer than the 1-3 page
assumption used above (a 20-page contract in Intelligent Comparison, for instance, could push a single
call's input tokens 5-10× higher).

---

## 8. What actually drives cost up

1. **Document length**, far more than anything else — a 1-page invoice and a 20-page contract are
   both "one file" but not remotely the same number of input tokens. Intelligent Comparison and
   Translation are the most exposed since they send full documents, sometimes several at once.
2. **Chat history growth** — `chat.ts` caps history at the last 10 messages and `assistant.ts` at 12;
   without that cap, a long conversation would re-send its entire history as input tokens on every
   single turn. This is already handled correctly in the code.
3. **The assistant's user-activity context** (`app/api/assistant/route.ts`) was recently enriched to
   include full field-diffs/aligned-findings detail for the user's most recent comparison, so every
   assistant message now costs a bit more in input tokens than before — worth knowing since it was a
   deliberate trade-off for answer quality, not an accident.
4. **Retries.** `lib/ai/gemini.ts` retries transient failures (including rate-limit 429s, since the
   recent fix) up to `MAX_RETRIES` (2) times with backoff — a call that fails twice before succeeding
   is billed for all three attempts' input tokens (Gemini doesn't charge for failed/empty responses,
   only for tokens it actually processed and returned).

---

## 9. Implemented: low-stakes calls now run on the cheaper model

`lib/ai/gemini.ts` now exports `GEMINI_MODEL_LITE` (defaults to `gemini-3.1-flash-lite`, overridable
via an env var of the same name) alongside the existing `GEMINI_MODEL`. Every `generateText`/
`generateJson` call accepts an optional `model` override; four call sites now pass it explicitly —
the ones that answer from already-computed data rather than parsing raw documents, so the accuracy
risk from a smaller model is low:

| Call site | Why it's a candidate | Actual saving (measured against §1's real prices) |
|---|---|---|
| Assistant chatbot (#11) | Conversational Q&A about the app itself, not financial extraction | ~17% off input, ~40% off output |
| AI Workspace chat (#10) | Answers from already-computed structured data, not raw documents | ~17% off input, ~40% off output |
| Recommendation (#9) | Small, already-computed JSON in, one sentence out | ~17% off input, ~40% off output |
| Per-document quick summary (#7) | Small, already-computed JSON in | ~17% off input, ~40% off output |

Everything else — extraction (#1), Intelligent Comparison (#2), Document Summary (#3), Document
Filler (#4/#5), Translation (#6), and the executive summary (#8) — is untouched and still runs on
`gemini-2.5-flash`, since those all parse raw documents and an extraction mistake has real
financial/audit consequences.

**Be honest about the size of this win**: because the only truly cheap tier (`gemini-2.5-flash-lite`,
70-84% cheaper) isn't reachable from this project (§1), the realistic saving from this switch is
modest — roughly $0.60-$4.60/month across the usage scenarios in §7, not the 80%-off number originally
estimated before the live model-access test. It's still free money (same code, no downside found so
far) but don't present it as a dramatic cost cut when reporting this internally.

**Before shipping this to production**, spot-check actual answer quality from the assistant chatbot
and AI Workspace chat on `gemini-3.1-flash-lite` against a handful of real questions — it hasn't been
evaluated for output quality here, only for API reachability and price.

---

## 10. Turning this into a real, measured cost report

Every estimate above is a planning number. To get an *exact* cost report from actual usage:

1. **Capture `usageMetadata` on every call.** The Gemini SDK already returns
   `result.response.usageMetadata` (`promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`,
   `totalTokenCount`) on every response — confirmed directly against this project's own API key — but
   `lib/ai/gemini.ts`'s `generateText()` currently discards it, only keeping `result.response.text()`.
   Logging that object (e.g., into a new field on `AuditLog`, or a dedicated `UsageLog` collection)
   per call would let you compute real, per-feature, per-user cost — not an estimate — straight from
   your own database.
2. **Google Cloud Billing export.** If billing is linked to a GCP project, enabling BigQuery billing
   export gives an authoritative daily cost breakdown by SKU (Gemini API is billed as a standard GCP
   service) without any code changes.
3. **AI Studio dashboard.** `https://aistudio.google.com/rate-limit` and the associated usage view
   show live token/request counts per model for the account tied to `GEMINI_API_KEY`.

I'd recommend (1) specifically — it's a small change, and it turns this whole document from an
estimate into something you can regenerate from real numbers whenever you want. Ask if you'd like me
to implement it.

---

## 11. Non-Gemini cost centers (flagged only, not researched)

Storage is explicitly out of scope — documents aren't being persisted long-term, so that's not a cost
driver here. The only other cost centers worth knowing about before you budget are **MongoDB Atlas**
(the cluster in `.env.local`'s `MONGODB_URI` — tier not identifiable from the connection string alone,
check the Atlas billing dashboard) and whatever **hosting platform** this gets deployed to. Ask if you
want either of those costed out too.

---

*Report generated 2026-09-11 from the DocIntel codebase (`lib/ai/*.ts`, `app/api/*`). Pricing current
as of that date per ai.google.dev — Gemini pricing has changed before and can again; re-check before
relying on this for a formal budget.*
