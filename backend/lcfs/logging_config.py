import logging
import structlog
import contextvars

# Context variables for correlation ID
correlation_id_var = contextvars.ContextVar('correlation_id', default=None)

def add_correlation_id(logger, method_name, event_dict):
    """Add correlation ID to event dict."""
    correlation_id = correlation_id_var.get()
    if correlation_id is not None:
        event_dict['correlation_id'] = correlation_id
    return event_dict

def censor_sensitive_data_processor(_, __, event_dict):
    """Censor sensitive information in logs."""
    sensitive_keys = {'password', 'token', 'secret_key', 'authorization', 'api_key'}
    for key in sensitive_keys:
        if key in event_dict:
            event_dict[key] = '***'
    return event_dict

def setup_logging(level=logging.INFO):
    """Set up structured logging configuration."""
    logging.basicConfig(
        format="%(message)s",
        level=level,
        handlers=[logging.StreamHandler()],
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            add_correlation_id,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.CallsiteParameterAdder(
                [
                    structlog.processors.CallsiteParameter.FILENAME,
                    structlog.processors.CallsiteParameter.FUNC_NAME,
                    structlog.processors.CallsiteParameter.LINENO,
                ]
            ),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            censor_sensitive_data_processor,
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(level),
        cache_logger_on_first_use=True,
    )

# Initialize the audit logger
audit_logger = structlog.get_logger('audit')

def setup_audit_logging():
    """Set up audit logger."""
    audit_handler = logging.FileHandler('audit.log')
    audit_handler.setFormatter(logging.Formatter('%(message)s'))
    audit_logger.addHandler(audit_handler)
    audit_logger.setLevel(logging.INFO)
