/* ===========================================================================
   FAMILLE LÈGE · MPP — dashboard Coupe du Monde 2026
   Tout est calculé côté client depuis window.MPP_DATA (cf. build_data.py).
   =========================================================================== */
(() => {
"use strict";

const D = window.MPP_DATA;
if (!D) { document.body.innerHTML = "<p style='padding:40px'>data.js manquant — lance <code>python3 build_data.py</code>.</p>"; return; }

const ME = "Djimitraillette";
const { predictions: PRED, matches: MATCHES, standingsGw: SGW, users: USERS, meta: META } = D;

/* ---------- helpers ---------- */
const byName = (a, b) => a.localeCompare(b);
const sum = arr => arr.reduce((s, x) => s + x, 0);
const fmt = n => n.toLocaleString("fr-FR");
const fixed = (n, d=0) => (Math.round(n * 10**d) / 10**d).toLocaleString("fr-FR");

const GAME_WEEKS = [...new Set(MATCHES.map(m => m.game_week))].sort((a, b) => a - b);
const PLAYERS = [...new Set(USERS.map(u => u.username))].sort(byName);
const usersByName = Object.fromEntries(USERS.map(u => [u.username, u]));

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
  const ordered = [...PLAYERS].sort((a, b) => cumPts[b][gw] - cumPts[a][gw]);
  ordered.forEach((p, idx) => { cumRank[p][gw] = idx + 1; });
});
const lastGw = GAME_WEEKS[GAME_WEEKS.length - 1];
const prevGw = GAME_WEEKS[GAME_WEEKS.length - 2];

/* classement final (autoritaire via users.csv) */
const TABLE = [...USERS].sort((a, b) => a.cumul_rank - b.cumul_rank);

/* précision globale */
const predCount = {};
PRED.forEach(p => { predCount[p.username] = (predCount[p.username] || 0) + 1; });

/* ---------- couleurs joueurs ---------- */
const PALETTE = ["#4cc9f0","#f72585","#4895ef","#43aa8b","#f9844a","#90be6d","#b5179e",
  "#577590","#f3722c","#277da1","#9d4edd","#ff8fab","#06d6a0","#ef476f","#118ab2","#ffd166"];
const COLOR = {};
let ci = 0;
TABLE.forEach(u => { COLOR[u.username] = u.username === ME ? "#e9b949" : PALETTE[ci++ % PALETTE.length]; });

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

/* ===========================================================================
   HERO
   =========================================================================== */
function hero() {
  const leader = TABLE[0];
  const me = usersByName[ME];
  document.getElementById("eyebrow").textContent =
    `Mon Petit Prono · Coupe du Monde 2026 · Journée ${META.max_game_week}/9`;
  document.getElementById("heroSub").innerHTML =
    `${USERS.length} joueurs, ${META.n_matches_played} matchs, ${fmt(PRED.length)} pronos décortiqués. ` +
    `<b>${leader.username}</b> mène la danse${me ? `, <b>toi (${me.cumul_rank}<sup>e</sup>)</b> à ${fmt(leader.cumul_points - me.cumul_points)} pts du sommet` : ""}.`;

  const stats = [
    ["#" + (usersByName[ME]?.cumul_rank ?? "—"), "Ton rang"],
    [fmt(usersByName[ME]?.cumul_points ?? 0), "Tes points"],
    [usersByName[ME]?.cumul_exact ?? 0, "Tes scores exacts"],
    [META.max_game_week + "/9", "Journées jouées"],
    [USERS.length, "Joueurs"],
  ];
  document.getElementById("heroStats").innerHTML = stats.map(([n, l], i) =>
    `<div class="hstat"><div class="n" data-count="${(""+n).match(/^[#]?[\d ]+$/)?1:0}">${n}</div><div class="l">${l}</div></div>`
  ).join("");
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
      <div class="who ${me ? "me" : ""}">${u.username}</div>
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
    const w = Math.max(6, 100 * u.cumul_points / maxPts);
    const r1 = cumRank[u.username]?.[lastGw], r0 = cumRank[u.username]?.[prevGw];
    let mv = '<span class="mv flat">—</span>';
    if (r0 && r1) {
      const d = r0 - r1;
      mv = d > 0 ? `<span class="mv up">▲ ${d}</span>` : d < 0 ? `<span class="mv down">▼ ${-d}</span>` : '<span class="mv flat">=</span>';
    }
    return `<tr class="${me ? "me" : ""}">
      <td><span class="rk ${u.cumul_rank <= 3 ? "top" : ""}">${u.cumul_rank}</span></td>
      <td><div class="pname"><span class="dot" style="background:${COLOR[u.username]}"></span>
        <span class="nm ${me ? "me" : ""}">${u.username}</span></div></td>
      <td class="num"><div class="ptsbar"><i style="width:${w}%"></i><span>${fmt(u.cumul_points)}</span></div></td>
      <td class="num mono">${u.cumul_good}</td>
      <td class="num mono">${u.cumul_exact}</td>
      <td class="num">${mv}</td></tr>`;
  }).join("");
  document.getElementById("standingsTable").innerHTML = head + "<tbody>" + rows + "</tbody>";
}

