/* =====================================================================
   RENDERER - PART 1 (notice/message/sign matching, dạng grid từng câu)
   Layout: giữ nguyên như file gốc — mỗi câu là 1 card, bên trong chia
   2 cột (đề bên trái / đáp án ABC bên phải), KHÔNG dùng split-pane.
   ===================================================================== */

function renderPart1(data, theme) {
  // ---- Header ----
  const titleEl = document.getElementById("appTitle");
  const emoji = theme ? theme.titleEmoji : "";
  titleEl.textContent = (emoji ? emoji + " " : "") + data.exerciseName;

  const loginSubtitle = document.getElementById("loginSubtitle");
  if (loginSubtitle && theme) {
    loginSubtitle.textContent = `PET Reading Part 1 - ${theme.mascot}`;
  }

  // ---- Render câu hỏi ----
  const target = document.getElementById("partRenderTarget");
  const wrapper = document.createElement("div");
  wrapper.className = "questions-scroll-area";

  wrapper.innerHTML = data.questions.map(q => `
    <div class="part1-item-card">
      <div class="q-num-badge">Question ${q.id}</div>
      <div class="part1-grid">
        <div class="left-box">${q.leftContentHTML}</div>
        <div class="right-box">
          ${q.promptQuestion ? `<div style="font-weight:700; margin-bottom:8px;">${q.promptQuestion}</div>` : ""}
          <div class="mcq-options">
            ${q.options.map(o => `
              <label class="option-label">
                <input type="radio" name="q_${q.id}" value="${o.letter}"
                       onchange="PETEngine.onAnswerChange(${q.id})">
                <span><strong>${o.letter}.</strong> ${o.text}</span>
              </label>
            `).join("")}
          </div>
        </div>
        <div class="hint-box" id="hint-${q.id}">${q.hint || ""}</div>
      </div>
    </div>
  `).join("");

  target.innerHTML = "";
  target.appendChild(wrapper);

  // ---- Render bảng giải thích (trong resultModal) ----
  const expContainer = document.getElementById("explanationContainer");
  expContainer.innerHTML = `
    <table class="explanation-table">
      <thead><tr><th>Câu</th><th>Đáp án</th><th>Giải thích chi tiết</th></tr></thead>
      <tbody>
        ${data.explanation.map(e => `
          <tr>
            <td><strong>Câu ${e.q}</strong></td>
            <td><strong style="color:var(--primary);">${e.ans}</strong></td>
            <td>${e.key}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  // ---- Khởi động Shared Engine với các hàm đọc/ghi DOM riêng của Part 1 ----
  PETEngine.init({
    exerciseName: data.exerciseName,
    webhookUrl: data.webhookUrl,
    theme: theme,
    highlightScope: "full",       // Part 1 cho highlight cả 2 bên
    spamThresholdSeconds: 1.5,
    checkDuplicates: false,
    questionIds: data.questions.map(q => q.id),

    getSelectedAnswer(qId) {
      const el = document.querySelector(`input[name="q_${qId}"]:checked`);
      return el ? el.value : "";
    },

    setAnswerValue(qId, value) {
      const el = document.querySelector(`input[name="q_${qId}"][value="${value}"]`);
      if (el) el.checked = true;
    },

    getCorrectAnswer(qId) {
      return data.correctAnswers[qId];
    },

    getAlternateAnswer(qId) {
      const q = data.questions.find(item => item.id === qId);
      const correct = data.correctAnswers[qId];
      const alt = q.options.find(o => o.letter !== correct);
      return alt ? alt.letter : correct;
    },

    clearAllAnswers() {
      document.querySelectorAll('#partRenderTarget input[type="radio"]').forEach(r => { r.checked = false; });
    },
  });
}

// Đăng ký renderer này cho partType "part1"
registerRenderer("part1", renderPart1);
