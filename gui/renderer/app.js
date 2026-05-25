// ── Theme toggle ─────────────────────────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem('skeletal-theme') || 'dark';
  document.documentElement.dataset.theme = saved;
  // button label is updated after DOM loads — handled below
})();

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  frontendPath: '',
  editingModelIdx: -1, // -1 = new model
  models: [],          // local copy of crud models (synced to config on generate)
  config: defaultConfig()
};

function defaultConfig() {
  return {
    project: { name: 'my-app', port: 3001 },
    database: { uri: 'mongodb://localhost:27017/my-app' },
    cors: { origins: ['http://localhost:3000'] },
    features: {
      auth:      { enabled: true,  jwtSecret: '', tokenExpiry: '7d' },
      otp:       { enabled: false, length: 6, expiry: 300,
                   email: { enabled: true, provider: 'gmail', user: '', pass: '' },
                   sms:   { enabled: false, accountSid: '', authToken: '', from: '' } },
      webhooks:  { enabled: true,  secret: '' },
      crud:      { enabled: true,  models: [] },
      rateLimit: { enabled: false, windowMs: 900000, globalMax: 100, authMax: 20 },
      uploads:   { enabled: false, destination: 'uploads/', maxSizeMb: 5, auth: true },
      logging:   { enabled: false, format: 'dev' }
    },
    websocket: { enabled: true }
  };
}

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── Navigation ───────────────────────────────────────────────────────────────
$$('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.nav-item').forEach(b => b.classList.remove('active'));
    $$('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('panel-' + btn.dataset.panel).classList.add('active');
  });
});

// ── Feature toggles → dim body + update badge ────────────────────────────────
$$('.feature-toggle').forEach(cb => {
  cb.addEventListener('change', () => {
    const feat = cb.dataset.feature;
    syncFeatureUI(feat, cb.checked);
  });
});

function syncFeatureUI(feat, enabled) {
  const body  = $('body-' + feat);
  const badge = $('badge-' + feat);
  if (body)  body.classList.toggle('disabled', !enabled);
  if (badge) {
    badge.textContent = enabled ? 'ON' : 'OFF';
    badge.className   = 'badge ' + (enabled ? 'badge-on' : 'badge-off');
  }
}

// ── Theme button ──────────────────────────────────────────────────────────────
function updateThemeBtn() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  $('btn-theme').textContent = isDark ? '[light mode]' : '[dark mode]';
}
updateThemeBtn();

$('btn-theme').addEventListener('click', () => {
  const isDark = document.documentElement.dataset.theme === 'dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('skeletal-theme', next);
  updateThemeBtn();
});

// ── Folder picker ─────────────────────────────────────────────────────────────
$('btn-browse').addEventListener('click', async () => {
  const folder = await window.skeletalAPI.openFolder();
  if (!folder) return;
  state.frontendPath = folder;
  $('folder-display').textContent = folder;
  $('folder-display').classList.remove('dim');
  $('btn-reveal').style.display = 'inline';
});

$('btn-reveal').addEventListener('click', () => {
  window.skeletalAPI.revealFolder(state.frontendPath);
});