/* ===========================================================================
   02 — BUMP CHART (évolution des rangs)
   =========================================================================== */
let bumpChart;
const hidden = new Set();
function buildBump() {
  const labels = GAME_WEEKS.map(g => "J" + g);
  const datasets = TABLE.map(u => {
    const me = u.username === ME;
    return {
      label: u.username,
      data: GAME_WEEKS.map(g => cumRank[u.username][g]),
      borderColor: COLOR[u.username],
      backgroundColor: COLOR[u.username],
      borderWidth: me ? 4 : 2,
      pointRadius: me ? 5 : 3.5,
      pointHoverRadius: 7,
      pointBackgroundColor: COLOR[u.username],
      pointBorderColor: "#0a0c10",
      pointBorderWidth: 2,
      tension: 0.34,
      hidden: hidden.has(u.username),
      order: me ? 0 : 1,
    };
  });
  bumpChart = new C(document.getElementById("bumpChart"), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      layout: { padding: { top: 8, right: 14, left: 4 } },
      scales: {
        y: {
          reverse: true, min: 1, max: PLAYERS.length,
          ticks: { stepSize: 1, color: "#5d636f", callback: v => v + (v === 1 ? "ᵉʳ" : "ᵉ") },
          grid: { color: GRID }, border: { display: false },
        },
        x: { ticks: { color: "#9aa0ad", font: { size: 13, weight: "700" } }, grid: { display: false }, border: { color: GRID } },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: items => "Journée " + items[0].label.slice(1),
            label: c => `  ${c.dataset.label} — ${c.parsed.y}ᵉ (${fmt(cumPts[c.dataset.label][GAME_WEEKS[c.dataIndex]])} pts)`,
          },
        },
      },
    },
  });

  // legend
  document.getElementById("bumpLegend").innerHTML = TABLE.map(u =>
    `<span class="lg ${u.username === ME ? "me" : ""} ${hidden.has(u.username) ? "off" : ""}" data-p="${u.username}">
      <span class="d" style="background:${COLOR[u.username]}"></span>${u.username}</span>`).join("");
}
function wireBumpLegend() {
  document.getElementById("bumpLegend").addEventListener("click", e => {
    const el = e.target.closest(".lg"); if (!el) return;
    const p = el.dataset.p;
    hidden.has(p) ? hidden.delete(p) : hidden.add(p);
    el.classList.toggle("off");
    const ds = bumpChart.data.datasets.find(d => d.label === p);
    ds.hidden = hidden.has(p);
    bumpChart.update();
  });
}

/* ===========================================================================
   03 — POINTS (cumulé / par journée)
   =========================================================================== */
