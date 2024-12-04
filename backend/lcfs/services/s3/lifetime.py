from fastapi import FastAPI
from aioboto3 import Session
from lcfs.settings import settings


async def init_s3(app: FastAPI) -> None:
    """
    Initialize the S3 client and store it in the app state.

    :param app: FastAPI application.
    """
    session = Session()
    app.state.s3_client = session.client(
        "s3",
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        endpoint_url=settings.s3_endpoint,
        region_name="us-east-1",
    )
    print("Async S3 client initialized.")


async def shutdown_s3(app: FastAPI) -> None:
    """
    Cleanup the S3 client from the app state.

    :param app: FastAPI application.
    """
    if hasattr(app.state, "s3_client") and app.state.s3_client:
        await app.state.s3_client.close()
        print("Async S3 client shutdown.")
