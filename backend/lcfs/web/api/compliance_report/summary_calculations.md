# Compliance Report Summary Calculations

## Overview

This document explains the structure and calculation methodology used in the Compliance Report Summary, which is a critical component of the Low Carbon Fuel Standard (LCFS) system. The summary calculations determine an organization's compliance with renewable fuel requirements, carbon intensity reduction targets, and any associated penalties.

## Compliance Report Summary Structure

The Compliance Report Summary is divided into three main sections:

1. **Renewable Fuel Target Summary** (lines 1-11)
2. **Low Carbon Fuel Target Summary** (lines 12-22)
3. **Non-Compliance Penalty Summary**

## Section 1: Renewable Fuel Target Summary (Lines 1-11)

This section calculates compliance with the renewable fuel volume requirements.

### Renewable Fuel Target

The Renewable Fuel Target is a key policy mechanism designed to increase the use of renewable content in transportation fuels. It operates by requiring fuel suppliers to include a minimum percentage of renewable fuels (like ethanol or biodiesel) in their total fuel supply. This target serves several important purposes:

- **Reducing Fossil Fuel Dependence**: By displacing a portion of petroleum-based fuels with renewable alternatives
- **Decreasing Greenhouse Gas Emissions**: Since renewable fuels typically have lower lifecycle carbon emissions
- **Supporting Agricultural and Biofuel Industries**: By creating consistent market demand for their products
- **Enhancing Energy Security**: By diversifying fuel sources with domestically produced alternatives

The target is expressed as a percentage of total fuel volume and is applied separately to different fuel classes:
- **Gasoline Class**: Requires 5% renewable content (e.g., ethanol in gasoline)
- **Diesel Class**: Requires 4% renewable content (e.g., biodiesel in diesel) prior to 2025, increasing to 8% for the 2025 compliance period and subsequent years

Suppliers must demonstrate compliance annually by showing they have either:
1. Physically blended sufficient renewable content into their fuels
2. Acquired equivalent renewable attributes through notional transfers from other suppliers
3. Used retained volumes from previous compliance periods
4. Or a combination of these approaches

### Line-by-Line Explanation

1. **Line 1: Fossil-Derived Base Fuel** - This is the total volume of petroleum-based gasoline, diesel, and jet fuel that a supplier has brought into the jurisdiction during the compliance period. It serves as the baseline for calculating renewable content requirements. It's reported in liters and broken down by fuel type to allow for different renewable percentage requirements for each fuel class.

2. **Line 2: Eligible Renewable Fuel Supplied** - This represents the total volume of qualifying renewable fuels (like ethanol, biodiesel, or renewable diesel) that the supplier has physically blended into their fossil fuels. To count toward the target, these renewable fuels must meet specific sustainability criteria defined in the regulations. This volume is also measured in liters.

3. **Line 3: Total Tracked Fuel Supplied** - This is simply the sum of Lines 1 and 2, representing the total volume of all transportation fuels (both fossil and renewable) supplied during the compliance period. This line provides context for understanding the overall market share of renewable fuels.

4. **Line 4: Eligible Renewable Fuel Required** - This is the calculated minimum volume of renewable fuel that the supplier must incorporate into their fuel supply to meet the regulated target. It's determined by multiplying Line 1 (fossil fuel volume) by the required renewable percentage for each fuel class (5% for gasoline, 4% for diesel prior to 2025 and 8% for diesel in 2025 and beyond). This is the compliance benchmark against which a supplier's actual renewable content is measured.

5. **Line 5: Net Notionally Transferred** - This represents the volume of renewable fuel attributes that have been transferred between suppliers. A positive number indicates renewable attributes received from other suppliers, while a negative number represents attributes transferred to others. These "notional transfers" allow for flexibility in meeting targets without requiring physical transfers of fuel.

6. **Line 6: Renewable Fuel Retained** - This is the volume of excess renewable fuel from the current compliance period that the supplier chooses to bank for future use. By allowing this retention, the system provides flexibility for suppliers to manage their compliance across multiple reporting periods, encouraging over-compliance when conditions are favorable.

