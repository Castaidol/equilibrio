// netlify/functions/report.mjs
// Proxy sicuro per il commento serale: la chiave resta lato server (ANTHROPIC_API_KEY).
// L'app chiama /.netlify/functions/report.

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Metodo non consentito" }, { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Chiave API non configurata sul server." }, { status: 500 });
  }

  let ctx = {};
  try { ctx = await req.json(); } catch { ctx = {}; }
  const {
    essenzialiTotali = 0,
    essenzialiFatti = 0,
    totali = 0,
    fatti = 0,
    categorie = [],
    domani = { tot: 0, ess: 0 },
  } = ctx;

  const system =
    "Sei la voce di Equilibrio, un'app personale che aiuta a portare a termine le attività del giorno con calma. " +
    "Scrivi un breve commento serale in italiano, 2 o 3 frasi, caldo e pacato. " +
    "Riconosci con misura ciò che è stato fatto, sii gentile e senza colpa su ciò che è rimasto indietro, " +
    "e chiudi con uno sguardo sereno a domani. " +
    "Niente emoji, niente elenchi, niente virgolette, niente toni squillanti. Varia le parole. " +
    "Rispondi SOLO con il commento.";

  const essLine =
    essenzialiTotali === 0
      ? "Oggi non c'erano attività essenziali."
      : essenzialiFatti >= essenzialiTotali
        ? `Tutte le ${essenzialiTotali} attività essenziali sono state completate.`
        : `Attività essenziali completate: ${essenzialiFatti} su ${essenzialiTotali}.`;

  const catLine = categorie.length
    ? "Per area: " + categorie.map(c => `${c.nome} ${c.fatti}/${c.totali}`).join(", ") + "."
    : "";

  const domaniLine =
    domani.tot === 0
      ? "Domani non ci sono attività ricorrenti in programma."
      : `Domani sono in programma ${domani.tot} attività, di cui ${domani.ess} essenziali.`;

  const userMsg =
    `Riepilogo della giornata.\n` +
    `Attività completate: ${fatti} su ${totali}.\n` +
    `${essLine}\n` +
    (catLine ? `${catLine}\n` : "") +
    `${domaniLine}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 220,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: "Errore dall'API di Claude", status: res.status, detail }, { status: 502 });
    }

    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim()
      .replace(/^["'«»\s]+|["'«»\s]+$/g, "");

    return Response.json({ text });
  } catch (err) {
    return Response.json({ error: "Errore di rete verso l'API", detail: String(err) }, { status: 502 });
  }
};
