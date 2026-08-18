var allTerrainFieldsModel = function(exports) {
  "use strict";
  function shell() {
    return window.wp?.os ?? null;
  }
  const FAMILY_WINDOW = "allterrain-fields";
  function activateFamilyTab(value, tries = 40) {
    const win = shell()?.windowManager?.getById?.(FAMILY_WINDOW);
    if (win?.activateTab) {
      win.activateTab(value);
      return;
    }
    if (tries > 0) {
      window.setTimeout(() => activateFamilyTab(value, tries - 1), 50);
    }
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
  function windowIdOf(element) {
    const host = element.closest("[data-window-id], .os-window");
    if (!host) {
      return null;
    }
    const attribute = host.getAttribute("data-window-id");
    if (attribute) {
      return attribute;
    }
    const id = host.id ?? "";
    return id ? id.replace(/^wp-window-/, "") : null;
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
    if (!pending$1) {
      pending$1 = Promise.race([
        loadComponents(OS_TAGS),
        new Promise((resolve) => window.setTimeout(() => resolve(false), COMPONENT_TIMEOUT_MS))
      ]);
    }
    return pending$1;
  }
  const COMPONENT_TIMEOUT_MS = 2500;
  let pending$1 = null;
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
  function control(tag, fallback2, opts = {}) {
    return el(hasComponent(tag) ? tag : fallback2, opts);
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
  function icon(slug2, opts = {}) {
    if (hasComponent("os-icon")) {
      return el("os-icon", { ...opts, attrs: { name: slug2, ...opts.attrs ?? {} } });
    }
    return el("span", {
      ...opts,
      class: `dashicons ${slug2} ${opts.class ?? ""}`.trim(),
      attrs: { "aria-hidden": "true", ...opts.attrs ?? {} }
    });
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
  const TEXT_EVENTS = ["os-input-change", "os-input-commit", "input", "change"];
  function textField(value, opts = {}, onInput) {
    const node = control("os-text-field", "input", {
      ...opts,
      attrs: { type: "text", ...opts.attrs ?? {} }
    });
    node.value = value;
    if (onInput) {
      onChangeOf(node, TEXT_EVENTS, () => readValue(node), onInput);
    }
    return node;
  }
  function toggle(on, label, onChange, opts = {}) {
    if (hasComponent("os-switch")) {
      const node = el("os-switch", {
        attrs: {
          label,
          tone: opts.tone ?? SWITCH_TONE,
          size: opts.size ?? null,
          block: opts.block ? "" : null,
          description: opts.description ?? null
        }
      });
      if (on) {
        node.setAttribute("checked", "");
      }
      onChangeOf(
        node,
        ["os-switch-change", "change"],
        () => node.hasAttribute("checked"),
        (checked) => onChange(checked)
      );
      return node;
    }
    const input = el("input", { attrs: { type: "checkbox" } });
    input.checked = on;
    input.addEventListener("change", () => onChange(input.checked));
    return el("label", {
      class: "atcf-toggle",
      children: [input, el("span", { class: "atcf-toggle__label", text: label })]
    });
  }
  const SWITCH_TONE = "success";
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
  function readValue(node) {
    const value = node.value;
    return value === void 0 || value === null ? "" : String(value);
  }
  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }
  function uid(prefix = "atcf") {
    counter += 1;
    return `${prefix}-${counter}`;
  }
  let counter = 0;
  const INTERACTIVE = [
    "input",
    "textarea",
    "select",
    "button",
    "a[href]",
    "[contenteditable]",
    '[role="button"]',
    "os-button",
    "os-window-button",
    "os-text-field",
    "os-textarea",
    "os-number-field",
    "os-select",
    "os-multiselect",
    "os-switch",
    "os-checkbox",
    "os-checkbox-label",
    "os-range-field",
    "os-color-field",
    "os-tag-input",
    "os-segmented",
    "os-segment",
    "os-menu-item",
    "os-tab",
    "os-tab-chip",
    "os-swatch"
  ].join(",");
  const DRAG_THRESHOLD_PX = 4;
  const CLICK_GUARD_MS = 500;
  class FallbackDragManager {
    constructor() {
      this.targets = [];
      this.active = null;
      this.lastEndMs = 0;
    }
    start(opts) {
      if (this.active || opts.origin.button !== 0) {
        return null;
      }
      const { payload, origin } = opts;
      const startX = origin.clientX;
      const startY = origin.clientY;
      let lifted = false;
      let finished = false;
      let ghost = null;
      let hovered = null;
      let offsetX = 0;
      let offsetY = 0;
      const cleanup = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancel);
        document.removeEventListener("keydown", onKey);
        window.removeEventListener("blur", onCancel);
        ghost?.remove();
        ghost = null;
        payload.source.classList.remove("atcf-is-dragging");
        hovered?.onLeave?.(session);
        hovered = null;
        this.active = null;
        this.lastEndMs = Date.now();
      };
      const session = {
        payload,
        isFinished: () => finished,
        cancel: (reason = "caller") => {
          if (finished) {
            return;
          }
          finished = true;
          cleanup();
          opts.onCancel?.(reason);
        }
      };
      const lift = (event) => {
        lifted = true;
        payload.source.classList.add("atcf-is-dragging");
        const rect = payload.source.getBoundingClientRect();
        offsetX = payload.ghost?.offsetX ?? startX - rect.left;
        offsetY = payload.ghost?.offsetY ?? startY - rect.top;
        ghost = payload.ghost?.element ?? payload.source.cloneNode(true);
        ghost.classList.add("atcf-drag-ghost");
        ghost.style.width = `${rect.width}px`;
        document.body.appendChild(ghost);
        position(event);
      };
      const position = (event) => {
        if (ghost) {
          ghost.style.transform = `translate3d(${event.clientX - offsetX}px, ${event.clientY - offsetY}px, 0)`;
        }
      };
      const onMove = (event) => {
        if (finished) {
          return;
        }
        if (!lifted) {
          if (Math.hypot(event.clientX - startX, event.clientY - startY) < DRAG_THRESHOLD_PX) {
            return;
          }
          lift(event);
        }
        position(event);
        const next = this.hitTest(event.clientX, event.clientY);
        if (next !== hovered) {
          hovered?.onLeave?.(session);
          hovered = next;
          hovered?.onEnter?.(session);
        }
      };
      const onUp = (event) => {
        if (finished) {
          return;
        }
        if (!lifted) {
          finished = true;
          cleanup();
          opts.onClickOnly?.();
          return;
        }
        const target = hovered;
        finished = true;
        cleanup();
        if (target && target.accept(payload)) {
          opts.onCommit?.(target);
          void target.onDrop(session, { clientX: event.clientX, clientY: event.clientY });
          return;
        }
        opts.onCancel?.(target ? "rejected" : "no-target");
      };
      const onCancel = () => session.cancel("pointercancel");
      const onKey = (event) => {
        if (event.key === "Escape") {
          session.cancel("escape");
        }
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancel);
      document.addEventListener("keydown", onKey);
      window.addEventListener("blur", onCancel);
      this.active = session;
      return session;
    }
    registerDropTarget(target) {
      this.targets = this.targets.filter((candidate) => candidate.id !== target.id);
      this.targets.push(target);
      return () => {
        this.targets = this.targets.filter((candidate) => candidate.id !== target.id);
      };
    }
    isDragging() {
      return this.active !== null;
    }
    recentlyEndedDrag(withinMs = CLICK_GUARD_MS) {
      return Date.now() - this.lastEndMs < withinMs;
    }
    /**
     * The registered target the cursor is most specifically over.
     *
     * Depth first, so a target nested inside another wins — that is what makes
     * dropping on a repeater row mean something more specific than dropping on
     * the repeater that holds it.
     *
     * Ties go to whichever element comes *later* in document order, which for
     * overlapping siblings is the one painted on top and therefore the one the
     * user believes they are aiming at. Without the tie-break, two overlapping
     * siblings resolve by registration order instead, and a small target sitting
     * on top of a large one never receives a drop at all — including when its job
     * was to refuse one.
     */
    hitTest(x, y) {
      let best = null;
      let bestDepth = -1;
      for (const target of this.targets) {
        if (!target.element.isConnected) {
          continue;
        }
        const rect = target.element.getBoundingClientRect();
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
          continue;
        }
        const depth = depthOf(target.element);
        if (depth > bestDepth) {
          best = target;
          bestDepth = depth;
          continue;
        }
        if (depth === bestDepth && best && follows(target.element, best.element)) {
          best = target;
        }
      }
      return best;
    }
  }
  function depthOf(element) {
    let depth = 0;
    let node = element;
    while (node) {
      depth++;
      node = node.parentElement;
    }
    return depth;
  }
  function follows(a, b) {
    return (b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }
  let fallback = null;
  function dragManager() {
    const os = shell();
    if (os?.dragManager) {
      return os.dragManager;
    }
    if (!fallback) {
      fallback = new FallbackDragManager();
    }
    return fallback;
  }
  function buildPayload(type, source, data, origin, ghost) {
    const rect = source.getBoundingClientRect();
    if (ghost) {
      ghost.style.width = `${Math.round(rect.width)}px`;
      ghost.style.maxWidth = `${Math.round(rect.width)}px`;
      ghost.style.boxSizing = "border-box";
    }
    return {
      type,
      source,
      data,
      ghost: {
        element: ghost,
        offsetX: origin.clientX - rect.left,
        offsetY: origin.clientY - rect.top,
        hint: {
          neutral: "",
          accept: "",
          // Only the reject case earns a chip. "Drop here" over a target
          // the thing is visibly hovering says nothing the drop indicator
          // has not already said; "can't drop here" is information.
          reject: "",
          hidden: true
        }
      }
    };
  }
  function startDrag(event, opts) {
    if (event.button !== 0) {
      return null;
    }
    const target = event.target;
    const control2 = target?.closest(INTERACTIVE);
    if (control2 && control2 !== opts.payload.source) {
      return null;
    }
    return dragManager().start({ ...opts, origin: event });
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
  function getGroup(id) {
    return request(`groups/${id}`);
  }
  function saveGroup(group) {
    const path = group.id ? `groups/${group.id}` : "groups";
    return request(path, { method: "POST", body: JSON.stringify(group) }, "field-group-save");
  }
  function createContentType(type) {
    return request("content-types", { method: "POST", body: JSON.stringify(type) });
  }
  function deleteContentType(id) {
    return request(`content-types/${id}`, { method: "DELETE" });
  }
  function getModel() {
    return request("model");
  }
  const NEW_TYPE_FLAG = "allterrain-fields/open-new-type";
  const GROUP_TYPE = "allterrain-fields/group";
  const MODEL_TYPE = "allterrain-fields/model";
  const ATTACH_TIMEOUT_MS = 6e3;
  const ATTACH_POLL_MS = 120;
  let warned = false;
  const pending = /* @__PURE__ */ new WeakMap();
  const wanted = /* @__PURE__ */ new Map();
  function setIdentity(element, ref) {
    const api = shell()?.relations;
    wanted.set(element, ref);
    if (!api?.set) {
      return;
    }
    const token = Symbol("atcf-identity");
    const attempt = (deadline) => {
      if (pending.get(element) !== token) {
        return;
      }
      const id = windowIdOf(element);
      if (!id) {
        if (Date.now() < deadline) {
          window.setTimeout(() => attempt(deadline), ATTACH_POLL_MS);
        }
        return;
      }
      try {
        api.set?.(id, ref);
      } catch (error) {
        if (!warned) {
          warned = true;
          console.error("[AllTerrain Fields] The shell refused a window identity.", error, ref);
        }
        pending.delete(element);
        return;
      }
      const stuck = !ref || api.get?.(id)?.id === ref.id;
      if (stuck || Date.now() >= deadline) {
        pending.delete(element);
        return;
      }
      window.setTimeout(() => attempt(deadline), ATTACH_POLL_MS);
    };
    pending.set(element, token);
    attempt(Date.now() + ATTACH_TIMEOUT_MS);
  }
  function reapply() {
    for (const [element, ref] of wanted) {
      if (!element.isConnected) {
        wanted.delete(element);
        continue;
      }
      setIdentity(element, ref);
    }
  }
  if (typeof document !== "undefined") {
    for (const event of ["os-window-content-loaded", "os-window-opened"]) {
      document.addEventListener(event, () => reapply());
    }
  }
  function modelIdentity(groups) {
    return {
      type: MODEL_TYPE,
      id: "content-model",
      label: "Content model",
      links: groups.slice(0, 32).map((group) => ({
        type: GROUP_TYPE,
        id: group.id || group.key,
        rel: "references"
      }))
    };
  }
  const STORAGE_KEY = "allterrain-fields/model-layout";
  const TYPE_ICONS = [
    { value: "dashicons-portfolio", label: "Folder" },
    { value: "dashicons-food", label: "Food" },
    { value: "dashicons-admin-home", label: "Building" },
    { value: "dashicons-groups", label: "People" },
    { value: "dashicons-calendar-alt", label: "Calendar" },
    { value: "dashicons-cart", label: "Shop" },
    { value: "dashicons-location", label: "Place" },
    { value: "dashicons-book", label: "Book" },
    { value: "dashicons-format-gallery", label: "Pictures" },
    { value: "dashicons-hammer", label: "Work" },
    { value: "dashicons-tickets-alt", label: "Ticket" },
    { value: "dashicons-star-filled", label: "Star" }
  ];
  function plural(word) {
    const one = word.trim();
    if (!one) {
      return "";
    }
    if (/(s|x|z|ch|sh)$/i.test(one)) {
      return `${one}es`;
    }
    if (/[^aeiou]y$/i.test(one)) {
      return `${one.slice(0, -1)}ies`;
    }
    return `${one}s`;
  }
  class Model {
    constructor(root, focus = 0) {
      this.data = null;
      this.positions = {};
      this.selected = null;
      this.canvas = null;
      this.svg = null;
      this.showAll = false;
      this.focus = 0;
      this.root = root;
      this.focus = focus;
    }
    /**
     * Retargets the window onto another group.
     *
     * Called when the already-open window is asked for again with different
     * params — the shell focuses rather than re-renders, so the repaint is
     * this class's job. `0` clears the focus.
     *
     * @param focus Group id, or 0 for everything.
     */
    setFocus(focus) {
      if (focus === this.focus) {
        return;
      }
      this.focus = focus;
      this.drawBar();
      this.drawGraph();
    }
    /** Loads the model and paints it. */
    async start() {
      await componentsReady();
      this.positions = readLayout();
      try {
        this.data = await getModel();
      } catch (error) {
        clear(this.root);
        this.root.append(
          el("div", {
            class: "atcfm__error",
            children: [
              el("h2", { text: "The content model could not be read." }),
              el("p", { text: error instanceof Error ? error.message : String(error) })
            ]
          })
        );
        return;
      }
      this.drawBar();
      this.drawGraph();
      this.drawSide();
      shell()?.subscribe?.("os.allterrain-fields.new-content-type", () => this.drawTypeForm());
      try {
        if (window.sessionStorage.getItem(NEW_TYPE_FLAG)) {
          window.sessionStorage.removeItem(NEW_TYPE_FLAG);
          this.drawTypeForm();
        }
      } catch {
      }
      setIdentity(this.root, modelIdentity(this.data.groups.map((one) => ({ id: one.id, key: one.key }))));
    }
    /** The bar: a legend and a reset. */
    drawBar() {
      const bar = this.root.querySelector("[data-atcfm-bar]");
      if (!bar) {
        return;
      }
      clear(bar);
      const focused = this.focus ? this.data?.groups.find((one) => one.id === this.focus) : void 0;
      const total = this.data?.nodes.length ?? 0;
      const shown = this.visibleNodes().length;
      const hidden = total - shown;
      bar.append(
        el("div", {
          class: "atcfm__legend",
          children: [
            el("span", { class: "atcfm__legend-item atcfm__legend-item--one", text: "points at" }),
            el("span", { class: "atcfm__legend-item atcfm__legend-item--both", text: "mirrors both ways" }),
            el("span", { class: "atcfm__legend-item atcfm__legend-item--tax", text: "taxonomy" })
          ]
        }),
        el("p", {
          class: "atcfm__hint",
          text: (() => {
            if (focused) {
              return `Where “${focused.title}” appears — the types that carry it, and what its fields point at.`;
            }
            return this.showAll ? "Every type registered on this site. Drag a node to move it; drag its ⊕ handle onto another to join them." : "The types that have custom fields or a relationship. Drag a node to move it; drag its ⊕ handle onto another to join them.";
          })()
        }),
        // The primary action of this window, in its toolbar, where a primary
        // action belongs. It was buried in step 1 of a side panel — correct
        // as a *sequence*, invisible as a *button*.
        button("New post type", {
          variant: "primary",
          on: { click: () => this.drawTypeForm() }
        }),
        button("Tidy up", { on: { click: () => this.autoLayout() } })
      );
      if (focused) {
        bar.insertBefore(
          button("Show the whole model", {
            class: "atcfm__toggle",
            on: {
              click: () => this.setFocus(0)
            }
          }),
          bar.lastElementChild
        );
      }
      if (!focused && (hidden > 0 || this.showAll)) {
        bar.insertBefore(
          button(this.showAll ? "Only what I’ve built" : `Show all ${total}`, {
            class: "atcfm__toggle",
            on: {
              click: () => {
                this.showAll = !this.showAll;
                this.drawBar();
                this.drawGraph();
              }
            }
          }),
          bar.lastElementChild
        );
      }
    }
    /**
     * The nodes worth drawing.
     *
     * "Worth drawing" is: it carries custom fields, or something points at it, or
     * it points at something. Everything else is a type WordPress or a plugin
     * registered and nobody has modelled yet — real, but not part of the answer to
     * "what have I built".
     *
     * @return The nodes to draw.
     */
    visibleNodes() {
      if (!this.data) {
        return [];
      }
      if (this.focus) {
        const tied = nodesTiedToGroup(this.data, this.focus);
        if (tied.length) {
          return tied;
        }
      }
      if (this.showAll) {
        return this.data.nodes;
      }
      const joined = /* @__PURE__ */ new Set();
      this.data.edges.forEach((edge) => {
        edge.from.forEach((one) => joined.add(one));
        this.targetsOf(edge).forEach((one) => joined.add(one));
      });
      const kept = this.data.nodes.filter((node) => node.fields > 0 || joined.has(node.id));
      return kept.length ? kept : this.data.nodes;
    }
    /** The graph itself. */
    drawGraph() {
      const host = this.root.querySelector("[data-atcfm-canvas]");
      if (!host || !this.data) {
        return;
      }
      this.canvas = host;
      clear(host);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "atcfm__svg");
      host.append(svg);
      this.svg = svg;
      const nodes = this.visibleNodes();
      nodes.forEach((node) => host.append(this.nodeElement(node)));
      this.layout(nodes, host);
      this.drawEdges();
      const observer = new ResizeObserver(() => this.drawEdges());
      observer.observe(host);
      dragManager().registerDropTarget({
        id: `atcfm-canvas-${uid("c")}`,
        element: host,
        accept: () => false,
        onDrop: () => void 0
      });
    }
    /**
     * Places every node that has not been placed by hand.
     *
     * This replaced a circle, and the circle is worth describing because the
     * reasoning behind it was not wrong — evenly spaced points do minimise
     * crossings on a graph nobody has arranged. What it ignored is that nodes have
     * *width*. Twenty-one of them on a circle whose radius is bounded by the
     * window height gives about fifty pixels of arc each, and the labels are three
     * times that, so every node sat on top of its neighbours and the one edge in
     * the graph was drawn underneath the pile. The diagram was unreadable, and it
     * was unreadable in a way that looked like a bug in the data rather than in
     * the arrangement.
     *
     * What is here instead is deliberately dull and always legible:
     *
     * 1. Anything joined by an edge is laid out in **columns by distance** from
     *    the most connected node in its group — so an arrow reads left to right,
     *    which is the direction people expect a "points at" to run.
     * 2. Everything unconnected is packed into a **grid** underneath, in reading
     *    order.
     * 3. Both use measured widths and a fixed gutter, so nothing ever overlaps.
     *
     * Hand-placed nodes are never moved. A content model is a diagram somebody
     * arranged to make sense of it, and a layout that rearranges it on every load
     * is a diagram nobody arranges twice.
     *
     * @param nodes The nodes on the canvas.
     * @param host  The canvas.
     */
    layout(nodes, host) {
      const GAP_X = 60;
      const GAP_Y = 26;
      const MARGIN = 40;
      const width = host.clientWidth || 900;
      const box = {};
      nodes.forEach((node) => {
        const element = host.querySelector(`[data-node="${CSS.escape(node.id)}"]`);
        box[node.id] = {
          w: element?.offsetWidth || 170,
          h: element?.offsetHeight || 44
        };
      });
      const place = (node, x2, y2) => {
        this.positions[node.id] = { x: Math.round(x2), y: Math.round(y2) };
        const element = host.querySelector(`[data-node="${CSS.escape(node.id)}"]`);
        if (element) {
          element.style.left = `${Math.round(x2)}px`;
          element.style.top = `${Math.round(y2)}px`;
        }
      };
      const onCanvas = new Set(nodes.map((node) => node.id));
      const links = {};
      nodes.forEach((node) => {
        links[node.id] = /* @__PURE__ */ new Set();
      });
      (this.data?.edges ?? []).forEach((edge) => {
        edge.from.forEach((from) => {
          this.targetsOf(edge).forEach((to) => {
            if (from === to || !onCanvas.has(from) || !onCanvas.has(to)) {
              return;
            }
            links[from].add(to);
            links[to].add(from);
          });
        });
      });
      const joined = nodes.filter((node) => links[node.id].size > 0);
      const loose = nodes.filter((node) => links[node.id].size === 0);
      const done = /* @__PURE__ */ new Set();
      const byId = {};
      nodes.forEach((node) => {
        byId[node.id] = node;
      });
      let y = MARGIN;
      joined.forEach((start) => {
        if (done.has(start.id)) {
          return;
        }
        const group = [];
        const queue = [start.id];
        done.add(start.id);
        while (queue.length) {
          const id = queue.shift();
          group.push(id);
          links[id].forEach((next) => {
            if (!done.has(next)) {
              done.add(next);
              queue.push(next);
            }
          });
        }
        const root = group.slice().sort((a, b) => links[b].size - links[a].size)[0];
        const rank = { [root]: 0 };
        const walk = [root];
        while (walk.length) {
          const id = walk.shift();
          links[id].forEach((next) => {
            if (void 0 === rank[next]) {
              rank[next] = rank[id] + 1;
              walk.push(next);
            }
          });
        }
        const columns = [];
        group.forEach((id) => {
          const depth = rank[id] ?? 0;
          columns[depth] = columns[depth] ?? [];
          columns[depth].push(id);
        });
        let x2 = MARGIN;
        let tallest = 0;
        columns.forEach((column) => {
          const height = column.reduce((sum, id) => sum + box[id].h + GAP_Y, -GAP_Y);
          const widest = column.reduce((most, id) => Math.max(most, box[id].w), 0);
          let top = y + Math.max(0, (columnsHeight(columns, box, GAP_Y) - height) / 2);
          column.forEach((id) => {
            place(byId[id], x2 + (widest - box[id].w) / 2, top);
            top += box[id].h + GAP_Y;
          });
          x2 += widest + GAP_X;
          tallest = Math.max(tallest, height);
        });
        y += tallest + GAP_Y * 2;
      });
      let x = MARGIN;
      loose.forEach((node) => {
        if (x > MARGIN && x + box[node.id].w > width - MARGIN) {
          x = MARGIN;
          y += box[node.id].h + GAP_Y;
        }
        place(node, x, y);
        x += box[node.id].w + GAP_X / 2;
      });
    }
    /** Re-runs the layout over everything and saves it. */
    autoLayout() {
      if (!this.data || !this.canvas) {
        return;
      }
      this.positions = {};
      writeLayout(this.positions);
      this.drawGraph();
      writeLayout(this.positions);
    }
    /** One node. */
    nodeElement(node) {
      const at = this.positions[node.id] ?? { x: 40, y: 40 };
      const summary = node.fields ? `${node.fields} field${1 === node.fields ? "" : "s"}` : "No fields yet";
      const actions = el("div", { class: "atcfm__node-actions" });
      const element = el("div", {
        class: `atcfm__node atcfm__node--${node.kind}${node.fields ? " is-built" : ""}`,
        attrs: {
          tabindex: "0",
          role: "group",
          "aria-label": `${node.label}: ${summary}, ${node.count} item${1 === node.count ? "" : "s"}`
        },
        dataset: { node: node.id },
        style: { left: `${at.x}px`, top: `${at.y}px` },
        children: [
          el("div", {
            class: "atcfm__node-head",
            children: [
              icon(node.icon, { class: "atcfm__node-icon" }),
              el("span", { class: "atcfm__node-label", text: node.label }),
              el("span", {
                class: "atcfm__node-count",
                text: String(node.count),
                attrs: { title: `${node.count} ${node.label.toLowerCase()} on this site` }
              }),
              actions
            ]
          }),
          // The body of a class-diagram box: what one of these actually
          // holds, by meta key and type. The meta key rather than the
          // label, because the meta key is what a theme writes in
          // `get_post_meta()` — which is the question somebody squints at a
          // content model to answer.
          node.list.length ? el("div", {
            class: "atcfm__node-list",
            children: node.list.map(
              (field) => el("div", {
                class: `atcfm__node-field${field.sub ? " is-sub" : ""}`,
                attrs: { title: `${field.label} — ${field.type}` },
                children: [
                  el("span", { class: "atcfm__node-field-name", text: field.name }),
                  el("span", { class: "atcfm__node-field-type", text: field.type })
                ]
              })
            )
          }) : null,
          node.fields > node.list.length ? el("span", {
            class: "atcfm__node-more",
            text: `and ${node.fields - node.list.length} more`
          }) : null,
          el("span", {
            class: "atcfm__node-fields",
            text: node.groups.length ? `${summary} · ${node.groups.map((one) => one.title).join(", ")}` : summary
          })
        ]
      });
      const handle = el("button", {
        class: "atcfm__node-handle",
        text: "⊕",
        attrs: {
          type: "button",
          title: `Drag this onto another box to link ${node.label} to it`,
          "aria-label": `Join ${node.label} to something`
        }
      });
      actions.append(handle);
      if (node.own) {
        actions.append(
          el("button", {
            class: "atcfm__node-remove",
            text: "×",
            attrs: {
              type: "button",
              title: `Remove ${node.label}`,
              "aria-label": `Remove the ${node.label} content type`
            },
            on: {
              click: (event) => {
                event.stopPropagation();
                void this.removeType(node);
              }
            }
          })
        );
      }
      element.addEventListener("pointerdown", (event) => {
        if (event.target.closest(".atcfm__node-actions")) {
          return;
        }
        event.preventDefault();
        element.setPointerCapture(event.pointerId);
        const rect = element.getBoundingClientRect();
        const canvasRect = this.canvas?.getBoundingClientRect() ?? rect;
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        const onMove = (move) => {
          const x = Math.max(0, move.clientX - canvasRect.left - offsetX);
          const y = Math.max(0, move.clientY - canvasRect.top - offsetY);
          this.positions[node.id] = { x: Math.round(x), y: Math.round(y) };
          element.style.left = `${x}px`;
          element.style.top = `${y}px`;
          this.drawEdges();
        };
        const onUp = () => {
          element.removeEventListener("pointermove", onMove);
          element.removeEventListener("pointerup", onUp);
          writeLayout(this.positions);
        };
        element.addEventListener("pointermove", onMove);
        element.addEventListener("pointerup", onUp);
      });
      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture(event.pointerId);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
        line.setAttribute("class", "atcfm__edge atcfm__edge--drawing");
        this.svg?.append(line);
        const onMove = (move) => {
          const canvasRect = this.canvas?.getBoundingClientRect();
          if (!canvasRect) {
            return;
          }
          const towards = {
            x: move.clientX - canvasRect.left,
            y: move.clientY - canvasRect.top
          };
          const from = this.edgeOf(this.boxOf(node.id), towards);
          line.setAttribute("d", `M ${from.x} ${from.y} L ${towards.x} ${towards.y}`);
        };
        const onUp = (up) => {
          handle.removeEventListener("pointermove", onMove);
          handle.removeEventListener("pointerup", onUp);
          line.remove();
          const dropped = document.elementFromPoint(up.clientX, up.clientY);
          const target = dropped?.closest("[data-node]");
          if (target && target.dataset.node && target.dataset.node !== node.id) {
            void this.proposeRelationship(node.id, target.dataset.node);
          }
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
      });
      dragManager().registerDropTarget({
        id: `atcfm-node-${node.id}`,
        element,
        accept: (payload) => payload.type === config().dragTypes.group && node.kind === "post_type",
        onEnter: () => element.classList.add("is-drop-target"),
        onLeave: () => element.classList.remove("is-drop-target"),
        onDrop: (session) => {
          element.classList.remove("is-drop-target");
          const id = Number(session.payload.data.id ?? 0);
          if (id) {
            void this.assignGroup(id, node.id);
          }
        }
      });
      return element;
    }
    /**
     * Removes a content type made here.
     *
     * The confirmation leads with what *survives*, because the fear is the other
     * thing. Somebody removing a type they named wrongly a minute ago should not
     * have to guess whether the forty entries under it are about to go with it —
     * they are not, and saying so is the difference between a button people use
     * and a button people avoid.
     *
     * @param node The node to remove.
     */
    async removeType(node) {
      const kept = node.count ? `The ${node.count} ${node.count === 1 ? "entry" : "entries"} already stored stay exactly where they are — remake it with the same name and they all come back.` : "Nothing is stored under it yet, so there is nothing to lose.";
      const yes = await confirm(`Remove “${node.label}”? ${kept}`, {
        title: `Remove ${node.label}?`,
        confirmLabel: "Remove",
        danger: true
      });
      if (!yes) {
        return;
      }
      try {
        await deleteContentType(node.own);
        this.data = await getModel();
      } catch (error) {
        notify("That would not delete.", error instanceof Error ? error.message : "", "error");
        return;
      }
      delete this.positions[node.id];
      this.drawBar();
      this.drawGraph();
      this.drawSide();
      notify(`“${node.label}” removed.`, node.count ? "Its entries are untouched." : "", "success");
    }
    /** Where an edge attaches to a node — its centre. */
    anchorOf(id) {
      const box = this.boxOf(id);
      return { x: box.x, y: box.y };
    }
    /**
     * A node's centre and half-extent, in canvas coordinates.
     *
     * The half-extent is what lets an edge stop at the *border* of a box rather
     * than running to its middle and disappearing underneath it — see
     * {@link edgeOf}.
     *
     * @param id The node id.
     * @return Centre and half-size.
     */
    boxOf(id) {
      const element = this.canvas?.querySelector(`[data-node="${CSS.escape(id)}"]`);
      if (!element || !this.canvas) {
        return { x: 0, y: 0, hw: 0, hh: 0 };
      }
      const rect = element.getBoundingClientRect();
      const canvasRect = this.canvas.getBoundingClientRect();
      return {
        x: rect.left - canvasRect.left + rect.width / 2,
        y: rect.top - canvasRect.top + rect.height / 2,
        hw: rect.width / 2,
        hh: rect.height / 2
      };
    }
    /**
     * Where a line leaving a box crosses its border.
     *
     * Edges used to be drawn centre to centre, which put both endpoints
     * underneath the boxes they joined. On a pill that was survivable — the line
     * vanished for twenty pixels and came back. On a card listing ten fields the
     * arrowhead lands somewhere in the middle of the field list, and the diagram
     * reads as a line drawn *through* a box rather than *to* it.
     *
     * The maths is the standard ray-to-rectangle clip: walk out from the centre
     * along the direction of travel until whichever of the two half-extents is
     * reached first. A few pixels of clearance are left so the arrowhead sits
     * beside the border rather than on it.
     *
     * @param box     The node's centre and half-size.
     * @param towards The point the line is heading for.
     * @param gap     Clearance, in pixels.
     * @return The point on the border.
     */
    edgeOf(box, towards, gap = 6) {
      const dx = towards.x - box.x;
      const dy = towards.y - box.y;
      if (!dx && !dy) {
        return { x: box.x, y: box.y };
      }
      const scale = Math.min(
        box.hw / (Math.abs(dx) || Number.EPSILON),
        box.hh / (Math.abs(dy) || Number.EPSILON)
      );
      const length = Math.hypot(dx, dy) || 1;
      return {
        x: box.x + dx * scale + dx / length * gap,
        y: box.y + dy * scale + dy / length * gap
      };
    }
    /** Draws every edge. */
    drawEdges() {
      if (!this.svg || !this.data || !this.canvas) {
        return;
      }
      const svg = this.svg;
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
      }
      svg.setAttribute("width", String(this.canvas.clientWidth));
      svg.setAttribute("height", String(this.canvas.clientHeight));
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      defs.innerHTML = '<marker id="atcfm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>';
      svg.append(defs);
      const seen = /* @__PURE__ */ new Map();
      const drawn = /* @__PURE__ */ new Set();
      const edges = this.data.edges.filter((edge) => {
        if (!edge.bidirectional || !edge.mirror) {
          return true;
        }
        if (drawn.has(edge.field)) {
          return false;
        }
        drawn.add(edge.mirror);
        return true;
      });
      edges.forEach((edge) => {
        this.targetsOf(edge).forEach((target) => {
          edge.from.forEach((source) => {
            const from = source === "*" ? null : this.anchorOf(source);
            const to = target === "*" ? null : this.anchorOf(target);
            if (!from || !to || from.x === 0 && from.y === 0 || to.x === 0 && to.y === 0) {
              return;
            }
            const pair = [source, target].sort().join("|");
            const nth = (seen.get(pair) ?? 0) + 1;
            seen.set(pair, nth);
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            if (source === target) {
              const loop = 42;
              const box = this.boxOf(source);
              const top = box.y - box.hh - 2;
              path.setAttribute(
                "d",
                `M ${box.x - 18} ${top} C ${box.x - loop} ${top - loop * 1.4}, ${box.x + loop} ${top - loop * 1.4}, ${box.x + 18} ${top}`
              );
              path.setAttribute(
                "class",
                `atcfm__edge atcfm__edge--${edge.kind}${edge.bidirectional ? " atcfm__edge--both" : ""}`
              );
              path.setAttribute("marker-end", "url(#atcfm-arrow)");
              path.addEventListener("click", () => this.selectEdge(edge));
              svg.append(path);
              const selfLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
              selfLabel.setAttribute("class", "atcfm__edge-label");
              selfLabel.setAttribute("x", String(box.x));
              selfLabel.setAttribute("y", String(top - loop - 6));
              selfLabel.textContent = edge.label;
              selfLabel.addEventListener("click", () => this.selectEdge(edge));
              svg.append(selfLabel);
              return;
            }
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.hypot(dx, dy) || 1;
            const orientation = source <= target ? 1 : -1;
            const bow = orientation * (nth % 2 === 0 ? -1 : 1) * Math.ceil(nth / 2) * 34;
            const controlX = midX + -dy / length * bow;
            const controlY = midY + dx / length * bow;
            const start = this.edgeOf(this.boxOf(source), { x: controlX, y: controlY });
            const end = this.edgeOf(this.boxOf(target), { x: controlX, y: controlY }, 10);
            path.setAttribute("d", `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`);
            path.setAttribute(
              "class",
              `atcfm__edge atcfm__edge--${edge.kind}${edge.bidirectional ? " atcfm__edge--both" : ""}`
            );
            path.setAttribute("marker-end", "url(#atcfm-arrow)");
            if (edge.bidirectional) {
              path.setAttribute("marker-start", "url(#atcfm-arrow)");
            }
            path.addEventListener("click", () => this.selectEdge(edge));
            svg.append(path);
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("class", "atcfm__edge-label");
            label.setAttribute("x", String(controlX));
            label.setAttribute("y", String(controlY));
            label.textContent = edge.label;
            label.addEventListener("click", () => this.selectEdge(edge));
            svg.append(label);
          });
        });
      });
    }
    /** The node ids an edge points at. */
    targetsOf(edge) {
      if (edge.kind === "user") {
        return ["user"];
      }
      return edge.to;
    }
    /** Shows an edge in the side panel. */
    selectEdge(edge) {
      this.selected = edge;
      this.drawSide();
    }
    /** The side panel: the field groups, and whatever edge is selected. */
    drawSide() {
      const host = this.root.querySelector("[data-atcfm-side]");
      if (!host || !this.data) {
        return;
      }
      clear(host);
      if (this.selected) {
        const edge = this.selected;
        host.append(
          el("div", {
            class: "atcfm__detail",
            children: [
              el("h2", { text: edge.label }),
              el("dl", {
                class: "atcfm__detail-list",
                children: [
                  el("dt", { text: "Field" }),
                  el("dd", { text: `${edge.name} (${edge.type})` }),
                  el("dt", { text: "In" }),
                  el("dd", { text: edge.group_title }),
                  el("dt", { text: "From" }),
                  el("dd", { text: edge.from.join(", ") }),
                  el("dt", { text: "To" }),
                  el("dd", { text: edge.to.join(", ") }),
                  el("dt", { text: "Mirrored" }),
                  el("dd", { text: edge.bidirectional ? "Yes, both ways" : "No, one way" })
                ]
              }),
              button("Open in the builder", {
                on: { click: () => openBuilder(edge.group_id) }
              }),
              button("Clear selection", {
                on: {
                  click: () => {
                    this.selected = null;
                    this.drawSide();
                  }
                }
              })
            ]
          })
        );
        return;
      }
      host.append(
        el("div", {
          class: "atcfm__explain",
          children: [
            el("h2", { text: "What this shows" }),
            el("p", {
              text: "Every box is a post type, a taxonomy or the people on your site. A line between two boxes means one points at the other."
            }),
            el("p", {
              text: "A box lights up when it has custom fields on it. That is the part you build."
            })
          ]
        })
      );
      host.append(
        el("div", {
          class: "atcfm__step",
          children: [
            el("span", { class: "atcfm__step-number", text: "1" }),
            el("div", {
              class: "atcfm__step-body",
              children: [
                el("h3", { text: "Create a custom post type" }),
                el("p", {
                  // The real name, with the explanation kept. Calling
                  // it "a kind of thing" was meant to be welcoming and
                  // was really just vague — it left somebody unable to
                  // search for their own problem, because every answer
                  // on the web says "custom post type".
                  text: "A post type is a kind of content your site holds. Posts and Pages are the two WordPress ships with; Recipes, Properties or Staff are ones you add."
                }),
                button("New post type", {
                  class: "atcfm__new-type",
                  variant: "primary",
                  on: { click: () => this.drawTypeForm() }
                })
              ]
            })
          ]
        })
      );
      host.append(
        el("div", {
          class: "atcfm__step",
          children: [
            el("span", { class: "atcfm__step-number", text: "2" }),
            el("div", {
              class: "atcfm__step-body",
              children: [
                el("h3", { text: "Say what it holds" }),
                el("p", {
                  text: this.data.groups.length ? "Drag one of these onto a box to put its fields there. Click it to open the builder." : "A field group is a set of fields. There are none yet — open Fields → Field Groups and start from a template."
                })
              ]
            })
          ]
        })
      );
      const list = el("div", { class: "atcfm__groups", attrs: { role: "list" } });
      this.data.groups.forEach((group) => list.append(this.groupTile(group)));
      host.append(list);
    }
    /**
     * The form for making a custom post type.
     *
     * Two required words and four switches. `register_post_type()` takes forty
     * arguments and asking about them is how a person making their first content
     * type decides this is not for them — the slug, the seventeen labels, the
     * archive rules and the capability mapping are all worked out from the two
     * words on the server.
     *
     * Every switch is phrased as a question about the content, not about the
     * `register_post_type()` argument behind it: "Visitors can see these on the
     * site" rather than `public`. Somebody who has never registered a post type
     * has no idea what `public` means and every idea what the question means.
     *
     * The *name* of the thing, though, is the real one. Calling a post type "a
     * kind of thing" was meant to be welcoming and was really just vague — it
     * leaves somebody unable to search for their own problem, because every
     * answer on the web says "custom post type".
     */
    drawTypeForm() {
      const host = this.root.querySelector("[data-atcfm-side]");
      if (!host) {
        return;
      }
      clear(host);
      const draft = {
        singular: "",
        plural: "",
        icon: "dashicons-portfolio",
        public: true,
        hierarchical: false,
        thumbnail: true,
        editor: true
      };
      const singular = textField("", { attrs: { placeholder: "Recipe" } }, (value) => {
        draft.singular = value;
        if (!touched) {
          draft.plural = plural(value);
          pluralField.value = draft.plural;
        }
      });
      let touched = false;
      const pluralField = textField("", { attrs: { placeholder: "Recipes" } }, (value) => {
        touched = true;
        draft.plural = value;
      });
      const message = el("p", { class: "atcfm__form-error" });
      host.append(
        el("div", {
          class: "atcfm__form",
          children: [
            el("h2", { text: "New custom post type" }),
            el("p", {
              class: "atcfm__form-lead",
              text: "It gets its own menu item, its own list, and its own place to add fields. Nothing here is permanent — you can remove it later and whatever you stored stays put."
            }),
            el("div", {
              class: "atcfm__form-row",
              children: [
                el("label", { class: "atcfm__form-label", text: "What is one of them called?" }),
                singular,
                el("p", { class: "atcfm__form-hint", text: "Singular. “Recipe”, not “Recipes”." })
              ]
            }),
            el("div", {
              class: "atcfm__form-row",
              children: [
                el("label", { class: "atcfm__form-label", text: "And more than one?" }),
                pluralField,
                el("p", { class: "atcfm__form-hint", text: "This is what the menu will say." })
              ]
            }),
            el("div", {
              class: "atcfm__form-row",
              children: [
                el("label", { class: "atcfm__form-label", text: "Icon" }),
                select(
                  draft.icon,
                  TYPE_ICONS,
                  (value) => {
                    draft.icon = value;
                  }
                )
              ]
            }),
            // One bordered list, not four loose switches. Stacked bare they
            // ran together as a single block of grey text and there was
            // nothing to say which sentence belonged to which switch.
            el("div", {
              class: "atcfm__switches",
              children: [
                // `description` rather than a paragraph underneath. The kit's
                // switch renders a second line under its own label, keyed to
                // the same control — so the sentence explaining what *off*
                // means is part of the thing it explains rather than a
                // sibling that happens to sit below it.
                toggle(
                  true,
                  "Visitors can see these on the site",
                  (on) => {
                    draft.public = on;
                  },
                  {
                    block: true,
                    description: "Off means they exist in the admin only — useful for internal records."
                  }
                ),
                toggle(
                  true,
                  "They have a main body of text",
                  (on) => {
                    draft.editor = on;
                  },
                  {
                    block: true,
                    description: "Off if this is only fields — a staff record, a product spec."
                  }
                ),
                toggle(
                  true,
                  "They have a main image",
                  (on) => {
                    draft.thumbnail = on;
                  },
                  { block: true }
                ),
                toggle(
                  false,
                  "They nest inside each other",
                  (on) => {
                    draft.hierarchical = on;
                  },
                  { block: true, description: "Like pages, where one can sit under another." }
                )
              ]
            }),
            message,
            el("div", {
              class: "atcfm__form-actions",
              children: [
                button("Create it", {
                  variant: "primary",
                  class: "atcfm__form-go",
                  on: { click: () => void this.createType(draft, message) }
                }),
                button("Cancel", { on: { click: () => this.drawSide() } })
              ]
            })
          ]
        })
      );
    }
    /**
     * Creates the type, then redraws the graph with it on.
     *
     * The server registers it inside the same request, so the model that comes
     * back already contains the new node — there is no reload, and the thing you
     * just named is on the canvas before you have finished reading the notice.
     *
     * @param draft   What the form collected.
     * @param message Where to put a refusal.
     */
    async createType(draft, message) {
      message.textContent = "";
      if (!String(draft.singular ?? "").trim()) {
        message.textContent = "It needs a name first — what is one of them called?";
        return;
      }
      let created;
      try {
        created = await createContentType(draft);
      } catch (error) {
        message.textContent = error instanceof Error ? error.message : String(error);
        return;
      }
      try {
        this.data = await getModel();
      } catch {
      }
      this.drawBar();
      this.drawGraph();
      this.drawSide();
      notify(
        `${created.plural} is ready.`,
        "It is in the admin menu now. Put a field group on it to say what one holds.",
        "success"
      );
    }
    /** A draggable field group tile. */
    groupTile(group) {
      const tile = el("div", {
        class: `atcfm__group${group.active ? "" : " is-off"}`,
        attrs: { role: "listitem", tabindex: "0" },
        children: [
          icon("dashicons-index-card"),
          el("span", { class: "atcfm__group-title", text: group.title }),
          el("span", { class: "atcfm__group-meta", text: `${group.fields} · ${group.location}` })
        ]
      });
      tile.addEventListener("pointerdown", (event) => {
        const ghost = el("div", { class: "atcf-drag-ghost atcf-drag-ghost--group", text: group.title });
        startDrag(event, {
          payload: buildPayload(
            config().dragTypes.group,
            tile,
            { id: group.id, key: group.key, title: group.title },
            event,
            ghost
          ),
          origin: event,
          onClickOnly: () => openBuilder(group.id),
          onCancel: () => void 0
        });
      });
      return tile;
    }
    /**
     * Adds a location rule putting a group on a post type.
     *
     * Appended as a new OR clause rather than merged into an existing one. "Also
     * show this on Products" is an *or*, and folding it into an existing AND
     * clause would produce "Pages that are also Products", which matches nothing
     * — and looks, from the outside, exactly like the drop having failed.
     *
     * @param id       The group's post id.
     * @param postType The node's slug.
     */
    async assignGroup(id, postType) {
      try {
        const group = await getGroup(id);
        const already = group.location.some(
          (clause) => clause.some((rule) => rule.param === "post_type" && rule.operator === "==" && rule.value === postType)
        );
        if (already) {
          notify(`“${group.title}” is already on ${postType}.`, "", "info");
          return;
        }
        group.location = [...group.location, [{ param: "post_type", operator: "==", value: postType }]];
        await saveGroup(group);
        notify(`“${group.title}” now appears on ${postType}.`, "", "success");
        this.data = await getModel();
        this.drawGraph();
        this.drawSide();
      } catch (error) {
        notify("That could not be assigned.", error instanceof Error ? error.message : "", "error");
      }
    }
    /**
     * Offers to create a relationship field joining two nodes.
     *
     * The panel asks three things and no more: which group the field goes in,
     * what it is called, and whether it mirrors. Everything else is derivable —
     * the target post types are the node you dropped on, the field type is a
     * relationship, the name is a slug of the label.
     *
     * @param from The node the drag started on.
     * @param to   The node it ended on.
     */
    async proposeRelationship(from, to) {
      if (!this.data) {
        return;
      }
      const host = this.root.querySelector("[data-atcfm-side]");
      if (!host) {
        return;
      }
      const fromNode = this.data.nodes.find((one) => one.id === from);
      const toNode = this.data.nodes.find((one) => one.id === to);
      if (!fromNode || !toNode || fromNode.kind !== "post_type") {
        notify("A relationship has to start from a post type.", "", "info");
        return;
      }
      const candidates = this.data.groups.filter(
        (group) => !group.local && (group.types.includes(from) || group.types.includes("*"))
      );
      clear(host);
      let label = `Related ${toNode.label.toLowerCase()}`;
      let groupId = candidates[0]?.id ?? 0;
      let mirrored = false;
      const labelInput = textField(label, {}, (value) => {
        label = value;
      });
      host.append(
        el("div", {
          class: "atcfm__propose",
          children: [
            el("h2", { text: `Join ${fromNode.label} to ${toNode.label}` }),
            el("p", {
              class: "atcfm__propose-note",
              text: "This adds a relationship field. Nothing is written until you press Create."
            }),
            el("label", { class: "atcfm__row", children: [el("span", { text: "Called" }), labelInput] }),
            candidates.length ? el("label", {
              class: "atcfm__row",
              children: [
                el("span", { text: "In the group" }),
                select(
                  String(groupId),
                  candidates.map((group) => ({ value: String(group.id), label: group.title })),
                  (value) => {
                    groupId = Number(value);
                  }
                )
              ]
            }) : el("p", {
              class: "atcfm__propose-warning",
              text: `No field group appears on ${fromNode.label} yet. Make one first, or drag an existing group onto that node.`
            }),
            el("label", {
              class: "atcfm__row atcfm__row--check",
              children: [
                (() => {
                  const box = el("input", { attrs: { type: "checkbox" } });
                  box.addEventListener("change", () => {
                    mirrored = box.checked;
                  });
                  return box;
                })(),
                el("span", { text: `Also add the other side on ${toNode.label}` })
              ]
            }),
            el("div", {
              class: "atcfm__propose-actions",
              children: [
                button("Create", {
                  attrs: { disabled: candidates.length ? null : true },
                  on: { click: () => void this.createRelationship(groupId, label, to, mirrored, from) }
                }),
                button("Cancel", { on: { click: () => this.drawSide() } })
              ]
            })
          ]
        })
      );
    }
    /**
     * Writes the relationship field, and its mirror when asked.
     *
     * The mirror is created in a group that appears on the *target* type, and
     * the two fields name each other's keys. That is a two-step save with a
     * dependency in both directions — the first field does not know its mirror's
     * key yet — so the first is saved, its key read back, the second created,
     * and the first patched. Doing it in one pass is what makes half-formed
     * mirrors, which are worse than none: the far side points home and home
     * points nowhere.
     *
     * @param groupId  Which group takes the field.
     * @param label    What it is called.
     * @param target   The node it points at.
     * @param mirrored Whether to create the far side.
     * @param source   The node it starts from.
     */
    async createRelationship(groupId, label, target, mirrored, source) {
      try {
        const group = await getGroup(groupId);
        const isTaxonomy = target.startsWith("taxonomy:");
        const isUser = target === "user";
        const field = {
          key: "",
          name: slug(label),
          label,
          type: isUser ? "user" : isTaxonomy ? "taxonomy" : "relationship",
          instructions: "",
          required: false,
          readonly: false,
          wrapper: { width: 100, class: "", id: "" },
          conditional: { enabled: false, action: "show", match: "all", rules: [] },
          settings: isTaxonomy ? { taxonomy: target.replace("taxonomy:", ""), multiple: true } : isUser ? { multiple: true } : { post_types: [target], bidirectional: false, mirror: "" }
        };
        group.fields.push(field);
        const saved = await saveGroup(group);
        const created = saved.fields[saved.fields.length - 1];
        if (!mirrored || isTaxonomy || isUser) {
          await this.refresh(`“${label}” added to ${group.title}.`);
          return;
        }
        const targetGroup = this.data?.groups.find(
          (one) => !one.local && (one.types.includes(target) || one.types.includes("*"))
        );
        if (!targetGroup) {
          await this.refresh(
            `“${label}” added, but nothing on ${target} could hold the other side — no field group appears there yet.`
          );
          return;
        }
        const far = await getGroup(targetGroup.id);
        far.fields.push({
          key: "",
          name: slug(`Related ${source}`),
          label: `Related ${source}`,
          type: "relationship",
          instructions: "",
          required: false,
          readonly: false,
          wrapper: { width: 100, class: "", id: "" },
          conditional: { enabled: false, action: "show", match: "all", rules: [] },
          settings: { post_types: [source], bidirectional: true, mirror: created.key }
        });
        const farSaved = await saveGroup(far);
        const farField = farSaved.fields[farSaved.fields.length - 1];
        const home = await getGroup(groupId);
        const homeField = home.fields.find((one) => one.key === created.key);
        if (homeField) {
          homeField.settings = { ...homeField.settings, bidirectional: true, mirror: farField.key };
          await saveGroup(home);
        }
        await this.refresh(`“${label}” added, mirrored on ${target}.`);
      } catch (error) {
        notify("That relationship could not be created.", error instanceof Error ? error.message : "", "error");
      }
    }
    /** Reloads the model and redraws. */
    async refresh(message) {
      notify(message, "", "success");
      this.data = await getModel();
      this.selected = null;
      this.drawGraph();
      this.drawSide();
    }
  }
  function columnsHeight(columns, box, gap) {
    return columns.reduce((most, column) => {
      const height = column.reduce((sum, id) => sum + box[id].h + gap, -gap);
      return Math.max(most, height);
    }, 0);
  }
  function nodesTiedToGroup(data, group) {
    const tied = /* @__PURE__ */ new Set();
    data.nodes.forEach((node) => {
      if (node.groups.some((one) => one.id === group)) {
        tied.add(node.id);
      }
    });
    data.edges.forEach((edge) => {
      if (edge.group_id !== group) {
        return;
      }
      edge.from.forEach((one) => tied.add(one));
      (edge.kind === "user" ? ["user"] : edge.to).forEach((one) => tied.add(one));
    });
    return data.nodes.filter((node) => tied.has(node.id));
  }
  function openBuilder(id) {
    const os = window.wp?.os;
    if (os?.openWindow) {
      os.openWindow("allterrain-fields");
      document.dispatchEvent(new CustomEvent("atcf:open-group", { detail: { id } }));
      return;
    }
    window.location.href = `${config().adminUrl}admin.php?page=allterrain-fields&group=${id}`;
  }
  function slug(value) {
    return value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  }
  function readLayout() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch {
      return {};
    }
  }
  function writeLayout(positions) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    } catch {
    }
  }
  function mount(body, focus = 0) {
    const root = body.querySelector("[data-atcfm-root]") ?? body;
    if (root.dataset.atcfmMounted === "1") {
      return null;
    }
    root.dataset.atcfmMounted = "1";
    const model = new Model(root, focus);
    void model.start();
    return model;
  }
  const MODEL_WINDOW = "allterrain-fields-model";
  let standalone = null;
  const globals = window;
  globals.openStationNativeWindows = globals.openStationNativeWindows ?? {};
  {
    const prev = globals.openStationNativeWindows[FAMILY_WINDOW];
    globals.openStationNativeWindows[FAMILY_WINDOW] = (body) => {
      prev?.(body);
      mount(body);
      if (shell()?.getWindowParams?.(FAMILY_WINDOW)?.tab === "model") {
        activateFamilyTab("model");
      }
    };
  }
  globals.openStationNativeWindows[MODEL_WINDOW] = (body) => {
    const focus = Number(shell()?.getWindowParams?.(MODEL_WINDOW)?.group) || 0;
    const model = mount(body, focus);
    if (model) {
      standalone = model;
    }
  };
  if (typeof document !== "undefined") {
    whenShellReady(() => {
      document.querySelectorAll("[data-atcfm-root]").forEach((root) => {
        if (!shellIsActive() || !root.closest(".os-window")) {
          mount(root);
        }
      });
    });
    document.addEventListener("os-window-reopened", (event) => {
      if (event.detail?.baseId !== MODEL_WINDOW) {
        return;
      }
      standalone?.setFocus(Number(shell()?.getWindowParams?.(MODEL_WINDOW)?.group) || 0);
    });
  }
  exports.nodesTiedToGroup = nodesTiedToGroup;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
}({});
