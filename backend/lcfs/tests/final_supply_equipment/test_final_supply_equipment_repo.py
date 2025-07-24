import pytest
from unittest.mock import AsyncMock
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
    organization = type("Org", (), {"organization_id": 1, "name": "Test Organization"})()
    # Simulate the queries returning tuples with organization names.
    # First call for allocation partners, second call for existing FSE orgs
    fake_db.execute.side_effect = [
        FakeResult([("Partner Org",)]),  # allocation partners
        FakeResult([("Org1",), ("Org2",)])  # existing FSE organizations
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
        FakeResult([("Org1",), ("Org2",)])  # existing FSE organizations
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
async def test_search_manufacturers(repo, fake_db):
    fake_db.execute.return_value = FakeResult(["Manufacturer1", "Manufacturer2"])
    results = await repo.search_manufacturers("manu")
    assert results == ["Manufacturer1", "Manufacturer2"]
