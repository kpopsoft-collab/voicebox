"""Tests for bulk deletion and idempotent deletion of generations."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, Generation as DBGeneration, VoiceProfile as DBVoiceProfile
from backend.services.history import delete_generations_bulk, delete_generation


@pytest.fixture
def test_db(tmp_path):
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    # Create profile
    profile = DBVoiceProfile(
        id="profile-1",
        name="테스트",
        language="ko",
    )
    db.add(profile)
    db.commit()

    yield db
    db.close()


@pytest.mark.asyncio
async def test_bulk_delete_generations(test_db):
    # Insert 10 generations
    gen_ids = []
    for i in range(10):
        gid = f"gen-{i}"
        gen_ids.append(gid)
        gen = DBGeneration(
            id=gid,
            profile_id="profile-1",
            text=f"Text {i}",
            language="ko",
            status="completed",
        )
        test_db.add(gen)
    test_db.commit()

    assert test_db.query(DBGeneration).count() == 10

    # Bulk delete 7 of them
    deleted_count = await delete_generations_bulk(gen_ids[:7], test_db)
    assert deleted_count == 7
    assert test_db.query(DBGeneration).count() == 3

    # Bulk delete remaining + non-existent IDs without error
    deleted_count2 = await delete_generations_bulk(gen_ids[7:] + ["non-existent-id"], test_db)
    assert deleted_count2 == 3
    assert test_db.query(DBGeneration).count() == 0


@pytest.mark.asyncio
async def test_idempotent_delete_generation(test_db):
    # Delete non-existent ID
    res = await delete_generation("unknown-id", test_db)
    assert res is False