7. **Line 7: Previously Retained** - This represents renewable fuel volumes that were banked in previous compliance periods and are now being applied to the current period's obligations. This mechanism rewards suppliers who exceeded requirements in previous periods by allowing them to apply their "savings" when needed.

8. **Line 8: Obligation Deferred** - This is the portion of the current period's renewable fuel obligation that a supplier is permitted to defer to a future compliance period. Deferral provisions provide temporary flexibility for suppliers facing challenges in meeting current period requirements, but these deferred obligations must eventually be satisfied.

9. **Line 9: Obligation Added** - This represents obligations from previous compliance periods that were deferred and are now being added to the current period's requirements. This ensures that deferred obligations don't disappear but are instead fulfilled at a later date.

10. **Line 10: Net Renewable Fuel Supplied** - This is the final calculation of the supplier's renewable fuel position after all adjustments. The formula is:
    ```
    Line 10 = Line 2 + Line 5 + Line 7 - Line 6 + Line 8 - Line 9
    ```
    This represents the total renewable content after accounting for physical supply, transfers, retentions, and deferrals. This value is compared against Line 4 (required volume) to determine compliance.

11. **Line 11: Non-Compliance Penalty** - If Line 10 (net supplied) is less than Line 4 (required), this line calculates the financial penalty for the shortfall. The penalty rate is set by regulation and is designed to be sufficiently high to discourage non-compliance. The penalty is calculated separately for each fuel class and is reported in monetary units (e.g., dollars).

## Section 2: Low Carbon Fuel Target Summary (Lines 12-22)

This section calculates compliance with carbon intensity reduction targets.

### Low Carbon Fuel Target

The Low Carbon Fuel Target is a performance-based standard designed to reduce the overall carbon intensity (CI) of the transportation fuel pool. Unlike the Renewable Fuel Target which focuses on volume percentages, this target focuses on lifecycle greenhouse gas emissions reductions. It works by:

- **Setting Carbon Intensity Baselines**: Establishing reference carbon intensity values for conventional fuels (gasoline, diesel)
- **Requiring Progressive CI Reductions**: Mandating percentage reductions in average CI compared to these baselines
- **Creating Market Incentives**: Rewarding fuels with lower carbon intensities through a credit-based system
- **Promoting Technology Innovation**: Encouraging development of ultra-low carbon fuels and production pathways

The target is expressed as a percentage reduction in carbon intensity compared to baseline fuels. This percentage typically increases over time, creating a gradually strengthening standard:
- Starting with modest reductions (e.g., 2-5%)
- Increasing to more substantial reductions (e.g., 10-20%) in later years

The system is technology-neutral, allowing suppliers to choose the most cost-effective compliance strategies, whether through:
- Blending lower-CI biofuels
- Supplying alternative fuels (electricity, hydrogen, natural gas)
- Improving production processes to lower CI values
- Acquiring compliance units from other suppliers

This approach drives continuous innovation while providing flexibility in how objectives are met.

### Line-by-Line Explanation

12. **Line 12: Low Carbon Fuel Required** - This represents the total number of compliance units a supplier must obtain to meet their carbon intensity reduction obligation. It's calculated based on the volume and energy content of fossil fuels supplied (Line 1), multiplied by the required percentage reduction in carbon intensity, and converted to compliance units. These units represent tonnes of CO2e that must be reduced below baseline.

13. **Line 13: Low Carbon Fuel Supplied** - This shows the actual number of compliance units generated through the supplier's fuel portfolio. Units are earned by supplying fuels with carbon intensities lower than the baseline values. The more a fuel's CI is below the baseline, the more units it generates. This rewards ultra-low carbon fuels by giving them proportionally more credit.

