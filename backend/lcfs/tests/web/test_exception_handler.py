import pytest
from unittest.mock import Mock, patch
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from starlette.requests import Request
from starlette.responses import JSONResponse
from lcfs.web.exception.exception_handler import (
    _reference_number,
    _make_json_serializable,
    validation_exception_handler,
    validation_error_exception_handler_no_details,
    http_exception_handler,
    global_exception_handler,
)
from lcfs.web.exception.exceptions import ValidationErrorException

# Use anyio for async tests (already installed)
pytestmark = pytest.mark.anyio


@pytest.fixture
def mock_request():
    """Create a mock request object."""
    request = Mock(spec=Request)
    request.url = Mock()
    request.url.__str__ = Mock(return_value="http://test.com/api/test")
    request.method = "POST"
    request.headers = {"Content-Type": "application/json"}
    return request


@pytest.fixture
def mock_correlation_id():
    """Mock correlation ID context variable."""
    with patch("lcfs.web.exception.exception_handler.correlation_id_var") as mock_var:
        yield mock_var


class TestReferenceNumber:
    """Tests for _reference_number helper function."""

    def test_returns_correlation_id_when_present(self, mock_correlation_id):
        """Test that reference number returns correlation ID when available."""
        mock_correlation_id.get.return_value = "test-correlation-id-123"
        result = _reference_number()
        assert result == "test-correlation-id-123"

    def test_returns_none_when_correlation_id_missing(self, mock_correlation_id):
        """Test that reference number returns None when correlation ID is not set."""
        mock_correlation_id.get.return_value = None
        result = _reference_number()
        assert result is None

    def test_returns_none_when_correlation_id_empty_string(self, mock_correlation_id):
        """Test that reference number returns None for empty string correlation ID."""
        mock_correlation_id.get.return_value = ""
        result = _reference_number()
        assert result is None


class TestMakeJsonSerializable:
    """Tests for _make_json_serializable helper function."""

    def test_handles_simple_errors(self):
        """Test serialization of simple error objects."""
        errors = [
            {"loc": ["body", "field1"], "msg": "Field required", "type": "value_error"}
        ]
        result = _make_json_serializable(errors)
        assert len(result) == 1
        assert result[0]["loc"] == ["body", "field1"]
        assert result[0]["msg"] == "Field required"

    def test_converts_non_serializable_ctx_values(self):
        """Test that non-serializable context values are converted to strings."""

        class CustomObject:
            def __str__(self):
                return "custom_object_repr"

        errors = [
            {
                "loc": ["body", "field1"],
                "msg": "Invalid value",
                "type": "value_error",
                "ctx": {"custom": CustomObject(), "normal": "string_value"},
            }
        ]
        result = _make_json_serializable(errors)
        assert result[0]["ctx"]["custom"] == "custom_object_repr"
        assert result[0]["ctx"]["normal"] == "string_value"

    def test_preserves_serializable_ctx_values(self):
        """Test that already serializable context values are preserved."""
        errors = [
            {
                "loc": ["body", "field1"],
                "msg": "Invalid value",
                "type": "value_error",
                "ctx": {
                    "string": "test",
                    "int": 42,
                    "float": 3.14,
                    "bool": True,
                    "none": None,
                    "list": [1, 2, 3],
                    "dict": {"nested": "value"},
                },
            }
        ]
        result = _make_json_serializable(errors)
        ctx = result[0]["ctx"]
        assert ctx["string"] == "test"
        assert ctx["int"] == 42
        assert ctx["float"] == 3.14
        assert ctx["bool"] is True
        assert ctx["none"] is None
        assert ctx["list"] == [1, 2, 3]
        assert ctx["dict"] == {"nested": "value"}

    def test_handles_errors_without_ctx(self):
        """Test handling of errors without context field."""
        errors = [{"loc": ["body", "field1"], "msg": "Field required"}]
        result = _make_json_serializable(errors)
        assert len(result) == 1
        assert "ctx" not in result[0]


