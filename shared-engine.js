/* =====================================================================
   PET READING - SHARED ENGINE
   =====================================================================
   Dùng chung cho toàn bộ 6 Part (Part 1-6). Mỗi trang bai-tap-doc.html
   chỉ cần include file này + gọi PETEngine.init(config) sau khi đã
   render xong UI riêng của partType.

   CÁCH DÙNG (renderer của từng partType phải cung cấp):
   ---------------------------------------------------------------------
   PETEngine.init({
     // --- Thông tin bài ---
     exerciseName: "Test 1 - Part 1",
     webhookUrl: "https://script.google.com/macros/s/.../exec",

     // --- Mã đăng nhập ---
     studentCode: "72PETRB",
     teacherName: "GVPET72",
     teacherCode: "72GRADEBPET",

     // --- Cấu hình theme (tuỳ chọn) ---
     theme: {
       primary: "#d4a017", primaryLight: "#fbe380", accent: "#fbc02d",
       bgMain: "#fcf9e8", borderColor: "#f3e6a1",
       avatarImg: "data:image/png;base64,....",  // ảnh mascot gốc
       titleEmoji: "🍋"
     },

     // --- Highlight ---
     highlightScope: "full" | "left",   // "left" = chỉ #leftPane được highlight

     // --- Anti-spam ---
     spamThresholdSeconds: 1.5,          // Part 6 dùng 0.6 (gõ chữ nhanh hơn chọn)

     // --- Danh sách câu hỏi (bắt buộc) ---
     questionIds: [1,2,3,4,5],

     // --- Hàm đọc/ghi đáp án hiện tại trên DOM (renderer tự viết theo UI) ---
     getSelectedAnswer(qId) { ... return string | "" },
     setAnswerValue(qId, value) { ... },   // dùng cho auto-fill

     // --- Đáp án đúng ---
     getCorrectAnswer(qId) { ... return string },      // giá trị chuẩn (vd "A")
     getAlternateAnswer(qId) { ... return string },    // 1 giá trị SAI hợp lệ, dùng cho Auto-Fill Sai

     // --- Chấm điểm tuỳ biến (tuỳ chọn) ---
     // Mặc định: so khớp val === getCorrectAnswer(qId)
     // Part 6 cần override vì đáp án là mảng nhiều biến thể + không phân biệt hoa/thường
     isCorrectMatch(qId, userVal) { ... return boolean },

     // --- Chặn trùng đáp án (chỉ Part 2 cần true) ---
     checkDuplicates: false,

     // --- Xoá toàn bộ đáp án (dùng khi bị khoá do spam lần 4+) ---
     clearAllAnswers() { ... }
   });

   Các hàm gọi từ HTML (onclick="..."):
     PETEngine.startExercise()
     PETEngine.onAnswerChange(qId)         // gọi trong onchange/oninput của mỗi input
     PETEngine.checkAnswers()
     PETEngine.closeModal()
     PETEngine.applyHighlight(color)
     PETEngine.teacherAutoFill(isCorrect)
     PETEngine.toggleAntiCheat()
     PETEngine.changeWebhookUrl()          // đổi URL runtime (tuỳ chọn dùng)
   ===================================================================== */

