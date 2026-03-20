import enum
import os
from typing import Literal
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
    # Number of Uvicorn workers
    workers_count: int = 2
    # Enable Uvicorn reload (True for development, False for production)
    reload: bool = False
    # App timeout matching OpenShift's ROUTER_DEFAULT_SERVER_TIMEOUT
    timeout_keep_alive: int = 30

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

    # Variables for ClamAV
    clamav_enabled: bool = False
    clamav_host: str = "clamav"
    clamav_port: int = 3310

    # Variables for RabbitMQ
    rabbitmq_host: str = "rabbitmq"
    rabbitmq_port: int = 5672
    rabbitmq_pass: str = "development_only"
    rabbitmq_user: str = "lcfs"
    rabbitmq_vhost: str = "lcfs"
    rabbitmq_transaction_queue: str = "transaction_queue"

    ches_enabled: bool = False
    ches_auth_url: str = ""
    ches_email_url: str = ""
    ches_client_id: str = ""
    ches_client_secret: str = ""
    ches_sender_email: str = "noreply@gov.bc.ca"
    ches_sender_name: str = "LCFS Notification System"

    # Feature flags
    feature_credit_market_notifications: bool = True
    feature_fuel_code_expiry_email: bool = True

    # AI analytics
    ai_analytics_max_rows: int = 500
    ai_analytics_default_limit: int = 100
    ai_analytics_schema_cache_ttl_seconds: int = 300
    ai_analytics_mode: Literal[
        "heuristic_only", "local_llm_direct", "openclaw_local"
    ] = "heuristic_only"
    ai_analytics_llm_provider: str = "ollama"
    ai_analytics_llm_model: Optional[str] = None
    ai_analytics_llm_base_url: Optional[str] = None
    ai_analytics_llm_api_key: Optional[str] = None
    ai_analytics_openclaw_base_url: Optional[str] = None
    ai_analytics_openclaw_model: Optional[str] = None
    ai_analytics_openclaw_path: str = "/orchestrate"
    ai_analytics_allow_private_hosts_only: bool = True
    ai_analytics_allowed_internal_hosts: str = "localhost,127.0.0.1,ollama,openclaw"
    ai_analytics_request_timeout_seconds: int = 60
    ai_analytics_max_retries: int = 2
    ai_analytics_enable_llm_summary: bool = True
    ai_analytics_log_prompts: bool = False
    ai_analytics_enable_mindsdb: bool = False
    ai_analytics_mindsdb_base_url: Optional[str] = None
    ai_analytics_mindsdb_timeout_seconds: int = 60
    ai_analytics_mindsdb_private_only: bool = True
    ai_analytics_mindsdb_allowed_internal_hosts: str = "localhost,127.0.0.1,mindsdb"
    ai_analytics_mindsdb_sql_path: str = "/api/sql/query"
    ai_analytics_mindsdb_project: str = "mindsdb"
    ai_analytics_mindsdb_postgres_integration: str = "lcfs_postgres"
    ai_analytics_min_forecast_points: int = 12
    ai_analytics_default_forecast_horizon: int = 6

    def __init__(self, **kwargs):
        # Map APP_ENVIRONMENT to environment if present
        app_env = os.getenv("APP_ENVIRONMENT")
        if app_env and "environment" not in kwargs:
            kwargs["environment"] = app_env
        super().__init__(**kwargs)
        self._validate_ai_settings()

    def _validate_ai_settings(self) -> None:
        if self.ai_analytics_mode == "heuristic_only":
            return
        from lcfs.services.ai_analytics.providers.local_endpoint_validator import (
            validate_private_ai_url,
        )

        if self.ai_analytics_mode == "local_llm_direct":
            if not self.ai_analytics_llm_base_url:
                raise ValueError(
                    "LCFS_AI_ANALYTICS_LLM_BASE_URL is required for local_llm_direct mode."
                )
            validate_private_ai_url(
                self.ai_analytics_llm_base_url,
                self,
                "LCFS_AI_ANALYTICS_LLM_BASE_URL",
            )
            return

        if self.ai_analytics_mode == "openclaw_local":
            if not self.ai_analytics_openclaw_base_url:
                raise ValueError(
                    "LCFS_AI_ANALYTICS_OPENCLAW_BASE_URL is required for openclaw_local mode."
                )
            validate_private_ai_url(
                self.ai_analytics_openclaw_base_url,
                self,
                "LCFS_AI_ANALYTICS_OPENCLAW_BASE_URL",
            )
        if self.ai_analytics_enable_mindsdb:
            if not self.ai_analytics_mindsdb_base_url:
                raise ValueError(
                    "LCFS_AI_ANALYTICS_MINDSDB_BASE_URL is required when MindsDB is enabled."
                )
            if self.ai_analytics_mindsdb_private_only:
                original_hosts = self.ai_analytics_allowed_internal_hosts
                self.ai_analytics_allowed_internal_hosts = (
                    self.ai_analytics_mindsdb_allowed_internal_hosts
                )
                try:
                    validate_private_ai_url(
                        self.ai_analytics_mindsdb_base_url,
                        self,
                        "LCFS_AI_ANALYTICS_MINDSDB_BASE_URL",
                    )
                finally:
                    self.ai_analytics_allowed_internal_hosts = original_hosts

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
