(() => {
  const originalFetch = window.fetch.bind(window);

  window.fetch = (resource, options) => {
    const url = typeof resource === "string" ? resource : resource?.url;
    const customCsv = localStorage.getItem("customGnssCsv");
    if (customCsv && url && url.includes("gnss_log_2.csv")) {
      return Promise.resolve(new Response(customCsv, {
        status: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8" }
      }));
    }
    return originalFetch(resource, options);
  };

  function insertUploader() {
    const target = document.querySelector("#loadMeasuredNodes");
    if (!target || document.querySelector("#localGnssCsv")) return;

    const label = document.createElement("label");
    label.setAttribute("for", "localGnssCsv");
    label.textContent = "내 CSV 파일 사용";

    const input = document.createElement("input");
    input.id = "localGnssCsv";
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.style.width = "100%";
    input.style.marginTop = "8px";

    const hint = document.createElement("div");
    hint.className = "node-order";
    hint.textContent = localStorage.getItem("customGnssCsv")
      ? "현재 이 브라우저에 저장된 CSV를 사용합니다."
      : "CSV를 선택하면 GitHub에 올리지 않고 이 브라우저에서만 사용합니다.";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      localStorage.setItem("customGnssCsv", text);
      hint.textContent = `${file.name} 파일을 불러왔습니다. 이제 실측 GNSS 노드 불러오기를 눌러 주세요.`;
    });

    target.insertAdjacentElement("beforebegin", hint);
    target.insertAdjacentElement("beforebegin", input);
    target.insertAdjacentElement("beforebegin", label);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", insertUploader);
  } else {
    insertUploader();
  }
})();
