import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.api.final_supply_equipment.repo import FinalSupplyEquipmentRepository
from lcfs.web.api.base import PaginationRequestSchema


class FakeAsyncContextManager:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass


class FakeResult:
    def __init__(self, result):
        self._result = result

    def scalars(self):
        return self

    def all(self):
        return self._result

    def unique(self):
        return self

    def scalar_one_or_none(self):
        return self._result[0] if self._result else None

    def scalar_one(self):
        return self._result[0] if self._result else None

    def scalar(self):
        return self._result[0] if self._result else None


# Fixture for a fake database session.
@pytest.fixture
def fake_db():
    db = AsyncMock(spec=AsyncSession)
    # Simulate the async nested transaction context manager.
    db.begin_nested.return_value = FakeAsyncContextManager()
    return db


# Fixture for the repository instance using the fake database.
@pytest.fixture
def repo(fake_db):
    return FinalSupplyEquipmentRepository(db=fake_db)


@pytest.mark.anyio
async def test_get_intended_use_types(repo, fake_db):
    # Simulate returning two intended use types.
    fake_db.execute.return_value = FakeResult(["use_type1", "use_type2"])
    result = await repo.get_intended_use_types()
    assert result == ["use_type1", "use_type2"]
    fake_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_intended_use_by_name(repo, fake_db):
    # Simulate a lookup returning one intended use type.
    fake_db.execute.return_value = FakeResult(["use_typeA"])
    result = await repo.get_intended_use_by_name("use_typeA")
    assert result == "use_typeA"
    fake_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_intended_user_types(repo, fake_db):
    fake_db.execute.return_value = FakeResult(["user_type1", "user_type2"])
    result = await repo.get_intended_user_types()
    assert result == ["user_type1", "user_type2"]


@pytest.mark.anyio
async def test_get_organization_names_valid(repo, fake_db):
    # Create a dummy organization object with an organization_id and name.
    organization = type(
        "Org", (), {"organization_id": 1, "name": "Test Organization"}
    )()
    # Simulate the queries returning tuples with organization names.
    # First call for allocation partners, second call for existing FSE orgs
    fake_db.execute.side_effect = [
        FakeResult([("Partner Org",)]),  # allocation partners
        FakeResult([("Org1",), ("Org2",)]),  # existing FSE organizations
    ]
    result = await repo.get_organization_names(organization)
    # Should return user's organization first, then others alphabetically
    assert result == ["Test Organization", "Org1", "Org2", "Partner Org"]


@pytest.mark.anyio
async def test_get_organization_names_invalid(repo, fake_db):
    # When organization is None, it should return an empty list.
    result = await repo.get_organization_names(None)
    assert result == []

    # When organization has no organization_id attribute.
    organization = type("Org", (), {})()
    result = await repo.get_organization_names(organization)
    assert result == []


@pytest.mark.anyio
async def test_get_organization_names_no_name(repo, fake_db):
    # When organization has organization_id but no name, should still work
    organization = type("Org", (), {"organization_id": 1, "name": None})()
    fake_db.execute.side_effect = [
        FakeResult([("Partner Org",)]),  # allocation partners
        FakeResult([("Org1",), ("Org2",)]),  # existing FSE organizations
    ]
    result = await repo.get_organization_names(organization)
    # Should return organizations alphabetically (no user org to put first)
    assert result == ["Org1", "Org2", "Partner Org"]


@pytest.mark.anyio
async def test_get_intended_user_by_name(repo, fake_db):
    fake_db.execute.return_value = FakeResult(["user_typeA"])
    result = await repo.get_intended_user_by_name("user_typeA")
    assert result == "user_typeA"


@pytest.mark.anyio
async def test_get_levels_of_equipment(repo, fake_db):
    fake_db.execute.return_value = FakeResult(["level1", "level2"])
    result = await repo.get_levels_of_equipment()
    assert result == ["level1", "level2"]


@pytest.mark.anyio
async def test_get_level_of_equipment_by_name(repo, fake_db):
    fake_db.execute.return_value = FakeResult(["levelX"])
    result = await repo.get_level_of_equipment_by_name("levelX")
    assert result == "levelX"


