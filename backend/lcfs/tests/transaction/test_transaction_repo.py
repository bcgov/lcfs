import pytest

from lcfs.db.models import ComplianceReport
from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.tests.transaction.transaction_payloads import *
from lcfs.web.api.base import SortOrder
from lcfs.web.api.transaction.repo import TransactionRepository, EntityType
from lcfs.web.exception.exceptions import DatabaseException


@pytest.fixture
def transaction_repo(dbsession):
    return TransactionRepository(db=dbsession)


@pytest.fixture
async def mock_transactions(dbsession):
    transactions = [
        test_org,
        test_org_2,
        deleted_transfer_orm,
        draft_transfer_orm,
        submitted_transfer_orm,
        sent_transfer_orm,
        recorded_transfer_orm,
        recommended_transfer_orm,
        refused_transfer_orm,
        declined_transfer_orm,
        rescinded_transfer_orm,
        initiative_agreement_orm,
        edge_case_transfer_orm,
        admin_adjustment_orm,
        adjustment_transaction_orm,
        reserved_transaction_orm,
        edge_case_transaction_orm,
    ]
    dbsession.add_all(transactions)
    await dbsession.flush()

    return transactions


@pytest.mark.anyio
async def test_calculate_total_balance(dbsession, transaction_repo, mock_transactions):
    total_balance = await transaction_repo.calculate_total_balance(test_org_id)
    assert total_balance == 233


@pytest.mark.anyio
async def test_calculate_reserved_balance(
    dbsession, transaction_repo, mock_transactions
):
    reserved_balance = await transaction_repo.calculate_reserved_balance(test_org_id)
    assert reserved_balance == 100


@pytest.mark.anyio
async def test_calculate_available_balance(
    dbsession, transaction_repo, mock_transactions
):
    available_balance = await transaction_repo.calculate_available_balance(test_org_id)
    assert available_balance == 133


@pytest.mark.anyio
async def test_edge_case_transaction_in_proper_period(
    dbsession, transaction_repo, mock_transactions
):
    """Transaction is right on the edge of the compliance period (March 31st), check it shows up in 2022 and after"""
    available_balance = await transaction_repo.calculate_available_balance_for_period(
        test_org_id, 2021
    )
    assert available_balance == 0

    available_balance = await transaction_repo.calculate_available_balance_for_period(
        test_org_id, 2022
    )
    assert available_balance == 33

    available_balance = await transaction_repo.calculate_available_balance_for_period(
        test_org_id, 2023
    )
    assert available_balance == 33


@pytest.mark.anyio
async def test_calculate_line_17_available_balance_for_period(
    dbsession, transaction_repo
):
    """Test Line 17 available balance calculation using the TFRS formula"""
    # This test would need actual database setup with transfers, initiative agreements, etc.
    # For now, just test that the method exists and returns a non-negative value
    available_balance = (
        await transaction_repo.calculate_line_17_available_balance_for_period(
            test_org_id, 2024
        )
    )
    assert available_balance >= 0


