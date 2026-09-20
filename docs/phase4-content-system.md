# Phase 4 — Interface Content: System Strings

Part 2 of 2. Glossary and controlled vocabulary, formula explanations, errors, empty states, confirmations, permission messages, success messages, metadata, and mobile labels.

---

## 1. Voice

Plain, direct, and specific. Second person. A sentence tells the owner what happened, what it means, or what to do next.

Rules applied throughout:

- Say the number. "₱535.89 was recorded as a production loss", not "some costs were excluded".
- Name the record. "PLA Basic Filament", not "the item".
- Explain a term the first time it appears on a screen, not every time.
- Never blame the user. "That quantity would leave −40 g", not "You entered an invalid quantity".
- No exclamation marks. No "Oops". No "Something went wrong" without saying what.
- Sentence case for every label, heading and button.

## 2. Controlled vocabulary

The same thing is called the same thing everywhere. The left column is the only permitted term.

| Use                         | Never use                               | Why                                                                  |
| --------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Item                        | Material, product, SKU, stock item      | Materials are one kind of item                                       |
| Recipe                      | Bill of materials, BOM, formula         | BOM appears once, as an aside, in the recipe description             |
| Production run, or run      | Job, batch, build, print                | Batch means a quantity, not an event                                 |
| Accepted units              | Good units, output, yield               |                                                                      |
| Failed units                | Rejects, scrap, spoilage, defects       | Scrap means material, not units                                      |
| Waste                       | Loss, scrap, shrinkage                  | Waste is material; loss is money                                     |
| Production loss             | Abnormal spoilage, abnormal loss        | The user-facing name for cost from failures beyond the expected rate |
| Production cost per unit    | Unit cost, COGS, inventory cost         | Distinct from full cost                                              |
| Full cost with overhead     | Total cost, loaded cost, true cost      | Distinct from production cost                                        |
| Unit cost                   | Average cost, moving average, price     | Used only for an item's cost, never for a product                    |
| Cost of goods sold          | COGS alone on first use                 | Spelled out first, abbreviated afterwards within the same screen     |
| Contribution profit         | Net profit, profit, take-home, earnings | Net profit is never used anywhere                                    |
| Gross profit                | Profit before fees                      |                                                                      |
| Margin                      | Profit percentage, markup               | Always paired with markup where a target is set                      |
| Markup                      | Margin, uplift                          |                                                                      |
| List price                  | Selling price, RRP, SRP                 |                                                                      |
| Loses money below           | Break-even price, floor price           |
| Covers overhead above       | Full break-even, true break-even        |                                                                      |
| Added costs                 | Landed cost, freight, extras            | Landed cost appears once, in a tooltip                               |
| Stock movement, or movement | Transaction, entry, ledger line         |                                                                      |
| Archive                     | Delete, remove, deactivate              | Nothing is deleted                                                   |
| Reorder at                  | Reorder point, par level, minimum       |                                                                      |
| Attended time               | Direct labour, active time              |                                                                      |
| Unattended time             | Machine time, passive time              | Machine time is the recipe line type; unattended describes labour    |
| Cost recovery rate          | Depreciation, amortisation              | It is a planning rate, not a tax schedule                            |
| Sales channel, or channel   | Marketplace, platform, store            |                                                                      |

## 3. Formula explanations

These appear in tooltips, in expandable help, and in the Cost and Pricing tabs. Each explains what the number means before how it is worked out.

**Unit cost**
`A weighted average of everything you have paid for this item, including its share of shipping and other costs. It moves when new stock arrives at a different price, and it does not move when you edit anything. Buying 2,000 g at ₱1.22 when you already hold 300 g at ₱1.10 gives an average of ₱1.20.`

**Waste**
`Material lost rather than used. A recipe line with 18.4 g and 5% waste consumes 19.32 g, because 5% is added to what the unit actually needs.`

**Expected failure rate**
`Out of every hundred units you start, how many you normally throw away. To finish with 20 good units at a 5% failure rate you have to start 22.`

**Expected failure allowance**
`Making 20 good units means paying for the ones that failed too. That cost does not disappear, it spreads across the units that survived. At a 5% failure rate, a unit that costs ₱76.56 to start carries ₱80.58 once the expected failures are counted.`

**Production cost per unit**
`What one unit is worth in stock and what a sale will charge as cost of goods sold. Materials, components, packaging, machine time, electricity and labour, with expected failures spread across the good units. Your monthly running costs are not included, because they are not sitting on a shelf.`

**Full cost with overhead**
`Production cost plus a share of your monthly running costs. Use this when setting a price. It is never used as stock value.`

