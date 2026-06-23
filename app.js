/* ===========================================================================
   FAMILLE LÈGE · MPP — dashboard Coupe du Monde 2026
   Tout est calculé côté client depuis window.MPP_DATA (cf. build_data.py).
   =========================================================================== */
(() => {
"use strict";

const D = window.MPP_DATA;
if (!D) { document.body.innerHTML = "<p style='padding:40px'>data.js manquant — lance <code>python3 build_data.py</code>.</p>"; return; }

const { predictions: PRED, matches: MATCHES, standingsGw: SGW, users: USERS, meta: META } = D;

/* ---------- helpers ---------- */
const byName = (a, b) => a.localeCompare(b);
const sum = arr => arr.reduce((s, x) => s + x, 0);
const fmt = n => n.toLocaleString("fr-FR");
const fixed = (n, d=0) => (Math.round(n * 10**d) / 10**d).toLocaleString("fr-FR");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ord = n => n + (n === 1 ? "<sup>er</sup>" : "<sup>e</sup>");
const shortDate = iso => { const d = new Date(iso); return ("0"+d.getDate()).slice(-2) + "/" + ("0"+(d.getMonth()+1)).slice(-2); };

const GAME_WEEKS = [...new Set(MATCHES.map(m => m.game_week))].sort((a, b) => a - b);
const PLAYERS = [...new Set(USERS.map(u => u.username))].sort(byName);
const usersByName = Object.fromEntries(USERS.map(u => [u.username, u]));
const VALID = new Set(PLAYERS);

/* ---------- viewer ("toi") — sélectionnable via ?me=, mémorisé en localStorage ---------- */
function resolveMe() {
  const q = new URLSearchParams(location.search).get("me");
  if (q && VALID.has(q)) return q;
  let s = null; try { s = localStorage.getItem("mpp_me"); } catch (_) {}
  return s && VALID.has(s) ? s : null;
}
let ME = resolveMe();

/* per-journée points + bons + exacts (source API, autoritaire) */
const gwStat = {};                       // gwStat[name][gw] = {pts, good, exact, rank}
SGW.forEach(r => {
  (gwStat[r.username] ||= {})[r.game_week] = {
    pts: r.gw_points || 0, good: r.gw_good || 0, exact: r.gw_exact || 0, rank: r.gw_rank,
  };
});
const gwPts = (name, gw) => (gwStat[name]?.[gw]?.pts) || 0;

/* cumul + rang cumulé par journée (calculé) */
const cumPts = {};                       // cumPts[name][gw]
const cumRank = {};                      // cumRank[name][gw]
PLAYERS.forEach(p => { cumPts[p] = {}; cumRank[p] = {}; });
GAME_WEEKS.forEach((gw, i) => {
  PLAYERS.forEach(p => {
    cumPts[p][gw] = (i > 0 ? cumPts[p][GAME_WEEKS[i-1]] : 0) + gwPts(p, gw);
  });
  const ordered = [...PLAYERS].sort((a, b) => cumPts[b][gw] - cumPts[a][gw] || byName(a, b));
  ordered.forEach((p, idx) => { cumRank[p][gw] = idx + 1; });
});
const lastGw = GAME_WEEKS[GAME_WEEKS.length - 1];
const prevGw = GAME_WEEKS[GAME_WEEKS.length - 2];

/* ---------- évolution MATCH PAR MATCH (chronologique) ---------- */
const MATCH_SEQ = [...MATCHES].sort((a, b) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : (a.match_id < b.match_id ? -1 : 1));
const N_M = MATCH_SEQ.length;
const ptsUM = {};                        // ptsUM[name][match_id] = pts_total
PRED.forEach(p => { (ptsUM[p.username] ||= {})[p.match_id] = p.pts_total; });
const cumPtsM = {};                      // cumPtsM[name] = [.. par index de match ..]
const cumRankM = {};                     // cumRankM[name] = [.. rang après chaque match ..]
PLAYERS.forEach(p => { cumPtsM[p] = new Array(N_M); cumRankM[p] = new Array(N_M); });
MATCH_SEQ.forEach((m, i) => {
  PLAYERS.forEach(p => {
    const prev = i > 0 ? cumPtsM[p][i-1] : 0;
    cumPtsM[p][i] = prev + (ptsUM[p]?.[m.match_id] || 0);
  });
  const ordered = [...PLAYERS].sort((a, b) => cumPtsM[b][i] - cumPtsM[a][i] || byName(a, b));
  ordered.forEach((p, idx) => { cumRankM[p][i] = idx + 1; });
});
const MATCH_LABELS = MATCH_SEQ.map((_, i) => String(i + 1));
/* repères de journée : premier index de chaque game_week */
const GW_BOUNDS = [];
MATCH_SEQ.forEach((m, i) => { if (i === 0 || m.game_week !== MATCH_SEQ[i-1].game_week) GW_BOUNDS.push({ index: i, gw: m.game_week }); });

/* classement final (autoritaire via users.csv) */
const TABLE = [...USERS].sort((a, b) => a.cumul_rank - b.cumul_rank);

/* précision globale */
const predCount = {};
PRED.forEach(p => { predCount[p.username] = (predCount[p.username] || 0) + 1; });

/* ---------- couleurs joueurs (le viewer = or) ---------- */
const PALETTE = ["#4cc9f0","#f72585","#4895ef","#43aa8b","#f9844a","#90be6d","#b5179e",
  "#577590","#f3722c","#277da1","#9d4edd","#ff8fab","#06d6a0","#ef476f","#118ab2","#ffd166"];
const COLOR = {};
function computeColors() {
  let ci = 0;
  TABLE.forEach(u => { COLOR[u.username] = u.username === ME ? "#e9b949" : PALETTE[ci++ % PALETTE.length]; });
}
computeColors();

/* ===========================================================================
   Chart.js defaults
   =========================================================================== */
const C = window.Chart;
if (C) {
  C.defaults.font.family = "'JetBrains Mono', monospace";
  C.defaults.font.size = 11;
  C.defaults.color = "#9aa0ad";
  C.defaults.plugins.legend.display = false;
  C.defaults.plugins.tooltip.backgroundColor = "rgba(10,12,16,.96)";
  C.defaults.plugins.tooltip.borderColor = "rgba(233,185,73,.3)";
  C.defaults.plugins.tooltip.borderWidth = 1;
  C.defaults.plugins.tooltip.titleColor = "#ece7d8";
  C.defaults.plugins.tooltip.bodyColor = "#cfd3da";
  C.defaults.plugins.tooltip.padding = 11;
  C.defaults.plugins.tooltip.cornerRadius = 9;
  C.defaults.plugins.tooltip.titleFont = { family: "'JetBrains Mono', monospace", size: 10, weight: "600" };
  C.defaults.plugins.tooltip.boxPadding = 5;
}
const GRID = "rgba(255,255,255,.05)";
const isNarrow = () => window.matchMedia("(max-width: 640px)").matches;

/* plugin: repères verticaux de journée (axe par match) */
function gwBoundsPlugin() {
  return {
    id: "gwbounds",
    afterDraw(chart) {
      const xs = chart.scales.x, ys = chart.scales.y; if (!xs || !ys) return;
      const { ctx } = chart; ctx.save();
      GW_BOUNDS.forEach(b => {
        const x = xs.getPixelForValue(b.index);
        if (b.index > 0) {
          ctx.strokeStyle = "rgba(233,185,73,.16)"; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, ys.top); ctx.lineTo(x, ys.bottom); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = "rgba(233,185,73,.55)"; ctx.font = "600 9px 'JetBrains Mono'"; ctx.textAlign = "left";
        ctx.fillText("J" + b.gw, x + 4, ys.top + 10);
      });
      ctx.restore();
    },
  };
}
function matchTitle(i) {
  const m = MATCH_SEQ[i];
  return `Match ${i + 1} · ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team}`;
}

/* ===========================================================================
   HERO
   =========================================================================== */
function hero() {
  const leader = TABLE[0], second = TABLE[1];
  const me = ME ? usersByName[ME] : null;
  document.getElementById("eyebrow").textContent =
    `Mon Petit Prono · Coupe du Monde 2026 · Journée ${META.max_game_week}/9`;

  const intro = `${USERS.length} joueurs, ${META.n_matches_played} matchs, ${fmt(PRED.length)} pronos décortiqués. `;
  document.getElementById("heroSub").innerHTML = me
    ? intro + `<b>${esc(leader.username)}</b> mène la danse, <b>toi (${ord(me.cumul_rank)})</b> ` +
      (me.cumul_rank === 1 ? `tout en haut 👑` : `à ${fmt(leader.cumul_points - me.cumul_points)} pts du sommet`) + `.`
    : intro + `<b>${esc(leader.username)}</b> mène la danse devant <b>${esc(second.username)}</b> (${fmt(leader.cumul_points - second.cumul_points)} pts d'écart).`;

  const stats = me ? [
    ["#" + me.cumul_rank, "Ton rang"],
    [fmt(me.cumul_points), "Tes points"],
    [me.cumul_exact, "Tes scores exacts"],
    [META.max_game_week + "/9", "Journées jouées"],
    [USERS.length, "Joueurs"],
  ] : [
    [META.max_game_week + "/9", "Journées jouées"],
    [USERS.length, "Joueurs"],
    [META.n_matches_played, "Matchs"],
    [fmt(PRED.length), "Pronos"],
    [fmt(leader.cumul_points), "Pts du leader"],
  ];
  document.getElementById("heroStats").innerHTML = stats.map(([n, l]) =>
    `<div class="hstat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");
}

/* ---------- sélecteur de joueur ---------- */
function applyMe(v) {
  ME = v && VALID.has(v) ? v : null;
  try { if (ME) localStorage.setItem("mpp_me", ME); else localStorage.removeItem("mpp_me"); } catch (_) {}
  try {                                   // peut throw en file:// — non bloquant
    const url = new URL(location);
    if (ME) url.searchParams.set("me", ME); else url.searchParams.delete("me");
    history.replaceState(null, "", url);
  } catch (_) {}
  renderAll();
}
function setupMePick() {
  const sel = document.getElementById("meSelect");
  sel.innerHTML = `<option value="">— choisis ton joueur —</option>` +
    PLAYERS.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  sel.addEventListener("change", e => applyMe(e.target.value));
  refreshMePick();
}
function refreshMePick() {
  const sel = document.getElementById("meSelect"); if (sel) sel.value = ME || "";
  const wrap = document.getElementById("mePick"); if (wrap) wrap.classList.toggle("unset", !ME);
}

/* ===========================================================================
   01 — PODIUM + CLASSEMENT
   =========================================================================== */
function standings() {
  const top3 = TABLE.slice(0, 3);
  const order = [1, 0, 2];               // 2e, 1er, 3e visuellement
  const cls = ["second", "first", "third"];
  const medal = { 0: "01", 1: "02", 2: "03" };
  document.getElementById("podium").innerHTML = order.map((idx, vi) => {
    const u = top3[idx]; if (!u) return "";
    const me = u.username === ME;
    return `<div class="pod ${cls[vi]}">
      ${idx === 0 ? '<div class="crown">👑</div>' : ''}
      <div class="medal">${medal[idx]}</div>
      <div class="who ${me ? "me" : ""}">${esc(u.username)}</div>
      <div class="pts">${fmt(u.cumul_points)} pts · ${u.cumul_good} bons · ${u.cumul_exact} exacts</div>
      <div class="bar"></div>
    </div>`;
  }).join("");

  const maxPts = TABLE[0].cumul_points;
  const head = `<thead><tr>
    <th>#</th><th>Joueur</th><th class="num">Points</th>
    <th class="num">Bons</th><th class="num">Exacts</th><th class="num">Mvt</th></tr></thead>`;
  const rows = TABLE.map(u => {
    const me = u.username === ME;
    const w = Math.max(4, 100 * u.cumul_points / maxPts);
    const r1 = cumRank[u.username]?.[lastGw], r0 = cumRank[u.username]?.[prevGw];
    let mv = '<span class="mv flat">—</span>';
    if (r0 && r1) {
      const d = r0 - r1;
      mv = d > 0 ? `<span class="mv up">▲ ${d}</span>` : d < 0 ? `<span class="mv down">▼ ${-d}</span>` : '<span class="mv flat">=</span>';
    }
    return `<tr class="${me ? "me" : ""}">
      <td><span class="rk ${u.cumul_rank <= 3 ? "top" : ""}">${u.cumul_rank}</span></td>
      <td><div class="pname"><span class="dot" style="background:${COLOR[u.username]}"></span>
        <span class="nm ${me ? "me" : ""}">${esc(u.username)}</span></div></td>
      <td class="num"><div class="ptsbar"><span class="track"><i style="width:${w}%"></i></span><b>${fmt(u.cumul_points)}</b></div></td>
      <td class="num mono">${u.cumul_good}</td>
      <td class="num mono">${u.cumul_exact}</td>
      <td class="num">${mv}</td></tr>`;
  }).join("");
  document.getElementById("standingsTable").innerHTML = head + "<tbody>" + rows + "</tbody>";
}

/* ===========================================================================
   02 — BUMP CHART (évolution des rangs, match par match)
   =========================================================================== */
let bumpChart;
const hidden = new Set();
function buildBump() {
  const datasets = TABLE.map(u => {
    const me = u.username === ME;
    return {
      label: u.username,
      data: cumRankM[u.username],
      borderColor: COLOR[u.username],
      backgroundColor: COLOR[u.username],
      borderWidth: me ? 3.5 : 1.5,
      pointRadius: 0,
      pointHoverRadius: me ? 6 : 5,
      pointBackgroundColor: COLOR[u.username],
      pointBorderColor: "#0a0c10",
      pointBorderWidth: 2,
      tension: 0.28,
      hidden: hidden.has(u.username),
      order: me ? 0 : 1,
    };
  });
  bumpChart = new C(document.getElementById("bumpChart"), {
    type: "line",
    data: { labels: MATCH_LABELS, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false, axis: "x" },
      layout: { padding: { top: 8, right: 14, left: 4 } },
      scales: {
        y: {
          reverse: true, min: 1, max: PLAYERS.length,
          ticks: { stepSize: 1, color: "#5d636f", callback: v => v + (v === 1 ? "ᵉʳ" : "ᵉ") },
          grid: { color: GRID }, border: { display: false },
        },
        x: {
          ticks: { color: "#9aa0ad", autoSkip: true, maxTicksLimit: isNarrow() ? 6 : 12, maxRotation: 0, font: { size: 11, weight: "600" } },
          grid: { display: false }, border: { color: GRID },
          title: { display: true, text: "MATCHS JOUÉS →", color: "#5d636f", font: { size: 9, weight: "600" }, padding: { top: 2 } },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: items => matchTitle(items[0].dataIndex),
            label: c => `  ${c.dataset.label} — ${ordTxt(c.parsed.y)} (${fmt(cumPtsM[c.dataset.label][c.dataIndex])} pts)`,
          },
        },
      },
    },
    plugins: [gwBoundsPlugin()],
  });
  renderLegend("bumpLegend");
}
const ordTxt = n => n + (n === 1 ? "ᵉʳ" : "ᵉ");

const allShown = () => hidden.size === 0;
function allBtnLabel() { return allShown() ? "✕ Tout masquer" : "✓ Tout afficher"; }
function renderLegend(id) {
  const ctrl = `<button class="lg lg-all" data-all="1">${allBtnLabel()}</button>`;
  document.getElementById(id).innerHTML = ctrl + TABLE.map(u =>
    `<span class="lg ${u.username === ME ? "me" : ""} ${hidden.has(u.username) ? "off" : ""}" data-p="${esc(u.username)}">
      <span class="d" style="background:${COLOR[u.username]}"></span>${esc(u.username)}</span>`).join("");
}
/* synchronise le libellé des boutons "tout afficher/masquer" des deux légendes */
function refreshAllBtns() {
  document.querySelectorAll(".lg-all").forEach(b => { b.textContent = allBtnLabel(); });
}
/* toggle partagé entre les deux charts d'évolution */
function togglePlayer(p) {
  hidden.has(p) ? hidden.delete(p) : hidden.add(p);
  [["bumpLegend", bumpChart], ["pointsLegend", pointsChart]].forEach(([lid, ch]) => {
    const el = document.querySelector(`#${lid} .lg[data-p="${CSS.escape(p)}"]`);
    if (el) el.classList.toggle("off", hidden.has(p));
    const ds = ch?.data.datasets.find(d => d.label === p);
    if (ds) { ds.hidden = hidden.has(p); ch.update(); }
  });
  refreshAllBtns();
}
/* tout afficher si au moins un est masqué, sinon tout masquer */
function toggleAllPlayers() {
  if (allShown()) TABLE.forEach(u => hidden.add(u.username));
  else hidden.clear();
  [["bumpLegend", bumpChart], ["pointsLegend", pointsChart]].forEach(([lid, ch]) => {
    if (document.getElementById(lid)) renderLegend(lid);
    if (ch) { ch.data.datasets.forEach(ds => { ds.hidden = hidden.has(ds.label); }); ch.update(); }
  });
}
function wireLegend(id) {
  document.getElementById(id).addEventListener("click", e => {
    if (e.target.closest(".lg-all")) { toggleAllPlayers(); return; }
    const el = e.target.closest(".lg"); if (!el) return;
    togglePlayer(el.dataset.p);
  });
}

/* ===========================================================================
   03 — POINTS (cumulé match par match / par journée)
   =========================================================================== */
let pointsChart, pointsMode = "cumul";
function buildPoints() {
  const perMatch = pointsMode === "cumul";
  const labels = perMatch ? MATCH_LABELS : GAME_WEEKS.map(g => "J" + g);
  const datasets = TABLE.map(u => {
    const me = u.username === ME;
    const data = perMatch ? cumPtsM[u.username] : GAME_WEEKS.map(g => gwPts(u.username, g));
    return {
      label: u.username, data,
      borderColor: COLOR[u.username], backgroundColor: COLOR[u.username] + "22",
      borderWidth: me ? 3.5 : 1.6,
      pointRadius: perMatch ? 0 : (me ? 4 : 2.5),
      pointHoverRadius: 6,
      pointBackgroundColor: COLOR[u.username], pointBorderColor: "#0a0c10", pointBorderWidth: 1.5,
      tension: 0.28, fill: me ? "origin" : false, order: me ? 0 : 1,
      hidden: hidden.has(u.username),
    };
  });
  pointsChart = new C(document.getElementById("pointsChart"), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: { ticks: { color: "#5d636f", callback: v => fmt(v) }, grid: { color: GRID }, border: { display: false } },
        x: {
          ticks: { color: "#9aa0ad", autoSkip: true, maxTicksLimit: perMatch ? (isNarrow() ? 6 : 12) : 6, maxRotation: 0, font: { size: perMatch ? 11 : 13, weight: "700" } },
          grid: { display: false }, border: { color: GRID },
          title: perMatch ? { display: true, text: "MATCHS JOUÉS →", color: "#5d636f", font: { size: 9, weight: "600" }, padding: { top: 2 } } : { display: false },
        },
      },
      plugins: {
        tooltip: {
          itemSort: (a, b) => b.parsed.y - a.parsed.y,
          callbacks: {
            title: items => perMatch ? matchTitle(items[0].dataIndex) : "Journée " + items[0].label.slice(1),
            label: c => `  ${c.dataset.label}: ${fmt(c.parsed.y)} pts`,
          },
        },
      },
    },
    plugins: perMatch ? [gwBoundsPlugin()] : [],
  });
  renderLegend("pointsLegend");
}
function wirePointsSeg() {
  document.querySelectorAll("#ptsSeg button").forEach(b => b.addEventListener("click", () => {
    if (b.classList.contains("on")) return;
    document.querySelectorAll("#ptsSeg button").forEach(x => x.classList.remove("on"));
    b.classList.add("on"); pointsMode = b.dataset.mode;
    pointsChart.destroy(); buildPoints();
  }));
}

