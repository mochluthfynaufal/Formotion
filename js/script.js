const $ = (s) => document.querySelector(s);
const W = 1300, H = 750, G = 25, HOLD = 1;
const COL = ['#E63946', '#2A9D8F', '#F4A261', '#457B9D', '#8338EC', '#FB5607', '#3A86FF', '#06D6A0'];
const uid = () => Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ini = (n) => n.trim().split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();

let projects = [];
let P;
let sel = new Set();
let fi = 0;
let t = null;
let playing = false;
let endT = null;
let speed = 1;
let loop = false;
let grid = true;
let snap = true;
let showPaths = true;
let vb;
let undo = [];
let redo = [];
let drag = null;
let dragIdx = null;
let lastTs = 0;

function mk(name) {
  const names = ['Objek 1', 'Objek 2', 'Objek 3', 'Objek 4'];
  const d = names.map((n, i) => ({
    id: uid(),
    name: n,
    ini: ini(n),
    color: COL[i],
    size: 24,
    tc: '#ffffff',
    vis: true,
    rot: 180
  }));
  const A = {};
  const B = {};
  const AR = {};
  const BR = {};
  d.forEach((x, i) => {
    A[x.id] = { x: 325 + i * 216, y: 600 };
    B[x.id] = [{ x: 650, y: 175 }, { x: 475, y: 375 }, { x: 825, y: 375 }, { x: 650, y: 575 }][i];
    AR[x.id] = 180;
    BR[x.id] = 180;
  });
  return {
    id: uid(),
    name,
    dancers: d,
    formations: [
      { id: uid(), name: 'Baris Awal', dur: 2, pos: A, ctrl: {}, rot: AR },
      { id: uid(), name: 'Wajik (Diamond)', dur: 3, pos: B, ctrl: {}, rot: BR }
    ]
  };
}

function load() {
  try {
    projects = JSON.parse(localStorage.getItem('dfp') || '[]');
  } catch (e) {
    projects = [];
  }
  if (!projects.length) projects = [mk('Koreografi Saya')];
  let c = null;
  try {
    c = localStorage.getItem('dfp_cur');
  } catch (e) { }
  P = projects.find((p) => p.id == c) || projects[0];
  resetView();
}

function save() {
  try {
    localStorage.setItem('dfp', JSON.stringify(projects));
    localStorage.setItem('dfp_cur', P.id);
  } catch (e) { }
  const sv = $('#sv');
  if (sv) sv.textContent = 'Tersimpan ✓';
}

function commit() {
  undo.push(JSON.stringify(P));
  if (undo.length > 100) undo.shift();
  redo = [];
}

function restore(s) {
  const i = projects.indexOf(P);
  P = JSON.parse(s);
  projects[i] = P;
  fi = Math.min(fi, P.formations.length - 1);
  sel = new Set([...sel].filter((id) => P.dancers.some((d) => d.id == id)));
  save();
  render();
}

function undoA() {
  if (!undo.length) return;
  redo.push(JSON.stringify(P));
  restore(undo.pop());
}

function redoA() {
  if (!redo.length) return;
  undo.push(JSON.stringify(P));
  restore(redo.pop());
}

const F = () => P.formations[fi];
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const arr = (i) => {
  let a = 0;
  for (let k = 1; k <= i; k++) a += P.formations[k].dur + HOLD;
  return a;
};
const total = () => arr(P.formations.length - 1) + HOLD;

function lerp(id, i, u) {
  const f = P.formations;
  const a = f[i - 1].pos[id];
  const b = f[i].pos[id];
  const c = f[i].ctrl[id];
  if (!c) return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  const v = 1 - u;
  return {
    x: v * v * a.x + 2 * v * u * c.x + u * u * b.x,
    y: v * v * a.y + 2 * v * u * c.y + u * u * b.y
  };
}

function posAt(id, tm) {
  const f = P.formations;
  for (let i = 1; i < f.length; i++) {
    const lp = arr(i - 1) + HOLD;
    if (tm < lp) return f[i - 1].pos[id];
    if (tm < arr(i)) return lerp(id, i, ease((tm - lp) / f[i].dur));
  }
  return f[f.length - 1].pos[id];
}

const cur = (id) => (t !== null ? posAt(id, t) : F().pos[id]);

