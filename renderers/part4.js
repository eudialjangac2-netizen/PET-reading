/* =====================================================================
   RENDERER - PART 4 (cloze bằng dropdown nhúng trong đề, không cấm trùng)
   Schema JSON kỳ vọng:
   {
     partType: "part4",
     exerciseName, webhookUrl,
     correctAnswers: {33:"C", 34:"F", ...},
     gapIds: [33, 34, 35, 36, 37],           // thứ tự các chỗ trống
     article: {
       title, author, image,
       paragraphs: ["...text... {{gap:33}} ...text... {{gap:34}} ...", "..."]
     },
     options: [{letter, title, body}],        // 8 lựa chọn cố định
     explanation: [{q, ans, key}]
   }

   Token {{gap:ID}} trong paragraphs sẽ được thay bằng 1 thẻ <select> nhúng
   ngay trong câu văn, cho phép chọn 1 trong 8 option (A-H) cho từng chỗ trống.
   ===================================================================== */

function renderPart4(data, theme) {
  const titleEl = document.getElementById("appTitle");
  const emoji = theme ? theme.titleEmoji : "";
  titleEl.textContent = (emoji ? emoji + " " : "") + data.exerciseName;

  const loginSubtitle = document.getElementById("loginSubtitle");
  if (loginSubtitle && theme) loginSubtitle.textContent = `PET Reading Part 4 - ${theme.mascot}`;

  const target = document.getElementById("partRenderTarget");
  target.innerHTML = `
    <div class="split-container">
      <div class="left-pane" id="leftPane">
        <h2 class="article-title">${data.article.title}</h2>
        <div class="article-author">${data.article.author || ""}</div>
        <div class="article-content" id="articleContent"></div>
      </div>
      <div class="right-pane" id="rightPane">
        <h2 style="color:var(--primary); font-size:18px; margin-bottom:16px;">OPTIONS (A - ${String.fromCharCode(64 + data.options.length)})</h2>
        <div id="optionsContainer"></div>
      </div>
    </div>
  `;
  document.getElementById("mainApp").classList.add("split-mode");

  // Xây select cho từng gap, chèn ngược vào token {{gap:ID}}
  function buildGapSelect(gapId) {
    const optionsHTML = data.options.map(o => `<option value="${o.letter}">${o.letter}</option>`).join("");
    return `<select class="inline-gap-select" data-q="${gapId}" onchange="PETEngine.onAnswerChange(${gapId})">
      <option value="">(${gapId})</option>${optionsHTML}
    </select>`;
  }

  let articleHTML = "";
  if (data.article.image) {
    articleHTML += `<div class="article-image-box"><img src="${data.article.image}" alt="Article"></div>`;
  }
  articleHTML += data.article.paragraphs.map(p => {
    return "<p style='margin-bottom:14px;'>" + p.replace(/\{\{gap:(\d+)\}\}/g, (match, id) => buildGapSelect(id)) + "</p>";
  }).join("");
  document.getElementById("articleContent").innerHTML = articleHTML;

  document.getElementById("optionsContainer").innerHTML = data.options.map(o => `
    <div class="option-card">
      <span class="option-letter">${o.letter}</span> <span class="option-title">${o.title}</span>
      <p class="option-body">${o.body}</p>
    </div>
  `).join("");

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

  PETEngine.init({
    exerciseName: data.exerciseName,
    webhookUrl: data.webhookUrl,
    theme: theme,
    highlightScope: "full",       // Part 4 cho highlight cả 2 bên (giống Part 2)
    spamThresholdSeconds: 1.5,
    checkDuplicates: false,        // Part 4 KHÔNG cấm chọn trùng đáp án
    questionIds: data.gapIds,

    getSelectedAnswer(qId) {
      const el = document.querySelector(`.inline-gap-select[data-q="${qId}"]`);
      return el ? el.value : "";
    },

    setAnswerValue(qId, value) {
      const el = document.querySelector(`.inline-gap-select[data-q="${qId}"]`);
      if (el) el.value = value;
    },

    getCorrectAnswer(qId) {
      return data.correctAnswers[qId];
    },

    getAlternateAnswer(qId) {
      const correct = data.correctAnswers[qId];
      const alt = data.options.find(o => o.letter !== correct);
      return alt ? alt.letter : correct;
    },

    clearAllAnswers() {
      document.querySelectorAll(".inline-gap-select").forEach(sel => { sel.value = ""; });
    },
  });
}

registerRenderer("part4", renderPart4);
