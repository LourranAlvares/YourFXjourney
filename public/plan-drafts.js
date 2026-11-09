/* Preserve the editable plan independently of validation and immutable active versions. */
(function () {
  let memory = null,
    baseline = "",
    timer = null,
    suppress = false,
    message = "",
    owner = null;
  function snapshot() {
    const form = document.getElementById("ta-plan-form");
    if (!form || form.dataset.draftOwner !== K) return null;
    return {
      fields: Object.fromEntries(
        [...form.querySelectorAll('[id^="tp-"]')].map((el) => [
          el.id,
          el.type === "checkbox" ? el.checked : el.value,
        ]),
      ),
      criteria: [...form.querySelectorAll(".ta-criterion")].map((row) => ({
        id: row.dataset.criterionId,
        ...Object.fromEntries(
          [...row.querySelectorAll("[data-cfield]")].map((el) => [
            el.dataset.cfield,
            el.type === "checkbox" ? el.checked : el.value,
          ]),
        ),
      })),
    };
  }
  window.planDraftNotice = function (text) {
    message = text;
    let node = document.getElementById("plan-save-notice");
    if (node) node.textContent = text;
  };
  window.planDraftCapture = function (force = false) {
    clearTimeout(timer);
    if (suppress || (CLOUD_BOOT && !eliteCloud.ready)) return true;
    const data = snapshot();
    if (!data) return true;
    const signature = JSON.stringify(data);
    if (!force && signature === baseline && !memory) return true;
    if (memory?.owner !== K) memory = null;
    if (!force && memory?.written === signature) return true;
    memory = { owner: K, data, written: memory?.written };
    try {
      const next = {
        ...S,
        tradingPlanDraft: {
          version: 1,
          baseVersion: taCurrentPlan()?.version || 0,
          data,
          updatedAt: new Date().toISOString(),
        },
      };
      persistState(next);
      S = next;
      memory.written = signature;
      planDraftNotice(
        CLOUD_BOOT
          ? "Rascunho preservado neste navegador; aguardando confirmação da nuvem."
          : "Rascunho salvo neste navegador.",
      );
      return true;
    } catch (e) {
      planDraftNotice(
        "Não foi possível salvar o rascunho. Seus campos continuam nesta aba. " +
          e.message,
      );
      return false;
    }
  };
  window.planDraftSaved = function () {
    memory = null;
    baseline = "";
    suppress = true;
    message = CLOUD_BOOT
      ? "Plano preservado neste navegador; aguardando confirmação da nuvem."
      : "Plano salvo neste navegador.";
  };
  window.planDraftCloudStatus = function () {
    if (
      CLOUD_BOOT &&
      eliteCloud.state === "saved" &&
      message.includes("aguardando confirmação")
    )
      planDraftNotice(
        S.tradingPlanDraft
          ? "Rascunho confirmado na nuvem."
          : "Plano confirmado na nuvem.",
      );
  };
  const render = R;
  R = function () {
    planDraftCapture();
    const result = render.apply(this, arguments);
    suppress = false;
    const form = document.getElementById("ta-plan-form");
    if (!form) return result;
    form.dataset.draftOwner = K;
    form.noValidate = true;
    if (owner !== K) {
      memory = null;
      message = "";
      owner = K;
    }
    const draft = memory?.data || S.tradingPlanDraft?.data;
    if (draft) {
      for (const [id, value] of Object.entries(draft.fields || {})) {
        const el = document.getElementById(id);
        if (!el || !form.contains(el)) continue;
        if (el.type === "checkbox") el.checked = !!value;
        else el.value = value;
      }
      if (Array.isArray(draft.criteria))
        document.getElementById("ta-plan-criteria").innerHTML = draft.criteria
          .map(taPlanVisualCriterion)
          .join("");
    }
    baseline = JSON.stringify(snapshot());
    const notice = document.createElement("p");
    notice.id = "plan-save-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.className = "muted-note";
    form.querySelector(".plan-design-top").after(notice);
    planDraftNotice(
      message ||
        (draft
          ? "Rascunho recuperado. Seus campos foram preservados; Salvar plano ativa uma versão validada."
          : ""),
    );
    return result;
  };
  for (const name of ["input", "change"])
    document.addEventListener(name, (event) => {
      if (!event.target.closest("#ta-plan-form")) return;
      const data = snapshot();
      if (!data) return;
      memory = {
        owner: K,
        data,
        written: memory?.owner === K ? memory.written : null,
      };
      clearTimeout(timer);
      timer = setTimeout(() => planDraftCapture(), 350);
    });
  document.addEventListener("click", (event) => {
    if (event.target.closest("#ta-plan-form button")) {
      clearTimeout(timer);
      timer = setTimeout(() => planDraftCapture(), 0);
    }
  });
  for (const name of ["pagehide", "beforeunload"])
    window.addEventListener(name, () => planDraftCapture());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) planDraftCapture();
  });
})();
