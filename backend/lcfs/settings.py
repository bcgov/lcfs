import enum
from pathlib import Path
from tempfile import gettempdir
from typing import Optional

from pydantic_settings import BaseSettings
from yarl import URL

TEMP_DIR = Path(gettempdir())


class LogLevel(str, enum.Enum):  # noqa: WPS600
    """Possible log levels."""

    NOTSET = "NOTSET"
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    FATAL = "FATAL"


class Settings(BaseSettings):
    """
    Application settings.

    These parameters can be configured
    with environment variables.
    """

    host: str = "0.0.0.0"
    port: int = 8000
    # quantity of workers for uvicorn
    workers_count: int = 2
    # Enable uvicorn reloading
    reload: bool = True

    # Current environment
    environment: str = "dev"

    log_level: LogLevel = LogLevel.DEBUG

    # Variables for the database
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "lcfs"
    db_pass: str = "development_only"
    db_base: str = "lcfs"
    db_test: str = "lcfs_test"
    db_echo: bool = False

    # Variables for Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: str = "lcfs"
    redis_user: Optional[str] = None
    redis_pass: Optional[str] = "development_only"
    redis_base: Optional[int] = None

    # Variables for Keycloak
    well_known_endpoint: str = (
        "https://dev.loginproxy.gov.bc.ca/auth/realms/standard/.well-known/openid-configuration"
    )
    keycloak_audience: str = "low-carbon-fuel-standard-5147"

    # Variables for S3
    s3_endpoint: str = "http://minio:9000"
    s3_bucket: str = "lcfs"
    s3_access_key: str = "s3_access_key"
    s3_secret_key: str = "development_only"
    s3_docs_path: str = "lcfs-docs"

    clamav_enabled: bool = False
    clamav_host: str = "clamav"
    clamav_port: int = 3310

    @property
    def db_url(self) -> URL:
        """
        Assemble database URL from settings.

        :return: database URL.
        """
        return URL.build(
            scheme="postgresql+asyncpg",
            host=self.db_host,
            port=self.db_port,
            user=self.db_user,
            password=self.db_pass,
            path=f"/{self.db_base}",
        )

    @property
    def db_test_url(self) -> URL:
        """
        Assemble database URL from settings.

        :return: database URL.
        """
        return URL.build(
            scheme="postgresql+asyncpg",
            host=self.db_host,
            port=self.db_port,
            user=self.db_user,
            password=self.db_pass,
            path=f"/{self.db_test}",
        )

    @property
    def redis_url(self) -> URL:
        """
        Assemble REDIS URL from settings.

        :return: redis URL.
        """
        path = ""
        if self.redis_base is not None:
            path = f"/{self.redis_base}"
        return URL.build(
            scheme="redis",
            host=self.redis_host,
            port=self.redis_port,
            user=self.redis_user,
            password=self.redis_pass,
            path=path,
        )

    class Config:
        env_file = ".env"
        env_prefix = "LCFS_"
        env_file_encoding = "utf-8"


settings = Settings()
