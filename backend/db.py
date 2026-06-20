import sqlite3
import tempfile
from pathlib import Path
from uuid import uuid4

DB_PATH = Path(__file__).with_name("tavi-assessment.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS work_orders (
    work_order_id TEXT PRIMARY KEY,
    location TEXT NOT NULL,
    date TEXT NOT NULL,
    budget REAL NOT NULL CHECK (budget >= 0),
    type TEXT NOT NULL,
    vendor_id TEXT,
    state TEXT NOT NULL DEFAULT 'CONTACTING_VENDORS'
        CHECK (state IN (
            'CONTACTING_VENDORS', 'AUCTIONING', 'VENDOR ASSIGNED',
            'SITE_VISIT', 'COMPLETE'
        )),
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vendors (
    vendor_id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    outreach_message TEXT NOT NULL,
    vendor_state TEXT NOT NULL DEFAULT 'AWAITING_RESPONSE'
        CHECK (vendor_state IN (
            'AWAITING_RESPONSE', 'NEGOTIATING', 'QUOTE_RECEIVED', 'SELECTED'
        )),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(work_order_id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS selected_vendor_belongs_to_work_order
BEFORE UPDATE OF vendor_id ON work_orders
WHEN NEW.vendor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM vendors
    WHERE vendor_id = NEW.vendor_id AND work_order_id = NEW.work_order_id
)
BEGIN
    SELECT RAISE(ABORT, 'selected vendor must belong to the work order');
END;
"""


def connect(db_path: str | Path = DB_PATH) -> sqlite3.Connection:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db(db_path: str | Path = DB_PATH) -> None:
    with connect(db_path) as connection:
        connection.executescript(SCHEMA)


def create_work_order(
    location: str,
    date: str,
    budget: float,
    type: str,
    *,
    db_path: str | Path = DB_PATH,
) -> dict:
    work_order_id = str(uuid4())
    with connect(db_path) as connection:
        connection.execute(
            """
            INSERT INTO work_orders (work_order_id, location, date, budget, type)
            VALUES (?, ?, ?, ?, ?)
            """,
            (work_order_id, location, date, budget, type),
        )
    return get_work_order(work_order_id, db_path=db_path)


def get_work_order(work_order_id: str, *, db_path: str | Path = DB_PATH) -> dict | None:
    with connect(db_path) as connection:
        row = connection.execute(
            "SELECT * FROM work_orders WHERE work_order_id = ?", (work_order_id,)
        ).fetchone()
    return dict(row) if row else None


def list_work_orders(*, db_path: str | Path = DB_PATH) -> list[dict]:
    with connect(db_path) as connection:
        rows = connection.execute("SELECT * FROM work_orders").fetchall()
    return [dict(row) for row in rows]


def update_work_order(
    work_order_id: str, *, db_path: str | Path = DB_PATH, **changes
) -> dict | None:
    allowed = {"location", "date", "budget", "type", "vendor_id", "state"}
    if not changes or not changes.keys() <= allowed:
        raise ValueError(f"fields must be from: {', '.join(sorted(allowed))}")
    assignments = ", ".join(f"{field} = ?" for field in changes)
    with connect(db_path) as connection:
        connection.execute(
            f"UPDATE work_orders SET {assignments} WHERE work_order_id = ?",
            (*changes.values(), work_order_id),
        )
    return get_work_order(work_order_id, db_path=db_path)


def delete_work_order(work_order_id: str, *, db_path: str | Path = DB_PATH) -> bool:
    with connect(db_path) as connection:
        cursor = connection.execute(
            "DELETE FROM work_orders WHERE work_order_id = ?", (work_order_id,)
        )
    return cursor.rowcount > 0


def create_vendor(
    work_order_id: str,
    name: str,
    price: float,
    outreach_message: str,
    vendor_state: str = "AWAITING_RESPONSE",
    *,
    db_path: str | Path = DB_PATH,
) -> dict:
    vendor_id = str(uuid4())
    with connect(db_path) as connection:
        connection.execute(
            """
            INSERT INTO vendors (
                vendor_id, work_order_id, name, price, outreach_message, vendor_state
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (vendor_id, work_order_id, name, price, outreach_message, vendor_state),
        )
    return get_vendor(vendor_id, db_path=db_path)


def get_vendor(vendor_id: str, *, db_path: str | Path = DB_PATH) -> dict | None:
    with connect(db_path) as connection:
        row = connection.execute(
            "SELECT * FROM vendors WHERE vendor_id = ?", (vendor_id,)
        ).fetchone()
    return dict(row) if row else None


def list_vendors(
    work_order_id: str | None = None, *, db_path: str | Path = DB_PATH
) -> list[dict]:
    query = "SELECT * FROM vendors"
    params = ()
    if work_order_id:
        query += " WHERE work_order_id = ?"
        params = (work_order_id,)
    with connect(db_path) as connection:
        rows = connection.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def update_vendor(
    vendor_id: str, *, db_path: str | Path = DB_PATH, **changes
) -> dict | None:
    allowed = {"name", "price", "outreach_message", "vendor_state"}
    if not changes or not changes.keys() <= allowed:
        raise ValueError(f"fields must be from: {', '.join(sorted(allowed))}")
    assignments = ", ".join(f"{field} = ?" for field in changes)
    with connect(db_path) as connection:
        connection.execute(
            f"UPDATE vendors SET {assignments} WHERE vendor_id = ?",
            (*changes.values(), vendor_id),
        )
    return get_vendor(vendor_id, db_path=db_path)


def delete_vendor(vendor_id: str, *, db_path: str | Path = DB_PATH) -> bool:
    with connect(db_path) as connection:
        cursor = connection.execute(
            "DELETE FROM vendors WHERE vendor_id = ?", (vendor_id,)
        )
    return cursor.rowcount > 0


def _self_check() -> None:
    with tempfile.NamedTemporaryFile(suffix=".db") as file:
        init_db(file.name)
        work_order = create_work_order(
            "712 S Forest Ave, Tempe AZ 85281",
            "2026-06-29",
            10_000,
            "HVAC",
            db_path=file.name,
        )
        vendor = create_vendor(
            work_order["work_order_id"],
            "Desert HVAC",
            8_500,
            "Can you quote this job?",
            db_path=file.name,
        )
        updated = update_work_order(
            work_order["work_order_id"],
            vendor_id=vendor["vendor_id"],
            state="VENDOR ASSIGNED",
            db_path=file.name,
        )
        assert updated and updated["vendor_id"] == vendor["vendor_id"]
        assert delete_work_order(work_order["work_order_id"], db_path=file.name)
        assert get_vendor(vendor["vendor_id"], db_path=file.name) is None


if __name__ == "__main__":
    init_db()
    _self_check()
    print(f"Ready: {DB_PATH}")
