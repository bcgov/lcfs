import base64
import io
import json
import re
import struct
import zlib
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

import requests
import structlog
from openpyxl import Workbook
from openpyxl.styles import Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover - manual PNG fallback still works.
    Image = ImageDraw = ImageFont = None

from lcfs.settings import settings

logger = structlog.get_logger(__name__)

EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
INVALID_SHEET_TITLE_CHARS = re.compile(r"[\[\]\*:/\\?]")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
WORKBOOK_REPORT_KEYWORDS = (
    "annual",
    "quarterly",
    "quarter",
    "monthly market",
    "monthly report",
    "monthly data",
    "month report",
    "month data",
)


@dataclass
class MetabaseTable:
    name: str
    columns: List[str]
    rows: List[List[Any]]
    visualization_settings: Dict[str, Any] = field(default_factory=dict)
    display: Optional[str] = None


@dataclass
class MetabaseDashboardReport:
    dashboard_name: str
    dashboard_description: Optional[str]
    dashboard_url: str
    tables: List[MetabaseTable]
    subscriber_emails: List[str]


class MetabaseClient:
    """Small client for the Metabase dashboard/card APIs used by reports."""

    def __init__(self):
        self.base_url = settings.metabase_base_url.rstrip("/")
        self.timeout = settings.metabase_request_timeout_seconds
        self.session = requests.Session()

    def fetch_credit_market_report(self) -> MetabaseDashboardReport:
        self._validate_configuration()
        self._authenticate()

        dashboard_id = settings.metabase_credit_market_dashboard_id
        dashboard = self._get_json(f"/api/dashboard/{dashboard_id}")
        cards = self._extract_cards(dashboard)
        tables = [
            table
            for table in (self._fetch_table(dashboard_id, card) for card in cards)
            if table
        ]
        subscribers = self.fetch_dashboard_subscriber_emails(dashboard_id)

        return MetabaseDashboardReport(
            dashboard_name=dashboard.get("name") or "Credit Market Report",
            dashboard_description=dashboard.get("description"),
            dashboard_url=f"{self.base_url}/dashboard/{dashboard_id}",
            tables=tables,
            subscriber_emails=subscribers,
        )

    def fetch_dashboard_subscriber_emails(self, dashboard_id: int) -> List[str]:
        """
        Best-effort extraction of Metabase dashboard subscription recipients.

        Metabase versions expose dashboard subscriptions in slightly different
        endpoints. If none are available, callers can still use configured
        fallback recipients.
        """
        recipients = set()
        for path in (
            f"/api/dashboard/{dashboard_id}/subscriptions",
            f"/api/pulse?dashboard_id={dashboard_id}",
        ):
            try:
                payload = self._get_json(path)
            except requests.HTTPError as exc:
                status_code = (
                    exc.response.status_code if exc.response is not None else None
                )
                if status_code in (400, 404, 405):
                    continue
                raise
            except requests.RequestException:
                logger.warning("Unable to read Metabase subscriptions", path=path)
                continue

            recipients.update(self._extract_emails(payload))

        return sorted(recipients)

    def _validate_configuration(self) -> None:
        missing = []
        if not self.base_url:
            missing.append("metabase_base_url")
        if not settings.metabase_credit_market_dashboard_id:
            missing.append("metabase_credit_market_dashboard_id")
        if (
            not settings.metabase_api_key
            and not settings.metabase_session_token
            and not (settings.metabase_username and settings.metabase_password)
        ):
            missing.append(
                "metabase_api_key, metabase_session_token, or metabase_username/metabase_password"
            )

        if missing:
            raise ValueError(f"Missing Metabase configuration: {', '.join(missing)}")

    def _authenticate(self) -> None:
        if settings.metabase_api_key:
            self.session.headers.update({"X-API-Key": settings.metabase_api_key})
            return

        if settings.metabase_session_token:
            self.session.headers.update(
                {"X-Metabase-Session": settings.metabase_session_token}
            )
            return

        response = self.session.post(
            f"{self.base_url}/api/session",
            json={
                "username": settings.metabase_username,
                "password": settings.metabase_password,
            },
            timeout=self.timeout,
        )
        response.raise_for_status()
        session_id = response.json().get("id")
        if not session_id:
            raise ValueError("Metabase session response did not include a session id")
        self.session.headers.update({"X-Metabase-Session": session_id})

    def _get_json(self, path: str) -> Any:
        response = self.session.get(f"{self.base_url}{path}", timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def _post_json(self, path: str, payload: Optional[Dict[str, Any]] = None) -> Any:
        response = self.session.post(
            f"{self.base_url}{path}",
            json=payload or {},
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

    def _extract_cards(self, dashboard: Dict[str, Any]) -> List[Dict[str, Any]]:
        cards = dashboard.get("dashcards") or dashboard.get("ordered_cards") or []
        return [card for card in cards if self._card_id(card)]

    def _fetch_table(
        self, dashboard_id: int, dashboard_card: Dict[str, Any]
    ) -> Optional[MetabaseTable]:
        card_id = self._card_id(dashboard_card)
        if card_id is None:
            return None

        dashboard_card_id = dashboard_card.get("id")
        if dashboard_card_id:
            try:
                result = self._post_json(
                    f"/api/dashboard/{dashboard_id}/dashcard/{dashboard_card_id}/card/{card_id}/query"
                )
            except requests.HTTPError as exc:
                status_code = (
                    exc.response.status_code if exc.response is not None else None
                )
                if status_code not in (400, 404, 405):
                    raise
                result = self._post_json(f"/api/card/{card_id}/query")
        else:
            result = self._post_json(f"/api/card/{card_id}/query")

        data = result.get("data") or {}
        rows = data.get("rows") or []
        cols = data.get("cols") or []
        if not cols and not rows:
            return None

        columns = [
            col.get("display_name") or col.get("name") or f"Column {index + 1}"
            for index, col in enumerate(cols)
        ]
        card = dashboard_card.get("card") or {}
        name = (
            dashboard_card.get("visualization_settings", {}).get("card.title")
            or card.get("name")
            or dashboard_card.get("name")
            or f"Card {card_id}"
        )

        return MetabaseTable(
            name=name,
            columns=columns,
            rows=rows,
            visualization_settings=card.get("visualization_settings") or {},
            display=card.get("display"),
        )

    def _card_id(self, dashboard_card: Dict[str, Any]) -> Optional[int]:
        if dashboard_card.get("card_id"):
            return dashboard_card["card_id"]
        card = dashboard_card.get("card") or {}
        return card.get("id")

    def _extract_emails(self, payload: Any) -> List[str]:
        emails = set()

        def visit(value: Any) -> None:
            if isinstance(value, dict):
                for key, child in value.items():
                    if key in {"email", "email_address"} and isinstance(child, str):
                        if EMAIL_PATTERN.match(child):
                            emails.add(child)
                    else:
                        visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)

        visit(payload)
        return sorted(emails)


class CreditMarketReportBuilder:
    """Builds the email payload pieces for the monthly credit market report."""

    def build_workbook(self, report: MetabaseDashboardReport) -> bytes:
        workbook = Workbook()
        workbook.remove(workbook.active)
        workbook_tables = self._workbook_tables(report)

        for index, table in enumerate(workbook_tables, start=1):
            workbook_table = self._workbook_table(table)
            sheet = workbook.create_sheet(self._sheet_title(workbook_table.name, index))
            self._write_table_sheet(sheet, workbook_table)

        if not workbook_tables:
            sheet = workbook.create_sheet("No data")
            sheet["A1"] = (
                "No annual, monthly, or quarterly report data was returned from Metabase."
            )

        output = io.BytesIO()
        workbook.save(output)
        return output.getvalue()

    def build_attachment(self, report: MetabaseDashboardReport) -> Dict[str, Any]:
        workbook = self.build_workbook(report)
        generated_date = datetime.now().strftime("%Y-%m-%d")
        return {
            "filename": f"credit-market-report-{generated_date}.xlsx",
            "contentType": EXCEL_CONTENT_TYPE,
            "encoding": "base64",
            "content": base64.b64encode(workbook).decode("ascii"),
        }

    def build_email_context(self, report: MetabaseDashboardReport) -> Dict[str, Any]:
        now = datetime.now()
        sections = self._dashboard_sections(report)
        return {
            "environment": settings.environment.lower(),
            "subject": f"{report.dashboard_name} - Monthly Credit Market Report",
            "dashboard_name": report.dashboard_name,
            "dashboard_description": report.dashboard_description,
            "generated_at": f"{now.strftime('%B')} {now.day}, {now.year}",
            "metric_cards": sections["metric_cards"],
            "summary_cards": sections["summary_cards"],
            "chart_sections": sections["chart_sections"],
            "attached_table_names": [
                table.name for table in self._workbook_tables(report)
            ],
        }

    def _write_table_sheet(self, sheet, table: MetabaseTable) -> None:
        header_fill = PatternFill("solid", fgColor="003366")
        header_font = Font(color="FFFFFF", bold=True)
        border = Border(bottom=Side(style="thin", color="B7C9D6"))

        for column_index, column_name in enumerate(table.columns, start=1):
            cell = sheet.cell(
                row=1,
                column=column_index,
                value=self._display_column_name(column_name),
            )
            cell.fill = header_fill
            cell.font = header_font
            cell.border = border

        for row_index, row in enumerate(table.rows, start=2):
            for column_index, value in enumerate(row, start=1):
                sheet.cell(
                    row=row_index,
                    column=column_index,
                    value=self._excel_value(
                        value,
                        table_name=table.name,
                        column_name=(
                            table.columns[column_index - 1]
                            if len(table.columns) >= column_index
                            else ""
                        ),
                    ),
                )

        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        self._size_columns(
            sheet,
            [self._display_column_name(column) for column in table.columns],
            table.rows,
        )

    def _size_columns(self, sheet, columns: List[str], rows: List[List[Any]]) -> None:
        for index, header in enumerate(columns, start=1):
            values = [header] + [
                (
                    ""
                    if len(row) < index or row[index - 1] is None
                    else str(row[index - 1])
                )
                for row in rows[:100]
            ]
            width = min(max(len(value) for value in values) + 2, 60)
            sheet.column_dimensions[get_column_letter(index)].width = width

    def _sheet_title(self, name: str, index: int) -> str:
        title = INVALID_SHEET_TITLE_CHARS.sub(" ", name).strip() or f"Table {index}"
        return title[:31]

    def _excel_value(
        self, value: Any, table_name: str = "", column_name: str = ""
    ) -> Any:
        if isinstance(value, (dict, list)):
            return json.dumps(value, default=str)
        month = self._parse_month(value)
        lower_table = table_name.lower()
        lower_column = column_name.lower()
        if month and "calculated effective date" in lower_column:
            if "annual" in lower_table and "year" in lower_column:
                return month.year
            if "quarter" in lower_table and "quarter" in lower_column:
                quarter = ((month.month - 1) // 3) + 1
                return f"Q{quarter}, {month.year}"
        if month:
            return self._month_label(month, value)
        return value

    def _workbook_tables(self, report: MetabaseDashboardReport) -> List[MetabaseTable]:
        tables = [
            table
            for table in report.tables
            if any(
                keyword in table.name.lower() for keyword in WORKBOOK_REPORT_KEYWORDS
            )
        ]
        return sorted(tables, key=self._workbook_table_order)

    def _workbook_table_order(self, table: MetabaseTable) -> int:
        lower_name = table.name.lower()
        if "monthly" in lower_name or "month" in lower_name:
            return 0
        if "quarter" in lower_name:
            return 1
        if "annual" in lower_name:
            return 2
        return 3

    def _workbook_table(self, table: MetabaseTable) -> MetabaseTable:
        if not self._is_monthly_report_table(table):
            return table

        order = self._monthly_workbook_column_order(table.columns)
        return MetabaseTable(
            name=table.name,
            columns=[
                self._display_column_name(table.columns[index]) for index in order
            ],
            rows=[
                [row[index] if len(row) > index else None for index in order]
                for row in table.rows
            ],
            visualization_settings=table.visualization_settings,
            display=table.display,
        )

    def _monthly_workbook_column_order(self, columns: List[str]) -> List[int]:
        indexed_columns = list(enumerate(columns))
        a1_indexes = [
            index
            for index, column in indexed_columns
            if self._is_category_a1_column(column)
        ]
        non_a1_indexes = [
            index
            for index, column in indexed_columns
            if not self._is_category_a1_column(column)
        ]
        front = non_a1_indexes[:6]
        back = non_a1_indexes[6:]
        return front + a1_indexes + back

    def _is_category_a1_column(self, column: str) -> bool:
        normalized = column.lower().replace(" ", "")
        return "categorya1" in normalized

    def _dashboard_sections(
        self, report: MetabaseDashboardReport
    ) -> Dict[str, List[Dict[str, Any]]]:
        metric_cards = self._monthly_metric_cards(report)
        summary_cards = []
        chart_sections = []

        for table in report.tables:
            table_context = self._table_context(table)
            lower_name = table.name.lower()
            if metric_cards and self._is_monthly_report_table(table):
                continue
            if "monthly price" in lower_name or "all time" in lower_name:
                summary_cards.append(table_context)
            elif not metric_cards and self._is_metric_card(table):
                metric_cards.append(self._metric_context(table))
            elif "trend" in lower_name or "volume" in lower_name:
                chart_sections.append(table_context)

        if not metric_cards:
            metric_cards = [
                self._metric_context(table)
                for table in report.tables
                if self._is_compact_table(table)
            ][:3]

        shown_names = {
            section["name"] for section in metric_cards + summary_cards + chart_sections
        }
        remaining_tables = [
            self._table_context(table)
            for table in report.tables
            if table.name not in shown_names and table.rows
        ]
        chart_sections.extend(remaining_tables[:2])

        return {
            "metric_cards": metric_cards[:3],
            "summary_cards": summary_cards[:2],
            "chart_sections": chart_sections[:2],
        }

    def _monthly_metric_cards(
        self, report: MetabaseDashboardReport
    ) -> List[Dict[str, Any]]:
        monthly_table = next(
            (
                table
                for table in report.tables
                if self._is_monthly_report_table(table) and table.rows
            ),
            None,
        )
        if not monthly_table:
            return []

        current_row = monthly_table.rows[0]
        month_index = self._column_index(monthly_table, ["month"])
        if month_index is None or len(current_row) <= month_index:
            return []

        current_month = self._parse_month(current_row[month_index])
        previous_year_row = self._same_month_previous_year_row(
            monthly_table, current_month, month_index
        )
        current_label = self._month_label(current_month, current_row[month_index])
        previous_label = self._previous_year_label(current_month)

        metric_specs = [
            {
                "name": "Transfers (Number)",
                "columns": ["transfers (#)", "transfers", "sum of quantity"],
                "currency": False,
            },
            {
                "name": "Total Volume (Credits)",
                "columns": ["volume (credits)", "credit volume", "count"],
                "currency": False,
            },
            {
                "name": "Category A1 Transfers (weighted average)",
                "columns": [
                    "category a1 - average price",
                    "category a - average price",
                    "weighted average price",
                    "weighted average",
                ],
                "currency": True,
            },
        ]

        cards = []
        for spec in metric_specs:
            column_index = self._column_index(monthly_table, spec["columns"])
            if column_index is None or len(current_row) <= column_index:
                continue

            current_value = current_row[column_index]
            previous_value = (
                previous_year_row[column_index]
                if previous_year_row and len(previous_year_row) > column_index
                else None
            )
            current_number = self._numeric_value(current_value)
            previous_number = self._numeric_value(previous_value)
            comparison = ""
            direction = "neutral"
            if current_number is not None and previous_number not in (None, Decimal(0)):
                change = ((current_number - previous_number) / previous_number) * 100
                direction = "up" if change >= 0 else "down"
                comparison = (
                    f"{self._format_percentage(abs(change))} vs. {previous_label}: "
                    f"{self._format_metric_value(previous_value, spec['currency'])}"
                )

            cards.append(
                {
                    "name": spec["name"],
                    "primary": self._format_metric_value(
                        current_value, spec["currency"]
                    ),
                    "subtitle": current_label,
                    "comparison": comparison,
                    "direction": direction,
                }
            )

        return cards

    def _metric_context(self, table: MetabaseTable) -> Dict[str, Any]:
        values = self._flatten_values(table.rows)
        primary = self._format_value(values[0]) if values else "No data"
        subtitle = self._format_value(values[1]) if len(values) > 1 else ""
        comparison = self._format_value(values[2]) if len(values) > 2 else ""
        direction = "neutral"
        if "-" in comparison or "down" in comparison.lower():
            direction = "down"
        elif comparison:
            direction = "up"

        return {
            "name": table.name,
            "primary": primary,
            "subtitle": subtitle,
            "comparison": comparison,
            "direction": direction,
        }

    def _table_context(self, table: MetabaseTable) -> Dict[str, Any]:
        rows = self._table_rows(table)
        return {
            "name": table.name,
            "columns": (
                ["Metric", "Value"]
                if self._is_single_row_summary(table)
                else [self._display_column_name(column) for column in table.columns]
            ),
            "rows": rows,
            "row_count": len(table.rows),
            "image_data_uri": self._chart_image_data_uri(table),
        }

    def _is_metric_card(self, table: MetabaseTable) -> bool:
        lower_name = table.name.lower()
        if any(
            keyword in lower_name
            for keyword in ("transfers (number)", "total volume", "category a1")
        ):
            return True
        return table.display in {"scalar", "smartscalar"} or self._is_compact_table(
            table
        )

    def _is_compact_table(self, table: MetabaseTable) -> bool:
        return len(table.rows) <= 2 and len(table.columns) <= 4

    def _is_monthly_report_table(self, table: MetabaseTable) -> bool:
        lower_name = table.name.lower()
        return "monthly" in lower_name and (
            "report" in lower_name or "market" in lower_name
        )

    def _is_single_row_summary(self, table: MetabaseTable) -> bool:
        return len(table.rows) == 1 and len(table.columns) > 1

    def _table_rows(self, table: MetabaseTable) -> List[List[str]]:
        if self._is_single_row_summary(table):
            row = table.rows[0]
            return [
                [
                    self._display_column_name(column),
                    (
                        self._format_summary_value(column, row[index])
                        if len(row) > index
                        else ""
                    ),
                ]
                for index, column in enumerate(table.columns)
            ]
        return [[self._format_value(value) for value in row] for row in table.rows[:8]]

    def _format_summary_value(self, column: str, value: Any) -> str:
        lower_column = column.lower()
        if (
            "price" in lower_column
            or "ca$" in lower_column
            or "cad" in lower_column
            or "transfer value" in lower_column
        ):
            return self._format_metric_value(value, currency=True)
        return self._format_value(value)

    def _display_column_name(self, column: str) -> str:
        normalized = re.sub(r"\s+", " ", str(column)).strip().lower()
        if normalized == "sum of quantity":
            return "Volume (Credits)"
        if normalized == "count":
            return "Transfers (Number)"
        return str(column)

    def _flatten_values(self, rows: List[List[Any]]) -> List[Any]:
        return [value for row in rows for value in row if value not in (None, "")]

    def _format_value(self, value: Any) -> str:
        month = self._parse_month(value)
        if month:
            return self._month_label(month, value)
        if isinstance(value, float):
            return f"{value:,.2f}"
        if isinstance(value, int):
            return f"{value:,}"
        return "" if value is None else str(value)

    def _column_index(
        self, table: MetabaseTable, column_names: List[str]
    ) -> Optional[int]:
        normalized_targets = [name.lower() for name in column_names]
        normalized_columns = [column.lower() for column in table.columns]
        for target in normalized_targets:
            for index, normalized_column in enumerate(normalized_columns):
                if target in normalized_column:
                    return index
        return None

    def _parse_month(self, value: Any) -> Optional[datetime]:
        if isinstance(value, datetime):
            return value
        text = str(value).strip()
        iso_text = text.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(iso_text)
        except ValueError:
            pass
        for date_format in ("%B, %Y", "%B %Y", "%b, %Y", "%b %Y", "%Y-%m", "%Y-%m-%d"):
            try:
                return datetime.strptime(text, date_format)
            except ValueError:
                continue
        return None

    def _same_month_previous_year_row(
        self,
        table: MetabaseTable,
        current_month: Optional[datetime],
        month_index: int,
    ) -> Optional[List[Any]]:
        if not current_month:
            return None
        for row in table.rows[1:]:
            if len(row) <= month_index:
                continue
            row_month = self._parse_month(row[month_index])
            if (
                row_month
                and row_month.year == current_month.year - 1
                and row_month.month == current_month.month
            ):
                return row
        return None

    def _month_label(self, month: Optional[datetime], fallback: Any) -> str:
        if not month:
            return self._format_value(fallback)
        return f"{month.strftime('%b')} {month.year}"

    def _previous_year_label(self, month: Optional[datetime]) -> str:
        if not month:
            return "previous year"
        return f"{month.strftime('%b')} {month.year - 1}"

    def _numeric_value(self, value: Any) -> Optional[Decimal]:
        if value is None:
            return None
        text = str(value).strip().replace(",", "")
        multiplier = Decimal(1)
        if text.lower().endswith("k"):
            multiplier = Decimal(1000)
            text = text[:-1]
        text = re.sub(r"[^0-9.\-]", "", text)
        if text in {"", "-", "."}:
            return None
        try:
            return Decimal(text) * multiplier
        except InvalidOperation:
            return None

    def _format_metric_value(self, value: Any, currency: bool) -> str:
        numeric_value = self._numeric_value(value)
        if numeric_value is None:
            return self._format_value(value)
        if currency:
            return f"CA${numeric_value:,.2f}"
        if numeric_value == numeric_value.to_integral():
            return f"{int(numeric_value):,}"
        return f"{numeric_value:,.2f}"

    def _format_percentage(self, value: Decimal) -> str:
        text = f"{value:.2f}".rstrip("0").rstrip(".")
        return f"{text}%"

    def _chart_image_data_uri(self, table: MetabaseTable) -> Optional[str]:
        lower_name = table.name.lower()
        if "trend" not in lower_name and "volume" not in lower_name:
            return None

        chart = SimplePngChart()
        image = (
            chart.render_bar_chart(table)
            if "volume" in lower_name
            else chart.render_line_chart(table)
        )
        if not image:
            return None
        encoded = base64.b64encode(image).decode("ascii")
        return f"data:image/png;base64,{encoded}"


class SimplePngChart:
    """Dependency-free PNG chart renderer for email-safe chart images."""

    width = 980
    height = 320
    margin_left = 56
    margin_right = 28
    margin_top = 52
    margin_bottom = 36
    bg = (255, 255, 255)
    axis = (213, 218, 226)
    grid = (232, 235, 240)
    line_colors = [(166, 133, 203), (247, 159, 92), (247, 204, 67)]
    bar_color = (93, 154, 222)
    font = {
        " ": ["000", "000", "000", "000", "000"],
        "$": ["010", "111", "110", "011", "111"],
        ".": ["0", "0", "0", "0", "1"],
        ",": ["0", "0", "0", "1", "1"],
        "-": ["000", "000", "111", "000", "000"],
        "0": ["111", "101", "101", "101", "111"],
        "1": ["010", "110", "010", "010", "111"],
        "2": ["111", "001", "111", "100", "111"],
        "3": ["111", "001", "111", "001", "111"],
        "4": ["101", "101", "111", "001", "001"],
        "5": ["111", "100", "111", "001", "111"],
        "6": ["111", "100", "111", "101", "111"],
        "7": ["111", "001", "001", "010", "010"],
        "8": ["111", "101", "111", "101", "111"],
        "9": ["111", "101", "111", "001", "111"],
        "A": ["010", "101", "111", "101", "101"],
        "B": ["110", "101", "110", "101", "110"],
        "C": ["111", "100", "100", "100", "111"],
        "D": ["110", "101", "101", "101", "110"],
        "E": ["111", "100", "110", "100", "111"],
        "F": ["111", "100", "110", "100", "100"],
        "G": ["111", "100", "101", "101", "111"],
        "H": ["101", "101", "111", "101", "101"],
        "I": ["111", "010", "010", "010", "111"],
        "J": ["001", "001", "001", "101", "111"],
        "K": ["101", "101", "110", "101", "101"],
        "L": ["100", "100", "100", "100", "111"],
        "M": ["101", "111", "111", "101", "101"],
        "N": ["101", "111", "111", "111", "101"],
        "O": ["111", "101", "101", "101", "111"],
        "P": ["111", "101", "111", "100", "100"],
        "Q": ["111", "101", "101", "111", "001"],
        "R": ["110", "101", "110", "101", "101"],
        "S": ["111", "100", "111", "001", "111"],
        "T": ["111", "010", "010", "010", "010"],
        "U": ["101", "101", "101", "101", "111"],
        "V": ["101", "101", "101", "101", "010"],
        "W": ["101", "101", "111", "111", "101"],
        "X": ["101", "101", "010", "101", "101"],
        "Y": ["101", "101", "010", "010", "010"],
        "Z": ["111", "001", "010", "100", "111"],
    }

    def render_line_chart(self, table: MetabaseTable) -> Optional[bytes]:
        series = self._series(table)
        if not series:
            return None
        if Image is not None:
            return self._render_line_chart_with_pillow(table, series)

        canvas = self._canvas()
        self._draw_grid(canvas)
        self._draw_legend_canvas(
            canvas, self._series_names(table)[:3], chart_type="line"
        )
        for index, values in enumerate(series[:3]):
            points = self._points(values)
            color = self.line_colors[index % len(self.line_colors)]
            for start, end in zip(points, points[1:]):
                self._line(canvas, start, end, color)
            for point_index, point in enumerate(points):
                self._circle(canvas, point[0], point[1], 4, color)
                if self._should_label_point(point_index, len(points)):
                    self._draw_centered_text_canvas(
                        canvas,
                        self._format_chart_number(values[point_index], currency=True),
                        point[0],
                        max(self.margin_top - 2, point[1] - 14),
                        color,
                    )
        self._draw_x_labels_canvas(canvas, self._labels(table))
        return self._png(canvas)

    def render_bar_chart(self, table: MetabaseTable) -> Optional[bytes]:
        series = self._series(table)
        if not series:
            return None
        if Image is not None:
            return self._render_bar_chart_with_pillow(table, series)

        values = series[0]
        max_value = max(values) if values else 0
        if max_value <= 0:
            return None

        canvas = self._canvas()
        self._draw_grid(canvas)
        self._draw_legend_canvas(
            canvas, self._series_names(table)[:1], chart_type="bar"
        )
        chart_width = self.width - self.margin_left - self.margin_right
        usable_height = self.height - self.margin_top - self.margin_bottom
        step = chart_width / max(len(values), 1)
        bar_width = max(2, int(step * 0.58))
        base_y = self.height - self.margin_bottom
        labeled_bar_indexes = self._bar_label_indexes(values)
        for index, value in enumerate(values):
            x = int(self.margin_left + index * step + (step - bar_width) / 2)
            bar_height = int((value / max_value) * usable_height)
            top_y = base_y - bar_height
            self._rect(canvas, x, top_y, x + bar_width, base_y)
            if index in labeled_bar_indexes:
                self._draw_centered_text_canvas(
                    canvas,
                    self._format_chart_number(value, currency=False),
                    x + int(bar_width / 2),
                    max(self.margin_top - 2, top_y - 12),
                    (76, 87, 115),
                )
        self._draw_x_labels_canvas(canvas, self._labels(table))
        return self._png(canvas)

    def _render_line_chart_with_pillow(
        self, table: MetabaseTable, series: List[List[float]]
    ) -> bytes:
        image = Image.new("RGB", (self.width, self.height), self.bg)
        draw = ImageDraw.Draw(image)
        font = self._font(12)
        small_font = self._font(10)
        self._draw_grid_pillow(draw)
        self._draw_legend_pillow(
            draw, self._series_names(table)[:3], chart_type="line", font=small_font
        )

        values_for_scale = [value for values in series[:3] for value in values]
        min_value = min(values_for_scale)
        max_value = max(values_for_scale)
        if max_value == min_value:
            max_value += 1

        for index, values in enumerate(series[:3]):
            color = self.line_colors[index % len(self.line_colors)]
            points = self._scaled_points(values, min_value, max_value)
            for start, end in zip(points, points[1:]):
                draw.line([start, end], fill=color, width=3)
            for point_index, point in enumerate(points):
                draw.ellipse(
                    (point[0] - 4, point[1] - 4, point[0] + 4, point[1] + 4),
                    fill=color,
                    outline=(255, 255, 255),
                )
                if self._should_label_point(point_index, len(points)):
                    self._draw_centered_text(
                        draw,
                        self._format_chart_number(values[point_index], currency=True),
                        point[0],
                        max(self.margin_top - 2, point[1] - 18),
                        font,
                        color,
                    )

        self._draw_x_labels(draw, self._labels(table), small_font)
        return self._image_png(image)

    def _render_bar_chart_with_pillow(
        self, table: MetabaseTable, series: List[List[float]]
    ) -> bytes:
        values = series[0]
        max_value = max(values) if values else 0
        if max_value <= 0:
            return self._image_png(Image.new("RGB", (self.width, self.height), self.bg))

        image = Image.new("RGB", (self.width, self.height), self.bg)
        draw = ImageDraw.Draw(image)
        font = self._font(11)
        small_font = self._font(10)
        self._draw_grid_pillow(draw)
        self._draw_legend_pillow(
            draw, self._series_names(table)[:1], chart_type="bar", font=small_font
        )

        chart_width = self.width - self.margin_left - self.margin_right
        usable_height = self.height - self.margin_top - self.margin_bottom
        step = chart_width / max(len(values), 1)
        bar_width = max(2, int(step * 0.58))
        base_y = self.height - self.margin_bottom
        labeled_bar_indexes = self._bar_label_indexes(values)

        for index, value in enumerate(values):
            x = int(self.margin_left + index * step + (step - bar_width) / 2)
            bar_height = int((value / max_value) * usable_height)
            top_y = base_y - bar_height
            draw.rectangle(
                (x, top_y, x + bar_width, base_y),
                fill=self.bar_color,
                outline=self.bar_color,
            )
            if index in labeled_bar_indexes:
                self._draw_centered_text(
                    draw,
                    self._format_chart_number(value, currency=False),
                    x + int(bar_width / 2),
                    max(self.margin_top - 2, top_y - 16),
                    font,
                    (76, 87, 115),
                )

        self._draw_x_labels(draw, self._labels(table), small_font)
        return self._image_png(image)

    def _draw_grid_pillow(self, draw) -> None:
        left = self.margin_left
        right = self.width - self.margin_right
        top = self.margin_top
        bottom = self.height - self.margin_bottom
        for index in range(6):
            y = top + int(((bottom - top) / 5) * index)
            draw.line((left, y, right, y), fill=self.grid, width=1)
        draw.line((left, bottom, right, bottom), fill=self.axis, width=1)
        draw.line((left, top, left, bottom), fill=self.axis, width=1)

    def _draw_legend_pillow(
        self, draw, names: List[str], chart_type: str, font
    ) -> None:
        x = self.margin_left
        y = 16
        for index, name in enumerate(names):
            color = (
                self.bar_color
                if chart_type == "bar"
                else self.line_colors[index % len(self.line_colors)]
            )
            if chart_type == "bar":
                draw.rectangle((x, y + 3, x + 12, y + 13), fill=color, outline=color)
            else:
                draw.line((x, y + 8, x + 16, y + 8), fill=color, width=3)
                draw.ellipse((x + 6, y + 4, x + 12, y + 10), fill=color)
            label = self._legend_label(name)
            draw.text((x + 22, y), label, fill=(76, 87, 115), font=font)
            x += 22 + self._estimate_text_width(label)

    def _scaled_points(
        self, values: List[float], min_value: float, max_value: float
    ) -> List[Tuple[int, int]]:
        chart_width = self.width - self.margin_left - self.margin_right
        usable_height = self.height - self.margin_top - self.margin_bottom
        points = []
        for index, value in enumerate(values):
            x = self.margin_left + int((index / max(len(values) - 1, 1)) * chart_width)
            y = self.margin_top + int(
                (1 - ((value - min_value) / (max_value - min_value))) * usable_height
            )
            points.append((x, y))
        return points

    def _labels(self, table: MetabaseTable) -> List[str]:
        label_index = 0
        for index, column in enumerate(table.columns):
            if any(
                keyword in column.lower()
                for keyword in ("date", "month", "year", "period")
            ):
                label_index = index
                break
        return [
            self._format_chart_label(row[label_index])
            for row in table.rows
            if len(row) > label_index
        ]

    def _format_chart_label(self, value: Any) -> str:
        if isinstance(value, datetime):
            return f"{value.strftime('%b')} {value.year}"
        text = str(value).strip()
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            return f"{parsed.strftime('%b')} {parsed.year}"
        except ValueError:
            pass
        for date_format in ("%B, %Y", "%B %Y", "%b, %Y", "%b %Y", "%Y-%m", "%Y-%m-%d"):
            try:
                parsed = datetime.strptime(text, date_format)
                return f"{parsed.strftime('%b')} {parsed.year}"
            except ValueError:
                continue
        return text

    def _series_names(self, table: MetabaseTable) -> List[str]:
        names = []
        for column_index, column in enumerate(table.columns):
            column_name = column.lower()
            if any(
                keyword in column_name
                for keyword in ("date", "month", "year", "period")
            ):
                continue
            values = []
            for row in table.rows:
                if len(row) <= column_index:
                    continue
                parsed = self._number(row[column_index])
                if parsed is not None:
                    values.append(parsed)
            if len(values) < 2:
                continue
            names.append(self._display_column_name(column))
        return names

    def _display_column_name(self, column: str) -> str:
        normalized = re.sub(r"\s+", " ", str(column)).strip().lower()
        if normalized == "sum of quantity":
            return "Transfers"
        if normalized == "count":
            return "Volume (Credits)"
        return str(column)

    def _legend_label(self, name: str) -> str:
        label = re.sub(r"\s+", " ", str(name)).strip()
        if len(label) > 28:
            label = f"{label[:25]}..."
        return label

    def _estimate_text_width(self, text: str) -> int:
        return max(24, len(text) * 7)

    def _draw_x_labels(self, draw, labels: List[str], font) -> None:
        if not labels:
            return
        chart_width = self.width - self.margin_left - self.margin_right
        indexes = self._x_label_indexes(len(labels))
        y = self.height - self.margin_bottom + 8
        for index in indexes:
            x = self.margin_left + int((index / max(len(labels) - 1, 1)) * chart_width)
            self._draw_centered_text(draw, labels[index], x, y, font, (76, 87, 115))

    def _x_label_indexes(self, count: int) -> List[int]:
        if count <= 6:
            return list(range(count))
        indexes = {0, count - 1}
        for step in range(1, 5):
            indexes.add(round((count - 1) * step / 5))
        return sorted(indexes)

    def _should_label_point(self, index: int, count: int) -> bool:
        if count <= 12:
            return True
        return index in self._x_label_indexes(count)

    def _bar_label_indexes(self, values: List[float]) -> set:
        if len(values) <= 24:
            return set(range(len(values)))
        top_indexes = sorted(
            range(len(values)), key=lambda index: values[index], reverse=True
        )[:12]
        return set(top_indexes + self._x_label_indexes(len(values)))

    def _format_chart_number(self, value: float, currency: bool) -> str:
        prefix = "CA$" if currency else ""
        absolute_value = abs(value)
        if absolute_value >= 1_000_000:
            return f"{prefix}{value / 1_000_000:.1f}M"
        if absolute_value >= 1_000:
            return f"{prefix}{value / 1_000:.1f}k"
        if currency:
            return f"{prefix}{value:,.0f}"
        if value == int(value):
            return f"{int(value):,}"
        return f"{value:,.1f}"

    def _draw_centered_text(self, draw, text: str, x: int, y: int, font, fill) -> None:
        bbox = draw.textbbox((0, 0), text, font=font)
        width = bbox[2] - bbox[0]
        draw.text((x - int(width / 2), y), text, fill=fill, font=font)

    def _draw_x_labels_canvas(
        self, canvas: List[List[Tuple[int, int, int]]], labels: List[str]
    ) -> None:
        if not labels:
            return
        chart_width = self.width - self.margin_left - self.margin_right
        indexes = self._x_label_indexes(len(labels))
        y = self.height - self.margin_bottom + 8
        for index in indexes:
            x = self.margin_left + int((index / max(len(labels) - 1, 1)) * chart_width)
            self._draw_centered_text_canvas(canvas, labels[index], x, y, (76, 87, 115))

    def _draw_legend_canvas(
        self,
        canvas: List[List[Tuple[int, int, int]]],
        names: List[str],
        chart_type: str,
    ) -> None:
        x = self.margin_left
        y = 16
        for index, name in enumerate(names):
            color = (
                self.bar_color
                if chart_type == "bar"
                else self.line_colors[index % len(self.line_colors)]
            )
            if chart_type == "bar":
                self._rect(canvas, x, y + 2, x + 12, y + 12)
            else:
                self._line(canvas, (x, y + 7), (x + 16, y + 7), color)
                self._circle(canvas, x + 8, y + 7, 3, color)
            label = self._legend_label(name)
            self._draw_text_canvas(canvas, label, x + 22, y + 2, (76, 87, 115))
            x += 22 + self._text_width(label) + 16

    def _draw_centered_text_canvas(
        self,
        canvas: List[List[Tuple[int, int, int]]],
        text: str,
        x: int,
        y: int,
        color: Tuple[int, int, int],
    ) -> None:
        text = text.upper()
        width = self._text_width(text)
        self._draw_text_canvas(canvas, text, x - int(width / 2), y, color)

    def _draw_text_canvas(
        self,
        canvas: List[List[Tuple[int, int, int]]],
        text: str,
        x: int,
        y: int,
        color: Tuple[int, int, int],
    ) -> None:
        cursor = x
        for char in text.upper():
            glyph = self.font.get(char, self.font[" "])
            for row_index, row in enumerate(glyph):
                for column_index, pixel in enumerate(row):
                    if pixel == "1":
                        self._set_pixel(
                            canvas, cursor + column_index, y + row_index, color
                        )
            cursor += len(glyph[0]) + 1

    def _text_width(self, text: str) -> int:
        width = 0
        for char in text.upper():
            glyph = self.font.get(char, self.font[" "])
            width += len(glyph[0]) + 1
        return max(0, width - 1)

    def _font(self, size: int):
        try:
            return ImageFont.truetype("DejaVuSans.ttf", size)
        except Exception:
            return ImageFont.load_default()

    def _image_png(self, image) -> bytes:
        output = io.BytesIO()
        image.save(output, format="PNG")
        return output.getvalue()

    def _series(self, table: MetabaseTable) -> List[List[float]]:
        numeric_columns = []
        for column_index in range(len(table.columns)):
            column_name = table.columns[column_index].lower()
            if any(
                keyword in column_name
                for keyword in ("date", "month", "year", "period")
            ):
                continue
            values = []
            for row in table.rows:
                if len(row) <= column_index:
                    continue
                parsed = self._number(row[column_index])
                if parsed is not None:
                    values.append(parsed)
            if len(values) >= 2:
                numeric_columns.append(values)
        return numeric_columns

    def _number(self, value: Any) -> Optional[float]:
        if isinstance(value, (int, float)):
            return float(value)
        if value is None:
            return None
        text = str(value).strip().replace(",", "")
        multiplier = 1
        if text.lower().endswith("k"):
            multiplier = 1000
            text = text[:-1]
        text = re.sub(r"[^0-9.\-]", "", text)
        if text in {"", "-", "."}:
            return None
        try:
            return float(text) * multiplier
        except ValueError:
            return None

    def _points(self, values: List[float]) -> List[Tuple[int, int]]:
        chart_width = self.width - self.margin_left - self.margin_right
        usable_height = self.height - self.margin_top - self.margin_bottom
        min_value = min(values)
        max_value = max(values)
        if max_value == min_value:
            max_value += 1

        points = []
        for index, value in enumerate(values):
            x = self.margin_left + int((index / max(len(values) - 1, 1)) * chart_width)
            y = self.margin_top + int(
                (1 - ((value - min_value) / (max_value - min_value))) * usable_height
            )
            points.append((x, y))
        return points

    def _canvas(self) -> List[List[Tuple[int, int, int]]]:
        return [[self.bg for _ in range(self.width)] for _ in range(self.height)]

    def _draw_grid(self, canvas: List[List[Tuple[int, int, int]]]) -> None:
        left = self.margin_left
        right = self.width - self.margin_right
        top = self.margin_top
        bottom = self.height - self.margin_bottom
        for index in range(6):
            y = top + int(((bottom - top) / 5) * index)
            self._line(canvas, (left, y), (right, y), self.grid)
        self._line(canvas, (left, bottom), (right, bottom), self.axis)
        self._line(canvas, (left, top), (left, bottom), self.axis)

    def _rect(
        self,
        canvas: List[List[Tuple[int, int, int]]],
        x1: int,
        y1: int,
        x2: int,
        y2: int,
    ) -> None:
        for y in range(max(0, y1), min(self.height, y2)):
            for x in range(max(0, x1), min(self.width, x2)):
                canvas[y][x] = self.bar_color

    def _line(
        self,
        canvas: List[List[Tuple[int, int, int]]],
        start: Tuple[int, int],
        end: Tuple[int, int],
        color: Tuple[int, int, int],
    ) -> None:
        x1, y1 = start
        x2, y2 = end
        dx = abs(x2 - x1)
        dy = -abs(y2 - y1)
        sx = 1 if x1 < x2 else -1
        sy = 1 if y1 < y2 else -1
        error = dx + dy
        while True:
            self._set_pixel(canvas, x1, y1, color)
            self._set_pixel(canvas, x1 + 1, y1, color)
            self._set_pixel(canvas, x1, y1 + 1, color)
            if x1 == x2 and y1 == y2:
                break
            error2 = 2 * error
            if error2 >= dy:
                error += dy
                x1 += sx
            if error2 <= dx:
                error += dx
                y1 += sy

    def _circle(
        self,
        canvas: List[List[Tuple[int, int, int]]],
        cx: int,
        cy: int,
        radius: int,
        color: Tuple[int, int, int],
    ) -> None:
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius, cx + radius + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= radius**2:
                    self._set_pixel(canvas, x, y, color)

    def _set_pixel(
        self,
        canvas: List[List[Tuple[int, int, int]]],
        x: int,
        y: int,
        color: Tuple[int, int, int],
    ) -> None:
        if 0 <= x < self.width and 0 <= y < self.height:
            canvas[y][x] = color

    def _png(self, canvas: List[List[Tuple[int, int, int]]]) -> bytes:
        raw = bytearray()
        for row in canvas:
            raw.append(0)
            for red, green, blue in row:
                raw.extend((red, green, blue))
        compressed = zlib.compress(bytes(raw), level=9)

        def chunk(kind: bytes, data: bytes) -> bytes:
            checksum = zlib.crc32(kind + data) & 0xFFFFFFFF
            return (
                struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)
            )

        png = bytearray(b"\x89PNG\r\n\x1a\n")
        png.extend(
            chunk(
                b"IHDR",
                struct.pack(">IIBBBBB", self.width, self.height, 8, 2, 0, 0, 0),
            )
        )
        png.extend(chunk(b"IDAT", compressed))
        png.extend(chunk(b"IEND", b""))
        return bytes(png)


def configured_credit_market_report_recipients() -> List[str]:
    return [
        email.strip()
        for email in settings.credit_market_report_recipient_emails.split(",")
        if email.strip()
    ]
