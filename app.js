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
  loadComments();
})();
