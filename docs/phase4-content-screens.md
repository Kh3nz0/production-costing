# Phase 4 — Interface Content: Screens

Part 1 of 2. Every real string, organised by screen and component. No lorem ipsum, no placeholders. Lengths are realistic so the content can shape the layout.

Companion: `phase4-content-system.md` holds the glossary, errors, empty states, confirmations, tooltips and metadata.

Convention: **Label** is what appears on screen. Helper text sits under a field. Anything in square brackets is a variable.

---

## 1. Global

### Navigation, desktop sidebar

Group heading: `Operate` — Dashboard · Items · Purchases · Production · Sales · Inventory
Group heading: `Understand` — Products · Reports
Footer: `Settings`
Account menu: `Signed in as [email]` · `Settings` · `Sign out`

### Navigation, mobile tab bar

`Dashboard` · `Production` · `Sales` · `Inventory` · `More`

More sheet heading: `Everything else`
Items · Purchases · Products · Reports · Settings

Floating action button label: `Record`
Sheet heading: `What are you recording?`
`Record a sale` · `Start a production run` · `Record a purchase` · `Adjust stock`

### Buttons used throughout

`Save` · `Save and add another` · `Cancel` · `Back` · `Next` · `Done` · `Edit` · `Archive` · `Restore` · `Duplicate` · `Export CSV` · `Filter` · `Clear filters` · `Search` · `Add line` · `Remove line` · `Try again` · `Learn more`

Never used: Submit, OK, Delete, or Confirm on its own.

### Common column headings

`Name` · `SKU` · `Type` · `Category` · `Unit` · `On hand` · `Unit cost` · `Status` · `Date` · `Reference` · `Supplier` · `Channel` · `Quantity` · `Amount` · `Total` · `Recorded by` · `Recorded on`

---

## 2. Sign in

Meta title: `Sign in — Production Costing`

Heading: `Sign in`
Subheading: `Your production costs, inventory and profit in one place.`
Field: **Email address**
Field: **Password**
Link: `Forgot your password?`
Button: `Sign in`
Footer note: `This is a private system. Accounts are created by the owner.`

### Forgot password

Heading: `Reset your password`
Body: `Enter the email address you sign in with. If an account exists, we will send a reset link.`
Field: **Email address**
Button: `Send reset link`
Link: `Back to sign in`
Sent: `Check your email. If an account exists for [email], a reset link is on its way. The link expires in one hour.`

### Set a new password

Heading: `Choose a new password`
Body: `You are signed in through a recovery link. Set a new password to finish.`
Field: **New password** — Helper: `At least 10 characters.`
Field: **Confirm new password**
Button: `Save new password`

Expired link:
Heading: `That link has expired`
Body: `Reset links are valid for one hour. Request a new one and it will arrive in a moment.`
Button: `Send a new link`

---

## 3. Onboarding

Wizard heading: `Set up your business`
Progress: `Step [n] of 6`
Every step offers `Skip for now` beside `Continue`.

Skip explanation, shown once on step 2: `You can skip any step. Anything you skip is listed on your dashboard until you fill it in, and costs that need it will say what is missing rather than guessing.`

### Step 1 — Business

Heading: `Your business`
Body: `This sets how money and dates appear throughout the system.`
Field: **Business name** — Placeholder: `e.g. Bacani 3D Works`
Field: **Currency** — Default `Philippine peso (₱)` — Helper: `Used for every amount. You can change it later, but existing records keep the currency they were recorded in.`
Field: **Language and region** — Default `English (Philippines)`
Field: **Time zone** — Default `Asia/Manila (GMT+8)`
Field: **Logo** — Helper: `Optional. PNG or SVG, up to 2 MB.`

### Step 2 — Electricity

Heading: `Electricity rate`
Body: `Machine time costs electricity. Enter the rate from your latest bill so production runs carry a real figure.`
Field: **Rate per kilowatt-hour** — Prefix `₱` — Helper: `Use your total bill divided by total kWh used, not just the generation charge. Distribution, transmission, system loss and taxes all apply to the power a print consumes.`
Field: **Effective from** — Helper: `Runs recorded before this date keep whatever rate applied then.`
Field: **Bill reference** — Placeholder: `e.g. Meralco August 2026` — Helper: `So you can find where this number came from later.`

### Step 3 — Equipment