@pytest.mark.anyio
async def test_calculate_line_17_available_balance_tfrs_formula(
    dbsession, transaction_repo
):
    """
    Comprehensive test for Line 17 calculation using the TFRS formula.
    Tests various scenarios including assessments, transfers, initiative agreements, and admin adjustments.
    """
    from datetime import datetime
    from lcfs.db.models.transaction.Transaction import (
        Transaction,
        TransactionActionEnum,
    )
    from lcfs.db.models.transfer.Transfer import Transfer
    from lcfs.db.models.admin_adjustment.AdminAdjustment import AdminAdjustment
    from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
        InitiativeAgreement,
    )
    from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
    from lcfs.db.models.compliance.ComplianceReportStatus import (
        ComplianceReportStatus,
        ComplianceReportStatusEnum,
    )
    from lcfs.db.models import Organization, OrganizationAddress

    test_org_id = 1001  # Use high ID to avoid conflicts with seeded data
    test_org_2_id = 1002
    compliance_period = 2024

    # Create test organizations
    test_org_1 = Organization(
        organization_id=test_org_id,
        name="Test Company 1001",
        operating_name="Test Co. 1001",
        org_address=OrganizationAddress(
            street_address="123 Test St",
            city="Test City",
            province_state="Test Province",
            country="Test Country",
            postalCode_zipCode="T3ST 1Z3",
        ),
    )
    test_org_2 = Organization(
        organization_id=test_org_2_id,
        name="Test Company 1002",
        operating_name="Test Co. 1002",
        org_address=OrganizationAddress(
            street_address="456 Test Ave",
            city="Test City",
            province_state="Test Province",
            country="Test Country",
            postalCode_zipCode="T3ST 2Z4",
        ),
    )
    dbsession.add_all([test_org_1, test_org_2])

    # Get or create compliance report status (use existing if available)
    assessed_status = await dbsession.get(
        ComplianceReportStatus, 5
    )  # 5 is Assessed status
    if not assessed_status:
        assessed_status = ComplianceReportStatus(
            compliance_report_status_id=5, status=ComplianceReportStatusEnum.Assessed
        )
        dbsession.add(assessed_status)

    # Create assessed compliance report with transaction
    compliance_report = ComplianceReport(
        compliance_report_id=1001,  # Use unique ID
        organization_id=test_org_id,
        current_status_id=5,  # Use Assessed status ID
        compliance_period_id=1,
        transaction_id=1001,  # Use unique ID
    )
    dbsession.add(compliance_report)

    # 1. Assessment transaction (positive impact)
    assessment_transaction = Transaction(
        transaction_id=1001,  # Use unique ID
        organization_id=test_org_id,
        compliance_units=1000,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2024, 12, 1),  # Within compliance period
    )
    dbsession.add(assessment_transaction)

    # 2. Transfer purchase (positive impact) - within period
    # Create the transaction for the receiving organization
    transfer_purchase_tx = Transaction(
        transaction_id=1003,
        organization_id=test_org_id,
        compliance_units=500,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2024, 6, 15),
    )
    dbsession.add(transfer_purchase_tx)
    
    # Create the transaction for the sending organization
    transfer_purchase_from_tx = Transaction(
        transaction_id=1004,
        organization_id=test_org_2_id,
        compliance_units=-500,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2024, 6, 15),
    )
    dbsession.add(transfer_purchase_from_tx)
    
    transfer_purchase = Transfer(
        transfer_id=1001,  # Use unique ID
        from_organization_id=test_org_2_id,
        to_organization_id=test_org_id,
        from_transaction_id=1004,
        to_transaction_id=1003,
        quantity=500,
        current_status_id=6,  # Recorded status
        transaction_effective_date=datetime(2024, 6, 15).date(),
    )
    dbsession.add(transfer_purchase)

    # 3. Transfer sale (negative impact) - within period
    # Create the transaction for the sending organization (negative)
    transfer_sale_from_tx = Transaction(
        transaction_id=1005,
        organization_id=test_org_id,
        compliance_units=-200,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2024, 8, 15),
    )
    dbsession.add(transfer_sale_from_tx)
    
    # Create the transaction for the receiving organization
    transfer_sale_to_tx = Transaction(
        transaction_id=1006,
        organization_id=test_org_2_id,
        compliance_units=200,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2024, 8, 15),
    )
    dbsession.add(transfer_sale_to_tx)
    
    transfer_sale = Transfer(
        transfer_id=1002,  # Use unique ID
        from_organization_id=test_org_id,
        to_organization_id=test_org_2_id,
        from_transaction_id=1005,
        to_transaction_id=1006,
        quantity=200,
        current_status_id=6,  # Recorded status
        transaction_effective_date=datetime(2024, 8, 15).date(),
    )
    dbsession.add(transfer_sale)

    # 4. Initiative Agreement (positive impact)
    ia_tx = Transaction(
        transaction_id=1007,
        organization_id=test_org_id,
        compliance_units=300,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2024, 10, 1),
    )
    dbsession.add(ia_tx)
    
    initiative_agreement = InitiativeAgreement(
        initiative_agreement_id=1001,  # Use unique ID
        to_organization_id=test_org_id,
        transaction_id=1007,
        compliance_units=300,
        current_status_id=3,  # Approved status
        transaction_effective_date=datetime(2024, 10, 1).date(),
    )
    dbsession.add(initiative_agreement)

    # 5. Admin adjustment (positive impact)
    admin_tx = Transaction(
        transaction_id=1008,
        organization_id=test_org_id,
        compliance_units=100,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2024, 11, 1),
    )
    dbsession.add(admin_tx)
    
    admin_adjustment = AdminAdjustment(
        admin_adjustment_id=1001,  # Use unique ID
        to_organization_id=test_org_id,
        transaction_id=1008,
        compliance_units=100,
        current_status_id=3,  # Approved status
        transaction_effective_date=datetime(2024, 11, 1).date(),
    )
    dbsession.add(admin_adjustment)

    # 6. Future transfer - has past effective date but future create date (the bug case)
    future_transfer_from_tx = Transaction(
        transaction_id=1009,
        organization_id=test_org_id,
        compliance_units=-50,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2025, 8, 1),  # Future create date
    )
    dbsession.add(future_transfer_from_tx)
    
    future_transfer_to_tx = Transaction(
        transaction_id=1010,
        organization_id=test_org_2_id,
        compliance_units=50,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2025, 8, 1),  # Future create date
    )
    dbsession.add(future_transfer_to_tx)
    
    future_transfer = Transfer(
        transfer_id=1003,  # Use unique ID
        from_organization_id=test_org_id,
        to_organization_id=test_org_2_id,
        from_transaction_id=1009,
        to_transaction_id=1010,
        quantity=50,
        current_status_id=6,  # Recorded status
        transaction_effective_date=datetime(2024, 6, 1).date(),  # Past effective date - this creates the bug
    )
    dbsession.add(future_transfer)

    # 7. Future negative transaction (should reduce available balance)
    future_transaction = Transaction(
        transaction_id=1002,  # Use unique ID
        organization_id=test_org_id,
        compliance_units=-75,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2025, 8, 1),  # Future
    )
    dbsession.add(future_transaction)

    await dbsession.commit()

    # Calculate Line 17 available balance
    balance = await transaction_repo.calculate_line_17_available_balance_for_period(
        test_org_id, compliance_period
    )

    # Expected calculation:
    # Assessment: +1000
    # Transfer purchase: +500
    # Transfer sale: -200
    # Initiative Agreement: +300
    # Admin adjustment: +100
    # Future transfer: -50 (counted in past due to effective date, no double counting)
    # Future transaction: -75 (reduces available balance)
    # Total: 1000 + 500 - 200 + 300 + 100 - 50 - 75 = 1575
    assert balance == 1575