// ── Secret generators ─────────────────────────────────────────────────────────
function randomHex(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

$('btn-gen-jwt').addEventListener('click', () => {
  $('auth-secret').value = randomHex(32);
});
$('btn-gen-webhook').addEventListener('click', () => {
  $('webhooks-secret').value = randomHex(32);
});

// ── OTP provider swap ─────────────────────────────────────────────────────────
$('otp-email-provider').addEventListener('change', function () {
  const isGmail = this.value === 'gmail';
  $('otp-gmail-fields').style.display = isGmail ? '' : 'none';
  $('otp-smtp-fields').style.display  = isGmail ? 'none' : '';
});

$('otp-email-enabled').addEventListener('change', function () {
  $('otp-email-body').style.display = this.checked ? '' : 'none';
});

$('otp-sms-enabled').addEventListener('change', function () {
  $('otp-sms-body').style.display = this.checked ? '' : 'none';
});

// ── CRUD model editor ─────────────────────────────────────────────────────────
const FIELD_TYPES = ['String', 'Number', 'Boolean', 'Date', 'ObjectId', 'Mixed', 'Array'];

function fieldRowHTML(f = {}) {
  const typeOpts = FIELD_TYPES.map(t =>
    `<option value="${t}" ${(f.type || 'String') === t ? 'selected' : ''}>${t}</option>`
  ).join('');
  return `
    <div class="field-row-item">
      <input type="text"   class="fr-name"  value="${f.name || ''}"  placeholder="fieldName" />
      <select class="fr-type">${typeOpts}</select>
      <input type="checkbox" class="fr-req" ${f.required ? 'checked' : ''} />
      <input type="text"   class="fr-min"   value="${f.min ?? ''}"   placeholder="—" />
      <input type="text"   class="fr-max"   value="${f.max ?? ''}"   placeholder="—" />
      <input type="text"   class="fr-enum"  value="${(f.enum || []).join(',')}" placeholder="a, b, c" />
      <button class="btn-del-field" title="Remove">✕</button>
    </div>`;
}

$('btn-add-field').addEventListener('click', () => {
  $('fields-rows').insertAdjacentHTML('beforeend', fieldRowHTML());
  wireDelFieldBtns();
});

function wireDelFieldBtns() {
  $$('#fields-rows .btn-del-field').forEach(btn => {
    btn.onclick = () => btn.closest('.field-row-item').remove();
  });
}

function openModelEditor(idx = -1) {
  state.editingModelIdx = idx;
  const model = idx >= 0 ? state.models[idx] : null;

  $('editor-title').textContent = model ? `Edit: ${model.name}` : 'New Model';
  $('me-name').value      = model?.name || '';
  $('me-roles').value     = (model?.roles || []).join(', ');
  $('me-auth').checked    = model ? model.auth !== false : true;
  $('me-soft').checked    = !!model?.softDelete;

  // Populate field rows
  const container = $('fields-rows');
  container.innerHTML = '';
  const fields = model?.fields || {};
  Object.entries(fields).forEach(([name, def]) => {
    let f = { name };
    if (typeof def === 'string') { f.type = def; }
    else { Object.assign(f, def); }
    container.insertAdjacentHTML('beforeend', fieldRowHTML(f));
  });
  if (!Object.keys(fields).length) {
    container.insertAdjacentHTML('beforeend', fieldRowHTML());
  }
  wireDelFieldBtns();

  $('model-editor').style.display = '';
  $('model-editor').scrollIntoView({ behavior: 'smooth' });
}

$('btn-add-model').addEventListener('click', () => openModelEditor(-1));

$('btn-cancel-model').addEventListener('click', () => {
  $('model-editor').style.display = 'none';
  state.editingModelIdx = -1;
});

$('btn-save-model').addEventListener('click', () => {
  const name = $('me-name').value.trim().toLowerCase();
  if (!name) { alert('Model name is required.'); return; }

  // Collect fields
  const fields = {};
  $$('#fields-rows .field-row-item').forEach(row => {
    const fname = row.querySelector('.fr-name').value.trim();
    if (!fname) return;
    const type    = row.querySelector('.fr-type').value;
    const req     = row.querySelector('.fr-req').checked;
    const minVal  = row.querySelector('.fr-min').value.trim();
    const maxVal  = row.querySelector('.fr-max').value.trim();
    const enumStr = row.querySelector('.fr-enum').value.trim();

    const hasExtras = req || minVal || maxVal || enumStr;
    if (!hasExtras) {
      fields[fname] = type;
    } else {
      const def = { type };
      if (req)     def.required = true;
      if (minVal)  def.min = isNaN(minVal) ? minVal : Number(minVal);
      if (maxVal)  def.max = isNaN(maxVal) ? maxVal : Number(maxVal);
      if (enumStr) def.enum = enumStr.split(',').map(s => s.trim()).filter(Boolean);
      fields[fname] = def;
    }
  });

  const roles = $('me-roles').value.split(',').map(r => r.trim()).filter(Boolean);
  const entry = {
    name,
    fields,
    auth:       $('me-auth').checked,
    softDelete: $('me-soft').checked,
  };
  if (roles.length) entry.roles = roles;

  if (state.editingModelIdx >= 0) {
    state.models[state.editingModelIdx] = entry;
  } else {
    state.models.push(entry);
  }

  $('model-editor').style.display = 'none';
  state.editingModelIdx = -1;
  renderModelList();
});

function renderModelList() {
  const list = $('model-list');
  list.innerHTML = '';
  state.models.forEach((m, i) => {
    // Build a code-line representation: const modelName = { field: Type, ... }
    const fieldParts = Object.entries(m.fields || {}).map(([fname, def]) => {
      const t = typeof def === 'string' ? def : (def.type || 'String');
      return `<span class="mc-field">${fname}</span><span class="mc-punct">:</span><span class="mc-type">${t}</span>`;
    }).join('<span class="mc-punct">,&nbsp;</span>');

    const tags = [];
    if (m.auth !== false) tags.push(`<span class="tag tag-auth">auth</span>`);
    if (m.softDelete)     tags.push(`<span class="tag tag-soft">soft-del</span>`);
    if (m.roles?.length)  tags.push(`<span class="tag tag-role">${m.roles.join(',')}</span>`);

    const card = document.createElement('div');
    card.className = 'model-card';
    card.innerHTML = `
      <div class="model-card-code">
        <span class="mc-keyword">const </span><span class="mc-name">${m.name}</span>
        <span class="mc-punct"> = {&nbsp;</span>${fieldParts}<span class="mc-punct"> }</span>
      </div>
      <div class="model-card-tags">${tags.join('')}</div>
      <div class="model-card-actions">
        <button class="btn-card-action" data-idx="${i}">edit</button>
        <button class="btn-card-action del" data-idx="${i}">delete</button>
      </div>`;
    list.appendChild(card);
  });

  list.querySelectorAll('.btn-card-action:not(.del)').forEach(btn => {
    btn.addEventListener('click', () => openModelEditor(Number(btn.dataset.idx)));
  });
  list.querySelectorAll('.btn-card-action.del').forEach(btn => {
    btn.addEventListener('click', () => {
      state.models.splice(Number(btn.dataset.idx), 1);
      renderModelList();
    });
  });
}

// ── Build config from UI ──────────────────────────────────────────────────────
function buildConfig() {
  const cfg = defaultConfig();

  // Project
  cfg.project.name = $('proj-name').value.trim() || 'my-app';
  cfg.project.port = Number($('proj-port').value) || 3001;
  cfg.database.uri = $('proj-mongo').value.trim() || `mongodb://localhost:27017/${cfg.project.name}`;
  cfg.cors.origins = $('proj-cors').value.split(',').map(s => s.trim()).filter(Boolean);

  // Auth
  const authOn = $('auth-enabled').checked;
  cfg.features.auth = {
    enabled:     authOn,
    jwtSecret:   $('auth-secret').value.trim() || randomHex(32),
    tokenExpiry: $('auth-expiry').value
  };

  // OTP
  const otpOn = $('otp-enabled').checked;
  const emailOn = $('otp-email-enabled').checked;
  const smsOn   = $('otp-sms-enabled').checked;
  const provider = $('otp-email-provider').value;

  let emailCfg = { enabled: false };
  if (emailOn && otpOn) {
    if (provider === 'gmail') {
      emailCfg = { enabled: true, provider: 'gmail',
        user: $('otp-gmail-user').value.trim(),
        pass: $('otp-gmail-pass').value.trim().replace(/\s/g, '') };
    } else {
      emailCfg = { enabled: true,
        host: $('otp-smtp-host').value.trim(),
        port: Number($('otp-smtp-port').value) || 587,
        user: $('otp-smtp-user').value.trim(),
        pass: $('otp-smtp-pass').value.trim() };
    }
  }
  const smsCfg = smsOn && otpOn
    ? { enabled: true, accountSid: $('otp-sms-sid').value.trim(),
        authToken: $('otp-sms-token').value.trim(), from: $('otp-sms-from').value.trim() }
    : { enabled: false };

  cfg.features.otp = {
    enabled: otpOn,
    length:  Number($('otp-length').value) || 6,
    expiry:  Number($('otp-expiry').value) || 300,
    email:   emailCfg,
    sms:     smsCfg
  };

  // Webhooks
  const whOn = $('webhooks-enabled').checked;
  cfg.features.webhooks = {
    enabled: whOn,
    secret:  $('webhooks-secret').value.trim() || randomHex(32)
  };

  // CRUD
  const crudOn = $('crud-enabled').checked;
  cfg.features.crud = { enabled: crudOn, models: [...state.models] };

  // Rate limit
  const rlOn = $('rateLimit-enabled').checked;
  cfg.features.rateLimit = {
    enabled:   rlOn,
    windowMs:  900000,
    globalMax: Number($('rl-global').value) || 100,
    authMax:   Number($('rl-auth').value) || 20
  };

  // Uploads
  const upOn = $('uploads-enabled').checked;
  cfg.features.uploads = {
    enabled:     upOn,
    destination: $('up-dest').value.trim() || 'uploads/',
    maxSizeMb:   Number($('up-size').value) || 5,
    auth:        $('up-auth').checked
  };

  // Logging
  const lgOn = $('logging-enabled').checked;
  const logFmt = document.querySelector('input[name="log-fmt"]:checked')?.value || 'dev';
  cfg.features.logging = { enabled: lgOn, format: logFmt };

  // WebSocket
  cfg.websocket = { enabled: $('websocket-enabled').checked };

  return cfg;
}

// ── Populate UI from config ───────────────────────────────────────────────────
function populateUI(cfg) {
  const f = cfg.features || {};

  $('proj-name').value  = cfg.project?.name || '';
  $('proj-port').value  = cfg.project?.port || 3001;
  $('proj-mongo').value = cfg.database?.uri || '';
  $('proj-cors').value  = (cfg.cors?.origins || []).join(', ');

  // Auth
  const authEnabled = !!f.auth?.enabled;
  $('auth-enabled').checked = authEnabled;
  $('auth-secret').value    = f.auth?.jwtSecret || '';
  $('auth-expiry').value    = f.auth?.tokenExpiry || '7d';
  syncFeatureUI('auth', authEnabled);

  // OTP
  const otpEnabled = !!f.otp?.enabled;
  $('otp-enabled').checked       = otpEnabled;
  $('otp-length').value          = f.otp?.length || 6;
  $('otp-expiry').value          = f.otp?.expiry || 300;
  $('otp-email-enabled').checked = !!f.otp?.email?.enabled;
  $('otp-email-provider').value  = f.otp?.email?.provider || 'gmail';
  $('otp-gmail-user').value      = f.otp?.email?.user || '';
  $('otp-gmail-pass').value      = f.otp?.email?.pass || '';
  $('otp-smtp-host').value       = f.otp?.email?.host || '';
  $('otp-smtp-port').value       = f.otp?.email?.port || 587;
  $('otp-smtp-user').value       = f.otp?.email?.user || '';
  $('otp-smtp-pass').value       = f.otp?.email?.pass || '';
  $('otp-sms-enabled').checked   = !!f.otp?.sms?.enabled;
  $('otp-sms-sid').value         = f.otp?.sms?.accountSid || '';
  $('otp-sms-token').value       = f.otp?.sms?.authToken || '';
  $('otp-sms-from').value        = f.otp?.sms?.from || '';
  const isGmail = (f.otp?.email?.provider || 'gmail') === 'gmail';
  $('otp-gmail-fields').style.display = isGmail ? '' : 'none';
  $('otp-smtp-fields').style.display  = isGmail ? 'none' : '';
  $('otp-email-body').style.display   = f.otp?.email?.enabled ? '' : 'none';
  $('otp-sms-body').style.display     = f.otp?.sms?.enabled   ? '' : 'none';
  syncFeatureUI('otp', otpEnabled);

  // Webhooks
  const whEnabled = !!f.webhooks?.enabled;
  $('webhooks-enabled').checked = whEnabled;
  $('webhooks-secret').value    = f.webhooks?.secret || '';
  syncFeatureUI('webhooks', whEnabled);

  // CRUD
  const crudEnabled = !!f.crud?.enabled;
  $('crud-enabled').checked = crudEnabled;
  state.models = JSON.parse(JSON.stringify(f.crud?.models || []));
  renderModelList();
  syncFeatureUI('crud', crudEnabled);

  // Rate limit
  const rlEnabled = !!f.rateLimit?.enabled;
  $('rateLimit-enabled').checked = rlEnabled;
  $('rl-global').value = f.rateLimit?.globalMax || 100;
  $('rl-auth').value   = f.rateLimit?.authMax || 20;
  syncFeatureUI('rateLimit', rlEnabled);

  // Uploads
  const upEnabled = !!f.uploads?.enabled;
  $('uploads-enabled').checked = upEnabled;
  $('up-dest').value  = f.uploads?.destination || 'uploads/';
  $('up-size').value  = f.uploads?.maxSizeMb || 5;
  $('up-auth').checked = f.uploads?.auth !== false;
  syncFeatureUI('uploads', upEnabled);

  // Logging
  const lgEnabled = !!f.logging?.enabled;
  $('logging-enabled').checked = lgEnabled;
  const fmt = f.logging?.format || 'dev';
  const radio = document.querySelector(`input[name="log-fmt"][value="${fmt}"]`);
  if (radio) radio.checked = true;
  syncFeatureUI('logging', lgEnabled);

  // WebSocket
  const wsEnabled = !!cfg.websocket?.enabled;
  $('websocket-enabled').checked = wsEnabled;
  syncFeatureUI('websocket', wsEnabled);
}

// ── Generate button ──────────────────────────────────────────────────────────
$('btn-generate').addEventListener('click', async () => {
  setStatus('working', 'Generating config and SDK…');
  $('btn-generate').disabled = true;

  const config = buildConfig();
  const result = await window.skeletalAPI.generate({
    config,
    frontendPath: state.frontendPath || null
  });

  $('btn-generate').disabled = false;

  if (result.success) {
    const injected = state.frontendPath
      ? ` · SDK copied to ${state.frontendPath}`
      : ' · No frontend folder — SDK saved to skeletal-dock root';
    setStatus('ok', `✓ skeletal.config.json saved${injected}`);
  } else {
    setStatus('err', `✗ Error: ${result.error}`);
  }
});

// ── Start server button ───────────────────────────────────────────────────────
$('btn-start-server').addEventListener('click', async () => {
  setStatus('working', 'Starting backend server…');
  const r = await window.skeletalAPI.startServer();
  if (r.mode === 'terminal') {
    setStatus('ok', '▶ Server started — a terminal window opened with the logs');
  } else {
    setStatus('ok', `▶ Server running in background (PID ${r.pid})`);
  }
});

// ── Status bar ────────────────────────────────────────────────────────────────
function setStatus(state, msg) {
  const dot  = $('status-dot');
  const text = $('status-text');
  dot.className = 'dot';
  if (state === 'working') dot.classList.add('dot-working');
  else if (state === 'ok') dot.classList.add('dot-ok');
  else if (state === 'err') dot.classList.add('dot-err');
  else dot.classList.add('dot-idle');
  text.textContent = msg;
}

// ── Boot: load existing config ────────────────────────────────────────────────
(async () => {
  const cfg = await window.skeletalAPI.loadConfig();
  if (cfg) {
    state.config = cfg;
    populateUI(cfg);
    setStatus('ok', 'Loaded existing skeletal.config.json');
  } else {
    populateUI(state.config);
    setStatus('idle', 'Ready — configure your features then click Generate');
  }
})();
