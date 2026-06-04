import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API = "https://knu-meeting-scheduler.onrender.com";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 선택한 연도/월에 맞는 날짜 목록 생성
function getDaysInMonth(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const days = [];

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month - 1, day);
    const weekday = WEEKDAYS[date.getDay()];

    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const label = `${month}/${day}(${weekday})`;

    days.push([dateKey, label]);
  }

  return days;
}

// 09:00부터 24:00까지 30분 단위 시간 생성
const TIMES = [];
for (let h = 9; h <= 24; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`);
  if (h !== 24) {
    TIMES.push(`${String(h).padStart(2, "0")}:30`);
  }
}

function App() {
  const [title, setTitle] = useState("팀 프로젝트 회의");
  const [category, setCategory] = useState("team");
  const [maxPeople, setMaxPeople] = useState(4);

  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(6);
  const [selectedDates, setSelectedDates] = useState([]);

  const [meeting, setMeeting] = useState(null);
  const [shareCode, setShareCode] = useState("");
  const [userName, setUserName] = useState("");
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [allTimes, setAllTimes] = useState({});
  const [commonResult, setCommonResult] = useState(null);
  const [places, setPlaces] = useState([]);
  const [message, setMessage] = useState("");

  const monthDays = getDaysInMonth(selectedYear, selectedMonth);

  // 후보 날짜 선택/해제
  function toggleDate(dateKey) {
    setSelectedDates((prev) =>
      prev.includes(dateKey)
        ? prev.filter((d) => d !== dateKey)
        : [...prev, dateKey]
    );

    // 날짜를 해제하면 그 날짜의 시간 선택도 같이 삭제
    setSelectedSlots((prev) =>
      prev.filter((slot) => !slot.startsWith(`${dateKey}-`))
    );
  }

  // 선택된 날짜만 시간표에 표시
  const displayDays = monthDays.filter(([dateKey]) =>
    selectedDates.includes(dateKey)
  );

  // 약속 생성
  async function createMeeting() {
    const res = await fetch(`${API}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category, max_people: Number(maxPeople) }),
    });

    const data = await res.json();
    setMeeting(data);
    setShareCode(data.share_code);
    setMessage("약속이 생성되었습니다.");
  }

  // 공유 코드로 약속 불러오기
  async function loadMeeting() {
    const res = await fetch(`${API}/meetings/${shareCode}`);

    if (!res.ok) {
      setMessage("약속을 찾을 수 없습니다.");
      return;
    }

    const data = await res.json();
    setMeeting(data);
    setMessage("약속 정보를 불러왔습니다.");
  }

  // 시간 칸 선택/해제
  function toggleSlot(slot) {
    setSelectedSlots((prev) =>
      prev.includes(slot)
        ? prev.filter((s) => s !== slot)
        : [...prev, slot]
    );
  }

  // 사용자 시간 저장
  async function saveTimes() {
    if (!shareCode.trim()) {
      setMessage("먼저 약속을 생성하거나 공유 코드를 입력해주세요.");
      return;
    }

    if (!userName.trim()) {
      setMessage("이름을 입력해주세요.");
      return;
    }

    if (selectedSlots.length === 0) {
      setMessage("가능한 시간을 하나 이상 선택해주세요.");
      return;
    }

    const res = await fetch(`${API}/meetings/${shareCode}/times`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_name: userName, slots: selectedSlots }),
    });

    const data = await res.json();
    setMessage(data.message || "저장 완료");
    await loadAllTimes();
  }

  // 전체 참여자 시간 조회
  async function loadAllTimes() {
    if (!shareCode.trim()) {
      setMessage("공유 코드를 입력해주세요.");
      return;
    }

    const res = await fetch(`${API}/meetings/${shareCode}/times`);
    const data = await res.json();
    setAllTimes(data);
  }

  // 공통 시간 계산
  async function calculateCommonTimes() {
    if (!shareCode.trim()) {
      setMessage("공유 코드를 입력해주세요.");
      return;
    }

    const res = await fetch(`${API}/meetings/${shareCode}/common-times`);
    const data = await res.json();
    setCommonResult(data);
  }

  // 장소 추천
  async function loadPlaces() {
    if (!shareCode.trim()) {
      setMessage("공유 코드를 입력해주세요.");
      return;
    }

    const res = await fetch(`${API}/meetings/${shareCode}/places`);
    const data = await res.json();
    setPlaces(data);
  }

  return (
    <div className="page">
      <header>
        <h1>경북대 약속 시간 조율 서비스</h1>
        <p>
          후보 날짜와 가능 시간을 입력하면 참여자들의 공통 가능 시간을 계산하고
          장소를 추천합니다.
        </p>
      </header>

      <section className="card">
        <h2>1. 약속 생성</h2>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="약속명"
        />

        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="team">팀 프로젝트</option>
          <option value="meal">밥약속</option>
          <option value="drink">술약속</option>
          <option value="study">스터디</option>
        </select>

        <input
          type="number"
          value={maxPeople}
          onChange={(e) => setMaxPeople(Number(e.target.value))}
          placeholder="인원 수"
        />

        <div className="form-row">
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setSelectedDates([]);
              setSelectedSlots([]);
            }}
          >
            <option value={2026}>2026년</option>
            <option value={2027}>2027년</option>
            <option value={2028}>2028년</option>
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(Number(e.target.value));
              setSelectedDates([]);
              setSelectedSlots([]);
            }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <option key={month} value={month}>
                {month}월
              </option>
            ))}
          </select>
        </div>

        <h3>후보 날짜 선택</h3>
        <div className="date-list">
          {monthDays.map(([dateKey, label]) => (
            <button
              key={dateKey}
              className={
                selectedDates.includes(dateKey)
                  ? "date-button active"
                  : "date-button"
              }
              onClick={() => toggleDate(dateKey)}
            >
              {label}
            </button>
          ))}
        </div>

        <button onClick={createMeeting}>약속 생성</button>
      </section>

      <section className="card">
        <h2>2. 공유 코드로 약속 참여</h2>

        <div className="form-row">
          <input
            value={shareCode}
            onChange={(e) => setShareCode(e.target.value)}
            placeholder="공유 코드 입력"
          />
          <button onClick={loadMeeting}>불러오기</button>
        </div>

        {meeting && (
          <p>
            현재 약속: <b>{meeting.title}</b> / 공유 코드:{" "}
            <b>{shareCode}</b>
          </p>
        )}
      </section>

      <section className="card">
        <h2>3. 가능 시간 선택</h2>

        <input
          className="name-input"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="참여자 이름"
        />

        {displayDays.length === 0 ? (
          <p className="notice">먼저 후보 날짜를 선택해주세요.</p>
        ) : (
          <div className="timetable">
            <div className="cell head">시간</div>

            {displayDays.map(([dateKey, label]) => (
              <div className="cell head" key={dateKey}>
                {label}
              </div>
            ))}

            {TIMES.map((time) => (
              <React.Fragment key={time}>
                <div className="cell time">{time}</div>

                {displayDays.map(([dateKey]) => {
                  const slot = `${dateKey}-${time}`;
                  const active = selectedSlots.includes(slot);

                  return (
                    <button
                      key={slot}
                      className={active ? "cell slot active" : "cell slot"}
                      onClick={() => toggleSlot(slot)}
                    >
                      {active ? "가능" : ""}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}

        <button className="wide" onClick={saveTimes}>
          내 시간 저장
        </button>
      </section>

      <section className="card">
        <h2>4. 공통 시간 계산 및 장소 추천</h2>

        <div className="form-row">
          <button onClick={loadAllTimes}>참여자 시간 조회</button>
          <button onClick={calculateCommonTimes}>공통 시간 계산</button>
          <button onClick={loadPlaces}>장소 추천</button>
        </div>

        <h3>참여자별 입력 시간</h3>
        <pre>{JSON.stringify(allTimes, null, 2)}</pre>

        {commonResult && (
          <div>
            <h3>추천 시간 TOP 5</h3>
            <ul>
              {commonResult.recommended_times.map((item) => (
                <li key={item.slot}>
                  {item.slot} - 가능 인원 {item.score}
                </li>
              ))}
            </ul>
          </div>
        )}

        {places.length > 0 && (
          <div>
            <h3>추천 장소</h3>
            <div className="place-list">
              {places.map((p) => (
                <div className="place" key={p.name}>
                  <b>{p.name}</b>
                  <span>{p.distance}</span>
                  <p>{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {message && <div className="toast">{message}</div>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);