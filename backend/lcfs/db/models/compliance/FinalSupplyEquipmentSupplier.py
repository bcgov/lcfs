from sqlalchemy import Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from lcfs.db.dependencies import get_async_db_session

Base = declarative_base()


class FinalSupplyEquipmentSupplier(Base):
    __tablename__ = "fianl_supply_equipment_supplier"

    supplier_id = Column(Integer, primary_key=True)
    postal_code = Column(String, nullable=False)
    registration_number = Column(String, nullable=False, unique=True)

    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
        supplier_id: int = None,
        postal_code: str = None,
    ):
        self.db = db
        self.supplier_id = supplier_id
        self.postal_code = postal_code
        self.registration_number = self.generate_registration_number()

    @staticmethod
    async def generate_registration_number(self, supplier_id, postal_code):
        # Force supplier_id to 5 digits
        supplier_id_str = f"{supplier_id:05}"

        # Get the last 3 characters of the postal code
        postal_code_suffix = postal_code[-3:]

        # Get the max sequential number for the given postal code
        result = await self.db.execute(
            select([FinalSupplyEquipmentSupplier])
            .where(
                FinalSupplyEquipmentSupplier.postal_code.endswith(postal_code_suffix)
            )
            .order_by(FinalSupplyEquipmentSupplier.registration_number.desc())
        )
        exists = result.scalars().first() is not None

        if exists is None:
            sequential_number = "001"
        else:
            last_reg_number = exists[0].registration_number
            last_sequential_number = int(last_reg_number[-3:])
            sequential_number = f"{(last_sequential_number + 1):03}"

        # Construct the registration number
        registration_number = (
            f"{supplier_id_str}{postal_code_suffix}{sequential_number}"
        )
        return registration_number
