from starlette.requests import Request
from aioboto3 import Session


# S3 Client Dependency
async def get_s3_client(
    request: Request,
) -> Session.client:
    """
    Returns the S3 client from the application state.

    Usage:
        >>> async def handler(s3_client = Depends(get_s3_client)):
        >>>     async with s3_client as client:
        >>>         await client.upload_fileobj('file.txt', 'my-bucket', 'file.txt')

    :param request: Current request object.
    :returns: S3 client.
    """
    return request.app.state.s3_client