**Margin**
`Profit as a share of the price you charge. Selling at ₱100 with a cost of ₱60 is a 40% margin, because ₱40 of the ₱100 is profit.`

**Markup**
`Profit as a share of what it cost you. Adding 40% to a ₱60 cost gives ₱84, which is a 28.6% margin. The same percentage means two different prices, so check which one you are setting.`

**Price for a target margin on a channel**
`The channel takes a percentage of whatever you charge, so the price has to be higher than cost plus margin. At a 40% target on a ₱92.93 cost, a direct sale needs ₱154.88 and Shopee needs ₱166.54 once a 5% commission and 2% payment fee are covered.`

**Loses money below**
`The price at which a sale earns nothing once the cost of the goods and the channel's fees are taken out. It sits above your production cost, because fees are charged on the price rather than on the cost.`

**Covers overhead above**
`Above this price the sale also carries its share of your monthly running costs. Between the two figures you are making something on each sale, but not enough to pay for the month.`

**Why your contribution margin is higher than your target**
`Your target is set on the full cost, which includes a share of overhead. Contribution margin is measured after the cost of the goods only, because overhead is never part of what a unit is worth in stock. The difference between the two is the overhead that price recovers, and it is why a 40% target shows as roughly 48% on the sale.`

**Cost recovery rate**
`Your equipment's cost spread across the hours you expect to run it. A ₱48,000 printer expected to run 4,000 hours carries ₱12 an hour. This is a planning figure for pricing, not a depreciation schedule for tax.`

**Overhead rate**
`Your monthly running costs divided by the hours you expect to work. It is applied to a product by the time that product takes.`

**Overhead recovered**
`Overhead is not charged to each product. It comes out of the total contribution profit your sales produce. When the month's contribution passes your monthly running costs, the month has paid for itself.`

**Cost of goods sold**
`What the units you sold cost you to produce, taken from the stock they came out of. It is fixed at the moment of the sale and does not change when material prices change later.`

**Contribution profit**
`What is left after the cost of the goods, fees, discounts and shipping. It is not net profit. It does not include your monthly running costs, taxes, or anything else you pay to keep the business going.`

**Gross margin against contribution margin**
`Gross margin is profit before fees, measured against revenue. Contribution margin is profit after fees, measured against the money that actually reached you. The gap between them is what selling through that channel costs.`

**Production loss**
`Failures beyond the rate you expect are not part of what your good units are worth. If eight of twenty fail when you expected one, seven of those failures are recorded as a loss for that night rather than added to the price of the twelve that survived.`

**Stock movement**
`Every change to stock is recorded as its own entry with the balance and cost that resulted. Nothing is ever edited or removed; a correction is recorded as its own entry so both remain visible.`

**VAT treatment**
`While you are not VAT-registered, the VAT you pay on materials is part of what they cost you. If you register later, that VAT becomes reclaimable and stops being a cost, and this setting is how the system tells the difference between the two.`

## 4. Error messages

### Field validation

| Situation                                 | Message                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| Required field empty                      | `[Field name] is required.`                                                                   |
| Quantity zero or negative                 | `Enter a quantity greater than zero.`                                                         |
| Not a number                              | `Enter a plain number. Use 1150.00, not ₱1,150.00.`                                           |
| Too many decimals                         | `Quantities go to three decimal places.`                                                      |
| Failure rate at or above 100%             | `A failure rate of 100% would mean no unit is ever accepted. Enter a value below 100.`        |
| Waste above 100%                          | `A waste rate above 100% means more material is wasted than used. Continue if that is right.` |
| Target margin at or above 100%            | `A 100% margin has no finite price. Set a markup instead, or lower the margin.`               |
| Negative price                            | `A price cannot be negative. To record a refund, use a customer return.`                      |
| Conversion factor zero                    | `Enter how many [base unit] are in one [purchase unit]. A 1 kg spool of filament is 1000.`    |
| Date in the future                        | `[Field name] cannot be in the future.`                                                       |
| Effective date before an existing version | `A rate already exists from [date]. Choose a later date, or edit that version.`               |
| Duplicate SKU                             | `SKU [sku] is already used by [item name].`                                                   |
| Password too short                        | `Use at least 10 characters.`                                                                 |
| Passwords differ                          | `The two passwords do not match.`                                                             |

### Rule violations

