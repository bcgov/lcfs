"""Schedule importers inspect uploaded workbooks off the event loop."""

from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import UploadFile

from lcfs.services.file_inspection import inspect_upload
from lcfs.web.api.allocation_agreement import importer as allocation_agreement
from lcfs.web.api.charging_equipment import importer as charging_equipment
from lcfs.web.api.charging_site import importer as charging_site
from lcfs.web.api.final_supply_equipment import (
    fse_reporting_importer as fse_reporting,
)
from lcfs.web.api.final_supply_equipment import importer as final_supply_equipment

CONTENTS = b"workbook bytes"


class StopAfterInspection(Exception):
    pass


def _report_repo():
    repo = MagicMock()
    repo.get_compliance_report_by_id = AsyncMock(return_value=MagicMock())
    return repo


IMPORTERS = [
    pytest.param(
        allocation_agreement,
        lambda: allocation_agreement.AllocationAgreementImporter(
            MagicMock(), MagicMock(), MagicMock(), MagicMock(), MagicMock()
        ),
        {"compliance_report_id": 1, "overwrite": False},
        id="allocation_agreement",
    ),
    pytest.param(
        charging_equipment,
        lambda: charging_equipment.ChargingEquipmentImporter(
            MagicMock(), MagicMock(), MagicMock(), MagicMock()
        ),
        {"organization_id": 1, "org_code": "ORG", "overwrite": False},
        id="charging_equipment",
    ),
    pytest.param(
        charging_site,
        lambda: charging_site.ChargingSiteImporter(
            MagicMock(), MagicMock(), MagicMock(), MagicMock()
        ),
        {"organization_id": 1, "org_code": "ORG"},
        id="charging_site",
    ),
    pytest.param(
        final_supply_equipment,
        lambda: final_supply_equipment.FinalSupplyEquipmentImporter(
            MagicMock(), MagicMock(), _report_repo(), MagicMock(), MagicMock()
        ),
        {"compliance_report_id": 1, "org_code": "ORG", "overwrite": False},
        id="final_supply_equipment",
    ),
    pytest.param(
        fse_reporting,
        lambda: fse_reporting.FSEReportingImporter(
            MagicMock(), _report_repo(), MagicMock(), MagicMock()
        ),
        {"compliance_report_id": 1},
        id="fse_reporting",
    ),
]


@pytest.mark.anyio
@pytest.mark.parametrize("module, build, kwargs", IMPORTERS)
async def test_importer_inspects_the_file_in_a_worker_thread(module, build, kwargs):
    run_in_threadpool = AsyncMock(side_effect=StopAfterInspection)
    upload = UploadFile(filename="schedule.xlsx", file=BytesIO(CONTENTS))

    with patch.object(module, "_update_progress", AsyncMock()), patch.object(
        module, "run_in_threadpool", run_in_threadpool
    ):
        # The service decorator wraps the error, so look for it in the chain
        with pytest.raises(Exception) as exc_info:
            await build().import_data(user=MagicMock(), file=upload, **kwargs)

    assert isinstance(exc_info.value, StopAfterInspection) or isinstance(
        exc_info.value.__cause__, StopAfterInspection
    )

    run_in_threadpool.assert_awaited_once()
    function, contents, file_name, *_ = run_in_threadpool.await_args.args
    assert function is inspect_upload
    assert contents == CONTENTS
    assert file_name == "schedule.xlsx"
