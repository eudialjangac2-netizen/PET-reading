/* =====================================================================
   RENDERER - PART 6 (open cloze, ô nhập text tự do)
   Schema JSON kỳ vọng:
   {
     partType: "part6",
     exerciseName, webhookUrl,
     correctAnswers: {27: ["there","is there"], 28: ["been"], ...},  // mảng biến thể, không phân biệt hoa/thường
     article: { title, author, image, paragraphs: ["...<span class='gap-tag'>(27)</span>....", ...] },
     questions: [{id, label, placeholder, hint}],
     explanation: [{q, ans, key}]
   }
   ===================================================================== */

function renderPart6(data, theme) {
  const titleEl = document.getElementById("appTitle");
  const emoji = theme ? theme.titleEmoji : "";
  titleEl.textContent = (emoji ? emoji + " " : "") + data.exerciseName;

  const loginSubtitle = document.getElementById("loginSubtitle");
  if (loginSubtitle && theme) loginSubtitle.textContent = `PET Reading Part 6 - ${theme.mascot}`;

  const minQ = Math.min(...data.questions.map(q => q.id));
  const maxQ = Math.max(...data.questions.map(q => q.id));

  const target = document.getElementById("partRenderTarget");
  target.innerHTML = `
    <div class="split-container">
      <div class="left-pane" id="leftPane">
        <h2 class="article-title">${data.article.title}</h2>
        <div class="article-author">${data.article.author || ""}</div>
        <div class="article-content" id="articleContent"></div>
      </div>
      <div class="right-pane" id="rightPane">
        <h2 style="color:var(--primary); font-size:18px; margin-bottom:16px;">QUESTIONS (${minQ} - ${maxQ})</h2>
        <p style="font-size:14px; color:var(--text-muted); margin-bottom:18px; font-weight:600;">Điền ĐÚNG 1 TỪ vào mỗi ô trống tương ứng:</p>
        <div id="questionsContainer"></div>
      </div>
    </div>
  `;
  document.getElementById("mainApp").classList.add("split-mode");

  let articleHTML = "";
  if (data.article.image) {
    articleHTML += `<div class="article-image-box"><img src="${data.article.image}" alt="Article"></div>`;
  }
  articleHTML += data.article.paragraphs.map(p => `<p style="margin-bottom:16px;">${p}</p>`).join("");
  document.getElementById("articleContent").innerHTML = articleHTML;

  document.getElementById("questionsContainer").innerHTML = data.questions.map(q => `
    <div class="gap-card">
      <div class="gap-title"><span>Gap (${q.id})</span></div>
      <div class="gap-input-wrapper">
        <input type="text" class="gap-text-input" id="input_q_${q.id}"
               placeholder="${q.placeholder || ""}"
               oninput="PETEngine.onAnswerChange(${q.id})"
               autocomplete="off" spellcheck="false">
      </div>
      <div class="hint-box" id="hint-${q.id}">${q.hint || ""}</div>
    </div>
  `).join("");

  const expContainer = document.getElementById("explanationContainer");
  expContainer.innerHTML = `
    <table class="explanation-table">
      <thead><tr><th>Câu</th><th>Đáp án đúng</th><th>Giải thích chi tiết</th></tr></thead>
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

  PETEngine.init({
    exerciseName: data.exerciseName,
    webhookUrl: data.webhookUrl,
    theme: theme,
    highlightScope: "left",       // Part 6 chỉ highlight bài đọc bên trái
    spamThresholdSeconds: 0.6,     // gõ chữ nhanh hơn chọn radio nên ngưỡng thấp hơn
    checkDuplicates: false,
    questionIds: data.questions.map(q => q.id),

    getSelectedAnswer(qId) {
      const el = document.getElementById(`input_q_${qId}`);
      return el ? el.value.trim() : "";
    },

    setAnswerValue(qId, value) {
      const el = document.getElementById(`input_q_${qId}`);
      if (el) el.value = value;
    },

    getCorrectAnswer(qId) {
      // Dùng biến thể đầu tiên làm giá trị "chuẩn" (phục vụ Auto-Fill Đúng)
      return data.correctAnswers[qId][0];
    },

    getAlternateAnswer(qId) {
      return "sai_" + qId; // 1 chuỗi chắc chắn không khớp đáp án nào, dùng cho Auto-Fill Sai
    },

    // Chấm điểm: chấp nhận nhiều biến thể, không phân biệt hoa/thường
    isCorrectMatch(qId, userVal) {
      const allowed = data.correctAnswers[qId].map(a => a.toLowerCase());
      return allowed.includes((userVal || "").toLowerCase());
    },

    clearAllAnswers() {
      data.questions.forEach(q => {
        const el = document.getElementById(`input_q_${q.id}`);
        if (el) el.value = "";
      });
    },
  });
}

registerRenderer("part6", renderPart6);
