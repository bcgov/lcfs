"""Tests for the CI application service layer."""

from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.ci_application import CIApplication, CIApplicationStatus
from lcfs.db.models.fuel.UnitOfMeasure import UnitOfMeasure
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.ci_application.schema import (
    CIApplicationsListSchema,
    CIApplicationSchema,
    CIApplicationStatusEnum,
    CIApplicationStep1Schema,
    CIApplicationStep2Schema,
    CITableOptionsSchema,
    PathwayInputSchema,
)
from lcfs.web.api.ci_application.services import CIApplicationServices
from lcfs.web.exception.exceptions import DataNotFoundException


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def repo():
    return AsyncMock()


@pytest.fixture
def user_repo():
    repo = AsyncMock()
    repo.get_full_name = AsyncMock(return_value=None)
    return repo


@pytest.fixture
def service(repo, user_repo):
    return CIApplicationServices(repo=repo, user_repo=user_repo)


@pytest.fixture
def mock_user():
    user = MagicMock()
    user.keycloak_username = "ci_applicant_user"
    return user


def _status(name="Draft", ident=1):
    return CIApplicationStatus(
        ci_application_status_id=ident,
        status=name,
        description=name,
        display_order=ident,
    )


def _uom(uom_id=1, name="Litres"):
    return UnitOfMeasure(uom_id=uom_id, name=name, description=name)


def _organization(org_id=1, name="Fuel Producer Ltd."):
    return SimpleNamespace(
        organization_id=org_id,
        name=name,
        operating_name=f"{name} (DBA)",
        email="hello@example.com",
        phone="+1 555 0100",
    )


def _ci_application(
    ci_application_id=10,
    status=None,
    organization=None,
    unit=None,
):
    status = status or _status()
    organization = organization or _organization()
    unit = unit or _uom()
    return SimpleNamespace(
        ci_application_id=ci_application_id,
        organization_id=organization.organization_id,
        organization=organization,
        status_id=status.ci_application_status_id,
        ci_application_status=status,
        facility_city="San Martin",
        facility_province_state="Santa Fe",
        facility_country="Argentina",
        facility_iso="AR",
        facility_nameplate_capacity=1000,
        facility_nameplate_capacity_unit_id=unit.uom_id,
        facility_nameplate_capacity_unit=unit,
        proposed_fuel_code_effective_date=date(2026, 6, 1),
        pathway_description=None,
        supporting_document_other=None,
        consultant_name=None,
        consultant_company=None,
        consultant_email=None,
        signature_user=None,
        signature_date_time=None,
        update_date=datetime(2026, 5, 1, tzinfo=timezone.utc),
        create_date=datetime(2026, 4, 1, tzinfo=timezone.utc),
        group_uuid="abc",
        version=0,
        action_type=ActionTypeEnum.CREATE,
    )


def _step1_payload(**overrides):
    base = dict(
        facility_city="San Martin",
        facility_province_state="Santa Fe",
        facility_country="Argentina",
        facility_iso="AR",
        facility_nameplate_capacity=1000,
        facility_nameplate_capacity_unit_id=1,
        proposed_fuel_code_effective_date=date(2026, 6, 1),
    )
    base.update(overrides)
    return CIApplicationStep1Schema(**base)


# ---------------------------------------------------------------------------
# Lookup options
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_table_options_returns_lookup_data(service, repo):
    repo.get_statuses.return_value = [
        _status("Draft", 1),
        _status("Submitted", 2),
        _status("Completed", 3),
        _status("Withdrawn", 4),
    ]
    repo.get_units_of_measure.return_value = [_uom(1, "Litres"), _uom(2, "Kilograms")]

    result = await service.get_table_options()

    assert isinstance(result, CITableOptionsSchema)
    assert [s.status for s in result.statuses] == [
        CIApplicationStatusEnum.Draft,
        CIApplicationStatusEnum.Submitted,
        CIApplicationStatusEnum.Completed,
        CIApplicationStatusEnum.Withdrawn,
    ]
    assert {u.name for u in result.units_of_measure} == {"Litres", "Kilograms"}


