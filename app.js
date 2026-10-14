/* Diário de Bordo — o caderno do seu carro. Open source (MIT). Sem backend: tudo fica no navegador. */
(() => {
  'use strict';

  const KEY = 'diario-de-bordo.v1';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const num = x => { const n = parseFloat(String(x ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const int = n => Math.round(n).toLocaleString('pt-BR');
  const fmtKm = n => (n == null ? '—' : int(n) + ' km');
  const fmtMoney = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = d => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—');
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  /* Itens sugeridos ao cadastrar um veículo (km e meses são intervalos; null = não se aplica) */
  const TEMPLATE = [
    { name: 'Troca de óleo + filtro', icon: '🛢️', km: 10000, months: 12 },
    { name: 'Filtro de ar', icon: '💨', km: 15000, months: 12 },
    { name: 'Filtro de combustível', icon: '⛽', km: 20000, months: 24 },
    { name: 'Filtro do ar-condicionado', icon: '❄️', km: 15000, months: 12 },
    { name: 'Pastilhas de freio', icon: '🛑', km: 30000, months: null },
    { name: 'Fluido de freio', icon: '💧', km: null, months: 24 },
    { name: 'Velas de ignição', icon: '⚡', km: 40000, months: null },
    { name: 'Correia dentada', icon: '⚙️', km: 60000, months: 48 },
    { name: 'Rodízio e alinhamento', icon: '🛞', km: 10000, months: null },
    { name: 'Pneus', icon: '⭕', km: 50000, months: null },
    { name: 'Bateria', icon: '🔋', km: null, months: 36 },
    { name: 'Revisão geral', icon: '🔧', km: 10000, months: 12 },
  ];

  /* ---------- estado ---------- */
  let state = load();
  const ui = { tab: 'painel' };

  function load() {
    try {
      const r = JSON.parse(localStorage.getItem(KEY));
      if (r && Array.isArray(r.vehicles)) return r;
    } catch { /* sem storage ou JSON inválido */ }
    return { vehicles: [], current: null };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { toast('Não deu pra salvar neste navegador'); }
  }
  const vehicle = () => state.vehicles.find(v => v.id === state.current) || state.vehicles[0] || null;

  /* ---------- regras de negócio ---------- */
  function recompute(v) {
    // última vez de cada item vem sempre do histórico: apagar um registro "desfaz" o efeito
    for (const it of v.items) {
      const done = v.logs.filter(l => l.type === 'service' && l.itemId === it.id)
        .sort((a, b) => (b.date + String(b.km ?? '').padStart(9, '0')).localeCompare(a.date + String(a.km ?? '').padStart(9, '0')));
      it.lastDate = done[0]?.date ?? null;
      it.lastKm = done[0]?.km ?? null;
    }
    const maxKm = Math.max(0, ...v.logs.map(l => l.km ?? 0));
    if (maxKm > v.odometer) v.odometer = maxKm;
  }

  function itemStatus(v, it) {
    const parts = [];
    let pct = null;
    if (it.km && it.lastKm != null) {
      const left = it.lastKm + it.km - v.odometer;
      pct = Math.max(pct ?? 0, (v.odometer - it.lastKm) / it.km);
      parts.push(left >= 0 ? `faltam ${int(left)} km` : `passou ${int(-left)} km`);
    }
    if (it.months && it.lastDate) {
      const due = new Date(it.lastDate + 'T12:00:00');
      due.setMonth(due.getMonth() + it.months);
      const days = Math.round((due - new Date()) / 864e5);
      const total = it.months * 30.4375;
      pct = Math.max(pct ?? 0, (total - days) / total);
      parts.push(days >= 0 ? `faltam ${days} dias` : `atrasado ${-days} dias`);
    }
    if (pct == null) return { key: 'none', label: 'Sem registro', pct: 0, text: 'Registre a última vez que foi feito' };
    const key = pct >= 1 ? 'over' : pct >= 0.85 ? 'soon' : 'ok';
    return { key, label: { over: 'Atrasado', soon: 'Em breve', ok: 'Em dia' }[key], pct: Math.min(1, Math.max(0, pct)), text: parts.join(' · ') };
  }

  function fuelStats(v) {
    const f = v.logs.filter(l => l.type === 'fuel' && l.liters > 0 && l.km != null).sort((a, b) => a.km - b.km);
    const fulls = f.filter(l => l.full);
    const between = (a, b) => f.slice(f.indexOf(a) + 1, f.indexOf(b) + 1).reduce((s, l) => s + l.liters, 0);
    let avg = null, last = null;
    if (fulls.length >= 2) {
      const first = fulls[0], end = fulls[fulls.length - 1], prev = fulls[fulls.length - 2];
      avg = (end.km - first.km) / between(first, end);
      last = (end.km - prev.km) / between(prev, end);
    }
    const cost = f.reduce((s, l) => s + (l.cost || 0), 0);
    const span = f.length >= 2 ? f[f.length - 1].km - f[0].km : 0;
    return { avg, last, cost, count: f.length, perKm: span > 0 ? cost / span : null };
  }

  /* ---------- UI helpers ---------- */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  const field = (name, label, { type = 'text', value = '', ...attrs } = {}) =>
    `<label class="fld"><span>${esc(label)}</span><input name="${name}" type="${type}" value="${esc(value)}" ${Object.entries(attrs).map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`)).join(' ')}></label>`;
  const area = (name, label, value = '') => `<label class="fld"><span>${esc(label)}</span><textarea name="${name}">${esc(value)}</textarea></label>`;
  const check = (name, label, checked) => `<label class="chk"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}> ${esc(label)}</label>`;

  function openModal(title, body, onSubmit, submitLabel = 'Salvar') {
    const dlg = $('#dlg');
    dlg.innerHTML = `<form class="card" method="dialog"><h2>${esc(title)}</h2>${body}
      <div class="row end"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary">${esc(submitLabel)}</button></div></form>`;
    const form = $('form', dlg);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd);
      form.querySelectorAll('input[type=checkbox]').forEach(c => { data[c.name] = c.checked; });
      if (onSubmit(data) !== false) dlg.close();
    });
    dlg.showModal();
  }

  /* ---------- renderização ---------- */
  function render() {
    const v = vehicle();
    const app = $('#app');
    const tabs = $('#tabs');
    if (!v) {
      tabs.innerHTML = '';
      app.innerHTML = `${topbar(null)}
        <section class="hello"><h1>O <em>caderno</em> do seu carro</h1>
        <p>Troca de óleo, revisões, peças e abastecimentos num lugar só. Grátis, open source e os dados ficam no seu aparelho.</p></section>
        <div class="card"><h2>Cadastre seu primeiro carro</h2><p class="muted" style="margin-bottom:10px">Leva 20 segundos.</p>
        <button class="btn primary block" data-a="vehicle-new">🚗 Adicionar veículo</button></div>
        <div class="row end"><button class="btn ghost small" data-a="import">Já tenho um backup</button></div>`;
      return;
    }
    tabs.innerHTML = [['painel', '🛠️', 'Painel'], ['historico', '📋', 'Histórico'], ['combustivel', '⛽', 'Combustível'], ['ajustes', '⚙️', 'Ajustes']]
      .map(([k, i, l]) => `<button data-a="tab" data-tab="${k}" ${ui.tab === k ? 'aria-current="page"' : ''}><span>${i}</span>${l}</button>`).join('');
    app.innerHTML = topbar(v) + ({ painel, historico, combustivel, ajustes }[ui.tab] || painel)(v);
  }

  function topbar(v) {
    const sel = v ? `<div class="vsel"><select data-a="vehicle-switch" aria-label="Veículo">${state.vehicles.map(x => `<option value="${x.id}" ${x.id === v.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <button class="btn small" data-a="vehicle-new" aria-label="Adicionar veículo">＋</button></div>` : '';
    return `<header class="top"><div class="brand">📒 Diário de Bordo</div>${sel}</header>`;
  }

  function painel(v) {
    const rows = v.items.map(it => ({ it, st: itemStatus(v, it) }));
    const order = { over: 0, soon: 1, none: 2, ok: 3 };
    rows.sort((a, b) => order[a.st.key] - order[b.st.key] || b.st.pct - a.st.pct);
    const c = k => rows.filter(r => r.st.key === k).length;
    const list = rows.map(({ it, st }) => `
      <article class="card item">
        <div class="ico">${esc(it.icon || '🔧')}</div>
        <div><div class="t">${esc(it.name)}</div>
          <div class="d">${it.lastKm != null ? 'Último: ' + fmtKm(it.lastKm) : ''}${it.lastDate ? ' · ' + fmtDate(it.lastDate) : ''}${it.lastDate || it.lastKm != null ? '<br>' : ''}${esc(st.text)}</div></div>
        <span class="badge ${st.key}">${st.label}</span>
        ${st.key !== 'none' ? `<div class="bar" aria-hidden="true"><i style="width:${Math.round(st.pct * 100)}%"></i></div>` : ''}
        <div class="actions">
          <button class="btn small" data-a="item-edit" data-id="${it.id}">Editar</button>
          <button class="btn small primary" data-a="service" data-id="${it.id}">✓ Registrar feito</button>
        </div>
      </article>`).join('');
    return `
      <section class="card vehicle"><div><div class="name">${esc(v.name)} ${v.plate ? `<span class="plate">${esc(v.plate)}</span>` : ''}</div>
        <div class="km">${fmtKm(v.odometer)}</div></div>
        <button class="btn primary" data-a="odo">Atualizar km</button></section>
      <div class="summary">
        <span class="chip red">${c('over')} atrasado${c('over') === 1 ? '' : 's'}</span>
        <span class="chip yellow">${c('soon')} em breve</span>
        <span class="chip green">${c('ok')} em dia</span></div>
      <div class="list">${list || '<div class="card empty">Nenhum item ainda. Adicione o primeiro!</div>'}</div>
      <div class="row wrap"><button class="btn block" data-a="item-new">＋ Novo item de manutenção</button></div>`;
  }

  const logCard = l => `
    <article class="card log">
      <div class="t">${esc(l.type === 'fuel' ? '⛽ Abastecimento' : l.title)}</div><div class="v">${l.cost ? fmtMoney(l.cost) : ''}</div>
      <div class="m">${fmtDate(l.date)} · ${fmtKm(l.km)}${l.shop ? ' · ' + esc(l.shop) : ''}${l.type === 'fuel' ? ` · ${int(l.liters * 100) / 100} L${l.full ? ' (tanque cheio)' : ''}` : ''}</div><div></div>
      ${l.notes ? `<div class="n">${esc(l.notes)}</div>` : ''}
      <div class="x"><button class="btn small" data-a="log-del" data-id="${l.id}">Apagar</button></div>
    </article>`;
  const sortedLogs = (v, type) => v.logs.filter(l => !type || l.type === type)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.km ?? 0) - (a.km ?? 0));

  function historico(v) {
    const logs = sortedLogs(v, 'service');
    return `
      <div class="row wrap"><button class="btn primary" data-a="log-new">＋ Serviço avulso</button>
      <button class="btn red" data-a="report">📄 Gerar histórico pra revenda</button></div>
      <div class="list">${logs.map(logCard).join('') || '<div class="card empty">Nada registrado ainda. Use “Registrar feito” no Painel ou adicione um serviço avulso.</div>'}</div>`;
  }

  function combustivel(v) {
    const s = fuelStats(v);
    const logs = sortedLogs(v, 'fuel');
    const km = x => (x == null ? '—' : x.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km/l');
    return `
      <button class="btn primary block" data-a="fuel-new">⛽ Registrar abastecimento</button>
      <div class="card"><div class="stats">
        <div class="stat"><b>${km(s.avg)}</b><span>Média geral</span></div>
        <div class="stat"><b>${km(s.last)}</b><span>Último trecho</span></div>
        <div class="stat"><b>${fmtMoney(s.cost)}</b><span>Gasto total</span></div>
        <div class="stat"><b>${s.perKm == null ? '—' : fmtMoney(s.perKm)}</b><span>Custo por km</span></div></div>
        <p class="muted" style="margin-top:8px">A média usa abastecimentos com “tanque cheio”. Precisa de pelo menos dois.</p></div>
      <div class="list">${logs.map(logCard).join('') || '<div class="card empty">Nenhum abastecimento registrado.</div>'}</div>`;
  }

  function ajustes(v) {
    return `
      <div class="card"><h2>Veículo</h2><div class="row wrap">
        <button class="btn" data-a="vehicle-edit">Editar ${esc(v.name)}</button>
        <button class="btn" data-a="vehicle-del">Remover</button></div></div>
      <div class="card"><h2>Seus dados</h2>
        <p class="muted" style="margin-bottom:10px">Tudo fica salvo só neste navegador, nada vai para servidor nenhum. Faça backup de vez em quando, principalmente antes de trocar de celular.</p>
        <div class="row wrap"><button class="btn primary" data-a="export">⬇ Exportar backup</button><button class="btn" data-a="import">⬆ Importar backup</button></div></div>
      <div class="card"><h2>Sobre</h2>
        <p class="muted">O Diário de Bordo é open source (licença MIT). Contribuições e ideias são bem-vindas no repositório do projeto no GitHub. Dica: no celular, use “Adicionar à tela inicial” para instalar como app.</p></div>`;
  }

  /* ---------- formulários ---------- */
  function vehicleForm(v) {
    openModal(v ? 'Editar veículo' : 'Novo veículo',
      `${field('name', 'Apelido / modelo', { value: v?.name, required: true, placeholder: 'Ex.: Onix 2019' })}
       <div class="two">${field('plate', 'Placa', { value: v?.plate, placeholder: 'ABC1D23', maxlength: 8 })}
       ${field('odometer', 'Km atual', { type: 'number', value: v?.odometer ?? '', required: true, min: 0, step: 'any', inputmode: 'decimal' })}</div>
       ${v ? '' : check('template', 'Começar com itens sugeridos (óleo, filtros, freios…)', true)}`,
      d => {
        if (v) { v.name = d.name.trim(); v.plate = d.plate.trim().toUpperCase(); v.odometer = num(d.odometer) ?? v.odometer; }
        else {
          const nv = { id: uid(), name: d.name.trim(), plate: d.plate.trim().toUpperCase(), odometer: num(d.odometer) ?? 0, items: [], logs: [] };
          if (d.template) nv.items = TEMPLATE.map(t => ({ id: uid(), ...t, lastKm: null, lastDate: null }));
          state.vehicles.push(nv);
          state.current = nv.id;
        }
        save(); render();
      });
  }

  function itemForm(it) {
    const v = vehicle();
    openModal(it ? 'Editar item' : 'Novo item',
      `<div class="two">${field('icon', 'Emoji', { value: it?.icon ?? '🔧', maxlength: 4 })}${field('name', 'Nome', { value: it?.name, required: true })}</div>
       <div class="two">${field('km', 'Repetir a cada (km)', { type: 'number', value: it?.km ?? '', min: 0, placeholder: 'Ex.: 10000' })}
       ${field('months', 'Ou a cada (meses)', { type: 'number', value: it?.months ?? '', min: 0, placeholder: 'Ex.: 12' })}</div>
       <p class="muted">Preencha km, meses ou os dois: vale o que vencer primeiro.</p>
       ${it ? '<button type="button" class="btn small" data-a="item-del" data-id="' + it.id + '">Apagar este item</button>' : ''}`,
      d => {
        const km = num(d.km) || null, months = num(d.months) || null;
        if (!km && !months) { toast('Informe km, meses ou os dois'); return false; }
        const base = { name: d.name.trim(), icon: d.icon.trim() || '🔧', km, months };
        if (it) Object.assign(it, base);
        else v.items.push({ id: uid(), ...base, lastKm: null, lastDate: null });
        save(); render();
      });
  }

  function serviceForm(itemId) {
    const v = vehicle();
    const it = v.items.find(i => i.id === itemId);
    openModal(`Registrar: ${it.name}`, serviceFields({ date: today(), km: v.odometer }), d => addService(v, d, it));
  }
  const serviceFields = (x = {}) => `
    <div class="two">${field('date', 'Data', { type: 'date', value: x.date, required: true, max: today() })}
    ${field('km', 'Km no momento', { type: 'number', value: x.km ?? '', required: true, min: 0, step: 'any', inputmode: 'decimal' })}</div>
    <div class="two">${field('cost', 'Valor (R$)', { type: 'number', value: x.cost ?? '', min: 0, step: '0.01', inputmode: 'decimal' })}
    ${field('shop', 'Oficina / local', { value: x.shop })}</div>${area('notes', 'Observações (marca da peça, nº da nota…)', x.notes)}`;

  function addService(v, d, it) {
    const title = it ? it.name : (d.title || '').trim();
    if (!title) { toast('Dê um nome ao serviço'); return false; }
    v.logs.push({ id: uid(), type: 'service', itemId: it?.id ?? (d.itemId || null), title, date: d.date, km: num(d.km), cost: num(d.cost), shop: (d.shop || '').trim(), notes: (d.notes || '').trim() });
    recompute(v); save(); render(); toast('Registrado ✓');
  }

  function logForm() {
    const v = vehicle();
    openModal('Serviço avulso',
      `${field('title', 'O que foi feito?', { required: true, placeholder: 'Ex.: Barulho na roda dianteira' })}
       <label class="fld"><span>Vincular a um item (opcional)</span><select name="itemId"><option value="">— nenhum —</option>${v.items.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select></label>
       ${serviceFields({ date: today(), km: v.odometer })}`,
      d => {
        const it = v.items.find(i => i.id === d.itemId);
        return addService(v, { ...d, title: d.title || it?.name }, it);
      });
  }

  function fuelForm() {
    const v = vehicle();
    openModal('Abastecimento',
      `<div class="two">${field('date', 'Data', { type: 'date', value: today(), required: true, max: today() })}
       ${field('km', 'Km no painel', { type: 'number', value: v.odometer, required: true, min: 0, step: 'any', inputmode: 'decimal' })}</div>
       <div class="two">${field('liters', 'Litros', { type: 'number', required: true, min: 0, step: '0.01', inputmode: 'decimal' })}
       ${field('cost', 'Total pago (R$)', { type: 'number', min: 0, step: '0.01', inputmode: 'decimal' })}</div>
       ${check('full', 'Completei o tanque', true)}`,
      d => {
        const liters = num(d.liters);
        if (!liters || liters <= 0) { toast('Informe os litros'); return false; }
        v.logs.push({ id: uid(), type: 'fuel', date: d.date, km: num(d.km), liters, cost: num(d.cost), full: d.full, title: 'Abastecimento' });
        recompute(v); save(); render(); toast('Abastecimento salvo ⛽');
      });
  }

  /* ---------- relatório de revenda ---------- */
  function report(v) {
    const logs = v.logs.filter(l => l.type === 'service').sort((a, b) => a.date.localeCompare(b.date));
    const total = logs.reduce((s, l) => s + (l.cost || 0), 0);
    const s = fuelStats(v);
    $('#report').innerHTML = `
      <h1>Histórico de manutenção — ${esc(v.name)}${v.plate ? ' (' + esc(v.plate) + ')' : ''}</h1>
      <div class="sub">Quilometragem atual: ${fmtKm(v.odometer)} · Gerado em ${fmtDate(today())} pelo Diário de Bordo</div>
      <table><thead><tr><th>Data</th><th>Km</th><th>Serviço</th><th>Local</th><th>Valor</th></tr></thead><tbody>
      ${logs.map(l => `<tr><td>${fmtDate(l.date)}</td><td>${fmtKm(l.km)}</td><td>${esc(l.title)}${l.notes ? '<br><small>' + esc(l.notes) + '</small>' : ''}</td><td>${esc(l.shop)}</td><td>${l.cost ? fmtMoney(l.cost) : '—'}</td></tr>`).join('') || '<tr><td colspan="5">Sem registros.</td></tr>'}
      </tbody></table>
      <div class="tot">${logs.length} serviço(s) registrado(s) · Total investido em manutenção: ${fmtMoney(total)}${s.avg ? ` · Consumo médio: ${s.avg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km/l` : ''}</div>
      <div class="foot">Registros feitos pelo próprio dono do veículo. Guarde as notas fiscais para comprovação.</div>`;
    document.body.classList.add('printing');
    window.print();
  }
  window.addEventListener('afterprint', () => document.body.classList.remove('printing'));

  /* ---------- backup ---------- */
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `diario-de-bordo-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importData() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      try {
        const data = JSON.parse(await inp.files[0].text());
        if (!data || !Array.isArray(data.vehicles)) throw new Error('formato');
        if (state.vehicles.length && !confirm('Isso substitui os dados atuais deste navegador. Continuar?')) return;
        data.vehicles.forEach(v => { v.items ||= []; v.logs ||= []; v.odometer = Number(v.odometer) || 0; });
        state = { vehicles: data.vehicles, current: data.current };
        save(); render(); toast('Backup importado ✓');
      } catch { toast('Arquivo inválido'); }
    };
    inp.click();
  }

  /* ---------- eventos ---------- */
  const actions = {
    tab: d => { ui.tab = d.tab; render(); window.scrollTo(0, 0); },
    'vehicle-new': () => vehicleForm(null),
    'vehicle-edit': () => vehicleForm(vehicle()),
    'vehicle-del': () => {
      const v = vehicle();
      if (!confirm(`Remover “${v.name}” e todo o histórico dele? Isso não pode ser desfeito (exporte um backup antes).`)) return;
      state.vehicles = state.vehicles.filter(x => x.id !== v.id);
      state.current = state.vehicles[0]?.id ?? null;
      save(); render();
    },
    odo: () => {
      const v = vehicle();
      openModal('Atualizar quilometragem', field('km', 'Km atual', { type: 'number', value: v.odometer, required: true, min: 0, step: 'any', inputmode: 'decimal' }), d => {
        const km = num(d.km);
        if (km == null) return false;
        v.odometer = km; save(); render();
      });
    },
    'item-new': () => itemForm(null),
    'item-edit': d => itemForm(vehicle().items.find(i => i.id === d.id)),
    'item-del': d => {
      const v = vehicle();
      if (!confirm('Apagar este item? Os registros do histórico continuam salvos.')) return;
      v.items = v.items.filter(i => i.id !== d.id);
      v.logs.forEach(l => { if (l.itemId === d.id) l.itemId = null; });
      save(); $('#dlg').close(); render();
    },
    service: d => serviceForm(d.id),
    'log-new': logForm,
    'fuel-new': fuelForm,
    'log-del': d => {
      if (!confirm('Apagar este registro?')) return;
      const v = vehicle();
      v.logs = v.logs.filter(l => l.id !== d.id);
      recompute(v); save(); render();
    },
    report: () => report(vehicle()),
    export: exportData,
    import: importData,
  };

  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { $('#dlg').close(); return; }
    const b = e.target.closest('[data-a]');
    if (b && b.tagName !== 'SELECT') actions[b.dataset.a]?.({ ...b.dataset });
  });
  document.addEventListener('change', e => {
    if (e.target.matches('[data-a="vehicle-switch"]')) { state.current = e.target.value; save(); render(); }
  });

  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }
})();
