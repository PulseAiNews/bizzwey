"use client";

import { useMemo, useState } from "react";

type Tone = "pass" | "hold" | "review" | "block" | "archived" | "proposed";
type EventRow = {
  key: string; title: string; zone: string; source: string; sources: number; proof: string;
  importance: string; decision: string; reason: string; slot: string; language: string; tone: Tone;
};

const events: EventRow[] = [
  { key: "evt:av:2026-001", title: "Certification EASA d’un nouvel appareil régional", zone: "Europe", source: "EASA · démo", sources: 6, proof: "VERIFIED", importance: "Élevée", decision: "APPROVED_PUBLIC", reason: "Source officielle et impact industriel", slot: "Lead Event", language: "FR", tone: "pass" },
  { key: "evt:av:2026-002", title: "Fermeture temporaire d’un espace aérien stratégique", zone: "Moyen-Orient", source: "NOTAM · démo", sources: 9, proof: "VERIFIED", importance: "Critique", decision: "APPROVED_PUBLIC", reason: "Impact immédiat sur les routes", slot: "Breaking", language: "FR / EN", tone: "pass" },
  { key: "evt:av:2026-003", title: "Incident technique déclaré sur un vol long-courrier", zone: "Asie-Pacifique", source: "Autorité · démo", sources: 2, proof: "DEVELOPING", importance: "Moyenne", decision: "HOLD_PROOF", reason: "Diversité de sources insuffisante", slot: "Continuous Feed", language: "FR", tone: "hold" },
  { key: "evt:av:2026-004", title: "Commande majeure d’avions par une compagnie", zone: "Amérique du Nord", source: "Constructeur · démo", sources: 5, proof: "VERIFIED", importance: "Élevée", decision: "REVIEW_REQUIRED", reason: "Chiffrage à recouper", slot: "Major Grid", language: "FR / EN", tone: "review" },
  { key: "evt:av:2026-005", title: "Nouvelles restrictions de créneaux aéroportuaires", zone: "Europe", source: "Aéroport · démo", sources: 4, proof: "VERIFIED", importance: "Moyenne", decision: "APPROVED_PUBLIC", reason: "Contexte et calendrier établis", slot: "Vertical Lane", language: "FR", tone: "pass" },
  { key: "evt:av:2026-006", title: "Rumeur de rapprochement entre deux compagnies", zone: "Europe", source: "Blog sectoriel · démo", sources: 1, proof: "UNCONFIRMED", importance: "Faible", decision: "BLOCKED", reason: "Rumeur sans confirmation", slot: "—", language: "FR", tone: "block" },
  { key: "evt:av:2026-007", title: "Mise à jour d’une directive de sécurité cabine", zone: "Monde", source: "OACI · démo", sources: 7, proof: "VERIFIED", importance: "Élevée", decision: "APPROVED_PUBLIC", reason: "Référence officielle mondiale", slot: "Dossier", language: "FR / EN", tone: "pass" },
  { key: "evt:av:2026-008", title: "Perturbation durable liée à une météo extrême", zone: "Amériques", source: "Météo / ATC · démo", sources: 8, proof: "DEVELOPING", importance: "Élevée", decision: "HOLD_CONTEXT", reason: "Chronologie encore mouvante", slot: "Timeline", language: "FR", tone: "hold" },
  { key: "evt:av:2026-009", title: "Vidéo d’essai d’un prototype militaire", zone: "Europe", source: "Vidéo · démo", sources: 2, proof: "PARTIAL", importance: "Moyenne", decision: "HOLD_SCOPE", reason: "Impact aviation civile à établir", slot: "—", language: "FR", tone: "hold" },
  { key: "evt:av:2026-010", title: "Rapport final d’un incident de piste", zone: "Afrique", source: "BEA local · démo", sources: 5, proof: "VERIFIED", importance: "Élevée", decision: "APPROVED_PUBLIC", reason: "Rapport factuel disponible", slot: "Dossier", language: "FR", tone: "pass" },
  { key: "evt:av:2026-011", title: "Nouvelle liaison saisonnière annoncée", zone: "Europe", source: "Compagnie · démo", sources: 2, proof: "VERIFIED", importance: "Faible", decision: "ARCHIVED", reason: "Promotion commerciale faible", slot: "—", language: "FR", tone: "archived" },
  { key: "evt:av:2026-012", title: "Déploiement d’une nouvelle procédure ATC", zone: "Asie-Pacifique", source: "Autorité · démo", sources: 6, proof: "VERIFIED", importance: "Moyenne", decision: "PROPOSED", reason: "Valeur explicative à qualifier", slot: "Continuous Feed", language: "FR", tone: "proposed" }
];

