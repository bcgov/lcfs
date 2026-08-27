from lcfs.web.api.search.entities import SEARCH_ENTITIES
from lcfs.web.api.search.entities.base import SearchContext
from lcfs.web.api.search.query import parse_query


def test_entity_registry_has_stable_unique_order():
    assert tuple(entity.entity_type for entity in SEARCH_ENTITIES) == (
        "organization",
        "report",
        "transfer",
        "fuel_code",
        "ci_application",
        "initiative_agreement",
        "admin_adjustment",
        "user",
    )
    assert len({entity.entity_type for entity in SEARCH_ENTITIES}) == len(
        SEARCH_ENTITIES
    )


def test_every_entity_is_implemented_in_its_own_module():
    modules = {entity.handler.__module__ for entity in SEARCH_ENTITIES}

    assert len(modules) == len(SEARCH_ENTITIES)
    assert all(module.startswith("lcfs.web.api.search.entities.") for module in modules)


def test_every_registry_entry_has_user_facing_metadata():
    assert all(entity.entity_type and entity.label for entity in SEARCH_ENTITIES)


def test_unbound_supplier_cannot_access_organization_records():
    context = SearchContext(
        query=parse_query("transfers"),
        organization_id=None,
        is_government=False,
    )

    assert not context.can_access_organization_records


def test_government_and_bound_supplier_can_access_organization_records():
    government = SearchContext(parse_query("transfers"), None, True)
    supplier = SearchContext(parse_query("transfers"), 7, False)

    assert government.can_access_organization_records
    assert supplier.can_access_organization_records
