from sqlalchemy import Boolean, Column, Integer, String
from lcfs.db.base import BaseModel, Auditable


class LoginBgImage(BaseModel, Auditable):
    __tablename__ = "login_bg_image"
    __table_args__ = {
        "comment": "Stores background images for the login screen, managed by administrators"
    }

    login_bg_image_id = Column(Integer, primary_key=True, autoincrement=True)
    image_key = Column(
        String,
        nullable=False,
        comment="S3 object key for the stored image file",
    )
    file_name = Column(
        String(255),
        nullable=False,
        comment="Original filename of the uploaded image",
    )
    display_name = Column(
        String(200),
        nullable=False,
        comment="Photographer or author name displayed as image credit",
    )
    caption = Column(
        String(500),
        nullable=True,
        comment="Location or additional attribution text",
    )
    is_active = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether this image is the current active login screen background",
    )
