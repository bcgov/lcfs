import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Link,
  CircularProgress,
  IconButton
} from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { faPen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { NotionalTransferSummary } from '@/views/NotionalTransfers/NotionalTransferSummary'
import { ROUTES } from '@/constants/routes'
import { roles } from '@/constants/roles'
import { Role } from '@/components/Role'
import { OtherUsesSummary } from '@/views/OtherUses/OtherUsesSummary'
import { useGetFinalSupplyEquipments } from '@/hooks/useFinalSupplyEquipment'
import { FinalSupplyEquipmentSummary } from '@/views/FinalSupplyEquipments/FinalSupplyEquipmentSummary'
import { useGetAllNotionalTransfers } from '@/hooks/useNotionalTransfer'
import { useGetAllOtherUses } from '@/hooks/useOtherUses'
import { useGetFuelSupplies } from '@/hooks/useFuelSupply'
import { FuelSupplySummary } from '@/views/FuelSupplies/FuelSupplySummary'
import { useGetAllocationAgreements } from '@/hooks/useAllocationAgreement'
import { AllocationAgreementSummary } from '@/views/AllocationAgreements/AllocationAgreementSummary'
import { useGetFuelExports } from '@/hooks/useFuelExport'
import { FuelExportSummary } from '@/views/FuelExports/FuelExportSummary'
import { SupportingDocumentSummary } from '@/views/SupportingDocuments/SupportingDocumentSummary'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import { useComplianceReportDocuments } from '@/hooks/useComplianceReports'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

const ReportDetails = ({ currentStatus = 'Draft', userRoles }) => {
  const { t } = useTranslation()
  const { compliancePeriod, complianceReportId } = useParams()
  const navigate = useNavigate()

  const [isFileDialogOpen, setFileDialogOpen] = useState(false)
  const isAnalystRole =
    userRoles.some((role) => role.name === roles.analyst) || false
  const isSupplierRole =
    userRoles.some((role) => role.name === roles.supplier) || false

    const editSupportingDocs = useMemo(() => {
      return (
        // Allow BCeID users to edit in Draft status
        (isSupplierRole && currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT) ||
        // Allow analysts to edit in Submitted or Assessed status
        (isAnalystRole &&
          (currentStatus === COMPLIANCE_REPORT_STATUSES.SUBMITTED ||
           currentStatus === COMPLIANCE_REPORT_STATUSES.ASSESSED))
      )
    }, [isAnalystRole, isSupplierRole, currentStatus])

  const editAnalyst = useMemo(() => {
    return (
      isAnalystRole && currentStatus === COMPLIANCE_REPORT_STATUSES.REASSESSED
    )
  }, [isAnalystRole, currentStatus])

  const editSupplier = useMemo(() => {
    return isSupplierRole && currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT
  }, [isSupplierRole, currentStatus])

  const shouldShowEditIcon = (activityName) => {
    if (activityName === t('report:supportingDocs')) {
      return editSupportingDocs
    }
    return editAnalyst || editSupplier
  }

  const isArrayEmpty = useCallback((data) => {
    if (Array.isArray(data)) {
      return data.length === 0
    }
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data)
      const arrayKey = keys.find((key) => key !== 'pagination')
      if (arrayKey && Array.isArray(data[arrayKey])) {
        return data[arrayKey].length === 0
      }
    }
    return null
  }, [])

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
              data={data}
              reportID={complianceReportId}
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
            ROUTES.REPORTS_ADD_SUPPLY_OF_FUEL.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetFuelSupplies,
        component: (data) =>
          data.fuelSupplies.length > 0 && (
            <FuelSupplySummary status={currentStatus} data={data} />
          )
      },
      {
        name: t('finalSupplyEquipment:fseTitle'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_FINAL_SUPPLY_EQUIPMENTS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
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
            ROUTES.REPORTS_ADD_ALLOCATION_AGREEMENTS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetAllocationAgreements,
        component: (data) =>
          data.allocationAgreements.length > 0 && (
            <AllocationAgreementSummary status={currentStatus} data={data} />
          )
      },
      {
        name: t('report:activityLists.notionalTransfers'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_NOTIONAL_TRANSFERS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetAllNotionalTransfers,
        component: (data) =>
          data.length > 0 && (
            <NotionalTransferSummary status={currentStatus} data={data} />
          )
      },
      {
        name: t('otherUses:summaryTitle'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_OTHER_USE_FUELS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetAllOtherUses,
        component: (data) =>
          data.length > 0 && (
            <OtherUsesSummary status={currentStatus} data={data} />
          )
      },
      {
        name: t('fuelExport:fuelExportTitle'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_FUEL_EXPORTS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetFuelExports,
        component: (data) =>
          !isArrayEmpty(data) && (
            <FuelExportSummary status={currentStatus} data={data} />
          )
      }
    ],
    [
      currentStatus,
      t,
      navigate,
      compliancePeriod,
      complianceReportId,
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
        const { data, error, isLoading } = activity.useFetch(complianceReportId)
        return (
          ((data && !isArrayEmpty(data)) && (
            <Accordion
              key={index}
              expanded={expanded.includes(`panel${index}`)}
              onChange={onExpand(`panel${index}`)}
            >
              <AccordionSummary
                expandIcon={
                  <ExpandMoreIcon sx={{ width: '2rem', height: '2rem' }} />
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
                    <>
                      <Role
                        roles={[
                          roles.supplier,
                          roles.compliance_reporting,
                          roles.analyst
                        ]}
                      >
                        <IconButton
                          color="primary"
                          size="small"
                          aria-label="edit"
                          onClick={activity.action}
                        >
                          <FontAwesomeIcon
                            className="small-icon"
                            icon={faPen}
                          />
                        </IconButton>
                      </Role>
                    </>
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
