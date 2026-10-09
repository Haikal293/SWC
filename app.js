
const API_BASE = localStorage.getItem("API_BASE_URL") || "http://localhost:3000/api";

const state = {
  user: JSON.parse(localStorage.getItem("exam_user") || "null"),
  token: localStorage.getItem("exam_token") || "",
  current: "dashboard"
};

const $ = id => document.getElementById(id);

function setMessage(text, type="") {
  $("loginMessage").textContent = text;
  $("loginMessage").className = "message " + type;
}

async function apiRequest(path, options = {}) {
  const headers = {"Content-Type": "application/json", ...(options.headers || {})};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(API_BASE + path, {...options, headers});
  let data = {};
  try { data = await response.json(); } catch (_) {}

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data;
}

/*
  For lecturer/admin demos, if your backend uses a different endpoint
  structure, only change the paths below. The frontend architecture stays the same.
*/
async function login(email, password) {
  // Expected backend:
  // POST /login
  // { email, password }
  // Response: { success, token, user: { user_id, full_name, role, email } }
  return apiRequest("/login", {
    method: "POST",
    body: JSON.stringify({email, password})
  });
}

function showApp() {
  $("loginPage").classList.add("hidden");
  $("appPage").classList.remove("hidden");
  $("userName").textContent = state.user.full_name || "User";
  $("userRole").textContent = state.user.role || "User";
  buildNav();
  render("dashboard");
}

function buildNav() {
  const role = state.user.role;
  const items = [
    ["dashboard", "Dashboard"],
    ["timetable", "Examination Timetable"],
    ["courses", "Courses"],
    ["results", "Results"]
  ];

  if (role === "Lecturer" || role === "Administrator") {
    items.push(["manageResults", "Manage Results"]);
    items.push(["examinations", "Manage Examinations"]);
  }

  if (role === "Administrator") {
    items.push(["users", "Manage Users"]);
    items.push(["venues", "Manage Venues"]);
    items.push(["registrations", "Registrations"]);
  }

  $("nav").innerHTML = items.map(([key, label]) =>
    `<button class="nav-item ${state.current===key ? "active":""}" onclick="render('${key}')">${label}</button>`
  ).join("");
}

function render(page) {
  state.current = page;
  buildNav();
  const titles = {
    dashboard:"Dashboard",
    timetable:"Examination Timetable",
    courses:"Courses",
    results:"Results",
    manageResults:"Manage Results",
    examinations:"Manage Examinations",
    users:"Manage Users",
    venues:"Manage Venues",
    registrations:"Registrations"
  };
  $("pageTitle").textContent = titles[page] || "Dashboard";
  $("content").innerHTML = pages[page] ? pages[page]() : pages.dashboard();
  if (page === "dashboard") loadDashboard();
  if (page === "timetable") loadTimetable();
  if (page === "courses") loadCourses();
  if (page === "results") loadResults();
  if (page === "manageResults") loadResults(true);
  if (page === "examinations") loadExaminations();
  if (page === "users") loadUsers();
  if (page === "venues") loadVenues();
  if (page === "registrations") loadRegistrations();
}

const pages = {
  dashboard: () => `
    <div class="hero">
      <div>
        <p class="eyebrow">WELCOME BACK</p>
        <h1>${state.user.full_name || "User"}</h1>
        <p>Role: <b>${state.user.role}</b></p>
      </div>
      <div class="hero-icon">◎</div>
    </div>
    <div class="cards">
      <div class="card"><span>Role</span><strong>${state.user.role}</strong></div>
      <div class="card"><span>Student ID</span><strong>${state.user.student_id || "-"}</strong></div>
      <div class="card"><span>API</span><strong>REST + JSON</strong></div>
      <div class="card"><span>Authentication</span><strong>JWT</strong></div>
    </div>
    <div class="panel">
      <h3>System Modules</h3>
      <div class="module-grid">
        <button onclick="render('timetable')">Examination Timetable</button>
        <button onclick="render('courses')">Courses</button>
        <button onclick="render('results')">Results</button>
        ${state.user.role !== "Student" ? `<button onclick="render('manageResults')">Manage Results</button>` : ""}
        ${state.user.role === "Administrator" ? `<button onclick="render('users')">Manage Users</button>` : ""}
      </div>
    </div>
  `,
  timetable: () => `
    <div class="panel">
      <div class="panel-head"><h3>Examination Timetable</h3><button class="btn small" onclick="loadTimetable()">Refresh</button></div>
      <div id="tableArea">Loading...</div>
    </div>
  `,
  courses: () => `
    <div class="panel">
      <div class="panel-head"><h3>Courses</h3><button class="btn small" onclick="loadCourses()">Refresh</button></div>
      <div id="tableArea">Loading...</div>
    </div>
  `,
  results: () => `
    <div class="panel">
      <div class="panel-head"><h3>Results</h3><button class="btn small" onclick="loadResults()">Refresh</button></div>
      <div id="tableArea">Loading...</div>
    </div>
  `,
  manageResults: () => `
    <div class="panel">
      <div class="panel-head"><h3>Manage Results</h3><button class="btn small" onclick="openResultForm()">+ Add Result</button></div>
      <div id="formArea"></div>
      <div id="tableArea">Loading...</div>
    </div>
  `,
  examinations: () => `
    <div class="panel">
      <div class="panel-head"><h3>Manage Examinations</h3><button class="btn small" onclick="openExamForm()">+ Add Examination</button></div>
      <div id="formArea"></div>
      <div id="tableArea">Loading...</div>
    </div>
  `,
  users: () => `
    <div class="panel">
      <div class="panel-head"><h3>Manage Users</h3><button class="btn small" onclick="loadUsers()">Refresh</button></div>
      <div id="tableArea">Loading...</div>
    </div>
  `,
  venues: () => `
    <div class="panel">
      <div class="panel-head"><h3>Manage Venues</h3><button class="btn small" onclick="loadVenues()">Refresh</button></div>
      <div id="tableArea">Loading...</div>
    </div>
  `,
  registrations: () => `
    <div class="panel">
      <div class="panel-head"><h3>Registrations</h3><button class="btn small" onclick="loadRegistrations()">Refresh</button></div>
      <div id="tableArea">Loading...</div>
    </div>
  `
};

