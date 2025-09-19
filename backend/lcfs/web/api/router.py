from fastapi.routing import APIRouter

from lcfs.web.api import (
    calculator,
    echo,
    fuel_supply,
    monitoring,
    user,
    role,
    notification,
    organization,
    organizations,
    transfer,
    transaction,
    internal_comment,
    fuel_code,
    fuel_export,
    admin_adjustment,
    initiative_agreement,
    compliance_report,
    notional_transfer,
    other_uses,
    final_supply_equipment,
    dashboard,
    allocation_agreement,
    document,
    fuel_type,
    audit_log,
    email,
    organization_snapshot,
    credit_ledger,
    forms,
    geocoder,
    chat,
)

api_router = APIRouter()
api_router.include_router(monitoring.router)
api_router.include_router(calculator.router, prefix="/calculator", tags=["public"])
api_router.include_router(
    allocation_agreement.router,
    prefix="/allocation-agreement",
    tags=["allocation-agreements"],
)
api_router.include_router(
    transaction.router, prefix="/transactions", tags=["transactions"]
)
api_router.include_router(transfer.router, prefix="/transfers", tags=["transfers"])
api_router.include_router(echo.router, prefix="/echo", tags=["echo"])
api_router.include_router(user.router, prefix="/users", tags=["users"])
api_router.include_router(role.router, prefix="/roles", tags=["roles"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(
    notification.router, prefix="/notifications", tags=["notifications"]
)
api_router.include_router(
    organizations.router, prefix="/organizations", tags=["organizations"]
)
api_router.include_router(
    organization.router, prefix="/organization", tags=["organization"]
)
api_router.include_router(
    internal_comment.router, prefix="/internal_comments", tags=["internal_comments"]
)
api_router.include_router(fuel_code.router, prefix="/fuel-codes", tags=["fuel-codes"])
api_router.include_router(
    fuel_export.router, prefix="/fuel-exports", tags=["fuel-exports"]
)
api_router.include_router(
    admin_adjustment.router, prefix="/admin-adjustments", tags=["admin_adjustments"]
)
api_router.include_router(
    initiative_agreement.router,
    prefix="/initiative-agreements",
    tags=["initiative_agreements"],
)
api_router.include_router(
    compliance_report.router, prefix="/reports", tags=["compliance_reports"]
)
api_router.include_router(
    notional_transfer.router, prefix="/notional-transfers", tags=["notional_transfers"]
)
api_router.include_router(other_uses.router, prefix="/other-uses", tags=["other_uses"])
api_router.include_router(
    final_supply_equipment.router,
    prefix="/final-supply-equipments",
    tags=["final_supply_equipments"],
)
api_router.include_router(
    fuel_supply.router, prefix="/fuel-supply", tags=["fuel_supplies"]
)
api_router.include_router(document.router, prefix="/documents", tags=["documents"])
api_router.include_router(fuel_type.router, prefix="/fuel-type", tags=["fuel_type"])
api_router.include_router(audit_log.router, prefix="/audit-log", tags=["audit_log"])
api_router.include_router(email.router, prefix="/email", tags=["emails"])
api_router.include_router(
    organization_snapshot.router,
    prefix="/organization_snapshot",
    tags=["organization_snapshot"],
)
api_router.include_router(
    credit_ledger.router,
    prefix="/credit-ledger",
    tags=["credit_ledger"],
)
api_router.include_router(forms.router, prefix="/forms", tags=["forms"])
api_router.include_router(geocoder.router, prefix="/geocoder", tags=["geocoder"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
