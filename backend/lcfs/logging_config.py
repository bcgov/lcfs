import sys
import logging
import warnings
import io
import structlog
import contextvars
import datetime
from io import StringIO
from rich.console import Console
from rich.pretty import Pretty
from rich.text import Text
from rich.traceback import Traceback
from lcfs.settings import settings

# Context variables for correlation ID
correlation_id_var = contextvars.ContextVar("correlation_id", default=None)


# Common formatting constants and functions
LEVEL_STYLES = {
    "CRITICAL": "bold bright_magenta",
    "ERROR": "bold bright_red",
    "WARNING": "bold bright_yellow",
    "INFO": "bold bright_green",
    "DEBUG": "bold bright_blue",
}


def get_timestamp():
    """Return a formatted timestamp string"""
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]


def create_console(file=None):
    """Create and return a Rich console with standard settings"""
    return Console(
        force_terminal=True,
        color_system="auto",
        file=file,
    )


def format_log_header(text, timestamp, source, level_name=None):
    """Format the standard log header with timestamp, source, and level"""
    # Add timestamp
    text.append(f"{timestamp} ", style="dim")

    # Add source prefix
    source_styles = {
        "UVICORN": "bold bright_cyan",
        "PYDANTIC": "bold bright_cyan",
        "S3": "bold bright_blue",
        "REDIS": "bold bright_magenta",
        "LCFS": "bold bright_green",
    }
    style = source_styles.get(source, "bold white")
    text.append(f"[{source}] ", style=style)

    # Add level if provided
    if level_name:
        level_style = LEVEL_STYLES.get(level_name, "bold white")
        text.append(f"[{level_name}] ", style=level_style)

    return text


class BaseRichFormatter(logging.Formatter):
    """Base formatter with common rich text formatting logic"""

    def __init__(self, fmt=None, source_name="UNKNOWN"):
        super().__init__(fmt)
        self.source_name = source_name

    def format(self, record):
        # Get the original message
        message = super().format(record)

        # Create Rich console and output buffer
        console_output = StringIO()
        # Create console with proper file parameter
        console = create_console(file=console_output)

        # Get timestamp
        timestamp = get_timestamp()

        # Create text object with header
        text = Text()
        format_log_header(text, timestamp, self.source_name, record.levelname)

        # Add message content
        text.append(message, style="white")

        # Print and return
        console.print(text)
        return console_output.getvalue().rstrip()


class UvicornFilter(logging.Filter):
    """Filter to suppress 200 and 201 status code logs from Uvicorn."""

    def filter(self, record):
        try:
            # Method 1: Check direct args dict
            if hasattr(record, 'args') and isinstance(record.args, dict):
                if record.args.get('status_code', 0) in [200, 201]:
                    return False

            # Method 2: Check tuple args (this is what your logs are using)
            elif hasattr(record, 'args') and isinstance(record.args, tuple):
                # The format string is: "%s - "%s %s HTTP/%s" %d"
                # The status code is the last element in the tuple
                if len(record.args) >= 5 and record.args[4] in [200, 201]:
                    return False

            # Method 3: Check the formatted message
            if hasattr(record, 'getMessage'):
                msg = record.getMessage()
                if '" 200 ' in msg or '" 201 ' in msg:
                    return False

        except Exception as e:
            # If error in filtering, log the exception but don't filter
            print(f"Error in UvicornFilter: {e}")

        return True  # Log everything else


