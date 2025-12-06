import structlog
from sqlalchemy import select
from lcfs.db.models.compliance.NotionalTransfer import NotionalTransfer

logger = structlog.get_logger(__name__)


async def seed_test_notional_transfers(session):
    """
    Seeds the notional transfers into the database with comprehensive test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the notional transfers to seed based on actual test database
    notional_transfers_to_seed = [
        {
            "notional_transfer_id": 1,
            "compliance_report_id": 1,
            "legal_name": "LCFS Org 3",
            "address_for_service": "345 Radiant Road Solartown BC Canada V6M 2W8",
            "fuel_category_id": 1,
            "received_or_transferred": "Transferred",
            "quantity": 5000000,
            "group_uuid": "4b7f4dce-eaf8-4e7a-b8de-773b1b009584",
            "version": 0,
        },
        {
            "notional_transfer_id": 2,
            "compliance_report_id": 3,
            "legal_name": "LCFS Org 1",
            "address_for_service": "697 Burrard Street Vancouver BC Canada V6G 2P3",
            "fuel_category_id": 1,
            "received_or_transferred": "Received",
            "quantity": 5000000,
            "group_uuid": "ef6e44e2-9b39-40d5-94c2-6ffc584fa1f2",
            "version": 0,
        },
        {
            "notional_transfer_id": 3,
            "compliance_report_id": 6,
            "legal_name": "LCFS Org 3",
            "address_for_service": "345 Radiant Road Kamloops BC Canada V6M 2W8",
            "fuel_category_id": 1,
            "received_or_transferred": "Received",
            "quantity": 10000,
            "group_uuid": "121147f0-73dd-4e16-826c-2739a03994d6",
            "version": 0,
        },
        # New minimal notional transfers for LCFS1-10
        {"notional_transfer_id": 101, "compliance_report_id": 101, "legal_name": "LCFS Org 2", "address_for_service": "Addr A", "fuel_category_id": 1, "received_or_transferred": "Received", "quantity": 20, "group_uuid": "nt-101", "version": 0},
        {"notional_transfer_id": 102, "compliance_report_id": 102, "legal_name": "LCFS Org 3", "address_for_service": "Addr B", "fuel_category_id": 1, "received_or_transferred": "Transferred", "quantity": 15, "group_uuid": "nt-102", "version": 0},
        {"notional_transfer_id": 103, "compliance_report_id": 103, "legal_name": "LCFS Org 4", "address_for_service": "Addr C", "fuel_category_id": 1, "received_or_transferred": "Received", "quantity": 10, "group_uuid": "nt-103", "version": 0},
        {"notional_transfer_id": 104, "compliance_report_id": 104, "legal_name": "LCFS Org 5", "address_for_service": "Addr D", "fuel_category_id": 1, "received_or_transferred": "Transferred", "quantity": 12, "group_uuid": "nt-104", "version": 0},
        {"notional_transfer_id": 105, "compliance_report_id": 105, "legal_name": "LCFS Org 6", "address_for_service": "Addr E", "fuel_category_id": 1, "received_or_transferred": "Received", "quantity": 8, "group_uuid": "nt-105", "version": 0},
        {"notional_transfer_id": 106, "compliance_report_id": 106, "legal_name": "LCFS Org 7", "address_for_service": "Addr F", "fuel_category_id": 1, "received_or_transferred": "Transferred", "quantity": 18, "group_uuid": "nt-106", "version": 0},
        {"notional_transfer_id": 107, "compliance_report_id": 107, "legal_name": "LCFS Org 8", "address_for_service": "Addr G", "fuel_category_id": 1, "received_or_transferred": "Received", "quantity": 7, "group_uuid": "nt-107", "version": 0},
        {"notional_transfer_id": 108, "compliance_report_id": 108, "legal_name": "LCFS Org 9", "address_for_service": "Addr H", "fuel_category_id": 1, "received_or_transferred": "Transferred", "quantity": 5, "group_uuid": "nt-108", "version": 0},
        {"notional_transfer_id": 109, "compliance_report_id": 109, "legal_name": "LCFS Org 10", "address_for_service": "Addr I", "fuel_category_id": 1, "received_or_transferred": "Received", "quantity": 14, "group_uuid": "nt-109", "version": 0},
        {"notional_transfer_id": 110, "compliance_report_id": 110, "legal_name": "LCFS Org 1", "address_for_service": "Addr J", "fuel_category_id": 1, "received_or_transferred": "Transferred", "quantity": 9, "group_uuid": "nt-110", "version": 0},
        # Org2 chain quantities to match summaries: v0 transferred -15, v1 none, v2 transferred -12
        {"notional_transfer_id": 111, "compliance_report_id": 111, "legal_name": "LCFS Org 2", "address_for_service": "Addr AA", "fuel_category_id": 1, "received_or_transferred": "Transferred", "quantity": 15, "group_uuid": "nt-111", "version": 0},
        # Supplemental assessed (112) has both a transfer out and a smaller receive to yield net -10
        {"notional_transfer_id": 112, "compliance_report_id": 112, "legal_name": "LCFS Org 2", "address_for_service": "Addr AB", "fuel_category_id": 1, "received_or_transferred": "Transferred", "quantity": 15, "group_uuid": "nt-112", "version": 0},
        {"notional_transfer_id": 113, "compliance_report_id": 112, "legal_name": "LCFS Org 2", "address_for_service": "Addr AC", "fuel_category_id": 1, "received_or_transferred": "Received", "quantity": 5, "group_uuid": "nt-113", "version": 0},
        {"notional_transfer_id": 114, "compliance_report_id": 113, "legal_name": "LCFS Org 2", "address_for_service": "Addr AD", "fuel_category_id": 1, "received_or_transferred": "Transferred", "quantity": 12, "group_uuid": "nt-114", "version": 0},
    ]

    for notional_transfer_data in notional_transfers_to_seed:
        # Check if the notional transfer already exists
        existing_notional_transfer = await session.execute(
            select(NotionalTransfer).where(
                NotionalTransfer.notional_transfer_id
                == notional_transfer_data["notional_transfer_id"]
            )
        )
        existing_notional_transfer = existing_notional_transfer.scalar()
        if existing_notional_transfer:
            for key, value in notional_transfer_data.items():
                setattr(existing_notional_transfer, key, value)
            logger.info(
                f"Notional transfer with ID {notional_transfer_data['notional_transfer_id']} updated with latest seeded values."
            )
            continue

        # Create and add the new notional transfer
        notional_transfer = NotionalTransfer(**notional_transfer_data)
        session.add(notional_transfer)

    await session.flush()
    logger.info(f"Seeded {len(notional_transfers_to_seed)} notional transfers.")
