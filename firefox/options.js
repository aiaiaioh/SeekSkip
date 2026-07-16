const DEFAULT_ENGINES = [
  { name: "Google", url: "https://www.google.com/search", param: "q" },
  { name: "Yandex", url: "https://yandex.com/search/", param: "text" },
  { name: "Brave", url: "https://search.brave.com/search", param: "q" },
  { name: "Duckduckgo", url: "https://duckduckgo.com/", param: "q" },
  { name: "Claude", url: "https://claude.ai/new", param: "q" }
];

let editingIndex = null; // row currently in edit mode, or null

document.addEventListener("DOMContentLoaded", loadEngines);

function getEngines() {
  return new Promise(resolve => {
    chrome.storage.sync.get(["engines"], data => {
      resolve(Array.isArray(data.engines) ? data.engines : []);
    });
  });
}

function saveEngines(engines) {
  return new Promise(resolve => {
    chrome.storage.sync.set({ engines }, resolve);
  });
}

async function loadEngines() {
  let engines = await getEngines();
  if (!engines.length) {
    engines = DEFAULT_ENGINES;
    await saveEngines(engines);
  }
  renderEngines(engines);
}

function validEngineInput(name, url, param) {
  if (!name || !url || !param) {
    alert("All three fields are required.");
    return false;
  }
  try {
    new URL(url);
  } catch {
    alert("Invalid URL!");
    return false;
  }
  if (/[=&?\s]/.test(param)) {
    alert("Enter the parameter name only (e.g. q) — no '=', '&', '?' or spaces.");
    return false;
  }
  return true;
}

function renderEngines(engines) {
  const tbody = document.querySelector("#engineTable tbody");
  tbody.replaceChildren();

  engines.forEach((engine, index) => {
    const row =
      editingIndex === index
        ? buildEditRow(engine, index, engines)
        : buildDisplayRow(engine, index, engines);
    tbody.appendChild(row);
  });
}

function buildDisplayRow(engine, index, engines) {
  const row = document.createElement("tr");
  row.draggable = editingIndex === null;
  row.dataset.index = String(index);

  const numCell = document.createElement("td");
  numCell.className = "num-cell";
  numCell.textContent = String(index + 1);

  const nameCell = document.createElement("td");
  const nameStrong = document.createElement("strong");
  nameStrong.textContent = engine.name;
  nameCell.appendChild(nameStrong);

  const urlCell = document.createElement("td");
  urlCell.textContent = engine.url;

  const paramCell = document.createElement("td");
  paramCell.textContent = engine.param;

  const orderCell = document.createElement("td");
  orderCell.className = "order-cell";
  const upButton = document.createElement("button");
  upButton.type = "button";
  upButton.className = "order-btn";
  upButton.textContent = "\u25b2";
  upButton.title = "Move up";
  upButton.disabled = index === 0 || editingIndex !== null;
  upButton.addEventListener("click", () => moveEngine(index, index - 1));
  const downButton = document.createElement("button");
  downButton.type = "button";
  downButton.className = "order-btn";
  downButton.textContent = "\u25bc";
  downButton.title = "Move down";
  downButton.disabled = index === engines.length - 1 || editingIndex !== null;
  downButton.addEventListener("click", () => moveEngine(index, index + 1));
  orderCell.append(upButton, downButton);

  const actionsCell = document.createElement("td");
  actionsCell.className = "actions-cell";
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "Edit";
  editButton.disabled = editingIndex !== null;
  editButton.addEventListener("click", () => {
    editingIndex = index;
    loadEngines();
  });
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.disabled = editingIndex !== null;
  deleteButton.addEventListener("click", () => deleteEngine(index));
  actionsCell.append(editButton, deleteButton);

  row.append(numCell, nameCell, urlCell, paramCell, orderCell, actionsCell);
  attachDragHandlers(row);
  return row;
}

function buildEditRow(engine, index) {
  const row = document.createElement("tr");
  row.dataset.index = String(index);

  const numCell = document.createElement("td");
  numCell.className = "num-cell";
  numCell.textContent = String(index + 1);

  const nameCell = document.createElement("td");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = engine.name;
  nameCell.appendChild(nameInput);

  const urlCell = document.createElement("td");
  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.value = engine.url;
  urlCell.appendChild(urlInput);

  const paramCell = document.createElement("td");
  const paramInput = document.createElement("input");
  paramInput.type = "text";
  paramInput.value = engine.param;
  paramCell.appendChild(paramInput);

  const orderCell = document.createElement("td");
  orderCell.className = "order-cell";
  orderCell.textContent = "\u2014";

  const actionsCell = document.createElement("td");
  actionsCell.className = "actions-cell";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save";
  saveButton.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    const param = paramInput.value.trim();
    if (!validEngineInput(name, url, param)) return;
    const engines = await getEngines();
    engines[index] = { name, url, param };
    editingIndex = null;
    await saveEngines(engines);
    loadEngines();
  });

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => {
    editingIndex = null;
    loadEngines();
  });

  actionsCell.append(saveButton, cancelButton);
  row.append(numCell, nameCell, urlCell, paramCell, orderCell, actionsCell);

  const onEnterOrEscape = event => {
    if (event.key === "Enter") saveButton.click();
    if (event.key === "Escape") cancelButton.click();
  };
  [nameInput, urlInput, paramInput].forEach(input =>
    input.addEventListener("keydown", onEnterOrEscape)
  );
  nameInput.focus();

  return row;
}

async function moveEngine(from, to) {
  const engines = await getEngines();
  if (to < 0 || to >= engines.length) return;
  const [moved] = engines.splice(from, 1);
  engines.splice(to, 0, moved);
  await saveEngines(engines);
  loadEngines();
}

