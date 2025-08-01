import pytest
from datetime import datetime
from lcfs.web.api.credit_ledger.schema import CreditLedgerTxnSchema


def test_credit_ledger_txn_schema_positive_balance():
    """Test that positive available balance remains unchanged."""
    data = {
        "transaction_type": "Test Transaction",
        "compliance_period": "2024",
        "organization_id": 123,
        "compliance_units": 100,
        "available_balance": 500,
        "update_date": datetime.now()
    }
    
    schema = CreditLedgerTxnSchema(**data)
    assert schema.available_balance == 500


def test_credit_ledger_txn_schema_negative_balance_becomes_zero():
    """Test that negative available balance is converted to zero."""
    data = {
        "transaction_type": "Test Transaction",
        "compliance_period": "2024",
        "organization_id": 123,
        "compliance_units": -200,
        "available_balance": -150,
        "update_date": datetime.now()
    }
    
    schema = CreditLedgerTxnSchema(**data)
    assert schema.available_balance == 0


def test_credit_ledger_txn_schema_zero_balance_remains_zero():
    """Test that zero available balance remains zero."""
    data = {
        "transaction_type": "Test Transaction",
        "compliance_period": "2024",
        "organization_id": 123,
        "compliance_units": 0,
        "available_balance": 0,
        "update_date": datetime.now()
    }
    
    schema = CreditLedgerTxnSchema(**data)
    assert schema.available_balance == 0


def test_credit_ledger_txn_schema_none_balance_becomes_zero():
    """Test that None available balance becomes zero."""
    data = {
        "transaction_type": "Test Transaction",
        "compliance_period": "2024",
        "organization_id": 123,
        "compliance_units": 50,
        "available_balance": None,
        "update_date": datetime.now()
    }
    
    schema = CreditLedgerTxnSchema(**data)
    assert schema.available_balance == 0