(function() {
  "use strict";
  function shell() {
    return window.wp?.os ?? null;
  }
  function shellIsActive() {
    const os = shell();
    return Boolean(os?.isActive?.());
  }
  function whenShellReady(cb) {
    const os = shell();
    if (os?.ready) {
      os.ready(cb);
      return;
    }
    if (os?.whenReady) {
      os.whenReady(cb);
      return;
    }
    if (os) {
      cb();
      return;
    }
    let ran = false;
    const once = () => {
      if (ran) {
        return;
      }
      ran = true;
      cb();
    };
    document.addEventListener("os-init", once, { once: true });
    window.setTimeout(once, 0);
  }
  async function loadComponents(tags) {
    const os = shell();
    if (!os?.loadComponents) {
      return false;
    }
    try {
      await os.loadComponents(tags);
      return true;
    } catch {
      return false;
    }
  }
  function hasComponent(tag) {
    return typeof customElements !== "undefined" && Boolean(customElements.get(tag));
  }
  function notify(title, body = "", type = "info") {
    const os = shell();
    if (os?.notify) {
      os.notify({ title, body, type });
      return;
    }
    const notice = document.createElement("div");
    notice.className = `notice notice-${"error" === type ? "error" : "success"} is-dismissible atcf-notice`;
    notice.setAttribute("role", "status");
    notice.innerHTML = "";
    const paragraph = document.createElement("p");
    paragraph.textContent = body ? `${title} — ${body}` : title;
    notice.appendChild(paragraph);
    const anchor = document.querySelector(".wrap > h1, .wrap > .wp-heading-inline");
    if (anchor?.parentElement) {
      anchor.parentElement.insertBefore(notice, anchor.nextSibling);
    } else {
      document.body.prepend(notice);
    }
    window.setTimeout(() => notice.remove(), 6e3);
  }
  async function confirm(message, opts = {}) {
    const os = shell();
    if (os?.confirm) {
      return os.confirm({ message, ...opts });
    }
    return window.confirm(message);
  }
  const OS_TAGS = [
    "os-button",
    "os-text-field",
    "os-textarea",
    "os-number-field",
    "os-select",
    "os-option",
    "os-multiselect",
    "os-switch",
    "os-checkbox-label",
    "os-segmented",
    "os-segment",
    "os-range-field",
    "os-color-field",
    "os-tag-input",
    "os-chip",
    "os-card",
    "os-icon",
    "os-badge",
    "os-tile",
    "os-panel",
    "os-section",
    "os-row",
    "os-stack",
    "os-cluster",
    "os-grid",
    "os-empty-state",
    "os-spinner",
    "os-notice",
    "os-tabs",
    "os-tab",
    "os-tabpanel",
    "os-table",
    "os-menu",
    "os-menu-item",
    "os-modal",
    "os-flyout",
    "os-field-row",
    "os-avatar",
    "os-save-status",
    "os-relative-time",
    "os-code",
    "os-key",
    "os-progress-bar"
  ];
  function componentsReady() {
    if (!pending) {
      pending = Promise.race([
        loadComponents(OS_TAGS),
        new Promise((resolve) => window.setTimeout(() => resolve(false), COMPONENT_TIMEOUT_MS))
      ]);
    }
    return pending;
  }
  const COMPONENT_TIMEOUT_MS = 2500;
  let pending = null;
  function el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.class) {
      node.className = opts.class;
    }
    if (opts.text !== void 0) {
      node.textContent = opts.text;
    }
    if (opts.html !== void 0) {
      node.innerHTML = opts.html;
    }
    if (opts.style) {
      Object.entries(opts.style).forEach(([property, value]) => {
        if (value === void 0 || value === null) {
          return;
        }
        if (property.startsWith("--")) {
          node.style.setProperty(property, String(value));
          return;
        }
        node.style[property] = String(value);
      });
    }
    if (opts.dataset) {
      Object.entries(opts.dataset).forEach(([key, value]) => {
        node.dataset[key] = value;
      });
    }
    if (opts.attrs) {
      Object.entries(opts.attrs).forEach(([key, value]) => {
        if (value === null || value === void 0 || value === false) {
          return;
        }
        node.setAttribute(key, value === true ? "" : String(value));
      });
    }
    if (opts.on) {
      Object.entries(opts.on).forEach(([event, handler]) => node.addEventListener(event, handler));
    }
    (opts.children ?? []).forEach((child) => {
      if (child === null || child === void 0) {
        return;
      }
      node.append(child);
    });
    return node;
  }
  function control(tag, fallback, opts = {}) {
    return el(hasComponent(tag) ? tag : fallback, opts);
  }
  function button(label, opts = {}) {
    const { variant, ...rest } = opts;
    const node = control("os-button", "button", {
      ...rest,
      text: label,
      attrs: {
        type: "button",
        // `variant`, not a background painted on from outside.
        //
        // `<os-button>` draws its own surface inside its shadow root, so a
        // `background` set on the host paints *behind* that surface — you get
        // a coloured rectangle with the real button sitting on top of it and
        // the component's own edge showing through. Exactly the double-border
        // mistake in a different property.
        variant: variant ?? null,
        ...rest.attrs ?? {}
      }
    });
    if (!hasComponent("os-button")) {
      node.classList.add("button");
      if ("primary" === variant) {
        node.classList.add("button-primary");
      }
      if ("danger" === variant) {
        node.classList.add("button-link-delete");
      }
    }
    return node;
  }
  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }
  function config() {
    const global = window.allTerrainFields;
    if (global) {
      return global;
    }
    const fromWindow = shell()?.getWindowConfig?.("allterrain-fields");
    return fromWindow ?? {
      restUrl: "",
      wpRestUrl: "",
      nonce: "",
      adminUrl: "",
      version: "0",
      canManage: false,
      devMode: false,
      locale: "en_US",
      dragTypes: {
        field: "allterrain-fields/field",
        group: "allterrain-fields/group",
        value: "allterrain-fields/value"
      },
      shell: { active: false, chromeless: false }
    };
  }
  class ApiError extends Error {
    constructor(message, status, code) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
    }
  }
  async function request(path, init = {}, source = "allterrain-fields") {
    const { restUrl, nonce } = config();
    const url = path.startsWith("http") ? path : restUrl + path;
    const options = {
      credentials: "same-origin",
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-WP-Nonce": nonce,
        ...init.headers ?? {}
      }
    };
    const os = shell();
    const response = os?.fetch ? await os.fetch(url, options, { source }) : await fetch(url, options);
    if (response.status === 204) {
      return void 0;
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body?.message ?? `The server refused that (${response.status}).`;
      throw new ApiError(message, response.status, body?.code ?? "unknown");
    }
    return body;
  }
  function listGroups() {
    return request("groups");
  }
  function exportGroups(ids = []) {
    const query = ids.length ? `?ids=${ids.join(",")}` : "";
    return request(`export${query}`);
  }
  function importGroups(groups) {
    return request("import", { method: "POST", body: JSON.stringify({ groups }) }, "field-group-import");
  }
  function jsonDiff() {
    return request("sync");
  }
  function jsonSync(keys = []) {
    return request("sync", { method: "POST", body: JSON.stringify({ keys }) }, "field-group-sync");
  }
  class Tools {
    constructor(root) {
      this.groups = [];
      this.diff = null;
      this.chosen = /* @__PURE__ */ new Set();
      this.root = root;
    }
    /** Loads and paints. */
    async start() {
      await componentsReady();
      try {
        this.groups = await listGroups();
      } catch (error) {
        clear(this.root);
        this.root.append(el("p", { class: "atcft__error", text: error instanceof Error ? error.message : String(error) }));
        return;
      }
      try {
        this.diff = await jsonDiff();
      } catch {
        this.diff = null;
      }
      this.draw();
    }
    /** Paints. */
    draw() {
      clear(this.root);
      this.root.append(this.exportPane(), this.importPane(), this.syncPane());
    }
    /** Export. */
    exportPane() {
      const list = el("div", { class: "atcft__list", attrs: { role: "group", "aria-label": "Field groups to export" } });
      this.groups.forEach((group) => {
        const box = el("input", { attrs: { type: "checkbox", value: String(group.id) } });
        box.checked = this.chosen.has(group.id);
        box.addEventListener("change", () => {
          if (box.checked) {
            this.chosen.add(group.id);
          } else {
            this.chosen.delete(group.id);
          }
        });
        list.append(
          el("label", {
            class: "atcft__item",
            children: [
              box,
              el("span", { class: "atcft__item-title", text: group.title }),
              el("span", { class: "atcft__item-meta", text: `${group.fields} fields` })
            ]
          })
        );
      });
      return el("section", {
        class: "atcft__pane",
        children: [
          el("h2", { text: "Export" }),
          el("p", {
            class: "atcft__note",
            text: "A JSON file holding the whole definition. Post IDs are stripped, because they mean nothing on the site you import into."
          }),
          list,
          el("div", {
            class: "atcft__actions",
            children: [
              button("Download", { on: { click: () => void this.download() } }),
              button("Copy to clipboard", { on: { click: () => void this.copy() } })
            ]
          })
        ]
      });
    }
    /** Downloads the chosen groups. */
    async download() {
      try {
        const groups = await exportGroups(Array.from(this.chosen));
        const blob = new Blob([JSON.stringify(groups, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = el("a", { attrs: { href: url, download: "allterrain-fields.json" } });
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
      } catch (error) {
        notify("That would not export.", error instanceof Error ? error.message : "", "error");
      }
    }
    /** Copies the chosen groups. */
    async copy() {
      try {
        const groups = await exportGroups(Array.from(this.chosen));
        await navigator.clipboard.writeText(JSON.stringify(groups, null, 2));
        notify("Copied.", "", "success");
      } catch {
        notify("The clipboard is not available here.", "Use Download instead.", "error");
      }
    }
    /** Import. */
    importPane() {
      const area = el("textarea", {
        class: "atcft__paste",
        attrs: { rows: 6, spellcheck: "false", placeholder: "Paste an export here, or choose a file." }
      });
      const file = el("input", { attrs: { type: "file", accept: "application/json,.json" } });
      file.addEventListener("change", async () => {
        const chosen = file.files?.[0];
        if (chosen) {
          area.value = await chosen.text();
        }
      });
      return el("section", {
        class: "atcft__pane",
        children: [
          el("h2", { text: "Import" }),
          el("p", {
            class: "atcft__note",
            text: "Groups are matched on their key, so importing an updated file updates them rather than making copies."
          }),
          file,
          area,
          button("Import", { on: { click: () => void this.doImport(area.value) } })
        ]
      });
    }
    /** Imports pasted or uploaded JSON. */
    async doImport(raw) {
      if (!raw.trim()) {
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        notify("That is not valid JSON.", "", "error");
        return;
      }
      const groups = Array.isArray(parsed) ? parsed : [parsed];
      const yes = await confirm(
        `Import ${groups.length} field group${groups.length === 1 ? "" : "s"}? Any with a matching key will be replaced.`,
        { title: "Import field groups?", confirmLabel: "Import" }
      );
      if (!yes) {
        return;
      }
      try {
        const result = await importGroups(groups);
        const updated = result.imported.filter((one) => one.updated).length;
        notify(
          `${result.imported.length} imported.`,
          updated ? `${updated} replaced an existing group.` : "",
          "success"
        );
        this.groups = await listGroups();
        this.diff = await jsonDiff().catch(() => null);
        this.draw();
      } catch (error) {
        notify("That would not import.", error instanceof Error ? error.message : "", "error");
      }
    }
    /** The JSON sync. */
    syncPane() {
      if (!this.diff) {
        return el("section", {
          class: "atcft__pane",
          children: [
            el("h2", { text: "Sync with the theme" }),
            el("p", { class: "atcft__note", text: "The sync is not available on this site." })
          ]
        });
      }
      const diff = this.diff;
      const rows = [];
      const section = (title, items, empty) => {
        if (!items.length) {
          return el("p", { class: "atcft__note", text: empty });
        }
        return el("div", {
          class: "atcft__diff",
          children: [
            el("h3", { text: title }),
            el("ul", {
              children: items.map((item) => el("li", { text: item.title }))
            })
          ]
        });
      };
      rows.push(
        el("p", {
          class: "atcft__path",
          text: diff.dir + (diff.writable ? "" : " — not writable, so nothing is being written")
        })
      );
      rows.push(section("On disk but not here", diff.new, "Nothing on disk is missing from this site."));
      rows.push(section("Different on disk", diff.modified, "Nothing on disk differs from this site."));
      rows.push(section("Here but not on disk", diff.unsynced, "Everything here has a file."));
      const pending2 = diff.new.length + diff.modified.length;
      rows.push(
        button(pending2 ? `Import ${pending2} from disk` : "Nothing to import", {
          class: "atcft__sync",
          attrs: { disabled: pending2 ? null : true },
          on: { click: () => void this.doSync() }
        })
      );
      return el("section", {
        class: "atcft__pane",
        children: [
          el("h2", { text: "Sync with the theme" }),
          el("p", {
            class: "atcft__note",
            text: "Every save writes a JSON file into the theme. Reading them back is deliberate rather than automatic, so a stale file cannot quietly undo an edit."
          }),
          ...rows
        ]
      });
    }
    /** Imports the differing files. */
    async doSync() {
      try {
        const result = await jsonSync();
        notify(`${result.imported.length} group(s) imported from disk.`, "", "success");
        this.groups = await listGroups();
        this.diff = await jsonDiff();
        this.draw();
      } catch (error) {
        notify("The sync would not run.", error instanceof Error ? error.message : "", "error");
      }
    }
  }
  function mount(body) {
    const root = body.querySelector("[data-atcft-body]") ?? body;
    if (root.dataset.atcftMounted === "1") {
      return;
    }
    root.dataset.atcftMounted = "1";
    void new Tools(root).start();
  }
  const globals = window;
  globals.openStationNativeWindows = globals.openStationNativeWindows ?? {};
  globals.openStationNativeWindows["allterrain-fields-tools"] = (body) => mount(body);
  if (typeof document !== "undefined") {
    whenShellReady(() => {
      document.querySelectorAll("[data-atcft-root]").forEach((root) => {
        if (!shellIsActive() || !root.closest(".os-window")) {
          mount(root);
        }
      });
    });
  }
})();
