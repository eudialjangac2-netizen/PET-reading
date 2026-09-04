/* =====================================================================
   RENDERER - PART 3 (article + MCQ 4 lựa chọn, split-pane)
   Schema JSON kỳ vọng:
   {
     partType: "part3",
     exerciseName, webhookUrl,
     correctAnswers: {11:"B", ...},
     article: { title, author, image, paragraphs: ["...html...", ...] },
     questions: [{id, question, options:[{letter,text}], hint}],
     explanation: [{q, ans, key}]
   }
   ===================================================================== */

function renderPart3(data, theme) {
  const titleEl = document.getElementById("appTitle");
  const emoji = theme ? theme.titleEmoji : "";
  titleEl.textContent = (emoji ? emoji + " " : "") + data.exerciseName;

  const loginSubtitle = document.getElementById("loginSubtitle");
  if (loginSubtitle && theme) loginSubtitle.textContent = `PET Reading Part 3 - ${theme.mascot}`;

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
        <div id="questionsContainer"></div>
      </div>
    </div>
  `;
  document.getElementById("mainApp").classList.add("split-mode");

  let articleHTML = "";
  if (data.article.image) {
    articleHTML += `<div class="article-image-box"><img src="${data.article.image}" alt="Article"></div>`;
  }
  articleHTML += data.article.paragraphs.map(p => `<p style="margin-bottom:14px;">${p}</p>`).join("");
  document.getElementById("articleContent").innerHTML = articleHTML;

  document.getElementById("questionsContainer").innerHTML = data.questions.map(q => `
    <div class="mcq-card">
      <div class="mcq-title">${q.question}</div>
      <div class="mcq-options">
        ${q.options.map(o => `
          <label class="option-label">
            <input type="radio" name="q_${q.id}" value="${o.letter}" onchange="PETEngine.onAnswerChange(${q.id})">
            <span><strong>${o.letter}.</strong> ${o.text}</span>
          </label>
        `).join("")}
      </div>
      <div class="hint-box" id="hint-${q.id}">${q.hint || ""}</div>
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
    highlightScope: "full",       // Part 3 cho highlight cả 2 bên
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

registerRenderer("part3", renderPart3);
