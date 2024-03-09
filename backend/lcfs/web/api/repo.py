from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.db.base import Auditable

class BaseRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def commit_to_db(self):
        user = self.db.info.get('user')
        username = user['keycloak_username'] if user and 'keycloak_username' in user else 'no_user'
        
        for instance in self.db.new | self.db.dirty:
            if isinstance(instance, Auditable):
                # Set create_user if it's not already set (for new records)
                if instance in self.db.new and not instance.create_user:
                    instance.create_user = username
                # Always set update_user
                instance.update_user = username

        await self.db.commit()

    async def rollback(self):
        await self.db.rollback()