let pointsChart, pointsMode = "cumul";
function buildPoints() {
  const labels = GAME_WEEKS.map(g => "J" + g);
  const datasets = TABLE.map(u => {
    const me = u.username === ME;
    const data = GAME_WEEKS.map(g => pointsMode === "cumul" ? cumPts[u.username][g] : gwPts(u.username, g));
    return {
      label: u.username, data,
      borderColor: COLOR[u.username], backgroundColor: COLOR[u.username] + "22",
      borderWidth: me ? 3.5 : 1.8, pointRadius: me ? 4 : 2.5, pointHoverRadius: 6,
      pointBackgroundColor: COLOR[u.username], pointBorderColor: "#0a0c10", pointBorderWidth: 1.5,
      tension: 0.3, fill: me ? "origin" : false, order: me ? 0 : 1,
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
        x: { ticks: { color: "#9aa0ad", font: { size: 13, weight: "700" } }, grid: { display: false }, border: { color: GRID } },
      },
      plugins: {
        tooltip: {
          itemSort: (a, b) => b.parsed.y - a.parsed.y,
          callbacks: { label: c => `  ${c.dataset.label}: ${fmt(c.parsed.y)} pts` },
        },
      },
    },
  });
  document.getElementById("pointsLegend").innerHTML = TABLE.map(u =>
    `<span class="lg ${u.username === ME ? "me" : ""} ${hidden.has(u.username) ? "off" : ""}" data-p="${u.username}">
      <span class="d" style="background:${COLOR[u.username]}"></span>${u.username}</span>`).join("");
}
function wirePoints() {
  document.getElementById("pointsLegend").addEventListener("click", e => {
    const el = e.target.closest(".lg"); if (!el) return;
    const p = el.dataset.p;
    hidden.has(p) ? hidden.delete(p) : hidden.add(p);
    el.classList.toggle("off");
    pointsChart.data.datasets.find(d => d.label === p).hidden = hidden.has(p);
    pointsChart.update();
    // garder le bump legend en phase
    const lg2 = document.querySelector(`#bumpLegend .lg[data-p="${CSS.escape(p)}"]`);
    if (lg2) { lg2.classList.toggle("off", hidden.has(p)); bumpChart.data.datasets.find(d=>d.label===p).hidden=hidden.has(p); bumpChart.update(); }
  });
  document.querySelectorAll("#ptsSeg button").forEach(b => b.addEventListener("click", () => {
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
      <div class="big" style="color:${COLOR[w.p]}">${w.p}</div>
      <div class="scoreline"><span class="sc">${fmt(w.pts)}</span> pts
        <span class="vs">·</span> ${w.g} bons · ${w.e} exacts</div>
      <div class="desc" style="margin-top:14px">Devance <b>${second.p}</b> de ${fmt(w.pts - second.pts)} pts${me ? " — et c'est toi 🔥" : ""}.</div>
    </div>`;
  }).join("");
}

/* ===========================================================================
   05 — PRÉCISION (scatter bons% vs exacts%)
   =========================================================================== */
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
  new C(document.getElementById("precChart"), {
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
        ctx.save(); ctx.font = "600 10px 'JetBrains Mono'"; ctx.textAlign = "center";
        meta.data.forEach((pt, i) => {
          const d = pts[i];
          ctx.fillStyle = d.name === ME ? "#f7da8c" : "rgba(236,231,216,.75)";
          ctx.fillText(d.name.length > 11 ? d.name.slice(0, 10) + "…" : d.name, pt.x, pt.y - d.r - 4);
        });
        // median guides
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
   06 — INSIGHTS
   =========================================================================== */
function teamLabel(p) { return `${p.home_team} ${p.home_score}-${p.away_score} ${p.away_team}`; }

function insights() {
  const cards = [];

  // a) Le plus gros coup (meilleur prono unique)
  const best = [...PRED].sort((a, b) => b.pts_total - a.pts_total)[0];
  cards.push({
    glyph: "💥", tag: "Le plus gros coup",
    big: `+${fmt(best.pts_total)}`,
    body: `<b>${best.username}</b> a misé <b>${best.pred_home}-${best.pred_away}</b> sur ${teamLabel(best)}.${best.is_exact ? " Score exact." : ""}`,
  });

  // b) Le devin (plus de scores exacts)
  const devin = [...TABLE].sort((a, b) => b.cumul_exact - a.cumul_exact)[0];
  cards.push({
    glyph: "🔮", tag: "Le devin",
    big: devin.username, color: COLOR[devin.username],
    body: `<b>${devin.cumul_exact} scores exacts</b> sur ${predCount[devin.username]} pronos. La boule de cristal.`,
  });

  // c) Le piège (match le moins bien deviné)
  const perMatch = {};
  PRED.forEach(p => {
    const m = (perMatch[p.match_id] ||= { good: 0, n: 0, ex: 0, label: teamLabel(p) });
    m.good += p.is_good; m.ex += p.is_exact; m.n++;
  });
  const trap = Object.values(perMatch).filter(m => m.n >= 5).sort((a, b) => a.good/a.n - b.good/b.n)[0];
  cards.push({
    glyph: "🪤", tag: "Le piège",
    big: `${Math.round(100*trap.good/trap.n)}%`,
    body: `Seuls <b>${trap.good}/${trap.n}</b> ont eu le bon résultat sur <b>${trap.label}</b>.`,
  });

  // d) Le carton plein (match le plus deviné en exact)
  const easy = Object.values(perMatch).sort((a, b) => b.ex/b.n - a.ex/a.n)[0];
  cards.push({
    glyph: "🎯", tag: "Le carton plein",
    big: `${easy.ex}/${easy.n}`,
    body: `ont trouvé le <b>score exact</b> de <b>${easy.label}</b>. Trop facile.`,
  });

  // e) Le plus optimiste (plus de buts pronostiqués en moyenne)
  const goals = {};
  PRED.forEach(p => { const g = goals[p.username] ||= { tot: 0, n: 0 }; g.tot += p.pred_home + p.pred_away; g.n++; });
  const opti = Object.entries(goals).map(([p, g]) => ({ p, avg: g.tot/g.n })).sort((a, b) => b.avg - a.avg)[0];
  const cauti = Object.entries(goals).map(([p, g]) => ({ p, avg: g.tot/g.n })).sort((a, b) => a.avg - b.avg)[0];
  cards.push({
    glyph: "⚽", tag: "L'attaquant",
    big: opti.p, color: COLOR[opti.p],
    body: `Pronostique <b>${fixed(opti.avg, 1)} buts/match</b> en moyenne. Le plus prudent : <b>${cauti.p}</b> (${fixed(cauti.avg, 1)}).`,
  });

  // f) Ta meilleure journée
  const myGw = GAME_WEEKS.map(g => ({ g, pts: gwPts(ME, g), rank: gwStat[ME]?.[g]?.rank })).sort((a, b) => b.pts - a.pts)[0];
  if (myGw) cards.push({
    glyph: "⭐", tag: "Ton pic de forme",
    big: `J${myGw.g}`, color: "#e9b949",
    body: `Ta meilleure journée : <b>${fmt(myGw.pts)} pts</b>${myGw.rank ? `, ${myGw.rank}<sup>e</sup> de la ligue ce jour-là` : ""}.`,
  });

  document.getElementById("insightCards").innerHTML = cards.map(c => `
    <div class="fcard">
      <span class="glyph">${c.glyph}</span>
      <span class="tag">${c.tag}</span>
      <div class="big" style="${c.color ? `color:${c.color}` : ""}">${c.big}</div>
      <div class="desc">${c.body}</div>
    </div>`).join("");
}

/* ===========================================================================
   07 — DUEL
   =========================================================================== */
function h2h() {
  const selA = document.getElementById("h2hA"), selB = document.getElementById("h2hB");
  const opts = TABLE.map(u => `<option value="${u.username}">${u.username}</option>`).join("");
  selA.innerHTML = opts; selB.innerHTML = opts;
  selA.value = ME; selB.value = TABLE[0].username === ME ? TABLE[1].username : TABLE[0].username;

  function predMap(name) {
    const m = {};
    PRED.filter(p => p.username === name).forEach(p => { m[p.match_id] = p; });
    return m;
  }
  function render() {
    const A = selA.value, B = selB.value;
    const ua = usersByName[A], ub = usersByName[B];
    const pa = predMap(A), pb = predMap(B);
    let jointMatches = 0, agree = 0, aBeatsB = 0, bBeatsA = 0;
    Object.keys(pa).forEach(mid => {
      if (!pb[mid]) return; jointMatches++;
      if (pa[mid].pred_home === pb[mid].pred_home && pa[mid].pred_away === pb[mid].pred_away) agree++;
      if (pa[mid].pts_total > pb[mid].pts_total) aBeatsB++;
      else if (pb[mid].pts_total > pa[mid].pts_total) bBeatsA++;
    });
    const gwWon = GAME_WEEKS.reduce((acc, g) => {
      const x = gwPts(A, g), y = gwPts(B, g);
      if (x > y) acc[0]++; else if (y > x) acc[1]++; return acc;
    }, [0, 0]);

    const row = (lbl, a, b, hi = "max") => {
      const na = +(""+a).replace(/[^\d.-]/g,""), nb = +(""+b).replace(/[^\d.-]/g,"");
      const aw = hi === "max" ? na > nb : na < nb, bw = hi === "max" ? nb > na : nb < na;
      return `<div class="h2h-row">
        <div class="a ${aw ? "win" : ""}">${a}</div>
        <div class="lbl">${lbl}</div>
        <div class="b ${bw ? "win" : ""}">${b}</div></div>`;
    };
    document.getElementById("h2hGrid").innerHTML =
      `<div class="h2h-row"><div class="a" style="color:${COLOR[A]};font-size:22px">${A}</div><div class="lbl">&nbsp;</div><div class="b" style="color:${COLOR[B]};font-size:22px">${B}</div></div>` +
      row("Rang", ua.cumul_rank, ub.cumul_rank, "min") +
      row("Points", fmt(ua.cumul_points), fmt(ub.cumul_points)) +
      row("Bons", ua.cumul_good, ub.cumul_good) +
      row("Exacts", ua.cumul_exact, ub.cumul_exact) +
      row("Journées gagnées", gwWon[0], gwWon[1]) +
      row("Pronos gagnants*", aBeatsB, bBeatsA) +
      `<div class="h2h-row"><div class="a"></div><div class="lbl" style="grid-column:1/-1;text-align:center;margin-top:6px">
        ${agree}/${jointMatches} pronos <b style="color:var(--ink)">identiques</b> · *match où l'un a fait mieux que l'autre</div><div class="b"></div></div>`;
  }
  selA.addEventListener("change", render); selB.addEventListener("change", render);
  render();
}

/* ===========================================================================
   reveal + count-up
   =========================================================================== */
function reveals() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
}

/* ---------- go ---------- */
hero();
standings();
if (C) { buildBump(); wireBumpLegend(); buildPoints(); wirePoints(); precision(); }
gwWinners();
insights();
h2h();
reveals();
// premières sections visibles direct
document.querySelectorAll(".reveal").forEach((el, i) => { if (i < 2) el.classList.add("in"); });

})();
