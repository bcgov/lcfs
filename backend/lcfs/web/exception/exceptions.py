class DatabaseException(Exception):
    """Exception raised for errors in the repository layer."""
    pass

class ServiceException(Exception):
    """Exception raised for errors in the business logic (service layer)."""
    pass

class DataNotFoundException(Exception):
    """Exception raised for errors where data is not found."""
    pass

class PermissionDeniedException(Exception):
    """Exception raised when permission is denied for an action."""
    pass

class ValidationErrorException(Exception):
    """Custom exception for validation errors without detail wrapping"""
    def __init__(self, errors):
        self.errors = errors
        super().__init__("Validation error")