import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API = "http://localhost:8000";
const DAYS = [
  ["MON", "월"],
  ["TUE", "화"],
  ["WED", "수"],
  ["THU", "목"],
  ["FRI", "금"],
];

// 09:00부터 21:00까지 30분 단위 시간 생성
const TIMES = [];
for (let h = 9; h <= 21; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`);
  if (h !== 21) TIMES.push(`${String(h).padStart(2, "0")}:30`);
}

function App() {
  const [title, setTitle] = useState("팀 프로젝트 회의");
  const [category, setCategory] = useState("team");
  const [maxPeople, setMaxPeople] = useState(4);
  const [meeting, setMeeting] = useState(null);
  const [shareCode, setShareCode] = useState("");
  const [userName, setUserName] = useState("");
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [allTimes, setAllTimes] = useState({});
  const [commonResult, setCommonResult] = useState(null);
  const [places, setPlaces] = useState([]);
  const [message, setMessage] = useState("");

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

  // 시간 칸 클릭 시 선택/해제
  function toggleSlot(slot) {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  }

  // 사용자 시간 저장
  async function saveTimes() {
    if (!userName.trim()) {
      setMessage("이름을 입력해주세요.");
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
    const res = await fetch(`${API}/meetings/${shareCode}/times`);
    const data = await res.json();
    setAllTimes(data);
  }

  // 공통 시간 계산
  async function calculateCommonTimes() {
    const res = await fetch(`${API}/meetings/${shareCode}/common-times`);
    const data = await res.json();
    setCommonResult(data);
  }

  // 장소 추천
  async function loadPlaces() {
    const res = await fetch(`${API}/meetings/${shareCode}/places`);
    const data = await res.json();
    setPlaces(data);
  }

  return (
    <div className="page">
      <header>
        <h1>경북대 약속 시간 조율 서비스</h1>
        <p>참여자별 가능 시간을 입력하면 공통 시간을 자동으로 계산하고 장소를 추천합니다.</p>
      </header>

      <section className="card">
        <h2>1. 약속 생성</h2>
        <div className="form-row">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="약속명" />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="meal">밥약속</option>
            <option value="drink">술약속</option>
            <option value="study">스터디</option>
            <option value="team">팀 프로젝트</option>
            <option value="mentoring">멘토링</option>
          </select>
          <input type="number" value={maxPeople} onChange={(e) => setMaxPeople(e.target.value)} />
          <button onClick={createMeeting}>약속 생성</button>
        </div>
        {meeting && (
          <div className="notice">
            생성된 공유 코드: <b>{shareCode}</b>
          </div>
        )}
      </section>

      <section className="card">
        <h2>2. 공유 코드로 약속 참여</h2>
        <div className="form-row">
          <input value={shareCode} onChange={(e) => setShareCode(e.target.value)} placeholder="공유 코드 입력" />
          <button onClick={loadMeeting}>불러오기</button>
        </div>
        {meeting && <p>현재 약속: <b>{meeting.title}</b></p>}
      </section>

      <section className="card">
        <h2>3. 가능 시간 선택</h2>
        <input className="name-input" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="참여자 이름" />
        <div className="timetable">
          <div className="cell head">시간</div>
          {DAYS.map(([code, label]) => <div className="cell head" key={code}>{label}</div>)}
          {TIMES.map((time) => (
            <React.Fragment key={time}>
              <div className="cell time">{time}</div>
              {DAYS.map(([day]) => {
                const slot = `${day}-${time}`;
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
        <button className="wide" onClick={saveTimes}>내 시간 저장</button>
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
                <li key={item.slot}>{item.slot} - 가능 인원 {item.score}</li>
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