/* ===========================================================================
   04 — ROIS DE LA JOURNÉE
   =========================================================================== */
function gwWinners() {
  document.getElementById("gwWinners").innerHTML = GAME_WEEKS.map(gw => {
    const ranked = PLAYERS.map(p => ({ p, pts: gwPts(p, gw), g: gwStat[p]?.[gw]?.good||0, e: gwStat[p]?.[gw]?.exact||0 }))
      .sort((a, b) => b.pts - a.pts);
    const w = ranked[0], second = ranked[1];
    const me = w.p === ME;
    return `<div class="fcard">
      <span class="tag">Journée ${gw}</span>
      <div class="big" style="color:${COLOR[w.p]}">${esc(w.p)}</div>
      <div class="scoreline"><span class="sc">${fmt(w.pts)}</span> pts
        <span class="vs">·</span> ${w.g} bons · ${w.e} exacts</div>
      <div class="desc" style="margin-top:14px">Devance <b>${esc(second.p)}</b> de ${fmt(w.pts - second.pts)} pts${me ? " — et c'est toi 🔥" : ""}.</div>
    </div>`;
  }).join("");
}

/* ===========================================================================
   05 — PRÉCISION (scatter bons% vs exacts%)
   =========================================================================== */
let precChart;
function precision() {
  const pts = TABLE.map(u => {
    const n = predCount[u.username] || 1;
    return {
      x: 100 * u.cumul_good / n, y: 100 * u.cumul_exact / n,
      r: 7 + 16 * u.cumul_points / TABLE[0].cumul_points,
      name: u.username, pts: u.cumul_points, good: u.cumul_good, exact: u.cumul_exact, n,
    };
  });
  const medX = median(pts.map(p => p.x)), medY = median(pts.map(p => p.y));
  precChart = new C(document.getElementById("precChart"), {
    type: "bubble",
    data: { datasets: [{
      data: pts,
      backgroundColor: pts.map(p => COLOR[p.name] + "cc"),
      borderColor: pts.map(p => COLOR[p.name]),
      borderWidth: pts.map(p => p.name === ME ? 3 : 1.5),
      hoverBorderWidth: 3,
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: 10 },
      scales: {
        x: { title: { display: true, text: "% DE BONS PRONOS", color: "#5d636f", font: { size: 10, weight: "600" } },
             ticks: { color: "#5d636f", callback: v => v + "%" }, grid: { color: GRID }, border: { display: false } },
        y: { title: { display: true, text: "% DE SCORES EXACTS", color: "#5d636f", font: { size: 10, weight: "600" } },
             ticks: { color: "#5d636f", callback: v => v + "%" }, grid: { color: GRID }, border: { display: false } },
      },
      plugins: {
        tooltip: { callbacks: {
          title: items => items[0].raw.name,
          label: p => `  ${fixed(p.raw.x)}% bons · ${fixed(p.raw.y)}% exacts · ${fmt(p.raw.pts)} pts`,
        }},
      },
    },
    plugins: [{
      id: "names",
      afterDatasetsDraw(chart) {
        const { ctx } = chart; const meta = chart.getDatasetMeta(0);
        const small = isNarrow();
        ctx.save(); ctx.font = "600 10px 'JetBrains Mono'"; ctx.textAlign = "center";
        meta.data.forEach((pt, i) => {
          const d = pts[i];
          if (small && d.name !== ME) return;     // sur mobile : seulement toi (sinon illisible)
          ctx.fillStyle = d.name === ME ? "#f7da8c" : "rgba(236,231,216,.75)";
          ctx.fillText(d.name.length > 11 ? d.name.slice(0, 10) + "…" : d.name, pt.x, pt.y - d.r - 4);
        });
        const xs = chart.scales.x, ys = chart.scales.y;
        ctx.strokeStyle = "rgba(233,185,73,.18)"; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(xs.getPixelForValue(medX), ys.top); ctx.lineTo(xs.getPixelForValue(medX), ys.bottom); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xs.left, ys.getPixelForValue(medY)); ctx.lineTo(xs.right, ys.getPixelForValue(medY)); ctx.stroke();
        ctx.restore();
      },
    }],
  });
}
function median(a) { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; }