Heading: `Your equipment`
Body: `Equipment wears out. Spreading its cost across the hours it runs means each product carries a share of it.`
Field: **Equipment name** — Placeholder: `e.g. Bambu Lab P2S`
Field: **Purchase price** — Prefix `₱`
Field: **Purchase date**
Field: **Recover its cost over** — Suffix `months` — Default `36` — Helper: `The period you want the equipment to pay for itself across.`
Field: **Expected productive hours in that period** — Helper: `Not the manufacturer's lifespan. Four hours a day for 36 months is about 4,380.`
Field: **Maintenance allowance per year** — Prefix `₱` — Helper: `Optional. Nozzles, belts, build plates, anything you expect to replace. Counted across the recovery period above.`
Field: **Repair allowance per year** — Prefix `₱` — Helper: `Optional.`
Field: **Average power draw** — Suffix `watts` — Helper: `Measure this with a plug meter over one full print if you can. The rated figure on the box is peak draw with the bed and hotend both heating, which is not what a long print actually uses.`

Computed readout: `Cost recovery rate: ₱[x] per hour`
Explanation: `(purchase price + maintenance and repairs over [n] months) ÷ expected productive hours`

### Step 4 — Labour

Heading: `What your time is worth`
Body: `Add the activities you actually do. You can add more later.`
Field: **Activity name** — Placeholder: `e.g. Assembly`
Field: **Hourly rate** — Prefix `₱`
Toggle: **Your hands are occupied** — Helper: `On for work you are doing. Off for time the machine runs on its own. Unattended time should not be charged at a full labour rate, or a nine-hour print ends up priced like nine hours of work.`
Button: `Add another activity`

### Step 5 — Overhead

Heading: `Monthly running costs`
Body: `Costs that keep the business going but do not belong to any one product: internet, software, workspace, tools. These are recovered across everything you sell.`
Rows: `Workspace` · `Software subscriptions` · `Internet` · `Tools` · `Maintenance` · `Marketing` · `General supplies` · `Administrative time`
Button: `Add a category`
Field: **Expected working hours per month** — Helper: `Hours where your hands are occupied, not hours the machine runs. This is what your overhead is spread across.`

Computed readout: `Overhead rate: ₱[x] per working hour`
Explanation: `₱[pool] monthly ÷ [hours] expected hours`

Method selector: **How to spread overhead**

- `Per working hour (recommended)` — `Overhead follows the time you spend. Products that take more of your attention carry more of it.`
- `As a percentage of production cost` — `Overhead scales with how expensive a product is to make. Simpler, but a cheap product that takes an hour of handling carries very little.`

### Step 6 — Where you sell

Heading: `Sales channels`
Body: `Each channel takes a different cut. Recording them here means prices can account for it.`
Columns: `Channel` · `Commission` · `Payment fee` · `Fixed fee per order`
Prefilled: `Direct sale` · `Facebook` · `TikTok Shop` · `Shopee` · `Event or bazaar` · `Wholesale`
Helper: `Get the current rate card from each platform. Record commission and payment processing separately even if the platform quotes one combined number, because they change independently.`
Button: `Finish setup`

### Completion

Heading: `You are set up`
Body: `Next, add the materials and components you buy. Once an item has a purchase behind it, its unit cost is worked out for you.`
Button: `Add your first item`
Secondary: `Import from a spreadsheet instead`

---

## 4. Dashboard

Meta title: `Dashboard — Production Costing`
Heading: `[Business name]`
Subheading: `[Month] at a glance`

### Setup incomplete card

Heading: `Finish setting up`
Body: `[n] things are still missing. Costs that need them will say so rather than guessing.`
Items: `Electricity rate not set` · `No equipment recorded` · `No labour activities` · `Overhead not set` · `No sales channels`
Button: `Continue setup`

### Stat cards

| Label                            | Sub-label                                                            |
| -------------------------------- | -------------------------------------------------------------------- |
| `Inventory value`                | `[n] items on hand`                                                  |
| `Production cost this month`     | `[n] runs completed`                                                 |
| `Revenue this month`             | `[n] sales`                                                          |
| `Contribution profit this month` | `[x]% of net revenue`                                                |
| `Average contribution margin`    | `Across sales this month, after fees`                                |
| `Waste rate`                     | `Value of material wasted against value used`                        |
| `Failure rate`                   | `Units rejected against units started, all products counted equally` |

### Overhead recovery

Heading: `Overhead recovered this month`
Value: `₱[recovered] of ₱[pool]`
Under target: `₱[gap] short of covering this month's running costs.`
At or over: `Running costs covered. ₱[surplus] beyond them so far.`
Tooltip: `Overhead is not charged to each product. It is covered by the total contribution profit your sales produce. When this bar passes the line, the month has paid for itself.`

### VAT threshold