async function loadDashboard() {
  $("apiStatus").textContent = "API: checking...";
  try {
    await apiRequest("/courses");
    $("apiStatus").textContent = "API: connected";
  } catch (e) {
    $("apiStatus").textContent = "API: check failed";
  }
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${headers.length}">No records found.</td></tr>`}</tbody></table></div>`;
}

async function loadTimetable() {
  const area = $("tableArea");
  if (!area) return;
  area.textContent = "Loading...";
  try {
    const r = await apiRequest("/examinations");
    const data = r.data || r;
    area.innerHTML = table(
      ["Course","Date","Time","Venue","Type"],
      data.map(x => `<tr><td>${x.course_code || x.course_name || "-"}</td><td>${x.exam_date || "-"}</td><td>${x.start_time || "-"} - ${x.end_time || "-"}</td><td>${x.venue_name || "-"}</td><td>${x.exam_type || "-"}</td></tr>`)
    );
  } catch(e) { area.innerHTML = `<div class="error">${e.message}</div>`; }
}

async function loadCourses() {
  const area = $("tableArea");
  if (!area) return;
  area.textContent = "Loading...";
  try {
    const r = await apiRequest("/courses");
    const data = r.data || r;
    area.innerHTML = table(
      ["Code","Course Name","Credit","Faculty"],
      data.map(x => `<tr><td>${x.course_code}</td><td>${x.course_name}</td><td>${x.credit_hour}</td><td>${x.faculty}</td></tr>`)
    );
  } catch(e) { area.innerHTML = `<div class="error">${e.message}</div>`; }
}

async function loadResults(manage=false) {
  const area = $("tableArea");
  if (!area) return;
  area.textContent = "Loading...";
  try {
    const path = state.user.role === "Student" ? "/results/my-results" : "/results";
    const r = await apiRequest(path);
    const data = r.data || r;
    const rows = data.map(x => `<tr>
      <td>${x.student_id || "-"}</td><td>${x.full_name || "-"}</td>
      <td>${x.course_code || "-"}</td><td>${x.marks ?? "-"}</td>
      <td><b>${x.grade || "-"}</b></td><td>${x.status || "-"}</td>
      ${manage ? `<td><button class="btn danger small" onclick="deleteResult(${x.result_id})">Delete</button></td>` : ""}
    </tr>`);
    area.innerHTML = table(
      manage ? ["Student ID","Student","Course","Marks","Grade","Status","Action"] :
               ["Student ID","Student","Course","Marks","Grade","Status"],
      rows
    );
  } catch(e) { area.innerHTML = `<div class="error">${e.message}</div>`; }
}

async function loadExaminations() {
  const area = $("tableArea");
  try {
    const r = await apiRequest("/examinations");
    const data = r.data || r;
    area.innerHTML = table(
      ["ID","Course","Date","Start","End","Venue","Type"],
      data.map(x => `<tr><td>${x.examination_id}</td><td>${x.course_code || "-"}</td><td>${x.exam_date}</td><td>${x.start_time}</td><td>${x.end_time}</td><td>${x.venue_name || "-"}</td><td>${x.exam_type}</td></tr>`)
    );
  } catch(e) { area.innerHTML = `<div class="error">${e.message}</div>`; }
}