@pytest.mark.anyio
async def test_get_fse_list(repo, fake_db):
    fake_db.execute.return_value = FakeResult(["fse1", "fse2"])
    result = await repo.get_fse_list(report_id=10)
    assert result == ["fse1", "fse2"]


@pytest.mark.anyio
async def test_get_fse_paginated(repo, fake_db):
    # Prepare two responses:
    # 1. Count query returns 3 total records.
    # 2. The actual paginated query returns 2 items.
    count_result = FakeResult([3])
    paginated_result = FakeResult(["fse_paginated1", "fse_paginated2"])
    fake_db.execute.side_effect = [count_result, paginated_result]

    pagination = PaginationRequestSchema(page=1, size=2)
    result, total = await repo.get_fse_paginated(pagination, compliance_report_id=20)
    assert total == 3
    assert result == ["fse_paginated1", "fse_paginated2"]


@pytest.mark.anyio
async def test_get_final_supply_equipment_by_id(repo, fake_db):
    fake_db.execute.return_value = FakeResult(["fse_item"])
    result = await repo.get_final_supply_equipment_by_id(final_supply_equipment_id=5)
    assert result == "fse_item"


@pytest.mark.anyio
async def test_update_final_supply_equipment(repo, fake_db):
    fse = "fse_to_update"
    # Simulate the merge returning the same object.
    fake_db.merge.return_value = fse
    updated = await repo.update_final_supply_equipment(fse)
    assert updated == fse
    fake_db.merge.assert_called_once_with(fse)
    fake_db.flush.assert_called_once()
    fake_db.refresh.assert_called_once_with(
        fse, ["level_of_equipment", "intended_use_types", "intended_user_types"]
    )


@pytest.mark.anyio
async def test_create_final_supply_equipment(repo, fake_db):
    fse = "new_fse"
    created = await repo.create_final_supply_equipment(fse)
    assert created == fse
    fake_db.add.assert_called_once_with(fse)
    fake_db.flush.assert_called_once()
    fake_db.refresh.assert_called_once_with(
        fse, ["level_of_equipment", "intended_use_types"]
    )


@pytest.mark.anyio
async def test_delete_final_supply_equipment(repo, fake_db):
    await repo.delete_final_supply_equipment(final_supply_equipment_id=99)
    fake_db.execute.assert_called_once()  # delete statement was executed
    fake_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_get_current_seq_by_org_and_postal_code_existing(repo, fake_db):
    fake_db.execute.return_value = FakeResult([5])
    seq = await repo.get_current_seq_by_org_and_postal_code("orgCode", "postal123")
    assert seq == 5


@pytest.mark.anyio
async def test_get_current_seq_by_org_and_postal_code_none(repo, fake_db):
    fake_db.execute.return_value = FakeResult([None])
    seq = await repo.get_current_seq_by_org_and_postal_code("orgCode", "postal123")
    assert seq == 0


@pytest.mark.anyio
async def test_increment_seq_by_org_and_postal_code_update(repo, fake_db):
    # Simulate update returning a new sequence number.
    fake_db.execute.return_value = FakeResult([6])
    seq = await repo.increment_seq_by_org_and_postal_code("orgCode", "postal123")
    assert seq == 6


@pytest.mark.anyio
async def test_increment_seq_by_org_and_postal_code_insert(repo, fake_db):
    # Simulate update returning None so that a new record is inserted.
    fake_db.execute.return_value = FakeResult([None])
    seq = await repo.increment_seq_by_org_and_postal_code("orgCode", "postal123")
    assert seq == 1
    fake_db.add.assert_called_once()
    fake_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_check_uniques_of_fse_row_exists(
    repo, fake_db, valid_final_supply_equipment_create_schema
):
    fake_db.execute.return_value = FakeResult([True])
    exists_result = await repo.check_uniques_of_fse_row(
        valid_final_supply_equipment_create_schema
    )
    assert exists_result is True


