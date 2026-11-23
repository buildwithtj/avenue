# Sources and authority

Owner of: where every requirement and fact comes from, how much weight it carries, and what is missing. Requirements cite these IDs ([REQUIREMENTS.md](REQUIREMENTS.md)). Never copy credentials from any source into the repository.

## Precedence rules

1. An explicit client decision replaces a conflicting earlier requirement **only for the requirement it touches**. Everything else stays.
2. Among client sources, the later one wins; the call (S-05) and emails (S-04) outrank the original scope (S-01..S-03).
3. A summary is not more authoritative than the source it summarises. S-04 and S-05 are themselves summaries (see limits); confirm wording before building billing, cancellation or liability rules.
4. Code, evidence and supplied logins show what exists or was tried, never what the client approved or that a permission, licence or deployment works.
5. An engineering proposal is labelled [PROPOSED] and is not a requirement.
6. If order or meaning is unclear, record a conflict in [REQUIREMENTS.md](REQUIREMENTS.md#conflicts-between-sources) or a question in [DECISIONS_AND_OPEN_QUESTIONS.md](DECISIONS_AND_OPEN_QUESTIONS.md); do not guess. Use UNKNOWN when evidence is absent.

## Client sources (authoritative, oldest first)

| ID | Source | Path | Date | Authority and limits |
|---|---|---|---|---|
| S-01 SCOPE | Phase 1 scope and module specification (Doubleklick Designs). DOCX and an HTML twin | `references/original/01-avenue-phase1-scope.docx`, `avenue-phase1-scope.html` | 30 Oct 2026 | Original scope: 9 modules, access model, 5 non-goals. Partly superseded (QuickBooks, member Power Apps, auto/approval rules). DOCX omits wellness items the HTML lists (C-01). |
| S-02 KICKOFF | Kickoff checklist: access, integrations, data and configuration, sign-off | `references/original/02-avenue-phase1-client-requirements.docx` | 30 Oct 2026 | Original inputs list. Business Premium and QuickBooks assumptions are superseded. |
| S-03 DEVFLOW | Developer flow: data entities, flows, triggers | `references/original/avenue-phase1-developer-flow.html` | 30 Oct 2026 | Original technical intent; plain-text email as member key conflicts with current guidance (C-06). |
| S-04 E1–E10 | Ten client emails, as **sanitised summaries** | [CLIENT_DECISIONS.md](CLIENT_DECISIONS.md) (before/after), [CLIENT_CHANGE_REGISTER.md](CLIENT_CHANGE_REGISTER.md) (register) | Dates UNKNOWN | Client instructions, but known only through summaries. Raw emails are not in the repository (they contained credentials). Standing limit **Q-00**. |
| S-05 CALL | Client call notes, decisions D1–D10, action items | [meetings/2026-11-11-client-call.md](meetings/2026-11-11-client-call.md) | 11 Nov 2026 | Latest client source. Notes taken by the developer team; **not confirmed in writing**. Attendees: Samia Bingham (B Street HQ / Flavors), Tanishka Jain (Doubleklick Designs, "DKD"), Madhav Agarwal and Aman Raj (Polarein). Replaces earlier answers on booking approval, equipment, cancellations, no-shows, dining and fees. |
| S-06 CHAT-SS | Client chat screenshot about check-in and dining (Q-10, Q-22) | not stored | shared 11 Nov 2026; message date UNKNOWN | Reported evidence only. |
| S-07 SHEET | "Avenue Phase 1 – Information Needed from B Street & Flavors" (Google Sheet, 13 tabs) | outside the repository | copy read 13 Nov 2026 | A data-collection template. Prefilled cells restate S-05; client-entered values were still blank when read. One prefilled line conflicts with D5 (C-10). |

## Derived project records (developer-authored; not client authority)

| ID | Record | Path | Date | Use |
|---|---|---|---|---|
| S-10 | Workflow stage catalogue (57 stages) and planning atlas | [WORKFLOW_STAGES.md](WORKFLOW_STAGES.md), `workflow/` | 10 Nov 2026 | Stage behaviour and checks. Stage IDs are cited by traceability. |
| S-11 | Module SOPs, Draft 0.2 (0.1 kept) | `Avenue_Phase1_Complete_Module_SOPs.docx` (in `docs/`) | 13 Nov 2026 | Procedure drafts, unapproved. Ambiguities in red. Text still names `OPEN_QUESTIONS.md`/`DECISION_LOG.md`, now merged into [DECISIONS_AND_OPEN_QUESTIONS.md](DECISIONS_AND_OPEN_QUESTIONS.md). |
| S-12 | SOP and scope audit | [SOP_SCOPE_AUDIT.md](SOP_SCOPE_AUDIT.md) | 13 Nov 2026 | Repository-only audit (no tenant, Stripe or browser). Gap list; some gaps since fixed (see [STATUS.md](STATUS.md)). |
| S-13 | Research log, limitations and risks | [RESEARCH_LOG.md](RESEARCH_LOG.md) (R-IDs), [LIMITATIONS_AND_RISKS.md](LIMITATIONS_AND_RISKS.md) (L-IDs) | 10 Nov 2026 | Platform facts with official-doc references. Re-verify versions and licensing before relying on them. |
| S-14 | Evidence records | `evidence/*.md` | 11–12 Nov 2026 | Dated developer test notes. **Owner-account tests only**; no guest, staff or Stripe evidence. Reported evidence, not independent verification. |
| S-15 | Code and generators | `apps/`, `schema/`, `flows/expressions.md` | continuous | Implementation. `flows/expressions.md` is the exact text of live flow expressions. |
| S-16 | Archived planning and handoff documents | [archive/](archive/) | 10–11 Nov 2026 | History only. Superseded by the files in [INDEX.md](INDEX.md). |
| S-17 | Design | `design/`, Figma file linked from `README.md` | 10–11 Nov 2026 | Design only; sample data; not checked this session. |

## Supplied access (outside the repository)

Microsoft 365, Power Automate, Power BI, Stripe platform invite, Swift Sensors key and docs were supplied separately. They show that access was offered, **not** that permissions, licence coverage or configuration work. The 6 Nov client email carried passwords and a sensor key in plain text; they must be changed and the key reissued (call, other facts). Record only the purpose and approved storage of any credential, never its value.

## Missing or unverified sources

| Item | Effect |
|---|---|
| Raw emails E1–E10 and their dates | Wording and ordering of S-04 cannot be checked (Q-00). |
| Written confirmation of S-05 decisions D1–D10 | Treat as client-stated, unconfirmed. |
| Swift Sensors private API documentation and rate-limit terms | Sensor design is blocked on it (Q-12). |
| Stripe platform account settings and applicable agreement | Fee, dispute and refund allocation cannot be stated (Q-02). |
| Signed agreement between client and developer | Contract terms, warranty and acceptance process UNKNOWN. |
| Figma design file | Not opened in this review. |

## Review limits (13 Nov 2026 documentation pass)

Read in full: S-02, S-05, the requirements, architecture, data/permissions, traceability, decision log and open questions, evidence for days 2–5 and 8. Read in part: S-01 DOCX (all text), S-04 summaries (by section), S-13 (headings only). Not re-read: S-01 HTML, S-03, S-17. No tenant, Stripe or browser access was used for this pass.

## Conflicts between sources

Kept in [REQUIREMENTS.md](REQUIREMENTS.md#conflicts-between-sources) (C-01..C-10).
