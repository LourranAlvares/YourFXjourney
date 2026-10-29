/* Phone navigation only. Desktop composition and preferences remain unchanged. */
function eliteMobileClose(restoreFocus = true) {
  const open = document.body.classList.contains("elite-mobile-nav-open");
  document.body.classList.remove("elite-mobile-nav-open");
  document.getElementById("main").inert = false;
  const trigger = document.querySelector(
    ".reference-topbar > .terminal-icon-button",
  );
  if (innerWidth <= 760 && trigger) {
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", "Expandir navegação");
    if (open && restoreFocus) trigger.focus();
  }
}
function eliteMobileToggle() {
  if (innerWidth > 760) return;
  if (document.body.classList.contains("elite-mobile-nav-open"))
    return eliteMobileClose();
  document.body.classList.add("elite-mobile-nav-open");
  const trigger = document.querySelector(
    ".reference-topbar > .terminal-icon-button",
  );
  trigger?.setAttribute("aria-expanded", "true");
  trigger?.setAttribute("aria-label", "Recolher navegação");
  document.getElementById("main").inert = true;
  document.querySelector("#nav button.on")?.focus();
}
function eliteMobileAfterRender() {
  if (innerWidth > 760) {
    for (const id of ["elite-mobile-scrim", "elite-mobile-close"]) {
      const node = document.getElementById(id);
      if (node) {
        node.hidden = true;
        node.style.display = "none";
      }
    }
    return;
  }
  for (const id of ["elite-mobile-scrim", "elite-mobile-close"]) {
    const node = document.getElementById(id);
    if (node) {
      node.hidden = false;
      node.style.removeProperty("display");
    }
  }
  if (!document.getElementById("elite-mobile-scrim")) {
    const scrim = document.createElement("button");
    scrim.id = "elite-mobile-scrim";
    scrim.setAttribute("aria-label", "Fechar menu");
    scrim.onclick = () => eliteMobileClose();
    document.body.append(scrim);
    const close = document.createElement("button");
    close.id = "elite-mobile-close";
    close.className = "b s";
    close.setAttribute("aria-label", "Fechar navegação");
    close.textContent = "Fechar ×";
    close.onclick = () => eliteMobileClose();
    document.querySelector("header").prepend(close);
  }
  document.getElementById("main").inert = document.body.classList.contains(
    "elite-mobile-nav-open",
  );
}
document.addEventListener(
  "click",
  (e) => {
    if (innerWidth <= 760 && e.target.closest("#nav button,.elite-profile"))
      eliteMobileClose(false);
  },
  true,
);
document.addEventListener("keydown", (e) => {
  if (
    innerWidth > 760 ||
    !document.body.classList.contains("elite-mobile-nav-open")
  )
    return;
  if (e.key === "Escape") {
    e.preventDefault();
    eliteMobileClose();
  }
  if (e.key === "Tab") {
    const nodes = [
        ...document.querySelectorAll("header button,header summary"),
      ].filter((e) => e.getClientRects().length),
      i = nodes.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) {
      e.preventDefault();
      nodes.at(-1)?.focus();
    } else if (!e.shiftKey && i === nodes.length - 1) {
      e.preventDefault();
      nodes[0]?.focus();
    }
  }
});
window.addEventListener("resize", () => {
  if (innerWidth > 760) eliteMobileClose(false);
  eliteMobileAfterRender();
});