@pytest.mark.anyio
async def test_check_uniques_of_fse_row_not_exists(
    repo, fake_db, valid_final_supply_equipment_create_schema
):
    fake_db.execute.return_value = FakeResult([False])
    exists_result = await repo.check_uniques_of_fse_row(
        valid_final_supply_equipment_create_schema
    )
    assert exists_result is False


@pytest.mark.anyio
async def test_check_uniques_of_fse_row_excludes_same_id(
    repo, fake_db, valid_final_supply_equipment_create_schema
):
    # Test that the method excludes records with the same final_supply_equipment_id
    valid_final_supply_equipment_create_schema.final_supply_equipment_id = 999
    fake_db.execute.return_value = FakeResult([False])
    exists_result = await repo.check_uniques_of_fse_row(
        valid_final_supply_equipment_create_schema
    )
    assert exists_result is False


@pytest.mark.anyio
async def test_check_uniques_of_fse_row_scopes_to_current_report(
    repo, fake_db, valid_final_supply_equipment_create_schema
):
    # Test that the method only checks within the current compliance report
    fake_db.execute.return_value = FakeResult([False])
    exists_result = await repo.check_uniques_of_fse_row(
        valid_final_supply_equipment_create_schema
    )
    assert exists_result is False
    # Should have been called once
    assert fake_db.execute.call_count == 1


@pytest.mark.anyio
async def test_check_overlap_of_fse_row_exists(
    repo, fake_db, valid_final_supply_equipment_create_schema
):
    valid_final_supply_equipment_create_schema.serial_nbr = "OVERLAP1"
    fake_db.execute.return_value = FakeResult([True])
    overlap = await repo.check_overlap_of_fse_row(
        valid_final_supply_equipment_create_schema
    )
    assert overlap is True


@pytest.mark.anyio
async def test_check_overlap_of_fse_row_not_exists(
    repo, fake_db, valid_final_supply_equipment_create_schema
):
    fake_db.execute.return_value = FakeResult([False])
    overlap = await repo.check_overlap_of_fse_row(
        valid_final_supply_equipment_create_schema
    )
    assert overlap is False


@pytest.mark.anyio
async def test_check_overlap_of_fse_row_excludes_same_id(
    repo, fake_db, valid_final_supply_equipment_create_schema
):
    # Test that the method excludes records with the same final_supply_equipment_id
    valid_final_supply_equipment_create_schema.final_supply_equipment_id = 999
    valid_final_supply_equipment_create_schema.serial_nbr = "OVERLAP1"
    fake_db.execute.return_value = FakeResult([False])
    overlap = await repo.check_overlap_of_fse_row(
        valid_final_supply_equipment_create_schema
    )
    assert overlap is False


@pytest.mark.anyio
async def test_check_overlap_of_fse_row_scopes_to_current_report(
    repo, fake_db, valid_final_supply_equipment_create_schema
):
    # Test that the method only checks within the current compliance report
    valid_final_supply_equipment_create_schema.serial_nbr = "OVERLAP1"
    fake_db.execute.return_value = FakeResult([False])
    overlap = await repo.check_overlap_of_fse_row(
        valid_final_supply_equipment_create_schema
    )
    assert overlap is False
    # Should have been called once
    assert fake_db.execute.call_count == 1


@pytest.mark.anyio
async def test_search_manufacturers(repo, fake_db):
    fake_db.execute.return_value = FakeResult(["Manufacturer1", "Manufacturer2"])
    results = await repo.search_manufacturers("manu")
    assert results == ["Manufacturer1", "Manufacturer2"]


