START_YEAR = 2017
END_YEAR = 2030

# New report creation is initially closed for the two newly configurable years.
DEFAULT_CLOSED_COMPLIANCE_REPORTING_YEARS = frozenset({2017, 2018})


def configured_years() -> list[int]:
    """Return the list of compliance years that can be configured."""

    return list(range(START_YEAR, END_YEAR + 1))
