from datetime import datetime


agreement_date = datetime.strptime("2024-02-02", "%Y-%m-%d").date()
test_transfer = {
    "from_organization_id": 1,
    "to_organization_id": 2,
    "current_status_id": 1,
    "transfer_category_id": 1,
    "agreement_date": agreement_date,
    "quantity": 100,
    "price_per_unit": 10.0
}
