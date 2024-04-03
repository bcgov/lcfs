from datetime import datetime

from lcfs.web.api.internal_comment.schema import AudienceScopeEnum, EntityTypeEnum, InternalCommentCreateSchema, InternalCommentUpdateSchema

from lcfs.db.models.UserProfile import UserProfile
from lcfs.db.models.InternalComment import InternalComment
from lcfs.db.models.Transaction import Transaction, TransactionActionEnum
from lcfs.db.models.Transfer import Transfer
from lcfs.db.models.TransferInternalComment import TransferInternalComment
from lcfs.db.models.InitiativeAgreementStatus import InitiativeAgreementStatus, InitiativeAgreementStatusEnum
from lcfs.db.models.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.InitiativeAgreementInternalComment import InitiativeAgreementInternalComment

# User ORM Model
user_orm_model = UserProfile(
    keycloak_user_id="unique-keycloak-user-id",
    keycloak_email="user@example.com",
    keycloak_username="username",
    email="user@example.com",
    title="Software Developer",
    phone="1234567890",
    mobile_phone="0987654321",
    first_name="John",
    last_name="Doe",
    is_active=True,
    organization_id=1
)

# InternalComment ORM Model
internal_comment_orm_model = InternalComment(
    comment="Comment",
    audience_scope=AudienceScopeEnum.DIRECTOR,
    create_user="username",
)

# Transaction ORM Model
transaction_orm_model = Transaction(
    compliance_units=1000,
    organization_id=1,
    transaction_action=TransactionActionEnum.Adjustment
)

# Transfer ORM Model
transfer_orm_model = Transfer(
    from_organization_id=1,
    to_organization_id=2,
    transfer_id=1000,
    agreement_date=datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
    transaction_effective_date=datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
    price_per_unit=100,
    quantity=500,
    transfer_category_id=1,
    current_status_id=1
)

# TransferInternalComment ORM Model
transfer_internal_comment_orm_model = TransferInternalComment(
    transfer_id=1000,
    internal_comment_id=1000
)

# InitiativeAgreementStatus ORM Model
initiative_agreement_status_orm_model = InitiativeAgreementStatus(
    status=InitiativeAgreementStatusEnum.Approved
)

# InitiativeAgreement ORM Model
initiative_agreement_orm_model = InitiativeAgreement(
    compliance_units=1000,
    transaction_effective_date=datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
    to_organization_id=2,
    transaction_id=1000,
    current_status_id=1000
)

# InitiativeAgreementInternalComment ORM Model
initiative_agreement_internal_comment_orm_model = InitiativeAgreementInternalComment(
    initiative_agreement_id=1000,
    internal_comment_id=1000
)

# InternalComment ORM Fields
internal_comment_orm_fields = {
    "internal_comment_id": 1000,
    "comment": "Comment",
    "audience_scope": AudienceScopeEnum.ANALYST
}

# TransferInternalComment ORM Fields
transfer_internal_comment_orm_fields = {
    "transfer_id": 1000,
    'internal_comment_id': 1000
}

# InitiativeAgreementInternalComment ORM Fields
initiative_agreement_internal_comment_orm_fields = {
    "initiative_agreement_id": 1000,
    'internal_comment_id': 1000
}

# create payload
intenal_comment_create_payload = InternalCommentCreateSchema(
    entity_type=EntityTypeEnum.TRANSFER,
    entity_id=1,
    comment="Comment",
    audience_scope=AudienceScopeEnum.DIRECTOR
)
