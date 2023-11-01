from sqlalchemy import Column, String, Boolean
from lcfs.db.base import BaseModel

class UserLoginHistory(BaseModel):
    __tablename__ = 'user_login_history'
    __table_args__ = {'comment': 'Keeps track of all user login attempts'}

    keycloak_email = Column(String, nullable=False, comment="Keycloak email address to associate on first login.")
    external_username = Column(String(150), nullable=True, comment="BCeID or IDIR username")
    keycloak_user_id = Column(String(150), nullable=True, comment="This is the unique id returned from Keycloak and is the main mapping key between the LCFS user and the Keycloak user. The identity provider type will be appended as a suffix after an @ symbol. For ex. asdf1234@bceidbasic or asdf1234@idir")
    is_login_successful = Column(Boolean, default=False, comment="True if this login attempt was successful, false on failure.")
    login_error_message = Column(String(500), nullable=True, comment='Error text on unsuccessful login attempt.')
