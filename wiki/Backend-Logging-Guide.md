# Backend Logging Guide

This document provides comprehensive guidelines for developers on how to effectively use the standardized logging system in the LCFS backend. By following this guide, you will ensure consistent logging practices, facilitating easier debugging, monitoring, and analysis. This guide is based on the original "11. Backend Logging Guide" and adapted for the project's use of `structlog`.

## Table of Contents
1.  [Introduction](#introduction)
2.  [Logging Library: Structlog](#logging-library-structlog)
3.  [Logging Configuration](#logging-configuration)
4.  [Logging Modes](#logging-modes)
    *   [Development Mode](#development-mode)
    *   [Non-Development Mode (JSON)](#non-development-mode-json)
5.  [Logging Practices](#logging-practices)
    *   [What to Log](#what-to-log)
    *   [How to Log with Structlog](#how-to-log-with-structlog)
6.  [Sample Logs](#sample-logs)
    *   [Development Mode Logs](#development-mode-logs)
    *   [Non-Development Mode Logs](#non-development-mode-logs)
7.  [Logging Levels](#logging-levels)
8.  [Correlation ID Usage](#correlation-id-usage)
9.  [Best Practices and Guidelines](#best-practices-and-guidelines)
    *   [Consistency](#consistency)
    *   [Security and Privacy (Sensitive Data)](#security-and-privacy-sensitive-data)
    *   [Performance Considerations](#performance-considerations)
10. [Using Kibana for Log Analysis (If Applicable)](#using-kibana-for-log-analysis-if-applicable)
11. [FAQs](#faqs)

## 1. Introduction

Effective logging is crucial for diagnosing issues, monitoring application behavior, and gaining insights into system performance. This guide outlines our standardized approach to backend logging using `structlog`, helping you produce logs that are both developer-friendly and suitable for production analysis.

Our logging system, powered by `structlog`, is designed to be developer-friendly and automatically enriches logs with useful metadata like source information and correlation IDs.

## 2. Logging Library: Structlog

The backend uses **`structlog`** (`structlog` dependency in `backend/pyproject.toml`). Structlog is a powerful library for structured logging in Python, allowing for flexible and rich log event creation.

## 3. Logging Configuration

*   The primary logging configuration is typically found in `backend/lcfs/logging_config.py` (or a similar path).
*   This file sets up `structlog` processors, formatters, and integrates with standard Python logging if needed.
*   Key features handled by the configuration include:
    *   Adding timestamps.
    *   Including log levels.
    *   Capturing caller information (filename, line number, function name).
    *   Automatic inclusion of correlation IDs.
    *   Processors for development (console-friendly) and production (JSON) output.
    *   Sensitive data masking.

## 4. Logging Modes

Our logging system operates in two distinct modes:

### Development Mode
*   **Purpose**: To provide developers with readable and highlighted logs during local development.
*   **Features**:
    *   Human-readable, often colorized console output.
    *   Syntax highlighting for better readability.
    *   Indented and structured output for complex data types.
    *   Example Output Tool: `structlog.dev.ConsoleRenderer`.

### Non-Development Mode (JSON)
*   **Purpose**: To produce logs suitable for production environments, optimized for log aggregation and analysis tools (e.g., Kibana, Splunk, OpenSearch).
*   **Features**:
    *   JSON-formatted logs for easy parsing by log management systems.
    *   Compact representation of data.
    *   Example Output Tool: `structlog.processors.JSONRenderer`.

## 5. Logging Practices

### What to Log

Developers should log information that aids in understanding application behavior and diagnosing issues:

*   **Significant Business Events**: e.g., "Compliance report submitted", "User account created".
*   **Key Data Points/Identifiers**: e.g., `report_id`, `user_id`, `transaction_id`, counts, statuses.
*   **Errors and Exceptions**: All caught exceptions or significant error conditions.
*   **Service Calls**: Start and end of important service operations or external API calls, along with their success/failure status.
*   **Process Milestones**: Key steps in long-running or complex processes.
*   **Configuration Values**: Important configuration settings at startup (be mindful of sensitivity).

### How to Log with Structlog

1.  **Get a Logger Instance**:
    In your Python modules, obtain a `structlog` logger:
    ```python
    import structlog

    logger = structlog.get_logger(__name__)
    ```

2.  **Log Messages with Key-Value Pairs**:
    Log messages by calling methods on the logger object (e.g., `info`, `error`, `warning`, `debug`). Pass structured data as keyword arguments.
    ```python
    logger.info("fuel_supply_created", fuel_supply_id=123, compliance_report_id=456)
    logger.error("payment_processing_failed", order_id=789, reason="Insufficient funds")
    ```
    The first argument is typically the main "event" or message.

3.  **No Need to Manually Add Common Metadata**: The `structlog` configuration automatically adds timestamps, log levels, source information (filename, line number, function name), and correlation IDs.

## 6. Sample Logs

*(These are conceptual examples; actual format depends on `logging_config.py`.)*

### Development Mode Logs
*(Example from original wiki, adapted for structlog style)*
```
2024-11-03 18:50:23 [info     ] Getting fuel supply list for compliance report [your_module]compliance_report_id=123 correlation_id=177b381a-ca37-484d-a3b9-bbb16061775a filename=reports/views.py func_name=get_fuel_supply_list lineno=101
```
`structlog.dev.ConsoleRenderer` often provides more structured, multi-line output for key-value pairs.

### Non-Development Mode Logs (JSON)
*(Example from original wiki, adapted for structlog style)*
```json
{
  "event": "Getting fuel supply list for compliance report",
  "compliance_report_id": 123,
  "correlation_id": "816dbbdf-11fe-4df5-8dc8-754c07610742",
  "level": "info",
  "logger": "your_module.reports.views", 
  "filename": "reports/views.py", 
  "func_name": "get_fuel_supply_list", 
  "lineno": 101,
  "timestamp": "2024-11-03T18:50:23.123456Z"
}
```

## 7. Logging Levels

Use appropriate logging levels:

*   `logger.debug(...)`: Detailed information, typically for diagnosing problems. Often disabled in production.
*   `logger.info(...)`: Confirmation that things are working as expected; significant lifecycle events.
*   `logger.warning(...)`: Indication of an unexpected event or potential problem that doesn't prevent current operation but might cause issues later.
*   `logger.error(...)`: A more serious problem where the software was unable to perform some function.
*   `logger.critical(...)`: A very serious error, indicating the program itself may be unable to continue running.

## 8. Correlation ID Usage

*   **Purpose**: A unique ID to trace a single request or operation across multiple log entries, services, or components.
*   **Automatic Inclusion**: The logging infrastructure (via `structlog` processors) should automatically generate/propagate and include correlation IDs in every log entry.
*   **Future Integration**: Aim for end-to-end tracing by passing the correlation ID from the frontend through to all backend services.

## 9. Best Practices and Guidelines

### Consistency
*   **Event Names**: Use consistent and descriptive event names (the first argument to log methods like `logger.info("event_name", ...)`).
*   **Key Names**: Use consistent key names for common data points (e.g., `user_id`, `report_id`).

### Security and Privacy (Sensitive Data)
*   **DO NOT Log Sensitive Data**: Avoid logging PII (Personally Identifiable Information), passwords, access tokens, API keys, financial details, or any other confidential information directly.
*   **Automatic Data Masking**: The `structlog` configuration should include a processor to automatically mask or censor known sensitive keys (e.g., `password`, `token`, `authorization`). An example processor function from the original wiki:
    ```python
    # In backend/lcfs/logging_config.py (conceptual)
    # def censor_sensitive_data_processor(_, __, event_dict):
    #     sensitive_keys = {'password', 'token', 'secret_key', 'authorization', 'api_key'}
    #     for key in event_dict:
    #         if key in sensitive_keys:
    #             event_dict[key] = '***' # Or a more robust redaction
    #     return event_dict
    ```
    Ensure such a processor is active in your `structlog` pipeline.
*   **Be Mindful**: Even with masking, exercise caution. It's best not to log sensitive data at all if avoidable.

### Performance Considerations
*   **Avoid Excessive Logging**: Log necessary information but avoid overly verbose logging in high-throughput code paths or tight loops, as it can impact performance.
*   **Deferred Evaluation**: `structlog` can be configured to defer string formatting or a_lambda_based_value_computation until it's certain a log message will actually be emitted (e.g., based on log level), which can save resources.
*   **Asynchronous Logging**: For very high-performance scenarios, consider asynchronous logging handlers (though this adds complexity).

## 10. Using Kibana for Log Analysis (If Applicable)

If logs are shipped to an Elasticsearch, Logstash, Kibana (ELK) stack or similar (like OpenSearch):

*   **Accessing Kibana**: Via OpenShift Platform or a direct URL.
*   **Index Pattern**: Typically `app-*` or similar depending on your log shipping configuration.
*   **Timestamp Field**: Usually `@timestamp`.
*   **Searching/Filtering**: Utilize Kibana Query Language (KQL) or Lucene syntax to search and filter logs.
    *   Filter by `correlation_id` to trace a request.
    *   Filter by `level` (e.g., `level:error`).
    *   Filter by `kubernetes.namespace_name`, `kubernetes.pod_name`, `kubernetes.container_name` for specific services in OpenShift.
    *   Example Kibana Query (from original wiki):
        `kubernetes.namespace_name:"YOUR_PROJECT_NAME-tools" AND kubernetes.container_name.raw:"lcfs-backend" AND level:"error"`

## 11. FAQs

*   **Q1: Do I need to include source info (filename, line number) in logs?**
    A: No, `structlog` is configured to add this automatically.
*   **Q2: How do I include additional context?**
    A: Pass key-value pairs as keyword arguments to the logger methods: `logger.info("event", key1=value1, key2=value2)`.
*   **Q3: Do I need to manage the correlation ID?**
    A: No, this is handled by the logging infrastructure.
*   **Q4: How to log exceptions?**
    A: Use `logger.exception("event_description")` within an `except` block to automatically include exception info and stack trace, or log manually with `logger.error("event", error=str(e), exc_info=True)`.
    ```python
    try:
        # ... some operation ...
    except ValueError as e:
        logger.error("value_error_occurred", input_data=some_data, error_message=str(e))
        # For full stack trace (especially in dev or if needed for error level):
        # logger.exception("value_error_details") 
    ```

---
*Adherence to these logging guidelines will greatly improve the observability and maintainability of the LCFS backend. Consult `backend/lcfs/logging_config.py` for specific `structlog` processor chain details.* 