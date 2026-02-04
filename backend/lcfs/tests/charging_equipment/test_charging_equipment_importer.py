from lcfs.web.api.charging_equipment.importer import _DuplicateSerialTracker


def test_duplicate_tracker_detects_file_duplicates():
    tracker = _DuplicateSerialTracker()
    assert tracker.is_duplicate("ABC123") is False  # first occurrence allowed
    assert tracker.summary_message() is None
    assert tracker.is_duplicate("abc123") is True  # case-insensitive duplicate
    assert (
        tracker.summary_message()
        == "1 record with duplicate serial numbers was not uploaded."
    )


def test_duplicate_tracker_existing_serials_blocked():
    tracker = _DuplicateSerialTracker(existing_serials={"SER-9"})
    assert tracker.is_duplicate("SER-9") is True
    assert (
        tracker.summary_message()
        == "1 record with duplicate serial numbers was not uploaded."
    )
    # Subsequent duplicates continue to increment
    assert tracker.is_duplicate("ser-9") is True
    assert (
        tracker.summary_message()
        == "2 records with duplicate serial numbers were not uploaded."
    )
