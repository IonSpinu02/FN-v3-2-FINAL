# -*- coding: utf-8 -*-
"""Genera GUIDA_SEMPLICE_FUNZIONAMENTO.pdf (testo semplice, UTF-8)."""
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "GUIDA_SEMPLICE_FUNZIONAMENTO.pdf"
FONT = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_B = Path(r"C:\Windows\Fonts\arialbd.ttf")


class GuidaPDF(FPDF):
    def footer(self):
        self.set_y(-12)
        self.set_font("Arial", "", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, f"Pagina {self.page_no()}", align="C")


def section(pdf: GuidaPDF, title: str) -> None:
    pdf.ln(4)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Arial", "B", 12)
    pdf.set_text_color(30, 64, 175)
    pdf.multi_cell(0, 7, title)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)


def body(pdf: GuidaPDF, text: str) -> None:
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Arial", "", 10)
    pdf.multi_cell(0, 5.5, text)
    pdf.ln(2)


def step(pdf: GuidaPDF, label: str, text: str) -> None:
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Arial", "B", 9)
    pdf.set_text_color(37, 99, 235)
    pdf.multi_cell(0, 5, label)
    pdf.set_text_color(0, 0, 0)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Arial", "", 10)
    pdf.multi_cell(0, 5.5, text)
    pdf.ln(2)


def warn_box(pdf: GuidaPDF, text: str) -> None:
    pdf.set_x(pdf.l_margin)
    pdf.set_fill_color(255, 247, 237)
    pdf.set_font("Arial", "", 10)
    pdf.multi_cell(0, 5.5, text, fill=True)
    pdf.ln(3)


