#!/usr/bin/env python3
"""Simple script to test organization update outside of pytest framework"""
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.organizations.schema import OrganizationUpdateSchema
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.settings import settings

async def test_organization_update():
    """Test organization update functionality"""
    try:
        # Create database session manually
        engine = create_async_engine(str(settings.db_url))
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        
        async with session_factory() as db_session:
            # Create a mock user
            mock_user = UserProfile(
                user_profile_id=1,
                keycloak_username="test_user",
                organization_id=1
            )
            
            # Create organization service
            service = OrganizationsService()
            service.db = db_session
            
            # Test data similar to the test
            update_data = OrganizationUpdateSchema(
                name="Test Organization",
                operating_name="Test Operating name",
                email="organization@gov.bc.ca",
                phone="1111111111",
                edrms_record="EDRMS123",
                organization_status_id=2,
                organization_type_id=1,
                has_early_issuance=False,
            )
            
            # Try to update organization
            result = await service.update_organization(1, update_data, mock_user)
            print(f"Update successful: {result.organization_id}")
        
        await engine.dispose()
        
    except Exception as e:
        print(f"Error during update: {e}")
        print(f"Error type: {type(e)}")
        # Print more details about the error
        if hasattr(e, '__cause__') and e.__cause__:
            print(f"Underlying error: {e.__cause__}")
        if hasattr(e, 'args') and e.args:
            print(f"Error args: {e.args}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_organization_update())