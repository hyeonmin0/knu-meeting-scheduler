"""
경북대학교 약속 시간 조율 웹 서비스 - 백엔드 서버
기술 스택: FastAPI + SQLite

주요 기능
1. 약속 생성
2. 공유 링크로 약속 조회
3. 사용자별 시간표 저장/조회
4. 공통 가능 시간 계산
5. 추천 시간 반환
6. 약속 목적별 장소 추천
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import sqlite3
import uuid
from pathlib import Path

DB_PATH = Path(__file__).parent / "meeting.db"

app = FastAPI(title="KNU Meeting Scheduler API")

# React 프론트엔드와 통신하기 위해 CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================
# 요청/응답 데이터 모델
# =============================

class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, description="약속 이름")
    category: str = Field(..., description="약속 목적: meal, drink, study, team, mentoring")
    max_people: int = Field(..., ge=1, description="참여 인원 수")


class MeetingResponse(BaseModel):
    id: int
    title: str
    category: str
    max_people: int
    share_code: str
    share_url: str


class TimeSlotInput(BaseModel):
    user_name: str = Field(..., min_length=1)
    # 예: ["MON-09:00", "MON-09:30", "TUE-13:00"]
    slots: List[str]


class PlaceResponse(BaseModel):
    name: str
    category: str
    distance: str
    description: str


# =============================
# DB 연결 및 초기화
# =============================

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    # 약속 정보 테이블
    cur.execute("""
    CREATE TABLE IF NOT EXISTS meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        max_people INTEGER NOT NULL,
        share_code TEXT UNIQUE NOT NULL
    )
    """)

    # 참여자 테이블
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        UNIQUE(meeting_id, user_name),
        FOREIGN KEY(meeting_id) REFERENCES meetings(id)
    )
    """)

    # 시간 데이터 테이블
    # 한 행은 한 사용자가 선택한 30분 단위 시간 하나를 의미함
    cur.execute("""
    CREATE TABLE IF NOT EXISTS time_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        slot TEXT NOT NULL,
        UNIQUE(meeting_id, user_id, slot),
        FOREIGN KEY(meeting_id) REFERENCES meetings(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)

    # 장소 데이터 테이블
    cur.execute("""
    CREATE TABLE IF NOT EXISTS places (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        distance TEXT NOT NULL,
        description TEXT NOT NULL
    )
    """)

    # 기본 장소 데이터가 없으면 삽입
    cur.execute("SELECT COUNT(*) AS count FROM places")
    if cur.fetchone()["count"] == 0:
        default_places = [
            ("뽀근닥", "meal", "쪽문에서 도보 3분", "찜닭 맛집"),
            ("동아리 분식", "meal", "쪽문에서 도보 4분", "쪽문의 가성비 맛집"),
            ("냉면당", "meal", "정문에서 도보 5분", "돈까스/냉면 맛집"),
            ("다이마루", "meal", "정문에서 도보 5분", "일식(덮밥, 라멘) 맛집"),
            ("초밥집", "meal", "쪽문에서 도보 4분", "초밥 맛집"),
            ("온새미로", "meal", "북문에서 도보 5분", "한식 맛집"),
            ("도톤", "meal", "북문에서 도보 6분", "돈까스 맛집"),
            ("도리집", "meal", "북문에서 도보 6분", "가성비 맛집"),
            ("북문 치킨호프", "drink", "도보 6분", "술약속과 간단한 안주 모임에 적합"),
            ("대학로 맥주집", "drink", "도보 8분", "여러 명이 모이기 좋은 술집"),
            ("스터디카페 복현점", "study", "도보 4분", "조용한 스터디와 멘토링에 적합"),
            ("중앙도서관", "study", "교내", "팀 프로젝트 회의와 공부에 적합"),
            ("카페 공대점", "team", "도보 3분", "팀플 회의와 노트북 작업에 적합"),
            ("복현동 조용한 카페", "mentoring", "도보 6분", "멘토링처럼 대화 중심 약속에 적합"),
        ]
        cur.executemany(
            "INSERT INTO places(name, category, distance, description) VALUES (?, ?, ?, ?)",
            default_places,
        )

    conn.commit()
    conn.close()


@app.on_event("startup")
def startup_event():
    init_db()


# =============================
# 유틸 함수
# =============================

def find_meeting_by_code(share_code: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM meetings WHERE share_code = ?", (share_code,))
    meeting = cur.fetchone()
    conn.close()
    return meeting


def get_or_create_user(conn, meeting_id: int, user_name: str) -> int:
    cur = conn.cursor()
    cur.execute(
        "INSERT OR IGNORE INTO users(meeting_id, user_name) VALUES (?, ?)",
        (meeting_id, user_name),
    )
    cur.execute(
        "SELECT id FROM users WHERE meeting_id = ? AND user_name = ?",
        (meeting_id, user_name),
    )
    return cur.fetchone()["id"]


def validate_slot(slot: str):
    # 간단한 형식 검증: MON-09:00 형태인지 확인
    days = {"MON", "TUE", "WED", "THU", "FRI"}
    try:
        day, time = slot.split("-")
        hour, minute = time.split(":")
        hour = int(hour)
        minute = int(minute)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"시간 형식 오류: {slot}")

    if day not in days or hour < 0 or hour > 23 or minute not in (0, 30):
        raise HTTPException(status_code=400, detail=f"지원하지 않는 시간 데이터: {slot}")


# =============================
# API 구현
# =============================

@app.get("/")
def root():
    return {"message": "KNU Meeting Scheduler API is running"}


@app.post("/meetings", response_model=MeetingResponse)
def create_meeting(data: MeetingCreate):
    """약속 생성 API"""
    share_code = uuid.uuid4().hex[:8]

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO meetings(title, category, max_people, share_code) VALUES (?, ?, ?, ?)",
        (data.title, data.category, data.max_people, share_code),
    )
    conn.commit()
    meeting_id = cur.lastrowid
    conn.close()

    return MeetingResponse(
        id=meeting_id,
        title=data.title,
        category=data.category,
        max_people=data.max_people,
        share_code=share_code,
        share_url=f"/meeting/{share_code}",
    )


@app.get("/meetings/{share_code}")
def get_meeting(share_code: str):
    """공유 코드로 약속 정보 조회"""
    meeting = find_meeting_by_code(share_code)
    if not meeting:
        raise HTTPException(status_code=404, detail="약속을 찾을 수 없습니다.")

    return dict(meeting)


@app.post("/meetings/{share_code}/times")
def save_user_times(share_code: str, data: TimeSlotInput):
    """사용자별 가능 시간 저장 API"""
    meeting = find_meeting_by_code(share_code)
    if not meeting:
        raise HTTPException(status_code=404, detail="약속을 찾을 수 없습니다.")

    for slot in data.slots:
        validate_slot(slot)

    conn = get_conn()
    cur = conn.cursor()

    user_id = get_or_create_user(conn, meeting["id"], data.user_name)

    # 기존 시간 데이터를 지운 뒤 새로 저장하여 수정 기능처럼 동작시킴
    cur.execute(
        "DELETE FROM time_slots WHERE meeting_id = ? AND user_id = ?",
        (meeting["id"], user_id),
    )

    for slot in data.slots:
        cur.execute(
            "INSERT INTO time_slots(meeting_id, user_id, slot) VALUES (?, ?, ?)",
            (meeting["id"], user_id, slot),
        )

    conn.commit()
    conn.close()

    return {
        "message": "시간 데이터가 저장되었습니다.",
        "user_name": data.user_name,
        "saved_count": len(data.slots),
    }


@app.get("/meetings/{share_code}/times")
def get_all_times(share_code: str):
    """약속에 참여한 사용자들의 시간 데이터 전체 조회"""
    meeting = find_meeting_by_code(share_code)
    if not meeting:
        raise HTTPException(status_code=404, detail="약속을 찾을 수 없습니다.")

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.user_name, t.slot
        FROM time_slots t
        JOIN users u ON t.user_id = u.id
        WHERE t.meeting_id = ?
        ORDER BY u.user_name, t.slot
    """, (meeting["id"],))
    rows = cur.fetchall()
    conn.close()

    result: Dict[str, List[str]] = {}
    for row in rows:
        result.setdefault(row["user_name"], []).append(row["slot"])

    return result