14. **Line 14: Low Carbon Fuel Surplus/Deficit** - This is a simple subtraction of Line 12 from Line 13, showing whether the supplier has exceeded their requirement (positive value) or fallen short (negative value). This line is critical as it determines whether a supplier has met their obligation or needs to take additional compliance actions.

15. **Line 15: Banked Units Used** - This represents previously banked compliance units that the supplier is using in the current period to offset a deficit. The system allows banking of excess units to provide flexibility across compliance periods, similar to banking renewable volumes in the Renewable Fuel Target section.

16. **Line 16: Banked Units Remaining** - This shows the supplier's balance of banked units that remain available for future use after any current period usage. This provides visibility into a supplier's compliance reserves, which can be valuable for planning purposes.

17. **Line 17: Available Compliance Unit Balance** - This represents the available compliance unit balance for the compliance period calculated using the specific TFRS formula. This calculation includes:
   - Compliance unit balance changes from assessments (validations) listed with the compliance period or prior
   - Minus reductions listed with the compliance period or prior
   - Plus compliance units purchased through credit transfers with effective date on or before the end of the compliance period
   - Minus compliance units sold through credit transfers with effective date on or before the end of the compliance period
   - Plus compliance units issued under Initiative Agreements (IA/P3A) with effective date on or before the end of the compliance period
   - Plus/minus admin adjustments with effective date on or before the end of the compliance period
   - Minus all future debits (such as transfers or reductions)
   
   This balance represents the total compliance units available to the organization as of March 31st of the compliance year + 1, following the TFRS legacy calculation methodology to ensure consistency with historical reporting standards.

18. **Line 18: Units to be Banked** - When a supplier has excess compliance units after meeting current obligations, this line shows how many units they are choosing to bank for future use. There may be regulatory limits on how many units can be banked or how long they can be carried forward.

19. **Line 19: Units to be Exported** - This represents compliance units that are being transferred to other jurisdictions with compatible low carbon fuel standards. This inter-jurisdictional flexibility can help optimize compliance costs across regions.

20. **Line 20: Surplus/Deficit Units** - This is the final net position after all adjustments have been applied. It represents the supplier's compliance standing after accounting for current period performance, banked unit usage, and other adjustments. A positive number indicates over-compliance, while a negative number indicates under-compliance.

21. **Line 21: Surplus/Deficit Ratio** - This is calculated by dividing Line 20 by Line 12, expressing the surplus or deficit as a percentage of the original requirement. This normalized measure allows for easier comparison of compliance performance across suppliers of different sizes or across different time periods.

22. **Line 22: Compliance Units Issued** - This represents the final number of compliance units officially issued to the supplier based on their net position. These units have monetary value in the compliance unit market and can be retained, sold to other suppliers, or used for future compliance periods.

## Calculation Methodology

### Renewable Fuel Target Calculation Details

The renewable fuel target requires a minimum percentage of renewable content in the fuel supply. The calculation involves several steps:

1. **Determine Base Obligation**:
   ```
   Required Renewable Volume = Fossil Fuel Volume × Required Percentage
   ```
   For example, if a supplier provides 100 million liters of gasoline, their renewable requirement would be:
   100 million liters × 5% = 5 million liters of renewable fuel

2. **Apply Adjustments**:
   ```
   Net Requirement = Base Obligation + Previous Deferrals - Current Deferrals
   ```

3. **Calculate Compliance Position**:
   ```
   Compliance Position = Physical Supply + Transfers + Previously Retained - Currently Retained
   ```

4. **Determine Shortfall**:
   ```
   Shortfall = Net Requirement - Compliance Position (if positive, otherwise zero)
   ```

5. **Calculate Penalty** (if applicable):
   ```
   Penalty Amount = Shortfall × Penalty Rate
   ```
   For example, if the shortfall is 1 million liters and the penalty rate is $0.30/L, the penalty would be $300,000.

### Low Carbon Fuel Target Calculation Details

The low carbon fuel target operates on a carbon intensity basis rather than volume:

1. **Calculate Energy Basis**:
   ```
   Total Energy (MJ) = ∑(Fuel Volume × Energy Density)
   ```
   For all fuels supplied, converted to a common energy unit (megajoules)

2. **Determine Required Reduction**:
   ```
   Required CI Reduction = Total Energy (MJ) × CI Reduction Target (%)
   ```
   For example, if total energy is 10 billion MJ and the reduction target is 10%, the required reduction is 1 billion MJ-gCO2e/MJ

3. **Convert to Compliance Units**:
   ```
   Required Compliance Units = Required CI Reduction ÷ Compliance Unit Factor
   ```
   Where the compliance unit factor converts to tonnes of CO2e (typically 1,000,000 gCO2e per tonne)

4. **Calculate Actual Compliance Units Generated**:
   ```
   Units = ∑[Fuel Energy (MJ) × (Baseline CI - Actual CI) ÷ Compliance Unit Factor]
   ```
   For each fuel supplied with CI below the baseline

5. **Determine Surplus/Deficit**:
   ```
   Surplus/Deficit = Generated Units - Required Units
   ```

6. **Apply Adjustments** from banked units, trades, etc. to reach final compliance position

## Database Implementation

In the ETL process, the compliance_report_summary table maintains all line values separately for gasoline, diesel, and jet fuel classes. The ETL script maps values from TFRS to LCFS as follows:

- `gasoline_class_retained` → `line_6_renewable_fuel_retained_gasoline`
- `diesel_class_retained` → `line_6_renewable_fuel_retained_diesel`
- `gasoline_class_deferred` → `line_8_obligation_deferred_gasoline`
- `diesel_class_deferred` → `line_8_obligation_deferred_diesel`
- `diesel_class_obligation` → `line_9_obligation_added_diesel`
- `diesel_class_previously_retained` → `line_7_previously_retained_diesel`
- `gasoline_class_obligation` → `line_9_obligation_added_gasoline`
- `gasoline_class_previously_retained` → `line_7_previously_retained_gasoline`

Note: Line 22 (Available compliance unit balance at period end) is not sourced from `credits_offset` (credits used). It is populated from TFRS snapshots during the summary update step to reflect the end-of-period available balance.

These mappings ensure that historical data from the TFRS system is correctly transferred to the new LCFS system while maintaining data integrity and calculation consistency.

## Non-Compliance Penalty

When a supplier fails to meet either the renewable fuel target or the low carbon fuel target, a non-compliance penalty is calculated:

1. **Renewable Fuel Target Penalty:**
   ```
   Penalty = (Required Volume - Supplied Volume) × Penalty Rate
   ```

   The penalty rate is designed to be higher than the typical cost of compliance to incentivize meeting requirements through regular compliance mechanisms rather than paying penalties.

2. **Low Carbon Fuel Target Penalty:**
   ```
   Penalty = Net Debit Units × Penalty Rate
   ```

   For the carbon intensity target, the penalty is based on the shortfall in compliance units (net debit), with each unit representing a fixed amount of carbon reduction.

   **Penalty Rates by Compliance Period:**
   - **Compliance periods 2022 and prior:** $200 CAD per unit
   - **Compliance periods 2023 and onward:** $600 CAD per unit

The penalty rates are defined by regulation. Penalties serve both as a compliance enforcement mechanism and as a price ceiling on the cost of compliance units in the market.

## Supplemental Reports and Version Tracking

When a supplemental report is submitted:

1. The previous report's values are used as a starting point
2. Changes made in the supplemental report are applied
3. All calculations are re-run with the updated values
4. The summary is updated with the new results

Reports are linked through a version chain using:
- `root_report_id` - The original report ID
- `supplements_id` - The ID of the report being supplemented
- `version` - The sequential version number (original = 0)

This ensures that all versions of a report can be tracked and that compliance calculations are updated appropriately with each supplemental submission. The version chain maintains a complete audit trail of how compliance reporting has evolved over time, which is essential for regulatory oversight and accountability.