class TestValidationExceptionHandler:
    """Tests for validation_exception_handler."""

    async def test_returns_422_with_validation_details(
        self, mock_request, mock_correlation_id
    ):
        """Test that validation errors return 422 with proper structure."""
        mock_correlation_id.get.return_value = "ref-123"

        validation_errors = [
            {"loc": ["body", "email"], "msg": "Invalid email", "type": "value_error"}
        ]
        exc = Mock(spec=RequestValidationError)
        exc.errors.return_value = validation_errors

        response = await validation_exception_handler(mock_request, exc)

        assert isinstance(response, JSONResponse)
        assert response.status_code == 422
        content = response.body.decode()
        assert "Validation failed" in content
        assert "email" in content
        assert "Invalid email" in content
        assert "ref-123" in content

    async def test_includes_reference_number_when_available(
        self, mock_request, mock_correlation_id
    ):
        """Test that reference number is included when correlation ID exists."""
        mock_correlation_id.get.return_value = "correlation-abc-123"

        validation_errors = [
            {"loc": ["body", "name"], "msg": "Field required", "type": "value_error"}
        ]
        exc = Mock(spec=RequestValidationError)
        exc.errors.return_value = validation_errors

        response = await validation_exception_handler(mock_request, exc)

        assert response.status_code == 422
        content = response.body.decode()
        assert "correlation-abc-123" in content

    async def test_omits_reference_number_when_not_available(
        self, mock_request, mock_correlation_id
    ):
        """Test that reference number is omitted when correlation ID is None."""
        mock_correlation_id.get.return_value = None

        validation_errors = [
            {"loc": ["body", "age"], "msg": "Must be positive", "type": "value_error"}
        ]
        exc = Mock(spec=RequestValidationError)
        exc.errors.return_value = validation_errors

        response = await validation_exception_handler(mock_request, exc)

        assert response.status_code == 422
        content = response.body.decode()
        assert "reference_number" not in content

    async def test_handles_multiple_validation_errors(
        self, mock_request, mock_correlation_id
    ):
        """Test handling of multiple validation errors."""
        mock_correlation_id.get.return_value = "ref-multi-123"

        validation_errors = [
            {"loc": ["body", "email"], "msg": "Invalid email", "type": "value_error"},
            {"loc": ["body", "age"], "msg": "Must be positive", "type": "value_error"},
            {
                "loc": ["body", "name"],
                "msg": "Field required",
                "type": "value_error.missing",
            },
        ]
        exc = Mock(spec=RequestValidationError)
        exc.errors.return_value = validation_errors

        response = await validation_exception_handler(mock_request, exc)

        assert response.status_code == 422
        content = response.body.decode()
        assert "email" in content
        assert "age" in content
        assert "name" in content


class TestValidationErrorExceptionHandlerNoDetails:
    """Tests for validation_error_exception_handler_no_details."""

    async def test_returns_422_with_error_content(self, mock_request):
        """Test that ValidationErrorException returns 422 with error content."""
        error_content = {"field": "email", "message": "Invalid format"}
        exc = ValidationErrorException(errors=error_content)

        response = await validation_error_exception_handler_no_details(
            mock_request, exc
        )

        assert isinstance(response, JSONResponse)
        assert response.status_code == 422
        content = response.body.decode()
        assert "email" in content
        assert "Invalid format" in content

    async def test_returns_errors_without_detail_wrapping(self, mock_request):
        """Test that errors are returned directly without 'detail' wrapper."""
        error_content = {"errors": [{"field": "name", "message": "Required"}]}
        exc = ValidationErrorException(errors=error_content)

        response = await validation_error_exception_handler_no_details(
            mock_request, exc
        )

        content = response.body.decode()
        assert '"errors"' in content
        assert "name" in content


