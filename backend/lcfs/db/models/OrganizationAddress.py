"""
    REST API Documentation for the NRS LCFS Credit Trading Application

    The Transportation Fuels Reporting System is being designed to streamline
    compliance reporting for transportation fuel suppliers in accordance with
    the Renewable & Low Carbon Fuel Requirements Regulation.

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

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class OrganizationAddress(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'organization_address'
    __table_args__ = {'comment': "Represents an organization's address."}

    organization_address_id = Column(Integer, primary_key=True)
    name = Column(String(500), nullable=True, comment='Organization name')
    street_address = Column(String(500), nullable=True)
    address_other = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    province_state = Column(String(50), nullable=True)
    country = Column(String(100), nullable=True)
    postalCode_zipCode = Column(String(10), nullable=True)
    
    organization = relationship('Organization', back_populates='organization_address')
