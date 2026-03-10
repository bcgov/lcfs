from pathlib import Path


def test_anonymize_sql_does_not_mutate_user_role_table():
    sql_path = Path(__file__).resolve().parents[4] / "etl" / "anonymize_nonprod.sql"
    sql_text = sql_path.read_text(encoding="utf-8").lower()

    assert "update user_role" not in sql_text
    assert "insert into user_role" not in sql_text
    assert "delete from user_role" not in sql_text