@pytest.mark.anyio
async def test_check_uniques_within_current_report_only(repo, fake_db):
    """
    Test that records are only checked for duplicates within the current compliance report
    """
    from lcfs.web.api.final_supply_equipment.schema import (
        FinalSupplyEquipmentCreateSchema,
    )
    from datetime import date

    # Create FSE record for current report
    fse_record = FinalSupplyEquipmentCreateSchema(
        compliance_report_id=100,
        supply_from_date=date(2024, 1, 1),
        supply_to_date=date(2024, 12, 31),
        serial_nbr="TEST_SERIAL",
        postal_code="V3A 7E9",
        latitude=49.123,
        longitude=-122.456,
        manufacturer="Test Manufacturer",
        level_of_equipment="Level 1",
        intended_use_types=["Public charging"],
        intended_user_types=["Test"],
        street_address="123 Test St",
        city="Test City",
        organization_name="Test Org",
    )

    # Mock that no duplicates are found within the current report
    fake_db.execute.return_value = FakeResult([False])

    result = await repo.check_uniques_of_fse_row(fse_record)
    assert result is False  # Should not find duplicates


@pytest.mark.anyio
async def test_check_overlap_within_current_report_only(repo, fake_db):
    """
    Test that overlapping date ranges are only checked within the current compliance report
    """
    from lcfs.web.api.final_supply_equipment.schema import (
        FinalSupplyEquipmentCreateSchema,
    )
    from datetime import date

    fse_overlap = FinalSupplyEquipmentCreateSchema(
        compliance_report_id=300,
        supply_from_date=date(2024, 6, 1),
        supply_to_date=date(2024, 8, 31),
        serial_nbr="OVERLAP_SERIAL",
        postal_code="V5A 4N3",
        latitude=49.200,
        longitude=-122.500,
        manufacturer="Test Manufacturer",
        level_of_equipment="Level 2",
        intended_use_types=["Fleet"],
        intended_user_types=["Test"],
        street_address="456 Test Ave",
        city="Test City",
        organization_name="Test Org",
    )

    # Mock that overlaps are found within the current report
    fake_db.execute.return_value = FakeResult([True])

    result = await repo.check_overlap_of_fse_row(fse_overlap)
    assert result is True  # Should detect overlap within current report


@pytest.mark.anyio
async def test_check_overlap_different_charging_site_not_blocked(repo, fake_db):
    """
    Test that same serial number at a different Charging site (different postal_code/lat/lon)
    does not trigger an overlap — the query must scope to the same location.
    The mock returns False, simulating no match found when location differs.
    """
    from lcfs.web.api.final_supply_equipment.schema import (
        FinalSupplyEquipmentCreateSchema,
    )
    from datetime import date

    fse_record = FinalSupplyEquipmentCreateSchema(
        compliance_report_id=400,
        supply_from_date=date(2024, 1, 1),
        supply_to_date=date(2024, 12, 31),
        serial_nbr="RELOCATED_SERIAL",
        postal_code="V8V 1V1",  # different site
        latitude=48.425,
        longitude=-123.365,
        manufacturer="Test Manufacturer",
        level_of_equipment="Level 2",
        intended_use_types=["Public charging"],
        intended_user_types=["Test"],
        street_address="789 New Site Rd",
        city="Victoria",
        organization_name="Test Org",
    )

    # Simulate no overlap found because location conditions filter it out
    fake_db.execute.return_value = FakeResult([False])

    result = await repo.check_overlap_of_fse_row(fse_record)
    assert result is False  # Different Charging site — should not be blocked


@pytest.mark.anyio
async def test_get_fse_reporting_list_paginated(repo, fake_db):
    """Test getting paginated FSE reporting list"""
    # Mock the count query result
    count_result = FakeResult([5])
    # Mock the data query result
    data_result = MagicMock()
    data_result.fetchall.return_value = [
        {
            "charging_equipment_id": 1,
            "charging_equipment_version": 0,
            "serial_number": "SER123",
            "manufacturer": "TestMfg",
            "supply_from_date": "2024-01-01",
            "supply_to_date": "2024-12-31",
            "status": "Submitted",
        },
        {
            "charging_equipment_id": 2,
            "charging_equipment_version": 0,
            "serial_number": "SER456",
            "manufacturer": "TestMfg2",
            "supply_from_date": "2024-01-01",
            "supply_to_date": "2024-12-31",
            "status": "Validated",
        },
    ]

    fake_db.scalar.return_value = 5
    fake_db.execute.return_value = data_result

    pagination = PaginationRequestSchema(page=1, size=10, filters=[], sort_orders=[])
    data, total = await repo.get_fse_reporting_list_paginated(
        1, pagination, 10, "current"
    )

    assert total == 5
    assert len(data) == 2
    assert data[0]["charging_equipment_id"] == 1
    assert data[0]["status"] == "Submitted"


