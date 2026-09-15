# DocIntel Growth Plan — Tables for Excel

Copy each block below (inside the fences) and paste into Excel — the tabs will split into columns
automatically. Companion to `costing.md`.

## Plan card (customer-facing)

```
Feature	Description	Included / mo
Document Comparator	2-way PO/Invoice matching with field diffs, executive summary & recommendation	~350 runs
Intelligent Comparison	Semantic comparison across any 2–5 documents	~310 runs
Document Summary	Structured, section-by-section summaries of any document	~415 summaries
Document Filler	Detects blank fields and completes forms end-to-end	~415 documents
Document Translation	English ⇄ Marathi, layout preserved	~415 documents
AI Assistant & Workspace Chat	Grounded Q&A on every screen	Fair-use, not metered
```

## Credits per feature (internal basis, 1-page assumption)

```
Feature	Typical Gemini cost	Credits charged	Runs on 2,500 credits
Document Comparator run	$0.0070	7	357
Intelligent Comparison	$0.0083	8	312
Document Summary	$0.0058	6	416
Document Filler completion	$0.0062	6	416
Translation	$0.0058	6	416
Assistant / Workspace chat message	$0.0011	1	2,500
```

## Credit cost by document length (pages)

```
Feature	1 page	5 pages	10 pages	15 pages	20 pages
Document Comparator run	7	29	56	84	111
Document Summary (per doc)	6	28	55	83	110
Document Filler	6	30	59	88	117
Translation	6	28	56	83	111
Intelligent Comparison (per doc, 2-doc batch)	3	14	27	41	54
```

## Uses of the 2,500-credit pool, by document length

```
Feature	1 page	5 pages	10 pages	15 pages	20 pages
Document Comparator run	357	86	44	29	22
Document Summary (per doc)	416	89	45	30	22
Document Filler	416	83	42	28	21
Translation	416	89	44	30	22
Intelligent Comparison (per doc, 2-doc batch)	833	178	92	60	46
```
