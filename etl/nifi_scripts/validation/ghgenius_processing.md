# GHGenius Data Migration Process

## Overview

This document explains how GHGenius carbon intensity (CI) data is migrated from the TFRS system to the LCFS system, including the specific approach used for Schedule B (fuel supply) records that use GHGenius for carbon intensity determination.

## Background

In TFRS, certain fuel supply records use a carbon intensity determination type of "GHGenius", which indicates that the carbon intensity value should be derived from associated Schedule D sheets rather than being directly stored in the fuel supply record itself.

## Database Structure in TFRS

The GHGenius data in TFRS is structured as follows:

1. A `compliance_report` has an associated `schedule_d_id` that references a `compliance_report_schedule_d` record
2. The `compliance_report_schedule_d` has many `compliance_report_schedule_d_sheet` records
3. Each sheet is associated with a specific fuel type and fuel class
4. Each sheet has `compliance_report_schedule_d_sheet_output` records containing intensity values for different factors
5. The sum of these intensity values represents the total carbon intensity for the fuel

## Migration Process

During the ETL process, GHGenius records are identified via the `determination_type` field with value "GHGenius" in the CASE statement. When such a record is found:

1. The ETL uses a SQL query to locate all schedule_d_sheet_output records associated with the compliance report
2. It filters these to match the fuel_type_id and fuel_class_id of the current record
3. It calculates the carbon intensity by summing all intensity values from these outputs
4. It sets the provision_of_the_act to "GHGenius modelled - Section 6 (5) (d) (ii) (A)" in LCFS

### Why Sum the Intensity Values?

We sum the intensity values across all sheet outputs because the GHGenius model calculates the total lifecycle carbon intensity of a fuel as the sum of its component emission factors. Each output represents a different part of the fuel's lifecycle emissions:

- Fuel Production
- Fuel Distribution and Storage
- Fertilizer Manufacture
- Land Use Change
- Feedstock Recovery
- Fuel Dispensing
- And others...

By summing these values, we get the total "well-to-wheel" carbon intensity of the fuel, which is the value needed for compliance reporting.

## Validation Process

The ETL validation script includes specific checks for GHGenius records:

1. Compares the count of GHGenius records between TFRS and LCFS
2. Verifies that migrated GHGenius records have non-null and non-zero carbon intensity values
3. Confirms that GHGenius records use the correct provision_of_the_act value in LCFS

If validation issues are found with GHGenius records, they will be reported separately from other fuel supply validation results.