async function deleteEngine(index) {
  const engines = await getEngines();
  engines.splice(index, 1);
  await saveEngines(engines);
  loadEngines();
}

/* ---------- drag and drop reordering ---------- */

let dragFromIndex = null;

function attachDragHandlers(row) {
  row.addEventListener("dragstart", () => {
    dragFromIndex = Number(row.dataset.index);
    row.classList.add("dragging");
  });

  row.addEventListener("dragend", () => {
    dragFromIndex = null;
    row.classList.remove("dragging");
    document
      .querySelectorAll("#engineTable tr.drag-over")
      .forEach(r => r.classList.remove("drag-over"));
  });

  row.addEventListener("dragover", event => {
    if (dragFromIndex === null) return;
    event.preventDefault(); // allow dropping
    row.classList.add("drag-over");
  });

  row.addEventListener("dragleave", () => row.classList.remove("drag-over"));

  row.addEventListener("drop", event => {
    event.preventDefault();
    row.classList.remove("drag-over");
    const to = Number(row.dataset.index);
    if (dragFromIndex === null || dragFromIndex === to) return;
    moveEngine(dragFromIndex, to);
  });
}

/* ---------- add + reset ---------- */

document.getElementById("engineForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = document.getElementById("engineName").value.trim();
  const url = document.getElementById("engineUrl").value.trim();
  const param = document.getElementById("engineParam").value.trim();
  if (!validEngineInput(name, url, param)) return;

  const engines = await getEngines();
  engines.push({ name, url, param });
  await saveEngines(engines);
  loadEngines();
  document.getElementById("engineForm").reset();
});

/* ---------- export / import ---------- */

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

document.getElementById("exportEngines").addEventListener("click", async () => {
  const engines = await getEngines();
  const payload = {
    app: "seek-skip",
    version: 1,
    exported: new Date().toISOString(),
    engines
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `seek-skip-engines-${timestamp()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

function sanitizeImportedEngines(raw) {
  // Accept either our export payload or a bare array of engines.
  const list = Array.isArray(raw) ? raw : raw?.engines;
  if (!Array.isArray(list)) return null;

  const cleaned = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const name = String(item.name ?? "").trim();
    const url = String(item.url ?? "").trim();
    const param = String(item.param ?? "").trim();
    if (!name || !url || !param) continue;
    if (/[=&?\s]/.test(param)) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
    } catch {
      continue;
    }
    cleaned.push({ name, url, param });
  }
  return cleaned.length ? cleaned : null;
}

document.getElementById("importEngines").addEventListener("click", () => {
  document.getElementById("importFile").click();
});

document.getElementById("importFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  event.target.value = ""; // allow re-importing the same file later
  if (!file) return;

  let imported;
  try {
    imported = sanitizeImportedEngines(JSON.parse(await file.text()));
  } catch {
    alert("That file isn't valid JSON.");
    return;
  }
  if (!imported) {
    alert(
      "No valid engines found in that file. Expected entries with name, url, and param fields."
    );
    return;
  }

  const replace = confirm(
    `Found ${imported.length} engine(s).\n\n` +
      "OK = REPLACE your current list with the imported one\n" +
      "Cancel = MERGE (append new engines, skip duplicates)"
  );

  let engines;
  if (replace) {
    engines = imported;
  } else {
    engines = await getEngines();
    const seen = new Set(
      engines.map(e => `${e.url.toLowerCase()}|${e.param.toLowerCase()}`)
    );
    for (const engine of imported) {
      const key = `${engine.url.toLowerCase()}|${engine.param.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        engines.push(engine);
      }
    }
  }

  editingIndex = null;
  await saveEngines(engines);
  loadEngines();
});

document.getElementById("resetDefaults").addEventListener("click", async () => {
  if (!confirm("Replace your engine list with the defaults?")) return;
  editingIndex = null;
  await saveEngines(DEFAULT_ENGINES);
  loadEngines();
});

/* ---------- Venice.ai settings ---------- */

const VENICE_DEFAULTS = {
  enabled: true,
  url: "https://venice.ai/chat/agent",
  autoSubmit: true
};

function setVeniceStatus(text, isError) {
  const el = document.getElementById("veniceStatus");
  el.textContent = text;
  el.style.color = isError ? "#ff9c9c" : "#9cff9c";
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["veniceSettings"], data => {
    const settings = { ...VENICE_DEFAULTS, ...(data.veniceSettings || {}) };
    document.getElementById("veniceEnabled").checked = settings.enabled;
    document.getElementById("veniceUrl").value =
      settings.url === VENICE_DEFAULTS.url ? "" : settings.url;
    document.getElementById("veniceAutoSubmit").checked = settings.autoSubmit;
  });
});

document.getElementById("veniceForm").addEventListener("submit", e => {
  e.preventDefault();
  const enabled = document.getElementById("veniceEnabled").checked;
  const rawUrl = document.getElementById("veniceUrl").value.trim();
  const autoSubmit = document.getElementById("veniceAutoSubmit").checked;

  let url = VENICE_DEFAULTS.url;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      if (parsed.protocol !== "https:" || (host !== "venice.ai" && !host.endsWith(".venice.ai"))) {
        setVeniceStatus("URL must be an https venice.ai address.", true);
        return;
      }
      url = parsed.toString();
    } catch {
      setVeniceStatus("Invalid URL.", true);
      return;
    }
  }

  chrome.storage.sync.set({ veniceSettings: { enabled, url, autoSubmit } }, () => {
    setVeniceStatus("Saved.", false);
  });
});
