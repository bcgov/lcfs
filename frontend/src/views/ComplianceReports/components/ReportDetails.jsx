import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  CircularProgress,
  IconButton,
  Link
} from '@mui/material'
import BCTypography from '@/components/BCTypography'

import { NotionalTransferSummary } from '@/views/NotionalTransfers/NotionalTransferSummary'
import { ROUTES, buildPath } from '@/routes/routes'
import { roles } from '@/constants/roles'
import { Role } from '@/components/Role'
import { OtherUsesSummary } from '@/views/OtherUses/OtherUsesSummary'
import { useGetFinalSupplyEquipments } from '@/hooks/useFinalSupplyEquipment'
import { FinalSupplyEquipmentSummary } from '@/views/FinalSupplyEquipments/FinalSupplyEquipmentSummary'
import { useGetAllNotionalTransfers } from '@/hooks/useNotionalTransfer'
import { useGetAllOtherUses } from '@/hooks/useOtherUses'
import { useGetFuelSupplies } from '@/hooks/useFuelSupply'
import { FuelSupplySummary } from '@/views/FuelSupplies/FuelSupplySummary'
import { useGetAllAllocationAgreements } from '@/hooks/useAllocationAgreement'
import { AllocationAgreementSummary } from '@/views/AllocationAgreements/AllocationAgreementSummary'
import { useGetFuelExports } from '@/hooks/useFuelExport'
import { FuelExportSummary } from '@/views/FuelExports/FuelExportSummary'
import { SupportingDocumentSummary } from '@/views/SupportingDocuments/SupportingDocumentSummary'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import {
  useComplianceReportDocuments,
  useGetComplianceReport
} from '@/hooks/useComplianceReports'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { isArrayEmpty } from '@/utils/array.js'
import { TogglePanel } from '@/components/TogglePanel.jsx'
import { FuelSupplyChangelog } from '@/views/FuelSupplies/FuelSupplyChangelog.jsx'
import { AllocationAgreementChangelog } from '@/views/AllocationAgreements/AllocationAgreementChangelog.jsx'
import { NotionalTransferChangelog } from '@/views/NotionalTransfers/NotionalTransferChangelog.jsx'
import { OtherUsesChangelog } from '@/views/OtherUses/OtherUsesChangelog.jsx'
import { FuelExportChangelog } from '@/views/FuelExports/FuelExportChangelog.jsx'
import { Edit, ExpandMore } from '@mui/icons-material'
import { REPORT_SCHEDULES } from '@/constants/common.js'