# ---------------------------------------------------------------------------
# Listing
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_list_ci_applications_returns_pagination(service, repo):
    repo.list_paginated.return_value = ([_ci_application(), _ci_application(11)], 2)
    repo.total_pages = MagicMock(return_value=1)
    repo.get_latest_comments_by_ci_application_ids.return_value = {}

    pagination = PaginationRequestSchema(page=1, size=10)
    result = await service.list_ci_applications(pagination, organization_id=1)

    assert isinstance(result, CIApplicationsListSchema)
    assert result.pagination.total == 2
    assert result.pagination.page == 1
    assert len(result.ci_applications) == 2
    assert result.ci_applications[0].facility_country == "Argentina"


@pytest.mark.anyio
async def test_list_ci_applications_passes_org_id(service, repo):
    repo.list_paginated.return_value = ([], 0)
    repo.total_pages = MagicMock(return_value=0)
    repo.get_latest_comments_by_ci_application_ids.return_value = {}

    pagination = PaginationRequestSchema(page=1, size=10)
    await service.list_ci_applications(pagination, organization_id=99)

    repo.list_paginated.assert_awaited_once_with(pagination, 99)


# ---------------------------------------------------------------------------
# Detail
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_ci_application_returns_full_schema(service, repo):
    repo.get_by_id.return_value = _ci_application()
    result = await service.get_ci_application(10)
    assert isinstance(result, CIApplicationSchema)
    assert result.ci_application_id == 10
    assert result.facility_country == "Argentina"
    assert result.organization is not None
    assert result.organization.name == "Fuel Producer Ltd."
    assert result.facility_nameplate_capacity_unit.name == "Litres"


@pytest.mark.anyio
async def test_get_ci_application_missing_raises(service, repo):
    repo.get_by_id.return_value = None
    with pytest.raises(DataNotFoundException):
        await service.get_ci_application(123)


# ---------------------------------------------------------------------------
# Create draft
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_create_draft_persists_with_draft_status(service, repo, mock_user):
    draft_status = _status("Draft", 1)
    repo.get_status_by_name.return_value = draft_status
    repo.create.side_effect = lambda ci: ci  # echo
    repo.add_history.return_value = MagicMock()
    repo.get_by_id.return_value = _ci_application(status=draft_status)

    result = await service.create_draft(
        organization_id=1,
        data=_step1_payload(),
        user=mock_user,
    )

    repo.get_status_by_name.assert_awaited_once_with("Draft")
    repo.create.assert_awaited_once()
    created_ci = repo.create.await_args.args[0]
    assert isinstance(created_ci, CIApplication)
    assert created_ci.organization_id == 1
    assert created_ci.status_id == draft_status.ci_application_status_id
    assert created_ci.facility_country == "Argentina"
    assert created_ci.action_type == ActionTypeEnum.CREATE
    assert created_ci.create_user == "ci_applicant_user"
    repo.add_history.assert_awaited_once()
    assert isinstance(result, CIApplicationSchema)
    assert result.status.status == CIApplicationStatusEnum.Draft


@pytest.mark.anyio
async def test_create_draft_raises_when_no_draft_status(service, repo, mock_user):
    repo.get_status_by_name.return_value = None
    with pytest.raises(DataNotFoundException):
        await service.create_draft(1, _step1_payload(), mock_user)
    repo.create.assert_not_called()


# ---------------------------------------------------------------------------
# Update step 1
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_step1_writes_fields_and_marks_update(service, repo, mock_user):
    ci = _ci_application()
    repo.update.side_effect = lambda obj: obj
    repo.get_by_id.return_value = ci

    payload = _step1_payload(
        facility_city="Vancouver",
        facility_province_state="BC",
        facility_country="Canada",
        facility_iso="CA",
        facility_nameplate_capacity=2500,
        facility_nameplate_capacity_unit_id=2,
        proposed_fuel_code_effective_date=date(2027, 1, 1),
    )

    result = await service.update_step1(ci, payload, mock_user)

    assert ci.facility_city == "Vancouver"
    assert ci.facility_country == "Canada"
    assert ci.facility_nameplate_capacity == 2500
    assert ci.facility_nameplate_capacity_unit_id == 2
    assert ci.action_type == ActionTypeEnum.UPDATE
    assert ci.update_user == "ci_applicant_user"
    assert isinstance(result, CIApplicationSchema)
    repo.update.assert_awaited_once_with(ci)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_delete_draft_calls_repo(service, repo):
    ci = _ci_application()
    await service.delete_draft(ci)
    repo.delete.assert_awaited_once_with(ci)


