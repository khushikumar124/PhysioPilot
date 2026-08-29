"""One-off deployment tasks, run against a remote database.

Serverless functions must not do schema work on every cold start, so this is
run deliberately - once after provisioning, and again after any change that
adds a column.

    PHYSIOPILOT_DATABASE_URL="postgres://..." python -m app.deploy --seed-demo
"""

import argparse

from .config import get_settings
from .database import Base, SessionLocal, engine, ensure_schema
from .seed import ensure_catalogue, seed_demo


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare a PhysioPilot database")
    parser.add_argument(
        "--seed-demo",
        action="store_true",
        help="Also create the demo clinic (skipped if any user already exists)",
    )
    args = parser.parse_args()

    settings = get_settings()
    # Never print the password.
    safe = settings.sqlalchemy_url.split("@")[-1]
    print(f"Target database: ...@{safe}")

    Base.metadata.create_all(bind=engine)
    print("  tables created or already present")

    ensure_schema()
    print("  column migrations applied")

    with SessionLocal() as db:
        ensure_catalogue(db)
        print("  exercise catalogue synced")

        if args.seed_demo:
            from sqlalchemy import select

            from .models import User

            if db.scalar(select(User).limit(1)) is None:
                seed_demo(db)
                print("  demo clinic seeded")
            else:
                print("  users already exist, demo seeding skipped")

    print("Done.")


if __name__ == "__main__":
    main()
