/* =====================================================================
   SPLIT RESIZER - thanh kéo tăng/giảm độ rộng giữa .left-pane / .right-pane
   Dùng chung cho bai-tap-doc.html (bài lẻ) và full-test-doc.html (Full Test).

   Cách dùng: sau khi DOM của .split-container đã được render xong (renderer
   đổ HTML vào, hoặc Full Test build xong các tab), gọi:
       window.initSplitResizers();            // quét toàn bộ document
       window.initSplitResizers(someRootEl);   // chỉ quét bên trong 1 phần tử

   An toàn khi gọi nhiều lần: mỗi .split-container chỉ được gắn resizer 1 lần
   (đánh dấu qua data-resizer-init).
   ===================================================================== */
(function (window, document) {
  "use strict";

  const MIN_PCT = 20;
  const MAX_PCT = 80;

  function initSplitResizers(root) {
    const scope = (root && root.querySelectorAll) ? root : document;
    const containers = scope.querySelectorAll(".split-container");
    containers.forEach(setupResizer);
  }

  function setupResizer(container) {
    if (container.dataset.resizerInit === "1") return;

    const left = container.querySelector(":scope > .left-pane");
    const right = container.querySelector(":scope > .right-pane");
    if (!left || !right) return;

    container.dataset.resizerInit = "1";

    const resizer = document.createElement("div");
    resizer.className = "split-resizer";
    resizer.setAttribute("role", "separator");
    resizer.setAttribute("aria-orientation", "vertical");
    resizer.title = "Kéo để thu/phóng 2 bên màn hình (bấm đúp để về mặc định)";
    left.insertAdjacentElement("afterend", resizer);

    let dragging = false;

    function clientXFromEvent(e) {
      if (e.touches && e.touches.length) return e.touches[0].clientX;
      return e.clientX;
    }

    function isHorizontalLayout() {
      return getComputedStyle(container).flexDirection !== "column";
    }

    function onMove(e) {
      if (!dragging) return;
      const rect = container.getBoundingClientRect();
      const x = clientXFromEvent(e) - rect.left;
      let pct = (x / rect.width) * 100;
      pct = Math.max(MIN_PCT, Math.min(MAX_PCT, pct));
      left.style.flex = "0 0 " + pct.toFixed(2) + "%";
      right.style.flex = "1 1 0%";
      e.preventDefault();
    }

    function stopDrag() {
      if (!dragging) return;
      dragging = false;
      resizer.classList.remove("dragging");
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    function startDrag(e) {
      // Màn hình hẹp (CSS xếp 2 khối theo chiều dọc) thì không kéo ngang được —
      // lúc đó resizer cũng tự ẩn qua CSS nên nhánh này hiếm khi chạy tới.
      if (!isHorizontalLayout()) return;
      dragging = true;
      resizer.classList.add("dragging");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      e.preventDefault();
    }

    resizer.addEventListener("mousedown", startDrag);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", stopDrag);

    resizer.addEventListener("touchstart", startDrag, { passive: false });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", stopDrag);
    document.addEventListener("touchcancel", stopDrag);

    // Bấm đúp vào thanh kéo -> trả lại tỉ lệ 50/50 mặc định
    resizer.addEventListener("dblclick", () => {
      left.style.flex = "";
      right.style.flex = "";
    });
  }

  window.initSplitResizers = initSplitResizers;
})(window, document);
