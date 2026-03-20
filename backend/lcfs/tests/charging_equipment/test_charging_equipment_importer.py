from lcfs.web.api.charging_equipment.importer import _DuplicateSerialTracker


def test_duplicate_tracker_detects_file_duplicates_same_site():
    tracker = _DuplicateSerialTracker()
    assert tracker.is_duplicate("ABC123", 1) is False  # first occurrence allowed
    assert tracker.summary_message() is None
    assert tracker.is_duplicate("abc123", 1) is True  # case-insensitive duplicate at same site
    assert (
        tracker.summary_message()
        == "1 record with duplicate serial numbers was not uploaded."
    )


def test_duplicate_tracker_allows_same_serial_different_site():
    """Same serial number at a different charging site should be allowed."""
    tracker = _DuplicateSerialTracker()
    assert tracker.is_duplicate("ABC123", 1) is False
    assert tracker.is_duplicate("ABC123", 2) is False  # different site → allowed
    assert tracker.summary_message() is None


def test_duplicate_tracker_existing_serials_blocked_same_site():
    tracker = _DuplicateSerialTracker(existing_serials=[("SER-9", 10)])
    assert tracker.is_duplicate("SER-9", 10) is True  # same site → blocked
    assert (
        tracker.summary_message()
        == "1 record with duplicate serial numbers was not uploaded."
    )
    # Subsequent duplicates continue to increment
    assert tracker.is_duplicate("ser-9", 10) is True
    assert (
        tracker.summary_message()
        == "2 records with duplicate serial numbers were not uploaded."
    )


def test_duplicate_tracker_existing_serials_allowed_different_site():
    """Existing serial at a different site should not block the upload."""
    tracker = _DuplicateSerialTracker(existing_serials=[("SER-9", 10)])
    assert tracker.is_duplicate("SER-9", 20) is False  # different site → allowed
    assert tracker.summary_message() is None