Heading: `Sales against the VAT threshold`
Value: `₱[rolling12] of ₱3,000,000`
Sub-label: `Rolling 12 months to [date]`
Below 80%: `You are below the registration threshold.`
At 80% or above: `You are approaching ₱3,000,000. Businesses must register for VAT within 30 days of the end of the month in which they cross it. Worth raising with your accountant.`
Tooltip: `This is a count of your recorded sales, not tax advice.`

### Low stock

Heading: `Low stock`
Empty: `Nothing is below its reorder point.`
Row: `[Item]` · `[qty] [unit] left` · `Reorder at [qty]`
Link: `View all items`

### Below target margin

Heading: `Products below target margin`
Empty: `Every product is at or above its target.`
Row: `[Product]` · `[current]% against [target]% target`
Link: `Review pricing`

### Costs that went up

Heading: `Costs that went up`
Sub-label: `Compared with 30 days ago`
Row: `[Item]` · `₱[old] → ₱[new] per [unit]` · `+[x]%`
Empty: `No item cost has risen in the last 30 days.`
Tooltip: `Unit costs are an average of what you have paid. A price rise shows up here gradually as new stock arrives.`

### Activity

`Recent purchases` · `Recent production runs` · `Recent sales` · `Best sellers this month` · `Most profitable products`
Best sellers row: `[Product]` · `[n] sold` · `₱[revenue]`
Most profitable row: `[Product]` · `₱[contribution]` · `[x]% margin`

---

## 5. Items

Meta title: `Items — Production Costing`
Heading: `Items`
Description: `Everything you buy, make or keep in stock.`
Buttons: `New item` · `Import items`

Filters: `All types` · `Raw materials` · `Components` · `Packaging` · `Consumables` · `Subassemblies` · `Finished products`
Toggle: `Show archived`
Search placeholder: `Search by name or SKU`

Columns: `Item` · `Type` · `On hand` · `Unit cost` · `Value` · `Status`
Status badges: `In stock` · `Low` · `Out of stock` · `No cost yet` · `Archived`

### Item form

Heading, new: `New item`. Heading, edit: `Edit [item name]`

Section: `What it is`
Field: **Name** — Placeholder: `e.g. PLA Basic Filament`
Field: **Type** — Helper: `This decides where the item appears and how it can be used. A subassembly is something you make and then use inside something else.`
Field: **SKU or internal code** — Helper: `Optional. Must be unique.`
Field: **Category** · Field: **Brand** · Field: **Colour** · Field: **Description**
Field: **Photo** — Helper: `Optional.`

Section: `Units`
Field: **Unit you consume it in** — Helper: `The unit you use when building a recipe. Grams for filament, pieces for switches, millimetres for chain.`
Field: **Unit you buy it in** — Helper: `Leave the same if you buy and use it the same way.`
Field: **How much of the consuming unit is in one buying unit** — Placeholder: `e.g. 1000` — Helper: `A 1 kg filament spool holds 1000 g, so enter 1000. A 750 g spool is 750. A pack of 90 switches is 90. Getting this wrong is the most common cause of a wrong material cost.`

Section: `Stock`
Field: **Reorder at** — Helper: `You will be warned when the quantity on hand falls to this level.`
Field: **Preferred supplier**
Field: **Supplier lead time** — Suffix `days`
Field: **Notes**

### Item detail

Tabs: `Overview` · `Stock` · `Cost history` · `Movements` · `Used in`
Readouts: `On hand` · `Unit cost` · `Stock value` · `Reorder at` · `Last purchased` · `Preferred supplier`

`Unit cost` tooltip: `A weighted average of everything you have paid for this item, including the share of shipping and other costs allocated to it. It changes when new stock arrives, not when you edit anything.`
No cost state: `No cost yet. Record a purchase or an opening balance and a unit cost will be worked out from it.`

Cost history columns: `Date` · `Event` · `Quantity` · `Cost of that batch` · `Average after` · `Change`
Introduction: `Each row shows what you paid and what the running average became. This is why a cost moved.`

Used in: `This item appears in [n] recipes.` Columns `Product` · `Quantity per unit` · `Waste` · `Cost contribution`
Empty: `This item is not used in any recipe yet.`

Buttons: `Record a purchase` · `Adjust stock` · `Archive item`

---

## 6. Suppliers

Heading: `Suppliers`
Description: `Where you buy from.`
Button: `New supplier`
Columns: `Supplier` · `Items bought` · `Total spent` · `Last purchase`

Form fields: **Supplier name** · **Contact person** · **Phone** · **Email** · **Address** · **Store or platform** (Placeholder: `e.g. Shopee, Lazada, physical store`) · **Typical lead time** (Suffix `days`) · **Notes**

Detail readouts: `Total spent` · `Purchases` · `Items supplied` · `Average lead time`

---

## 7. Purchases