const readers = [
  ["01", "Lecteur de périmètre", "Est-ce bien pour ce site ?", "Verticale aviation, entités, thèmes, zones, exclusions.", "Une certification EASA est dans le périmètre ; une politique générale sans effet aérien ne l’est pas.", "PASS", "pass"],
  ["02", "Lecteur de preuve", "Les sources sont-elles assez solides, diverses et cohérentes ?", "Nombre de sources, diversité des domaines, source officielle, contradiction, incertitude, proof_status.", "Une source faible unique pour un incident → HOLD_PROOF.", "HOLD", "hold"],
  ["03", "Lecteur d’importance", "Quel est l’impact réel ?", "Ampleur, sécurité, personnes touchées, portée géographique, importance industrielle, nouveauté.", "Crash, fermeture d’espace aérien ou commande majeure d’avions.", "REVIEW", "review"],
  ["04", "Lecteur de contexte", "Peut-on l’expliquer proprement maintenant ?", "Faits établis, entités identifiées, historique, chronologie, éléments manquants.", "Un événement réel mais encore confus → HOLD_CONTEXT.", "HOLD", "hold"],
  ["05", "Éditeur de sortie", "Quel format sert le mieux l’utilisateur ?", "Urgence, profondeur, langue, image, vidéo, historique.", "Breaking, Lead Event, Major Grid, Vertical Lane, Continuous Feed, Dossier, Timeline, Video Wall.", "PASS", "pass"],
  ["06", "Gate", "Bloque ou autorise WeyOutput ?", "Contrat futur : PROPOSED, HOLD_SCOPE, HOLD_PROOF, HOLD_CONTEXT, REVIEW_REQUIRED, APPROVED_PUBLIC, BLOCKED, ARCHIVED.", "Aucune transition n’est exécutée dans cette V1.", "REVIEW", "review"]
] as const;

function Tag({ tone, children }: { tone: Tone; children: React.ReactNode }) { return <span className={`tag ${tone}`}>{children}</span>; }

