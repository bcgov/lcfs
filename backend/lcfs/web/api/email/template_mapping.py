from lcfs.db.models.notification.NotificationType import NotificationTypeEnum


TEMPLATE_MAPPING = {
    NotificationTypeEnum.TRANSFER_DIRECTOR_REVIEW: "transfer_director_review.html",
    NotificationTypeEnum.INITIATIVE_APPROVED: "initiative_approved.html",
    NotificationTypeEnum.INITIATIVE_DA_REQUEST: "initiative_da_request.html",
    NotificationTypeEnum.SUPPLEMENTAL_REQUESTED: "supplemental_requested.html",
    NotificationTypeEnum.DIRECTOR_ASSESSMENT: "director_assessment.html",
    NotificationTypeEnum.TRANSFER_PARTNER_UPDATE: "transfer_partner_update.html",
    "default": "default.html"
}