Heading: `Purchases`
Description: `What you bought, what it cost you, and what that made each item worth.`
Buttons: `New purchase` · `Import purchases`
Filters: `All` · `Draft` · `Received` · `Partially received` · `Cancelled`
Columns: `Date` · `Supplier` · `Reference` · `Lines` · `Total` · `Status`

### Purchase form

Section: `Purchase details`
Field: **Supplier** · **Purchase date**
Field: **Reference number** — Helper: `Optional. An order number or receipt number so you can find it again.`
Field: **Receipt** — Helper: `Optional. Attach a photo or PDF.`

Section: `What you bought`
Columns: `Item` · `Quantity` · `Unit` · `Unit price` · `Discount` · `Line total`
Button: `Add line`

Section: `Added costs`
Field: **Supplier shipping** — Prefix `₱`
Field: **Duties** — Prefix `₱`
Field: **Other costs** — Prefix `₱` — Helper: `Handling, clearance, anything else that was part of getting this delivered.`
Field: **Purchase discount** — Prefix `₱` — Helper: `A discount on the whole order rather than on one line.`

Field: **How to spread added costs**

- `By value (recommended)` — `Spread in proportion to what each line cost. Always valid.`
- `By quantity` — `Spread evenly across units. Only available when every line uses the same kind of unit.`
- `By weight` — `Spread in proportion to weight. Only available when every line has a weight.`
  Disabled reason: `Unavailable because this purchase mixes grams and pieces, so a total quantity would not mean anything.`

Section: `VAT`
Field: **VAT treatment** — Default `Included in the price, not reclaimable`
Options: `Included in the price, not reclaimable` · `Added on top, reclaimable` · `Exempt` · `Zero-rated`
Helper: `While you are not VAT-registered, the VAT you pay is part of what the item costs you. If you register later, it stops being a cost and this setting is how the system tells the difference.`
Field: **VAT amount** — Helper: `Optional. Record it if the receipt shows it separately.`

### Allocation preview

Heading: `How added costs will be spread`
Body: `₱[extras] will be spread across [n] lines by [base]. This is what each item will end up costing.`
Columns: `Item` · `Line total` · `Share of added costs` · `Landed total` · `New unit cost` · `Change from current`
Footer: `Allocated: ₱[total]. This matches the added costs exactly.`
Buttons: `Save as draft` · `Receive now`

### Receiving

Heading: `Receive [reference]`
Body: `Confirm what actually arrived. Quantities default to what you ordered.`
Columns: `Item` · `Ordered` · `Received` · `Unit`
Helper: `If less arrived than you ordered, change the received quantity. The cost follows what arrived.`
Button: `Confirm and add to stock`

Confirmation heading: `Stock updated`
Body: `[n] items added. Here is what changed.`
Row: `[Item]: [qty] [unit] added. Unit cost ₱[old] → ₱[new].`
First purchase row: `[Item]: [qty] [unit] added. Unit cost is now ₱[new].`
Buttons: `Done` · `Record another purchase`

---

## 8. Products

Meta title: `Products — Production Costing`
Heading: `Products`
Description: `What you make and sell, and what each one costs you.`
Buttons: `New product` · `Import products`

Filters: `All` · `Below target margin` · `No recipe` · `Incomplete cost` · `Archived`
Columns: `Product` · `Variant` · `Production cost` · `List price` · `Margin` · `Status`
Badges: `On target` · `Below target` · `Incomplete cost` · `No recipe` · `Archived`

Tabs on detail: `Overview` · `Recipe` · `Cost` · `Pricing` · `Variants` · `History`

### Product form

Field: **Product name** — Placeholder: `e.g. Clickable Keychain`
Field: **Variant** — Placeholder: `e.g. 3-switch, black` — Helper: `Optional. Variants share a recipe and differ only where you tell them to.`
Field: **SKU** · **Category** · **Description** · **Photo**
Field: **Units made per run** — Helper: `How many you normally make at once. Used to estimate a batch.`
Field: **Expected failure rate** — Suffix `%` — Helper: `Out of every hundred you start, how many do you normally throw away. If you do not know yet, leave this blank rather than guessing. Failures you expect are spread across the good units; failures beyond this rate are reported as a loss instead.`
Field: **Target margin** — Suffix `%`
Field: **Minimum acceptable margin** — Suffix `%` — Helper: `You will be warned before saving a price below this.`

### Recipe tab

Heading: `Recipe`
Description: `Everything that goes into one unit. Also called a bill of materials.`
Empty: `No recipe yet. Add what goes into one unit and a cost will be worked out from it.`
Button: `Add a line`

Line type picker heading: `What kind of line?`

