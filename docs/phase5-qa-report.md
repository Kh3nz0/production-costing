# Phase 5 — Content and Logic QA Report

Date: 2026-09-18
Method: the content documents were checked **against** the calculation specification, the data model and the decision log, not re-read on their own. Terminology was verified by search rather than by recollection. Every worked figure in a tooltip was recomputed.

Outcome: **14 problems found. 11 corrected in place. 3 remain as accepted risks or open decisions.** Two of the corrections were logic errors that would have shipped as wrong numbers on screen.

---

## 1. Passed

| Check                                            | Result                                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| "Net profit" absent from the interface           | Pass. Appears only as a prohibition in the vocabulary table and as a non-goal in the PRD                                     |
| Lorem ipsum, TBD, placeholder text               | Pass. The only matches are the word "Placeholder:" introducing real example text, and a search field's placeholder           |
| "Unit cost" never used for a product             | Pass. Reserved for items throughout; products use "production cost per unit"                                                 |
| Movement type labels complete                    | Pass. All eleven ledger types appear in the interface with plain-language names                                              |
| Margin and markup always paired                  | Pass. The trap example is present with both figures                                                                          |
| Estimated versus actual language                 | Pass. "Estimated" and "Actual" are never used interchangeably; the comparison is explicitly against the estimate at run time |
| Destructive-action warnings                      | Pass. Nothing is destroyed in v1; every confirmation names the record and the consequence                                    |
| Historical-record protection language            | Pass. Run locking, rate versioning and ledger immutability are each stated in the interface, not only in the spec            |
| Empty states distinguish first-use from filtered | Pass. Fourteen states, each with the correct variant                                                                         |
| Error messages avoid blaming the user            | Pass. Every rule violation states the consequence and the fix                                                                |
| Errors name the record                           | Pass                                                                                                                         |
| Import errors carry a row number                 | Pass. All eight patterns                                                                                                     |
| Unit always visible beside a quantity            | Pass in the content; enforcement is a Phase 6 component rule                                                                 |
| Mobile labels shorten without changing the word  | Pass after one correction, below                                                                                             |
| Accessibility strings present                    | Pass. Fifteen, including a text summary pattern for charts                                                                   |
| Sentence case, no exclamation marks              | Pass                                                                                                                         |

---

## 2. Problems found and corrected

### Critical

**P-01 — Break-even was labelled as something it was not.**
The single break-even figure was computed on full cost including overhead, at ₱99.92, and labelled "below this price the sale loses money". At ₱99.92 contribution profit is actually **+₱12.35**, because contribution subtracts production cost only. The label was false by exactly the overhead the price was built to recover.
**Corrected.** Two figures now, with the band between them named: `Loses money below` at ₱86.65 on production cost, `Covers overhead above` at ₱99.92 on full cost. Between them a sale is profitable but not self-sufficient. D-057. Propagated to the PRD, IA, data model and build plan.

**P-02 — A 40% target would have reported as a 48% margin, with no explanation.**
Pricing back-solves against full cost with overhead. Contribution profit subtracts production cost. Both are correct in isolation and they do not agree: a price set for 40% returns 48.0%. The owner would have set a target, seen a different number on the sale, and reasonably concluded the system was broken.
**Corrected.** The pricing table now shows `Expected contribution margin` beside the target, with copy explaining that the gap _is_ the overhead being recovered. D-056.

### Major

**P-03 — The "show your work" feature would visibly fail to add up.**
The display rule rounds unit costs of ₱1 or more to two places. Expanded as `19.32 g × ₱1.20 = ₱23.24`, that invites the reader to check it and find ₱23.18. The one feature whose entire purpose is being checkable would have failed the first time it was checked.
**Corrected.** Inside a calculation row, unit costs show six decimals and amounts four; totals stay at two. D-058.

**P-04 — Electricity was implied to be a recipe line.**
It appears as a breakdown row but is not a `bom_lines` line type. A developer reading the content would have added one, letting electricity be recorded twice.
**Corrected.** Marked derived in both the spec and the interface copy, with helper text saying so. D-059.

**P-05 — "Expected failure allowance" as a breakdown row did not reconcile.**
The failure adjustment is a division applied to the direct-cost total, not a component. Listed as a row alongside components, the rows would not sum to the total.
**Corrected.** Defined as a derived display row equal to `inventory_unit_cost − direct_unit_cost`, with the subtotal `Production cost per unit` placed above `Overhead` so both headline figures reconcile with the rows. D-059.