function stageInner(exp) {
  let s = `<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs><rect width="${W}" height="${H}" rx="14" fill="#FFFFFF" stroke="#C8102E" stroke-width="2"/>`;
  if (grid) {
    let d = '';
    for (let x = G; x < W; x += G) d += `M${x} 0V${H}`;
    for (let y = G; y < H; y += G) d += `M0 ${y}H${W}`;
    s += `<path d="${d}" stroke="#EBEBEB" fill="none"/>`;
  }
  s += `<line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke="#C8102E" stroke-dasharray="8 6" stroke-width="1.5" opacity="0.45"/>`;
  s += `<text x="${W / 2}" y="-18" text-anchor="middle" font-size="14" font-weight="700" fill="#C8102E" letter-spacing="3" font-family="sans-serif">BELAKANG PANGGUNG</text><text x="${W / 2}" y="${H + 34}" text-anchor="middle" font-size="14" font-weight="700" fill="#C8102E" letter-spacing="3" font-family="sans-serif">▼ PENONTON ▼</text>`;
  const vis = P.dancers.filter((d) => d.vis && F().pos[d.id]);
  if (!exp && showPaths && t === null && fi > 0) {
    vis.forEach((d) => {
      const a = P.formations[fi - 1].pos[d.id];
      const b = F().pos[d.id];
      const c = F().ctrl[d.id];
      if (!a) return;
      s += `<circle cx="${a.x}" cy="${a.y}" r="${d.size}" fill="none" stroke="${d.color}" stroke-dasharray="4 4" opacity=".5"/><path d="M${a.x} ${a.y}${c ? `Q${c.x} ${c.y}` : 'L'} ${b.x} ${b.y}" fill="none" stroke="${d.color}" stroke-width="3" stroke-dasharray="9 6" opacity=".85" marker-end="url(#ar)"/>`;
      const h = c || { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      s += `<circle class="hd" data-h="${d.id}" cx="${h.x}" cy="${h.y}" r="9" fill="${c ? d.color : '#FFFFFF'}" stroke="${d.color}" stroke-width="3"/>`;
    });
  }
  vis.forEach((d) => {
    const p = cur(d.id);
    const r = +d.size;
    const isDragging = drag && drag.k === 'd' && sel.has(d.id);
    const rot = (F().rot && F().rot[d.id] != null) ? F().rot[d.id] : (d.rot ?? 180);

    // Target snap fiktif/panduan halus saat objek sedang ditarik
    let snapPreview = '';
    if (isDragging && snap && !exp) {
      const gx = Math.round(p.x / G) * G;
      const gy = Math.round(p.y / G) * G;
      snapPreview = `<circle cx="${gx}" cy="${gy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="1.8" stroke-dasharray="3 3" opacity="0.35" pointer-events="none"/>`;
    }

    // Efek visual 'terangkat' saat objek dipindahkan
    const liftShadow = isDragging && !exp ? `<circle cx="${p.x}" cy="${p.y + 4}" r="${r + 2}" fill="rgba(0,0,0,0.18)" opacity="0.5" pointer-events="none"/>` : '';

    // Arah hadap: panah segitiga kecil di tepi lingkaran
    const radA = (rot - 90) * Math.PI / 180;
    const tipDist = r + 13;
    const tx = p.x + Math.cos(radA) * tipDist;
    const ty = p.y + Math.sin(radA) * tipDist;
    // Segitiga di ujung: 3 titik (ujung, kiri-pangkal, kanan-pangkal)
    const perpR = (rot - 90 + 90) * Math.PI / 180;
    const baseHalf = 7;
    const baseDist = r + 3;
    const bx = p.x + Math.cos(radA) * baseDist;
    const by = p.y + Math.sin(radA) * baseDist;
    const lx = bx + Math.cos(perpR) * baseHalf;
    const ly = by + Math.sin(perpR) * baseHalf;
    const rx2 = bx - Math.cos(perpR) * baseHalf;
    const ry2 = by - Math.sin(perpR) * baseHalf;
    const arrowSvg = `<polygon points="${tx.toFixed(1)},${ty.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)} ${rx2.toFixed(1)},${ry2.toFixed(1)}" fill="${d.color}" stroke="#FFFFFF" stroke-width="2" pointer-events="none"/>`;

    const rEff = isDragging ? r + 1.5 : r;
    s += `${snapPreview}<g class="dn ${isDragging ? 'is-dragging' : ''}" data-d="${d.id}">${liftShadow}${sel.has(d.id) && !exp ? `<circle cx="${p.x}" cy="${p.y}" r="${rEff + 7}" fill="none" stroke="#C8102E" stroke-width="3" stroke-dasharray="5 4"/>` : ''}<circle cx="${p.x}" cy="${p.y}" r="${rEff}" fill="${d.color}" stroke="#FFFFFF" stroke-width="3"/><text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" font-size="${r * 0.75}" font-weight="700" fill="${d.tc}" font-family="sans-serif" pointer-events="none">${esc(d.ini)}</text>${arrowSvg}<text x="${p.x}" y="${p.y + rEff + 22}" text-anchor="middle" font-size="12" font-weight="500" fill="#444444" font-family="sans-serif" pointer-events="none">${esc(d.name)}</text></g>`;
  });
  return s;
}

function rStage() {
  const v = $('#svg');
  if (!v || !vb) return;
  v.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  v.innerHTML = stageInner(false);
  const bg = $('#bg');
  const bs = $('#bs');
  const bp = $('#bp');
  if (bg) bg.classList.toggle('on', grid);
  if (bs) bs.classList.toggle('on', snap);
  if (bp) bp.classList.toggle('on', showPaths);
}

function tog(k) {
  if (k === 'grid') grid = !grid;
  else if (k === 'snap') snap = !snap;
  else showPaths = !showPaths;
  rStage();
}

function rLeft() {
  $('#Lc').innerHTML = `<h3>Proyek</h3><select onchange="swProj(this.value)">${projects.map((p) => `<option value="${p.id}" ${p == P ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
<input type="text" style="margin-top:6px" value="${esc(P.name)}" oninput="P.name=this.value;save();document.querySelector('option[selected]').textContent=this.value">
<div class="row" style="margin-top:6px"><button onclick="newProj()">+ Baru</button><button onclick="delProj()">Hapus</button></div>
<h3>Objek (${P.dancers.length})</h3>${P.dancers.map((d) => `<div class="dr ${sel.has(d.id) ? 's' : ''}" onclick="pick('${d.id}',event)"><span class="dot" style="background:${d.color};color:${d.tc};opacity:${d.vis ? 1 : 0.35}">${esc(d.ini)}</span><span class="nm">${esc(d.name)}</span><button onclick="event.stopPropagation();tv('${d.id}')" title="Tampilkan / Sembunyikan">${d.vis ? '👁' : '🚫'}</button><button onclick="event.stopPropagation();dupD('${d.id}')" title="Duplikat">⧉</button><button onclick="event.stopPropagation();delD('${d.id}')" title="Hapus">✕</button></div>`).join('')}
<button class="pri" style="width:100%;margin-top:8px" onclick="addD()">+ Tambah Objek</button>`;
}

function rRight() {
  const f = F();
  const ds = P.dancers.filter((d) => sel.has(d.id));
  const d = ds.length === 1 ? ds[0] : null;
  let h = `<h3>Formasi</h3><label>Nama Formasi</label><input type="text" value="${esc(f.name)}" onfocus="commit()" oninput="F().name=this.value;chg();rTL()">`;
  if (fi > 0) {
    h += `<label>Durasi transisi menuju formasi ini: <b id="dv">${f.dur} dtk</b></label><input type="range" min=".5" max="10" step=".5" value="${f.dur}" onfocus="commit()" oninput="F().dur=+this.value;$('#dv').textContent=this.value+' dtk';chg();rTL()"><button style="width:100%;margin-top:6px" onclick="prevTrans()">▶ Pratinjau Transisi Ini</button>`;
  } else {
    h += `<p class="hint">Formasi pertama – posisi awal objek.</p>`;
  }

  const targetLabel = ds.length > 0 ? `${ds.length} objek terpilih` : 'Semua objek';
  h += `<h3>Template Bentuk (${targetLabel})</h3>
<div class="tpl-grid">
  <button class="tpl-btn" onclick="applyTemplate('circle')" title="Susun objek membentuk lingkaran / bulat">
    <img src="assets/circle.svg" alt="Bulat">
    <span>Bulat</span>
  </button>
  <button class="tpl-btn" onclick="applyTemplate('square')" title="Susun objek membentuk persegi">
    <img src="assets/square.svg" alt="Persegi">
    <span>Persegi</span>
  </button>
  <button class="tpl-btn" onclick="applyTemplate('rectangle')" title="Susun objek membentuk persegi panjang">
    <img src="assets/rectangle.svg" alt="Persegi Panjang">
    <span>Persegi Pjg</span>
  </button>
  <button class="tpl-btn" onclick="applyTemplate('triangle')" title="Susun objek membentuk segitiga">
    <img src="assets/triangle.svg" alt="Segitiga">
    <span>Segitiga</span>
  </button>
</div>`;

  if (d) {
    h += `<h3>Objek</h3><label>Nama Objek</label><input type="text" value="${esc(d.name)}" onfocus="commit()" oninput="if(d_.ini==ini(d_.name))d_.ini=ini(this.value);d_.name=this.value;chg();rStage();rLeft()"><label>Inisial</label><input type="text" maxlength="3" value="${esc(d.ini)}" onfocus="commit()" oninput="d_.ini=this.value;chg();rStage();rLeft()">
<div class="row"><div><label>Warna Objek</label><input type="color" value="${d.color}" onfocus="commit()" oninput="d_.color=this.value;chg();rStage();rLeft()"></div><div><label>Warna Teks</label><input type="color" value="${d.tc}" onfocus="commit()" oninput="d_.tc=this.value;chg();rStage();rLeft()"></div></div>
<label>Ukuran Objek: <b id="zv">${d.size}</b></label><input type="range" min="14" max="44" value="${d.size}" onfocus="commit()" oninput="d_.size=+this.value;$('#zv').textContent=this.value;chg();rStage()"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" ${d.vis ? 'checked' : ''} onchange="commit();d_.vis=this.checked;chg();render()">Tampak di panggung</label>`;
  }
  window.d_ = d;
  if (ds.length > 1) {
    h += `<h3>${ds.length} objek dipilih</h3><div class="row"><button onclick="aln('l')">⇤ Kiri</button><button onclick="aln('ch')">↔ Tengah</button><button onclick="aln('r')">⇥ Kanan</button></div><div class="row" style="margin-top:6px"><button onclick="aln('t')">⤒ Atas</button><button onclick="aln('cv')">↕ Tengah</button><button onclick="aln('b')">⤓ Bawah</button></div><div class="row" style="margin-top:6px"><button onclick="dist('x')">Ratakan ↔</button><button onclick="dist('y')">Ratakan ↕</button></div>`;
  }
  if (sel.size > 0) {
    const rotVal = curRot();
    const rV = Math.round(rotVal);
    const isActive = (a) => rV === a ? 'active' : '';
    h += `<h3>Arah Hadap</h3>
<div class='rot-compass'>
  <div class='rot-row'>
    <button class='rot-btn ${isActive(315)}' onclick='setRot(315)' title='Serong Kiri Atas (315°)'>↖</button>
    <button class='rot-btn ${isActive(0)}' onclick='setRot(0)' title='Atas (0°)'>↑</button>
    <button class='rot-btn ${isActive(45)}' onclick='setRot(45)' title='Serong Kanan Atas (45°)'>↗</button>
  </div>
  <div class='rot-row'>
    <button class='rot-btn ${isActive(270)}' onclick='setRot(270)' title='Kiri (270°)'>←</button>
    <div class='rot-center' title='Arah saat ini: ${rV}°'>${rV}°</div>
    <button class='rot-btn ${isActive(90)}' onclick='setRot(90)' title='Kanan (90°)'>→</button>
  </div>
  <div class='rot-row'>
    <button class='rot-btn ${isActive(225)}' onclick='setRot(225)' title='Serong Kiri Bawah (225°)'>↙</button>
    <button class='rot-btn ${isActive(180)}' onclick='setRot(180)' title='Bawah / Penonton (180°)'>↓</button>
    <button class='rot-btn ${isActive(135)}' onclick='setRot(135)' title='Serong Kanan Bawah (135°)'>↘</button>
  </div>
</div>
<label>Sudut Tepat: <b id='rv'>${rV}°</b></label>
<input type='range' min='0' max='359' value='${rV}' oninput='setRot(+this.value);document.getElementById(&quot;rv&quot;).textContent=this.value+&quot;°&quot;'>`;
  }
  h += `<h3>Jalur Pergerakan</h3>`;
  if (fi === 0) {
    h += `<p class="hint">Pilih formasi berikutnya untuk mengatur bagaimana objek bergerak menuju posisi tersebut.</p>`;
  } else if (!ds.length) {
    h += `<p class="hint">Pilih objek, lalu tentukan jalur. Anda juga bisa menggeser titik kontrol bundar pada jalur untuk membentuk rute kustom.</p>`;
  } else {
    h += `<div class="row"><button onclick="curve(0)">Lurus</button><button onclick="curve(1)">Lengkung ↰</button><button onclick="curve(-1)">Lengkung ↱</button></div><p class="hint">Berlaku untuk semua objek yang dipilih. Tarik titik pegangan di panggung untuk rute bebas.</p>`;
  }
  $('#R').innerHTML = h;
}

function rTL() {
  $('#tl').innerHTML =
    P.formations
      .map(
        (f, i) =>
          `<div class="fc ${i === fi ? 's' : ''}" draggable="true" ondragstart="dragIdx=${i}" ondragover="event.preventDefault()" ondrop="reorder(${i})" onclick="goF(${i})"><small>#${i + 1}</small><b>${esc(f.name)}</b><small>${i ? f.dur + ' dtk transisi' : 'awal'}</small><span class="bar" style="width:${Math.min(100, 20 + f.dur * 10)}%"></span></div>`
      )
      .join('') + `<button class="add" onclick="addF()" title="Tambah formasi (N)">＋</button>`;
}

function rCtl() {
  const T = total();
  $('#ctl').innerHTML = `<button onclick="step(-1)">⏮</button><button class="pri" onclick="play()" id="pp">${playing ? '⏸ Jeda' : '▶ Putar'}</button><button onclick="stop()">⏹ Berhenti</button><button onclick="restart()">↻ Mulai Ulang</button><button onclick="step(1)">⏭</button>
<input type="range" id="scr" min="0" max="${Math.round(T * 100)}" value="${Math.round((t ?? arr(fi)) * 100)}" oninput="scrub(this.value)"><span id="tt" style="min-width:80px;font-variant-numeric:tabular-nums">0.0 / ${T.toFixed(1)} dtk</span>
<select onchange="speed=+this.value">${[.5, 1, 1.5, 2].map((s) => `<option ${s == speed ? 'selected' : ''} value="${s}">${s}×</option>`).join('')}</select><label><input type="checkbox" ${loop ? 'checked' : ''} onchange="loop=this.checked">Ulangi</label>
<button onclick="addF()">+ Formasi</button><button onclick="dupF()">⧉ Duplikat</button><button onclick="delF()">Hapus</button>`;
  tick2();
}

function tick2() {
  const s = $('#scr');
  const tt = $('#tt');
  if (!s) return;
  const x = t ?? arr(fi);
  s.value = Math.round(x * 100);
  tt.textContent = x.toFixed(1) + ' / ' + total().toFixed(1) + ' dtk';
  $('#pp').textContent = playing ? '⏸ Jeda' : '▶ Putar';
}

function render() {
  rStage();
  rLeft();
  rRight();
  rTL();
  rCtl();
}

function chg() {
  save();
}

function idxAt(x) {
  let r = 0;
  for (let i = 0; i < P.formations.length; i++) {
    if (arr(i) <= x + 1e-6) r = i;
  }
  return r;
}

function loopF(ts) {
  if (!playing) return;
  const dt = Math.min(0.1, (ts - lastTs) / 1000);
  lastTs = ts;
  t += dt * speed;
  const lim = endT ?? total();
  if (t >= lim) {
    if (loop && endT === null) {
      t = 0;
    } else {
      t = endT !== null ? endT : lim;
      playing = false;
      if (endT !== null) {
        fi = idxAt(t);
        t = null;
      }
      endT = null;
      render();
      return;
    }
  }
  const n = idxAt(t);
  if (n !== fi) {
    fi = n;
    rTL();
    rRight();
  }
  rStage();
  tick2();
  requestAnimationFrame(loopF);
}

function play() {
  if (playing) {
    playing = false;
    rCtl();
    return;
  }
  if (t === null || t >= total() - 0.01) {
    t = endT === null && t === null ? (arr(fi) >= total() - HOLD - 0.01 ? 0 : arr(fi)) : 0;
  }
  playing = true;
  lastTs = performance.now();
  requestAnimationFrame(loopF);
  rCtl();
}

function stop() {
  playing = false;
  t = null;
  endT = null;
  render();
}

function restart() {
  t = 0;
  endT = null;
  fi = 0;
  playing = true;
  lastTs = performance.now();
  render();
  requestAnimationFrame(loopF);
}

function step(d) {
  playing = false;
  t = null;
  endT = null;
  fi = Math.max(0, Math.min(P.formations.length - 1, fi + d));
  render();
}

function scrub(v) {
  playing = false;
  endT = null;
  t = v / 100;
  const n = idxAt(t);
  if (n !== fi) {
    fi = n;
    rTL();
    rRight();
  }
  rStage();
  tick2();
}

function prevTrans() {
  if (fi < 1) return;
  const a = arr(fi - 1) + HOLD;
  t = a;
  endT = arr(fi);
  fi = fi - 1;
  playing = true;
  lastTs = performance.now();
  rCtl();
  requestAnimationFrame(loopF);
}

function goF(i) {
  playing = false;
  t = null;
  endT = null;
  fi = i;
  render();
}

function addF() {
  commit();
  const f = F();
  const n = {
    id: uid(),
    name: 'Formasi ' + (P.formations.length + 1),
    dur: 2,
    pos: JSON.parse(JSON.stringify(f.pos)),
    ctrl: {},
    rot: JSON.parse(JSON.stringify(f.rot || {}))
  };
  P.formations.splice(fi + 1, 0, n);
  fi++;
  t = null;
  save();
  render();
}

function dupF() {
  commit();
  const f = JSON.parse(JSON.stringify(F()));
  f.id = uid();
  f.name += ' (salinan)';
  f.ctrl = {};
  if (!f.rot) f.rot = {};
  P.formations.splice(fi + 1, 0, f);
  fi++;
  t = null;
  save();
  render();
}

function delF() {
  if (P.formations.length < 2) return;
  commit();
  P.formations.splice(fi, 1);
  fi = Math.min(fi, P.formations.length - 1);
  P.formations.forEach((f) => (f.ctrl = { ...f.ctrl }));
  save();
  render();
}

function reorder(to) {
  if (dragIdx === null || dragIdx == to) return;
  commit();
  const [m] = P.formations.splice(dragIdx, 1);
  P.formations.splice(to, 0, m);
  P.formations.forEach((f) => (f.ctrl = {}));
  fi = to;
  dragIdx = null;
  save();
  render();
}

function addD() {
  commit();
  const n = P.dancers.length;
  const d = {
    id: uid(),
    name: 'Objek ' + (n + 1),
    ini: 'O' + (n + 1),
    color: COL[n % COL.length],
    size: 24,
    tc: '#ffffff',
    vis: true,
    rot: 180
  };
  P.dancers.push(d);
  const p = { x: 120 + (n % 8) * 110, y: 120 + Math.floor(n / 8) * 110 };
  P.formations.forEach((f) => {
    f.pos[d.id] = { ...p };
    if (!f.rot) f.rot = {};
    f.rot[d.id] = 180;
  });
  sel = new Set([d.id]);
  save();
  render();
}

function dupD(id) {
  commit();
  const o = P.dancers.find((d) => d.id == id);
  const d = { ...o, id: uid(), name: o.name + ' (salinan)', rot: o.rot ?? 180 };
  d.ini = ini(d.name);
  P.dancers.push(d);
  P.formations.forEach((f) => {
    const p = f.pos[id];
    f.pos[d.id] = { x: p.x + 40, y: p.y + 40 };
    if (f.ctrl[id]) f.ctrl[d.id] = { x: f.ctrl[id].x + 40, y: f.ctrl[id].y + 40 };
    if (!f.rot) f.rot = {};
    f.rot[d.id] = (f.rot[id] ?? o.rot ?? 180);
  });
  sel = new Set([d.id]);
  save();
  render();
}

function delD(id) {
  commit();
  P.dancers = P.dancers.filter((d) => d.id != id);
  P.formations.forEach((f) => {
    delete f.pos[id];
    delete f.ctrl[id];
    if (f.rot) delete f.rot[id];
  });
  sel.delete(id);
  save();
  render();
}

function tv(id) {
  commit();
  const d = P.dancers.find((d) => d.id == id);
  d.vis = !d.vis;
  save();
  render();
}

function pick(id, e) {
  if (e.shiftKey) {
    sel.has(id) ? sel.delete(id) : sel.add(id);
  } else {
    sel = new Set([id]);
  }
  rStage();
  rLeft();
  rRight();
}

function sd() {
  return P.dancers.filter((d) => sel.has(d.id) && d.vis).map((d) => F().pos[d.id]);
}

function aln(m) {
  const a = sd();
  if (a.length < 2) return;
  commit();
  const xs = a.map((p) => p.x);
  const ys = a.map((p) => p.y);
  const mn = Math.min;
  const mx = Math.max;
  a.forEach((p) => {
    if (m === 'l') p.x = mn(...xs);
    if (m === 'r') p.x = mx(...xs);
    if (m === 'ch') p.x = (mn(...xs) + mx(...xs)) / 2;
    if (m === 't') p.y = mn(...ys);
    if (m === 'b') p.y = mx(...ys);
    if (m === 'cv') p.y = (mn(...ys) + mx(...ys)) / 2;
  });
  save();
  rStage();
}

function dist(k) {
  const a = sd().sort((p, q) => p[k] - q[k]);
  if (a.length < 3) return;
  commit();
  const s = a[0][k];
  const e = a[a.length - 1][k];
  a.forEach((p, i) => (p[k] = s + ((e - s) * i) / (a.length - 1)));
  save();
  rStage();
}


function setRot(angle) {
  const ds = P.dancers.filter((d) => sel.has(d.id));
  if (!ds.length) return;
  commit();
  if (!F().rot) F().rot = {};
  ds.forEach((d) => {
    F().rot[d.id] = angle;
    d.rot = angle;
  });
  chg();
  rStage();
  rRight();
}

function curRot() {
  const ds = P.dancers.filter((d) => sel.has(d.id));
  if (!ds.length) return 180;
  const d = ds[0];
  return (F().rot && F().rot[d.id] != null) ? F().rot[d.id] : (d.rot ?? 180);
}

function curve(dir) {
  if (fi < 1) return;
  commit();
  P.dancers
    .filter((d) => sel.has(d.id))
    .forEach((d) => {
      const a = P.formations[fi - 1].pos[d.id];
      const b = F().pos[d.id];
      if (!dir) {
        delete F().ctrl[d.id];
        return;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      const o = Math.max(80, L * 0.35) * dir;
      F().ctrl[d.id] = {
        x: (a.x + b.x) / 2 - (dy / L) * o,
        y: (a.y + b.y) / 2 + (dx / L) * o
      };
    });
  save();
  rStage();
}

function applyTemplate(type) {
  let list = P.dancers.filter((d) => sel.has(d.id) && d.vis);
  if (!list.length) {
    list = P.dancers.filter((d) => d.vis);
  }
  if (!list.length) return;

  commit();

  const N = list.length;
  let avgX = 0, avgY = 0;
  list.forEach((d) => {
    const p = F().pos[d.id] || { x: W / 2, y: H / 2 };
    avgX += p.x;
    avgY += p.y;
  });
  avgX /= N;
  avgY /= N;

  const isAll = list.length === P.dancers.filter((d) => d.vis).length;
  const cx = isAll ? W / 2 : Math.max(120, Math.min(W - 120, avgX));
  const cy = isAll ? H / 2 : Math.max(120, Math.min(H - 120, avgY));

  if (N === 1) {
    F().pos[list[0].id] = { x: sn(cx), y: sn(cy) };
    delete F().ctrl[list[0].id];
    save();
    rStage();
    return;
  }

  if (type === 'circle') {
    const R = Math.min(270, Math.max(90, N * 24));
    list.forEach((d, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / N;
      const x = cx + R * Math.cos(angle);
      const y = cy + R * Math.sin(angle);
      F().pos[d.id] = {
        x: sn(Math.max(40, Math.min(W - 40, x))),
        y: sn(Math.max(40, Math.min(H - 40, y)))
      };
      delete F().ctrl[d.id];
    });
  } else if (type === 'square' || type === 'rectangle') {
    // Susunan blok terisi penuh (solid grid, tidak ada ruang kosong di tengah)
    let rows;
    if (type === 'square') {
      if (N <= 1) rows = [1];
      else if (N === 2) rows = [2];
      else if (N === 3) rows = [3];
      else if (N === 4) rows = [2, 2];
      else if (N === 6) rows = [3, 3];
      else if (N === 8) rows = [4, 4];
      else if (N === 9) rows = [3, 3, 3];
      else if (N === 10) rows = [5, 5];
      else if (N === 12) rows = [4, 4, 4];
      else if (N === 16) rows = [4, 4, 4, 4];
      else if (N % 2 === 0) {
        let r = 2;
        if (N >= 12 && N % 3 === 0) r = 3;
        if (N >= 16 && N % 4 === 0) r = 4;
        rows = Array(r).fill(N / r);
      } else {
        if (N === 5) rows = [3, 2];
        else if (N === 7) rows = [4, 3];
        else if (N === 11) rows = [4, 3, 4];
        else if (N === 15) rows = [5, 5, 5];
        else {
          const r = Math.max(2, Math.round(Math.sqrt(N)));
          const base = Math.floor(N / r);
          const rem = N % r;
          rows = Array(r).fill(base);
          for (let i = 0; i < rem; i++) rows[i]++;
        }
      }
    } else {
      // Persegi Panjang: formasi baris melebar horizontal
      if (N <= 1) rows = [1];
      else if (N === 2) rows = [2];
      else if (N === 3) rows = [3];
      else if (N === 4) rows = [2, 2];
      else if (N === 6) rows = [3, 3];
      else if (N === 8) rows = [4, 4];
      else if (N === 10) rows = [5, 5];
      else if (N === 12) rows = [4, 4, 4];
      else if (N === 14) rows = [7, 7];
      else if (N === 16) rows = [4, 4, 4, 4];
      else if (N === 18) rows = [6, 6, 6];
      else if (N === 20) rows = [5, 5, 5, 5];
      else if (N % 2 === 0) {
        let r = 2;
        if (N >= 12 && N % 3 === 0) r = 3;
        if (N >= 16 && N % 4 === 0) r = 4;
        rows = Array(r).fill(N / r);
      } else {
        if (N === 5) rows = [3, 2];
        else if (N === 7) rows = [4, 3];
        else if (N === 9) rows = [3, 3, 3];
        else if (N === 11) rows = [4, 3, 4];
        else if (N === 13) rows = [4, 5, 4];
        else if (N === 15) rows = [5, 5, 5];
        else {
          const r = Math.max(2, Math.round(Math.sqrt(N) * 0.75));
          const base = Math.floor(N / r);
          const rem = N % r;
          rows = Array(r).fill(base);
          for (let i = 0; i < rem; i++) rows[i]++;
        }
      }
    }

    const R = rows.length;
    const maxCols = Math.max(...rows);

    let gapX, gapY;
    if (type === 'square') {
      const size = Math.min(420, Math.max(160, Math.max(maxCols, R) * 75));
      const g = Math.max(maxCols - 1, R - 1) > 0 ? size / Math.max(maxCols - 1, R - 1) : 0;
      gapX = g;
      gapY = g;
    } else {
      gapX = Math.max(120, Math.min(200, 880 / (maxCols + 1)));
      gapY = Math.max(95, Math.min(135, 450 / (R + 1)));
    }

    const coords = [];
    for (let r = 0; r < R; r++) {
      const count = rows[r];
      const y = R === 1 ? cy : cy - ((R - 1) * gapY) / 2 + r * gapY;
      const rowWidth = (count - 1) * gapX;
      for (let c = 0; c < count; c++) {
        const x = count === 1 ? cx : cx - rowWidth / 2 + c * gapX;
        coords.push({
          x: sn(Math.max(40, Math.min(W - 40, x))),
          y: sn(Math.max(40, Math.min(H - 40, y)))
        });
      }
    }

    list.forEach((d, i) => {
      if (coords[i]) {
        F().pos[d.id] = { ...coords[i] };
        delete F().ctrl[d.id];
      }
    });
  } else if (type === 'triangle') {
    // Formasi segitiga / piramida terisi penuh (solid wedge, rapi tanpa lubang kosong atau tumpukan)
    let rows;
    if (N <= 1) rows = [1];
    else if (N === 2) rows = [1, 1];
    else if (N === 3) rows = [1, 2];
    else if (N === 4) rows = [1, 3];
    else if (N === 5) rows = [1, 2, 2];
    else if (N === 6) rows = [1, 2, 3];
    else if (N === 7) rows = [1, 2, 4];
    else if (N === 8) rows = [1, 3, 4];
    else if (N === 9) rows = [1, 3, 5];
    else if (N === 10) rows = [1, 2, 3, 4];
    else if (N === 11) rows = [1, 2, 3, 5];
    else if (N === 12) rows = [1, 2, 4, 5];
    else if (N === 13) rows = [1, 3, 4, 5];
    else if (N === 14) rows = [1, 2, 3, 4, 4];
    else if (N === 15) rows = [1, 2, 3, 4, 5];
    else if (N === 16) rows = [1, 3, 5, 7];
    else {
      let R = 1;
      while (((R + 1) * (R + 2)) / 2 <= N) R++;
      rows = [];
      for (let i = 1; i <= R; i++) rows.push(i);
      let rem = N - (R * (R + 1)) / 2;
      let idx = rows.length - 1;
      while (rem > 0) {
        rows[idx]++;
        rem--;
        idx--;
        if (idx < 1) idx = rows.length - 1;
      }
    }

    const R = rows.length;
    const maxCols = Math.max(...rows);
    const W_base = Math.min(680, Math.max(280, maxCols * 110));
    const H_total = Math.min(440, Math.max(190, R * 90));

    const coords = [];
    for (let r = 0; r < R; r++) {
      const count = rows[r];
      const y = R === 1 ? cy : cy - H_total / 2 + r * (H_total / (R - 1));
      const W_r = R === 1 ? 0 : W_base * (r / (R - 1));
      for (let c = 0; c < count; c++) {
        const x = count === 1 ? cx : cx - W_r / 2 + c * (W_r / (count - 1));
        coords.push({
          x: sn(Math.max(40, Math.min(W - 40, x))),
          y: sn(Math.max(40, Math.min(H - 40, y)))
        });
      }
    }

    list.forEach((d, i) => {
      if (coords[i]) {
        F().pos[d.id] = { ...coords[i] };
        delete F().ctrl[d.id];
      }
    });
  }

  save();
  rStage();
}

function pt(e) {
  const v = $('#svg');
  const p = v.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  return p.matrixTransform(v.getScreenCTM().inverse());
}

const sn = (v) => (snap ? Math.round(v / G) * G : v);

$('#svg').addEventListener('pointerdown', (e) => {
  if (playing || t !== null) {
    playing = false;
    t = null;
    endT = null;
    rCtl();
  }
  const dn = e.target.closest('[data-d]');
  const hd = e.target.closest('[data-h]');
  const p = pt(e);
  e.currentTarget.setPointerCapture(e.pointerId);
  if (hd) {
    drag = { k: 'h', id: hd.dataset.h, done: false };
  } else if (dn) {
    const id = dn.dataset.d;
    if (e.shiftKey) {
      sel.has(id) ? sel.delete(id) : sel.add(id);
    } else if (!sel.has(id)) {
      sel = new Set([id]);
    }
    drag = { k: 'd', p, done: false, st: [...sel].map((i) => [i, { ...F().pos[i] }]) };
    document.body.classList.add('dragging-obj');
    rLeft();
    rRight();
  } else {
    if (!e.shiftKey) {
      sel = new Set();
      rLeft();
      rRight();
    }
    drag = { k: 'pan', x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y };
  }
  rStage();
});

$('#svg').addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (drag.k === 'pan') {
    const r = $('#svg').getBoundingClientRect();
    const s = Math.max(vb.w / r.width, vb.h / r.height);
    vb.x = drag.vx - (e.clientX - drag.x) * s;
    vb.y = drag.vy - (e.clientY - drag.y) * s;
    rStage();
    return;
  }
  const p = pt(e);
  if (!drag.done) {
    commit();
    drag.done = true;
  }
  if (drag.k === 'h') {
    F().ctrl[drag.id] = { x: sn(p.x), y: sn(p.y) };
  } else {
    // Pergerakan lancar & halus 1:1 mengikuti kursor tanpa melompat kaku per 25px
    drag.st.forEach(([id, o]) => {
      F().pos[id] = {
        x: Math.max(-40, Math.min(W + 40, o.x + (p.x - drag.p.x))),
        y: Math.max(-40, Math.min(H + 40, o.y + (p.y - drag.p.y)))
      };
    });
  }
  rStage();
});

