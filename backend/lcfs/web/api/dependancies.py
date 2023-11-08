from fastapi import Query
from sqlalchemy import asc, desc

# Dependencies for pagination and sorting
def pagination_query(
    page: int = Query(1, ge=1, description="Page number of the results"),
    per_page: int = Query(10, ge=1, le=100, description="Number of results per page"),
    sort_field: str = Query("username", description="Sorting field"),
    sort_direction: str = Query("asc", description="Sorting direction"),
) -> dict:
    """
    Creates a dictionary with pagination and sorting parameters from query parameters.

    Args:
        page (int): The current page number.
        per_page (int): The number of items to return per page.
        sort_field (str): The field by which to sort the results.
        sort_direction (str): The direction of sorting (ascending or descending).

    Returns:
        dict: A dictionary containing pagination and sorting parameters.
    """
    sort_function = desc if sort_direction == "desc" else asc
    return {
        "page": page,
        "per_page": per_page,
        "sort_field": sort_field,
        "sort_function": sort_function
    }
