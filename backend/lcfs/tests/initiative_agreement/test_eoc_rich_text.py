from lcfs.web.api.initiative_agreement.rich_text import sanitize_eoc_rich_text


def test_sanitize_eoc_rich_text_preserves_quill_formatting():
    assert sanitize_eoc_rich_text(
        '<p>Safe <strong>formatted</strong> <a href="https://example.com">text</a></p>'
    ) == (
        "<p>Safe <strong>formatted</strong> "
        '<a href="https://example.com">text</a></p>'
    )


def test_sanitize_eoc_rich_text_removes_scripts_and_unsafe_attributes():
    assert (
        sanitize_eoc_rich_text(
            '<p onclick="alert(1)">Safe</p>'
            "<script>alert(1)</script>"
            '<a href="javascript:alert(1)" onmouseover="alert(2)">Link</a>'
            '<a href="java\nscript:alert(3)">Obfuscated</a>'
        )
        == "<p>Safe</p><a>Link</a><a>Obfuscated</a>"
    )


def test_sanitize_eoc_rich_text_escapes_text_and_handles_empty_values():
    assert sanitize_eoc_rich_text("<p>2 < 3 & 4 > 1</p>") == (
        "<p>2 &lt; 3 &amp; 4 &gt; 1</p>"
    )
    assert sanitize_eoc_rich_text(None) == ""