class TestHttpExceptionHandler:
    """Tests for http_exception_handler."""

    async def test_handles_http_exception_with_string_detail(
        self, mock_request, mock_correlation_id
    ):
        """Test handling HTTPException with string detail."""
        mock_correlation_id.get.return_value = "ref-http-123"
        exc = HTTPException(status_code=404, detail="Resource not found")

        response = await http_exception_handler(mock_request, exc)

        assert isinstance(response, JSONResponse)
        assert response.status_code == 404
        content = response.body.decode()
        assert "Resource not found" in content
        assert "ref-http-123" in content

    async def test_handles_http_exception_with_dict_detail(
        self, mock_request, mock_correlation_id
    ):
        """Test handling HTTPException with dict detail."""
        mock_correlation_id.get.return_value = "ref-dict-456"
        detail_dict = {"error": "Not found", "resource": "user"}
        exc = HTTPException(status_code=404, detail=detail_dict)

        response = await http_exception_handler(mock_request, exc)

        assert response.status_code == 404
        content = response.body.decode()
        assert "Not found" in content
        assert "user" in content
        assert "ref-dict-456" in content

    async def test_handles_500_error_with_reference_number(
        self, mock_request, mock_correlation_id
    ):
        """Test that 500 errors include reference number for tracking."""
        mock_correlation_id.get.return_value = "ref-500-error-789"
        exc = HTTPException(status_code=500, detail="Internal server error")

        response = await http_exception_handler(mock_request, exc)

        assert response.status_code == 500
        content = response.body.decode()
        assert "Internal server error" in content
        assert "ref-500-error-789" in content

    async def test_omits_reference_number_when_not_available(
        self, mock_request, mock_correlation_id
    ):
        """Test that reference number is omitted when correlation ID is None."""
        mock_correlation_id.get.return_value = None
        exc = HTTPException(status_code=400, detail="Bad request")

        response = await http_exception_handler(mock_request, exc)

        assert response.status_code == 400
        content = response.body.decode()
        assert "Bad request" in content
        assert "reference_number" not in content

    async def test_handles_403_forbidden(self, mock_request, mock_correlation_id):
        """Test handling of 403 Forbidden errors."""
        mock_correlation_id.get.return_value = "ref-403-xyz"
        exc = HTTPException(status_code=403, detail="Access denied")

        response = await http_exception_handler(mock_request, exc)

        assert response.status_code == 403
        content = response.body.decode()
        assert "Access denied" in content
        assert "ref-403-xyz" in content


class TestGlobalExceptionHandler:
    """Tests for global_exception_handler."""

    async def test_handles_uncaught_exception(self, mock_request, mock_correlation_id):
        """Test that uncaught exceptions are handled properly."""
        mock_correlation_id.get.return_value = "ref-global-123"

        with patch("lcfs.web.exception.exception_handler.structlog") as mock_structlog:
            mock_logger = Mock()
            mock_structlog.get_logger.return_value = mock_logger

            exc = Exception("Unexpected error occurred")
            response = await global_exception_handler(mock_request, exc)

            assert isinstance(response, JSONResponse)
            assert response.status_code == 500
            content = response.body.decode()
            assert "Internal Server Error" in content
            assert "ref-global-123" in content

            mock_logger.error.assert_called_once()
            call_args = mock_logger.error.call_args
            assert call_args[0][0] == "Unhandled exception"
            assert call_args[1]["error"] == "Unexpected error occurred"
            assert call_args[1]["correlation_id"] == "ref-global-123"

    async def test_logs_request_details(self, mock_request, mock_correlation_id):
        """Test that request details are logged for debugging."""
        mock_correlation_id.get.return_value = "ref-log-456"

        with patch("lcfs.web.exception.exception_handler.structlog") as mock_structlog:
            mock_logger = Mock()
            mock_structlog.get_logger.return_value = mock_logger

            exc = RuntimeError("Database connection failed")
            await global_exception_handler(mock_request, exc)

            call_args = mock_logger.error.call_args[1]
            assert call_args["request_url"] == "http://test.com/api/test"
            assert call_args["method"] == "POST"
            assert "headers" in call_args

    async def test_omits_reference_number_when_not_available(
        self, mock_request, mock_correlation_id
    ):
        """Test that reference number is omitted when correlation ID is None."""
        mock_correlation_id.get.return_value = None

        with patch("lcfs.web.exception.exception_handler.structlog") as mock_structlog:
            mock_logger = Mock()
            mock_structlog.get_logger.return_value = mock_logger

            exc = ValueError("Invalid input")
            response = await global_exception_handler(mock_request, exc)

            assert response.status_code == 500
            content = response.body.decode()
            assert "Internal Server Error" in content
            assert "reference_number" not in content

    async def test_includes_exc_info_in_logs(self, mock_request, mock_correlation_id):
        """Test that exception info is included in logs for stack traces."""
        mock_correlation_id.get.return_value = "ref-trace-789"

        with patch("lcfs.web.exception.exception_handler.structlog") as mock_structlog:
            mock_logger = Mock()
            mock_structlog.get_logger.return_value = mock_logger

            exc = ZeroDivisionError("Division by zero")
            await global_exception_handler(mock_request, exc)

            call_args = mock_logger.error.call_args[1]
            assert call_args["exc_info"] is True