const endDrag = () => {
  if (drag) {
    // Saat dilepas, jika snap aktif maka objek otomatis menempel rapi ke kisi grid terdekat
    if (drag.k === 'd' && snap) {
      drag.st.forEach(([id]) => {
        if (F().pos[id]) {
          F().pos[id].x = Math.max(-40, Math.min(W + 40, Math.round(F().pos[id].x / G) * G));
          F().pos[id].y = Math.max(-40, Math.min(H + 40, Math.round(F().pos[id].y / G) * G));
        }
      });
    }
    if (drag.done) save();
  }
  document.body.classList.remove('dragging-obj');
  drag = null;
  rStage();
};
$('#svg').addEventListener('pointerup', endDrag);
$('#svg').addEventListener('pointercancel', endDrag);

$('#svg').addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const f = e.deltaY > 0 ? 1.1 : 0.9;
    const p = pt(e);
    zoomAt(f, p);
  },
  { passive: false }
);

function zoomAt(f, p) {
  const w = vb.w * f;
  if (w < 250 || w > 4000) return;
  vb.x = p.x - (p.x - vb.x) * f;
  vb.y = p.y - (p.y - vb.y) * f;
  vb.w *= f;
  vb.h *= f;
  rStage();
}

function zoom(f) {
  zoomAt(f, { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 });
}