# ---------------------------------------------------------------------------
# Step 2 — Proposed fuel pathways
# ---------------------------------------------------------------------------


def _pathway_app_type(ident=1, name="New"):
    return SimpleNamespace(
        pathway_application_type_id=ident,
        type=name,
        description=name,
    )


def _pathway_fc_type(ident=1, name="1-year provisional"):
    return SimpleNamespace(
        pathway_fuel_code_type_id=ident,
        type=name,
        description=name,
    )


def _fuel_type_obj(ident=1, name="Biodiesel"):
    return SimpleNamespace(fuel_type_id=ident, fuel_type=name)


def _fuel_code_obj(ident=42, suffix="100.4", prefix="C-BCLCF"):
    return SimpleNamespace(
        fuel_code_id=ident,
        fuel_suffix=suffix,
        carbon_intensity=23.23,
        fuel_type_id=1,
        fuel_type=_fuel_type_obj(),
        feedstock="Corn",
        feedstock_location="Ontario, CA",
        fuel_code_prefix=SimpleNamespace(prefix=prefix),
    )


def _new_pathway_input(**overrides):
    base = dict(
        application_type_id=1,
        fuel_code_type_id=1,
        operating_data_from=date(2025, 1, 1),
        operating_data_to=date(2025, 12, 31),
        fuel_code_id=None,
        proposed_ci=5.61,
        fuel_type_id=1,
        feedstock="Canola",
        feedstock_region="Saskatchewan",
        feedstock_transport_mode="Truck",
        feedstock_transport_distance=100,
        coproducts=None,
        finished_fuel_transport_mode="Rail",
        finished_fuel_transport_distance=200,
    )
    base.update(overrides)
    return PathwayInputSchema(**base)


def _stub_step2_lookups(repo, *, with_fuel_code=False):
    repo.get_pathway_application_types.return_value = [
        _pathway_app_type(1, "New"),
        _pathway_app_type(2, "Renewal"),
    ]
    repo.get_pathway_fuel_code_types.return_value = [
        _pathway_fc_type(1, "1-year provisional"),
        _pathway_fc_type(2, "3-year"),
    ]
    repo.get_fuel_types.return_value = [_fuel_type_obj(1, "Biodiesel")]
    repo.get_fuel_codes_by_ids.return_value = (
        [_fuel_code_obj()] if with_fuel_code else []
    )


@pytest.mark.anyio
async def test_update_step2_replaces_pathways_and_description(
    service, repo, mock_user
):
    ci = _ci_application()
    ci.pathways = []
    _stub_step2_lookups(repo)
    repo.replace_pathways.return_value = []
    repo.update.side_effect = lambda obj: obj
    repo.get_by_id.return_value = ci

    payload = CIApplicationStep2Schema(
        pathways=[_new_pathway_input()],
        pathway_description="Uses CCS",
    )

    result = await service.update_step2(ci, payload, mock_user)

    repo.replace_pathways.assert_awaited_once()
    args, _ = repo.replace_pathways.await_args
    assert args[0] == ci.ci_application_id
    new_rows = args[1]
    assert len(new_rows) == 1
    assert new_rows[0].application_type_id == 1
    assert new_rows[0].create_user == "ci_applicant_user"
    assert new_rows[0].action_type == ActionTypeEnum.CREATE

    assert ci.pathway_description == "Uses CCS"
    assert ci.action_type == ActionTypeEnum.UPDATE
    assert isinstance(result, CIApplicationSchema)


@pytest.mark.anyio
async def test_update_step2_rejects_renewal_without_fuel_code(
    service, repo, mock_user
):
    ci = _ci_application()
    _stub_step2_lookups(repo)

    payload = CIApplicationStep2Schema(
        pathways=[_new_pathway_input(application_type_id=2, fuel_code_id=None)],
    )

    with pytest.raises(Exception) as exc:
        await service.update_step2(ci, payload, mock_user)
    assert "fuel code iteration" in str(exc.value)
    repo.replace_pathways.assert_not_called()


