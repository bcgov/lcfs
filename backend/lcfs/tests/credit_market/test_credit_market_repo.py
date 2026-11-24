import sqlite3
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from lcfs.web.api.credit_market.repo import CreditMarketRepository


@pytest.mark.anyio
async def test_report_all_time_excludes_category_d_and_zero_dollar_transfers():
    db = AsyncMock()
    db.execute.return_value = MagicMock(first=MagicMock(return_value=None))
    repo = CreditMarketRepository(db=db)

    await repo.get_report_all_time()

    statement = db.execute.await_args.args[0]
    query = str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )

    assert "NOT (EXISTS" in query
    assert "transfer_category.category = 'D'" in query
    assert "transfer.price_per_unit > 0" in query
    assert "transfer.quantity > 0" in query


@pytest.mark.anyio
async def test_agreement_months_include_late_recorded_transfers_and_exclude_missing_dates():
    connection = sqlite3.connect(":memory:")
    connection.create_function("date_trunc", 2, lambda _, value: value[:7] + "-01")
    connection.executescript("""
        CREATE TABLE transfer_status (transfer_status_id INTEGER, status TEXT);
        CREATE TABLE transfer_category (transfer_category_id INTEGER, category TEXT);
        CREATE TABLE transfer (
            transfer_id INTEGER, current_status_id INTEGER, transfer_category_id INTEGER,
            agreement_date TEXT, transaction_effective_date TEXT,
            price_per_unit NUMERIC, quantity INTEGER
        );
        INSERT INTO transfer_status VALUES (1, 'Recorded'), (2, 'Submitted');
        INSERT INTO transfer_category VALUES (1, 'A'), (2, 'B'), (3, 'D');
        INSERT INTO transfer VALUES
            (1, 2, 1, '2026-10-10', NULL, 100, 100),
            (2, 1, 2, '2026-10-28', '2026-10-29', 200, 300),
            (3, 1, 1, NULL, '2026-10-29', 500, 100),
            (4, 1, 3, '2026-10-20', '2026-10-29', 0, 100),
            (5, 1, 3, '2026-10-20', '2026-10-29', 100, 100);
        """)
    db = AsyncMock()

    async def execute(statement):
        sql = str(statement.compile(compile_kwargs={"literal_binds": True}))
        rows = connection.execute(sql).fetchall()
        return MagicMock(all=MagicMock(return_value=rows))

    db.execute.side_effect = execute
    repo = CreditMarketRepository(db=db)
    try:
        before = await repo.get_report_agreement_months()
        assert before[0][0:3] == ("2026-10-01", 1, 300)
        assert before[0][4] == 200

        connection.execute(
            "UPDATE transfer SET current_status_id = 1, "
            "transaction_effective_date = '2026-11-07' WHERE transfer_id = 1"
        )
        after = await repo.get_report_agreement_months()
        assert after[0][0:3] == ("2026-10-01", 2, 400)
        assert float(after[0][4]) == 175
    finally:
        connection.close()