@pytest.mark.anyio
async def test_create_fse_reporting_batch(repo, fake_db):
    """Test creating FSE reporting batch"""
    data = [
        {
            "charging_equipment_id": 1,
            "charging_equipment_version": 0,
            "compliance_report_id": 10,
            "supply_from_date": "2024-01-01",
            "supply_to_date": "2024-12-31",
            "kwh_usage": 1000.0,
        }
    ]

    result = await repo.create_fse_reporting_batch(data)

    assert result["message"] == "FSE compliance reporting data created successfully"
    fake_db.add_all.assert_called_once()
    fake_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_update_fse_reporting(repo, fake_db):
    """Test updating FSE reporting"""
    data = {"kwh_usage": 1500.0, "notes": "Updated notes"}

    result = await repo.update_fse_reporting(1, data)

    assert result["id"] == 1
    assert result["kwh_usage"] == 1500.0
    assert result["notes"] == "Updated notes"
    fake_db.execute.assert_called_once()
    fake_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_delete_fse_reporting(repo, fake_db):
    """Test deleting FSE reporting"""
    await repo.delete_fse_reporting(1)

    fake_db.execute.assert_called_once()
    fake_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_delete_fse_reporting_batch(repo, fake_db):
    """Test batch deletion of FSE reporting"""
    mock_result = MagicMock()
    mock_result.rowcount = 3
    fake_db.execute.return_value = mock_result

    result = await repo.delete_fse_reporting_batch([1, 2, 3])

    assert result == 3
    fake_db.execute.assert_called_once()
    fake_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_bulk_update_reporting_dates(repo, fake_db):
    """Test bulk updating reporting dates"""
    mock_result = MagicMock()
    mock_result.rowcount = 2
    fake_db.execute.return_value = mock_result

    data = MagicMock(
        equipment_ids=[1, 2],
        compliance_report_id=10,
        organization_id=5,
        supply_from_date="2024-01-01",
        supply_to_date="2024-12-31",
    )

    result = await repo.bulk_update_reporting_dates(data)

    assert result == 2
    fake_db.execute.assert_called_once()
    fake_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_update_reporting_active_status(repo, fake_db):
    """Test updating reporting active status"""
    mock_result = MagicMock()
    mock_result.rowcount = 4
    fake_db.execute.return_value = mock_result

    result = await repo.update_reporting_active_status([1, 2, 3, 4], False)

    assert result == 4
    fake_db.execute.assert_called_once()
    fake_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_get_fse_reporting_list_paginated_prioritizes_group_uuid(repo, fake_db):
    """Ensure mode='all' prioritizes rows matching provided compliance_report_group_uuid"""
    fake_db.scalar.return_value = 0
    data_result = MagicMock()
    data_result.fetchall.return_value = []
    fake_db.execute.return_value = data_result

    pagination = PaginationRequestSchema(page=1, size=10, filters=[], sort_orders=[])
    group_uuid = "group-123"

    await repo.get_fse_reporting_list_paginated(1, pagination, group_uuid, "all")

    executed_query = fake_db.execute.call_args[0][0]
    compiled_sql = str(executed_query.compile(compile_kwargs={"literal_binds": True}))

    assert "CASE" in compiled_sql
    assert group_uuid in compiled_sql


