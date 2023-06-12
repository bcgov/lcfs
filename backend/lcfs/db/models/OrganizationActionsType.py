"""
    REST API Documentation for the NRS TFRS Credit Trading Application

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

from sqlalchemy import Column, Integer, String, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, DisplayOrder, EffectiveDates



class OrganizationActionsType(BaseModel, DisplayOrder, EffectiveDates):
    __tablename__ = 'organization_actions_type'
    __table_args__ = (
        UniqueConstraint('the_type'),
    )
    id = Column(Integer, primary_key=True)
    the_type = Column(String(25), nullable=False, comment="Enumerated value to describe the organization actions type.")
    description = Column(String(1000), nullable=True, comment="Description of the organization actions type. This is the displayed name.")

    organizations = relationship("Organization", back_populates="actions_type")

    def __repr__(self):
        return self.the_type