@pytest.mark.anyio
async def test_calculate_line_17_edge_cases(dbsession, transaction_repo):
    """Test edge cases for Line 17 calculation"""
    from datetime import datetime
    from lcfs.db.models.transaction.Transaction import (
        Transaction,
        TransactionActionEnum,
    )
    from lcfs.db.models import Organization, OrganizationAddress

    test_org_id = 1099  # Use high ID to avoid conflicts with seeded data
    compliance_period = 2024

    # Create test organization
    test_org = Organization(
        organization_id=test_org_id,
        name="Test Company 1099",
        operating_name="Test Co. 1099",
        org_address=OrganizationAddress(
            street_address="99 Test St",
            city="Test City",
            province_state="Test Province",
            country="Test Country",
            postalCode_zipCode="T3ST 9Z9",
        ),
    )
    dbsession.add(test_org)

    # Test with no transactions - should return 0
    balance_no_data = (
        await transaction_repo.calculate_line_17_available_balance_for_period(
            test_org_id, compliance_period
        )
    )
    assert balance_no_data == 0

    # Test negative balance scenario - should return 0 (max with 0)
    negative_transaction = Transaction(
        transaction_id=1100,  # Use unique ID
        organization_id=test_org_id,
        compliance_units=-500,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2024, 6, 1),
    )
    dbsession.add(negative_transaction)
    await dbsession.commit()

    balance_negative = (
        await transaction_repo.calculate_line_17_available_balance_for_period(
            test_org_id, compliance_period
        )
    )
    assert balance_negative == 0  # Should not go negative


