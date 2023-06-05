from os import path
from minio import Minio
from fastapi import HTTPException
from api.config import MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_HOST_URL
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR


minio_client = Minio(MINIO_HOST_URL,
                  access_key=MINIO_ACCESS_KEY,
                  secret_key=MINIO_SECRET_KEY,
                  secure=False)


def s3_upload_file(destination_file_name: str, local_file_path: str, content_type: str, bucket_name: str):
    """
    Uploads a file to s3 Minio storage and returns the file response object
    """
    if not path.exists(local_file_path):
        raise FileNotFoundError(
            f'file_path: {local_file_path} is not a valid file')

    try:
        result = minio_client.fput_object(bucket_name=bucket_name,
                                          object_name=destination_file_name,
                                          file_path=local_file_path,
                                          content_type=content_type)
        return result
    except Exception as exc:
        raise HTTPException(status_code=HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f'Unknown Error During Upload Process {exc}')


def s3_delete_file(bucket_name: str, object_name: str):
    """
    Deletes a file from s3 minio storage
    """
    try:
        print('deleting object:', object_name)
        result = minio_client.remove_object(bucket_name, object_name)
        return result
    except Exception as exc:
        print('error deleting file: ', exc)
        raise HTTPException(status_code=HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f'Unknown Error During Delete Process {exc}')


def s3_list_directory(bucket_name: str, folder_name: str):
    """
    Lists all files in a s3 minio storage
    """
    try:
        print('listing files for directory:', folder_name)
        files = minio_client.list_objects(bucket_name, prefix=folder_name, recursive=True)
        return files
    except Exception as exc:
        print('error listing directory:', exc)
        raise HTTPException(status_code=HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f'Unknown Error Listing Directory {exc}')


def s3_get_file(bucket_name: str, object_name: str):
    """
    Gets a file from s3 minio storage
    """
    try:
        result = minio_client.get_object(bucket_name, object_name)
        return result
    except Exception as exc:
        print('error getting file: ', exc)
        raise HTTPException(status_code=HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f'Unknown Error Getting File {exc}')
