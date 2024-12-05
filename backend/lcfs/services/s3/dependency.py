import boto3
from typing import Generator
from lcfs.settings import settings


def get_s3_client() -> Generator:
    """
    Dependency function to provide a synchronous S3 client using boto3.

    This function creates a new S3 client session for each request that requires it.
    The client is properly configured with the necessary AWS credentials and
    endpoint settings.

    Usage:
        >>> def some_endpoint(s3_client = Depends(get_s3_client)):
        >>>     # Use the s3_client here
    """
    # Initialize the S3 client with the required configurations
    client = boto3.client(
        "s3",
        aws_access_key_id=settings.s3_access_key,  # Your AWS access key
        aws_secret_access_key=settings.s3_secret_key,  # Your AWS secret key
        endpoint_url=settings.s3_endpoint,  # Custom S3 endpoint (if any)
        region_name="us-east-1",  # AWS region
    )

    try:
        # Yield the S3 client to be used within the request scope
        yield client
    finally:
        # boto3 clients do not require explicit closing, but this ensures cleanup if needed
        pass