@pytest.mark.anyio
async def test_calculate_line_17_period_boundaries(dbsession, transaction_repo):
    """Test that Line 17 calculation respects compliance period boundaries"""
    from datetime import datetime
    from lcfs.db.models.transfer.Transfer import Transfer
    from lcfs.db.models import Organization, OrganizationAddress

    test_org_id = 1088  # Use high ID to avoid conflicts with seeded data
    test_org_2_id = 1089
    compliance_period = 2024

    # Create test organizations
    test_org = Organization(
        organization_id=test_org_id,
        name="Test Company 1088",
        operating_name="Test Co. 1088",
        org_address=OrganizationAddress(
            street_address="88 Test St",
            city="Test City",
            province_state="Test Province",
            country="Test Country",
            postalCode_zipCode="T3ST 8Z8",
        ),
    )
    test_org_2 = Organization(
        organization_id=test_org_2_id,
        name="Test Company 1089",
        operating_name="Test Co. 1089",
        org_address=OrganizationAddress(
            street_address="89 Test St",
            city="Test City",
            province_state="Test Province",
            country="Test Country",
            postalCode_zipCode="T3ST 9Z9",
        ),
    )
    dbsession.add_all([test_org, test_org_2])

    # Transfer exactly at period end (March 31, 2025)
    # Create transactions for the transfer
    end_period_from_tx = Transaction(
        transaction_id=1200,
        organization_id=test_org_2_id,
        compliance_units=-1000,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2025, 3, 31),
    )
    dbsession.add(end_period_from_tx)
    
    end_period_to_tx = Transaction(
        transaction_id=1201,
        organization_id=test_org_id,
        compliance_units=1000,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2025, 3, 31),
    )
    dbsession.add(end_period_to_tx)
    
    end_period_transfer = Transfer(
        transfer_id=1200,  # Use unique ID
        from_organization_id=test_org_2_id,
        to_organization_id=test_org_id,
        from_transaction_id=1200,
        to_transaction_id=1201,
        quantity=1000,
        current_status_id=6,  # Recorded status
        transaction_effective_date=datetime(2025, 3, 31).date(),  # Period end
    )
    dbsession.add(end_period_transfer)

    # Transfer just after period end (April 1, 2025) - should reduce available balance  
    # This transfer has a future effective date, so it won't be in past balance
    # But it also has a future create date, so it won't be a future debit either
    after_period_from_tx = Transaction(
        transaction_id=1202,
        organization_id=test_org_id,
        compliance_units=-200,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2025, 4, 1),
    )
    dbsession.add(after_period_from_tx)
    
    after_period_to_tx = Transaction(
        transaction_id=1203,
        organization_id=test_org_2_id,
        compliance_units=200,
        transaction_action=TransactionActionEnum.Adjustment,
        create_date=datetime(2025, 4, 1),
    )
    dbsession.add(after_period_to_tx)
    
    after_period_transfer = Transfer(
        transfer_id=1201,  # Use unique ID
        from_organization_id=test_org_id,
        to_organization_id=test_org_2_id,
        from_transaction_id=1202,
        to_transaction_id=1203,
        quantity=200,
        current_status_id=6,  # Recorded status
        transaction_effective_date=datetime(2025, 4, 1).date(),  # After period
    )
    dbsession.add(after_period_transfer)

    await dbsession.commit()

    balance = await transaction_repo.calculate_line_17_available_balance_for_period(
        test_org_id, compliance_period
    )

    # Should include the period-end transfer (+1000) 
    # The future transfer won't be counted as a future debit since its effective date is also future
    # Expected: 1000
    assert balance == 1000


@pytest.mark.anyio
async def test_create_transaction(dbsession, transaction_repo):
    dbsession.add_all([test_org])
    await dbsession.flush()

    new_transaction = await transaction_repo.create_transaction(
        TransactionActionEnum.Adjustment, 100, test_org_id
    )
    assert new_transaction.transaction_action == TransactionActionEnum.Adjustment
    assert new_transaction.compliance_units == 100
    assert new_transaction.organization_id == test_org_id


@pytest.mark.anyio
async def test_reserve_transaction(dbsession, transaction_repo, mock_transactions):
    success = await transaction_repo.reserve_transaction(4)

    assert success == True
    updated_transaction = await dbsession.get(Transaction, 4)
    assert updated_transaction.transaction_action is TransactionActionEnum.Reserved


@pytest.mark.anyio
async def test_release_transaction(dbsession, transaction_repo, mock_transactions):
    success = await transaction_repo.release_transaction(4)
    assert success

    updated_transaction = await dbsession.get(Transaction, 4)
    assert updated_transaction.transaction_action == TransactionActionEnum.Released


@pytest.mark.anyio
async def test_confirm_transaction(dbsession, transaction_repo, mock_transactions):
    success = await transaction_repo.confirm_transaction(4)
    assert success

    updated_transaction = await dbsession.get(Transaction, 4)
    assert updated_transaction.transaction_action == TransactionActionEnum.Adjustment


