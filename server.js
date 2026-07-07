require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");

const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || "admin123";

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const DB_FILE = path.join(dataDir, "site.db");

let db; // instância do banco em memória (sql.js), salva em disco a cada alteração

function persist() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0];
}

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS packages (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT 'outro',
      description TEXT DEFAULT '',
      price       TEXT NOT NULL DEFAULT '0',
      price_note  TEXT DEFAULT '',
      image       TEXT DEFAULT '',
      sort_order  INTEGER DEFAULT 0
    );
  `);

  const configCount = get("SELECT COUNT(*) AS c FROM config").c;
  if (configCount === 0) {
    const defaultConfig = {
      siteName: "seu.dev",
      heroTitle: "Eu transformo ideias em",
      heroHighlight: "código que funciona.",
      heroSub: "Bots para Discord, sites e suporte técnico feitos sob medida. Você me conta o que precisa, eu cuido do resto.",
      aboutText: "Trabalho com desenvolvimento sob demanda: bots de Discord (moderação, música, integrações, comandos personalizados), sites institucionais e sistemas simples, além de suporte e manutenção contínua. Cada pacote abaixo já tem uma ideia de valor e do que está incluso — mas todo projeto é conversado antes de fechar.",
      phone: "5511999999999"
    };
    for (const [k, v] of Object.entries(defaultConfig)) {
      db.run("INSERT INTO config (key, value) VALUES (?, ?)", [k, v]);
    }
  }

  const pkgCount = get("SELECT COUNT(*) AS c FROM packages").c;
  if (pkgCount === 0) {
    const defaults = [
      ["p1", "Bot Discord Essencial", "bot", "Moderação automática, boas-vindas, cargos e comandos básicos configurados do seu jeito.", "150", "pagamento único", "", 1],
      ["p2", "Bot Discord Avançado", "bot", "Integrações externas, comandos personalizados, painéis de controle e economia interna do servidor.", "350", "pagamento único", "", 2],
      ["p3", "Site Institucional", "site", "Página única, responsiva, com seções sobre você ou seu negócio, contato e identidade visual própria.", "400", "pagamento único", "", 3],
      ["p4", "Suporte Mensal", "suporte", "Ajustes, correções e pequenas melhorias contínuas no seu bot ou site, sempre que precisar.", "80", "por mês", "", 4]
    ];
    for (const row of defaults) {
      db.run(
        "INSERT INTO packages (id, name, category, description, price, price_note, image, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        row
      );
    }
  }

  persist();
}

/* ---------- app ---------- */
const app = express();
app.use(express.json({ limit: "8mb" })); // limite maior por causa das imagens em base64
app.use(express.static(path.join(__dirname, "public")));

function requireAdmin(req, res, next) {
  const code = req.header("x-admin-code");
  if (code !== ADMIN_CODE) {
    return res.status(401).json({ error: "Código de acesso inválido." });
  }
  next();
}

/* ---------- rotas públicas ---------- */
app.get("/api/site", (req, res) => {
  const rows = all("SELECT key, value FROM config");
  const config = {};
  rows.forEach((r) => (config[r.key] = r.value));

  const packages = all("SELECT * FROM packages ORDER BY sort_order ASC, rowid ASC").map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    price: p.price,
    priceNote: p.price_note,
    image: p.image
  }));

  res.json({ config, packages });
});

app.post("/api/admin/login", (req, res) => {
  const { code } = req.body || {};
  if (code === ADMIN_CODE) return res.json({ ok: true });
  res.status(401).json({ ok: false, error: "Código incorreto." });
});

/* ---------- rotas administrativas (protegidas) ---------- */
app.put("/api/admin/config", requireAdmin, (req, res) => {
  const allowedKeys = ["siteName", "heroTitle", "heroHighlight", "heroSub", "aboutText", "phone"];
  const body = req.body || {};
  for (const key of allowedKeys) {
    if (typeof body[key] === "string") {
      run("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, body[key]]);
    }
  }
  res.json({ ok: true });
});

app.post("/api/admin/packages", requireAdmin, (req, res) => {
  const { name, category, description, price, priceNote, image } = req.body || {};
  if (!name || !price) return res.status(400).json({ error: "Nome e valor são obrigatórios." });

  const id = "p" + Date.now();
  const maxOrder = get("SELECT COALESCE(MAX(sort_order),0) AS m FROM packages").m;

  run(
    "INSERT INTO packages (id, name, category, description, price, price_note, image, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, name, category || "outro", description || "", String(price), priceNote || "", image || "", maxOrder + 1]
  );

  res.json({ ok: true, id });
});

app.put("/api/admin/packages/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const existing = get("SELECT * FROM packages WHERE id = ?", [id]);
  if (!existing) return res.status(404).json({ error: "Pacote não encontrado." });

  const { name, category, description, price, priceNote, image } = req.body || {};
  run(
    "UPDATE packages SET name = ?, category = ?, description = ?, price = ?, price_note = ?, image = ? WHERE id = ?",
    [
      name ?? existing.name,
      category ?? existing.category,
      description ?? existing.description,
      price != null ? String(price) : existing.price,
      priceNote ?? existing.price_note,
      image || existing.image,
      id
    ]
  );

  res.json({ ok: true });
});

app.delete("/api/admin/packages/:id", requireAdmin, (req, res) => {
  run("DELETE FROM packages WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Erro ao iniciar o banco de dados:", err);
    process.exit(1);
  });
