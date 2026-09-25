from lcfs.web.api.search.entities.admin_adjustments import ENTITY as ADMIN_ADJUSTMENTS
from lcfs.web.api.search.entities.ci_applications import ENTITY as CI_APPLICATIONS
from lcfs.web.api.search.entities.compliance_reports import ENTITY as COMPLIANCE_REPORTS
from lcfs.web.api.search.entities.fuel_codes import ENTITY as FUEL_CODES
from lcfs.web.api.search.entities.initiative_agreements import (
    ENTITY as INITIATIVE_AGREEMENTS,
)
from lcfs.web.api.search.entities.organizations import ENTITY as ORGANIZATIONS
from lcfs.web.api.search.entities.transfers import ENTITY as TRANSFERS
from lcfs.web.api.search.entities.users import ENTITY as USERS

SEARCH_ENTITIES = (
    ORGANIZATIONS,
    COMPLIANCE_REPORTS,
    TRANSFERS,
    FUEL_CODES,
    CI_APPLICATIONS,
    INITIATIVE_AGREEMENTS,
    ADMIN_ADJUSTMENTS,
    USERS,
)

__all__ = ["SEARCH_ENTITIES"]
