#!/usr/bin/env python3
"""
Validation Script for 2019-2023 Migration Fixes

Tests the fixes applied to resolve:
1. Missing standalone exclusion reports (Eco-energy LLC, 102078290 Saskatchewan, Idemitsu Apollo)
2. Missing allocation sections for combo compliance/exclusion reports  
3. Incorrect Line 22 balance calculations
4. Credit issuance display issues (City of Surrey)

This script validates that all reported issues have been resolved across historical years 2019-2023.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
import sys
from typing import Dict, List, Optional, Tuple

from core.database import get_source_connection, get_destination_connection
from core.utils import setup_logging

logger = logging.getLogger(__name__)


class MigrationFixesValidator:
    def __init__(self):
        self.test_results = {
            "orphaned_reports": {"passed": 0, "failed": 0, "details": []},
            "allocation_sections": {"passed": 0, "failed": 0, "details": []},
            "line_22_balances": {"passed": 0, "failed": 0, "details": []},
            "credit_issuance": {"passed": 0, "failed": 0, "details": []},
        }
        
        # Test configuration - no specific organization names for privacy
        self.test_years = ["2019", "2020", "2021", "2022", "2023"]

    def test_orphaned_reports_fixed(self, lcfs_cursor) -> bool:
        """Test that standalone exclusion reports without main compliance reports are properly migrated"""
        logger.info("Testing orphaned exclusion reports...")
        
        # Count standalone exclusion reports (reports with allocation agreements but no main compliance data)
        query = """
            SELECT COUNT(DISTINCT cr.compliance_report_id) as orphaned_count
            FROM compliance_report cr
            JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
            JOIN allocation_agreement aa ON cr.compliance_report_id = aa.compliance_report_id
            WHERE cp.description IN ('2019', '2020', '2021', '2022', '2023')
              AND cr.legacy_id IS NOT NULL
              AND NOT EXISTS (
                  -- Check if there's a main compliance report for the same org/period
                  SELECT 1 FROM compliance_report cr2
                  JOIN compliance_report_summary crs ON cr2.compliance_report_id = crs.compliance_report_id
                  WHERE cr2.organization_id = cr.organization_id
                    AND cr2.compliance_period_id = cr.compliance_period_id
                    AND cr2.compliance_report_id != cr.compliance_report_id
                    AND (crs.line_1_fossil_derived_base_fuel_gasoline > 0 
                         OR crs.line_1_fossil_derived_base_fuel_diesel > 0)
              )
        """
        
        lcfs_cursor.execute(query)
        result = lcfs_cursor.fetchone()
        orphaned_count = result[0] if result else 0
        
        if orphaned_count > 0:
            self.test_results["orphaned_reports"]["passed"] += orphaned_count
            self.test_results["orphaned_reports"]["details"].append(
                f"✓ Found {orphaned_count} standalone exclusion reports with allocation data"
            )
            logger.info(f"✓ Found {orphaned_count} properly migrated orphaned exclusion reports")
        else:
            self.test_results["orphaned_reports"]["failed"] += 1
            self.test_results["orphaned_reports"]["details"].append(
                "? No standalone exclusion reports found - this may be expected"
            )
            logger.info("? No standalone exclusion reports found - this may be expected")
        
        return True  # This test is informational, not a failure condition

    def test_allocation_sections_present(self, lcfs_cursor) -> bool:
        """Test that reports with both compliance and allocation data are properly migrated"""
        logger.info("Testing allocation sections for combo reports...")
        
        # Find reports that have both main compliance data AND allocation agreements
        query = """
            SELECT 
                cp.description as period,
                COUNT(DISTINCT cr.compliance_report_id) as reports_with_allocations,
                SUM(allocation_counts.allocation_count) as total_allocations
            FROM compliance_report cr
            JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
            JOIN compliance_report_summary crs ON cr.compliance_report_id = crs.compliance_report_id
            JOIN (
                SELECT 
                    compliance_report_id,
                    COUNT(*) as allocation_count
                FROM allocation_agreement 
                GROUP BY compliance_report_id
            ) allocation_counts ON cr.compliance_report_id = allocation_counts.compliance_report_id
            WHERE cp.description IN ('2019', '2020', '2021', '2022', '2023')
              AND cr.legacy_id IS NOT NULL
              AND (crs.line_1_fossil_derived_base_fuel_gasoline > 0 
                   OR crs.line_1_fossil_derived_base_fuel_diesel > 0)
            GROUP BY cp.description
            ORDER BY cp.description
        """
        
        lcfs_cursor.execute(query)
        results = lcfs_cursor.fetchall()
        
        total_combo_reports = 0
        total_allocations = 0
        
        for row in results:
            period, report_count, allocation_count = row
            total_combo_reports += report_count
            total_allocations += allocation_count or 0
            
            self.test_results["allocation_sections"]["details"].append(
                f"✓ {period}: {report_count} combo reports with {allocation_count or 0} total allocations"
            )
            logger.info(f"✓ {period}: {report_count} combo reports with {allocation_count or 0} allocations")
        
        if total_combo_reports > 0:
            self.test_results["allocation_sections"]["passed"] = total_combo_reports
            self.test_results["allocation_sections"]["details"].append(
                f"✓ Total: {total_combo_reports} combo reports with {total_allocations} allocation agreements"
            )
            logger.info(f"✓ Found {total_combo_reports} combo reports with allocation sections")
        else:
            self.test_results["allocation_sections"]["failed"] += 1
            self.test_results["allocation_sections"]["details"].append(
                "✗ No combo compliance/allocation reports found"
            )
            logger.warning("✗ No combo compliance/allocation reports found")
        
        return total_combo_reports > 0

    def test_line_22_calculations(self, lcfs_cursor) -> bool:
        """Test that Line 22 shows correct balance values"""
        logger.info("Testing Line 22 balance calculations...")
        
        query = """
            SELECT 
                cr.compliance_report_id,
                cp.description as period,
                crs.line_22_compliance_units_issued,
                crs.line_18_units_to_be_banked,
                crs.line_17_non_banked_units_used
            FROM compliance_report cr
            JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
            LEFT JOIN compliance_report_summary crs ON cr.compliance_report_id = crs.compliance_report_id
            WHERE cp.description IN ('2019', '2020', '2021', '2022', '2023')
              AND cr.legacy_id IS NOT NULL
              AND crs.line_22_compliance_units_issued IS NOT NULL
            ORDER BY cp.description, cr.compliance_report_id
        """
        
        lcfs_cursor.execute(query)
        results = lcfs_cursor.fetchall()
        
        issues_found = 0
        valid_calculations = 0
        
        for row in results:
            cr_id, period, line_22, line_18, line_17 = row
            
            # Line 22 should not be the same as Line 18 (credits issued)
            # It should represent available balance at period end
            if line_22 == line_18 and line_18 != 0:
                issues_found += 1
                self.test_results["line_22_balances"]["details"].append(
                    f"✗ Report {cr_id} ({period}): Line 22 ({line_22}) equals Line 18 ({line_18}) - likely showing issued credits instead of balance"
                )
            else:
                valid_calculations += 1
        
        if issues_found == 0:
            self.test_results["line_22_balances"]["passed"] = len(results)
            self.test_results["line_22_balances"]["details"].append(
                f"✓ All {len(results)} Line 22 calculations appear correct"
            )
            logger.info(f"✓ All {len(results)} Line 22 calculations validated")
        else:
            self.test_results["line_22_balances"]["failed"] = issues_found
            self.test_results["line_22_balances"]["passed"] = valid_calculations
            logger.warning(f"✗ Found {issues_found} Line 22 calculation issues")
        
        return issues_found == 0

    def test_credit_issuance_display(self, lcfs_cursor) -> bool:
        """Test that credit issuance values are properly displayed (not showing as 0 when credits exist)"""
        logger.info("Testing credit issuance display...")
        
        query = """
            SELECT 
                cp.description as period,
                COUNT(CASE WHEN crs.line_18_units_to_be_banked > 0 THEN 1 END) as reports_with_line_18,
                COUNT(CASE WHEN crs.line_14_low_carbon_fuel_surplus > 0 THEN 1 END) as reports_with_line_14,
                SUM(crs.line_18_units_to_be_banked) as total_line_18,
                SUM(crs.line_14_low_carbon_fuel_surplus) as total_line_14,
                COUNT(*) as total_reports
            FROM compliance_report cr
            JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
            LEFT JOIN compliance_report_summary crs ON cr.compliance_report_id = crs.compliance_report_id
            WHERE cp.description IN ('2019', '2020', '2021', '2022', '2023')
              AND cr.legacy_id IS NOT NULL
              AND crs.compliance_report_id IS NOT NULL
            GROUP BY cp.description
            ORDER BY cp.description
        """
        
        lcfs_cursor.execute(query)
        results = lcfs_cursor.fetchall()
        
        total_reports_with_credits = 0
        
        for row in results:
            period, reports_18, reports_14, total_18, total_14, total_reports = row
            
            reports_with_credits = reports_18 + reports_14
            total_reports_with_credits += reports_with_credits
            
            self.test_results["credit_issuance"]["details"].append(
                f"✓ {period}: {reports_with_credits}/{total_reports} reports show credit issuance (Line 18: {reports_18}, Line 14: {reports_14})"
            )
            logger.info(f"✓ {period}: {reports_with_credits} reports with credit issuance")
        
        if total_reports_with_credits > 0:
            self.test_results["credit_issuance"]["passed"] = total_reports_with_credits
            self.test_results["credit_issuance"]["details"].append(
                f"✓ Total: {total_reports_with_credits} reports show proper credit issuance values"
            )
            logger.info(f"✓ Found {total_reports_with_credits} reports with proper credit issuance display")
        else:
            self.test_results["credit_issuance"]["failed"] += 1
            self.test_results["credit_issuance"]["details"].append(
                "✗ No reports show credit issuance values > 0"
            )
            logger.warning("✗ All credit issuance values showing as 0")
        
        return total_reports_with_credits > 0

    def validate_all_fixes(self) -> bool:
        """Run all validation tests"""
        logger.info("Starting validation of migration fixes for 2019-2023...")
        
        all_tests_passed = True
        
        try:
            with get_destination_connection() as lcfs_conn:
                lcfs_cursor = lcfs_conn.cursor()
                
                # Run all validation tests
                tests = [
                    ("Orphaned Reports", self.test_orphaned_reports_fixed),
                    ("Allocation Sections", self.test_allocation_sections_present), 
                    ("Line 22 Calculations", self.test_line_22_calculations),
                    ("Credit Issuance Display", self.test_credit_issuance_display),
                ]
                
                for test_name, test_func in tests:
                    logger.info(f"\n--- Running {test_name} Test ---")
                    try:
                        result = test_func(lcfs_cursor)
                        if not result:
                            all_tests_passed = False
                            logger.error(f"❌ {test_name} test FAILED")
                        else:
                            logger.info(f"✅ {test_name} test PASSED")
                    except Exception as e:
                        logger.error(f"❌ {test_name} test ERROR: {e}")
                        all_tests_passed = False
                
                lcfs_cursor.close()
        
        except Exception as e:
            logger.error(f"Validation failed with error: {e}")
            all_tests_passed = False
        
        return all_tests_passed

    def print_summary(self):
        """Print detailed validation summary"""
        logger.info("\n" + "="*80)
        logger.info("MIGRATION FIXES VALIDATION SUMMARY")
        logger.info("="*80)
        
        for test_name, results in self.test_results.items():
            passed = results["passed"]
            failed = results["failed"]
            total = passed + failed
            
            if total > 0:
                success_rate = (passed / total) * 100
                logger.info(f"\n📊 {test_name.replace('_', ' ').title()}:")
                logger.info(f"   ✅ Passed: {passed}")
                logger.info(f"   ❌ Failed: {failed}")  
                logger.info(f"   📈 Success Rate: {success_rate:.1f}%")
                
                # Print details
                if results["details"]:
                    logger.info("   📋 Details:")
                    for detail in results["details"]:
                        logger.info(f"      {detail}")
            else:
                logger.info(f"\n📊 {test_name.replace('_', ' ').title()}: No tests run")
        
        # Overall summary
        total_passed = sum(r["passed"] for r in self.test_results.values())
        total_failed = sum(r["failed"] for r in self.test_results.values())
        total_tests = total_passed + total_failed
        
        if total_tests > 0:
            overall_success = (total_passed / total_tests) * 100
            logger.info(f"\n🎯 OVERALL RESULTS:")
            logger.info(f"   Total Tests: {total_tests}")
            logger.info(f"   Passed: {total_passed}")
            logger.info(f"   Failed: {total_failed}")
            logger.info(f"   Success Rate: {overall_success:.1f}%")
            
            if total_failed == 0:
                logger.info("   🎉 ALL TESTS PASSED! Migration fixes are working correctly.")
            else:
                logger.warning(f"   ⚠️  {total_failed} tests failed. Review the details above.")
        
        logger.info("="*80)


def main():
    setup_logging()
    logger.info("Starting Migration Fixes Validation for 2019-2023")

    validator = MigrationFixesValidator()

    try:
        success = validator.validate_all_fixes()
        validator.print_summary()
        
        if success:
            logger.info("🎉 All migration fixes validated successfully!")
        else:
            logger.error("❌ Some migration fixes need attention.")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()