class AuditState:
    """
    Global state container to track the status of ongoing code audits.
    """
    is_cancelled = False
    is_running = False
    logs = []

    @classmethod
    def reset(cls):
        cls.is_cancelled = False
        cls.is_running = False
        cls.logs.clear()

    @classmethod
    def cancel(cls):
        cls.is_cancelled = True

    @classmethod
    def log(cls, message: str):
        # Lưu log để SSE đẩy xuống Frontend
        cls.logs.append(message)