function resetView() {
  vb = { x: -45, y: -45, w: 1390, h: 840 };
  if ($('#svg') && $('#svg').getBoundingClientRect().width) rStage();
}

function swProj(id) {
  P = projects.find((p) => p.id == id);
  fi = 0;
  t = null;
  playing = false;
  sel = new Set();
  undo = [];
  redo = [];
  save();
  resetView();
  render();
}

function newProj() {
  const p = mk('Proyek ' + (projects.length + 1));
  projects.push(p);
  swProj(p.id);
}

function delProj() {
  if (projects.length < 2) return;
  projects = projects.filter((p) => p != P);
  swProj(projects[0].id);
}

function dl(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function expJSON() {
  dl(new Blob([JSON.stringify(P, null, 2)], { type: 'application/json' }), (P.name || 'koreografi') + '.json');
}

const impInput = $('#imp');
if (impInput) {
  impInput.onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((x) => {
      try {
        const p = JSON.parse(x);
        if (!p.dancers || !p.formations) throw 0;
        p.id = uid();
        projects.push(p);
        swProj(p.id);
      } catch (_) {
        alert('File tersebut bukan proyek yang valid.');
      }
    });
    e.target.value = '';
  };
}

function expPNG() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-45 -45 1390 840" width="2780" height="1680"><rect x="-45" y="-45" width="1390" height="840" fill="#fff"/>${stageInner(true).replace(/ class="[^"]*"/g, '')}</svg>`;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = 2780;
    c.height = 1680;
    c.getContext('2d').drawImage(img, 0, 0);
    c.toBlob((b) => dl(b, (F().name || 'formasi') + '.png'));
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