@pytest.mark.anyio
async def test_update_step2_rejects_new_with_fuel_code(service, repo, mock_user):
    ci = _ci_application()
    _stub_step2_lookups(repo, with_fuel_code=True)

    payload = CIApplicationStep2Schema(
        pathways=[_new_pathway_input(application_type_id=1, fuel_code_id=42)],
    )

    with pytest.raises(Exception) as exc:
        await service.update_step2(ci, payload, mock_user)
    assert "must not reference" in str(exc.value)
    repo.replace_pathways.assert_not_called()


@pytest.mark.anyio
async def test_update_step2_renewal_with_valid_fuel_code(service, repo, mock_user):
    ci = _ci_application()
    ci.pathways = []
    _stub_step2_lookups(repo, with_fuel_code=True)
    repo.replace_pathways.return_value = []
    repo.update.side_effect = lambda obj: obj
    repo.get_by_id.return_value = ci

    payload = CIApplicationStep2Schema(
        pathways=[_new_pathway_input(application_type_id=2, fuel_code_id=42)],
    )

    result = await service.update_step2(ci, payload, mock_user)
    assert isinstance(result, CIApplicationSchema)
    repo.replace_pathways.assert_awaited_once()


@pytest.mark.anyio
async def test_step2_schema_requires_at_least_one_pathway():
    import pydantic
    with pytest.raises(pydantic.ValidationError):
        CIApplicationStep2Schema(pathways=[])


@pytest.mark.anyio
async def test_pathway_input_rejects_inverted_dates():
    import pydantic
    with pytest.raises(pydantic.ValidationError):
        _new_pathway_input(
            operating_data_from=date(2025, 12, 31),
            operating_data_to=date(2025, 1, 1),
        )


# ---------------------------------------------------------------------------
# Step 3 — Documents & GHGenius modelling
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_step3_succeeds_when_required_present(
    service, repo, mock_user
):
    ci = _ci_application()
    repo.get_document_categories.return_value = [
        "technical_report",
        "ghgenius_model",
    ]
    repo.update.side_effect = lambda obj: obj
    repo.get_by_id.return_value = ci

    from lcfs.web.api.ci_application.schema import CIApplicationStep3Schema

    payload = CIApplicationStep3Schema(supporting_document_other="Extra notes")
    result = await service.update_step3(ci, payload, mock_user)

    assert ci.supporting_document_other == "Extra notes"
    assert ci.action_type == ActionTypeEnum.UPDATE
    assert isinstance(result, CIApplicationSchema)


@pytest.mark.anyio
async def test_update_step3_rejects_when_technical_report_missing(
    service, repo, mock_user
):
    ci = _ci_application()
    repo.get_document_categories.return_value = ["ghgenius_model"]
    from lcfs.web.api.ci_application.schema import CIApplicationStep3Schema

    with pytest.raises(Exception) as exc:
        await service.update_step3(
            ci, CIApplicationStep3Schema(), mock_user
        )
    assert "Technical report" in str(exc.value)
    repo.update.assert_not_called()


@pytest.mark.anyio
async def test_update_step3_rejects_when_ghgenius_missing(
    service, repo, mock_user
):
    ci = _ci_application()
    repo.get_document_categories.return_value = ["technical_report"]
    from lcfs.web.api.ci_application.schema import CIApplicationStep3Schema

    with pytest.raises(Exception) as exc:
        await service.update_step3(
            ci, CIApplicationStep3Schema(), mock_user
        )
    assert "GHGenius" in str(exc.value)
    repo.update.assert_not_called()


# ---------------------------------------------------------------------------
# Step 4 — Sign & submit
# ---------------------------------------------------------------------------

from fastapi import HTTPException


def _step4_payload(**overrides):
    from lcfs.web.api.ci_application.schema import CIApplicationStep4Schema
    base = dict(
        declaration_information_true=True,
        declaration_response_8_weeks=True,
        declaration_section_20_6=True,
        consultant_consent=False,
        consultant_name=None,
        consultant_company=None,
        consultant_email=None,
    )
    base.update(overrides)
    return CIApplicationStep4Schema(**base)


