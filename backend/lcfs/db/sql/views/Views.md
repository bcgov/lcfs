# LCFS Database Views - Dependency Documentation

## Overview

This document outlines the LCFS database views organized by their dependency levels. Views must be created in the specified order to avoid reference errors.

## Dependency Tree Structure

```
Level 1 (Base Tables Only)
├── v_compliance_report
├── vw_transfer_base
├── vw_user_login_analytics_base
├── vw_transaction_base
├── vw_fuel_code_base
├── vw_compliance_reports_time_per_status
├── vw_notional_transfer_base
└── vw_fuels_other_use_base

Level 2 (Depends on Level 1)
├── vw_compliance_report_analytics_base (depends on: v_compliance_report)
├── vw_bceid_daily_login_summary (depends on: vw_user_login_analytics_base)
├── vw_bceid_user_statistics (depends on: vw_user_login_analytics_base)
├── vw_login_failures_analysis (depends on: vw_user_login_analytics_base)
├── vw_compliance_report_base (depends on: vw_compliance_report_chained)
├── vw_fse_base (depends on: v_compliance_report)
├── vw_electricity_allocation_fse_match (depends on: v_compliance_report)
├── vw_allocation_agreement_duplicate_check (depends on: v_compliance_report)
└── vw_fse_duplicate_check (depends on: v_compliance_report)

Level 3 (Depends on Level 2)
├── vw_reports_waiting_review (depends on: vw_compliance_report_analytics_base)
├── vw_fuel_supply_analytics_base (depends on: vw_compliance_report_analytics_base)
├── vw_fuel_export_analytics_base (depends on: vw_compliance_report_analytics_base)
└── vw_allocation_agreement_base (depends on: vw_compliance_report_base)
```

## View Categories

### Core Compliance Views

-   **v_compliance_report**: Main compliance report listing with complex versioning logic
-   **vw_compliance_report_analytics_base**: Analytics foundation for compliance reports
-   **vw_compliance_report_base**: Comprehensive report view with summary and transaction data
-   **vw_reports_waiting_review**: Reports pending review with timing metrics
-   **vw_compliance_reports_time_per_status**: Process timing analysis

### Fuel Code & Compliance schedule data Views

-   **vw_fuel_supply_base**: Clean fuel supply data (latest versions only)
-   **vw_fuel_supply_analytics_base**: Analytics-ready fuel supply with metadata
-   **vw_fuel_export_analytics_base**: Fuel export data for analytics
-   **vw_fuel_code_base**: Comprehensive fuel code information
-   **vw_fuels_other_use_base**: Non-standard fuel usage tracking
-   **vw_fse_base**: Final Supply Equipment reporting
-   **vw_allocation_agreement_base**: Latest allocation agreements
-   **vw_notional_transfer_base**: Notional transfer tracking

### User & System Analytics Views

-   **vw_user_login_analytics_base**: Foundation for login analysis
-   **vw_bceid_daily_login_summary**: Daily BCeID login metrics
-   **vw_bceid_user_statistics**: Individual user behavior analysis
-   **vw_login_failures_analysis**: Login failure pattern analysis

### Utility Views

-   **vw_transfer_base**: Recorded transfers with calculated values
-   **vw_transaction_base**: Active transactions (excludes released)
-   **vw_electricity_allocation_fse_match**: Electricity allocation matching
-   **vw_allocation_agreement_duplicate_check**: Identifies duplicate allocations
-   **vw_fse_duplicate_check**: Identifies duplicate equipment records

## Key Dependencies

### Critical Path

1. `v_compliance_report` → `vw_compliance_report_analytics_base` → analytics views
2. `vw_user_login_analytics_base` → login analysis views
3. Base fuel/supply views → analytics fuel views

### Common Patterns

-   Most analytics views depend on their respective base views
-   Duplicate check views depend on `v_compliance_report` for report filtering
-   Time-based analysis views typically depend on base data views

## Execution Notes

-   All views grant SELECT permissions to `basic_lcfs_reporting_role`
-   Views use `CASCADE` drops to handle dependencies automatically
-   Index creation statements are included for performance optimization
-   Complex versioning logic is centralized in base views and reused by dependent views
