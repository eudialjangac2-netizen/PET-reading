/* =====================================================================
   FULL TEST - RENDER FUNCTIONS THEO PARTTYPE
   Giữ NGUYÊN layout gốc của từng Part (giống bai-tap-doc.html):
     - Part 1: grid từng câu (part1-item-card / part1-grid)
     - Part 2-6: split-pane (split-container / left-pane / right-pane)
   Khác biệt duy nhất so với renderers/partN.js:
     - Không gọi PETEngine.init (Full Test có bộ máy chấm điểm riêng)
     - Số câu hiển thị là SỐ TOÀN CỤC (không phải số gốc trong đề)
     - Mỗi hàm trả về { html, questions } — html để chèn vào 1 "view" riêng
       của Part đó (full-test-engine.js quản lý việc chuyển tab giữa các view)

   Mỗi hàm nhận (data, startIndex) trả về:
   {
     html: "...",                 // toàn bộ nội dung 1 "view" của Part (đã có class split-container/part1-grid...)
     questions: [ { globalIndex, localId, subskill, getValue(), isCorrect(val) } ]
   }
   ===================================================================== */

function ftRenderPart1(data, startIndex) {
  const questions = [];
  const itemsHtml = data.questions.map((q, i) => {
    const g = startIndex + i;
    questions.push({
      globalIndex: g, localId: q.id,
      subskill: subskillFor(data, q.id),
      getValue: () => { const el = document.querySelector(`input[name="ft_q_${g}"]:checked`); return el ? el.value : ""; },
      setValue: (val) => { const el = document.querySelector(`input[name="ft_q_${g}"][value="${val}"]`); if (el) { el.checked = true; FullTest.onAnswer(g); } },
      correctValue: data.correctAnswers[q.id],
      wrongValue: (q.options.find(o => o.letter !== data.correctAnswers[q.id]) || {}).letter,
      isCorrect: (val) => val === data.correctAnswers[q.id],
    });
    return `
      <div class="part1-item-card ft-question" id="ft-q-${g}">
        <div class="q-num-badge">Câu ${g}</div>
        <div class="part1-grid">
          <div class="left-box">${q.leftContentHTML}</div>
          <div class="right-box">
            <div class="mcq-options">
              ${q.options.map(o => `
                <label class="option-label">
                  <input type="radio" name="ft_q_${g}" value="${o.letter}"
                         onchange="FullTest.onAnswer(${g})">
                  <span><strong>${o.letter}.</strong> ${o.text}</span>
                </label>
              `).join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  const html = `<div class="questions-scroll-area">${itemsHtml}</div>`;
  return { html, questions, layout: "grid" };
}

function ftRenderPart2(data, startIndex) {
  const questions = [];
  const peopleHtml = data.people.map((p, i) => {
    const g = startIndex + i;
    questions.push({
      globalIndex: g, localId: p.id,
      subskill: subskillFor(data, p.id),
      getValue: () => { const el = document.getElementById(`ft-select-${g}`); return el ? el.value : ""; },
      setValue: (val) => { const el = document.getElementById(`ft-select-${g}`); if (el) { el.value = val; FullTest.onAnswer(g); } },
      correctValue: data.correctAnswers[p.id],
      wrongValue: (data.options.find(o => o.letter !== data.correctAnswers[p.id]) || {}).letter,
      isCorrect: (val) => val === data.correctAnswers[p.id],
    });
    return `
      <div class="person-card ft-question" id="ft-q-${g}">
        <div class="person-header">
          <img src="${p.avatar}" class="person-avatar" alt="${p.name}">
          <div><div class="person-title">Câu ${g} — ${p.name}</div></div>
        </div>
        <p class="person-text">${p.text}</p>
        <div class="answer-select-box">
          <label>Chọn Đáp Án:</label>
          <select id="ft-select-${g}" onchange="FullTest.onAnswer(${g})">
            <option value="">-- Chọn --</option>
            ${data.options.map(o => `<option value="${o.letter}">${o.letter}. ${o.title}</option>`).join("")}
          </select>
        </div>
      </div>
    `;
  }).join("");

  const optionsHtml = data.options.map(o => `
    <div class="option-card">
      <span class="option-letter">${o.letter}</span> <span class="option-title">${o.title}</span>
      <p class="option-body">${o.body}</p>
    </div>
  `).join("");

  const html = `
    <div class="split-container">
      <div class="left-pane">${peopleHtml}</div>
      <div class="right-pane">
        <h2 style="color:var(--primary); font-size:18px; margin-bottom:16px;">OPTIONS</h2>
        ${optionsHtml}
      </div>
    </div>
  `;
  return { html, questions, layout: "split" };
}

function ftRenderPart3(data, startIndex) {
  const questions = [];
  let articleHtml = "";
  if (data.article.image) articleHtml += `<div class="article-image-box"><img src="${data.article.image}" alt="Article"></div>`;
  articleHtml += `<h2 class="article-title">${data.article.title}</h2><div class="article-author">${data.article.author || ""}</div>`;
  articleHtml += data.article.paragraphs.map(p => `<p style="margin-bottom:14px;">${p}</p>`).join("");

  const qHtml = data.questions.map((q, i) => {
    const g = startIndex + i;
    questions.push({
      globalIndex: g, localId: q.id,
      subskill: subskillFor(data, q.id),
      getValue: () => { const el = document.querySelector(`input[name="ft_q_${g}"]:checked`); return el ? el.value : ""; },
      setValue: (val) => { const el = document.querySelector(`input[name="ft_q_${g}"][value="${val}"]`); if (el) { el.checked = true; FullTest.onAnswer(g); } },
      correctValue: data.correctAnswers[q.id],
      wrongValue: (q.options.find(o => o.letter !== data.correctAnswers[q.id]) || {}).letter,
      isCorrect: (val) => val === data.correctAnswers[q.id],
    });
    return `
      <div class="mcq-card ft-question" id="ft-q-${g}">
        <div class="mcq-title">Câu ${g} — ${q.question.replace(/^\d+\.\s*/, "")}</div>
        <div class="mcq-options">
          ${q.options.map(o => `
            <label class="option-label">
              <input type="radio" name="ft_q_${g}" value="${o.letter}" onchange="FullTest.onAnswer(${g})">
              <span><strong>${o.letter}.</strong> ${o.text}</span>
            </label>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  const html = `
    <div class="split-container">
      <div class="left-pane">${articleHtml}</div>
      <div class="right-pane">${qHtml}</div>
    </div>
  `;
  return { html, questions, layout: "split" };
}

function ftRenderPart4(data, startIndex) {
  const questions = [];
  data.gapIds.forEach((gapId, i) => {
    const g = startIndex + i;
    questions.push({
      globalIndex: g, localId: gapId,
      subskill: subskillFor(data, gapId),
      getValue: () => { const el = document.getElementById(`ft-q-${g}`); return el ? el.value : ""; },
      setValue: (val) => { const el = document.getElementById(`ft-q-${g}`); if (el) { el.value = val; FullTest.onAnswer(g); } },
      correctValue: data.correctAnswers[gapId],
      wrongValue: (data.options.find(o => o.letter !== data.correctAnswers[gapId]) || {}).letter,
      isCorrect: (val) => val === data.correctAnswers[gapId],
    });
  });

  function buildGapSelect(localGapId) {
    const g = startIndex + data.gapIds.indexOf(Number(localGapId));
    const optionsHTML = data.options.map(o => `<option value="${o.letter}">${o.letter}</option>`).join("");
    return `<select class="inline-gap-select ft-question" id="ft-q-${g}" onchange="FullTest.onAnswer(${g})">
      <option value="">(${g})</option>${optionsHTML}
    </select>`;
  }

  let articleHtml = "";
  if (data.article.image) articleHtml += `<div class="article-image-box"><img src="${data.article.image}" alt="Article"></div>`;
  articleHtml += `<h2 class="article-title">${data.article.title}</h2><div class="article-author">${data.article.author || ""}</div>`;
  articleHtml += data.article.paragraphs.map(p =>
    "<p style='margin-bottom:14px;'>" + p.replace(/\{\{gap:(\d+)\}\}/g, (m, id) => buildGapSelect(id)) + "</p>"
  ).join("");

  const optionsHtml = data.options.map(o => `
    <div class="option-card">
      <span class="option-letter">${o.letter}</span> <span class="option-title">${o.title}</span>
    </div>
  `).join("");

  const html = `
    <div class="split-container">
      <div class="left-pane">${articleHtml}</div>
      <div class="right-pane">
        <h2 style="color:var(--primary); font-size:18px; margin-bottom:16px;">OPTIONS</h2>
        ${optionsHtml}
      </div>
    </div>
  `;
  return { html, questions, layout: "split" };
}

function ftRenderPart5(data, startIndex) {
  return ftRenderPart3(data, startIndex);
}

function ftRenderPart6(data, startIndex) {
  const questions = [];
  data.questions.forEach((q, i) => {
    const g = startIndex + i;
    const allowed = data.correctAnswers[q.id].map(a => a.toLowerCase());
    questions.push({
      globalIndex: g, localId: q.id,
      subskill: subskillFor(data, q.id),
      getValue: () => { const el = document.getElementById(`ft-input-${g}`); return el ? el.value : ""; },
      setValue: (val) => { const el = document.getElementById(`ft-input-${g}`); if (el) { el.value = val; FullTest.onAnswer(g); } },
      correctValue: data.correctAnswers[q.id][0],
      wrongValue: "sai_" + g,
      isCorrect: (val) => allowed.includes((val || "").trim().toLowerCase()),
    });
  });

  let articleHtml = "";
  if (data.article.image) articleHtml += `<div class="article-image-box"><img src="${data.article.image}" alt="Article"></div>`;
  articleHtml += `<h2 class="article-title">${data.article.title}</h2><div class="article-author">${data.article.author || ""}</div>`;
  articleHtml += data.article.paragraphs.map(p => `<p style="margin-bottom:16px;">${p}</p>`).join("");

  const qHtml = data.questions.map((q, i) => {
    const g = startIndex + i;
    return `
      <div class="gap-card ft-question" id="ft-q-${g}">
        <div class="gap-title"><span>Câu ${g} — Gap (${q.id})</span></div>
        <input type="text" class="gap-text-input" id="ft-input-${g}" placeholder="${q.placeholder || ""}"
               oninput="FullTest.onAnswer(${g})" autocomplete="off" spellcheck="false">
      </div>
    `;
  }).join("");

  const html = `
    <div class="split-container">
      <div class="left-pane">${articleHtml}</div>
      <div class="right-pane">${qHtml}</div>
    </div>
  `;
  return { html, questions, layout: "split" };
}

function subskillFor(data, localId) {
  const e = (data.explanation || []).find(x => x.q === localId);
  return e ? (e.subskill || null) : null;
}

const FT_RENDERERS = {
  part1: ftRenderPart1, part2: ftRenderPart2, part3: ftRenderPart3,
  part4: ftRenderPart4, part5: ftRenderPart5, part6: ftRenderPart6,
};