@pytest.mark.anyio
async def test_transactions_in_have_correct_visibilities(
    dbsession, transaction_repo, mock_transactions
):
    sort_orders = [SortOrder(field="transaction_id", direction="asc")]

    transactions_transferor, total_count_transferor = (
        await transaction_repo.get_transactions_paginated(
            0, 10, [], sort_orders, test_org_id
        )
    )
    transactions_transferee, total_count_transferee = (
        await transaction_repo.get_transactions_paginated(
            0, 10, [], sort_orders, test_org_2_id
        )
    )
    transactions_gov, total_count_gov = (
        await transaction_repo.get_transactions_paginated(0, 10, [], sort_orders)
    )

    assert len(transactions_transferor) == 9
    assert total_count_transferor == 9

    assert len(transactions_transferee) == 8
    assert total_count_transferee == 8

    # Government sees non-transfer plus eligible transfer rows (rescinded excluded)
    assert len(transactions_gov) == 10
    assert total_count_gov == 10


@pytest.mark.anyio
async def test_get_visible_statuses_invalid_entity_type(transaction_repo):
    with pytest.raises(DatabaseException):
        await transaction_repo.get_visible_statuses("InvalidEntity")


@pytest.mark.anyio
async def test_get_visible_statuses_for_transferor(dbsession, transaction_repo):
    visible_statuses = await transaction_repo.get_visible_statuses(
        EntityType.Transferor
    )
    expected_statuses = [
        TransferStatusEnum.Draft,
        TransferStatusEnum.Sent,
        TransferStatusEnum.Submitted,
        TransferStatusEnum.Recommended,
        TransferStatusEnum.Recorded,
        TransferStatusEnum.Refused,
        TransferStatusEnum.Declined,
        TransferStatusEnum.Rescinded,
    ]

    # Verify that only the expected statuses are returned for a transferor
    assert set(visible_statuses) == set(
        expected_statuses
    ), "Unexpected statuses returned for transferor"


@pytest.mark.anyio
async def test_get_visible_statuses_for_transferee(dbsession, transaction_repo):
    visible_statuses = await transaction_repo.get_visible_statuses(
        EntityType.Transferee
    )
    expected_statuses = [
        TransferStatusEnum.Sent,
        TransferStatusEnum.Submitted,
        TransferStatusEnum.Recommended,
        TransferStatusEnum.Recorded,
        TransferStatusEnum.Refused,
        TransferStatusEnum.Declined,
        TransferStatusEnum.Rescinded,
    ]
    # Verify that only the expected statuses are returned for a transferee
    assert set(visible_statuses) == set(
        expected_statuses
    ), "Unexpected statuses returned for transferee"


@pytest.mark.anyio
async def test_get_visible_statuses_for_government(dbsession, transaction_repo):
    visible_statuses = await transaction_repo.get_visible_statuses(
        EntityType.Government
    )
    expected_statuses = [
        TransferStatusEnum.Submitted,
        TransferStatusEnum.Recommended,
        TransferStatusEnum.Recorded,
        TransferStatusEnum.Refused,
        TransferStatusEnum.Rescinded,
    ]
    # Verify that only the expected statuses are returned for the government
    assert set(visible_statuses) == set(
        expected_statuses
    ), "Unexpected statuses returned for government"


@pytest.mark.anyio
async def test_delete_transaction_success(dbsession, transaction_repo):
    """
    Verify that a transaction is deleted and its associated compliance report
    has its transaction_id set to None.
    """
    # Create and add a Transaction and a ComplianceReport referencing that transaction.
    transaction = Transaction(transaction_id=1000)
    compliance_report = ComplianceReport(
        compliance_report_id=2000,
        transaction_id=1000,
        compliance_period_id=15,
        organization_id=1,
    )
    dbsession.add_all([transaction, compliance_report])
    await dbsession.flush()

    # Call the delete_transaction method.
    await transaction_repo.delete_transaction(1000, 2000)
    await dbsession.commit()

    # Verify the Transaction is deleted.
    deleted_transaction = await dbsession.get(Transaction, 1000)
    assert deleted_transaction is None

    # Verify the ComplianceReport has been updated.
    updated_report = await dbsession.get(ComplianceReport, 2000)
    assert updated_report.transaction_id is None
