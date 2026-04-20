from src.engine.database import AuditDatabase


class DummyCursor:
    def __init__(self, count):
        self.count = count
        self.closed = False

    def execute(self, query, params=None):
        self.last_query = query
        self.last_params = params

    def fetchone(self):
        return (self.count,)

    def close(self):
        self.closed = True


class DummyConnection:
    def __init__(self, cursor):
        self._cursor = cursor
        self.commit_called = False
        self.rollback_called = False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.commit_called = True

    def rollback(self):
        self.rollback_called = True


def test_seed_default_repositories_releases_connection_once_when_rows_exist(monkeypatch):
    cursor = DummyCursor(count=3)
    conn = DummyConnection(cursor)
    released = []

    monkeypatch.setattr(AuditDatabase, "get_connection", staticmethod(lambda: conn))
    monkeypatch.setattr(
        AuditDatabase,
        "release_connection",
        staticmethod(lambda connection: released.append(connection)),
    )

    AuditDatabase.seed_default_repositories()

    assert cursor.closed is True
    assert conn.commit_called is False
    assert conn.rollback_called is False
    assert released == [conn]