- `Material` — `Something consumed by quantity, like filament.`
- `Component` — `Something used whole, like a switch or key ring.`
- `Packaging` — `Bags, boxes, cards, labels.`
- `Subassembly` — `Something you make separately and use inside this.`
- `Machine time` — `How long equipment runs for one unit.`
- `Labour` — `An activity and how long it takes for one unit.`
- `Other cost` — `A fixed amount per unit that does not fit above.`

Columns: `Line` · `Item or activity` · `Quantity per unit` · `Unit` · `Waste` · `Cost per unit`
Field: **Waste** — Suffix `%` — Helper: `Material lost rather than used: purge, supports, brim, spillage. If the grams you entered already include support and purge, leave this at zero so it is not counted twice.`

Machine time helper: `Print or run time for one unit. Take it from your slicer and divide by how many the plate makes.`
Labour helper: `Time for one unit. If you assemble ten in twenty minutes, that is two minutes each.`

Footer: `Production cost per unit: ₱[x]` · `Full cost with overhead: ₱[y]`

### Cost tab

Heading: `Cost breakdown`
Description: `Where every peso goes, and where each figure came from.`

Summary pair:

- `Production cost per unit` — Tooltip: `What one unit is worth in stock, and what will be charged against a sale as cost of goods sold. Materials, components, packaging, machine time, electricity and labour, with expected failures spread across the good units. Overhead is not included here.`
- `Full cost with overhead` — Tooltip: `Production cost plus a share of your monthly running costs. Use this when setting a price. It is never used as stock value, because your internet bill is not something sitting on a shelf.`

Breakdown rows, in order:
`Materials` · `Components` · `Packaging` · `Subassemblies` · `Machine time` · `Electricity` · `Labour` · `Other` · `Expected failure allowance`
Subtotal row: `Production cost per unit`
Then: `Overhead`
Total row: `Full cost with overhead`

Each row: amount, share of total, and an expand control.
`Electricity` helper: `Worked out from machine time, your equipment's power draw and your electricity rate. There is no separate electricity line in a recipe.`
`Expected failure allowance` is the difference between what the recipe consumes and what a good unit ends up carrying, so the rows above add up to the subtotal.
Expanded detail: `[Quantity] [unit] × ₱[unit cost] = ₱[amount]` and below it `Rate in force: [rate name], effective [date]`
Inside an expanded row, unit costs show six decimal places and amounts four, so the arithmetic on screen adds up. `19.320 g × ₱1.203083 = ₱23.2436`. Rounding to two places here would show `19.320 × ₱1.20 = ₱23.24` and invite the reader to check it and find it wrong.

Expected failure allowance explanation: `You expect [x]% of units to fail. Starting enough to get [n] good ones costs more than making [n], and that difference is spread across the good units.`

Incomplete banner: `This cost is incomplete. [n] things are missing, so the total is lower than reality.`
Missing list row: `No electricity rate set — machine electricity is not counted. Set a rate.`
Missing list row: `PLA Basic Filament has no cost yet — record a purchase or an opening balance.`

Batch panel heading: `For a batch of [n]`
Rows: `Units to start` · `Expected failures` · `Estimated batch cost` · `Estimated cost per accepted unit`
`Units to start` helper: `To end up with [n] good units at a [x]% failure rate, start [m].`

### Pricing tab

Heading: `Pricing`
Description: `What to charge, and what is left after everything is taken out.`

Field: **Target margin** — Suffix `%`
Toggle pair heading: `Set your target by`

- `Margin` — `Profit as a share of the price you charge.`
- `Markup` — `Profit as a share of what it cost you.`

Side-by-side panel heading: `These are not the same thing`
Body: `A 40% margin on a ₱60 cost gives a price of ₱100. A 40% markup on the same cost gives ₱84. Both are called forty percent and they are ₱16 apart.`
Columns: `Target` · `Price` · `Profit` · `Margin` · `Markup`

Channel table heading: `Price by channel`
Description: `Each channel takes a cut, so the price that reaches your target differs.`
Columns: `Channel` · `Commission` · `Payment fee` · `Price for [x]% margin` · `Expected contribution margin` · `Loses money below` · `Covers overhead above`

`Expected contribution margin` helper: `Higher than your target, and that is correct. Your target is set on the full cost including overhead. Contribution margin is measured after the cost of the goods only, because overhead is never part of what a unit is worth in stock. The gap between the two is the overhead this price recovers.`

`Loses money below` tooltip: `Below ₱[x] this sale earns nothing once the cost of the goods and the channel's fees are taken out.`
`Covers overhead above` tooltip: `Above ₱[y] the sale also carries its share of your monthly running costs. Between ₱[x] and ₱[y] you make something, but not enough to cover the month.`

