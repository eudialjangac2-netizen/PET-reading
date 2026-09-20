/* =====================================================================
   FULL TEST ENGINE
   ===================================================================== */
(function (window, document) {
  "use strict";

  const FullTest = {};

  const STUDENT_CODE = "72PETRB";
  const TEACHER_NAME = "GVPET72";
  const TEACHER_CODE = "72GRADEBPET";
  const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwriNrQ7B7sLQqb5pOIGkFk8mOsrOmS1aAvZJ4m6jS3VWreAtcG_x2d6ToSnOF8mdmfrg/exec";

  // Bảng quy đổi CHÍNH THỨC Cambridge PET Reading (0-32 câu đúng -> PET Score /170)
  // Chỉ áp dụng khi Full Test có ĐỦ 32 câu (tức đủ cả 6 Part) — nếu chọn ít hơn,
  // không đủ điều kiện quy đổi chính thức, sẽ không hiển thị điểm PET Score.
  const READING_SCORE_TABLE = {
    0: 0, 1: 20, 2: 41, 3: 61, 4: 82, 5: 102, 6: 104, 7: 107, 8: 109, 9: 111,
    10: 113, 11: 116, 12: 118, 13: 120, 14: 122, 15: 124, 16: 126, 17: 127, 18: 130, 19: 132,
    20: 134, 21: 136, 22: 138, 23: 140, 24: 143, 25: 147, 26: 150, 27: 153, 28: 157, 29: 160,
    30: 163, 31: 167, 32: 170,
  };
  const FULL_READING_TOTAL = 32;

  const PART_LABELS = {
    part1: "Part 1", part2: "Part 2", part3: "Part 3",
    part4: "Part 4", part5: "Part 5", part6: "Part 6",
  };

  let testLabel = "Reading full test";

  let exerciseIds = [];
  let durationMinutes = 45;
  let exercises = []; // [{ id, partType, exerciseName, data, questions: [...], tabColor }]
  let allQuestions = []; // toàn bộ descriptor, đúng thứ tự toàn cục
  let answeredSet = new Set();
  let markedSet = new Set();
  let activeTabIndex = 0;

  let studentRoster = null;
  let studentName = "";
  let studentCodeUsed = "";
  let isTeacher = false;
  let antiCheatBypassed = false;
  let tabSwitchCount = 0;
  let startTime = null;
  let timerInterval = null;
  let endTimestamp = null;
  let submitted = false;

  // ---------------------------------------------------------------------
  // KHỞI ĐỘNG
  // ---------------------------------------------------------------------
  async function boot() {
    const params = new URLSearchParams(window.location.search);
    exerciseIds = (params.get("ids") || "").split(",").map(s => s.trim()).filter(Boolean);
    durationMinutes = Math.max(1, parseInt(params.get("duration"), 10) || 45);
    testLabel = params.get("label") || ("Reading full test - " + formatShortDate(new Date()));

    if (exerciseIds.length === 0) {
      document.body.innerHTML = "<p style='padding:40px;font-family:sans-serif;'>⚠️ Thiếu tham số <code>?ids=</code> trên URL.</p>";
      return;
    }

    wireAntiCopy();
    wireTabSwitchCounter();

    const [rosterList, loadedExercises] = await Promise.all([loadRoster(), loadExercises()]);
    studentRoster = rosterList;
    exercises = loadedExercises;

    if (exercises.length === 0) {
      document.body.innerHTML = "<p style='padding:40px;font-family:sans-serif;'>⚠️ Không tải được bài nào từ danh sách đã chọn.</p>";
      return;
    }

    buildGlobalQuestionList();
    renderLoginInfoBadge();
    wireLoginForm();
    wireTeacherToolbar();
    wirePalette();
  }

  async function loadRoster() {
    try {
      const res = await fetch("students.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const list = await res.json();
      return new Map(list.map(s => [String(s.code).toUpperCase(), s.name]));
    } catch (err) {
      console.warn("Không tải được students.json", err);
      return new Map();
    }
  }

  async function loadExercises() {
    const results = await Promise.all(exerciseIds.map(async (id) => {
      try {
        const res = await fetch(`exercises/${id}.json`);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const theme = (typeof getThemeByPartType === "function") ? getThemeByPartType(data.partType) : null;
        return { id, partType: data.partType, exerciseName: data.exerciseName, data, theme };
      } catch (err) {
        console.warn("⚠️ Bỏ qua bài lỗi:", id, err);
        return null;
      }
    }));
    return results.filter(Boolean);
  }

  function buildGlobalQuestionList() {
    let cursor = 1;
    exercises.forEach(ex => {
      const renderFn = FT_RENDERERS[ex.partType];
      const result = renderFn(ex.data, cursor);
      ex.html = result.html;
      ex.questions = result.questions;
      ex.layout = result.layout;
      result.questions.forEach(q => { q.partLabel = PART_LABELS[ex.partType] || ex.partType; });
      cursor += result.questions.length;
      allQuestions = allQuestions.concat(result.questions);
    });
  }

  function formatShortDate(d) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
  }

  function renderLoginInfoBadge() {
    const badge = document.getElementById("ftInfoBadge");
    badge.innerHTML = `📋 <b>${testLabel}</b><br>Gồm <b>${allQuestions.length} câu</b> · Thời gian làm bài: <b>${durationMinutes} phút</b>`;
  }

  // ---------------------------------------------------------------------
  // ĐĂNG NHẬP
  // ---------------------------------------------------------------------
  function wireLoginForm() {
    document.getElementById("ftStartBtn").addEventListener("click", handleLogin);
  }

  function handleLogin() {
    const codeInput = (document.getElementById("ftStudentCode").value || "").trim();
    const accessInput = (document.getElementById("ftAccessCode").value || "").trim();
    const errEl = document.getElementById("ftLoginErr");
    errEl.textContent = "";

    if (!codeInput) { alert("Vui lòng nhập Mã học sinh!"); return; }

    if (codeInput === TEACHER_NAME && accessInput === TEACHER_CODE) {
      isTeacher = true;
      antiCheatBypassed = true;
      studentName = "Giáo viên (QA)";
      studentCodeUsed = codeInput;
      document.getElementById("ftTeacherBar").style.display = "flex";
      document.getElementById("ftPaletteToggle").style.display = "flex";
      startApp();
      return;
    }

    if (accessInput !== STUDENT_CODE) {
      alert("Mã xác nhận bài tập không đúng!");
      return;
    }

    const matchedName = studentRoster ? studentRoster.get(codeInput.toUpperCase()) : undefined;
    if (!matchedName) {
      errEl.textContent = "Mã học sinh không có trong danh sách lớp. Kiểm tra lại hoặc hỏi giáo viên.";
      return;
    }

    isTeacher = false;
    studentName = matchedName;
    studentCodeUsed = codeInput.toUpperCase();
    document.getElementById("ftPaletteToggle").style.display = "flex";
    startApp();
  }

  function startApp() {
    startTime = new Date();
    endTimestamp = Date.now() + durationMinutes * 60 * 1000;
    buildWatermark();
    buildTabs();
    buildPaletteGrid();
    showTab(0);
    startTimer();

    document.getElementById("ftLoginScreen").style.display = "none";
    document.getElementById("ftApp").style.display = "flex";
    document.getElementById("ftTestTitle").textContent = "🧩 " + testLabel;

    document.getElementById("ftSubmitBtn").addEventListener("click", () => confirmSubmit(false));
    checkPendingRedo();
  }

  async function checkPendingRedo() {
    if (isTeacher || !studentCodeUsed) return;
    try {
      const res = await fetch(`${WEBHOOK_URL}?studentCode=${encodeURIComponent(studentCodeUsed)}`);
      if (!res.ok) return;
      const data = await res.json();
      const currentIds = new Set(exercises.map(e => e.id));
      const pending = (data.pending || []).filter(id => !currentIds.has(id));
      if (pending.length === 0) return;
      const banner = document.createElement("div");
      banner.id = "ftRedoBanner";
      banner.style.cssText = "background:#fff3e1;border-bottom:2px solid #f6ad55;padding:10px 20px;font-size:13px;color:#9a6a1c;";
      banner.innerHTML = `⏳ <b>Bạn còn ${pending.length} Part khác từ lần thi trước chưa làm lại đúng 100%:</b> ` +
        pending.map(id => `<a href="bai-tap-doc.html?id=${id}" style="color:#c05621;font-weight:700;">${id}</a>`).join(", ");
      const app = document.getElementById("ftApp");
      app.insertBefore(banner, app.firstChild);
    } catch (err) {
      console.warn("Không tra được danh sách cần làm lại:", err);
    }
  }

  // ---------------------------------------------------------------------
  // TABS THEO PART
  // ---------------------------------------------------------------------
  function buildTabs() {
    const bar = document.getElementById("ftTabbar");
    bar.innerHTML = exercises.map((ex, i) => {
      const label = `${ex.theme ? ex.theme.titleEmoji || "" : ""} ${PART_LABELS[ex.partType] || ex.partType}`;
      return `<div class="ft-tab" data-index="${i}">${label}</div>`;
    }).join("");

    const content = document.getElementById("ftMainContent");
    content.innerHTML = exercises.map((ex, i) => `
      <div class="ft-part-view layout-${ex.layout}" data-index="${i}" style="--primary:${ex.theme ? ex.theme.primary : "#6b3ba7"}; --primary-light:${ex.theme ? ex.theme.primaryLight : "#a076db"}; --border-color:${ex.theme ? ex.theme.borderColor : "#e2d3f3"};">
        ${ex.html}
      </div>
    `).join("");

    bar.querySelectorAll(".ft-tab").forEach(tab => {
      tab.addEventListener("click", () => showTab(Number(tab.getAttribute("data-index"))));
    });
  }

  function showTab(index, scrollToGlobalIndex) {
    activeTabIndex = index;
    document.querySelectorAll(".ft-part-view").forEach(v => {
      v.classList.toggle("active", Number(v.getAttribute("data-index")) === index);
    });
    document.querySelectorAll(".ft-tab").forEach(tab => {
      const isActive = Number(tab.getAttribute("data-index")) === index;
      tab.classList.toggle("active", isActive);
      tab.style.background = isActive ? (exercises[index].theme ? exercises[index].theme.primary : "#6b3ba7") : "";
      tab.style.borderColor = isActive ? (exercises[index].theme ? exercises[index].theme.primary : "#6b3ba7") : "";
    });

    if (scrollToGlobalIndex) {
      setTimeout(() => {
        const el = document.getElementById(`ft-q-${scrollToGlobalIndex}`);
        if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }

  function tabIndexForGlobalQuestion(g) {
    return exercises.findIndex(ex => ex.questions.some(q => q.globalIndex === g));
  }

  // ---------------------------------------------------------------------
  // TRẢ LỜI + BẢNG SỐ CÂU HỎI (PALETTE)
  // ---------------------------------------------------------------------
  FullTest.onAnswer = function (g) {
    const q = allQuestions.find(x => x.globalIndex === g);
    if (!q) return;
    const val = q.getValue();
    if (val && val !== "") answeredSet.add(g); else answeredSet.delete(g);
    updatePaletteBox(g);
  };

  function buildPaletteGrid() {
    const grid = document.getElementById("ftPaletteGrid");
    grid.innerHTML = allQuestions.map(q => `<div class="ft-pal-box" data-g="${q.globalIndex}">${q.globalIndex}</div>`).join("");
    grid.querySelectorAll(".ft-pal-box").forEach(box => {
      const g = Number(box.getAttribute("data-g"));
      box.addEventListener("click", () => {
        const idx = tabIndexForGlobalQuestion(g);
        showTab(idx, g);
        document.getElementById("ftPaletteDrawer").classList.remove("open");
      });
      box.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showContextMenu(e.pageX, e.pageY, g);
      });
    });
  }

  function updatePaletteBox(g) {
    const box = document.querySelector(`.ft-pal-box[data-g="${g}"]`);
    if (!box) return;
    box.classList.toggle("answered", answeredSet.has(g));
    box.classList.toggle("marked", markedSet.has(g));
  }

  function showContextMenu(x, y, g) {
    const menu = document.getElementById("ftContextMenu");
    const isMarked = markedSet.has(g);
    menu.innerHTML = `<div id="ftCtxToggleMark">${isMarked ? "✅ Bỏ đánh dấu" : "🚩 Đánh dấu xem lại"}</div>`;
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.style.display = "block";
    document.getElementById("ftCtxToggleMark").addEventListener("click", () => {
      if (markedSet.has(g)) markedSet.delete(g); else markedSet.add(g);
      updatePaletteBox(g);
      menu.style.display = "none";
    });
  }
  document.addEventListener("click", () => {
    const menu = document.getElementById("ftContextMenu");
    if (menu) menu.style.display = "none";
  });

  function wirePalette() {
    document.getElementById("ftPaletteToggle").addEventListener("click", () => {
      document.getElementById("ftPaletteDrawer").classList.toggle("open");
    });
    document.getElementById("ftPaletteCloseBtn").addEventListener("click", () => {
      document.getElementById("ftPaletteDrawer").classList.remove("open");
    });
    const rotateBtn = document.getElementById("ftRotateDismissBtn");
    if (rotateBtn) {
      rotateBtn.addEventListener("click", () => {
        document.body.classList.add("ft-rotate-dismissed");
      });
    }
  }

  // ---------------------------------------------------------------------
  // ĐỒNG HỒ ĐẾM NGƯỢC
  // ---------------------------------------------------------------------
  function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      const remaining = endTimestamp - Date.now();
      if (remaining <= 0) {
        clearInterval(timerInterval);
        updateTimerDisplay();
        confirmSubmit(true);
        return;
      }
      updateTimerDisplay();
    }, 1000);
  }

  function updateTimerDisplay() {
    const remaining = Math.max(0, endTimestamp - Date.now());
    const totalSec = Math.ceil(remaining / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    const el = document.getElementById("ftTimer");
    el.textContent = `${mm}:${String(ss).padStart(2, "0")}`;
    el.classList.toggle("low", totalSec <= 300);
  }

  // ---------------------------------------------------------------------
  // NỘP BÀI + CHẤM ĐIỂM
  // ---------------------------------------------------------------------
  function confirmSubmit(isAuto) {
    if (submitted) return;
    if (!isAuto) {
      const unanswered = allQuestions.length - answeredSet.size;
      if (unanswered > 0) {
        const ok = window.confirm(`Bạn còn ${unanswered} câu chưa làm. Vẫn nộp bài?`);
        if (!ok) return;
      }
    }
    submitFullTest(isAuto);
  }

  function submitFullTest(isAuto) {
    submitted = true;
    if (timerInterval) clearInterval(timerInterval);

    let correctCount = 0;
    const subskillWrongCount = {};
    const perQuestionResult = []; // dùng cho bảng chi tiết hiển thị + gửi Sheet
    allQuestions.forEach(q => {
      const val = q.getValue();
      const ok = q.isCorrect(val);
      if (ok) {
        correctCount++;
      } else if (q.subskill) {
        subskillWrongCount[q.subskill] = (subskillWrongCount[q.subskill] || 0) + 1;
      }
      perQuestionResult.push({
        globalIndex: q.globalIndex,
        localId: q.localId,
        partLabel: q.partLabel,
        subskill: q.subskill,
        isCorrect: ok,
        correctReason: ok ? q.correctReason : null, // CHỈ đưa lý do khi ĐÚNG — không lộ đáp án/lý do cho câu sai
      });
    });

    const total = allQuestions.length;
    const isFullReading = total === FULL_READING_TOTAL;
    const petScore = isFullReading ? READING_SCORE_TABLE[correctCount] : null;

    const weakest = Object.entries(subskillWrongCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([skill, count]) => `${skill} (sai ${count} câu)`);

    // Danh sách CHÍNH XÁC id các bài (Part) có ít nhất 1 câu sai -> dùng để tạo link "làm lại"
    const weakPartIds = exercises
      .filter(ex => ex.questions.some(q => !q.isCorrect(q.getValue())))
      .map(ex => ex.id);

    const now = new Date();
    const durationUsedMs = startTime ? (now - startTime) : 0;
    const durationUsedText = formatDuration(durationUsedMs);

    renderResultScreen({ correctCount, total, petScore, isFullReading, weakest, perQuestionResult, durationUsedText, isAuto, now });

    // Hướng 1: gửi chi tiết CÂU SAI riêng cho giáo viên xem trong Sheet (học sinh không thấy phần này)
    const wrongItems = perQuestionResult.filter(r => !r.isCorrect);
    if (wrongItems.length > 0) {
      sendToGoogleSheets({
        recordType: "full_test_detail",
        studentCode: studentCodeUsed,
        studentName: studentName + (isTeacher ? " [TEST]" : ""),
        testName: testLabel,
        submittedAt: now.toLocaleString("vi-VN"),
        wrongItems: wrongItems.map(w => ({
          partLabel: w.partLabel,
          localId: w.localId,
          globalIndex: w.globalIndex,
          subskill: w.subskill || "-",
        })),
      });
    }

    sendToGoogleSheets({
      recordType: "full_test",
      startTime: startTime ? startTime.toLocaleString("vi-VN") : "",
      endTime: now.toLocaleString("vi-VN"),
      studentName: studentName + (isTeacher ? " [TEST]" : ""),
      studentCode: studentCodeUsed,
      testName: testLabel,
      partsIncluded: exercises.map(e => e.exerciseName).join(", "),
      totalQuestions: total,
      correctCount: correctCount,
      scoreBand: isFullReading ? `PET Score: ${petScore}/170` : "Không đủ 32 câu - chưa quy đổi",
      weakestSubskills: weakest.join("; ") || "-",
      weakPartIds: weakPartIds.join(","),
      tabSwitchCount: tabSwitchCount,
      durationUsed: durationUsedText,
      autoSubmitted: isAuto,
    });
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds} giây`;
    return `${minutes} phút ${seconds} giây`;
  }

  function renderResultScreen({ correctCount, total, petScore, isFullReading, weakest, perQuestionResult, durationUsedText, isAuto, now }) {
    document.getElementById("ftApp").style.display = "none";
    document.getElementById("ftPaletteToggle").style.display = "none";
    document.getElementById("ftPaletteDrawer").classList.remove("open");
    const screen = document.getElementById("ftResultScreen");
    screen.style.display = "block";

    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    let emoji, heading;
    if (pct >= 80) { emoji = "🎉"; heading = "Đã hoàn thành xuất sắc!"; }
    else if (pct >= 50) { emoji = "👍"; heading = "Đã hoàn thành bài thi"; }
    else { emoji = "📝"; heading = "Đã hoàn thành bài thi — cần luyện tập thêm"; }
    document.getElementById("ftResultEmoji").textContent = emoji;
    document.getElementById("ftResultHeading").textContent = heading;

    document.getElementById("ftResultSummary").innerHTML = `
      <div><span class="label">👤 Học sinh</span><span class="value">${studentName}</span></div>
      <div><span class="label">📅 Ngày làm bài</span><span class="value">${now.toLocaleDateString("vi-VN")}</span></div>
      <div><span class="label">⏱️ Thời gian làm bài</span><span class="value">${durationUsedText}</span></div>
      <div><span class="label">✅ Số câu đúng</span><span class="value">${correctCount}/${total}</span></div>
      ${isAuto ? `<div><span class="label">⏰ Trạng thái</span><span class="value">Tự động nộp (hết giờ)</span></div>` : ""}
    `;

    if (isFullReading) {
      document.getElementById("ftBandBox").innerHTML = `
        <div class="band">${petScore} / 170</div>
        <div class="ft-band-disclaimer">📊 Điểm PET Score (Reading) — quy đổi theo bảng chính thức Cambridge cho bài Reading đầy đủ (32 câu).</div>
      `;
    } else {
      document.getElementById("ftBandBox").innerHTML = `
        <div class="band" style="font-size:16px;">Chưa đủ điều kiện quy đổi PET Score</div>
        <div class="ft-band-disclaimer">Bài thi này chỉ gồm ${total}/32 câu (chưa đủ cả 6 Part) nên không tra được điểm PET Score chính thức. Làm đủ Full Test 6 Part (32 câu) để xem điểm quy đổi.</div>
      `;
    }

    const improveList = document.getElementById("ftImproveList");
    const allCorrect = correctCount === total;
    if (weakest.length > 0) {
      improveList.innerHTML = weakest.map(w => `<li>${w}</li>`).join("");
    } else if (allCorrect) {
      improveList.innerHTML = `<li>🎉 Không có điểm yếu nổi bật — làm rất tốt!</li>`;
    } else {
      improveList.innerHTML = `<li>Bài này có ${total - correctCount} câu sai, nhưng chưa có đủ dữ liệu phân loại kỹ năng (subskill) để đưa ra gợi ý cụ thể. Xem lại đáp án đúng trực tiếp trong từng Part.</li>`;
    }

    // Bảng chi tiết từng câu: ĐÚNG -> hiện lý do; SAI -> chỉ báo sai, KHÔNG hiện đáp án/lý do
    const detailBox = document.getElementById("ftDetailList");
    if (detailBox) {
      detailBox.innerHTML = perQuestionResult.map(r => {
        if (r.isCorrect) {
          return `
            <li class="ft-detail-item ft-detail-correct">
              <div class="ft-detail-head">✅ Câu ${r.globalIndex} — ${r.partLabel}</div>
              ${r.correctReason ? `<div class="ft-detail-reason">${r.correctReason}</div>` : ""}
            </li>`;
        }
        return `
          <li class="ft-detail-item ft-detail-wrong">
            <div class="ft-detail-head">❌ Câu ${r.globalIndex} — ${r.partLabel}</div>
          </li>`;
      }).join("");
    }

    const retryBtn = document.getElementById("ftRetryBtn");
    if (retryBtn) {
      retryBtn.onclick = () => { window.location.reload(); };
    }
  }

  function sendToGoogleSheets(payload) {
    fetch(WEBHOOK_URL, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    }).catch(err => console.log("Google Sheets logging error: ", err));
  }

  // ---------------------------------------------------------------------
  // WATERMARK / ANTI-COPY / TAB-SWITCH (giống shared-engine.js)
  // ---------------------------------------------------------------------
  function buildWatermark() {
    const wm = document.getElementById("watermark");
    if (!wm) return;
    const label = (studentName || "PET Reading Full Test") + " • " + new Date().toLocaleDateString("vi-VN");
    const html = [];
    for (let i = 0; i < 40; i++) html.push(`<span>${label}</span>`);
    wm.innerHTML = html.join("");
  }

  function wireAntiCopy() {
    document.addEventListener("copy", function (e) {
      if (antiCheatBypassed) return;
      e.preventDefault();
      if (e.clipboardData) e.clipboardData.setData("text/plain", "");
      alert("⚠️ Hệ thống đã khóa chức năng Sao Chép (Copy)!");
    });
    document.addEventListener("cut", function (e) { if (!antiCheatBypassed) e.preventDefault(); });
    document.addEventListener("contextmenu", function (e) {
      // Cho phép chuột phải riêng trên ô số câu hỏi (để đánh dấu xem lại)
      if (e.target.closest && e.target.closest(".ft-pal-box")) return;
      if (!antiCheatBypassed) e.preventDefault();
    });
    document.addEventListener("dragstart", function (e) { if (!antiCheatBypassed) e.preventDefault(); });
    document.addEventListener("keydown", function (e) {
      if (antiCheatBypassed) return;
      if ((e.ctrlKey || e.metaKey) && ["c", "C", "x", "X", "p", "P"].includes(e.key)) {
        e.preventDefault();
        alert("⚠️ Thao tác sao chép / in ấn bị cấm!");
      }
    });
  }

  function wireTabSwitchCounter() {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && !antiCheatBypassed) {
        tabSwitchCount++;
        const badge = document.getElementById("ftTabBadge");
        if (badge) badge.textContent = `Chuyển tab: ${tabSwitchCount} lần`;
      }
    });
  }

  // ---------------------------------------------------------------------
  // TEACHER QA TOOLBAR
  // ---------------------------------------------------------------------
  function wireTeacherToolbar() {
    document.getElementById("ftAutoFillCorrect").addEventListener("click", () => {
      allQuestions.forEach(q => q.setValue(q.correctValue));
    });
    document.getElementById("ftAutoFillMixed").addEventListener("click", () => {
      allQuestions.forEach((q, i) => q.setValue(i % 2 === 0 ? q.correctValue : (q.wrongValue || q.correctValue)));
    });
    document.getElementById("ftForceTimeout").addEventListener("click", () => {
      endTimestamp = Date.now() - 1000;
    });
    document.getElementById("ftTestSendSheet").addEventListener("click", () => {
      sendToGoogleSheets({
        recordType: "full_test",
        startTime: new Date().toLocaleString("vi-VN"),
        endTime: new Date().toLocaleString("vi-VN"),
        studentName: "TEST (giáo viên)",
        studentCode: "TEST",
        testName: "Full Test (test gửi Sheet)",
        partsIncluded: exercises.map(e => e.exerciseName).join(", "),
        totalQuestions: allQuestions.length,
        correctCount: 0,
        scoreBand: "-",
        weakestSubskills: "-",
        tabSwitchCount: 0,
        durationUsed: "-",
        autoSubmitted: false,
      });
      alert("Đã gửi 1 gói dữ liệu test tới Google Sheet (tab Full Test Results).");
    });
    document.getElementById("ftTestRedoLookup").addEventListener("click", async () => {
      const testCode = prompt("Nhập mã học sinh cần tra cứu (vd: 72013NT):", "");
      if (!testCode) return;
      const url = `${WEBHOOK_URL}?studentCode=${encodeURIComponent(testCode)}`;
      try {
        const res = await fetch(url);
        const rawText = await res.text();
        alert(`URL đã gọi:\n${url}\n\nHTTP status: ${res.status}\n\nPhản hồi thô nhận được:\n${rawText}`);
      } catch (err) {
        alert(`LỖI khi gọi: ${err.message}\n\nURL đã gọi:\n${url}`);
      }
    });
  }

  window.FullTest = FullTest;
  window.addEventListener("DOMContentLoaded", boot);
})(window, document);
