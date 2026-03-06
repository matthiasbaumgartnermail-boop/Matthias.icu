const MAX_GUEST_NAME = 40;
const MAX_COMMENT = 800;
const MAX_LIST = 100;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeSpace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComment(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

async function ensureSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS website_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_name TEXT NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_website_comments_created_at
      ON website_comments(created_at DESC);
  `);
}

function getDb(env) {
  if (!env || !env.COMMENTS_DB) {
    return null;
  }
  return env.COMMENTS_DB;
}

export async function onRequestGet(context) {
  const db = getDb(context.env);
  if (!db) {
    return json(
      {
        error: "Kommentare sind noch nicht konfiguriert (D1-Binding COMMENTS_DB fehlt).",
      },
      503
    );
  }

  try {
    await ensureSchema(db);
    const out = await db
      .prepare(
        `SELECT id, guest_name, comment, created_at
         FROM website_comments
         ORDER BY id DESC
         LIMIT ?1`
      )
      .bind(MAX_LIST)
      .all();

    return json({ comments: Array.isArray(out.results) ? out.results : [] });
  } catch (err) {
    return json(
      { error: err && err.message ? err.message : "Fehler beim Laden der Kommentare." },
      500
    );
  }
}

export async function onRequestPost(context) {
  const db = getDb(context.env);
  if (!db) {
    return json(
      {
        error: "Kommentare sind noch nicht konfiguriert (D1-Binding COMMENTS_DB fehlt).",
      },
      503
    );
  }

  let payload = {};
  try {
    payload = await context.request.json();
  } catch (_err) {
    return json({ error: "Ungültiger Request-Body." }, 400);
  }

  const guestName = normalizeSpace(payload.guest_name);
  const comment = normalizeComment(payload.comment);

  if (!guestName) {
    return json({ error: "Gastname fehlt." }, 400);
  }
  if (guestName.length > MAX_GUEST_NAME) {
    return json({ error: `Gastname darf maximal ${MAX_GUEST_NAME} Zeichen haben.` }, 400);
  }
  if (!comment) {
    return json({ error: "Kommentar fehlt." }, 400);
  }
  if (comment.length > MAX_COMMENT) {
    return json({ error: `Kommentar darf maximal ${MAX_COMMENT} Zeichen haben.` }, 400);
  }

  try {
    await ensureSchema(db);
    const insert = await db
      .prepare(
        `INSERT INTO website_comments (guest_name, comment)
         VALUES (?1, ?2)`
      )
      .bind(guestName, comment)
      .run();

    const insertedId = insert && insert.meta ? insert.meta.last_row_id : null;
    if (!insertedId) {
      return json({ ok: true });
    }

    const row = await db
      .prepare(
        `SELECT id, guest_name, comment, created_at
         FROM website_comments
         WHERE id = ?1`
      )
      .bind(insertedId)
      .first();

    return json({ ok: true, comment: row || null }, 201);
  } catch (err) {
    return json(
      { error: err && err.message ? err.message : "Fehler beim Speichern des Kommentars." },
      500
    );
  }
}
