// netlify/functions/cheer.mjs
// Frase brevissima per i momenti speciali (tutti gli essenziali fatti, recupero azzerato).
// La chiave resta lato server (ANTHROPIC_API_KEY). L'app chiama /.netlify/functions/cheer.

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
  const tipo = ctx.tipo === "recupero" ? "recupero" : "equilibrio";
  const attivita = (ctx.attivita || "").toString().slice(0, 80);
  const tono = ctx.tono || "incoraggiante";

  const toni = {
    incoraggiante: "Tono caldo e incoraggiante.",
    diretto: "Tono diretto ed essenziale, asciutto.",
    ironico: "Tono leggero e ironico, con un sorriso.",
  };
  const toneInstr = toni[tono] || toni.incoraggiante;

  const system =
    "Sei la voce di Equilibrio, un'app personale per le attività del giorno. " +
    "Scrivi una sola frase brevissima in italiano (da 2 a 6 parole) per celebrare un piccolo traguardo. " +
    "Niente emoji, niente virgolette, niente punti esclamativi multipli. Varia le parole. " +
    toneInstr + " " +
    "Rispondi SOLO con la frase.";

  const userMsg = tipo === "equilibrio"
    ? `Momento: la persona ha appena completato l'ultima attività essenziale della giornata. La giornata è in equilibrio.`
    : `Momento: la persona ha appena recuperato il debito accumulato sull'attività "${attivita}", raggiungendo l'obiettivo gonfiato.`;

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
        max_tokens: 40,
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