def main() -> None:
    if not FONT.is_file():
        raise SystemExit(f"Font non trovato: {FONT}")

    pdf = GuidaPDF()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()
    pdf.add_font("Arial", "", str(FONT))
    pdf.add_font("Arial", "B", str(FONT_B))

    pdf.set_font("Arial", "B", 16)
    pdf.multi_cell(
        0,
        8,
        "Futuro Nazionale - Come funziona tutto\n(guida lenta, parole semplici)",
    )
    pdf.set_font("Arial", "", 9)
    pdf.set_text_color(100, 116, 139)
    body(pdf, "Scenario territoriale v3.2 - Uso interno - Ottobre 2026")
    pdf.set_text_color(0, 0, 0)

    warn_box(
        pdf,
        "PRIMA DI TUTTO — LEGGI QUESTO\n\n"
        "Questo documento NON dice chi vincerà le elezioni e NON è un sondaggio ufficiale "
        "di un istituto esterno. È uno schema ipotetico: «se a livello nazionale FN avesse "
        "circa il 7,2%, come potrebbe distribuirsi sulle varie zone d'Italia?». "
        "Il sistema lo segnala: predizione validata = NO.",
    )

    section(pdf, "0. Per chi è scritta questa guida")
    body(
        pdf,
        "Puoi leggere anche se non segui la politica e non conosci statistiche o informatica. "
        "Ogni passaggio parte dall'inizio. Alla fine trovi un piccolo dizionario.",
    )

    section(pdf, "1. Idee base (spiegate piano)")
    step(
        pdf,
        "Idea 1 — Elezioni e voti",
        "Periodicamente le persone votano. Si contano i voti validi e si calcola la percentuale: "
        "esempio, 7 voti su 100 per un partito = 7%.",
    )
    step(
        pdf,
        "Idea 2 — Le 20 regioni",
        "L'Italia è divisa in 20 regioni (Piemonte, Lombardia, Sicilia, …). "
        "Un partito può essere più forte in una zona e più debole in un'altra.",
    )
    step(
        pdf,
        "Idea 3 — Cosa significa FN",
        "FN = Futuro Nazionale, il partito oggetto di questo scenario. "
        "I dati su iscritti e organizzazione sono quelli comunicati dal committente.",
    )
    step(
        pdf,
        "Idea 4 — Cosa è un sondaggio (e cosa usiamo noi)",
        "Un sondaggio stima il consenso nazionale interrogando un campione di persone. "
        "Qui usiamo un numero fisso di partenza: circa 7,2% (lettera S). "
        "Il programma NON calcola da solo quel 7,2%: lo prende come dato di partenza.",
    )

    section(pdf, "2. Due partiti citati nel modello (solo per capire i dati)")
    body(
        pdf,
        "Nei file compaiono spesso FdI e Lega: sono partiti politici italiani. "
        "Il modello usa i voti che hanno preso nel 2024 in ogni regione, come mappa del territorio. "
        "NON stiamo dicendo che FN e quelli partiti sono la stessa cosa: usiamo quei numeri solo "
        "come riferimento geografico del voto passato.",
    )

    section(pdf, "3. La domanda a cui risponde il sistema")
    body(
        pdf,
        "Se FN avesse circa 7,2% in tutta Italia, in ciascuna delle 20 regioni quanto potrebbe essere "
        "circa, secondo quattro indizi territoriali che mescoliamo insieme?\n\n"
        "La risposta e una tabella e una mappa con percentuali ipotetiche per regione. "
        "Esempio: in una regione potresti leggere 9% e in un'altra 5%: la media pesata torna "
        "verso il 7,2% nazionale che abbiamo scelto come partenza.",
    )

    section(pdf, "4. Cosa il sistema NON fa")
    body(
        pdf,
        "• Non promette l'esito delle prossime elezioni.\n"
        "• Non sostituisce istituti di ricerca come SWG o Ixè.\n"
        "• Non dimostra che FN avrà esattamente il 7,2%.\n"
        "• Il confronto con FdI + Lega nel 2024 serve solo a capire la forma del territorio, "
        "non a misurare un errore di previsione.",
    )

    section(pdf, "5. I quattro ingredienti (uno per uno)")
    body(
        pdf,
        "Analogia: una ricetta con 4 ingredienti. Non ne basta uno solo: li mescoli con quantita fisse.\n"
        "Prima il computer trasforma ogni ingrediente in un punteggio comparabile tra regioni, "
        "poi fa la media pesata.",
    )
    step(
        pdf,
        "Ingrediente 1 - FLUSSI (35%, la fetta piu grande)",
        "Guarda come ha votato il territorio nel 2024 (FdI, Lega, astensione, altri) e un'ipotesi "
        "su come i voti potrebbero spostarsi. Risponde alla domanda: qui che orientamento aveva l'elettore medio?",
    )
    step(
        pdf,
        "Ingrediente 2 - PREFERENZE (25%)",
        "Dati da primarie o votazioni interne al partito, raggruppate per macro-zone (circoscrizioni). "
        "Lombardia e Sardegna hanno numeri misurati; altrove il modello stima con prudenza.",
    )
    step(
        pdf,
        "Ingrediente 3 - ISCRITTI (25%)",
        "Quante tessere / iscrizioni FN ci sono in quella regione rispetto al totale italiano.",
    )
    step(
        pdf,
        "Ingrediente 4 - ISTITUZIONI (15%)",
        "Quanto il partito e gia visibile nelle istituzioni (es. consiglieri regionali, sindaci).",
    )

    section(pdf, "6. Passo per passo - cosa fa il computer")
    step(pdf, "Passo A", "Legge i file di configurazione: iscritti, pesi, dati elettorali 2024.")
    step(
        pdf,
        "Passo B",
        "Per ogni regione calcola q: che fetta dell'elettorato italiano rappresenta (voti validi 2024).",
    )
    step(
        pdf,
        "Passo C",
        "Calcola i quattro ingredienti e li normalizza per confrontarli tra regioni.",
    )
    step(
        pdf,
        "Passo D - Il mix",
        "Mescola: 35% flussi + 25% preferenze + 25% iscritti + 15% istituzioni. "
        "Ottieni p, cioe la quota scenario di quella regione.",
    )
    step(
        pdf,
        "Passo E - La percentuale che vedi",
        "Formula: stima regione = S moltiplicato per (p diviso q), con S = 7,2%. "
        "q corregge per il fatto che le regioni hanno dimensioni elettorali diverse.",
    )
    step(
        pdf,
        "Passo F - Benchmark",
        "In parallelo: stessa S applicata a FdI+Lega 2024, regione per regione. "
        "Serve solo a confrontare la forma della mappa, non a prevedere FN.",
    )
    step(
        pdf,
        "Passo G - Output",
        "Scrive tutto in un file JSON (lista delle 20 regioni con percentuali, voti stimati, intervalli).",
    )

    section(pdf, "7. Monte Carlo (senza paura)")
    body(
        pdf,
        "Il modello ripete il calcolo 20.000 volte cambiando leggermente pesi e S (seme fisso 42 = risultati ripetibili).\n"
        "lo10 e hi90 sono due estremi: mostrano la SENSIBILITA (quanto cambia se i pesi non fossero certissimi).\n"
        "NON significa che il voto reale stara sicuramente in quell'intervallo.",
    )

    section(pdf, "8. File principali (cartella progetto)")
    body(
        pdf,
        "modello_fn_v3_2.py — programma Python originale.\n"
        "config_v3_2.json — numeri di input (iscritti, pesi, S=7,2%).\n"
        "risultati_v3_2.json — output per 20 regioni.\n"
        "scenario_congelato_18-10-2026.json — fotografia fissa prima del voto.\n"
        "platform/ — sito web con mappa, slider, strumenti extra.",
    )

    pdf.add_page()
    section(pdf, "9. La piattaforma web (cartella platform)")
    step(
        pdf,
        "Cos'e",
        "Un sito internet interno (serve login). Mostra numeri e mappe invece di farti leggere file JSON a mano.",
    )
    step(
        pdf,
        "Perche esiste",
        "Stessi calcoli del programma Python, controllati da un test automatico (golden): "
        "se i numeri non coincidono con il pacchetto ufficiale, il test fallisce.",
    )
    step(
        pdf,
        "Cosa puoi fare in piu",
        "Muovere slider (cambiare S o i pesi e vedere cosa succede), cliccare la mappa, "
        "stampare un report PDF, simulare un sondaggio regionale.",
    )

    section(pdf, "10. Le tre schede del sito (tab)")
    step(
        pdf,
        "Tab 1 - Scenario e sondaggio regionale",
        "Schermata principale: riassunto Italia, mappa colorata, tabella 20 regioni. "
        "Clic su una regione apre il dettaglio. Qui ci sono anche i controlli del simulatore sondaggio.",
    )
    step(
        pdf,
        "Tab 2 - Storico iscritti",
        "Carichi un foglio CSV con colonne: mese, regione, iscritti. "
        "Se un mese ha tutte e 20 le regioni, il sito calcola quanto la presenza FN e concentrata o spalmata (indice H).",
    )
    step(
        pdf,
        "Tab 3 - Validazione post-voto",
        "Dopo le elezioni carichi i voti veri (CSV: regione, voti validi, voti FN). "
        "Il sito confronta con lo snapshot congelato del 18 ottobre 2026 e mostra scostamenti medi. "
        "Attenzione: il voto reale puo non essere perfettamente comparabile (simbolo, coalizioni, ecc.).",
    )

    section(pdf, "11. Simulatore sondaggio regionale (solo sito)")
    body(
        pdf,
        "Un sondaggio vero chiama migliaia di persone al telefono o online. "
        "Qui il computer fa un esercizio: immagina di intervistare 600, 1000 o 2000 persone in quella regione; "
        "se FN fosse vicino alla nostra stima, il risultato del campione potrebbe oscillare per puro caso. "
        "A quell'oscillazione si aggiunge l'incertezza del modello (Monte Carlo).\n"
        "Forbice +/- , probabilita di superare una soglia (es. 3%), etichette Sicura/Contesa/Critica: "
        "solo per orientamento interno, non per comunicazione esterna come sondaggio ufficiale.",
    )
    warn_box(
        pdf,
        "Non pubblicare queste cifre come sondaggio SWG/Ixè. Sono esercizi statistici sullo scenario.",
    )

    section(pdf, "12. Filo logico completo (15 micro-passi)")
    body(
        pdf,
        "1) Apri i dati di configurazione.\n"
        "2) Leggi quanti elettori validi c'erano per regione nel 2024.\n"
        "3) Per ogni regione calcola q (peso elettorale).\n"
        "4) Calcola l'indice flussi.\n"
        "5) Calcola l'indice preferenze.\n"
        "6) Calcola l'indice iscritti.\n"
        "7) Calcola l'indice istituzioni.\n"
        "8) Mescola con pesi 35-25-25-15 -> p.\n"
        "9) Applica S=7,2% -> percentuale scenario regione.\n"
        "10) Calcola benchmark FdI+Lega con la stessa S.\n"
        "11) Ripeti migliaia di volte con pesi leggermente diversi (Monte Carlo).\n"
        "12) Salva risultati in JSON.\n"
        "13) (Sito) Mostra mappa e tabelle.\n"
        "14) (Sito opzionale) Simula margine da sondaggio fittizio.\n"
        "15) (Dopo voto) Confronta CSV esiti con snapshot congelato.",
    )

    section(pdf, "13. Piccolo dizionario")
    body(
        pdf,
        "S (7,2%) — Ipotesi di consenso nazionale FN, dato di partenza.\n"
        "Regione — Una delle 20 grandi aree dell'Italia.\n"
        "Mix / pesi — Come si combinano i quattro ingredienti (35+25+25+15).\n"
        "Snapshot congelato — File salvato in una data fissa per confronti dopo il voto.\n"
        "H (entropia) — Quanto FN è concentrato in poche regioni o più spread (descrittivo).\n"
        "Golden test — La web deve dare gli stessi numeri del pacchetto ufficiale v3.2.",
    )

    section(pdf, "14. Riassunto in 6 punti")
    body(
        pdf,
        "1. Partiamo da S ≈ 7,2% nazionale (dato esterno al motore).\n"
        "2. Per ogni regione mescoliamo quattro indizi con pesi fissi.\n"
        "3. Otteniamo percentuali ipotetiche + confronto con FdI+Lega 2024.\n"
        "4. Monte Carlo = sensibilità ai pesi, non «chi vince».\n"
        "5. Il sito platform visualizza e permette di sperimentare.\n"
        "6. Tutto resta scenario descrittivo, non predizione certificata.",
    )

    pdf.set_font("Arial", "", 8)
    pdf.set_text_color(100, 116, 139)
    body(
        pdf,
        "Dettagli tecnici: RECAP_FUNZIONAMENTO.md - HTML: GUIDA_SEMPLICE_FUNZIONAMENTO.html",
    )

    pdf.output(str(OUT))
    print(f"Scritto: {OUT}")


if __name__ == "__main__":
    main()
