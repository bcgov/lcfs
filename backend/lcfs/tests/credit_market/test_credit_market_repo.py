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
