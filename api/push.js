// Wird jede Minute von Supabase aufgerufen und verschickt fällige Erinnerungen.
const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const MSG = [
  { title: "Zeit fürs Morgen-Manifest", body: "Was willst du heute erreichen? Nimm dir zwei Minuten." },
  { title: "Bist du noch auf Kurs?", body: "Denk an deinen Satz von heute Morgen und an deine Tagesquest." },
  { title: "Abend-Check-in", body: "Was hast du heute geschafft? Schließ deinen Tag ab." },
];

function slot(tz) {
  const p = new Intl.DateTimeFormat("de-DE", { timeZone: tz || "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).reduce((o, x) => ((o[x.type] = x.value), o), {});
  const m = +p.minute;
  return { time: p.hour + ":" + String(m).padStart(2, "0"), day: `${p.year}-${p.month}-${p.day}` };
}

module.exports = async (req, res) => {
  if (req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).send("nein");
  webpush.setVapidDetails("mailto:noreply@meisterstueck.app", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const { data: subs, error } = await sb.from("push_subs").select("*");
  if (error) return res.status(500).send(error.message);
  let sent = 0;
  for (const s of subs || []) {
    const now = slot(s.tz);
    const i = (s.times || []).indexOf(now.time);
    if (i < 0) continue;
    const msg = { ...MSG[Math.min(i, 2)] };
    if (i === 1) {
      const { data } = await sb.from("app_state").select("data").eq("user_id", s.user_id).maybeSingle();
      const man = data?.data?.man?.find((m) => m.d === now.day);
      if (man) msg.body = `„${man.t}“ – bist du noch dran?`;
    }
    try {
      await webpush.sendNotification(s.sub, JSON.stringify(msg));
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await sb.from("push_subs").delete().eq("endpoint", s.endpoint);
    }
  }
  res.status(200).json({ sent });
};
