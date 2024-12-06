from lcfs.db.models.user.UserProfile import UserProfile

# User ORM Model
user_orm_model = UserProfile(
    keycloak_user_id="user_id",
    keycloak_email="email@domain.com",
    keycloak_username="username",
    email="email@domain.com",
    notifications_email=None,
    title="Developer",
    phone="1234567890",
    mobile_phone="0987654321",
    first_name="John",
    last_name="Smith",
    is_active=True,
    organization_id=1,
)