class UvicornFormatter(logging.Formatter):
    """Custom formatter for Uvicorn logs using Rich for colorization."""

    def format(self, record):
        # Check if this is a 200/201 status code log
        if hasattr(record, 'args') and isinstance(record.args, tuple) and len(record.args) >= 5:
            if record.args[4] in [200, 201]:
                return None  # Skip 200/201 logs entirely

        # Get the original message
        message = super().format(record)

        # Create colorized output using Rich
        console_output = StringIO()
        console = create_console(file=console_output)

        # Get timestamp
        timestamp = get_timestamp()

        # Determine status code and apply appropriate color
        try:
            status_code = None

            # Clean up the message by removing IP:port information for access logs
            if " - \"" in message and "HTTP/" in message:
                parts = message.split(" - \"")
                if len(parts) > 1:
                    http_parts = parts[1].split("\"")
                    if len(http_parts) > 1:
                        request = http_parts[0].split(" HTTP/")[0]
                        status_part = http_parts[1].strip()
                        status_match = [
                            int(s) for s in status_part.split() if s.isdigit()]
                        if status_match:
                            status_code = status_match[0]
                            message = f"{request} {status_code}"
                        else:
                            message = request

            # Extract status code from args if not already found
            if status_code is None and hasattr(record, 'args') and isinstance(record.args, tuple) and len(record.args) >= 5:
                status_code = record.args[4]

            # Create a text object for styling
            text = Text()
            format_log_header(text, timestamp, "UVICORN")

            if status_code is not None:
                # Split the message to style differently
                parts = message.split(" ")
                # Find status code position
                status_position = -1
                for i, part in enumerate(parts):
                    if part.isdigit() and int(part) == status_code:
                        status_position = i
                        break

                # Style the HTTP method (GET, POST, etc.)
                if len(parts) > 0 and status_position != 0:
                    text.append(f"{parts[0]} ", style="bold white")

                # Style the path
                path_parts = parts[1:status_position] if status_position > 0 else parts[1:]
                if path_parts:
                    path = " ".join(path_parts)
                    text.append(f"{path}", style="white")

                # Style the status code if present
                if status_position >= 0:
                    text.append(" ", style="white")
                    text.append(f"{status_code}", style=f"bold bright_red")
            else:
                # For general Uvicorn logs
                text.append(message, style="white")

            console.print(text)
            return console_output.getvalue().rstrip()

        except Exception as e:
            # Fallback to plain text but still remove IP:port if possible
            if " - \"" in message:
                parts = message.split(" - \"")
                if len(parts) > 1:
                    message = parts[1].replace("\"", "")

            return f"{timestamp} [UVICORN] {message}"


class PydanticFormatter(BaseRichFormatter):
    """Custom formatter for Pydantic logs with timestamps and styling."""

    def __init__(self, fmt=None):
        super().__init__(fmt, "PYDANTIC")


class S3Formatter(BaseRichFormatter):
    """Custom formatter for S3/boto3 logs with timestamps and styling."""

    def __init__(self, fmt=None):
        super().__init__(fmt, "S3")


class RedisFormatter(BaseRichFormatter):
    """Custom formatter for Redis logs with timestamps and styling."""

    def __init__(self, fmt=None):
        super().__init__(fmt, "REDIS")


def add_correlation_id(logger, method_name, event_dict):
    """Add correlation ID to event dict."""
    correlation_id = correlation_id_var.get()
    if correlation_id is not None:
        event_dict["correlation_id"] = correlation_id
    return event_dict


def censor_sensitive_data_processor(_, __, event_dict):
    """Censor sensitive information in logs."""
    sensitive_keys = {"password", "token",
                      "secret_key", "authorization", "api_key"}

    def censor(obj):
        if isinstance(obj, dict):
            return {
                k: "***" if k.lower() in sensitive_keys else censor(v)
                for k, v in obj.items()
            }
        elif isinstance(obj, list):
            return [censor(item) for item in obj]
        else:
            return obj

    return censor(event_dict)


def add_timestamp(logger, method_name, event_dict):
    """Add timestamp to event dict."""
    event_dict["timestamp"] = get_timestamp()
    return event_dict


def custom_console_renderer():
    def renderer(logger, name, event_dict):
        console_output = StringIO()
        # Create console with proper file parameter instead of using __dict__
        console = create_console(file=console_output)

        log_level = event_dict.get("level", "INFO").upper()
        event = event_dict.pop("event", "")
        timestamp = event_dict.pop("timestamp", "")

        # Get the log level as integer for comparison
        level_num = getattr(logging, log_level, 0)

        # Build the header with timestamp and source
        header = Text()
        format_log_header(header, timestamp, "LCFS", log_level)
        header.append(f"{event}", style="bold")

        # Print the header to the console
        console.print(header)

        # Print key-value pairs for DEBUG, ERROR and above, or specific fields
        for key, value in event_dict.items():
            # Always print exception info
            if key == "exc_info" and value:
                if isinstance(value, tuple):
                    exc_type, exc_value, exc_traceback = value
                else:
                    exc_type, exc_value, exc_traceback = sys.exc_info()

                rich_traceback = Traceback.from_exception(
                    exc_type, exc_value, exc_traceback, width=console.width, max_frames=5
                )
                console.print(rich_traceback)
            # For other key-value pairs, show details selectively
            elif level_num >= logging.ERROR or level_num <= logging.DEBUG or key == "correlation_id" or (key not in ["level", "pathname", "func_name", "lineno"]):
                console.print(f"  {key}=", style="bold bright_cyan", end="")
                console.print(Pretty(value))

        return console_output.getvalue()

    return renderer


