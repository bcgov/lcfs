"""
    REST API Documentation for the NRS TFRS Credit Trading Application

    The Transportation Fuels Reporting System is being designed to streamline compliance reporting for transportation fuel suppliers in accordance with the Renewable & Low Carbon Fuel Requirements Regulation.

    OpenAPI spec version: v1


    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
"""

from sqlalchemy import Column, String, Integer, Sequence
from sqlalchemy.orm import relationship
from lcfs.db.base import Auditable, EffectiveDates, BaseModel, DisplayOrder


class OrganizationType(BaseModel, Auditable, EffectiveDates, DisplayOrder):
    __tablename__ = 'organization_type'

    id = Column(Integer, Sequence('organization_type_id_seq'), primary_key=True)
    type = Column(String(25), unique=True, comment='Enumerated value to describe the organization type.')
    description = Column(String(1000), nullable=True, comment='Description of the organization type. This is the displayed name.')

    organizations = relationship("Organization", back_populates="type")

    # In SQLAlchemy, __str__() method is usually replaced with __repr__()
    def __repr__(self):
        return self.type
