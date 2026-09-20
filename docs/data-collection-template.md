# Data Collection Template

Purpose: tell you exactly what to gather, in what unit, before the database exists. Fill the CSV files in `production-costing/data-templates/`. They double as the CSV import specification for the build, so the columns will not change under you.

Rules

- Leave a cell blank if you do not know it yet. Do not guess. A blank is recoverable; a made-up number becomes a wrong price you trust.
- Rows marked EXAMPLE are there to show the shape. Delete them before import.
- Record prices exactly as paid, including VAT and including shipping where the supplier charged it separately (there is a column for that).
- One decimal separator, no thousands separators, no peso sign. `1250.50`, not `₱1,250.50`.
- Dates as `YYYY-MM-DD`.

## Fill order

Work top to bottom. Later files reference names from earlier ones.

| Order | File                                         | What you need in front of you                                                           | Effort  |
| ----- | -------------------------------------------- | --------------------------------------------------------------------------------------- | ------- |
| 1     | `01-units.csv`                               | Nothing. Edit only if you use a unit not listed                                         | 5 min   |
| 2     | `03-suppliers.csv`                           | Where you buy: shop names, Shopee/Lazada seller names, physical stores                  | 15 min  |
| 3     | `02-items.csv`                               | Every material, component, packaging item you use. Names and units only, no prices here | 45 min  |
| 4     | `04-purchases.csv` + `05-purchase-lines.csv` | Receipts, order confirmation emails, Shopee/Lazada order history                        | 1–2 hrs |
| 5     | `06-opening-stock.csv`                       | A physical count of what is on your shelf right now                                     | 1 hr    |
| 6     | `07-equipment.csv`                           | Bambu Lab P2S receipt and your own estimate of hours run                                | 20 min  |
| 7     | `08-utility-rates.csv`                       | Your latest Meralco bill                                                                | 10 min  |
| 8     | `09-labor-activities.csv`                    | Your own judgement. Time yourself on one real batch                                     | 30 min  |
| 9     | `10-overhead.csv`                            | Monthly bills: internet, subscriptions, workspace                                       | 20 min  |
| 10    | `11-products.csv` + `12-bom-lines.csv`       | Bambu Studio slicer output per product, and one real product in your hand               | 1–2 hrs |
| 11    | `13-sales-channels.csv`                      | Fee schedules of each platform you sell on                                              | 30 min  |

## The figures that need care

**Filament.** Record the spool as you buy it: purchase unit `spool`, factor `1000` because a 1 kg spool holds 1000 g, base unit `g`. Then a print that uses 18.4 g costs 18.4 x (spool price ÷ 1000). If you buy a 750 g spool, the factor is 750, not 1000. This is the single most common place a cost goes wrong.

**Switch and keycap packs.** If a pack contains 90 switches, the factor is 90. If packs vary, create separate items or record each purchase with the real count received.

**Chain and other length materials.** Base unit is millimetres so that 7 cm is 70 and no rounding is lost. Buying 5 m means factor 1000 on a `m` purchase unit.

**Bambu Lab P2S — the three numbers that matter.**

1. Purchase price as paid.
2. Expected productive hours over the recovery period you choose. Not the manufacturer's lifespan. If you expect to run it 4 hours a day for 3 years, that is roughly 4,380 hours. Desktop printers are commonly assumed to last 3,000–10,000 print hours, so anything in that band is defensible.
3. Measured average power draw in watts, not the rated maximum. The rated figure is the peak with bed and hotend both heating; averaged over a long print the real draw is far lower. If you can measure it with a plug meter for one full print, do that — it is the difference between a believable electricity cost and a fictional one.

**Meralco rate.** Use total bill amount divided by total kWh consumed, not the generation charge alone. Your bill has distribution, transmission, system loss, taxes and subsidies on top, and a print consumes all of them. Record the bill month as the reference so the rate is dated.

**Labour rates.** Pick one number for what an hour of your time is worth and apply it consistently. The `attended` column matters: `yes` means your hands are occupied, `no` means the machine is running and you are free. Unattended time must not be charged at a full labour rate — that is the most common way a 9-hour print gets priced at an absurd figure.

**Expected failure rate.** Count, over your last several batches, how many units you threw away out of how many you started. If you genuinely do not know, leave it blank rather than writing 5 because a calculator suggested it.

**Waste percent on a BOM line.** This is material lost, not units lost: purge, supports, brim, spillage. From Bambu Studio you can read the difference between the model's filament and the total including support and purge. If you record grams that already include support and purge, set waste to 0 and say so in the notes, otherwise you will count it twice.

**Sales-channel fees.** Get the actual current rate card for each platform. Record commission and payment processing separately even if the platform quotes one combined number, because they change independently.

## What not to collect yet

Customers, quotations, past sales history, and anything to do with tax filing. None of it is needed for the first usable release, and gathering it now would slow the parts that block the build.