| Situation                            | Message                                                                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Negative stock                       | `This would leave −[qty] [unit] of [item]. Record a purchase or an opening balance first, or reduce the quantity.`                                              |
| Invalid conversion                   | `There is no conversion between [unit A] and [unit B] for [item]. Set how many [unit A] are in one [unit B] on the item first.`                                 |
| Allocation base invalid, mixed units | `Spreading by quantity is unavailable because this purchase mixes [unit A] and [unit B], so a total quantity would not mean anything. Spread by value instead.` |
| Allocation base invalid, no weights  | `Spreading by weight needs a weight on every line. [n] lines have none.`                                                                                        |
| Recipe cycle                         | `[Item A] cannot contain itself. It is already used inside [Item B], which this line would add back into [Item A].`                                             |
| Run with no units                    | `Record at least one accepted or failed unit before completing this run.`                                                                                       |
| Editing a completed run              | `This run's cost was locked on [date]. To change it, reverse the run and record a new one. Both will stay visible.`                                             |
| Archiving an item with stock         | `[Item] still has [qty] [unit] on hand. Adjust the stock to zero first, or leave it active.`                                                                    |
| Archiving a referenced record        | `[Name] is used by [n] records and cannot be removed. Archiving hides it from new entries and keeps the history intact.`                                        |
| Import out of order                  | `Import [template A] before [template B]. [Template B] refers to records that do not exist yet.`                                                                |
| Sale without costed stock            | `There is no costed stock for [product]. Recording the production run first gives this sale a real cost.`                                                       |

### Request failures

| Situation        | Message                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Network          | `That did not reach the server. Your entries are still here. Try again.`                                                                       |
| Timeout          | `The server took too long. Nothing was saved. Try again.`                                                                                      |
| Server error     | `Something failed on our side and nothing was saved. If it keeps happening, the reference is [id].`                                            |
| Conflict         | `Someone else changed this record while you were editing. Reload to see their version. Your entries are shown below so you can re-apply them.` |
| Session expired  | `Your session ended. Sign in again and you will come back to this page.`                                                                       |
| Upload too large | `That file is [size]. The limit is 2 MB.`                                                                                                      |
| Wrong file type  | `That is a [type] file. Upload a CSV.`                                                                                                         |

### Import errors

Each carries a row number and, where possible, the correction.

`Row [n]: item name is required.`
`Row [n]: no item named "[value]". Did you mean "[closest]"?`
`Row [n]: unit price "[value]" is not a plain number. Enter 1150.00.`
`Row [n]: failure rate [value] must be below 1.`
`Row [n]: cannot convert [unit A] to [unit B] for [item]. Set a pack size on the item first.`
`Row [n]: SKU [sku] already exists on "[item]".`
`Rows [n] and [m]: different pack sizes given for the same item.`
`Row [n]: unknown unit "[value]". Add it under Settings, Units, or use one of: [list].`

Summary: `[n] of [total] rows are ready. [m] have problems. Nothing has been saved yet.`
Error download: `Download the rows with problems` — `The file contains your original rows with two extra columns saying what is wrong, so you can fix the spreadsheet you already have.`

## 5. Empty states

| Screen              | Heading                      | Body                                                                                                                                                      | Action                                      |
| ------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Items, first use    | `No items yet`               | `Items are the materials, components and packaging you buy, and the products you make. Add one and its cost will be worked out from what you pay for it.` | `Add an item` · `Import from a spreadsheet` |
| Items, filtered     | `Nothing matches`            | `No items are [filter description].`                                                                                                                      | `Clear filters`                             |
| Suppliers           | `No suppliers yet`           | `Add the shops and sellers you buy from so purchases can be attributed to them.`                                                                          | `Add a supplier`                            |
| Purchases           | `No purchases yet`           | `A purchase is how an item gets a cost. Record what you bought and what it came to, and the unit cost follows.`                                           | `Record a purchase`                         |
| Products            | `No products yet`            | `A product is something you make and sell. Give it a recipe and the system works out what it costs.`                                                      | `Add a product`                             |
| Recipe              | `No recipe yet`              | `Add what goes into one unit: materials, components, packaging, machine time and labour. The cost is built from these.`                                   | `Add a line`                                |
| Production          | `No production runs yet`     | `A run records what you actually made: what was used, how many came out good, and what it really cost.`                                                   | `Start a run`                               |
| Sales               | `No sales yet`               | `Record a sale to see what it earned after the cost of the goods, fees and shipping.`                                                                     | `Record a sale`                             |
| Movements           | `No movements yet`           | `Every change to stock appears here once you record a purchase, a production run or an adjustment.`                                                       | `Record a purchase`                         |
| Movements, filtered | `No movements in this range` | `Nothing changed [item] between [from] and [to].`                                                                                                         | `Clear filters`                             |
| Reports, no data    | `Nothing to report yet`      | `This report covers [date range] and there is no activity in it.`                                                                                         | `Change the dates`                          |
| Low stock           | `Nothing is low`             | `No item is below its reorder point.`                                                                                                                     | —                                           |
| Below target margin | `Everything is on target`    | `Every product with a price is at or above its target margin.`                                                                                            | —                                           |
| Search              | `No results for "[query]"`   | `Try fewer words, or search by SKU.`                                                                                                                      | `Clear search`                              |