Band explanation shown once: `Between ₱[x] and ₱[y] a sale is profitable but not self-sufficient. Selling everything in that band means a busy month that still does not pay its own running costs.`

Field: **Planned discount** — Suffix `%` — Helper: `If you plan to run a discount, the price has to be higher to survive it. Leave at zero if not.`

Button: `Save a pricing snapshot`
Snapshot helper: `Records today's cost, rates and price so you can tell a customer a figure and still know later what it assumed.`

Snapshot list columns: `Taken on` · `Channel` · `Cost used` · `Price` · `Margin`

### Variants tab

Heading: `Variants`
Description: `Variants share this recipe. Add only what differs.`
Columns: `Variant` · `Differences` · `Production cost` · `List price` · `Margin`
Button: `Add a variant`
Empty: `No variants. Add one if you sell this in more than one size, colour or configuration.`

Variant form field: **What is different** — Helper: `Change only the lines that differ. Everything else follows the main recipe, so a price change to switches updates every variant at once.`

---

## 9. Production

Meta title: `Production — Production Costing`
Heading: `Production runs`
Description: `What you made, what it actually cost, and what went wrong.`
Button: `Start a run`

Filters: `All` · `Planned` · `In progress` · `Completed` · `Cancelled`
Columns: `Date` · `Product` · `Accepted` · `Failed` · `Cost per unit` · `Against estimate` · `Status`
Badges: `Planned` · `In progress` · `Completed` · `Cancelled` · `Cost locked`

### Start a run

Heading: `Start a production run`
Field: **Product**
Field: **Variant**
Field: **How many good units do you want** — Helper: `The number you want to end up with, not the number to start.`

Readout: `Start [m] to get [n] good units`
Explanation: `At a [x]% expected failure rate, [m] starts should give you [n] accepted units.`

Section: `Expected to be consumed`
Description: `Based on the current recipe. You can change any of this when you record what actually happened.`
Columns: `Line` · `Item or activity` · `Expected quantity` · `Unit` · `Expected cost`
Footer: `Estimated run cost: ₱[x]` · `Estimated cost per accepted unit: ₱[y]`

Button: `Start run`
Secondary: `Save as planned`

### Record what happened

Heading: `[Product] — [date]`
Tabs: `Consumption` · `Output` · `Review`

Consumption heading: `What was actually used`
Description: `Quantities default to what the recipe expected. Change anything that differed.`
Columns: `Line` · `Expected` · `Actual` · `Unit` · `Cost`
Field: **Machine time** — Helper: `Total run time for the whole batch.`
Field: **Labour time** — Helper: `Total for the whole batch, not per unit.`

Output heading: `What came out`
Field: **Accepted units** — Helper: `Units good enough to sell or use.`
Field: **Failed units** — Helper: `Units rejected. These do not go into stock.`
Field: **Wasted material** — Helper: `Material thrown away beyond what the recipe expected: failed purge, a spill, a spool that jammed.`
Waste line columns: `Item` · `Quantity` · `Unit` · `Reason`

### Review

Heading: `Before you complete this run`
Description: `Once completed, this run's cost is locked. Later price changes will not alter it.`

Rows: `Actual run cost` · `Units started` · `Units accepted` · `Units failed`

Failure panel, within expectation:
`[n] failed, and you expected about [m]. That is normal, so their cost is spread across the [a] accepted units.`

Failure panel, above expectation:
Heading: `More failed than expected`
Body: `[n] units failed. At your expected rate of [x]%, about [m] was normal. The other [k] cost ₱[loss], and that is recorded as a production loss rather than added to the value of the good units.`
Explanation: `Without this, your [a] good units would each appear to cost ₱[naive] instead of ₱[real], and a bad night would look like an expensive product.`

Rows: `Cost carried into stock` · `Production loss` · `Cost per accepted unit` · `Estimated cost per unit` · `Difference`
Difference readout: `₱[x] [over|under] estimate, [y]%`

Button: `Complete run`

### After completion

Heading: `Run completed`
Body: `[a] units added to stock at ₱[cost] each. Cost locked.`
Section: `What moved`
Rows: `[Item]: −[qty] [unit]` · `[Product]: +[a] units` · `Failed: [n] units` · `Wasted: [qty] [unit] of [item]`
Buttons: `View run` · `Start another run`

Locked notice on a completed run: `This run's cost was locked on [date]. It used the rates in force then, listed below. Changing a price today does not change this.`
Rates list: `Electricity ₱[x]/kWh, effective [date]` · `[Equipment] ₱[y]/hour, effective [date]` · `[Activity] ₱[z]/hour, effective [date]` · `Recipe revision [n]`

