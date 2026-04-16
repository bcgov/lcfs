"""
Run all validation scripts for TFRS to LCFS migration.
"""
import sys
import os
from typing import Dict, Any
import json
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from validation.validate_allocation_agreements import AllocationAgreementValidator
from validation.validate_fuel_supply import FuelSupplyValidator
from validation.validate_notional_transfers import NotionalTransferValidator
from validation.validate_other_uses import OtherUsesValidator


def run_all_validations() -> Dict[str, Any]:
    """Run all validation scripts and return consolidated results."""
    print("=" * 60)
    print("TFRS TO LCFS MIGRATION VALIDATION REPORT")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    all_results = {}
    
    # List of validators to run
    validators = [
        ("allocation_agreement", AllocationAgreementValidator()),
        ("fuel_supply", FuelSupplyValidator()),
        ("notional_transfer", NotionalTransferValidator()),
        ("other_uses", OtherUsesValidator())
    ]
    
    for validator_name, validator in validators:
        print(f"\n{'='*20} {validator_name.upper().replace('_', ' ')} {'='*20}")
        
        try:
            results = validator.run_validation()
            all_results[validator_name] = {
                'status': 'success',
                'results': results
            }
            print(f"✓ {validator_name} validation completed successfully")
            
        except Exception as e:
            print(f"✗ {validator_name} validation failed: {str(e)}")
            all_results[validator_name] = {
                'status': 'failed',
                'error': str(e)
            }
    
    # Generate summary report
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)
    
    for validator_name, result in all_results.items():
        status = result['status']
        status_symbol = "✓" if status == 'success' else "✗"
        print(f"{status_symbol} {validator_name.replace('_', ' ').title()}: {status.upper()}")
        
        if status == 'success' and 'results' in result:
            # Show key metrics
            results = result['results']
            if 'record_counts' in results:
                counts = results['record_counts']
                if isinstance(counts, dict) and 'source_count' in counts:
                    print(f"  Source: {counts['source_count']}, Dest: {counts['dest_count']}, "
                          f"Diff: {counts['difference']}")
                elif isinstance(counts, dict) and 'standard' in counts:
                    # Fuel supply has nested structure
                    std = counts['standard']
                    print(f"  Source: {std['source_count']}, Dest: {std['dest_count']}, "
                          f"Diff: {std['difference']}")
    
    return all_results


def save_results_to_file(results: Dict[str, Any], filename: str = None):
    """Save validation results to a JSON file."""
    if filename is None:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"validation_results_{timestamp}.json"
    
    filepath = os.path.join(os.path.dirname(__file__), filename)
    
    with open(filepath, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\nValidation results saved to: {filepath}")


if __name__ == "__main__":
    try:
        results = run_all_validations()
        save_results_to_file(results)
        
        # Check if any validations failed
        failed_validations = [name for name, result in results.items() 
                            if result['status'] == 'failed']
        
        if failed_validations:
            print(f"\n⚠️  {len(failed_validations)} validation(s) failed: {', '.join(failed_validations)}")
            sys.exit(1)
        else:
            print(f"\n🎉 All {len(results)} validations completed successfully!")
            sys.exit(0)
            
    except Exception as e:
        print(f"\n❌ Critical error running validations: {e}")
        sys.exit(1)