@pytest.mark.anyio
async def test_has_charging_equipment_for_organization_with_equipment(repo, fake_db):
    """Test has_charging_equipment_for_organization returns True when equipment exists."""
    # Simulate database returning count > 0
    fake_db.execute.return_value = FakeResult([5])

    result = await repo.has_charging_equipment_for_organization(1)

    assert result is True
    fake_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_has_charging_equipment_for_organization_without_equipment(repo, fake_db):
    """Test has_charging_equipment_for_organization returns False when no equipment exists."""
    # Simulate database returning count = 0
    fake_db.execute.return_value = FakeResult([0])

    result = await repo.has_charging_equipment_for_organization(1)

    assert result is False
    fake_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_has_charging_equipment_for_organization_with_none_count(repo, fake_db):
    """Test has_charging_equipment_for_organization handles None result."""
    # Simulate database returning None
    fake_db.execute.return_value = FakeResult([None])

    result = await repo.has_charging_equipment_for_organization(1)

    assert result is False
    fake_db.execute.assert_called_once()


# ===========================================================================
# bulk_update_fse_reporting_record
# ===========================================================================


@pytest.mark.anyio
async def test_bulk_update_all_fields_executes_update(repo, fake_db):
    """All four data fields + activate → execute + flush called once each."""
    from datetime import date

    await repo.bulk_update_fse_reporting_record(
        charging_equipment_compliance_id=10,
        supply_from_date=date(2024, 1, 1),
        supply_to_date=date(2024, 12, 31),
        kwh_usage=500.0,
        compliance_notes="good notes",
        activate=True,
    )

    fake_db.execute.assert_called_once()
    fake_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_bulk_update_partial_fields_still_executes(repo, fake_db):
    """Providing only kwh_usage + activate still triggers execute + flush."""
    await repo.bulk_update_fse_reporting_record(
        charging_equipment_compliance_id=10,
        supply_from_date=None,
        supply_to_date=None,
        kwh_usage=250.0,
        compliance_notes=None,
        activate=True,
    )

    fake_db.execute.assert_called_once()
    fake_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_bulk_update_no_fields_skips_execute(repo, fake_db):
    """All None + activate=False → guard triggers; no DB call made."""
    await repo.bulk_update_fse_reporting_record(
        charging_equipment_compliance_id=10,
        supply_from_date=None,
        supply_to_date=None,
        kwh_usage=None,
        compliance_notes=None,
        activate=False,
    )

    fake_db.execute.assert_not_called()
    fake_db.flush.assert_not_called()


@pytest.mark.anyio
async def test_bulk_update_activate_only_executes(repo, fake_db):
    """activate=True with all data fields None → is_active update still runs."""
    await repo.bulk_update_fse_reporting_record(
        charging_equipment_compliance_id=10,
        supply_from_date=None,
        supply_to_date=None,
        kwh_usage=None,
        compliance_notes=None,
        activate=True,
    )

    fake_db.execute.assert_called_once()
    fake_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_bulk_update_without_activate_does_not_set_is_active(repo, fake_db):
    """activate=False (default) → is_active is NOT included in the UPDATE statement."""
    from datetime import date

    await repo.bulk_update_fse_reporting_record(
        charging_equipment_compliance_id=7,
        supply_from_date=date(2024, 1, 1),
        supply_to_date=date(2024, 12, 31),
        kwh_usage=100.0,
        compliance_notes=None,
        activate=False,
    )

    fake_db.execute.assert_called_once()
    stmt = fake_db.execute.call_args[0][0]
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "is_active" not in compiled


@pytest.mark.anyio
async def test_bulk_update_with_activate_includes_is_active(repo, fake_db):
    """activate=True → the compiled UPDATE statement must contain is_active = true."""
    from datetime import date

    await repo.bulk_update_fse_reporting_record(
        charging_equipment_compliance_id=7,
        supply_from_date=date(2024, 1, 1),
        supply_to_date=date(2024, 12, 31),
        kwh_usage=100.0,
        compliance_notes=None,
        activate=True,
    )

    stmt = fake_db.execute.call_args[0][0]
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "is_active" in compiled


# ===========================================================================
# get_fse_reporting_record_for_group
# ===========================================================================