---

## 10. Sales

Meta title: `Sales — Production Costing`
Heading: `Sales`
Description: `What you sold and what you actually kept.`
Button: `Record a sale`

Filters: `All` · `This month` · `By channel` · `Estimated cost` · `Unpaid`
Columns: `Date` · `Channel` · `Products` · `Revenue` · `Contribution profit` · `Margin`
Badges: `Paid` · `Unpaid` · `Fulfilled` · `Estimated cost`

### Record a sale

Heading: `Record a sale`
Field: **Date** — Default today
Field: **Channel** — Default: last used
Field: **Reference number** — Helper: `Optional. An order number from the platform.`
Field: **Customer name** — Helper: `Optional.`

Section: `What was sold`
Columns: `Product` · `Quantity` · `Unit price` · `Discount` · `Line total`
Unit price helper: `Defaults to this channel's list price. Change it if you sold for something else.`

Section: `Costs of this sale`
Field: **Commission** — Prefix `₱` — Helper: `Prefilled at [x]% of revenue from this channel's current rate. Change it if the platform charged something else.`
Field: **Payment processing fee** — Prefix `₱` — Helper: `Prefilled at [x]% of revenue.`
Field: **Other costs** — Prefix `₱` — Helper: `Anything else this specific sale cost you.`
Field: **Shipping charged to customer** — Prefix `₱`
Field: **Shipping you actually paid** — Prefix `₱` — Helper: `If you charged less than you paid, the difference comes out of your profit.`
Field: **Payment status** · Field: **Fulfilment status** · Field: **Notes**

### Live profit panel

Heading: `What this sale earns`
Rows:
`Revenue` · `Cost of goods sold` · `Gross profit` · `Gross margin`
`Commission` · `Payment fee` · `Other costs` · `Shipping result`
`Net revenue` · `Contribution profit` · `Contribution margin`

Shipping result, subsidy: `−₱[x]. You charged ₱[a] and paid ₱[b].`
Shipping result, surplus: `+₱[x]. You charged ₱[a] and paid ₱[b].`

`Cost of goods sold` tooltip: `What these units cost you to produce, taken from the stock they came out of. It does not change when your material prices change later.`
`Contribution profit` tooltip: `What is left after the cost of the goods, fees, discounts and shipping. It is not net profit: it does not include your monthly running costs, taxes, or anything else you pay to keep the business going.`
`Gross margin` tooltip: `Profit before fees, as a share of revenue.`
`Contribution margin` tooltip: `Profit after fees, as a share of the money that actually reached you.`

Comparison note shown when they differ by more than ten points: `Gross margin is [a]% but contribution margin is [b]%. Fees and shipping took ₱[x] of this sale.`

Button: `Save sale`

### No costed stock

Heading: `There is no costed stock for [product]`
Body: `You have no units of this product in stock, so there is nothing to take a cost from. Recording a production run first gives this sale a real cost.`
Buttons: `Record the production run first` · `Save anyway using the estimate`
Override explanation: `The sale will use the current production cost per unit of ₱[x], which excludes overhead as a real cost of goods sold would, and be marked Estimated cost. It will appear in the Estimated cost report so you can correct it once the run is entered.`

---

## 11. Inventory

Heading: `Inventory`
Description: `What is on hand, what it is worth, and everything that changed it.`
Tabs: `On hand` · `Movements` · `Valuation`
Buttons: `Adjust stock` · `Record opening balances`

On hand columns: `Item` · `Type` · `On hand` · `Unit cost` · `Value` · `Reorder at` · `Status`
Filter: `Low stock only`
Footer: `Total inventory value: ₱[x] across [n] items`

### Movements

Description: `Every change to stock, in order. Nothing here is ever edited or removed; corrections are recorded as their own entry.`
Columns: `Date` · `Item` · `Type` · `Change` · `Balance after` · `Unit cost` · `Value effect` · `Source` · `Recorded by`
Type labels: `Opening balance` · `Purchase received` · `Used in production` · `Produced` · `Production failure` · `Waste` · `Sold` · `Customer return` · `Supplier return` · `Damaged` · `Adjustment`
Filters: `Item` · `Type` · `Date range`

### Valuation

Heading: `Inventory valuation`
Field: **As of** — Default today — Helper: `Shows what your stock was worth on that date, using the costs that applied then.`
Columns: `Item` · `Type` · `Quantity` · `Unit cost` · `Value`
Grouped totals by type, then: `Total: ₱[x]`

### Adjust stock

