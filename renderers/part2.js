/* =====================================================================
   RENDERER - PART 2 (person-matching bằng dropdown, cấm chọn trùng)
   Schema JSON kỳ vọng:
   {
     partType: "part2",
     exerciseName, webhookUrl,
     correctAnswers: {6:"D", 7:"B", ...},
     people: [{id, name, avatar, text, hint}],
     options: [{letter, title, body}],
     explanation: [{q, name, demand, ans, key}]
   }
   ===================================================================== */

function renderPart2(data, theme) {
  const titleEl = document.getElementById("appTitle");
  const emoji = theme ? theme.titleEmoji : "";
  titleEl.textContent = (emoji ? emoji + " " : "") + data.exerciseName;

  const loginSubtitle = document.getElementById("loginSubtitle");
  if (loginSubtitle && theme) loginSubtitle.textContent = `PET Reading Part 2 - ${theme.mascot}`;

  const target = document.getElementById("partRenderTarget");
  target.innerHTML = `
    <div class="split-container">
      <div class="left-pane" id="leftPane">
        <div id="peopleContainer"></div>
      </div>
      <div class="right-pane" id="rightPane">
        <h2 style="color:var(--primary); font-size:18px; margin-bottom:16px;">OPTIONS</h2>
        <div id="optionsContainer"></div>
      </div>
    </div>
  `;
  document.getElementById("mainApp").classList.add("split-mode");

  document.getElementById("peopleContainer").innerHTML = data.people.map(p => `
    <div class="person-card">
      <div class="person-header">
        <img src="${p.avatar}" class="person-avatar" alt="${p.name}">
        <div><div class="person-title">${p.id}. ${p.name}</div></div>
      </div>
      <p class="person-text">${p.text}</p>
      <div class="answer-select-box">
        <label>Chọn Đáp Án Phù Hợp:</label>
        <select class="ans-select" data-q="${p.id}" onchange="PETEngine.onAnswerChange(${p.id})">
          <option value="">-- Chọn đáp án --</option>
          ${data.options.map(o => `<option value="${o.letter}">${o.letter}. ${o.title}</option>`).join("")}
        </select>
      </div>
      <div class="hint-box" id="hint-${p.id}">${p.hint || ""}</div>
    </div>
  `).join("");

  document.getElementById("optionsContainer").innerHTML = data.options.map(o => `
    <div class="option-card">
      <span class="option-letter">${o.letter}</span> <span class="option-title">${o.title}</span>
      <p class="option-body">${o.body}</p>
    </div>
  `).join("");

  const expContainer = document.getElementById("explanationContainer");
  expContainer.innerHTML = `
    <table class="explanation-table">
      <thead><tr><th>Câu</th><th>Nhân vật & Nhu cầu</th><th>Đáp án</th><th>Giải thích chi tiết</th></tr></thead>
      <tbody>
        ${data.explanation.map(e => `
          <tr>
            <td><strong>${e.q}</strong></td>
            <td><strong>${e.name}</strong>: ${e.demand}</td>
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
    highlightScope: "full",       // Part 2 cho highlight cả 2 bên
    spamThresholdSeconds: 2,
    checkDuplicates: true,         // Part 2 CẤM chọn trùng đáp án
    questionIds: data.people.map(p => p.id),

    getSelectedAnswer(qId) {
      const el = document.querySelector(`.ans-select[data-q="${qId}"]`);
      return el ? el.value : "";
    },

    setAnswerValue(qId, value) {
      const el = document.querySelector(`.ans-select[data-q="${qId}"]`);
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
      document.querySelectorAll(".ans-select").forEach(sel => { sel.value = ""; });
    },
  });
}

registerRenderer("part2", renderPart2);
