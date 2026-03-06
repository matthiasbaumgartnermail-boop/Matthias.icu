(function () {
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (!("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );

    revealEls.forEach(function (el) { io.observe(el); });
  }

  var commentForm = document.getElementById("ideaCommentForm");
  var nameInput = document.getElementById("guestNameInput");
  var commentInput = document.getElementById("commentInput");
  var commentsList = document.getElementById("ideaCommentsList");
  var commentStatus = document.getElementById("commentStatus");
  var commentSubmitBtn = document.getElementById("commentSubmitBtn");
  var commentCountEl = document.getElementById("commentCount");

  if (!commentForm || !nameInput || !commentInput || !commentsList || !commentStatus || !commentSubmitBtn) {
    return;
  }

  var GUEST_NAME_KEY = "matthias_icu_guest_name";
  var LOCAL_COMMENTS_KEY = "matthias_icu_comments_local";

  // Admin login state (saved in sessionStorage for simplicity)
  var ADMIN_SESSION_KEY = "matthias_icu_admin_logged_in";

  function isAdmin() {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
  }

  function setAdminLoggedIn(loggedIn) {
    if (loggedIn) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }
  }

  function setStatus(message, isError) {
    commentStatus.textContent = message || "";
    commentStatus.style.color = isError ? "#9a2f2f" : "#4a6478";
  }

  function updateCounter() {
    if (!commentCountEl) {
      return;
    }
    commentCountEl.textContent = String((commentInput.value || "").length);
  }

  function avatarText(name) {
    var cleaned = String(name || "").trim();
    if (!cleaned) {
      return "G";
    }
    return cleaned.charAt(0).toUpperCase();
  }

  function normalizeDateString(value) {
    if (!value) {
      return "";
    }
    if (value.indexOf("T") >= 0) {
      return value;
    }
    return value.replace(" ", "T") + "Z";
  }

  function formatDate(value) {
    var date = new Date(normalizeDateString(String(value || "")));
    if (isNaN(date.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat("de-AT", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function createCommentItem(item) {
    var wrapper = document.createElement("article");
    wrapper.className = "comment-item";

    var head = document.createElement("div");
    head.className = "comment-item-head";

    var identity = document.createElement("div");
    identity.className = "comment-identity";

    var avatar = document.createElement("span");
    avatar.className = "comment-avatar";
    avatar.textContent = avatarText(item.guest_name);

    var name = document.createElement("span");
    name.className = "comment-name";
    name.textContent = String(item.guest_name || "Gast");

    var date = document.createElement("time");
    date.className = "comment-date";
    date.textContent = formatDate(item.created_at);

    var text = document.createElement("p");
    text.className = "comment-text";
    text.textContent = String(item.comment || "");

    identity.appendChild(avatar);
    identity.appendChild(name);
    head.appendChild(identity);
    head.appendChild(date);

    // Add delete button if admin
    if (isAdmin()) {
      var delButton = document.createElement("button");
      delButton.textContent = "Löschen";
      delButton.style.marginLeft = "auto";
      delButton.style.backgroundColor = "#f28c00";
      delButton.style.color = "white";
      delButton.style.border = "none";
      delButton.style.borderRadius = "6px";
      delButton.style.padding = "2px 8px";
      delButton.style.cursor = "pointer";
      delButton.title = "Kommentar löschen";
      delButton.addEventListener("click", function () {
        if (confirm(`Kommentar von '${item.guest_name}' wirklich löschen?`)) {
          deleteComment(item.id);
        }
      });
      head.appendChild(delButton);
    }

    wrapper.appendChild(head);
    wrapper.appendChild(text);
    return wrapper;
  }

  function renderComments(comments) {
    commentsList.innerHTML = "";
    if (!Array.isArray(comments) || comments.length === 0) {
      var empty = document.createElement("p");
      empty.className = "comment-empty";
      empty.textContent = "Noch keine Kommentare. Sei der erste mit einer Idee.";
      commentsList.appendChild(empty);
      return;
    }

    comments.forEach(function (item) {
      commentsList.appendChild(createCommentItem(item));
    });
  }

  function readLocalComments() {
    try {
      var raw = localStorage.getItem(LOCAL_COMMENTS_KEY);
      if (!raw) {
        return [];
      }
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
      return [];
    }
  }

  function writeLocalComments(items) {
    try {
      localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(items || []));
    } catch (_e) {}
  }

  async function readJsonResponse(response) {
    var contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType.indexOf("application/json") === -1) {
      var bodyText = await response.text().catch(function () { return ""; });
      var snippet = bodyText ? bodyText.slice(0, 120).replace(/\s+/g, " ") : "";
      var detail = snippet ? " (" + snippet + ")" : "";
      throw new Error(
        "Kommentare-API nicht aktiv unter /api/comments. Bitte Pages Functions + D1-Binding COMMENTS_DB prüfen." + detail
      );
    }
    return response.json();
  }

  async function loadComments() {
    try {
      var response = await fetch("/api/comments", { cache: "no-store" });
      var payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(payload.error || "Kommentare konnten nicht geladen werden.");
      }
      var apiComments = Array.isArray(payload.comments) ? payload.comments : [];
      renderComments(apiComments);
      writeLocalComments(apiComments);
      setStatus("");
    } catch (err) {
      var localComments = readLocalComments();
      renderComments(localComments);
      if (localComments.length > 0) {
        setStatus("Kommentare werden aktuell lokal angezeigt (API gerade nicht erreichbar).", true);
      } else {
        setStatus(String(err && err.message ? err.message : err), true);
      }
    }
  }

  async function deleteComment(commentId) {
    if (!commentId) return;
    setStatus("Lösche Kommentar...", false);
    try {
      var response = await fetch("/api/comments/" + encodeURIComponent(commentId), {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error("Kommentar konnte nicht gelöscht werden.");
      }
      setStatus("Kommentar gelöscht.", false);
      await loadComments();
    } catch (err) {
      setStatus("Fehler beim Löschen des Kommentars: " + (err.message || err), true);
    }
  }

  // Login form for admin
  function createAdminLoginForm() {
    var container = document.createElement("div");
    container.style.border = "1px solid #f28c00";
    container.style.padding = "12px";
    container.style.borderRadius = "10px";
    container.style.marginBottom = "16px";
    container.style.backgroundColor = "#fff8e1";

    var title = document.createElement("h4");
    title.textContent = "Admin Login";
    title.style.color = "#f28c00";
    title.style.fontFamily = '"DM Serif Display", Georgia, serif';
    container.appendChild(title);

    var input = document.createElement("input");
    input.type = "password";
    input.placeholder = "Admin Passwort";
    input.style.padding = "8px";
    input.style.width = "calc(100% - 90px)";
    input.style.marginRight = "8px";
    input.style.border = "1px solid #ccc";
    input.style.borderRadius = "6px";

    var btn = document.createElement("button");
    btn.textContent = "Einloggen";
    btn.style.backgroundColor = "#f28c00";
    btn.style.color = "white";
    btn.style.border = "none";
    btn.style.borderRadius = "6px";
    btn.style.padding = "8px 12px";
    btn.style.cursor = "pointer";

    btn.addEventListener("click", function () {
      var pwd = input.value;
      // Einfaches Admin-Passwort prüfen (hier "admin123" als Beispiel)
      if (pwd === "admin123") {
        setAdminLoggedIn(true);
        container.remove();
        renderCommentsUI();
        setStatus("Admin Login erfolgreich. Kommentare können nun gelöscht werden.", false);
      } else {
        alert("Falsches Passwort.");
        input.value = "";
        input.focus();
      }
    });

    container.appendChild(input);
    container.appendChild(btn);

    return container;
  }

  var commentBoard = document.querySelector(".comment-board");

  function renderCommentsUI() {
    if (!commentBoard) return;

    // Entferne evtl vorhandenes login form
    var existingLogin = commentBoard.querySelector(".admin-login-container");
    if (existingLogin) {
      existingLogin.remove();
    }

    if (!isAdmin()) {
      // Zeige Login Formular an
      var loginForm = createAdminLoginForm();
      loginForm.classList.add("admin-login-container");
      commentBoard.insertBefore(loginForm, commentBoard.firstChild);
    } else {
      // Admin ist eingeloggt
      // Zeige Logout Button
      var logoutBtn = commentBoard.querySelector(".admin-logout-btn");
      if (!logoutBtn) {
        logoutBtn = document.createElement("button");
        logoutBtn.textContent = "Admin Logout";
        logoutBtn.className = "admin-logout-btn";
        logoutBtn.style.marginBottom = "12px";
        logoutBtn.style.backgroundColor = "#f28c00";
        logoutBtn.style.color = "white";
        logoutBtn.style.border = "none";
        logoutBtn.style.borderRadius = "6px";
        logoutBtn.style.padding = "8px 12px";
        logoutBtn.style.cursor = "pointer";
        logoutBtn.addEventListener("click", function () {
          setAdminLoggedIn(false);
          renderCommentsUI();
          setStatus("Admin-Logout erfolgreich.", false);
        });
        commentBoard.insertBefore(logoutBtn, commentBoard.firstChild);
      }
    }

    loadComments();
  }

  var savedGuestName = "";
  try {
    savedGuestName = localStorage.getItem(GUEST_NAME_KEY) || "";
  } catch (_e) {}
  if (savedGuestName) {
    nameInput.value = savedGuestName;
  }

  commentForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    var guestName = String(nameInput.value || "").trim();
    var comment = String(commentInput.value || "").trim();

    if (!guestName) {
      setStatus("Bitte einen Gastnamen eingeben.", true);
      nameInput.focus();
      return;
    }
    if (!comment) {
      setStatus("Bitte einen Kommentar eingeben.", true);
      commentInput.focus();
      return;
    }
    if (guestName.length > 40) {
      setStatus("Gastname darf maximal 40 Zeichen haben.", true);
      return;
    }
    if (comment.length > 800) {
      setStatus("Kommentar darf maximal 800 Zeichen haben.", true);
      return;
    }

    commentSubmitBtn.disabled = true;
    setStatus("Sende Kommentar ...", false);

    try {
      var response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: guestName,
          comment: comment
        })
      });
      var payload = await readJsonResponse(response);
      if (!response.ok) {
        var fallbackItem = {
          id: "local-" + Date.now(),
          guest_name: guestName,
          comment: comment,
          created_at: new Date().toISOString()
        };
        var currentLocal = readLocalComments();
        currentLocal.unshift(fallbackItem);
        writeLocalComments(currentLocal.slice(0, 100));
        renderComments(currentLocal.slice(0, 100));
        setStatus("API derzeit nicht erreichbar: Kommentar lokal gespeichert.", true);
        commentInput.value = "";
        updateCounter();
        return;
      }

      try {
        localStorage.setItem(GUEST_NAME_KEY, guestName);
      } catch (_e) {}

      commentInput.value = "";
      updateCounter();
      setStatus("Kommentar gespeichert.", false);
      if (payload && payload.comment) {
        var existing = readLocalComments();
        var merged = [payload.comment].concat(existing);
        writeLocalComments(merged.slice(0, 100));
      }
      await loadComments();
    } catch (err) {
      var localFallbackItem = {
        id: "local-" + Date.now(),
        guest_name: guestName,
        comment: comment,
        created_at: new Date().toISOString()
      };
      var localNow = readLocalComments();
      localNow.unshift(localFallbackItem);
      writeLocalComments(localNow.slice(0, 100));
      renderComments(localNow.slice(0, 100));
      commentInput.value = "";
      updateCounter();
      setStatus(
        (String(err && err.message ? err.message : err) + " Kommentar wurde lokal gespeichert.").trim(),
        true
      );
    } finally {
      commentSubmitBtn.disabled = false;
    }
  });

  commentInput.addEventListener("input", updateCounter);

  updateCounter();

  renderCommentsUI();

})();