@app.get("/meetings/{share_code}/common-times")
def calculate_common_times(share_code: str):
    """공통 가능한 시간 계산 API"""
    meeting = find_meeting_by_code(share_code)
    if not meeting:
        raise HTTPException(status_code=404, detail="약속을 찾을 수 없습니다.")

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT slot, COUNT(*) AS available_count
        FROM time_slots
        WHERE meeting_id = ?
        GROUP BY slot
        ORDER BY available_count DESC, slot ASC
    """, (meeting["id"],))
    rows = cur.fetchall()

    cur.execute("SELECT COUNT(*) AS user_count FROM users WHERE meeting_id = ?", (meeting["id"],))
    user_count = cur.fetchone()["user_count"]
    conn.close()

    common_times = []
    recommended_times = []

    for row in rows:
        item = {
            "slot": row["slot"],
            "available_count": row["available_count"],
            "total_users": user_count,
            "score": f"{row['available_count']}/{user_count}",
        }
        if row["available_count"] == user_count and user_count > 0:
            common_times.append(item)
        recommended_times.append(item)

    return {
        "total_users": user_count,
        "perfect_common_times": common_times,
        "recommended_times": recommended_times[:5],
    }


@app.get("/meetings/{share_code}/places", response_model=List[PlaceResponse])
def recommend_places(share_code: str):
    """약속 카테고리에 맞는 장소 추천 API"""
    meeting = find_meeting_by_code(share_code)
    if not meeting:
        raise HTTPException(status_code=404, detail="약속을 찾을 수 없습니다.")

    category = meeting["category"]

    # 팀플과 멘토링은 카페/스터디 공간도 함께 추천되도록 보완
    category_map = {
        "meal": ["meal"],
        "drink": ["drink"],
        "study": ["study"],
        "team": ["team", "study"],
        "mentoring": ["mentoring", "study"],
    }
    categories = category_map.get(category, [category])

    placeholders = ",".join(["?"] * len(categories))
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        f"SELECT name, category, distance, description FROM places WHERE category IN ({placeholders}) LIMIT 5",
        categories,
    )
    rows = cur.fetchall()
    conn.close()

    return [PlaceResponse(**dict(row)) for row in rows]
