import sys
import logging
import structlog
import contextvars
from io import StringIO
from rich.console import Console
from rich.pretty import Pretty
from rich.text import Text
from rich.traceback import Traceback
from lcfs.settings import settings

# Context variables for correlation ID
correlation_id_var = contextvars.ContextVar("correlation_id", default=None)


def add_correlation_id(logger, method_name, event_dict):
    """Add correlation ID to event dict."""
    correlation_id = correlation_id_var.get()
    if correlation_id is not None:
        event_dict["correlation_id"] = correlation_id
    return event_dict


def censor_sensitive_data_processor(_, __, event_dict):
    """Censor sensitive information in logs."""
    sensitive_keys = {"password", "token", "secret_key", "authorization", "api_key"}

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


def custom_console_renderer():
    def renderer(logger, name, event_dict):
        console_output = StringIO()
        console = Console(
            file=console_output,
            force_terminal=True,  # Force terminal output
            color_system="auto",  # Auto-detect color support
        )

        log_level = event_dict.get("level", "INFO").upper()
        event = event_dict.pop("event", "")

        # Build the header without the timestamp
        header = Text()

        # Customize log level colors
        level_style = {
            "CRITICAL": "bold bright_magenta",
            "ERROR": "bold bright_red",
            "WARNING": "bold bright_yellow",
            "INFO": "bold bright_green",
            "DEBUG": "bold bright_blue",
        }.get(log_level, "bold white")

        header.append(f"[{log_level}] ", style=level_style)
        header.append(f"{event}", style="bold")

        # Print the header to the console
        console.print(header)

        # Print key-value pairs with custom colors
        for key, value in event_dict.items():
            if key == "exc_info" and value:
                # value is a tuple containing exception info
                if isinstance(value, tuple):
                    exc_type, exc_value, exc_traceback = value
                else:
                    # Fallback if value is not a tuple
                    exc_type, exc_value, exc_traceback = sys.exc_info()
                # Create a Traceback object
                rich_traceback = Traceback.from_exception(
                    exc_type, exc_value, exc_traceback, width=console.width
                )
                console.print(rich_traceback)
            else:
                # Customize key color and style
                console.print(f"  {key}=", style="bold bright_cyan", end="")
                # Print the value with Pretty
                console.print(Pretty(value))

        # Get the rendered message
        rendered_message = console_output.getvalue()
        return rendered_message

    return renderer


def setup_logging(level=logging.INFO):
    """Set up structured logging configuration"""
    # Clear existing handlers and add a StreamHandler
    root_logger = logging.getLogger()
    root_logger.handlers = []
    handler = logging.StreamHandler()
    handler.setLevel(level)

    # Use a formatter that doesn't interfere with color codes
    handler.setFormatter(logging.Formatter("%(message)s", validate=False))
    root_logger.addHandler(handler)
    root_logger.setLevel(level)

    # Choose renderer based on environment
    if settings.environment.lower() == "dev":
        renderer = custom_console_renderer()
        processors = [
            structlog.contextvars.merge_contextvars,
            add_correlation_id,
            structlog.processors.add_log_level,
            structlog.processors.CallsiteParameterAdder(
                [
                    structlog.processors.CallsiteParameter.PATHNAME,
                    structlog.processors.CallsiteParameter.FUNC_NAME,
                    structlog.processors.CallsiteParameter.LINENO,
                ]
            ),
            structlog.processors.StackInfoRenderer(),
            exc_info_processor,
            censor_sensitive_data_processor,
            renderer,
        ]
    else:
        renderer = structlog.processors.JSONRenderer()
        processors = [
            structlog.contextvars.merge_contextvars,
            add_correlation_id,
            structlog.processors.add_log_level,
            structlog.processors.CallsiteParameterAdder(
                [
                    structlog.processors.CallsiteParameter.PATHNAME,
                    structlog.processors.CallsiteParameter.FUNC_NAME,
                    structlog.processors.CallsiteParameter.LINENO,
                ]
            ),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            censor_sensitive_data_processor,
            renderer,
        ]

    structlog.configure(
        processors=processors,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def exc_info_processor(logger, method_name, event_dict):
    """Replace exc_info=True with the actual exception information."""
    exc_info = event_dict.get("exc_info")
    if exc_info:
        if exc_info is True:
            event_dict["exc_info"] = sys.exc_info()
    return event_dict
