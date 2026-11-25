"use strict";

{
  const api = window.QUEST_API_URL.replace(/\/$/, "");
  const tokenKey = "cassette-invitation";
  const url = new URL(location.href);
  const incoming = url.searchParams.get("invite");
  let token = incoming;
  let pdfUrl;
  let loadingPdf = false;
  const accessStatus = document.getElementById("access-status");
  const retry = document.getElementById("access-retry");

  if (url.searchParams.has("invite")) {
    url.searchParams.delete("invite");
    history.replaceState(null, "", url);
  }
  try {
    if (incoming !== null) sessionStorage.removeItem(tokenKey);
    else token = sessionStorage.getItem(tokenKey);
  } catch {
    // An invitation still works for this page when session storage is blocked.
  }

  async function request(path) {
    const response = await fetch(api + path, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer"
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error("Приглашение недействительно. Открой персональную ссылку ещё раз.");
      if (response.status === 404) throw new Error("Сертификат пока не загружен. Попробуй позже.");
      throw new Error("Не удалось получить подарок. Попробуй ещё раз.");
    }
    return response;
  }

  async function enter() {
    retry.hidden = true;
    if (!api) {
      accessStatus.textContent = "Выдача приглашений ещё настраивается. Загляни чуть позже.";
      return;
    }
    if (!token) {
      accessStatus.textContent = "Для входа открой свою персональную ссылку-приглашение.";
      return;
    }
    accessStatus.textContent = "Открываем твою кассету…";
    try {
      await request("/api/access");
      try { sessionStorage.setItem(tokenKey, token); } catch {}
      document.getElementById("access-screen").hidden = true;
      document.querySelector(".masthead").hidden = false;
      document.querySelector("main").hidden = false;
    } catch (error) {
      accessStatus.textContent = error instanceof TypeError ? "Не удалось подключиться. Проверь соединение и попробуй ещё раз." : error.message;
      retry.hidden = false;
    }
  }

  window.loadQuestCertificate = async function () {
    if (loadingPdf || pdfUrl) return;
    const panel = document.getElementById("pdf-actions");
    const message = document.getElementById("pdf-status");
    const reload = document.getElementById("pdf-retry");
    panel.hidden = false;
    reload.hidden = true;
    message.textContent = "Загружаем твой сертификат…";
    loadingPdf = true;
    try {
      const response = await request("/api/certificate");
      if (!response.headers.get("Content-Type")?.includes("application/pdf")) throw new Error("Не удалось загрузить PDF. Попробуй ещё раз.");
      pdfUrl = URL.createObjectURL(await response.blob());
      for (const id of ["pdf-open", "pdf-download"]) {
        const link = document.getElementById(id);
        link.href = pdfUrl;
        link.hidden = false;
      }
      message.textContent = "Сертификат готов. Его можно открыть или сохранить.";
    } catch (error) {
      message.textContent = error instanceof TypeError ? "Не удалось загрузить сертификат. Проверь соединение и повтори попытку." : error.message;
      reload.hidden = false;
    } finally {
      loadingPdf = false;
    }
  };
  retry.addEventListener("click", enter);
  document.getElementById("pdf-retry").addEventListener("click", window.loadQuestCertificate);
  enter();
}
