// Löscht das Konto des angemeldeten Nutzers samt Daten und Bildern.
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("nein");
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) return res.status(401).send("nicht angemeldet");
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const { data: u, error } = await sb.auth.getUser(token);
  if (error || !u || !u.user) return res.status(401).send("nicht angemeldet");
  const id = u.user.id;
  // Bilder im eigenen Ordner entfernen
  const { data: files } = await sb.storage.from("bilder").list(id, { limit: 1000 });
  if (files && files.length) await sb.storage.from("bilder").remove(files.map((f) => id + "/" + f.name));
  // Tabellen werden über "on delete cascade" mitgelöscht
  const { error: delErr } = await sb.auth.admin.deleteUser(id);
  if (delErr) return res.status(500).send(delErr.message);
  res.status(200).json({ ok: true });
};