Heading: `Adjust stock`
Body: `Use this when the real quantity differs from what the system shows: a count, a breakage, a mistake.`
Field: **Item**
Field: **New quantity** — Helper: `What is actually there. The difference is recorded as an adjustment.`
Readout: `Change: [+/−][qty] [unit]`
Field: **Reason** — Required — Helper: `Required. Future you will want to know why this number moved.`
Field: **Type** — Options `Stock count` · `Damage` · `Correction` · `Other`
Button: `Record adjustment`

### Opening balances

Heading: `Record opening balances`
Body: `For stock you already own and are not entering a purchase for. Enter what is on the shelf and what you believe it cost.`
Columns: `Item` · `Quantity` · `Unit` · `Unit cost` · `As of date`
Helper: `If you do not know what it cost, leave the cost blank. The item will show no unit cost until your next purchase, which is more honest than a guess.`

---

## 12. Reports

Heading: `Reports`
Description: `Filter by date, read on screen, export to CSV.`

| Report                               | Description                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| `Product cost breakdown`             | `What each product costs to make, split by component.`                       |
| `Inventory on hand`                  | `Current quantities and values for every item.`                              |
| `Inventory movements`                | `Every stock change with its source.`                                        |
| `Inventory valuation`                | `What your stock was worth on a given date.`                                 |
| `Purchase history`                   | `What you bought, when, and at what unit cost.`                              |
| `Supplier spending`                  | `Where your money goes.`                                                     |
| `Production history`                 | `Runs, output and actual cost per unit.`                                     |
| `Failures and waste`                 | `What was rejected and thrown away, and what it cost.`                       |
| `Sales and profitability by product` | `Revenue, cost of goods sold and contribution profit per product.`           |
| `Profitability by channel`           | `What each channel earns after its fees.`                                    |
| `Estimated versus actual cost`       | `Where runs cost more or less than expected, and which component caused it.` |
| `Cost changes`                       | `Items whose unit cost moved, and by how much.`                              |

Shared controls: **From** · **To** · `Apply` · `Clear` · `Export CSV`
Export note: `The CSV contains the same rows, filters and totals as the screen.`

Estimate versus actual note: `Each run is compared against the estimate as it stood when the run started, not against today's estimate. Comparing against a current estimate would make past variance change every time a price moved.`

---

## 13. Settings

Heading: `Settings`
Sections: `Business` · `Units` · `Equipment` · `Utility rates` · `Labour` · `Overhead` · `Sales channels` · `Pricing defaults` · `Import` · `Export and backup` · `People`

### Shared pattern for versioned rates

Section note: `Changing a rate creates a new version from a date you choose. Older records keep the rate that applied when they were recorded.`
Columns: `Effective from` · `Rate` · `Recorded by` · `Recorded on`
Button: `Add a new rate`
Field: **Effective from** — Helper: `Anything recorded before this date keeps the previous rate.`
Current badge: `In force` · Past badge: `Superseded`
Stale warning: `This rate was set [n] months ago. Costs using it may no longer reflect reality.`

### Pricing defaults

Field: **Default target margin** — Suffix `%`
Field: **Round prices to** — Options `No rounding` · `Nearest ₱1` · `Nearest ₱5` · `Nearest ₱10`
Field: **Price ending** — Options `None` · `End in 9` · `End in 5` — Helper: `Applied after rounding. A ₱166.54 price becomes ₱169 with rounding to ₱1 and an ending of 9.`

### People

Heading: `People`
Body: `You are the only person with access. Roles for staff are built into the system and can be switched on when you need them.`
Columns: `Person` · `Role` · `Added`
Role descriptions:

- `Owner` — `Everything, including costs, prices, settings and people.`
- `Manager` — `Everything operational. Cannot change rates, settings or people.`
- `Production` — `Production runs and stock. Cannot see costs or profit.`
- `Inventory` — `Purchases, receiving and stock counts. Cannot see profit.`
- `Read-only` — `Reports and exports. Cannot change anything.`
  Note: `Roles other than Owner are not active yet. Turning them on needs no change to your data.`

### Export and backup

Heading: `Export and backup`
Body: `Your data is yours. There are two ways to take it out, and they do different jobs.`

Card: `Export everything to CSV`
Body: `One file per table, in a single archive, readable in any spreadsheet. This is the copy that stays readable no matter what happens to this application.`
Button: `Export all data`

Card: `Database backup`
Body: `A full database dump runs every week and is kept for twelve weeks. This is what an actual restore uses. A spreadsheet export cannot restore a database, because it loses the rules that keep your data correct.`
Row: `Last backup: [date]` · `Status: [Succeeded|Failed]`
Failed state: `The last backup failed on [date]. Backups that fail quietly are worse than none, so this will keep telling you until it succeeds.`