export default function Home() {
  const [selected, setSelected] = useState<EventRow>(events[0]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => events.filter(e => `${e.key} ${e.title} ${e.decision}`.toLowerCase().includes(search.toLowerCase())), [search]);
  const openEvent = (event: EventRow) => { setSelected(event); setPanelOpen(true); };

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brandmark">W</span><span>WEY<span>REDACTION</span></span></div>
      <div className="workspace-label">ESPACE OPÉRATEUR</div>
      <nav>
        <a className="nav active"><i>◈</i> Comité de rédaction</a>
        <a className="nav"><i>◎</i> Produits <b>4</b></a>
        <a className="nav"><i>⌁</i> Policies</a>
        <a className="nav"><i>◌</i> Traçabilité</a>
      </nav>
      <div className="sidebar-bottom"><div className="demo-dot"/> Données de démonstration<br/><small>v1.0 · lecture seule</small></div>
    </aside>
    <section className="content">
      <header className="topbar"><div><div className="crumb">WEYMEDIA / SALLE ÉDITORIALE</div><h1>WeyRedaction <em>·</em> Comité de rédaction</h1><p>Sélection, preuve et visibilité par produit éditorial</p></div><div className="top-actions"><span className="readonly">◉ Lecture seule</span><button className="avatar" aria-label="Opérateur">WR</button></div></header>
      <div className="observation"> <strong>MODE OBSERVATION</strong><span>— aucun événement n’est publié ou modifié depuis cette interface.</span></div>
      <div className="product-row"><div><label>PRODUIT ÉDITORIAL</label><div className="product-tabs"><button className="product active">AviationWey <span>ACTIF</span></button><button className="product" disabled>NewsWey <small>bientôt</small></button><button className="product" disabled>StadWey <small>bientôt</small></button><button className="product" disabled>GeoWey <small>bientôt</small></button></div></div><div className="policy-chip"><span>POLICY VERSION</span><b>aviationwey-v1</b></div></div>

      <section className="policy card"><div className="section-title"><div><span className="eyebrow">POLITIQUE VERSIONNÉE · NON EXÉCUTABLE</span><h2>Politique AviationWey V1</h2></div><Tag tone="proposed">DÉMONSTRATION</Tag></div><div className="policy-grid"><div><b>product_key</b><code>aviationwey</code></div><div><b>policy_version</b><code>aviationwey-v1</code></div><div className="wide"><b>Objectif</b><p>Observer et expliquer les événements importants de l’aviation mondiale.</p></div><div><b>Périmètre</b><p>Aviation civile, compagnies, avionneurs, appareils, aéroports, autorités, sécurité, incidents majeurs, régulation, espace aérien et défense aérienne lorsque son impact aviation est réel.</p></div><div><b>Exclusions</b><p>Rumeurs, promotions commerciales faibles, contenus hors aviation, doublons, incidents mineurs non confirmés.</p></div><div><b>Exigence</b><p>Faits uniquement, sources visibles, incertitude affichée, aucune opinion.</p></div><div><b>Règle de publication</b><p>Un événement n’est jamais publié directement depuis un signal.</p></div></div></section>

      <section><div className="section-heading"><div><span className="eyebrow">LECTURE MULTI-CRITÈRES</span><h2>Les six lecteurs du comité</h2></div><span className="legend"><i className="pass"/> PASS <i className="hold"/> HOLD <i className="review"/> REVIEW</span></div><div className="reader-grid">{readers.map(([num, name, question, observes, example, status, tone]) => <article className="reader card" key={num}><div className="reader-top"><span className="number">{num}</span><Tag tone={tone as Tone}>{status}</Tag></div><h3>{name}</h3><strong>{question}</strong><dl><dt>Observe</dt><dd>{observes}</dd><dt>Exemple AviationWey</dt><dd>{example}</dd></dl></article>)}</div></section>

      <section className="queue-section"><div className="section-heading"><div><span className="eyebrow">12 CANDIDATS · DONNÉES DE DÉMONSTRATION</span><h2>File éditoriale AviationWey</h2></div><input aria-label="Rechercher" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un event_key…" /></div><div className="table-card card"><div className="table-wrap"><table><thead><tr><th>EVENT_KEY</th><th>TITRE</th><th>ZONE</th><th>DERNIÈRE SOURCE</th><th>SRC.</th><th>PREUVE</th><th>IMPORTANCE</th><th>DÉCISION PROPOSÉE</th><th>RAISON PRINCIPALE</th><th>SLOT</th><th>LANGUE</th><th>POLICY</th></tr></thead><tbody>{filtered.map(event => <tr key={event.key} onClick={() => openEvent(event)}><td><code>{event.key}</code></td><td className="title">{event.title}</td><td>{event.zone}</td><td>{event.source}</td><td>{event.sources}</td><td>{event.proof}</td><td>{event.importance}</td><td><Tag tone={event.tone}>{event.decision}</Tag></td><td>{event.reason}</td><td>{event.slot}</td><td>{event.language}</td><td><code>aviationwey-v1</code></td></tr>)}</tbody></table></div><div className="table-foot">Cliquez sur une ligne pour consulter le dossier de lecture. <b>Aucune décision n’est exécutée.</b></div></div></section>

      <section className="trace card"><div className="trace-icon">?</div><div><span className="eyebrow">TRAÇABILITÉ FUTURE</span><h2>Pourquoi cette décision ?</h2><p>Une décision WeyRedaction réelle conservera <b>event_key</b>, <b>product_key</b>, <b>policy_version</b>, critères évalués, résultats des six lecteurs, décision, raison, date et opérateur ou moteur ayant proposé la décision.</p></div></section>
    </section>
    {panelOpen && <><div className="scrim" onClick={() => setPanelOpen(false)}/><aside className="detail" role="dialog" aria-modal="true" aria-label="Détail événement"><button className="close" onClick={() => setPanelOpen(false)} aria-label="Fermer">×</button><span className="eyebrow">DOSSIER DE LECTURE · DÉMONSTRATION</span><h2>{selected.title}</h2><code className="event-key">{selected.key}</code><div className="detail-decision"><span>Décision proposée</span><Tag tone={selected.tone}>{selected.decision}</Tag></div><p className="summary">Résumé factuel simulé : cet événement est présenté uniquement pour démontrer le parcours de lecture WeyRedaction. Aucun fait live ni statut runtime n’est affiché.</p><Detail label="Sources et diversité" value={`${selected.sources} sources signalées · diversité simulée · ${selected.source}`} /><Detail label="Entités" value="Autorité aéronautique, opérateur, appareil et zone concernés" /><Detail label="Pays / zone" value={selected.zone} /><Detail label="Statut de preuve" value={selected.proof} /><div className="detail-readers"><h3>Résultat des six lecteurs</h3>{readers.map(([num, name, , , , status, tone]) => <div key={num}><span>{num} · {name}</span><Tag tone={tone as Tone}>{status}</Tag></div>)}</div><Detail label="Raison détaillée" value={selected.reason} /><Detail label="Slot et format recommandés" value={`${selected.slot} · recommandation non exécutée`} /><Detail label="policy_version" value="aviationwey-v1" mono /><div className="not-executed">Décision non exécutée</div></aside></>}
  </main>;
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="detail-field"><span>{label}</span><p className={mono ? "mono" : ""}>{value}</p></div>; }
