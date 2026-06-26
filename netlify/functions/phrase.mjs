// netlify/functions/phrase.mjs
// Proxy sicuro: la chiave API resta lato server (variabile d'ambiente ANTHROPIC_API_KEY)
// e non tocca mai il browser. L'app chiama /.netlify/functions/phrase.

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Metodo non consentito" }, { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Chiave API non configurata sul server." },
      { status: 500 }
    );
  }

  // Contesto della giornata inviato dall'app
  let ctx = {};
  try { ctx = await req.json(); } catch { ctx = {}; }
  const {
    momento = "giornata",
    essenzialiTotali = 0,
    essenzialiFatti = 0,
    totali = 0,
    fatti = 0,
    categoriePendenti = [],
    tono = "incoraggiante",
  } = ctx;

  const toni = {
    incoraggiante: "Mantieni un tono caldo, pacato e incoraggiante, mai squillante.",
    diretto: "Mantieni un tono diretto ed essenziale, asciutto, senza fronzoli.",
    ironico: "Mantieni un tono leggero e un po' ironico, con un sorriso, senza mai esagerare.",
  };
  const toneInstr = toni[tono] || toni.incoraggiante;

  const system =
    "Sei la voce di Equilibrio, un'app personale che aiuta a portare a termine le attività del giorno con calma. " +
    "Scrivi UNA sola frase motivazionale in italiano, breve (da 5 a 14 parole). " +
    "Niente emoji, niente virgolette, niente punti esclamativi multipli. Varia le parole ogni volta. " +
    "Usa il contesto per essere pertinente: se la giornata è appena iniziata invita con dolcezza a cominciare; " +
    "se mancano poche attività essenziali incoraggia a chiuderle; se sono già tutte fatte celebra l'equilibrio raggiunto, con misura. " +
    toneInstr + " " +
    "Rispondi SOLO con la frase, senza nessun'altra parola.";

  const stato =
    essenzialiTotali === 0
      ? "Oggi non ci sono attività essenziali."
      : essenzialiFatti >= essenzialiTotali
        ? "Tutte le attività essenziali sono già completate."
        : `Attività essenziali: ${essenzialiFatti} di ${essenzialiTotali} completate.`;

  const pendenti = categoriePendenti.length
    ? `Aree ancora aperte: ${categoriePendenti.join(", ")}.`
    : "Nessuna area rimasta aperta.";

  const userMsg =
    `Momento della giornata: ${momento}.\n` +
    `${stato}\n` +
    `Totale attività: ${fatti} di ${totali} completate.\n` +
    `${pendenti}`;

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
        max_tokens: 80,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return Response.json(
        { error: "Errore dall'API di Claude", status: res.status, detail },
        { status: 502 }
      );
    }

    const data = await res.json();
    const phrase = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim()
      .replace(/^["'«»\s]+|["'«»\s]+$/g, "");

    return Response.json({ phrase });
  } catch (err) {
    return Response.json(
      { error: "Errore di rete verso l'API", detail: String(err) },
      { status: 502 }
    );
  }
};