/* ===========================================================================
   06 — INSIGHTS / FAITS MARQUANTS
   =========================================================================== */
function teamLabel(p) { return `${esc(p.home_team)} ${p.home_score}-${p.away_score} ${esc(p.away_team)}`; }

function insights() {
  const cards = [];

  // a) Le plus gros coup (meilleur prono unique)
  const best = [...PRED].sort((a, b) => b.pts_total - a.pts_total)[0];
  cards.push({ glyph: "💥", tag: "Le plus gros coup", big: `+${fmt(best.pts_total)}`,
    body: `<b>${esc(best.username)}</b> a misé <b>${best.pred_home}-${best.pred_away}</b> sur ${teamLabel(best)}.${best.is_exact ? " Score exact." : ""}` });

  // b) Le devin (plus de scores exacts)
  const devin = [...TABLE].sort((a, b) => b.cumul_exact - a.cumul_exact)[0];
  cards.push({ glyph: "🔮", tag: "Le devin", big: devin.username, color: COLOR[devin.username],
    body: `<b>${devin.cumul_exact} scores exacts</b> sur ${predCount[devin.username]} pronos. La boule de cristal.` });

  // map par match (good / exact)
  const perMatch = {};
  PRED.forEach(p => {
    const m = (perMatch[p.match_id] ||= { good: 0, n: 0, ex: 0, label: teamLabel(p) });
    m.good += p.is_good; m.ex += p.is_exact; m.n++;
  });

  // c) Le piège (match le moins bien deviné)
  const trap = Object.values(perMatch).filter(m => m.n >= 5).sort((a, b) => a.good/a.n - b.good/b.n)[0];
  if (trap) cards.push({ glyph: "🪤", tag: "Le piège", big: `${Math.round(100*trap.good/trap.n)}%`,
    body: `Seuls <b>${trap.good}/${trap.n}</b> ont eu le bon résultat sur <b>${trap.label}</b>.` });

  // d) Le carton plein (match le plus deviné en exact)
  const easy = Object.values(perMatch).sort((a, b) => b.ex/b.n - a.ex/a.n)[0];
  if (easy) cards.push({ glyph: "🎯", tag: "Le carton plein", big: `${easy.ex}/${easy.n}`,
    body: `ont trouvé le <b>score exact</b> de <b>${easy.label}</b>. Trop facile.` });

  // e) L'attaquant (plus de buts pronostiqués en moyenne)
  const goals = {};
  PRED.forEach(p => { const g = goals[p.username] ||= { tot: 0, n: 0 }; g.tot += p.pred_home + p.pred_away; g.n++; });
  const gArr = Object.entries(goals).map(([p, g]) => ({ p, avg: g.tot/g.n }));
  const opti = [...gArr].sort((a, b) => b.avg - a.avg)[0], cauti = [...gArr].sort((a, b) => a.avg - b.avg)[0];
  cards.push({ glyph: "⚽", tag: "L'attaquant", big: opti.p, color: COLOR[opti.p],
    body: `Pronostique <b>${fixed(opti.avg, 1)} buts/match</b> en moyenne. Le plus prudent : <b>${esc(cauti.p)}</b> (${fixed(cauti.avg, 1)}).` });

  // f) Le contrarian (pronos les plus rares)
  const rar = {};
  PRED.forEach(p => { const r = rar[p.username] ||= { tot: 0, n: 0, rare: 0 }; r.tot += p.rarity_level; r.n++; if (p.rarity_level >= 2) r.rare++; });
  const contr = Object.entries(rar).map(([p, r]) => ({ p, avg: r.tot/r.n, rare: r.rare })).sort((a, b) => b.avg - a.avg || b.rare - a.rare)[0];
  if (contr) cards.push({ glyph: "🎲", tag: "À contre-courant", big: contr.p, color: COLOR[contr.p],
    body: `Les pronos les plus rares de la ligue — <b>${contr.rare} paris</b> que presque personne n'a osés.` });

  // g) Au plus près (plus petite erreur moyenne en buts)
  const err = {};
  PRED.forEach(p => { const e = err[p.username] ||= { tot: 0, n: 0 }; e.tot += Math.abs(p.pred_home - p.home_score) + Math.abs(p.pred_away - p.away_score); e.n++; });
  const close = Object.entries(err).map(([p, e]) => ({ p, avg: e.tot/e.n })).sort((a, b) => a.avg - b.avg)[0];
  if (close) cards.push({ glyph: "📐", tag: "Au plus près", big: close.p, color: COLOR[close.p],
    body: `<b>${fixed(close.avg, 1)} but d'écart</b> en moyenne avec le score réel. Le plus chirurgical.` });

  // h) Le sniper du nul (meilleur sur les matchs nuls)
  const drawIds = new Set(MATCHES.filter(m => m.result === "D").map(m => m.match_id));
  if (drawIds.size) {
    const dr = {};
    PRED.filter(p => drawIds.has(p.match_id)).forEach(p => { const x = dr[p.username] ||= { good: 0, n: 0 }; x.good += p.is_good; x.n++; });
    const sniper = Object.entries(dr).map(([p, x]) => ({ p, good: x.good, n: x.n })).sort((a, b) => b.good - a.good || a.n - b.n)[0];
    if (sniper) cards.push({ glyph: "🥅", tag: "Le sniper du nul", big: `${sniper.good}/${drawIds.size}`,
      body: `<b>${esc(sniper.p)}</b> a senti <b>${sniper.good}</b> des ${drawIds.size} matchs nuls. Le roi du 1-1.` });
  }

  // i) Les sosies (pronos les plus identiques)
  const predSc = {};
  PRED.forEach(p => { (predSc[p.username] ||= {})[p.match_id] = p.pred_home + "|" + p.pred_away; });
  let sosie = { a: null, b: null, same: -1, joint: 0 };
  for (let i = 0; i < PLAYERS.length; i++) for (let j = i + 1; j < PLAYERS.length; j++) {
    const A = PLAYERS[i], B = PLAYERS[j], ma = predSc[A] || {}, mb = predSc[B] || {};
    let same = 0, joint = 0;
    for (const mid in ma) if (mb[mid] != null) { joint++; if (ma[mid] === mb[mid]) same++; }
    if (same > sosie.same) sosie = { a: A, b: B, same, joint };
  }
  if (sosie.a) cards.push({ glyph: "👯", tag: "Les sosies", big: `${sosie.same}`,
    body: `<b>${esc(sosie.a)}</b> et <b>${esc(sosie.b)}</b> ont fait <b>les mêmes pronos</b> ${sosie.same} fois sur ${sosie.joint}.` });

  // j) Score fétiche (score le plus pronostiqué)
  const sc = {};
  PRED.forEach(p => { const k = p.pred_home + "-" + p.pred_away; sc[k] = (sc[k] || 0) + 1; });
  const fav = Object.entries(sc).sort((a, b) => b[1] - a[1])[0];
  if (fav) cards.push({ glyph: "♟️", tag: "Score fétiche", big: fav[0],
    body: `Le score le plus pronostiqué de la ligue — <b>${fav[1]} fois</b> sur ${fmt(PRED.length)} pronos.` });

  // k) First blood (leader après la J1)
  const firstGw = GAME_WEEKS[0];
  const j1Leader = PLAYERS.find(p => cumRank[p][firstGw] === 1);
  if (j1Leader) {
    const stillTop = TABLE[0].username === j1Leader;
    cards.push({ glyph: "🚀", tag: "First blood", big: j1Leader, color: COLOR[j1Leader],
      body: `En tête dès la <b>J${firstGw}</b>. ${stillTop ? "Et toujours au sommet aujourd'hui." : "Depuis rattrapé au classement."}` });
  }

  // l) Ton rival (ME) — le voisin le plus proche au classement + duel de pronos
  if (ME && usersByName[ME]) {
    const meU = usersByName[ME];
    const ahead = TABLE.find(u => u.cumul_rank === meU.cumul_rank - 1);
    const behind = TABLE.find(u => u.cumul_rank === meU.cumul_rank + 1);
    const rival = ahead || behind;
    if (rival) {
      let beats = 0, joint = 0;
      const mine = ptsUM[ME] || {}, theirs = ptsUM[rival.username] || {};
      for (const mid in mine) if (theirs[mid] != null) { joint++; if (theirs[mid] > mine[mid]) beats++; }
      const gap = Math.abs(rival.cumul_points - meU.cumul_points);
      cards.push({ glyph: "⚔️", tag: "Ton rival", big: rival.username, color: COLOR[rival.username],
        body: ahead
          ? `Juste devant toi, <b>${fmt(gap)} pts</b> à reprendre. Il t'a battu sur <b>${beats}/${joint}</b> matchs.`
          : `Ton dauphin, <b>${fmt(gap)} pts</b> derrière. Il t'a battu sur <b>${beats}/${joint}</b> matchs.` });
    }
  }

  // m) Ton pic de forme (ME)
  if (ME) {
    const myGw = GAME_WEEKS.map(g => ({ g, pts: gwPts(ME, g), rank: gwStat[ME]?.[g]?.rank })).sort((a, b) => b.pts - a.pts)[0];
    if (myGw) cards.push({ glyph: "⭐", tag: "Ton pic de forme", big: `J${myGw.g}`, color: "#e9b949",
      body: `Ta meilleure journée : <b>${fmt(myGw.pts)} pts</b>${myGw.rank ? `, ${ord(myGw.rank)} de la ligue ce jour-là` : ""}.` });
  }

  document.getElementById("insightCards").innerHTML = cards.map(c => `
    <div class="fcard">
      <span class="glyph">${c.glyph}</span>
      <span class="tag">${c.tag}</span>
      <div class="big" style="${c.color ? `color:${c.color}` : ""}">${esc(c.big)}</div>
      <div class="desc">${c.body}</div>
    </div>`).join("");
}

