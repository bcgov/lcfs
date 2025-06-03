import structlog
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from lcfs.db.models.document.Document import Document
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport

logger = structlog.get_logger(__name__)


async def seed_test_documents(session):
    """
    Seeds the document records into the database with comprehensive test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the documents to seed based on actual compliance report data
    documents_to_seed = [
        {
            "document_id": 1,
            "file_key": "lcfs-docs/compliance_report/4/639a101c-67ae-4989-976d-2f9d85a2c117",
            "file_name": "2_Fake hydro bill for testing - Copy.pdf",
            "file_size": 15439,
            "mime_type": "application/pdf",
            "compliance_report_ids": [4],  # Associate with compliance report 4
        },
        {
            "document_id": 2,
            "file_key": "lcfs-docs/compliance_report/4/77099f58-6df7-48d7-ac3f-a111b146369f",
            "file_name": "1_Fake hydro bill for testing.pdf",
            "file_size": 15439,
            "mime_type": "application/pdf",
            "compliance_report_ids": [4],  # Associate with compliance report 4
        },
        {
            "document_id": 3,
            "file_key": "lcfs-docs/compliance_report/4/20fb6bfa-2fc2-4163-bbc4-f34e5cead573",
            "file_name": "Testing charge info.xlsx",
            "file_size": 8461,
            "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "compliance_report_ids": [4],  # Associate with compliance report 4
        },
    ]

    for document_data in documents_to_seed:
        # Extract compliance report IDs before creating the document
        compliance_report_ids = document_data.pop("compliance_report_ids", [])

        # Check if the document already exists
        existing_document = await session.execute(
            select(Document).where(Document.document_id == document_data["document_id"])
        )
        if existing_document.scalar():
            logger.info(
                f"Document with ID {document_data['document_id']} already exists, skipping."
            )
            continue

        # Create and add the new document
        document = Document(**document_data)
        session.add(document)
        await session.flush()  # Flush to get the document ID

        # Add associations with compliance reports
        for compliance_report_id in compliance_report_ids:
            # Use eager loading to avoid lazy loading issues
            compliance_report_result = await session.execute(
                select(ComplianceReport)
                .options(joinedload(ComplianceReport.documents))
                .where(ComplianceReport.compliance_report_id == compliance_report_id)
            )
            compliance_report = compliance_report_result.unique().scalar_one_or_none()

            if compliance_report:
                # Add the document to the compliance report's documents relationship
                # Since we used eager loading, this won't trigger additional queries
                compliance_report.documents.append(document)

    await session.flush()
    logger.info(f"Seeded {len(documents_to_seed)} documents.")
