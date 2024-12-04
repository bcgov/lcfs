from starlette.requests import Request
import boto3


# S3 Client Dependency
async def get_s3_client(
    request: Request,
) -> boto3.client:
    """
    Returns the S3 client from the application state.

    Usage:
        >>> async def handler(s3_client = Depends(get_s3_client)):
        >>>     s3_client.upload_file('file.txt', 'my-bucket', 'file.txt')

    :param request: Current request object.
    :returns: S3 client.
    """
    return request.app.state.s3_client
