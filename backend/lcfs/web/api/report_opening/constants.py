START_YEAR = 2019
END_YEAR = 2030


def configured_years() -> list[int]:
    """Return the list of compliance years that can be configured."""

    return list(range(START_YEAR, END_YEAR + 1))
