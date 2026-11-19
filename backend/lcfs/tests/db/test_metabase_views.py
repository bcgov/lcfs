import re
from pathlib import Path

from lcfs.db.dependencies import parse_sql_sections

METABASE_SQL_PATH = (
    Path(__file__).resolve().parents[2] / "db" / "sql" / "views" / "metabase.sql"
)


def _view_definitions():
    sections = parse_sql_sections(METABASE_SQL_PATH.read_text(encoding="utf-8"))
    definitions = {}
    for section in sections.values():
        for statement in section.split(";"):
            statement = re.sub(
                r"(?:^\s*--[^\n]*(?:\n|$))+", "", statement
            ).strip()
            match = re.match(
                r"CREATE\s+OR\s+REPLACE\s+VIEW\s+([a-z0-9_]+)\s+AS\b",
                statement,
                re.IGNORECASE,
            )
            if match:
                definitions[match.group(1).lower()] = statement
    return definitions


def test_fuel_supply_views_use_latest_action_and_portal_fuel_code_value():
    sql = _view_definitions()["vw_fuel_supply_analytics_base"]
    latest_fs = re.search(
        r"latest_fs\s+AS\s*\((.*?)\)\s*,\s*selected_fs",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    selected_fs = re.search(
        r"selected_fs\s+AS\s*\((.*?)\)\s*,\s*finished_fuel_transport_modes_agg",
        sql,
        re.IGNORECASE | re.DOTALL,
    )

    assert latest_fs is not None
    assert "action_type" not in latest_fs.group(1).lower()
    assert selected_fs is not None
    assert re.search(
        r"fs\.version\s*=\s*lfs\.max_version", selected_fs.group(1), re.IGNORECASE
    )
    assert re.search(
        r"fs\.action_type\s*!=\s*'DELETE'", selected_fs.group(1), re.IGNORECASE
    )

    for view_name in ("vw_fuel_supply_base", "vw_fuel_supply_fuel_code_base"):
        view_sql = _view_definitions()[view_name]
        latest_fs = re.search(
            r"latest_fs\s+AS\s*\((.*?)\)\s*(?:SELECT|,)",
            view_sql,
            re.IGNORECASE | re.DOTALL,
        )
        assert latest_fs is not None, view_name
        assert "action_type" not in latest_fs.group(1).lower(), view_name
        assert re.search(
            r"fuel_supply\.action_type\s*!=\s*'DELETE'",
            view_sql,
            re.IGNORECASE,
        ), view_name
    assert re.search(r"cr\.version\s*<=\s*vcrb\.version", sql, re.IGNORECASE)
    assert re.search(
        r"COALESCE\s*\(\s*fc\.co_processed\s*,\s*'No'\s*\)\s+AS\s+co_processed",
        sql,
        re.IGNORECASE,
    )

    fuel_supply_map = _view_definitions()["vw_fuel_supply_map"]
    latest_fs = re.search(
        r"latest_fs\s+AS\s*\((.*?)\)\s*,\s*selected_fs",
        fuel_supply_map,
        re.IGNORECASE | re.DOTALL,
    )
    selected_fs = re.search(
        r"selected_fs\s+AS\s*\((.*?)\)\s*,\s*fuel_supply_aggregated",
        fuel_supply_map,
        re.IGNORECASE | re.DOTALL,
    )
    assert latest_fs is not None
    assert "action_type" not in latest_fs.group(1).lower()
    assert selected_fs is not None
    assert re.search(
        r"fs\.action_type\s*!=\s*'DELETE'", selected_fs.group(1), re.IGNORECASE
    )


def test_other_versioned_schedule_views_filter_delete_after_latest_version():
    definitions = _view_definitions()

    versioned_views = (
        ("vw_fuel_export_analytics_base", "latest_fe", "selected_fe", "fe"),
        (
            "vw_allocation_agreement_analytics_base",
            "latest_aa",
            "selected_aa",
            "aa",
        ),
    )
    for view_name, latest_name, selected_name, alias in versioned_views:
        sql = definitions[view_name]
        latest = re.search(
            rf"{latest_name}\s+AS\s*\((.*?)\)\s*,\s*{selected_name}",
            sql,
            re.IGNORECASE | re.DOTALL,
        )
        selected = re.search(
            rf"{selected_name}\s+AS\s*\((.*?)\)\s*,",
            sql,
            re.IGNORECASE | re.DOTALL,
        )
        assert latest is not None, view_name
        assert "action_type" not in latest.group(1).lower(), view_name
        assert selected is not None, view_name
        assert re.search(
            rf"{alias}\.action_type\s*!=\s*'DELETE'",
            selected.group(1),
            re.IGNORECASE,
        ), view_name

    allocation_base = definitions["vw_allocation_agreement_base"]
    latest_aa = re.search(
        r"latest_aa\s+AS\s*\((.*?)\)\s*,\s*selected_aa",
        allocation_base,
        re.IGNORECASE | re.DOTALL,
    )
    selected_aa = re.search(
        r"selected_aa\s+AS\s*\((.*?)\)\s*SELECT",
        allocation_base,
        re.IGNORECASE | re.DOTALL,
    )
    assert latest_aa is not None
    assert "action_type" not in latest_aa.group(1).lower()
    assert selected_aa is not None
    assert re.search(
        r"action_type\s*!=\s*'DELETE'", selected_aa.group(1), re.IGNORECASE
    )

    duplicate_check = definitions["vw_allocation_agreement_duplicate_check"]
    duplicate_latest_aa = re.search(
        r"latest_aa\s+AS\s*\((.*?)\)\s*,\s*base_data",
        duplicate_check,
        re.IGNORECASE | re.DOTALL,
    )
    assert duplicate_latest_aa is not None
    assert "action_type" not in duplicate_latest_aa.group(1).lower()
    assert re.search(
        r"WHERE\s+aa\.action_type\s*!=\s*'DELETE'",
        duplicate_check,
        re.IGNORECASE,
    )

    allocation_extended = definitions["vw_allocation_agreement_extended_base"]
    assert re.search(
        r"crs\.status\s*<>\s*'Draft'::compliancereportstatusenum",
        allocation_extended,
        re.IGNORECASE,
    )
    assert re.search(
        r"max\(cr\.version\).*?crs\.status\s*<>\s*'Draft'",
        allocation_extended,
        re.IGNORECASE | re.DOTALL,
    )
    assert re.search(
        r'"source"\."max"\s*=\s*"Allocation Agreement - Group UUID"\."version".*?'
        r'"Allocation Agreement - Group UUID"\."action_type"\s*!=\s*\'DELETE\'',
        allocation_extended,
        re.IGNORECASE | re.DOTALL,
    )

    other_uses = definitions["vw_fuels_other_use_base"]
    latest_other_uses = re.search(
        r"latest_other_uses\s+AS\s*\((.*?)\)\s*,\s*selected_other_uses",
        other_uses,
        re.IGNORECASE | re.DOTALL,
    )
    assert latest_other_uses is not None
    assert "action_type" not in latest_other_uses.group(1).lower()
    assert re.search(
        r"WHERE\s+crs\.status\s*!=\s*'Draft'::compliancereportstatusenum",
        other_uses,
        re.IGNORECASE,
    )


def test_report_analytics_exclude_current_drafts_and_keep_prior_non_draft_version():
    definitions = _view_definitions()

    assert re.search(
        r"crs\.status::text\s*<>\s*'Draft'",
        definitions["vw_compliance_report_versions"],
        re.IGNORECASE,
    )
    assert re.search(
        r"current_crs\.status\s*<>\s*'Draft'",
        definitions["vw_compliance_reports_time_per_status"],
        re.IGNORECASE,
    )
    assert re.search(
        r"current_crs\.status\s*<>\s*'Draft'",
        definitions["vw_compliance_report_status_timeline"],
        re.IGNORECASE,
    )
    assert re.search(
        r"report_status\s*<>\s*'Draft'",
        definitions["vw_compliance_report_wip_summary"],
        re.IGNORECASE,
    )

    report_base = definitions["vw_compliance_report_base"]
    assert re.search(
        r"crs\.status\s*<>\s*'Draft'",
        report_base,
        re.IGNORECASE | re.DOTALL,
    )
    assert re.search(
        r"MAX\s*\(\s*cr\.version\s*\)",
        report_base,
        re.IGNORECASE,
    )
    assert re.search(
        r'"compliance_report"\."version"\s*=\s*"Compliance Reports Chained - '
        r'Compliance Report Group UUID"\."max_version"',
        report_base,
        re.IGNORECASE,
    )
    assert re.search(
        r"crs\.status\s*<>\s*ALL\s*\(ARRAY\['Draft'::compliancereportstatusenum",
        definitions["vw_compliance_report_analytics_base"],
        re.IGNORECASE,
    )
    assert re.search(
        r"WHERE\s+crs\.status\s+NOT\s+IN\s*\('Draft'::compliancereportstatusenum\)",
        definitions["vw_fuel_supply_map"],
        re.IGNORECASE,
    )
