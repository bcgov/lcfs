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