def _draft_ci_with_pathways():
    """Draft CI with one pathway present (sentinel; the count check is all that matters)."""
    ci = _ci_application(status=_status("Draft", 1))
    ci.pathways = [True]
    return ci


def _reloaded_ci(ci):
    """
    Mimics the fresh ``get_by_id`` reload after persisting state changes:
    a separate SimpleNamespace mirroring ``ci`` but with pathways
    cleared, so the response serializer doesn't walk the sentinel
    placeholder while leaving the in-test ``ci`` object untouched.
    """
    return SimpleNamespace(**{**ci.__dict__, "pathways": []})


@pytest.mark.anyio
async def test_step4_submit_validates_status_must_be_draft(service, repo, mock_user):
    ci = _ci_application(status=_status("Submitted", 2))
    ci.pathways = [object()]
    with pytest.raises(HTTPException) as exc:
        await service.submit_application(ci, _step4_payload(), mock_user)
    assert exc.value.status_code == 400
    assert "Draft" in exc.value.detail


@pytest.mark.anyio
async def test_step4_submit_requires_at_least_one_pathway(service, repo, mock_user):
    ci = _ci_application(status=_status("Draft", 1))
    ci.pathways = []
    with pytest.raises(HTTPException) as exc:
        await service.submit_application(ci, _step4_payload(), mock_user)
    assert exc.value.status_code == 400
    assert "pathway" in exc.value.detail.lower()


@pytest.mark.anyio
async def test_step4_submit_requires_required_documents(service, repo, mock_user):
    ci = _draft_ci_with_pathways()
    repo.get_document_categories.return_value = []  # nothing uploaded
    with pytest.raises(HTTPException) as exc:
        await service.submit_application(ci, _step4_payload(), mock_user)
    assert exc.value.status_code == 400
    assert "Technical report" in exc.value.detail
    assert "GHGenius" in exc.value.detail


@pytest.mark.anyio
async def test_step4_submit_succeeds_and_transitions_status(service, repo, mock_user):
    ci = _draft_ci_with_pathways()
    repo.get_document_categories.return_value = [
        "technical_report",
        "ghgenius_model",
    ]
    submitted = _status("Submitted", 2)
    repo.get_status_by_name.return_value = submitted
    repo.update.side_effect = lambda obj: obj
    repo.add_history.return_value = MagicMock()
    repo.get_by_id.return_value = _reloaded_ci(ci)

    mock_user.first_name = "Jonathan"
    mock_user.last_name = "Zimmerman"

    result = await service.submit_application(ci, _step4_payload(), mock_user)

    assert ci.status_id == submitted.ci_application_status_id
    assert ci.signature_user == "Jonathan Zimmerman"
    assert ci.signature_date_time is not None
    assert ci.action_type == ActionTypeEnum.UPDATE
    repo.add_history.assert_awaited_once()
    assert isinstance(result, CIApplicationSchema)


@pytest.mark.anyio
async def test_step4_submit_persists_consultant_when_consented(
    service, repo, mock_user
):
    ci = _draft_ci_with_pathways()
    repo.get_document_categories.return_value = [
        "technical_report",
        "ghgenius_model",
    ]
    repo.get_status_by_name.return_value = _status("Submitted", 2)
    repo.update.side_effect = lambda obj: obj
    repo.get_by_id.return_value = _reloaded_ci(ci)

    payload = _step4_payload(
        consultant_consent=True,
        consultant_name="Sam Anderson",
        consultant_company="Anderson Fuel Consultants",
        consultant_email="sam.anderson@afc.ar",
    )

    await service.submit_application(ci, payload, mock_user)

    assert ci.consultant_name == "Sam Anderson"
    assert ci.consultant_company == "Anderson Fuel Consultants"
    assert ci.consultant_email == "sam.anderson@afc.ar"