class PydanticWarningFilter(warnings.catch_warnings):
    """Custom warning filter for Pydantic warnings."""

    def __enter__(self):
        self._original_showwarning = warnings.showwarning
        self._captured = io.StringIO()

        def showwarning(message, category, filename, lineno, *args, **kwargs):
            # Check if this is a Pydantic-related warning
            if 'pydantic' in filename:
                timestamp = get_timestamp()
                console_output = StringIO()
                console = create_console(file=console_output)

                # Create formatted text
                text = Text()
                format_log_header(text, timestamp, "PYDANTIC", "WARNING")

                # Format message
                msg_str = str(message)
                if ":" in msg_str and filename in msg_str:
                    try:
                        parts = msg_str.split(":", 2)
                        if len(parts) >= 3:
                            msg_str = parts[2].strip()
                    except Exception:
                        pass

                text.append(msg_str, style="white")

                console.print(text)
            else:
                self._original_showwarning(
                    message, category, filename, lineno, *args, **kwargs)

        warnings.showwarning = showwarning
        return super().__enter__()

    def __exit__(self, *args, **kwargs):
        warnings.showwarning = self._original_showwarning
        return super().__exit__(*args, **kwargs)


def exc_info_processor(logger, method_name, event_dict):
    """Replace exc_info=True with the actual exception information."""
    exc_info = event_dict.get("exc_info")
    if exc_info is True:
        event_dict["exc_info"] = sys.exc_info()
    return event_dict


def setup_logging(level=logging.INFO):
    """Set up structured logging configuration"""
    # Clear existing handlers and add a StreamHandler
    root_logger = logging.getLogger()
    root_logger.handlers = []
    handler = logging.StreamHandler()
    handler.setLevel(level)
    handler.setFormatter(logging.Formatter("%(message)s", validate=False))
    root_logger.addHandler(handler)
    root_logger.setLevel(level)

    # Configure Uvicorn loggers
    uvicorn_handler = logging.StreamHandler()
    uvicorn_handler.setFormatter(UvicornFormatter("%(message)s"))
    uvicorn_handler.addFilter(UvicornFilter())

    for logger_name in ["uvicorn.access", "uvicorn"]:
        logger = logging.getLogger(logger_name)
        logger.handlers = []
        logger.propagate = False
        logger.addHandler(uvicorn_handler if logger_name ==
                          "uvicorn.access" else logging.StreamHandler())
        logger.handlers[-1].setFormatter(UvicornFormatter("%(message)s"))
        logger.setLevel(logging.INFO)

    # Configure Pydantic loggers
    for logger_name in ["pydantic", "pydantic.fields"]:
        logger = logging.getLogger(logger_name)
        logger.handlers = []
        logger.propagate = False
        logger.addHandler(logging.StreamHandler())
        logger.handlers[-1].setFormatter(PydanticFormatter("%(message)s"))
        logger.setLevel(logging.INFO)

    # Configure S3/boto3 loggers
    boto_loggers = ["boto3", "botocore", "s3transfer",
                    "boto3.resources", "botocore.credentials"]
    for logger_name in boto_loggers:
        logger = logging.getLogger(logger_name)
        logger.handlers = []
        logger.propagate = False
        logger.addHandler(logging.StreamHandler())
        logger.handlers[-1].setFormatter(S3Formatter("%(message)s"))
        logger.setLevel(logging.WARNING if logger_name ==
                        "botocore.credentials" else logging.INFO)

    # Configure Redis loggers
    for logger_name in ["redis", "redis.connection"]:
        logger = logging.getLogger(logger_name)
        logger.handlers = []
        logger.propagate = False
        logger.addHandler(logging.StreamHandler())
        logger.handlers[-1].setFormatter(RedisFormatter("%(message)s"))
        logger.setLevel(logging.INFO)

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            add_correlation_id,
            add_timestamp,
            structlog.processors.add_log_level,
            structlog.processors.CallsiteParameterAdder([
                structlog.processors.CallsiteParameter.PATHNAME,
                structlog.processors.CallsiteParameter.FUNC_NAME,
                structlog.processors.CallsiteParameter.LINENO,
            ]),
            structlog.processors.StackInfoRenderer(),
            exc_info_processor,
            censor_sensitive_data_processor,
            custom_console_renderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Set up warning filter for Pydantic warnings
    warning_filter = PydanticWarningFilter()
    warning_filter.__enter__()  # Keep active for the duration of the application