**P-06 — The business-wide waste rate added grams to pieces.**
The dashboard showed one waste rate defined as wasted quantity over consumed quantity. Across items that is the same defect that makes allocation by quantity invalid on a mixed purchase (D-032).
**Corrected.** The dashboard figure is now by value. The per-item figure on the report stays a quantity ratio, which is meaningful because it is one unit. D-060.

**P-07 — Equipment allowances did not reconcile with the recovery period.**
The form asked for maintenance and repairs "per year" and divided by expected productive hours over a period that was never asked for. The data model had `cost_recovery_period_months`; the content had dropped it.
**Corrected.** An explicit `Recover its cost over [n] months` field, defaulting to 36, with the annual allowances counted across it. D-061.

### Moderate

**P-08 — "Average margin" on the dashboard did not say which margin.**
Corrected to `Average contribution margin`, sub-labelled `Across sales this month, after fees`.

**P-09 — The business-wide failure rate weights a ₱30 keychain the same as a ₱600 build.**
Corrected by labelling rather than by changing the maths: `Units rejected against units started, all products counted equally`. A value-weighted version lives on the failure report. Changing the headline figure to a value weighting would have made "failure rate" mean something other than what the words say.

**P-10 — The uncosted-sale override did not say which cost it used.**
It said "current estimated cost" where two costs exist. Corrected to production cost per unit, with the reason stated in the copy: cost of goods sold never carries overhead.

**P-11 — A mobile label changed the meaning.**
`Full cost with overhead` shortened to `With overhead`, which as a standalone column header says nothing. Corrected to `Full cost`.

---

## 3. Problems found and not corrected

**P-12 — Tooltips mix a generic ₱60 example with the product's own figures.** The markup explanation uses a ₱60 cost while the screen beside it shows the real product at ₱92.93. Two different numbers teaching one idea.
**Not corrected, deliberately.** The static example is clearer precisely because ₱60 and ₱100 are easy to hold. The fix is a Phase 6 layout decision: the generic example belongs in the "These are not the same thing" panel, visually separated from the live figures, and it is already placed there. Flagged so Phase 6 keeps the separation visible rather than inlining it.

**P-13 — Allocation remainder "goes to the largest line" is non-deterministic on a tie.** Two lines of equal value leave the last centavo ambiguous.
**Not corrected in content.** It is an implementation rule, not a string. Recorded for Phase 8: break ties by lowest line id so the result is reproducible.

**P-14 — Contrast, focus order and touch targets cannot be QA'd yet.** The palette has no hex values until Phase 6.
**Deferred by design.** Carried into the Phase 6 visual QA checklist as a gate, not an aspiration.

---

## 4. Remaining risks

| Risk                                                              | Why it survives                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The overhead model is still the concept most likely to be misread | Three separate strings now explain that overhead is recovered in aggregate rather than per unit. It is the copy I would most want read critically, because no amount of wording fully removes the intuition that each sale should "carry" its overhead |
| Many products will ship flagged as Incomplete cost                | The failure-rate helper tells the owner to leave the field blank rather than guess. That is correct and it will look like an error state until the data exists. Phase 6 must style Incomplete as information, not as a failure                         |
| The contribution-versus-target gap is explained but not intuitive | P-02 is corrected in the interface. Whether the explanation lands is only testable with the real user                                                                                                                                                  |
| Vocabulary drift during Figma work                                | D-049 binds 22 terms. Nothing enforces it in Figma except discipline. The Phase 7 QA checklist includes a terminology pass against the table                                                                                                           |

---

## 5. Decisions still needed

| #     | Decision                                                         | Blocks                                      |
| ----- | ---------------------------------------------------------------- | ------------------------------------------- |
| Q3    | Written quotations, or are dated pricing snapshots enough?       | Phase 6 screen inventory                    |
| Q5    | Does the Figma file stay on the DICT organisation seat?          | Phase 7                                     |
| D-033 | Waste as a percentage added to net, rather than a share of input | Confirmation only; specified and consistent |
| D-034 | A failed unit assumed to consume its full cost                   | Confirmation only                           |
| D-036 | Margin measured against net revenue                              | Confirmation only                           |

---

## 6. Lock status

Content is **ready to lock** on the four critical and major classes: no false labels, no unreconciled arithmetic, no ambiguous cost references, no forbidden terminology.

It is **not locked yet**, because Q3 changes the screen inventory and therefore adds strings. If snapshots are sufficient, the content locks as it stands.