@pytest.mark.anyio
async def test_get_fse_reporting_record_for_group_found(repo, fake_db):
    """Returns the first matching record when found."""
    mock_record = MagicMock()
    mock_record.charging_equipment_compliance_id = 99

    result_mock = MagicMock()
    result_mock.scalars.return_value.first.return_value = mock_record
    fake_db.execute.return_value = result_mock

    record = await repo.get_fse_reporting_record_for_group(
        charging_equipment_id=1,
        charging_equipment_version=0,
        compliance_report_group_uuid="group-uuid",
    )

    assert record is mock_record
    fake_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_fse_reporting_record_for_group_not_found(repo, fake_db):
    """Returns None when no matching record exists."""
    result_mock = MagicMock()
    result_mock.scalars.return_value.first.return_value = None
    fake_db.execute.return_value = result_mock

    record = await repo.get_fse_reporting_record_for_group(
        charging_equipment_id=1,
        charging_equipment_version=0,
        compliance_report_group_uuid="nonexistent-group",
    )

    assert record is None


@pytest.mark.anyio
async def test_get_fse_reporting_record_for_group_query_does_not_filter_on_version(
    repo, fake_db
):
    """
    The query must be version-agnostic: the compiled SQL should NOT contain a
    WHERE clause on charging_equipment_version so that equipment linked to an
    older site version is still found.
    """
    result_mock = MagicMock()
    result_mock.scalars.return_value.first.return_value = None
    fake_db.execute.return_value = result_mock

    await repo.get_fse_reporting_record_for_group(
        charging_equipment_id=1,
        charging_equipment_version=99,   # arbitrary; must be ignored
        compliance_report_group_uuid="group-xyz",
    )

    stmt = fake_db.execute.call_args[0][0]
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    # The WHERE clause must filter on charging_equipment_id and
    # compliance_report_group_uuid but NOT on charging_equipment_version.
    assert "charging_equipment_id" in compiled
    assert "compliance_report_group_uuid" in compiled
    assert "charging_equipment_version" not in compiled.split("WHERE")[1].split("ORDER")[0]


# ===========================================================================
# bulk_update_fse_reporting_record — deactivate path
# ===========================================================================


@pytest.mark.anyio
async def test_bulk_update_deactivate_executes_update(repo, fake_db):
    """deactivate=True → execute + flush are called."""
    await repo.bulk_update_fse_reporting_record(
        charging_equipment_compliance_id=20,
        supply_from_date=None,
        supply_to_date=None,
        kwh_usage=None,
        compliance_notes=None,
        deactivate=True,
    )

    fake_db.execute.assert_called_once()
    fake_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_bulk_update_deactivate_sets_is_active_false(repo, fake_db):
    """deactivate=True → compiled SQL must set is_active = false."""
    await repo.bulk_update_fse_reporting_record(
        charging_equipment_compliance_id=20,
        supply_from_date=None,
        supply_to_date=None,
        kwh_usage=None,
        compliance_notes=None,
        deactivate=True,
    )

    stmt = fake_db.execute.call_args[0][0]
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "is_active" in compiled
    assert "false" in compiled.lower()


@pytest.mark.anyio
async def test_bulk_update_deactivate_does_not_set_dates(repo, fake_db):
    """
    deactivate=True must NOT update supply_from_date or supply_to_date because
    those columns are NOT NULL in the database.
    """
    await repo.bulk_update_fse_reporting_record(
        charging_equipment_compliance_id=20,
        supply_from_date=None,
        supply_to_date=None,
        kwh_usage=None,
        compliance_notes=None,
        deactivate=True,
    )

    stmt = fake_db.execute.call_args[0][0]
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "supply_from_date" not in compiled
    assert "supply_to_date" not in compiled


@pytest.mark.anyio
async def test_bulk_update_deactivate_takes_precedence_over_activate(repo, fake_db):
    """
    When both deactivate=True and activate=True are passed, deactivate must win
    (is_active is set to False, not True).
    """
    await repo.bulk_update_fse_reporting_record(
        charging_equipment_compliance_id=30,
        supply_from_date=None,
        supply_to_date=None,
        kwh_usage=None,
        compliance_notes=None,
        activate=True,
        deactivate=True,
    )

    stmt = fake_db.execute.call_args[0][0]
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "is_active" in compiled
    assert "false" in compiled.lower()