const ReportDetails = ({ canEdit, currentStatus = 'Draft', userRoles }) => {
  const { t } = useTranslation()
  const { compliancePeriod, complianceReportId } = useParams()
  const navigate = useNavigate()
  const { data: currentUser, hasRoles } = useCurrentUser()

  const { data: complianceReportData } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId
  )

  const [isFileDialogOpen, setFileDialogOpen] = useState(false)
  const hasAnalystRole = hasRoles('Analyst')
  const hasSupplierRole = hasRoles('Supplier')
  const isSupplemental = complianceReportData.report.version > 0
  const hasVersions = complianceReportData.chain.length > 1
  const isEarlyIssuance =
    complianceReportData.report?.reportingFrequency ===
    REPORT_SCHEDULES.QUARTERLY

  const editSupportingDocs = useMemo(() => {
    return (
      // Allow BCeID users to edit in Draft status
      (hasSupplierRole && currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT) ||
      // Allow analysts to edit in Submitted or Assessed status
      (hasAnalystRole &&
        (currentStatus === COMPLIANCE_REPORT_STATUSES.SUBMITTED ||
          currentStatus === COMPLIANCE_REPORT_STATUSES.ASSESSED))
    )
  }, [hasAnalystRole, hasSupplierRole, currentStatus])
  const shouldShowEditIcon = (activityName) => {
    if (activityName === t('report:supportingDocs')) {
      return editSupportingDocs
    }
    return canEdit
  }

  const activityList = useMemo(
    () => [
      {
        name: t('report:supportingDocs'),
        action: (e) => {
          e.stopPropagation()
          setFileDialogOpen(true)
        },
        useFetch: useComplianceReportDocuments,
        component: (data) => (
          <>
            <SupportingDocumentSummary
              parentType="compliance_report"
              parentID={complianceReportId}
              data={data}
            />
            <DocumentUploadDialog
              parentID={complianceReportId}
              parentType="compliance_report"
              open={isFileDialogOpen}
              close={() => {
                setFileDialogOpen(false)
              }}
            />
          </>
        ),
        condition: true
      },
      {
        name: t('report:activityLists.supplyOfFuel'),
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.SUPPLY_OF_FUEL, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetFuelSupplies,
        component: (data) =>
          data.fuelSupplies.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={!(hasVersions || isSupplemental)}
              onComponent={<FuelSupplyChangelog canEdit={canEdit} />}
              offComponent={
                <FuelSupplySummary
                  status={currentStatus}
                  data={data}
                  isEarlyIssuance={isEarlyIssuance}
                />
              }
            />
          )
      },
      {
        name: t('finalSupplyEquipment:fseTitle'),
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.FINAL_SUPPLY_EQUIPMENTS, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetFinalSupplyEquipments,
        component: (data) =>
          data.finalSupplyEquipments.length > 0 && (
            <FinalSupplyEquipmentSummary status={currentStatus} data={data} />
          )
      },
      {
        name: t('report:activityLists.allocationAgreements'),
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.ALLOCATION_AGREEMENTS, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetAllAllocationAgreements,
        component: (data) =>
          data.allocationAgreements.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={!(hasVersions || isSupplemental)}
              onComponent={<AllocationAgreementChangelog canEdit={canEdit} />}
              offComponent={
                <AllocationAgreementSummary
                  status={currentStatus}
                  data={data}
                />
              }
            />
          )
      },
      {
        name: t('report:activityLists.notionalTransfers'),
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.NOTIONAL_TRANSFERS, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetAllNotionalTransfers,
        component: (data) =>
          data.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={!(hasVersions || isSupplemental)}
              onComponent={<NotionalTransferChangelog canEdit={canEdit} />}
              offComponent={
                <NotionalTransferSummary status={currentStatus} data={data} />
              }
            />
          )
      },
      {
        name: t('otherUses:summaryTitle'),
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.OTHER_USE_FUELS, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetAllOtherUses,
        component: (data) =>
          data.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={!(hasVersions || isSupplemental)}
              onComponent={<OtherUsesChangelog canEdit={canEdit} />}
              offComponent={
                <OtherUsesSummary status={currentStatus} data={data} />
              }
            />
          )
      },
      {
        name: t('fuelExport:fuelExportTitle'),
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.FUEL_EXPORTS, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetFuelExports,
        component: (data) =>
          !isArrayEmpty(data) && (
            <TogglePanel
              label="Change log"
              disabled={!(hasVersions || isSupplemental)}
              onComponent={<FuelExportChangelog canEdit={canEdit} />}
              offComponent={
                <FuelExportSummary status={currentStatus} data={data} />
              }
            />
          )
      }
    ],
    [
      t,
      compliancePeriod,
      complianceReportId,
      isFileDialogOpen,
      navigate,
      currentStatus,
      isArrayEmpty
    ]
  )

  const [expanded, setExpanded] = useState(
    activityList
      .map((activity, index) => {
        if (activity.name === t('report:supportingDocs')) {
          return isArrayEmpty(activity.useFetch(complianceReportId).data)
            ? ''
            : `panel${index}`
        }
        return `panel${index}`
      })
      .filter(Boolean)
  )

  const onExpand = (panel) => (event, isExpanded) => {
    setExpanded((prev) =>
      isExpanded ? [...prev, panel] : prev.filter((p) => p !== panel)
    )
  }

  const onExpandAll = () => {
    setExpanded(activityList.map((_, index) => `panel${index}`))
  }

  const onCollapseAll = () => {
    setExpanded([])
  }

  return (
    <>
      <BCTypography color="primary" variant="h5" mb={2} component="div">
        {t('report:reportDetails')}
        <Link
          component="button"
          variant="body2"
          onClick={onExpandAll}
          sx={{ ml: 2, mr: 1, textDecoration: 'underline' }}
        >
          {t('report:expandAll')}
        </Link>
        |
        <Link
          component="button"
          variant="body2"
          onClick={onCollapseAll}
          sx={{ ml: 1, textDecoration: 'underline' }}
        >
          {t('report:collapseAll')}
        </Link>
      </BCTypography>
      {activityList.map((activity, index) => {
        const { data, error, isLoading } = activity.useFetch(complianceReportId, {
                  changelog: isSupplemental})
        return (
          (data &&
            !isArrayEmpty(data) || hasVersions) && (
            <Accordion
              key={index}
              expanded={expanded.includes(`panel${index}`)}
              onChange={onExpand(`panel${index}`)}
            >
              <AccordionSummary
                expandIcon={
                  <ExpandMore sx={{ width: '2rem', height: '2rem' }} />
                }
                aria-controls={`panel${index}-content`}
                id={`panel${index}-header`}
                data-test={`panel${index}-summary`}
              >
                <BCTypography
                  style={{ display: 'flex', alignItems: 'center' }}
                  variant="h6"
                  color="primary"
                  component="div"
                >
                  {activity.name}&nbsp;&nbsp;
                  {shouldShowEditIcon(activity.name) && (
                    <Role
                      roles={[
                        roles.signing_authority,
                        roles.compliance_reporting,
                        roles.analyst
                      ]}
                    >
                      <IconButton
                        color="primary"
                        aria-label="edit"
                        onClick={activity.action}
                      >
                        <Edit />
                      </IconButton>
                    </Role>
                  )}
                </BCTypography>
              </AccordionSummary>
              <AccordionDetails>
                {isLoading ? (
                  <CircularProgress />
                ) : error ? (
                  <BCTypography color="error">Error loading data</BCTypography>
                ) : activity.component ? (
                  activity.component(data)
                ) : (
                  <BCTypography>{JSON.stringify(data)}</BCTypography>
                )}
              </AccordionDetails>
            </Accordion>
          )
        )
      })}
      <DocumentUploadDialog
        parentID={complianceReportId}
        parentType="compliance_report"
        open={isFileDialogOpen}
        close={() => {
          setFileDialogOpen(false)
        }}
      />
    </>
  )
}

export default ReportDetails