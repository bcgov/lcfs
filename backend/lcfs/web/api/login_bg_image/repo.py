from typing import List, Optional
from fastapi import Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.login_bg_image.LoginBgImage import LoginBgImage
from lcfs.web.core.decorators import repo_handler


class LoginBgImageRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_all(self) -> List[LoginBgImage]:
        result = await self.db.execute(
            select(LoginBgImage).order_by(LoginBgImage.create_date.desc())
        )
        return result.scalars().all()

    @repo_handler
    async def get_by_id(self, image_id: int) -> Optional[LoginBgImage]:
        result = await self.db.execute(
            select(LoginBgImage).where(
                LoginBgImage.login_bg_image_id == image_id
            )
        )
        return result.scalar_one_or_none()

    @repo_handler
    async def get_active(self) -> Optional[LoginBgImage]:
        result = await self.db.execute(
            select(LoginBgImage).where(LoginBgImage.is_active.is_(True)).limit(1)
        )
        return result.scalar_one_or_none()

    @repo_handler
    async def create(self, image: LoginBgImage) -> LoginBgImage:
        self.db.add(image)
        await self.db.flush()
        await self.db.refresh(image)
        return image

    @repo_handler
    async def update(self, image: LoginBgImage) -> LoginBgImage:
        await self.db.flush()
        await self.db.refresh(image)
        return image

    @repo_handler
    async def delete(self, image: LoginBgImage) -> None:
        await self.db.delete(image)
        await self.db.flush()

    @repo_handler
    async def deactivate_all(self) -> None:
        await self.db.execute(
            update(LoginBgImage).values(is_active=False)
        )