(function (window, document) {
  "use strict";

  const PETEngine = {};

  // ---------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------
  let cfg = null;
  let studentName = "";
  let isTeacher = false;
  let startTime = null;
  let attemptCount = 0;
  let tabSwitchCount = 0;
  let spamViolations = 0;
  let lastChangedQuestion = null;
  let lastChangeTimestamp = 0;
  let firstSubmissionDataSent = false;
  let antiCheatBypassed = false;
  let currentSelectionRange = null;

  // ---------------------------------------------------------------------
  // INIT
  // ---------------------------------------------------------------------
  PETEngine.init = function (config) {
    cfg = Object.assign(
      {
        studentCode: "72PETRB",
        teacherName: "GVPET72",
        teacherCode: "72GRADEBPET",
        highlightScope: "full",
        spamThresholdSeconds: 1.5,
        checkDuplicates: false,
        questionIds: [],
      },
      config
    );

    if (cfg.theme) applyTheme(cfg.theme);
    wireAntiCopy();
    wireTabSwitchCounter();
    wireHighlightListener();

    // Trạng thái nút nộp bài ban đầu
    validateAnswersState();
  };

  // ---------------------------------------------------------------------
  // THEME
  // ---------------------------------------------------------------------
  function applyTheme(theme) {
    const root = document.documentElement.style;
    if (theme.primary) root.setProperty("--primary", theme.primary);
    if (theme.primaryLight) root.setProperty("--primary-light", theme.primaryLight);
    if (theme.accent) root.setProperty("--accent", theme.accent);
    if (theme.bgMain) root.setProperty("--bg-main", theme.bgMain);
    if (theme.borderColor) root.setProperty("--border-color", theme.borderColor);

    const avatarEl = document.getElementById("loginAvatarImg");
    if (avatarEl && theme.avatarImg) avatarEl.src = theme.avatarImg;

    const titleEl = document.getElementById("appTitle");
    if (titleEl && theme.titleEmoji && cfg.exerciseName) {
      titleEl.textContent = theme.titleEmoji + " " + cfg.exerciseName;
    }
  }

  // ---------------------------------------------------------------------
  // ANTI-COPY (giống nhau tuyệt đối ở mọi Part)
  // ---------------------------------------------------------------------
  function wireAntiCopy() {
    document.addEventListener("copy", function (e) {
      if (antiCheatBypassed) return;
      e.preventDefault();
      if (e.clipboardData) e.clipboardData.setData("text/plain", "");
      alert("⚠️ Hệ thống đã khóa chức năng Sao Chép (Copy)!");
    });
    document.addEventListener("cut", function (e) { if (!antiCheatBypassed) e.preventDefault(); });
    document.addEventListener("contextmenu", function (e) { if (!antiCheatBypassed) e.preventDefault(); });
    document.addEventListener("dragstart", function (e) { if (!antiCheatBypassed) e.preventDefault(); });
    document.addEventListener("keydown", function (e) {
      if (antiCheatBypassed) return;
      if ((e.ctrlKey || e.metaKey) && ["c", "C", "x", "X", "p", "P"].includes(e.key)) {
        e.preventDefault();
        alert("⚠️ Thao tác sao chép / in ấn bị cấm!");
      }
    });
  }

  // ---------------------------------------------------------------------
  // TAB-SWITCH COUNTER
  // ---------------------------------------------------------------------
  function wireTabSwitchCounter() {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && !antiCheatBypassed) {
        tabSwitchCount++;
        updateTabBadge();
      }
    });
  }

  function updateTabBadge() {
    const badge = document.getElementById("tabBadge");
    if (badge) badge.textContent = `Chuyển tab: ${tabSwitchCount} lần`;
  }

  // ---------------------------------------------------------------------
  // LOGIN
  // ---------------------------------------------------------------------
  PETEngine.startExercise = function () {
    const nameInput = (document.getElementById("studentName").value || "").trim();
    const codeInput = (document.getElementById("accessCode").value || "").trim();
    if (!nameInput) { alert("Vui lòng nhập Họ và Tên!"); return; }

    if (nameInput === cfg.teacherName && codeInput === cfg.teacherCode) {
      isTeacher = true;
      antiCheatBypassed = true; // Giáo viên đăng nhập -> tự động bypass toàn bộ anti-cheat/spam
      const toolbar = document.getElementById("teacherToolbar");
      if (toolbar) toolbar.style.display = "flex";
    } else if (codeInput !== cfg.studentCode) {
      alert("Mã xác nhận bài tập không đúng!");
      return;
    }

    studentName = nameInput;
    startTime = new Date();
    buildWatermark();
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainApp").style.display = "flex";
  };

  // ---------------------------------------------------------------------
  // WATERMARK (chống chụp lén đề bài — hiển thị mờ, không cản trở đọc bài)
  // ---------------------------------------------------------------------
  function buildWatermark() {
    const wm = document.getElementById("watermark");
    if (!wm) return;
    const label = (studentName || cfg.exerciseName || "PET Reading") + " • " + new Date().toLocaleDateString("vi-VN");
    const html = [];
    for (let i = 0; i < 40; i++) {
      html.push(`<span>${label}</span>`);
    }
    wm.innerHTML = html.join("");
  }

  // ---------------------------------------------------------------------
  // HIGHLIGHT
  // ---------------------------------------------------------------------
  function wireHighlightListener() {
    document.addEventListener("selectionchange", function () {
      const selection = window.getSelection();
      const hlPopup = document.getElementById("hlPopup");
      if (!hlPopup) return;

      const scopeEl = cfg.highlightScope === "left" ? document.getElementById("leftPane") : document;

      if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
        const anchorNode = selection.anchorNode;
        const inScope = cfg.highlightScope === "left"
          ? (scopeEl && scopeEl.contains(anchorNode))
          : true;

        if (inScope) {
          try {
            const range = selection.getRangeAt(0);
            currentSelectionRange = range.cloneRange();
            const rect = range.getBoundingClientRect();
            hlPopup.style.display = "flex";
            hlPopup.style.top = (window.scrollY + rect.top - 45) + "px";
            hlPopup.style.left = (window.scrollX + rect.left + (rect.width / 2) - 75) + "px";
            return;
          } catch (e) { /* ignore */ }
        }
      }

      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) hlPopup.style.display = "none";
      }, 200);
    });
  }

  PETEngine.applyHighlight = function (color) {
    let range = currentSelectionRange;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) range = selection.getRangeAt(0);
    if (!range) return;

    if (color === "remove") {
      const container = range.commonAncestorContainer;
      let markElem = container.nodeType === 3 ? container.parentElement : container;
      while (markElem && markElem.tagName !== "MARK" && markElem.parentElement) {
        markElem = markElem.parentElement;
      }
      if (markElem && markElem.tagName === "MARK") {
        const textNode = document.createTextNode(markElem.textContent);
        markElem.parentNode.replaceChild(textNode, markElem);
      }
    } else {
      const mark = document.createElement("mark");
      mark.className = "hl-" + color;
      try {
        mark.appendChild(range.extractContents());
        range.insertNode(mark);
      } catch (e) { /* ignore */ }
    }
    if (selection) selection.removeAllRanges();
    const hlPopup = document.getElementById("hlPopup");
    if (hlPopup) hlPopup.style.display = "none";
    currentSelectionRange = null;
  };

  // ---------------------------------------------------------------------
  // ANSWER CHANGE + ANTI-SPAM
  // ---------------------------------------------------------------------
  PETEngine.onAnswerChange = function (qId) {
    const now = Date.now();
    if (!antiCheatBypassed && lastChangedQuestion !== null && lastChangedQuestion !== qId) {
      if ((now - lastChangeTimestamp) / 1000 < cfg.spamThresholdSeconds) {
        triggerSpamPenalty();
      }
    }
    lastChangedQuestion = qId;
    lastChangeTimestamp = now;
    validateAnswersState();
  };

  function triggerSpamPenalty() {
    spamViolations++;
    const overlay = document.getElementById("lockOverlay");
    const timerElem = document.getElementById("lockTimer");
    const titleElem = document.getElementById("lockTitle");
    if (!overlay) return;

    let lockSeconds = 5;
    if (spamViolations === 1) lockSeconds = 5;
    else if (spamViolations === 2) lockSeconds = 10;
    else if (spamViolations === 3) lockSeconds = 30;
    else if (spamViolations >= 4) {
      if (typeof cfg.clearAllAnswers === "function") cfg.clearAllAnswers();
      validateAnswersState();
      alert("⚠️ Vi phạm thao tác nhiều lần! Hệ thống đã xóa toàn bộ đáp án.");
      return;
    }

    if (titleElem) titleElem.textContent = `⚠️ CẢNH BÁO THAO TÁC QUÁ NHANH (LẦN ${spamViolations})`;
    if (timerElem) timerElem.textContent = lockSeconds;
    overlay.style.display = "flex";

    let remaining = lockSeconds;
    const interval = setInterval(() => {
      remaining--;
      if (timerElem) timerElem.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(interval);
        overlay.style.display = "none";
      }
    }, 1000);
  }

  // ---------------------------------------------------------------------
  // VALIDATE STATE (nút Submit + thông báo trạng thái + cảnh báo trùng)
  // ---------------------------------------------------------------------
  function validateAnswersState() {
    if (!cfg) return;
    const btnSubmit = document.getElementById("btnSubmit");
    const statusText = document.getElementById("statusText");
    const dupTooltip = document.getElementById("dupTooltip");
    const total = cfg.questionIds.length;

    const currentValues = cfg.questionIds.map(qId => cfg.getSelectedAnswer(qId));
    const answeredCount = currentValues.filter(v => v && v !== "").length;

    if (cfg.checkDuplicates) {
      const filled = currentValues.filter(v => v && v !== "");
      const hasDup = new Set(filled).size !== filled.length;
      if (hasDup) {
        if (btnSubmit) btnSubmit.disabled = true;
        if (dupTooltip) dupTooltip.style.display = "block";
        if (statusText) {
          statusText.textContent = "Phát hiện đáp án trùng lặp giữa các câu!";
          statusText.style.color = "#c53030";
        }
        return;
      } else if (dupTooltip) {
        dupTooltip.style.display = "none";
      }
    }

    if (!btnSubmit || !statusText) return;

    if (answeredCount === total) {
      btnSubmit.disabled = false;
      statusText.textContent = "Đã hoàn thành tất cả câu hỏi. Sẵn sàng nộp bài!";
      statusText.style.color = "var(--primary)";
    } else {
      btnSubmit.disabled = true;
      statusText.textContent = `Đã làm ${answeredCount}/${total} câu. Vui lòng hoàn thành tất cả.`;
      statusText.style.color = "var(--text-muted)";
    }
  }
  PETEngine.validateAnswersState = validateAnswersState;

  // ---------------------------------------------------------------------
  // CHECK ANSWERS
  // ---------------------------------------------------------------------
  PETEngine.checkAnswers = function () {
    attemptCount++;
    const userAnswers = {};
    let correctCount = 0;

    cfg.questionIds.forEach(qId => {
      const val = cfg.getSelectedAnswer(qId);
      userAnswers[qId] = val;
      const isCorrect = typeof cfg.isCorrectMatch === "function"
        ? cfg.isCorrectMatch(qId, val)
        : (val === cfg.getCorrectAnswer(qId));
      if (isCorrect) correctCount++;
    });

    if (!firstSubmissionDataSent) {
      sendDataToGoogleSheets(correctCount);
      firstSubmissionDataSent = true;
    }

    const total = cfg.questionIds.length;

    if (correctCount === total) {
      renderResultSummary();
      const resultModal = document.getElementById("resultModal");
      if (resultModal) resultModal.style.display = "block";
    } else {
      const modalDesc = document.getElementById("modalDesc");
      if (modalDesc) {
        modalDesc.textContent = `Bạn làm đúng ${correctCount}/${total} câu. Bạn cần làm đúng 100% để hoàn thành.`;
      }
      const modalOverlay = document.getElementById("modalOverlay");
      if (modalOverlay) modalOverlay.style.display = "flex";

      if (attemptCount >= 2) {
        cfg.questionIds.forEach(qId => {
          const isCorrect = typeof cfg.isCorrectMatch === "function"
            ? cfg.isCorrectMatch(qId, userAnswers[qId])
            : (userAnswers[qId] === cfg.getCorrectAnswer(qId));
          if (!isCorrect) {
            const hintElem = document.getElementById("hint-" + qId);
            if (hintElem) hintElem.style.display = "block";
          }
        });
      }
    }
  };

  PETEngine.closeModal = function () {
    const modalOverlay = document.getElementById("modalOverlay");
    if (modalOverlay) modalOverlay.style.display = "none";
  };

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds} giây`;
    return `${minutes} phút ${seconds} giây`;
  }

  function renderResultSummary() {
    const box = document.getElementById("resultSummaryBox");
    if (!box) return;
    const now = new Date();
    const durationText = startTime ? formatDuration(now - startTime) : "-";
    box.innerHTML = `
      <div class="result-summary-item">
        <span class="label">👤 Học sinh</span>
        <span class="value">${studentName || "-"}</span>
      </div>
      <div class="result-summary-item">
        <span class="label">📅 Ngày làm bài</span>
        <span class="value">${now.toLocaleDateString("vi-VN")}</span>
      </div>
      <div class="result-summary-item">
        <span class="label">⏱️ Thời gian hoàn thành</span>
        <span class="value">${durationText}</span>
      </div>
    `;
  }

  // ---------------------------------------------------------------------
  // GOOGLE SHEETS LOGGING
  // ---------------------------------------------------------------------
  function sendDataToGoogleSheets(firstScore) {
    if (!cfg.webhookUrl || cfg.webhookUrl.includes("YOUR_WEBHOOK_URL")) {
      console.warn("Chưa cấu hình Google Webhook URL hợp lệ.");
      return;
    }
    const total = cfg.questionIds.length;
    const payload = {
      startTime: startTime ? startTime.toLocaleString("vi-VN") : "",
      endTime: new Date().toLocaleString("vi-VN"),
      exerciseName: cfg.exerciseName,
      studentName: studentName + (isTeacher ? " [TEST]" : ""),
      firstScore: `${firstScore}/${total}`,
      attemptCount: attemptCount,
      tabSwitchCount: tabSwitchCount,
      status: firstScore === total ? "Hoàn thành 100% lần 1" : "Đã nộp lần 1 (Đang làm lại)",
    };

    fetch(cfg.webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    })
      .then(() => console.log("Đã gửi dữ liệu thành công tới Google Sheets!"))
      .catch(err => console.log("Google Sheets logging error: ", err));
  }

  PETEngine.changeWebhookUrl = function () {
    const newUrl = prompt("Nhập Google Apps Script Webhook URL mới:", cfg.webhookUrl);
    if (newUrl !== null && newUrl.trim() !== "") {
      cfg.webhookUrl = newUrl.trim();
      alert("Đã cập nhật Webhook URL thành công!");
    }
  };

  // ---------------------------------------------------------------------
  // TEACHER TOOLS
  // ---------------------------------------------------------------------
  // Auto-fill tổng quát cho mọi partType:
  //  - isCorrect = true  -> điền đúng hết
  //  - isCorrect = false -> cố tình điền SAI 2 câu đầu tiên, còn lại điền đúng
  PETEngine.teacherAutoFill = function (isCorrect) {
    const tempBypass = antiCheatBypassed;
    antiCheatBypassed = true;

    cfg.questionIds.forEach((qId, index) => {
      let targetVal = cfg.getCorrectAnswer(qId);
      if (!isCorrect && index < 2 && typeof cfg.getAlternateAnswer === "function") {
        targetVal = cfg.getAlternateAnswer(qId);
      }
      cfg.setAnswerValue(qId, targetVal);
    });

    validateAnswersState();
    antiCheatBypassed = tempBypass;
  };

  PETEngine.toggleAntiCheat = function () {
    antiCheatBypassed = !antiCheatBypassed;
    alert("Anti-Cheat / Anti-Spam: " + (antiCheatBypassed ? "ĐÃ TẮT" : "ĐÃ BẬT"));
  };

  // ---------------------------------------------------------------------
  window.PETEngine = PETEngine;
})(window, document);
