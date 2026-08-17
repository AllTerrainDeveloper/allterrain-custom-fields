var allTerrainFieldsBulk = function(exports) {
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
  function onChangeOf(node, names, read, handle) {
    let last = read();
    const fire = (event) => {
      const value = read();
      if (value === last) {
        return;
      }
      last = value;
      handle(value, event);
    };
    names.forEach((name) => node.addEventListener(name, fire));
  }
  function select(value, choices, onChange, opts = {}) {
    if (hasComponent("os-select")) {
      const node2 = el("os-select", opts);
      choices.forEach((choice) => {
        node2.append(el("os-option", { text: choice.label, attrs: { value: choice.value } }));
      });
      node2.value = value;
      onChangeOf(
        node2,
        ["os-pick", "change"],
        () => String(node2.value ?? ""),
        (picked) => onChange(picked)
      );
      return node2;
    }
    const node = el("select", opts);
    choices.forEach((choice) => {
      const option = el("option", { text: choice.label, attrs: { value: choice.value } });
      node.append(option);
    });
    node.value = value;
    node.addEventListener("change", () => onChange(node.value));
    return node;
  }
  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }
  function debounce(fn, delay = 250) {
    let timer = 0;
    const wrapped = (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    };
    wrapped.cancel = () => window.clearTimeout(timer);
    return wrapped;
  }
  function uid(prefix = "atcf") {
    counter += 1;
    return `${prefix}-${counter}`;
  }
  let counter = 0;
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
  function readValues(params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => query.set(key, String(value)));
    return request(`values?${query.toString()}`);
  }
  function writeValues(writes) {
    return request("values", { method: "POST", body: JSON.stringify({ writes }) }, "field-values-save");
  }
  function normalizeChoices(choices) {
    if (typeof choices === "string") {
      return choices.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
        const [value, label] = line.split(":").map((part) => part.trim());
        return { value, label: label || value };
      });
    }
    if (Array.isArray(choices)) {
      return choices.map((choice) => {
        if (choice && typeof choice === "object") {
          const one = choice;
          const value = one.value ?? one.key ?? "";
          return { value: String(value), label: String(one.label ?? value) };
        }
        return { value: String(choice), label: String(choice) };
      }).filter((choice) => choice.value !== "");
    }
    if (choices && typeof choices === "object") {
      return Object.entries(choices).map(([value, label]) => ({
        value,
        label: String(label ?? value)
      }));
    }
    return [];
  }
  class Bulk {
    constructor(root) {
      this.groups = [];
      this.groupId = 0;
      this.postType = "";
      this.query = "";
      this.page = 1;
      this.pages = 1;
      this.data = null;
      this.pending = /* @__PURE__ */ new Map();
      this.footerNode = null;
      this.root = root;
    }
    /** Loads and paints. */
    async start() {
      await componentsReady();
      try {
        const summaries = await listGroups();
        this.groups = summaries.filter((one) => one.active).map((one) => ({
          id: one.id,
          title: one.title,
          types: one.types
        }));
      } catch (error) {
        this.fail(error);
        return;
      }
      this.groupId = this.groups[0]?.id ?? 0;
      if (!this.groupId) {
        this.dismissLoader();
        clear(this.root);
        this.root.append(el("p", { class: "atcfk__empty", text: "There are no field groups to edit yet." }));
        return;
      }
      await this.load();
    }
    /**
     * Removes the template's boot spinner.
     *
     * A sibling of the mount root, printed by PHP so the window is never blank
     * before the bundle runs — so no paint inside the root ever covers it, and
     * left alone it says "Loading values…" forever over a grid that loaded.
     */
    dismissLoader() {
      this.root.closest("[data-atcfk-root]")?.querySelector("[data-atcfk-bar]")?.remove();
    }
    fail(error) {
      this.dismissLoader();
      clear(this.root);
      this.root.append(
        el("div", {
          class: "atcfk__error",
          children: [
            el("h2", { text: "The bulk editor could not start." }),
            el("p", { text: error instanceof Error ? error.message : String(error) })
          ]
        })
      );
    }
    /** Fetches a page of rows. */
    async load() {
      try {
        this.data = await readValues({
          group: this.groupId,
          post_type: this.postType,
          q: this.query,
          page: this.page
        });
        this.postType = this.data.postType;
        this.pages = this.data.pages;
      } catch (error) {
        this.fail(error);
        return;
      }
      this.draw();
    }
    /** Paints the whole thing. */
    draw() {
      this.dismissLoader();
      clear(this.root);
      this.root.append(this.controls(), this.grid(), this.footer());
    }
    /** Group, post type, search. */
    controls() {
      const group = this.groups.find((one) => one.id === this.groupId);
      const types = (group?.types ?? []).filter((one) => one !== "*");
      const search = el("input", {
        class: "atcfk__search",
        attrs: { type: "search", placeholder: "Search these posts", "aria-label": "Search", value: this.query }
      });
      const run = debounce(() => {
        this.query = search.value;
        this.page = 1;
        void this.load();
      }, 300);
      search.addEventListener("input", run);
      return el("div", {
        class: "atcfk__controls",
        children: [
          el("label", {
            class: "atcfk__control",
            children: [
              el("span", { text: "Field group" }),
              select(
                String(this.groupId),
                this.groups.map((one) => ({ value: String(one.id), label: one.title })),
                (value) => {
                  this.groupId = Number(value);
                  this.postType = "";
                  this.page = 1;
                  void this.load();
                }
              )
            ]
          }),
          types.length > 1 ? el("label", {
            class: "atcfk__control",
            children: [
              el("span", { text: "Post type" }),
              select(
                this.postType,
                types.map((one) => ({ value: one, label: one })),
                (value) => {
                  this.postType = value;
                  this.page = 1;
                  void this.load();
                }
              )
            ]
          }) : null,
          search
        ]
      });
    }
    /** The grid. */
    grid() {
      if (!this.data) {
        return el("p", { text: "" });
      }
      const table = el("table", { class: "atcfk__table" });
      const head = el("tr");
      head.append(el("th", { text: "Post", attrs: { scope: "col" } }));
      this.data.columns.forEach((column) => {
        head.append(el("th", { text: column.label, attrs: { scope: "col" } }));
      });
      table.append(el("thead", { children: [head] }));
      const body = el("tbody");
      this.data.rows.forEach((row) => {
        const tr = el("tr", { class: row.canEdit ? "" : "is-locked" });
        tr.append(
          el("th", {
            class: "atcfk__row-head",
            attrs: { scope: "row" },
            children: [
              el("a", {
                text: row.title || "(no title)",
                attrs: { href: row.editUrl, target: "_blank", rel: "noreferrer noopener" }
              }),
              row.status !== "publish" ? el("span", { class: "atcfk__status", text: row.status }) : null
            ]
          })
        );
        this.data?.columns.forEach((column) => {
          tr.append(this.cell(row.id, column, row.values[column.key], row.canEdit));
        });
        body.append(tr);
      });
      table.append(body);
      return table;
    }
    /** One editable cell. */
    cell(id, column, value, canEdit) {
      const cellId = `${id}:${column.key}`;
      const td = el("td", { class: "atcfk__cell" });
      if (!canEdit) {
        td.append(
          el("span", {
            class: "atcfk__locked",
            text: summarise(value),
            attrs: { title: "You cannot edit this post." }
          })
        );
        return td;
      }
      if (["select", "radio", "button_group"].includes(column.type)) {
        const choices = [{ value: "", label: "—" }].concat(normalizeChoices(column.settings.choices));
        td.append(
          select(String(value ?? ""), choices, (next) => this.stage(cellId, { id, field: column.key, value: next }))
        );
        return td;
      }
      if (column.type === "true_false") {
        const box = el("input", { attrs: { type: "checkbox" } });
        box.checked = String(value ?? "") === "1";
        box.addEventListener(
          "change",
          () => this.stage(cellId, { id, field: column.key, value: box.checked ? "1" : "0" })
        );
        td.append(box);
        return td;
      }
      if (["relationship", "post_object", "gallery", "image", "file", "user", "taxonomy", "link", "repeater", "flexible_content", "group"].includes(column.type)) {
        td.append(
          el("span", {
            class: "atcfk__readonly",
            text: summarise(value),
            attrs: { title: "Edit this one in the post itself." }
          })
        );
        return td;
      }
      const input = el("input", {
        class: "atcfk__input",
        attrs: {
          type: ["number", "range", "computed"].includes(column.type) ? "number" : "text",
          value: String(value ?? ""),
          "aria-label": `${column.label}`
        }
      });
      input.addEventListener("change", () => this.stage(cellId, { id, field: column.key, value: input.value }));
      input.addEventListener("paste", (event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const lines = text.split(/\r?\n/).filter((one, index) => index === 0 || one !== "");
        if (lines.length < 2) {
          return;
        }
        event.preventDefault();
        this.fillDown(column.key, id, lines);
      });
      td.append(input);
      return td;
    }
    /**
     * Fills a pasted column down from a starting row.
     *
     * @param field  Which column.
     * @param fromId Which row it starts on.
     * @param lines  The pasted values.
     */
    fillDown(field, fromId, lines) {
      if (!this.data) {
        return;
      }
      const start = this.data.rows.findIndex((row) => row.id === fromId);
      lines.forEach((line, offset) => {
        const row = this.data?.rows[start + offset];
        if (!row?.canEdit) {
          return;
        }
        row.values[field] = line;
        this.stage(`${row.id}:${field}`, { id: row.id, field, value: line });
      });
      this.draw();
    }
    /** Records an edit without writing it. */
    stage(cellId, edit) {
      this.pending.set(cellId, edit);
      this.updateFooter();
    }
    /** The bar: paging, pending count, save. */
    footer() {
      const node = el("div", { class: "atcfk__footer" });
      this.footerNode = node;
      this.updateFooter();
      return node;
    }
    /** Redraws the bar. */
    updateFooter() {
      const node = this.footerNode;
      if (!node) {
        return;
      }
      clear(node);
      node.append(
        el("span", {
          class: "atcfk__pending",
          attrs: { role: "status" },
          text: this.pending.size ? `${this.pending.size} change${this.pending.size === 1 ? "" : "s"} waiting` : `${this.data?.total ?? 0} post${this.data?.total === 1 ? "" : "s"}`
        }),
        button("Save changes", {
          class: "atcfk__save",
          attrs: { disabled: this.pending.size ? null : true },
          on: { click: () => void this.save() }
        })
      );
      if (this.pages > 1) {
        node.append(
          button("Previous", {
            attrs: { disabled: this.page <= 1 ? true : null },
            on: {
              click: () => {
                this.page -= 1;
                void this.load();
              }
            }
          }),
          el("span", { class: "atcfk__page", text: `${this.page} / ${this.pages}` }),
          button("Next", {
            attrs: { disabled: this.page >= this.pages ? true : null },
            on: {
              click: () => {
                this.page += 1;
                void this.load();
              }
            }
          })
        );
      }
    }
    /** Writes every pending edit. */
    async save() {
      if (!this.pending.size) {
        return;
      }
      try {
        const result = await writeValues(Array.from(this.pending.values()));
        this.pending.clear();
        notify(
          `${result.written} change${result.written === 1 ? "" : "s"} saved.`,
          result.refused.length ? `${result.refused.length} post(s) you cannot edit were skipped.` : "",
          "success"
        );
        await this.load();
      } catch (error) {
        notify("Those changes would not save.", error instanceof Error ? error.message : "", "error");
      }
    }
  }
  function summarise(value) {
    if (Array.isArray(value)) {
      return value.length ? `${value.length} item${value.length === 1 ? "" : "s"}` : "—";
    }
    if (value && typeof value === "object") {
      return "—";
    }
    return value === "" || value === null || value === void 0 ? "—" : String(value);
  }
  function mount(body) {
    const root = body.querySelector("[data-atcfk-body]") ?? body;
    if (root.dataset.atcfkMounted === "1") {
      return;
    }
    root.dataset.atcfkMounted = "1";
    void new Bulk(root).start();
  }
  const globals = window;
  globals.openStationNativeWindows = globals.openStationNativeWindows ?? {};
  globals.openStationNativeWindows["allterrain-fields-bulk"] = (body) => mount(body);
  if (typeof document !== "undefined") {
    whenShellReady(() => {
      document.querySelectorAll("[data-atcfk-root]").forEach((root) => {
        if (!shellIsActive() || !root.closest(".os-window")) {
          mount(root);
        }
      });
    });
  }
  exports.uid = uid;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
}({});