## 6. Confirmations and warnings

| Action                         | Heading                                   | Body                                                                                                                                                    | Buttons                                 |
| ------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Complete a run                 | `Complete this run?`                      | `[a] units will be added to stock and [n] materials deducted. The cost of ₱[x] will be locked and will not change if prices change later.`              | `Complete run` · `Keep editing`         |
| Reverse a completed run        | `Reverse this run?`                       | `This puts back the [n] materials it consumed and removes the [a] units it produced. Both the original run and the reversal stay visible.`              | `Reverse run` · `Cancel`                |
| Archive an item                | `Archive [item]?`                         | `It will stop appearing when you build recipes or record purchases. Everything it is already part of stays exactly as it is.`                           | `Archive` · `Cancel`                    |
| Archive a product with sales   | `Archive [product]?`                      | `It has [n] sales and [m] production runs. Archiving keeps all of them and only hides the product from new entries.`                                    | `Archive` · `Cancel`                    |
| Change a rate                  | `Add a new rate?`                         | `From [date], costs will use ₱[new] instead of ₱[old]. Anything recorded before that date keeps the old rate.`                                          | `Add rate` · `Cancel`                   |
| Change the overhead method     | `Change how overhead is spread?`          | `This changes the recommended price of every product. It does not change any past sale or production run.`                                              | `Change method` · `Cancel`              |
| Save a price below the minimum | `This price is below your minimum margin` | `₱[price] gives a [x]% margin. Your minimum for this product is [y]%.`                                                                                  | `Save anyway` · `Change the price`      |
| Save a sale below break-even   | `This sale loses money`                   | `At ₱[price] on [channel], contribution profit is −₱[loss]. Break-even is ₱[breakeven].`                                                                | `Record it anyway` · `Change the price` |
| Adjust stock downward sharply  | `That is a large reduction`               | `This removes [qty] [unit], which is [x]% of what is on hand and ₱[value] of stock value.`                                                              | `Record adjustment` · `Cancel`          |
| Reverse an import batch        | `Undo this import?`                       | `[n] records created by this import will be archived and [m] stock movements reversed. Anything created since that refers to them will block the undo.` | `Undo import` · `Cancel`                |
| Discard a form                 | `Leave without saving?`                   | `[n] lines you entered will be lost.`                                                                                                                   | `Discard` · `Keep editing`              |
| Sign out with unsaved work     | `You have unsaved work`                   | `[Screen name] has changes that have not been saved.`                                                                                                   | `Stay` · `Sign out anyway`              |

Destructive actions requiring typed confirmation: none in v1, because nothing is destroyed. If a hard delete is ever added, it requires typing the record's name.

## 7. Success messages

| Action                  | Message                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| Item saved              | `[Item] saved.`                                                         |
| Item archived           | `[Item] archived. It stays on every record it is already part of.`      |
| Purchase saved as draft | `Purchase saved as a draft. Nothing has been added to stock yet.`       |
| Purchase received       | `Stock updated. [n] items added.`                                       |
| Unit cost changed       | `[Item] is now ₱[new] per [unit], up from ₱[old].`                      |
| First cost set          | `[Item] now has a unit cost of ₱[new] per [unit].`                      |
| Recipe saved            | `Recipe saved. Production cost per unit is ₱[x].`                       |
| Run started             | `Run started. Record what happens as you go.`                           |
| Run completed           | `Run completed. [a] units added to stock at ₱[cost] each. Cost locked.` |
| Run reversed            | `Run reversed. Materials returned and units removed.`                   |
| Sale saved              | `Sale recorded. Contribution profit ₱[x].`                              |
| Adjustment recorded     | `[Item] adjusted to [qty] [unit].`                                      |
| Rate added              | `New rate in force from [date].`                                        |
| Import applied          | `[n] rows imported. [m] skipped.`                                       |
| Export ready            | `Export ready. [n] rows in [filename].`                                 |
| Settings saved          | `Settings saved.`                                                       |
| Password changed        | `Password changed. Use it next time you sign in.`                       |

## 8. Permission messages

Written for when roles become active.

| Situation                                     | Message                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Route not permitted                           | `This page is for owners. Your role is [role], which covers [summary]. Ask the owner if you need access.`      |
| Action not permitted                          | `Your role cannot [action]. Owners and managers can.`                                                          |
| Cost columns hidden                           | `Cost and profit figures are not shown for your role.`                                                         |
| Read-only role attempting a change            | `Your access is read-only. You can view and export, but not change records.`                                   |
| Owner viewing the people screen with no staff | `You are the only person with access. Roles for staff are built in and can be switched on when you need them.` |