/* ===========================================================================
   07 — DUEL
   =========================================================================== */
let h2hWired = false;
function setupH2H() {
  const selA = document.getElementById("h2hA"), selB = document.getElementById("h2hB");
  const prevA = selA.value, prevB = selB.value, valid = v => v && usersByName[v];
  const opts = TABLE.map(u => `<option value="${esc(u.username)}">${esc(u.username)}</option>`).join("");
  selA.innerHTML = opts; selB.innerHTML = opts;
  // selA suit le viewer (ME) ; on préserve l'adversaire choisi (selB) entre deux changements de "toi"
  selA.value = ME && usersByName[ME] ? ME : (valid(prevA) ? prevA : TABLE[0].username);
  selB.value = valid(prevB) && prevB !== selA.value ? prevB
    : (selA.value === TABLE[0].username ? TABLE[1].username : TABLE[0].username);
  if (!h2hWired) { selA.addEventListener("change", h2hRender); selB.addEventListener("change", h2hRender); h2hWired = true; }
  h2hRender();
}
function h2hRender() {
  const selA = document.getElementById("h2hA"), selB = document.getElementById("h2hB");
  const A = selA.value, B = selB.value;
  const ua = usersByName[A], ub = usersByName[B];
  const predMap = name => { const m = {}; PRED.filter(p => p.username === name).forEach(p => { m[p.match_id] = p; }); return m; };
  const pa = predMap(A), pb = predMap(B);
  let jointMatches = 0, agree = 0, aBeatsB = 0, bBeatsA = 0;
  Object.keys(pa).forEach(mid => {
    if (!pb[mid]) return; jointMatches++;
    if (pa[mid].pred_home === pb[mid].pred_home && pa[mid].pred_away === pb[mid].pred_away) agree++;
    if (pa[mid].pts_total > pb[mid].pts_total) aBeatsB++;
    else if (pb[mid].pts_total > pa[mid].pts_total) bBeatsA++;
  });
  const gwWon = GAME_WEEKS.reduce((acc, g) => { const x = gwPts(A, g), y = gwPts(B, g); if (x > y) acc[0]++; else if (y > x) acc[1]++; return acc; }, [0, 0]);
  const row = (lbl, a, b, hi = "max") => {
    const na = +(""+a).replace(/[^\d.-]/g,""), nb = +(""+b).replace(/[^\d.-]/g,"");
    const aw = hi === "max" ? na > nb : na < nb, bw = hi === "max" ? nb > na : nb < na;
    return `<div class="h2h-row"><div class="a ${aw ? "win" : ""}">${a}</div><div class="lbl">${lbl}</div><div class="b ${bw ? "win" : ""}">${b}</div></div>`;
  };
  document.getElementById("h2hGrid").innerHTML =
    `<div class="h2h-row"><div class="a hd" style="color:${COLOR[A]}">${esc(A)}</div><div class="lbl">&nbsp;</div><div class="b hd" style="color:${COLOR[B]}">${esc(B)}</div></div>` +
    row("Rang", ua.cumul_rank, ub.cumul_rank, "min") +
    row("Points", fmt(ua.cumul_points), fmt(ub.cumul_points)) +
    row("Bons", ua.cumul_good, ub.cumul_good) +
    row("Exacts", ua.cumul_exact, ub.cumul_exact) +
    row("Journées gagnées", gwWon[0], gwWon[1]) +
    row("Pronos gagnants*", aBeatsB, bBeatsA) +
    `<div class="h2h-row"><div class="note" style="grid-column:1/-1;text-align:center;margin-top:6px">
      ${agree}/${jointMatches} pronos <b>identiques</b> · *match où l'un a fait mieux que l'autre</div></div>`;
}

/* ===========================================================================
   reveal on scroll
   =========================================================================== */
function reveals() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.06 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
}

/* ===========================================================================
   render orchestration
   =========================================================================== */
function renderStatic() {
  hero(); standings(); gwWinners(); insights();
  const fm = document.getElementById("footMeta");
  if (fm && META?.generated_unix) fm.textContent = "Données mises à jour le " + new Date(META.generated_unix * 1000).toLocaleDateString("fr-FR");
}
function renderAll() {
  computeColors();
  renderStatic();
  if (C) { bumpChart?.destroy(); buildBump(); pointsChart?.destroy(); buildPoints(); precChart?.destroy(); precision(); }
  setupH2H();
  refreshMePick();
}

/* ---------- go ---------- */
renderStatic();
if (C) { buildBump(); wireLegend("bumpLegend"); buildPoints(); wireLegend("pointsLegend"); wirePointsSeg(); precision(); }
setupH2H();
setupMePick();
reveals();
// premières sections visibles direct
document.querySelectorAll(".reveal").forEach((el, i) => { if (i < 2) el.classList.add("in"); });

})();
