class DatabaseException(Exception):
    """Exception raised for errors in the repository layer."""

    pass


class ServiceException(Exception):
    """Exception raised for errors in the business logic (service layer)."""

    pass


class DataNotFoundException(Exception):
    """Exception raised for errors where data is not found."""

    pass