async function loadUsers() {
  const area = $("tableArea");
  try {
    const r = await apiRequest("/users");
    const data = r.data || r;
    area.innerHTML = table(
      ["ID","Name","Email","Role","Student ID"],
      data.map(x => `<tr><td>${x.user_id}</td><td>${x.full_name}</td><td>${x.email}</td><td>${x.role}</td><td>${x.student_id || "-"}</td></tr>`)
    );
  } catch(e) { area.innerHTML = `<div class="error">${e.message}</div>`; }
}

async function loadVenues() {
  const area = $("tableArea");
  try {
    const r = await apiRequest("/venues");
    const data = r.data || r;
    area.innerHTML = table(
      ["ID","Venue","Building","Capacity"],
      data.map(x => `<tr><td>${x.venue_id}</td><td>${x.venue_name}</td><td>${x.building}</td><td>${x.capacity}</td></tr>`)
    );
  } catch(e) { area.innerHTML = `<div class="error">${e.message}</div>`; }
}

async function loadRegistrations() {
  const area = $("tableArea");
  try {
    const r = await apiRequest("/registrations");
    const data = r.data || r;
    area.innerHTML = table(
      ["ID","Student","Course","Semester","Date"],
      data.map(x => `<tr><td>${x.registration_id}</td><td>${x.student_id || "-"}</td><td>${x.course_id || "-"}</td><td>${x.semester}</td><td>${x.registration_date}</td></tr>`)
    );
  } catch(e) { area.innerHTML = `<div class="error">${e.message}</div>`; }
}

function openResultForm() {
  $("formArea").innerHTML = `
    <form class="inline-form" onsubmit="createResult(event)">
      <input id="rStudent" placeholder="Student ID" required>
      <input id="rExam" type="number" placeholder="Examination ID" required>
      <input id="rMarks" type="number" min="0" max="100" step="0.01" placeholder="Marks" required>
      <input id="rGrade" placeholder="Grade" required>
      <select id="rStatus"><option>PASS</option><option>FAIL</option></select>
      <button class="btn primary" type="submit">Save</button>
    </form>`;
}

async function createResult(e) {
  e.preventDefault();
  try {
    await apiRequest("/results", {
      method:"POST",
      body:JSON.stringify({
        student_id:Number($("rStudent").value),
        examination_id:Number($("rExam").value),
        marks:Number($("rMarks").value),
        grade:$("rGrade").value,
        status:$("rStatus").value
      })
    });
    $("formArea").innerHTML = `<div class="success">Result created successfully.</div>`;
    loadResults(true);
  } catch(err) { $("formArea").innerHTML = `<div class="error">${err.message}</div>`; }
}

async function deleteResult(id) {
  if (!confirm("Delete this result?")) return;
  try {
    await apiRequest(`/results/${id}`, {method:"DELETE"});
    loadResults(true);
  } catch(e) { alert(e.message); }
}

function openExamForm() {
  $("formArea").innerHTML = `
    <form class="inline-form" onsubmit="createExam(event)">
      <input id="eCourse" type="number" placeholder="Course ID" required>
      <input id="eVenue" type="number" placeholder="Venue ID" required>
      <input id="eDate" type="date" required>
      <input id="eStart" type="time" required>
      <input id="eEnd" type="time" required>
      <input id="eType" value="Final Examination" required>
      <button class="btn primary" type="submit">Save</button>
    </form>`;
}

async function createExam(e) {
  e.preventDefault();
  try {
    await apiRequest("/examinations", {
      method:"POST",
      body:JSON.stringify({
        course_id:Number($("eCourse").value),
        venue_id:Number($("eVenue").value),
        exam_date:$("eDate").value,
        start_time:$("eStart").value,
        end_time:$("eEnd").value,
        exam_type:$("eType").value
      })
    });
    $("formArea").innerHTML = `<div class="success">Examination created successfully.</div>`;
    loadExaminations();
  } catch(err) { $("formArea").innerHTML = `<div class="error">${err.message}</div>`; }
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  setMessage("Connecting to API...");
  try {
    const result = await login($("email").value, $("password").value);
    state.token = result.token || "";
    state.user = result.user || result.data?.user;
    if (!state.user) throw new Error("API did not return user data.");
    localStorage.setItem("exam_token", state.token);
    localStorage.setItem("exam_user", JSON.stringify(state.user));
    setMessage("");
    showApp();
  } catch (err) {
    setMessage(err.message, "error");
  }
});

$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("exam_token");
  localStorage.removeItem("exam_user");
  location.reload();
});

if (state.user) showApp();
