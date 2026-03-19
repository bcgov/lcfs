import pytest

from lcfs.services.ai_analytics.schema_catalog import SchemaCatalogService


@pytest.mark.anyio
async def test_schema_catalog_discovers_views(dbsession):
    service = SchemaCatalogService(dbsession)

    catalog = await service.get_catalog(force_refresh=True)

    entity_names = {entity.name for entity in catalog.entities}
    assert "v_compliance_report" in entity_names
    assert "mv_credit_ledger" in entity_names
    assert any(entity.preferred_for_analytics for entity in catalog.entities)