addEventListener('keydown', (e) => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type != 'range' && e.target.type != 'checkbox') return;
  const k = e.key;
  const c = e.ctrlKey || e.metaKey;
  if (c && k === 'z') {
    e.preventDefault();
    e.shiftKey ? redoA() : undoA();
  } else if (c && k === 'y') {
    e.preventDefault();
    redoA();
  } else if (c && k === 'a') {
    e.preventDefault();
    sel = new Set(P.dancers.map((d) => d.id));
    render();
  } else if (c && k === 'd') {
    e.preventDefault();
    dupF();
  } else if (k === ' ') {
    e.preventDefault();
    play();
  } else if (k === 'Delete' || k === 'Backspace') {
    if (sel.size) {
      commit();
      [...sel].forEach((id) => {
        P.dancers = P.dancers.filter((d) => d.id != id);
        P.formations.forEach((f) => {
          delete f.pos[id];
          delete f.ctrl[id];
        });
      });
      sel = new Set();
      save();
      render();
    }
  } else if (k === 'n') {
    addF();
  } else if (k === '[') {
    step(-1);
  } else if (k === ']') {
    step(1);
  } else if (k === 'g') {
    grid = !grid;
    rStage();
  } else if (k.startsWith('Arrow') && sel.size) {
    e.preventDefault();
    commit();
    const s = snap ? G : 5;
    const dx = k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0;
    const dy = k === 'ArrowUp' ? -s : k === 'ArrowDown' ? s : 0;
    sel.forEach((id) => {
      const p = F().pos[id];
      p.x += dx;
      p.y += dy;
    });
    save();
    rStage();
  }
});

addEventListener('resize', () => rStage());

load();
render();

