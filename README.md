# 경북대학교 약속 시간 조율 웹 서비스

## 1. 프로젝트 개요

대학생활에서 밥약속, 술약속, 팀 프로젝트, 멘토링 등 다양한 약속을 잡을 때 참여자별 일정을 일일이 확인해야 하는 불편함이 발생한다. 본 프로젝트는 참여자들이 가능한 시간을 30분 단위로 선택하면 공통 가능한 시간을 자동으로 계산하고, 약속 목적에 맞는 장소를 추천하는 웹 서비스이다.

## 2. 사용 기술

- Frontend: React, Vite
- Backend: Python, FastAPI
- Database: SQLite

## 3. 주요 기능

1. 약속 생성
2. 공유 코드 기반 약속 참여
3. 사용자별 30분 단위 가능 시간 입력
4. 사용자 시간 데이터 DB 저장
5. 공통 가능 시간 계산
6. 가능 인원 수 기반 추천 시간 TOP 5 제공
7. 약속 목적별 장소 추천

## 4. 실행 방법

### 백엔드 실행

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

백엔드 주소: http://localhost:8000

### 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

프론트엔드 주소: http://localhost:5173

## 5. API 요약

| 기능 | Method | URL |
|---|---|---|
| 약속 생성 | POST | /meetings |
| 약속 조회 | GET | /meetings/{share_code} |
| 시간 저장 | POST | /meetings/{share_code}/times |
| 시간 조회 | GET | /meetings/{share_code}/times |
| 공통 시간 계산 | GET | /meetings/{share_code}/common-times |
| 장소 추천 | GET | /meetings/{share_code}/places |

## 6. 데이터베이스 구조

- meetings: 약속명, 카테고리, 인원 수, 공유 코드 저장
- users: 약속별 참여자 저장
- time_slots: 사용자별 가능 시간 저장
- places: 약속 목적별 추천 장소 저장

## 7. 구현 내용과 주차 계획 연결

- 1주차: 30분 단위 시간 선택 및 공통 시간 계산 아이디어 반영
- 2주차: React, Python FastAPI, SQLite 기술 스택 적용
- 3주차: 프론트엔드-백엔드-DB 흐름 구성
- 4주차: Meeting, User, TimeSlot 테이블 및 API 구조 설계
- 5주차: 약속 생성 및 공유 코드 기능 구현
- 6주차: 사용자별 시간 저장/조회 기능 구현
- 7주차: 공통 가능 시간 계산 기능 구현
- 8주차: 가능 인원 수 기준 추천 시간 TOP 5 구현
- 9주차: 카테고리별 장소 추천 기능 구현
- 10주차: 전체 기능 통합 및 예외 처리 적용