## 9. Loading and progress

| Context           | Text                                                             |
| ----------------- | ---------------------------------------------------------------- |
| Page loading      | Skeletons only, no text                                          |
| Saving            | `Saving…` on the button, button disabled                         |
| Completing a run  | `Completing run…` with `This updates stock and locks the cost.`  |
| Import validating | `Checking [n] rows…`                                             |
| Import applying   | `Importing [n] of [total]…`                                      |
| Export building   | `Preparing your export…` with `Large exports can take a moment.` |
| Long report       | `Working out [report name]…`                                     |

## 10. Page metadata

Pattern: `[Page] — Production Costing`. The business name is not in the title because a private tool does not need it in a browser tab.

| Route         | Title                             | Description                                                                      |
| ------------- | --------------------------------- | -------------------------------------------------------------------------------- |
| `/login`      | `Sign in — Production Costing`    | `Sign in to your production costing and inventory system.`                       |
| `/dashboard`  | `Dashboard — Production Costing`  | `Inventory value, production cost, revenue and contribution profit at a glance.` |
| `/items`      | `Items — Production Costing`      | `Materials, components, packaging and finished products.`                        |
| `/purchases`  | `Purchases — Production Costing`  | `Purchases, added costs and the unit costs they produce.`                        |
| `/products`   | `Products — Production Costing`   | `Products, recipes, costs and prices.`                                           |
| `/production` | `Production — Production Costing` | `Production runs, output, failures and actual cost.`                             |
| `/sales`      | `Sales — Production Costing`      | `Sales, fees and contribution profit.`                                           |
| `/inventory`  | `Inventory — Production Costing`  | `Stock on hand, movements and valuation.`                                        |
| `/reports`    | `Reports — Production Costing`    | `Cost, inventory, production and profitability reports.`                         |
| `/settings`   | `Settings — Production Costing`   | `Business details, rates, channels and data.`                                    |

`robots`: `noindex, nofollow` on every route. This is a private system.

## 11. Mobile-specific labels

Shorter where the desktop label will not fit a 390 px column, never a different word.

| Desktop                              | Mobile               |
| ------------------------------------ | -------------------- |
| `Contribution profit`                | `Contribution`       |
| `Production cost per unit`           | `Cost per unit`      |
| `Full cost with overhead`            | `Full cost`          |
| `Cost of goods sold`                 | `Cost of goods`      |
| `Shipping charged to customer`       | `Shipping charged`   |
| `Shipping you actually paid`         | `Shipping paid`      |
| `Payment processing fee`             | `Payment fee`        |
| `Estimated cost per accepted unit`   | `Est. per unit`      |
| `Actual cost per accepted unit`      | `Actual per unit`    |
| `Expected failure rate`              | `Failure rate`       |
| `Inventory valuation`                | `Valuation`          |
| `Record a production run`            | `New run`            |
| `Sales and profitability by product` | `Profit by product`  |
| `Profitability by channel`           | `Profit by channel`  |
| `Estimated versus actual cost`       | `Estimate vs actual` |

Abbreviations permitted on mobile only: `Est.`, `Qty`, `Avg`. Never `COGS` alone, never `Contrib.`, never a truncated product name without a tooltip.

## 12. Accessibility strings

| Element                           | Accessible name                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Sidebar toggle                    | `Collapse navigation` / `Expand navigation`                                                                         |
| Expand a cost row                 | `Show how [component] was worked out`                                                                               |
| Sort a column                     | `Sort by [column], ascending` / `descending`                                                                        |
| Row action menu                   | `Actions for [record name]`                                                                                         |
| Status badge                      | `Status: [status]`                                                                                                  |
| Stat card                         | `[Label]: [value]. [Sub-label].`                                                                                    |
| Chart                             | A text summary before the chart: `[Metric] by [dimension], [range]. Highest [x] at [label], lowest [y] at [label].` |
| Filter button with active filters | `Filters, [n] active`                                                                                               |
| Required field                    | `[Label], required`                                                                                                 |
| Field with an error               | `[Label], invalid entry: [message]`                                                                                 |
| Loading region                    | `Loading [section name]`                                                                                            |
| Live profit panel                 | `aria-live="polite"`, announcing `Contribution profit [value]` on change                                            |
| Currency input                    | `[Label] in Philippine pesos`                                                                                       |
| Unit input                        | `[Label] in [unit]`                                                                                                 |