@pytest.mark.anyio
async def test_step4_submit_clears_consultant_when_not_consented(
    service, repo, mock_user
):
    ci = _draft_ci_with_pathways()
    ci.consultant_name = "stale"
    ci.consultant_company = "stale"
    ci.consultant_email = "stale@example.com"
    repo.get_document_categories.return_value = [
        "technical_report",
        "ghgenius_model",
    ]
    repo.get_status_by_name.return_value = _status("Submitted", 2)
    repo.update.side_effect = lambda obj: obj
    repo.get_by_id.return_value = _reloaded_ci(ci)

    await service.submit_application(ci, _step4_payload(), mock_user)

    assert ci.consultant_name is None
    assert ci.consultant_company is None
    assert ci.consultant_email is None


@pytest.mark.anyio
async def test_step4_schema_requires_all_three_declarations():
    import pydantic
    from lcfs.web.api.ci_application.schema import CIApplicationStep4Schema
    with pytest.raises(pydantic.ValidationError):
        CIApplicationStep4Schema(
            declaration_information_true=True,
            declaration_response_8_weeks=False,
            declaration_section_20_6=True,
        )


@pytest.mark.anyio
async def test_step4_schema_requires_consultant_fields_when_consented():
    import pydantic
    from lcfs.web.api.ci_application.schema import CIApplicationStep4Schema
    with pytest.raises(pydantic.ValidationError):
        CIApplicationStep4Schema(
            declaration_information_true=True,
            declaration_response_8_weeks=True,
            declaration_section_20_6=True,
            consultant_consent=True,
            consultant_name="",
            consultant_company="",
            consultant_email=None,
        )


# ---------------------------------------------------------------------------
# Step 5 — Government decision & comments thread
# ---------------------------------------------------------------------------


def _decision_payload(status_value="Completed", comment=None):
    from lcfs.web.api.ci_application.schema import (
        CIApplicationDecisionSchema,
    )
    return CIApplicationDecisionSchema(status=status_value, comment=comment)


@pytest.mark.anyio
async def test_step5_decision_requires_government(service, repo, mock_user):
    ci = _ci_application(status=_status("Submitted", 2))
    with pytest.raises(HTTPException) as exc:
        await service.record_decision(
            ci, _decision_payload(), mock_user, is_government=False
        )
    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_step5_decision_rejects_when_not_submitted(service, repo, mock_user):
    ci = _ci_application(status=_status("Draft", 1))
    with pytest.raises(HTTPException) as exc:
        await service.record_decision(
            ci, _decision_payload(), mock_user, is_government=True
        )
    assert exc.value.status_code == 400
    assert "Submitted" in exc.value.detail


@pytest.mark.anyio
async def test_step5_decision_transitions_to_completed(service, repo, mock_user):
    ci = _ci_application(status=_status("Submitted", 2))
    completed = _status("Completed", 3)
    repo.get_status_by_name.return_value = completed
    repo.update.side_effect = lambda obj: obj
    repo.add_history.return_value = MagicMock()
    repo.get_by_id.return_value = ci

    result = await service.record_decision(
        ci, _decision_payload("Completed"), mock_user, is_government=True
    )

    assert ci.status_id == completed.ci_application_status_id
    repo.add_history.assert_awaited_once()
    assert isinstance(result, CIApplicationSchema)


@pytest.mark.anyio
async def test_step5_decision_ignores_inline_comment_field(
    service, repo, mock_user
):
    """The inline `comment` field on the decision payload is intentionally
    dropped — comments now live in the shared internal_comments framework.
    """
    ci = _ci_application(status=_status("Submitted", 2))
    repo.get_status_by_name.return_value = _status("Withdrawn", 4)
    repo.update.side_effect = lambda obj: obj
    repo.get_by_id.return_value = ci

    await service.record_decision(
        ci,
        _decision_payload("Withdrawn", comment="See attached email."),
        mock_user,
        is_government=True,
    )

    # No legacy add_comment call should be made by the decision flow.
    assert not hasattr(repo, "add_comment") or not repo.add_comment.await_count


@pytest.mark.anyio
async def test_step5_decision_schema_rejects_non_terminal_status():
    import pydantic
    from lcfs.web.api.ci_application.schema import (
        CIApplicationDecisionSchema,
    )
    with pytest.raises(pydantic.ValidationError):
        CIApplicationDecisionSchema(status="Submitted")
