var allTerrainFieldsBuilder = function(exports) {
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
  const DESKTOP_PAYLOAD_TYPES = ["shortcut", "desktop-file", "openstation/file", "desktop-mode/file"];
  function isDesktopPayload(payload) {
    return DESKTOP_PAYLOAD_TYPES.includes(payload.type);
  }
  function entitiesIn(payload) {
    const usable = (entity) => entity.kind !== "" && entity.ref !== "";
    if (payload.type === "shortcut") {
      const data2 = payload.data;
      const items = data2.items?.length ? data2.items : [data2];
      return items.map(toEntity).filter(usable);
    }
    if (payload.type === "desktop-file") {
      const data2 = payload.data;
      const list = data2.placements?.length ? data2.placements : [data2.placement];
      return list.map(
        (placement) => toEntity({
          kind: placement?.file?.type,
          ref: placement?.file?.ref,
          title: placement?.file?.title,
          thumbnail: placement?.file?.thumbnail
        })
      ).filter(usable);
    }
    const data = payload.data;
    return [toEntity(data)].filter(usable);
  }
  function toEntity(item) {
    return {
      kind: String(item?.kind ?? item?.type ?? ""),
      ref: String(item?.ref ?? item?.id ?? ""),
      title: String(item?.title ?? "").trim(),
      thumbnail: item?.thumbnail ? String(item.thumbnail) : void 0
    };
  }
  function postEntities(entities) {
    const notPosts = ["user", "term", "folder", "link", "app"];
    return entities.filter((entity) => !notPosts.includes(entity.kind) && Number(entity.ref) > 0);
  }
  function mediaEntities(entities) {
    const media = ["attachment", "media", "image", "file", "video", "audio"];
    return entities.filter((entity) => media.includes(entity.kind) && Number(entity.ref) > 0);
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
  function control$1(tag, fallback2, opts = {}) {
    return el(hasComponent(tag) ? tag : fallback2, opts);
  }
  function button(label, opts = {}) {
    const { variant, ...rest } = opts;
    const node = control$1("os-button", "button", {
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
      return el("os-icon", { ...opts, attrs: { icon: slug2, ...opts.attrs ?? {} } });
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
  const CHANGE_EVENTS = [
    "os-input-change",
    "os-input-commit",
    "os-switch-change",
    "os-checkbox-change",
    "os-pick",
    "os-range-change",
    "os-color-change",
    "os-tag-add",
    "os-tag-remove",
    "input",
    "change"
  ];
  function textField(value, opts = {}, onInput) {
    const node = control$1("os-text-field", "input", {
      ...opts,
      attrs: { type: "text", ...opts.attrs ?? {} }
    });
    node.value = value;
    if (onInput) {
      onChangeOf(node, TEXT_EVENTS, () => readValue(node), onInput);
    }
    return node;
  }
  function textArea(value, opts = {}, onInput) {
    const node = control$1("os-textarea", "textarea", opts);
    node.value = value;
    if (onInput) {
      onChangeOf(node, TEXT_EVENTS, () => readValue(node), onInput);
    }
    return node;
  }
  function numberField(value, opts = {}, onInput) {
    const node = control$1("os-number-field", "input", {
      ...opts,
      attrs: { type: "number", ...opts.attrs ?? {} }
    });
    node.value = String(value ?? "");
    if (onInput) {
      onChangeOf(node, TEXT_EVENTS, () => readValue(node), (value2) => onInput(value2));
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
  function insertionIndex(container, selector, clientY, ignore) {
    const children = Array.from(container.querySelectorAll(selector)).filter(
      (child) => child !== ignore && !child.classList.contains("atcf-drag-ghost")
    );
    for (let index = 0; index < children.length; index++) {
      const rect = children[index].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return index;
      }
    }
    return children.length;
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
  function t(key, fallback2) {
    const strings = window.allTerrainFieldsL10n;
    return strings?.[key] ?? config().i18n?.[key] ?? fallback2;
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
    const options2 = {
      credentials: "same-origin",
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-WP-Nonce": nonce,
        ...init.headers ?? {}
      }
    };
    const os = shell();
    const response = os?.fetch ? await os.fetch(url, options2, { source }) : await fetch(url, options2);
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
  function getConfig() {
    return request("config");
  }
  function listGroups() {
    return request("groups");
  }
  function getGroup(id) {
    return request(`groups/${id}`);
  }
  function saveGroup(group) {
    const path = group.id ? `groups/${group.id}` : "groups";
    return request(path, { method: "POST", body: JSON.stringify(group) }, "field-group-save");
  }
  function createFromTemplate(slug2) {
    return request(`templates/${encodeURIComponent(slug2)}`, { method: "POST" }, "field-group-save");
  }
  function deleteGroup(id) {
    return request(`groups/${id}`, { method: "DELETE" });
  }
  function search(params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== "" && value !== void 0 && value !== null) {
        query.set(key, String(value));
      }
    });
    return request(`search?${query.toString()}`);
  }
  function preview(id, post = 0) {
    return request(`preview/${id}?post=${post}`);
  }
  const renderers = /* @__PURE__ */ new Map();
  function registerMount(type, renderer) {
    renderers.set(type, renderer);
  }
  function mountFor(type) {
    return renderers.get(type);
  }
  function publishRegistry() {
    const global = window;
    global.allTerrainFields = global.allTerrainFields ?? {};
    global.allTerrainFields.registerMount = registerMount;
  }
  const cache = /* @__PURE__ */ new Map();
  async function loadAttachments(ids) {
    const missing = ids.filter((id) => !cache.has(id));
    if (missing.length) {
      const { wpRestUrl, nonce } = config();
      const url = `${wpRestUrl}media?include=${missing.join(",")}&per_page=${Math.min(100, missing.length)}&_fields=id,title,source_url,alt_text,mime_type,media_details`;
      try {
        const response = await fetch(url, {
          credentials: "same-origin",
          headers: { "X-WP-Nonce": nonce }
        });
        if (response.ok) {
          const items = await response.json();
          items.forEach((item) => cache.set(Number(item.id), toAttachment(item)));
        }
      } catch {
      }
    }
    return ids.map((id) => cache.get(id) ?? placeholder(id)).filter(Boolean);
  }
  function toAttachment(item) {
    const details = item.media_details ?? {};
    const thumb = details.sizes?.thumbnail?.source_url ?? details.sizes?.medium?.source_url;
    return {
      id: Number(item.id),
      title: String(item.title?.rendered ?? ""),
      url: String(item.source_url ?? ""),
      alt: String(item.alt_text ?? ""),
      mime: String(item.mime_type ?? ""),
      thumbnail: String(thumb ?? item.source_url ?? ""),
      filename: String(item.source_url ?? "").split("/").pop() ?? ""
    };
  }
  function placeholder(id) {
    return {
      id,
      title: `#${id}`,
      url: "",
      alt: "",
      mime: "",
      thumbnail: "",
      filename: `#${id}`
    };
  }
  function openLibrary(opts) {
    return new Promise((resolve) => {
      const media = window.wp?.media;
      if (!media) {
        resolve([]);
        return;
      }
      const frame = media({
        title: opts.title,
        multiple: opts.multiple ? "add" : false,
        library: opts.mime ? { type: opts.mime.split(",").map((one) => one.trim()) } : {},
        button: { text: t("add", "Add") }
      });
      frame.on("open", () => {
        const selection = frame.state()?.get("selection");
        if (!selection?.add || !media.attachment) {
          return;
        }
        opts.selected.forEach((id) => {
          const attachment = media.attachment?.(id);
          if (attachment) {
            attachment.fetch();
            selection.add?.(attachment);
          }
        });
      });
      frame.on("select", () => {
        const selection = frame.state()?.get("selection");
        const ids = [];
        selection?.each?.((model) => {
          const json = model.toJSON();
          cache.set(Number(json.id), {
            id: Number(json.id),
            title: String(json.title ?? ""),
            url: String(json.url ?? ""),
            alt: String(json.alt ?? ""),
            mime: String(json.mime ?? ""),
            thumbnail: String(
              json.sizes?.thumbnail?.url ?? json.url ?? ""
            ),
            filename: String(json.filename ?? "")
          });
          ids.push(Number(json.id));
        });
        resolve(ids);
      });
      frame.open();
    });
  }
  registerMount("image", (context) => singleMedia(context, true));
  registerMount("file", (context) => singleMedia(context, false));
  function singleMedia(context, isImage) {
    const { host, field, set } = context;
    const settings = field.settings;
    let current = Number(context.value ?? 0) || 0;
    const draw2 = async () => {
      clear(host);
      const frame = el("div", { class: `atcf-media atcf-media--${isImage ? "image" : "file"}` });
      if (!current) {
        frame.append(
          el("div", {
            class: "atcf-media__empty",
            children: [
              icon(isImage ? "dashicons-format-image" : "dashicons-media-default"),
              el("p", { text: t("dropHere", "Drop it here") }),
              button(isImage ? t("selectImage", "Choose an image") : t("selectFile", "Choose a file"), {
                class: "atcf-media__pick",
                on: { click: () => void pick() }
              })
            ]
          })
        );
        host.append(frame);
        return;
      }
      const [attachment] = await loadAttachments([current]);
      const preview2 = isImage && attachment.thumbnail ? el("img", {
        class: "atcf-media__image",
        attrs: { src: attachment.thumbnail, alt: attachment.alt || attachment.title, loading: "lazy" }
      }) : el("div", {
        class: "atcf-media__file",
        children: [icon("dashicons-media-default"), el("span", { text: attachment.filename || attachment.title })]
      });
      frame.append(
        el("div", {
          class: "atcf-media__preview",
          children: [
            preview2,
            el("div", {
              class: "atcf-media__actions",
              children: [
                button(t("edit", "Edit"), { on: { click: () => void pick() } }),
                button(t("remove", "Remove"), {
                  class: "atcf-media__remove",
                  on: {
                    click: () => {
                      current = 0;
                      set(0);
                      void draw2();
                    }
                  }
                })
              ]
            })
          ]
        })
      );
      makeDraggable(preview2, attachment);
      host.append(frame);
    };
    const pick = async () => {
      const ids = await openLibrary({
        multiple: false,
        mime: settings.mime_types ?? (isImage ? "image" : ""),
        title: isImage ? t("selectImage", "Choose an image") : t("selectFile", "Choose a file"),
        selected: current ? [current] : []
      });
      if (ids.length) {
        current = ids[0];
        set(current);
        void draw2();
      }
    };
    host.addEventListener("atcf:media-dropped", (event) => {
      const [first] = event.detail.ids;
      if (first) {
        current = first;
        set(current);
        void draw2();
      }
    });
    void draw2();
  }
  registerMount("gallery", (context) => {
    const { host, field, set } = context;
    const settings = field.settings;
    const max = Number(settings.max_items ?? 0);
    let ids = Array.isArray(context.value) ? context.value.map(Number).filter(Boolean) : [];
    const commit = () => {
      set(ids);
      void draw2();
    };
    const draw2 = async () => {
      clear(host);
      const grid = el("div", { class: "atcf-gallery" });
      const items = await loadAttachments(ids);
      items.forEach((attachment, index) => {
        const tile = el("div", {
          class: "atcf-gallery__item",
          dataset: { index: String(index) },
          children: [
            attachment.thumbnail ? el("img", {
              attrs: { src: attachment.thumbnail, alt: attachment.alt || attachment.title, loading: "lazy" }
            }) : el("span", { class: "atcf-gallery__name", text: attachment.filename }),
            el("button", {
              class: "atcf-gallery__remove",
              text: "×",
              attrs: { type: "button", "aria-label": `${t("remove", "Remove")}: ${attachment.title}` },
              on: {
                click: (event) => {
                  event.stopPropagation();
                  ids = ids.filter((one) => one !== attachment.id);
                  commit();
                }
              }
            })
          ]
        });
        makeDraggable(tile, attachment, () => {
        });
        tile.addEventListener("pointerdown", (event) => {
          startDrag(event, {
            payload: buildPayload(
              config().dragTypes.value,
              tile,
              { kind: "attachment", id: attachment.id, title: attachment.title, thumbnail: attachment.thumbnail },
              event,
              tile.cloneNode(true)
            ),
            origin: event,
            onCancel: () => void 0
          });
        });
        grid.append(tile);
      });
      if (!max || ids.length < max) {
        grid.append(
          el("button", {
            class: "atcf-gallery__add",
            attrs: { type: "button" },
            children: [icon("dashicons-plus-alt2"), el("span", { text: t("add", "Add") })],
            on: { click: () => void pick() }
          })
        );
      }
      host.append(grid);
    };
    dragManager().registerDropTarget({
      id: `allterrain-fields/gallery/${field.key}`,
      element: host,
      accept: (payload) => payload.type === config().dragTypes.value,
      onDrop: (session, point) => {
        const id = Number(session.payload.data.id ?? 0);
        const grid = host.querySelector(".atcf-gallery");
        if (!id || !grid) {
          return;
        }
        const target = insertionIndex(grid, ".atcf-gallery__item", point.clientY);
        ids = ids.filter((one) => one !== id);
        ids.splice(Math.min(target, ids.length), 0, id);
        commit();
      }
    });
    const pick = async () => {
      const chosen = await openLibrary({
        multiple: true,
        mime: settings.mime_types ?? "image",
        title: t("selectImages", "Choose images"),
        selected: ids
      });
      if (chosen.length) {
        ids = max > 0 ? chosen.slice(0, max) : chosen;
        commit();
      }
    };
    host.addEventListener("atcf:media-dropped", (event) => {
      const added = event.detail.ids.filter((id) => !ids.includes(id));
      if (!added.length) {
        return;
      }
      ids = max > 0 ? [...ids, ...added].slice(0, max) : [...ids, ...added];
      commit();
    });
    void draw2();
  });
  function makeDraggable(element, attachment, onClick) {
    element.addEventListener("pointerdown", (event) => {
      const ghost = el("div", {
        class: "atcf-drag-ghost atcf-drag-ghost--media",
        children: [
          attachment.thumbnail ? el("img", { attrs: { src: attachment.thumbnail, alt: "" } }) : icon("dashicons-media-default")
        ]
      });
      startDrag(event, {
        payload: buildPayload(
          config().dragTypes.value,
          element,
          {
            kind: "attachment",
            id: attachment.id,
            title: attachment.title,
            url: attachment.url,
            thumbnail: attachment.thumbnail,
            // The shell's own shape as well as ours, so a target written
            // against WP Explorer's `shortcut` payload accepts this
            // without knowing anything about this plugin.
            ref: String(attachment.id)
          },
          event,
          ghost
        ),
        origin: event,
        onClickOnly: onClick,
        onCancel: () => void 0
      });
    });
  }
  const SHAPES$1 = {
    post_object: {
      kind: "post",
      multiple: (c) => Boolean(c.field.settings.multiple),
      params: (c) => ({ post_type: (c.field.settings.post_types ?? []).join(",") }),
      max: () => 0,
      sortable: false
    },
    relationship: {
      kind: "post",
      multiple: () => true,
      params: (c) => ({ post_type: (c.field.settings.post_types ?? []).join(",") }),
      max: (c) => Number(c.field.settings.max_items ?? 0),
      sortable: true
    },
    page_link: {
      kind: "post",
      multiple: (c) => Boolean(c.field.settings.multiple),
      params: (c) => ({ post_type: (c.field.settings.post_types ?? []).join(",") }),
      max: () => 0,
      sortable: false
    },
    taxonomy: {
      kind: "term",
      multiple: (c) => c.field.settings.multiple !== false,
      params: (c) => ({ taxonomy: String(c.field.settings.taxonomy ?? "") }),
      max: () => 0,
      sortable: false
    },
    user: {
      kind: "user",
      multiple: (c) => Boolean(c.field.settings.multiple),
      params: (c) => ({ roles: (c.field.settings.roles ?? []).join(",") }),
      max: () => 0,
      sortable: false
    }
  };
  Object.keys(SHAPES$1).forEach((type) => registerMount(type, (context) => relational(context, SHAPES$1[type])));
  function relational(context, shape) {
    const { host, field, set } = context;
    const multiple = shape.multiple(context);
    const max = shape.max(context);
    let chosen = toIds(context.value);
    let records = /* @__PURE__ */ new Map();
    let open2 = false;
    const listId = uid("atcf-rel");
    const commit = () => {
      set(multiple ? chosen : chosen[0] ?? 0);
      drawChips();
    };
    const root = el("div", { class: `atcf-rel atcf-rel--${shape.kind}` });
    const chips = el("div", { class: "atcf-rel__chips", attrs: { role: "list" } });
    const searchBox = control$1("os-text-field", "input", {
      class: "atcf-rel__search",
      attrs: {
        type: "search",
        placeholder: t("search", "Search"),
        role: "combobox",
        "aria-expanded": "false",
        "aria-controls": listId,
        "aria-autocomplete": "list"
      }
    });
    const results = el("div", { class: "atcf-rel__results", attrs: { id: listId, role: "listbox", hidden: "" } });
    const drawChips = () => {
      clear(chips);
      if (!chosen.length) {
        chips.append(el("p", { class: "atcf-rel__empty", text: t("empty", "Nothing here yet.") }));
        return;
      }
      chosen.forEach((id) => {
        const record = records.get(id);
        const chip = el("div", {
          class: "atcf-rel__chip",
          attrs: { role: "listitem" },
          dataset: { id: String(id) },
          children: [
            record?.thumbnail ? el("img", { class: "atcf-rel__thumb", attrs: { src: record.thumbnail, alt: "" } }) : icon(iconFor(shape.kind), { class: "atcf-rel__icon" }),
            el("span", {
              class: "atcf-rel__label",
              text: record?.label ?? `#${id}`
            }),
            record?.sub ? el("span", { class: "atcf-rel__sub", text: record.sub }) : null,
            el("button", {
              class: "atcf-rel__remove",
              text: "×",
              attrs: {
                type: "button",
                "aria-label": `${t("remove", "Remove")}: ${record?.label ?? id}`
              },
              on: {
                click: (event) => {
                  event.stopPropagation();
                  chosen = chosen.filter((one) => one !== id);
                  commit();
                }
              }
            })
          ]
        });
        if (record?.editUrl) {
          chip.classList.add("atcf-rel__chip--openable");
          chip.setAttribute("title", t("openInWindow", "Open in its own window"));
        }
        chip.addEventListener("pointerdown", (event) => {
          startDrag(event, {
            payload: buildPayload(
              config().dragTypes.value,
              chip,
              {
                kind: shape.kind === "post" ? "post" : shape.kind,
                id,
                ref: String(id),
                title: record?.label ?? String(id),
                thumbnail: record?.thumbnail,
                field: field.key
              },
              event,
              chip.cloneNode(true)
            ),
            origin: event,
            onClickOnly: () => record?.editUrl && openInWindow(record),
            onCancel: () => void 0
          });
        });
        chips.append(chip);
      });
    };
    const hydrate = async () => {
      if (!chosen.length) {
        drawChips();
        return;
      }
      const { results: found } = await search({
        kind: shape.kind,
        include: chosen.join(","),
        ...shape.params(context)
      });
      found.forEach((record) => records.set(record.id, record));
      drawChips();
    };
    const drawResults = (items) => {
      clear(results);
      if (!items.length) {
        results.append(el("p", { class: "atcf-rel__none", text: t("noResults", "Nothing matched.") }));
        return;
      }
      items.forEach((item) => {
        const already = chosen.includes(item.id);
        results.append(
          el("button", {
            class: `atcf-rel__result${already ? " is-chosen" : ""}`,
            attrs: { type: "button", role: "option", "aria-selected": already ? "true" : "false" },
            children: [
              item.thumbnail ? el("img", { attrs: { src: item.thumbnail, alt: "" } }) : icon(iconFor(shape.kind)),
              el("span", { class: "atcf-rel__result-label", text: item.label }),
              el("span", { class: "atcf-rel__result-sub", text: item.sub })
            ],
            on: {
              click: () => {
                records.set(item.id, item);
                add([item.id]);
                closeResults();
              }
            }
          })
        );
      });
    };
    const closeResults = () => {
      open2 = false;
      results.setAttribute("hidden", "");
      searchBox.setAttribute("aria-expanded", "false");
      searchBox.value = "";
    };
    const openResults = () => {
      open2 = true;
      results.removeAttribute("hidden");
      searchBox.setAttribute("aria-expanded", "true");
    };
    const add = (ids) => {
      const fresh = ids.filter((id) => !chosen.includes(id));
      if (!fresh.length) {
        return;
      }
      if (!multiple) {
        chosen = [fresh[0]];
      } else {
        chosen = [...chosen, ...fresh];
        if (max > 0) {
          chosen = chosen.slice(0, max);
        }
      }
      commit();
      void hydrate();
    };
    const run = debounce(async (query) => {
      const { results: found } = await search({ kind: shape.kind, q: query, ...shape.params(context) });
      found.forEach((record) => records.set(record.id, record));
      drawResults(found);
      openResults();
    }, 220);
    searchBox.addEventListener("input", () => run(readValue(searchBox)));
    searchBox.addEventListener("focus", () => {
      if (!open2) {
        run(readValue(searchBox));
      }
    });
    searchBox.addEventListener("keydown", (event) => {
      const key = event.key;
      if (key === "Escape" && open2) {
        event.stopPropagation();
        closeResults();
        return;
      }
      if (key === "ArrowDown" && open2) {
        event.preventDefault();
        results.querySelector(".atcf-rel__result")?.focus();
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (open2 && !root.contains(event.target)) {
        closeResults();
      }
    });
    root.append(chips, el("div", { class: "atcf-rel__find", children: [searchBox, results] }));
    if (shape.sortable) {
      dragManager().registerDropTarget({
        id: `allterrain-fields/relationship/${field.key}`,
        element: root,
        accept: (payload) => payload.type === config().dragTypes.value,
        onDrop: (session, point) => {
          const id = Number(session.payload.data.id ?? 0);
          if (!id) {
            return;
          }
          const index = insertionIndex(chips, ".atcf-rel__chip", point.clientY);
          chosen = chosen.filter((one) => one !== id);
          chosen.splice(Math.min(index, chosen.length), 0, id);
          commit();
          void hydrate();
        }
      });
    }
    host.addEventListener("atcf:entities-dropped", (event) => {
      add(event.detail.ids);
    });
    host.append(root);
    void hydrate();
  }
  function openInWindow(record) {
    const os = shell();
    const url = record.editUrl ?? "";
    if (!url) {
      return;
    }
    if (os?.windowManager?.open) {
      os.windowManager.open({
        id: `atcf-related-${record.id}`,
        url,
        title: record.label,
        icon: "dashicons-admin-post"
      });
      return;
    }
    window.open(url, "_blank", "noopener");
  }
  function iconFor(kind) {
    if (kind === "user") {
      return "dashicons-admin-users";
    }
    if (kind === "term") {
      return "dashicons-tag";
    }
    return "dashicons-admin-post";
  }
  function toIds(value) {
    if (Array.isArray(value)) {
      return value.map((one) => Number(one?.id ?? one)).filter((id) => id > 0);
    }
    const single2 = Number(value ?? 0);
    return single2 > 0 ? [single2] : [];
  }
  registerMount("link", (context) => {
    const { host, set } = context;
    const value = context.value ?? {};
    const current = {
      url: String(value.url ?? ""),
      title: String(value.title ?? ""),
      target: String(value.target ?? "")
    };
    const push = () => set(current.url === "" ? "" : { ...current });
    const urlInput = control$1("os-text-field", "input", {
      class: "atcf-link__url",
      attrs: { type: "url", placeholder: "https://", "aria-label": "URL" }
    });
    const titleInput = control$1("os-text-field", "input", {
      class: "atcf-link__title",
      // Its own string, not the borrowed "Add" that used to sit here — a
      // placeholder is the only name an optional input gets, and "Add" names
      // a button, not a box for the words a link shows.
      attrs: { type: "text", placeholder: t("linkText", "Link text"), "aria-label": "Link text" }
    });
    const targetInput = el("input", { attrs: { type: "checkbox" } });
    urlInput.value = current.url;
    titleInput.value = current.title;
    targetInput.checked = current.target === "_blank";
    urlInput.addEventListener("input", () => {
      current.url = readValue(urlInput);
      push();
    });
    titleInput.addEventListener("input", () => {
      current.title = readValue(titleInput);
      push();
    });
    targetInput.addEventListener("change", () => {
      current.target = targetInput.checked ? "_blank" : "";
      push();
    });
    host.addEventListener("atcf:entities-dropped", (event) => {
      const [url] = event.detail.urls ?? [];
      const [title] = event.detail.titles ?? [];
      if (url) {
        current.url = url;
        urlInput.value = url;
      }
      if (title && current.title === "") {
        current.title = title;
        titleInput.value = title;
      }
      push();
    });
    host.append(
      el("div", {
        class: "atcf-link",
        children: [
          urlInput,
          titleInput,
          el("label", {
            class: "atcf-link__target",
            children: [targetInput, el("span", { text: "Opens in a new tab" })]
          })
        ]
      })
    );
  });
  const ALIASES = {
    "==": "is",
    "!=": "is_not",
    ">": "greater",
    "<": "less",
    ">=": "greater_equal",
    "<=": "less_equal",
    "==empty": "empty",
    "!=empty": "not_empty",
    "==contains": "contains",
    "!=contains": "not_contains",
    "==pattern": "contains"
  };
  const KNOWN = [
    "is",
    "is_not",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "greater",
    "greater_equal",
    "less",
    "less_equal",
    "empty",
    "not_empty",
    "in",
    "not_in"
  ];
  function normalizeOperator(operator) {
    const mapped = ALIASES[operator] ?? operator;
    return KNOWN.includes(mapped) ? mapped : "is";
  }
  function isEmpty(value) {
    if (value === null || value === void 0 || value === false) {
      return true;
    }
    if (Array.isArray(value)) {
      return value.every((one) => isEmpty(one));
    }
    if (typeof value === "object") {
      return Object.keys(value).length === 0;
    }
    return String(value).trim() === "";
  }
  function stringify(value) {
    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }
    if (value === null || value === void 0) {
      return "";
    }
    if (Array.isArray(value)) {
      return "";
    }
    if (typeof value === "object") {
      const id = value.id;
      return id === void 0 ? "" : String(id);
    }
    return String(value).trim();
  }
  function bothNumeric(left, right) {
    return left.trim() !== "" && right.trim() !== "" && !Number.isNaN(Number(left)) && !Number.isNaN(Number(right));
  }
  function equal(left, right) {
    if (bothNumeric(left, right)) {
      return Math.abs(Number(left) - Number(right)) < 1e-6;
    }
    return left.toLowerCase() === right.toLowerCase();
  }
  function test(value, operator, expected) {
    const op = normalizeOperator(operator);
    if (op === "empty") {
      return isEmpty(value);
    }
    if (op === "not_empty") {
      return !isEmpty(value);
    }
    if (Array.isArray(value)) {
      if (["is_not", "not_contains", "not_in"].includes(op)) {
        return value.every((one) => test(one, op, expected));
      }
      return value.some((one) => test(one, op, expected));
    }
    if (op === "in" || op === "not_in") {
      const list = Array.isArray(expected) ? expected.map((one) => stringify(one)) : stringify(expected).split(",").map((one) => one.trim());
      const found = list.includes(stringify(value));
      return op === "in" ? found : !found;
    }
    const left = stringify(value);
    const right = stringify(Array.isArray(expected) ? expected[0] : expected);
    switch (op) {
      case "is":
        return equal(left, right);
      case "is_not":
        return !equal(left, right);
      case "contains":
        return right !== "" && left.toLowerCase().includes(right.toLowerCase());
      case "not_contains":
        return right === "" || !left.toLowerCase().includes(right.toLowerCase());
      case "starts_with":
        return right !== "" && left.toLowerCase().startsWith(right.toLowerCase());
      case "ends_with":
        return right !== "" && left.toLowerCase().endsWith(right.toLowerCase());
      case "greater":
      case "greater_equal":
      case "less":
      case "less_equal": {
        if (!bothNumeric(left, right)) {
          return false;
        }
        const a = Number(left);
        const b = Number(right);
        if (op === "greater") {
          return a > b;
        }
        if (op === "greater_equal") {
          return a >= b;
        }
        if (op === "less") {
          return a < b;
        }
        return a <= b;
      }
      default:
        return false;
    }
  }
  function visible(conditional, values) {
    const rules = conditional?.rules ?? [];
    if (!conditional?.enabled || rules.length === 0) {
      return true;
    }
    const match = conditional.match === "any" ? "any" : "all";
    const results = rules.map((rule) => test(values[rule.field], rule.operator, rule.value));
    const matched = match === "all" ? results.every(Boolean) : results.some(Boolean);
    return conditional.action === "hide" ? !matched : matched;
  }
  function renderField(field, value, onChange) {
    const id = uid("atcf-f");
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;
    const wrapper = el("div", {
      class: `atcf-field atcf-field--${field.type}${field.required ? " atcf-field--required" : ""}${field.wrapper?.class ? ` ${field.wrapper.class}` : ""}`,
      dataset: {
        atcfField: field.key,
        atcfType: field.type,
        atcfName: field.name
      },
      style: { ...field.wrapper?.width ? { "--atcf-width": `${field.wrapper.width}%` } : {} }
    });
    const grouped = ["radio", "checkbox", "button_group"].includes(field.type);
    if (!["tab", "accordion", "message"].includes(field.type)) {
      const label = el(grouped ? "span" : "label", {
        class: "atcf-field__label",
        text: field.label,
        attrs: grouped ? {} : { for: id }
      });
      if (field.required) {
        label.append(el("span", { class: "atcf-field__required", text: " *", attrs: { "aria-hidden": "true" } }));
      }
      wrapper.append(el("div", { class: "atcf-field__header", children: [label] }));
    }
    const host = el("div", { class: "atcf-field__control" });
    wrapper.append(host);
    if (field.instructions) {
      wrapper.append(el("p", { class: "atcf-field__hint", text: field.instructions, attrs: { id: hintId } }));
    }
    wrapper.append(el("p", { class: "atcf-field__error", attrs: { id: errorId, role: "alert" } }));
    const describedBy = [field.instructions ? hintId : "", errorId].filter(Boolean).join(" ");
    const teardown = drawControl({ field, value, onChange, host, wrapper, id, describedBy });
    return {
      element: wrapper,
      field,
      applyLogic: (values) => {
        const shown = visible(field.conditional, values);
        wrapper.hidden = !shown;
        wrapper.classList.toggle("atcf-field--hidden", !shown);
        wrapper.querySelectorAll("input, select, textarea").forEach((node) => {
          node.disabled = !shown;
        });
      },
      destroy: () => teardown?.()
    };
  }
  function drawControl(context) {
    const { field, host, id, describedBy } = context;
    const settings = field.settings;
    const shared = {
      id,
      "aria-describedby": describedBy,
      ...field.required ? { required: true, "aria-required": "true" } : {},
      ...field.readonly ? { readonly: true } : {}
    };
    switch (field.type) {
      case "text":
      case "email":
      case "url":
      case "password": {
        const input = control$1("os-text-field", "input", {
          class: "atcf-input",
          attrs: {
            type: field.type === "text" ? "text" : field.type,
            placeholder: String(settings.placeholder ?? ""),
            ...shared
          }
        });
        input.value = String(context.value ?? "");
        bind(input, () => context.onChange(readValue(input)));
        host.append(affixed(settings, input));
        return;
      }
      case "textarea":
      case "code": {
        const input = control$1("os-textarea", "textarea", {
          class: `atcf-input${field.type === "code" ? " atcf-input--code" : ""}`,
          attrs: { rows: Number(settings.rows ?? 5), placeholder: String(settings.placeholder ?? ""), ...shared }
        });
        input.value = String(context.value ?? "");
        bind(input, () => context.onChange(readValue(input)));
        host.append(input);
        return;
      }
      case "number":
      case "range": {
        const input = control$1(
          field.type === "range" ? "os-range-field" : "os-number-field",
          "input",
          {
            class: "atcf-input",
            attrs: {
              type: field.type === "range" ? "range" : "number",
              min: settings.min === "" ? null : Number(settings.min),
              max: settings.max === "" ? null : Number(settings.max),
              step: settings.step === "" ? null : Number(settings.step),
              ...shared
            }
          }
        );
        input.value = String(context.value ?? "");
        bind(input, () => context.onChange(readValue(input)));
        host.append(affixed(settings, input));
        return;
      }
      case "true_false": {
        const input = el("input", { attrs: { type: "checkbox", id, "aria-describedby": describedBy } });
        input.checked = String(context.value ?? "") === "1" || context.value === true;
        input.addEventListener("change", () => context.onChange(input.checked ? "1" : "0"));
        host.append(
          el("label", {
            class: "atcf-switch",
            attrs: { for: id },
            children: [
              input,
              // The same track the PHP renderer prints. Without it this
              // renderer's switches were bare checkboxes wearing the
              // stylesheet's hit-area sizing — the ugly blue pill.
              el("span", { class: "atcf-switch__track", attrs: { "aria-hidden": "true" } }),
              el("span", { class: "atcf-switch__label", text: String(settings.message ?? "") })
            ]
          })
        );
        return;
      }
      case "select": {
        const choices = normalizeChoices(settings.choices);
        const multiple = Boolean(settings.multiple);
        const node = el("select", {
          class: "atcf-input",
          attrs: { ...shared, multiple: multiple ? true : null }
        });
        if (settings.allow_null && !multiple) {
          node.append(el("option", { text: "— none —", attrs: { value: "" } }));
        }
        choices.forEach((choice) => node.append(el("option", { text: choice.label, attrs: { value: choice.value } })));
        const chosen = toArray(context.value).map(String);
        Array.from(node.options).forEach((option) => {
          option.selected = chosen.includes(option.value);
        });
        node.addEventListener("change", () => {
          const picked = Array.from(node.selectedOptions).map((option) => option.value);
          context.onChange(multiple ? picked : picked[0] ?? "");
        });
        host.append(node);
        return;
      }
      case "radio":
      case "checkbox":
      case "button_group": {
        const multiple = field.type === "checkbox";
        const choices = normalizeChoices(settings.choices);
        const chosen = new Set(toArray(context.value).map(String));
        const fieldset = el("fieldset", {
          class: `atcf-choices atcf-choices--${settings.layout === "horizontal" ? "horizontal" : "vertical"}${field.type === "button_group" ? " atcf-choices--buttons" : ""}`,
          attrs: { "aria-describedby": describedBy },
          children: [el("legend", { class: "screen-reader-text", text: field.label })]
        });
        choices.forEach((choice, index) => {
          const choiceId = `${id}-${index}`;
          const input = el("input", {
            attrs: {
              type: multiple ? "checkbox" : "radio",
              id: choiceId,
              name: multiple ? `${id}[]` : id,
              value: choice.value
            }
          });
          input.checked = chosen.has(choice.value);
          input.addEventListener("change", () => {
            if (multiple) {
              if (input.checked) {
                chosen.add(choice.value);
              } else {
                chosen.delete(choice.value);
              }
              context.onChange(Array.from(chosen));
              return;
            }
            context.onChange(choice.value);
          });
          fieldset.append(
            el("label", {
              class: "atcf-choice",
              attrs: { for: choiceId },
              children: [input, el("span", { class: "atcf-choice__label", text: choice.label })]
            })
          );
        });
        host.append(fieldset);
        return;
      }
      case "date_picker":
      case "date_time_picker":
      case "time_picker": {
        const types = {
          date_picker: "date",
          date_time_picker: "datetime-local",
          time_picker: "time"
        };
        const input = el("input", {
          class: "atcf-input",
          attrs: { type: types[field.type], ...shared }
        });
        input.value = toInputDate(String(context.value ?? ""), types[field.type]);
        input.addEventListener("change", () => context.onChange(input.value));
        host.append(input);
        return;
      }
      case "message": {
        host.append(el("div", { class: "atcf-message", text: String(settings.message ?? "") }));
        return;
      }
      case "tab":
      case "accordion": {
        host.append(
          el("div", {
            class: `atcf-${field.type}-marker`,
            text: field.label,
            dataset: { atcfMarker: field.key }
          })
        );
        return;
      }
    }
    const renderer = mountFor(field.type);
    if (!renderer) {
      host.append(
        el("p", {
          class: "atcf-field__unknown",
          text: `${field.type}: ${JSON.stringify(context.value ?? null)}`
        })
      );
      return;
    }
    return renderer({
      host,
      field,
      value: context.value,
      set: context.onChange,
      wrapper: context.wrapper
    }) ?? void 0;
  }
  function bind(node, handler) {
    let last = null;
    CHANGE_EVENTS.forEach(
      (name) => node.addEventListener(name, () => {
        const now = readValue(node);
        if (now === last) {
          return;
        }
        last = now;
        handler();
      })
    );
  }
  function affixed(settings, node) {
    const before = String(settings.prepend ?? "");
    const after = String(settings.append ?? "");
    if (!before && !after) {
      return node;
    }
    return el("div", {
      class: "atcf-affixed",
      children: [
        before ? el("span", { class: "atcf-affix atcf-affix--before", text: before, attrs: { "aria-hidden": "true" } }) : null,
        node,
        after ? el("span", { class: "atcf-affix atcf-affix--after", text: after, attrs: { "aria-hidden": "true" } }) : null
      ]
    });
  }
  function toArray(value) {
    if (Array.isArray(value)) {
      return value;
    }
    return value === "" || value === null || value === void 0 ? [] : [value];
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
          return { value: String(one.value ?? ""), label: String(one.label ?? one.value ?? "") };
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
  function toInputDate(stored, inputType) {
    if (!stored) {
      return "";
    }
    if (inputType === "time") {
      return stored.slice(0, 5);
    }
    const iso = stored.replace(" ", "T");
    return inputType === "date" ? iso.slice(0, 10) : iso.slice(0, 16);
  }
  function addLabel(settings) {
    return String(settings.button_label ?? t("addRow", "Add row"));
  }
  function subsOf(host) {
    return parse$1(host.closest(".atcf-mount")?.dataset.atcfSubs, []);
  }
  function layoutsOf(host) {
    return parse$1(host.closest(".atcf-mount")?.dataset.atcfSubs, []);
  }
  function parse$1(raw, fallback2) {
    if (!raw) {
      return fallback2;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return fallback2;
    }
  }
  registerMount("repeater", (context) => repeater(context, subsOf(context.host)));
  registerMount("group", (context) => single(context, subsOf(context.host)));
  registerMount("clone", (context) => single(context, subsOf(context.host)));
  registerMount("flexible_content", (context) => flexible(context, layoutsOf(context.host)));
  function single(context, subs) {
    const values = context.value ?? {};
    const box2 = el("div", { class: "atcf-group" });
    const rendered = [];
    subs.forEach((sub) => {
      const field = renderField(sub, values[sub.key], (value) => {
        values[sub.key] = value;
        context.set({ ...values });
        relayout();
      });
      rendered.push(field);
      box2.append(field.element);
    });
    const relayout = () => rendered.forEach((one) => one.applyLogic(values));
    context.host.append(box2);
    relayout();
    return () => rendered.forEach((one) => one.destroy());
  }
  function repeater(context, subs) {
    const settings = context.field.settings;
    const min = Number(settings.min_items ?? 0);
    const max = Number(settings.max_items ?? 0);
    let rows = Array.isArray(context.value) ? context.value : [];
    const list = el("div", { class: `atcf-rows atcf-rows--${settings.layout ?? "block"}` });
    const foot = el("div", { class: "atcf-rows__foot" });
    const teardowns2 = [];
    const commit = () => {
      context.set(rows.map((row2) => ({ ...row2 })));
      draw2();
    };
    const blankRow = () => {
      const row2 = {};
      subs.forEach((sub) => {
        row2[sub.key] = sub.settings.default_value ?? "";
      });
      return row2;
    };
    const move = (from, to) => {
      if (to < 0 || to >= rows.length || from === to) {
        return;
      }
      const [moved] = rows.splice(from, 1);
      rows.splice(to, 0, moved);
      commit();
    };
    const draw2 = () => {
      teardowns2.splice(0).forEach((fn) => fn());
      clear(list);
      clear(foot);
      rows.forEach((row2, index) => {
        list.append(drawRow(row2, index));
      });
      if (!rows.length) {
        list.append(el("p", { class: "atcf-rows__empty", text: t("empty", "Nothing here yet.") }));
      }
      if (!max || rows.length < max) {
        foot.append(
          button(addLabel(context.field.settings), {
            class: "atcf-rows__add",
            on: {
              click: () => {
                rows.push(blankRow());
                commit();
              }
            }
          })
        );
      }
      if (max) {
        foot.append(
          el("span", {
            class: "atcf-rows__count",
            text: t("rowsRemaining", "%d left").replace("%d", String(Math.max(0, max - rows.length)))
          })
        );
      }
    };
    const drawRow = (row2, index) => {
      const rowId = uid("atcf-row");
      const body = el("div", { class: "atcf-row__body" });
      const rendered = [];
      subs.forEach((sub) => {
        const field = renderField(sub, row2[sub.key], (value) => {
          row2[sub.key] = value;
          context.set(rows.map((one) => ({ ...one })));
          rendered.forEach((one) => one.applyLogic(row2));
        });
        rendered.push(field);
        body.append(field.element);
      });
      rendered.forEach((one) => one.applyLogic(row2));
      teardowns2.push(() => rendered.forEach((one) => one.destroy()));
      const handle = el("button", {
        class: "atcf-row__handle",
        attrs: {
          type: "button",
          "aria-label": `${t("moveUp", "Move up")} / ${t("moveDown", "Move down")}`,
          "aria-describedby": rowId
        },
        children: [icon("dashicons-menu")]
      });
      handle.addEventListener("keydown", (event) => {
        const key = event.key;
        if (!event.altKey) {
          return;
        }
        if (key === "ArrowUp") {
          event.preventDefault();
          move(index, index - 1);
        }
        if (key === "ArrowDown") {
          event.preventDefault();
          move(index, index + 1);
        }
      });
      const element = el("div", {
        class: "atcf-row",
        attrs: { id: rowId },
        dataset: { index: String(index) },
        children: [
          el("div", {
            class: "atcf-row__bar",
            children: [
              handle,
              el("span", { class: "atcf-row__number", text: String(index + 1) }),
              el("button", {
                class: "atcf-row__remove",
                text: "×",
                attrs: {
                  type: "button",
                  "aria-label": t("remove", "Remove"),
                  disabled: rows.length <= min ? true : null
                },
                on: {
                  click: () => {
                    rows.splice(index, 1);
                    commit();
                  }
                }
              })
            ]
          }),
          body
        ]
      });
      handle.addEventListener("pointerdown", (event) => {
        const ghost = el("div", { class: "atcf-drag-ghost atcf-drag-ghost--row", text: `${index + 1}` });
        startDrag(event, {
          payload: buildPayload(
            config().dragTypes.value,
            element,
            { kind: "repeater-row", field: context.field.key, index, row: { ...row2 } },
            event,
            ghost
          ),
          origin: event,
          onCancel: () => void 0
        });
      });
      return element;
    };
    dragManager().registerDropTarget({
      id: `allterrain-fields/repeater/${context.field.key}`,
      element: context.host,
      accept: (payload) => payload.type === config().dragTypes.value && payload.data.kind === "repeater-row",
      onDrop: (session, point) => {
        const data = session.payload.data;
        const target = insertionIndex(list, ".atcf-row", point.clientY);
        if (data.field === context.field.key && typeof data.index === "number") {
          move(data.index, Math.min(target, rows.length - 1));
          return;
        }
        if (max && rows.length >= max) {
          return;
        }
        rows.splice(Math.min(target, rows.length), 0, { ...data.row ?? {} });
        commit();
      }
    });
    while (rows.length < min) {
      rows.push(blankRow());
    }
    context.host.append(list, foot);
    draw2();
    return () => teardowns2.splice(0).forEach((fn) => fn());
  }
  function flexible(context, layouts) {
    const settings = context.field.settings;
    const max = Number(settings.max_items ?? 0);
    let rows = Array.isArray(context.value) ? context.value : [];
    const list = el("div", { class: "atcf-rows atcf-rows--flexible" });
    const foot = el("div", { class: "atcf-rows__foot" });
    const teardowns2 = [];
    const layoutFor = (name) => layouts.find((one) => one.name === name);
    const commit = () => {
      context.set(rows.map((row2) => ({ ...row2 })));
      draw2();
    };
    const draw2 = () => {
      teardowns2.splice(0).forEach((fn) => fn());
      clear(list);
      clear(foot);
      rows.forEach((row2, index) => {
        const layout = layoutFor(String(row2.acf_fc_layout ?? ""));
        if (!layout) {
          list.append(
            el("div", {
              class: "atcf-row atcf-row--orphan",
              children: [
                el("p", { text: `${String(row2.acf_fc_layout ?? "?")} — this block no longer exists` }),
                button(t("remove", "Remove"), {
                  on: {
                    click: () => {
                      rows.splice(index, 1);
                      commit();
                    }
                  }
                })
              ]
            })
          );
          return;
        }
        const body = el("div", { class: "atcf-row__body" });
        const rendered = [];
        layout.sub_fields.forEach((sub) => {
          const field = renderField(sub, row2[sub.key], (value) => {
            row2[sub.key] = value;
            context.set(rows.map((one) => ({ ...one })));
            rendered.forEach((one) => one.applyLogic(row2));
          });
          rendered.push(field);
          body.append(field.element);
        });
        rendered.forEach((one) => one.applyLogic(row2));
        teardowns2.push(() => rendered.forEach((one) => one.destroy()));
        list.append(
          el("div", {
            class: "atcf-row",
            dataset: { index: String(index) },
            children: [
              el("div", {
                class: "atcf-row__bar",
                children: [
                  el("span", { class: "atcf-row__layout", text: layout.label }),
                  el("button", {
                    class: "atcf-row__move",
                    text: "↑",
                    attrs: { type: "button", "aria-label": t("moveUp", "Move up") },
                    on: {
                      click: () => {
                        if (index > 0) {
                          const [moved] = rows.splice(index, 1);
                          rows.splice(index - 1, 0, moved);
                          commit();
                        }
                      }
                    }
                  }),
                  el("button", {
                    class: "atcf-row__move",
                    text: "↓",
                    attrs: { type: "button", "aria-label": t("moveDown", "Move down") },
                    on: {
                      click: () => {
                        if (index < rows.length - 1) {
                          const [moved] = rows.splice(index, 1);
                          rows.splice(index + 1, 0, moved);
                          commit();
                        }
                      }
                    }
                  }),
                  el("button", {
                    class: "atcf-row__remove",
                    text: "×",
                    attrs: { type: "button", "aria-label": t("remove", "Remove") },
                    on: {
                      click: () => {
                        rows.splice(index, 1);
                        commit();
                      }
                    }
                  })
                ]
              }),
              body
            ]
          })
        );
      });
      if (!rows.length) {
        list.append(el("p", { class: "atcf-rows__empty", text: t("empty", "Nothing here yet.") }));
      }
      if (max && rows.length >= max) {
        return;
      }
      const menu = el("div", { class: "atcf-layouts" });
      layouts.forEach((layout) => {
        const used = rows.filter((row2) => row2.acf_fc_layout === layout.name).length;
        menu.append(
          button(layout.label, {
            class: "atcf-layouts__add",
            attrs: { disabled: layout.max > 0 && used >= layout.max ? true : null },
            on: {
              click: () => {
                const row2 = { acf_fc_layout: layout.name };
                layout.sub_fields.forEach((sub) => {
                  row2[sub.key] = sub.settings.default_value ?? "";
                });
                rows.push(row2);
                commit();
              }
            }
          })
        );
      });
      foot.append(el("p", { class: "atcf-layouts__label", text: t("chooseLayout", "Choose a block") }), menu);
    };
    context.host.append(list, foot);
    draw2();
    return () => teardowns2.splice(0).forEach((fn) => fn());
  }
  const PRECEDENCE = {
    "||": 1,
    "&&": 2,
    "==": 3,
    "!=": 3,
    "<": 4,
    ">": 4,
    "<=": 4,
    ">=": 4,
    "+": 5,
    "-": 5,
    "*": 6,
    "/": 6,
    "%": 6,
    "u-": 6.5,
    "^": 7
  };
  const RIGHT_ASSOCIATIVE = ["^", "u-"];
  const FUNCTIONS = [
    "min",
    "max",
    "sum",
    "avg",
    "round",
    "floor",
    "ceil",
    "abs",
    "sqrt",
    "if",
    "pow",
    "mod",
    "clamp",
    "median",
    "product",
    "pct",
    "int",
    "sign",
    "count"
  ];
  function toNumber(value) {
    if (Array.isArray(value)) {
      return value.reduce((total, one) => total + toNumber(one), 0);
    }
    if ("boolean" === typeof value) {
      return value ? 1 : 0;
    }
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
  }
  function flatten(args) {
    return args.flatMap((arg) => Array.isArray(arg) ? flatten(arg) : [toNumber(arg)]);
  }
  const VARIADIC = ["min", "max", "sum", "avg", "median", "product", "count"];
  const ARITY = {
    min: -1,
    max: -1,
    sum: -1,
    avg: -1,
    round: 2,
    floor: 1,
    ceil: 1,
    abs: 1,
    sqrt: 1,
    if: 3,
    pow: 2,
    mod: 2,
    clamp: 3,
    median: -1,
    product: -1,
    pct: 2,
    int: 1,
    sign: 1,
    count: -1
  };
  const isDigit = (char) => char >= "0" && char <= "9";
  const isAlpha = (char) => /[a-z_]/i.test(char);
  const isAlnum = (char) => /[a-z0-9_]/i.test(char);
  function tokenize(formula) {
    const tokens = [];
    const length = formula.length;
    let index = 0;
    let afterValue = false;
    while (index < length) {
      const char = formula[index];
      if (char === " " || char === "	" || char === "\n" || char === "\r") {
        index++;
        continue;
      }
      if (char === "{") {
        const close = formula.indexOf("}", index);
        if (close === -1) {
          return null;
        }
        tokens.push({ type: "var", value: formula.slice(index + 1, close).trim() });
        index = close + 1;
        afterValue = true;
        continue;
      }
      if (isDigit(char) || char === "." && index + 1 < length && isDigit(formula[index + 1])) {
        let number = "";
        while (index < length && (isDigit(formula[index]) || formula[index] === ".")) {
          number += formula[index];
          index++;
        }
        if (number.split(".").length > 2) {
          return null;
        }
        tokens.push({ type: "num", value: Number(number) });
        afterValue = true;
        continue;
      }
      if (isAlpha(char)) {
        let name = "";
        while (index < length && isAlnum(formula[index])) {
          name += formula[index];
          index++;
        }
        const lower = name.toLowerCase();
        if (lower === "true" || lower === "false") {
          tokens.push({ type: "num", value: lower === "true" ? 1 : 0 });
          afterValue = true;
          continue;
        }
        if (!FUNCTIONS.includes(lower)) {
          return null;
        }
        tokens.push({ type: "fn", value: lower });
        afterValue = false;
        continue;
      }
      if (char === "(") {
        tokens.push({ type: "open", value: "(" });
        afterValue = false;
        index++;
        continue;
      }
      if (char === ")") {
        tokens.push({ type: "close", value: ")" });
        afterValue = true;
        index++;
        continue;
      }
      if (char === ",") {
        tokens.push({ type: "comma", value: "," });
        afterValue = false;
        index++;
        continue;
      }
      const two = formula.slice(index, index + 2);
      if (["<=", ">=", "==", "!=", "&&", "||"].includes(two)) {
        tokens.push({ type: "op", value: two });
        afterValue = false;
        index += 2;
        continue;
      }
      if (["+", "-", "*", "/", "%", "^", "<", ">"].includes(char)) {
        tokens.push({ type: "op", value: char === "-" && !afterValue ? "u-" : char });
        afterValue = false;
        index++;
        continue;
      }
      return null;
    }
    return tokens;
  }
  function toRpn(tokens) {
    const output = [];
    const stack = [];
    const arity = [];
    for (const token of tokens) {
      if (token.type === "num" || token.type === "var") {
        output.push(token);
        continue;
      }
      if (token.type === "fn") {
        stack.push(token);
        arity.push(1);
        continue;
      }
      if (token.type === "comma") {
        while (stack.length && stack[stack.length - 1].type !== "open") {
          output.push(stack.pop());
        }
        if (!stack.length) {
          return null;
        }
        if (arity.length) {
          arity[arity.length - 1]++;
        }
        continue;
      }
      if (token.type === "op") {
        const precedence = PRECEDENCE[token.value];
        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.type !== "op") {
            break;
          }
          const topPrecedence = PRECEDENCE[top.value];
          if (topPrecedence > precedence || topPrecedence === precedence && !RIGHT_ASSOCIATIVE.includes(token.value)) {
            output.push(stack.pop());
            continue;
          }
          break;
        }
        stack.push(token);
        continue;
      }
      if (token.type === "open") {
        stack.push(token);
        continue;
      }
      if (token.type === "close") {
        while (stack.length && stack[stack.length - 1].type !== "open") {
          output.push(stack.pop());
        }
        if (!stack.length) {
          return null;
        }
        stack.pop();
        if (stack.length && stack[stack.length - 1].type === "fn") {
          const fn = stack.pop();
          fn.arity = arity.length ? arity.pop() : 1;
          const declared = ARITY[fn.value];
          if (declared !== void 0 && declared >= 0 && fn.arity !== declared && !("round" === fn.value && 1 === fn.arity)) {
            return null;
          }
          output.push(fn);
        }
      }
    }
    while (stack.length) {
      const top = stack.pop();
      if (top.type === "open") {
        return null;
      }
      output.push(top);
    }
    return output;
  }
  function apply(operator, left, right) {
    switch (operator) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return right === 0 ? 0 : left / right;
      case "%":
        return right === 0 ? 0 : left % right;
      case "^":
        return left ** right;
      case "<":
        return left < right ? 1 : 0;
      case ">":
        return left > right ? 1 : 0;
      case "<=":
        return left <= right ? 1 : 0;
      case ">=":
        return left >= right ? 1 : 0;
      case "==":
        return Math.abs(left - right) < 1e-6 ? 1 : 0;
      case "!=":
        return Math.abs(left - right) < 1e-6 ? 0 : 1;
      case "&&":
        return left !== 0 && right !== 0 ? 1 : 0;
      case "||":
        return left !== 0 || right !== 0 ? 1 : 0;
      default:
        return 0;
    }
  }
  function call(name, raw) {
    const args = VARIADIC.includes(name) ? flatten(raw) : raw.map(toNumber);
    switch (name) {
      case "min":
        return args.length ? Math.min(...args) : 0;
      case "max":
        return args.length ? Math.max(...args) : 0;
      case "sum":
        return args.reduce((total, one) => total + one, 0);
      case "avg":
        return args.length ? args.reduce((total, one) => total + one, 0) / args.length : 0;
      case "round": {
        if (!args.length) {
          return 0;
        }
        const precision = args.length > 1 ? Math.trunc(args[1]) : 0;
        const factor = 10 ** precision;
        const scaled = Number((args[0] * factor).toPrecision(15));
        const rounded = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
        return rounded / factor;
      }
      case "floor":
        return args.length ? Math.floor(args[0]) : 0;
      case "ceil":
        return args.length ? Math.ceil(args[0]) : 0;
      case "abs":
        return args.length ? Math.abs(args[0]) : 0;
      case "sqrt":
        return args.length && args[0] >= 0 ? Math.sqrt(args[0]) : 0;
      case "if":
        return args[0] !== 0 ? args[1] : args[2];
      case "pow": {
        const result = args[0] ** args[1];
        return Number.isFinite(result) ? result : 0;
      }
      case "mod":
        return args[1] === 0 ? 0 : args[0] % args[1];
      case "clamp": {
        const low = Math.min(args[1], args[2]);
        const high = Math.max(args[1], args[2]);
        return Math.min(high, Math.max(low, args[0]));
      }
      case "median": {
        if (!args.length) {
          return 0;
        }
        const sorted = args.slice().sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
      }
      case "product": {
        const product = args.reduce((carry, one) => carry * one, 1);
        return Number.isFinite(product) ? product : 0;
      }
      case "pct":
        return args[1] === 0 ? 0 : args[0] / args[1] * 100;
      case "int":
        return Math.trunc(args[0]);
      case "sign":
        return args[0] > 0 ? 1 : args[0] < 0 ? -1 : 0;
      case "count":
        return args.length;
      default:
        return 0;
    }
  }
  function evalRpn(rpn, values) {
    const stack = [];
    for (const token of rpn) {
      if (token.type === "num") {
        stack.push(Number(token.value));
        continue;
      }
      if (token.type === "var") {
        const raw = values[token.value];
        stack.push(Array.isArray(raw) ? raw.slice() : toNumber(raw));
        continue;
      }
      if (token.type === "op") {
        if (token.value === "u-") {
          if (!stack.length) {
            return null;
          }
          stack.push(-toNumber(stack.pop()));
          continue;
        }
        if (stack.length < 2) {
          return null;
        }
        const right = toNumber(stack.pop());
        const left = toNumber(stack.pop());
        stack.push(apply(token.value, left, right));
        continue;
      }
      if (token.type === "fn") {
        const arity = token.arity ?? 1;
        if (stack.length < arity) {
          return null;
        }
        stack.push(call(token.value, stack.splice(stack.length - arity, arity)));
        continue;
      }
      return null;
    }
    return stack.length === 1 ? toNumber(stack[0]) : null;
  }
  function calc(formula, values = {}) {
    const trimmed = String(formula ?? "").trim();
    if (trimmed === "") {
      return "";
    }
    const tokens = tokenize(trimmed);
    if (!tokens) {
      return "";
    }
    const rpn = toRpn(tokens);
    if (!rpn) {
      return "";
    }
    const result = evalRpn(rpn, values);
    if (result === null || Number.isNaN(result) || !Number.isFinite(result)) {
      return "";
    }
    return result;
  }
  function variables(formula) {
    const tokens = tokenize(String(formula ?? "")) ?? [];
    const names = [];
    for (const token of tokens) {
      if (token.type === "var" && !names.includes(token.value)) {
        names.push(token.value);
      }
    }
    return names;
  }
  registerMount("color_picker", (context) => {
    const { host, field, set } = context;
    const settings = field.settings;
    let current = String(context.value ?? "");
    const swatchRow = el("div", { class: "atcf-color__palette" });
    const picker = el("input", { class: "atcf-color__input", attrs: { type: "color" } });
    const text = control$1("os-text-field", "input", {
      class: "atcf-color__hex",
      attrs: { type: "text", placeholder: "#000000", "aria-label": "Hex" }
    });
    const apply2 = (value) => {
      current = value;
      text.value = value;
      picker.value = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
      set(value);
      markSelected();
    };
    const markSelected = () => {
      swatchRow.querySelectorAll(".atcf-color__swatch").forEach((swatch2) => {
        swatch2.setAttribute("aria-pressed", swatch2.dataset.color === current ? "true" : "false");
      });
    };
    (settings.palette ?? ["#1e1e1e", "#f0f0f1", "#3858e9", "#00a32a", "#d63638", "#dba617"]).forEach((swatch2) => {
      swatchRow.append(
        el("button", {
          class: "atcf-color__swatch",
          attrs: { type: "button", "aria-label": swatch2, "aria-pressed": "false" },
          dataset: { color: swatch2 },
          style: { backgroundColor: swatch2 },
          on: { click: () => apply2(swatch2) }
        })
      );
    });
    picker.addEventListener("input", () => apply2(picker.value));
    text.addEventListener("change", () => apply2(readValue(text).trim()));
    host.addEventListener("atcf:text-dropped", (event) => {
      const value = event.detail.text.trim();
      if (/^#?[0-9a-f]{3,8}$/i.test(value)) {
        apply2(value.startsWith("#") ? value : `#${value}`);
      }
    });
    host.append(el("div", { class: "atcf-color", children: [picker, text, swatchRow] }));
    apply2(current);
  });
  const ICONS = [
    "dashicons-admin-post",
    "dashicons-admin-page",
    "dashicons-admin-users",
    "dashicons-admin-home",
    "dashicons-cart",
    "dashicons-star-filled",
    "dashicons-heart",
    "dashicons-flag",
    "dashicons-location",
    "dashicons-calendar-alt",
    "dashicons-clock",
    "dashicons-email",
    "dashicons-phone",
    "dashicons-format-image",
    "dashicons-format-video",
    "dashicons-format-quote",
    "dashicons-tag",
    "dashicons-category",
    "dashicons-book",
    "dashicons-lightbulb",
    "dashicons-chart-bar",
    "dashicons-shield",
    "dashicons-awards",
    "dashicons-groups"
  ];
  registerMount("icon", (context) => {
    const { host, set } = context;
    let current = String(context.value ?? "");
    const preview2 = el("span", { class: "atcf-icon__preview" });
    const grid = el("div", { class: "atcf-icon__grid", attrs: { role: "radiogroup" } });
    const text = control$1("os-text-field", "input", {
      class: "atcf-icon__slug",
      attrs: { type: "text", placeholder: "dashicons-…", "aria-label": "Dashicons class" }
    });
    const apply2 = (value) => {
      current = value;
      text.value = value;
      clear(preview2);
      if (value) {
        preview2.append(icon(value));
      }
      grid.querySelectorAll(".atcf-icon__choice").forEach((choice) => {
        choice.setAttribute("aria-checked", choice.dataset.icon === value ? "true" : "false");
      });
      set(value);
    };
    grid.append(
      el("button", {
        class: "atcf-icon__choice",
        attrs: { type: "button", role: "radio", "aria-checked": "false", "aria-label": t("noIcon", "No icon") },
        dataset: { icon: "" },
        text: "—",
        on: { click: () => apply2("") }
      })
    );
    ICONS.forEach((slug2) => {
      grid.append(
        el("button", {
          class: "atcf-icon__choice",
          attrs: { type: "button", role: "radio", "aria-checked": "false", "aria-label": slug2 },
          dataset: { icon: slug2 },
          children: [icon(slug2)],
          on: { click: () => apply2(slug2) }
        })
      );
    });
    text.addEventListener("change", () => apply2(readValue(text).trim()));
    host.append(el("div", { class: "atcf-icon", children: [preview2, text, grid] }));
    apply2(current);
  });
  registerMount("location", (context) => {
    const { host, set } = context;
    const stored = context.value ?? {};
    const value = {
      lat: Number(stored.lat ?? 0),
      lng: Number(stored.lng ?? 0),
      address: String(stored.address ?? ""),
      zoom: Number(stored.zoom ?? 12)
    };
    const address = control$1("os-text-field", "input", {
      class: "atcf-location__address",
      attrs: { type: "text", placeholder: t("address", "Address"), "aria-label": t("address", "Address") }
    });
    const lat = el("input", { class: "atcf-location__lat", attrs: { type: "number", step: "any", "aria-label": t("latitude", "Latitude") } });
    const lng = el("input", { class: "atcf-location__lng", attrs: { type: "number", step: "any", "aria-label": t("longitude", "Longitude") } });
    const map = el("div", { class: "atcf-location__map" });
    const status = el("p", { class: "atcf-location__status", attrs: { role: "status" } });
    address.value = value.address;
    lat.value = value.lat ? String(value.lat) : "";
    lng.value = value.lng ? String(value.lng) : "";
    const push = () => {
      set(value.lat || value.lng ? { ...value } : "");
      drawMap();
    };
    const drawMap = () => {
      clear(map);
      if (!value.lat && !value.lng) {
        map.append(el("p", { class: "atcf-location__empty", text: t("empty", "Nothing here yet.") }));
        return;
      }
      const span = 0.02;
      const box2 = [value.lng - span, value.lat - span, value.lng + span, value.lat + span].join(",");
      map.append(
        el("iframe", {
          class: "atcf-location__frame",
          attrs: {
            src: `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(box2)}&marker=${value.lat},${value.lng}`,
            title: value.address || `${value.lat}, ${value.lng}`,
            loading: "lazy",
            referrerpolicy: "no-referrer"
          }
        })
      );
    };
    const geocode = debounce(async (query) => {
      if (query.trim().length < 3) {
        return;
      }
      status.textContent = t("searching", "Searching…");
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
          { headers: { Accept: "application/json" } }
        );
        const results = await response.json();
        if (!results.length) {
          status.textContent = t("noResults", "Nothing matched.");
          return;
        }
        value.lat = Number(results[0].lat);
        value.lng = Number(results[0].lon);
        lat.value = String(value.lat);
        lng.value = String(value.lng);
        status.textContent = results[0].display_name;
        push();
      } catch {
        status.textContent = "";
      }
    }, 600);
    address.addEventListener("change", () => {
      value.address = readValue(address);
      push();
    });
    lat.addEventListener("change", () => {
      value.lat = Number(lat.value);
      push();
    });
    lng.addEventListener("change", () => {
      value.lng = Number(lng.value);
      push();
    });
    host.append(
      el("div", {
        class: "atcf-location",
        children: [
          el("div", {
            class: "atcf-location__row",
            children: [
              address,
              button(t("findOnMap", "Find"), {
                on: { click: () => geocode(readValue(address)) }
              })
            ]
          }),
          el("div", { class: "atcf-location__coords", children: [lat, lng] }),
          status,
          map
        ]
      })
    );
    drawMap();
  });
  registerMount("table", (context) => {
    const { host, field, set } = context;
    const settings = field.settings;
    const columns = normalizeChoices(settings.columns);
    const max = Number(settings.max_items ?? 0);
    let rows = Array.isArray(context.value) ? context.value : [];
    const table = el("table", { class: "atcf-table" });
    const foot = el("div", { class: "atcf-table__foot" });
    const commit = () => {
      set(rows.map((row2) => ({ ...row2 })));
      draw2();
    };
    const draw2 = () => {
      clear(table);
      clear(foot);
      if (!columns.length) {
        table.append(el("caption", { text: "This table has no columns yet." }));
        return;
      }
      const head = el("tr");
      columns.forEach((column) => head.append(el("th", { text: column.label, attrs: { scope: "col" } })));
      head.append(el("th", { class: "atcf-table__gutter", attrs: { scope: "col" }, text: "" }));
      table.append(el("thead", { children: [head] }));
      const body = el("tbody");
      rows.forEach((row2, index) => {
        const tr = el("tr");
        columns.forEach((column) => {
          const input = el("input", {
            class: "atcf-table__cell",
            attrs: { type: "text", value: String(row2[column.value] ?? ""), "aria-label": column.label }
          });
          input.addEventListener("change", () => {
            row2[column.value] = input.value;
            set(rows.map((one) => ({ ...one })));
          });
          tr.append(el("td", { children: [input] }));
        });
        tr.append(
          el("td", {
            children: [
              el("button", {
                class: "atcf-table__remove",
                text: "×",
                attrs: { type: "button", "aria-label": t("remove", "Remove") },
                on: {
                  click: () => {
                    rows.splice(index, 1);
                    commit();
                  }
                }
              })
            ]
          })
        );
        body.append(tr);
      });
      table.append(body);
      if (!max || rows.length < max) {
        foot.append(
          button(t("addRow", "Add row"), {
            on: {
              click: () => {
                const row2 = {};
                columns.forEach((column) => {
                  row2[column.value] = "";
                });
                rows.push(row2);
                commit();
              }
            }
          })
        );
      }
    };
    host.append(table, foot);
    draw2();
  });
  registerMount("json", (context) => {
    const { host, field, set } = context;
    const settings = field.settings;
    const area = control$1("os-textarea", "textarea", {
      class: "atcf-input atcf-input--code",
      attrs: { rows: Number(settings.rows ?? 8), spellcheck: "false" }
    });
    const status = el("p", { class: "atcf-json__status", attrs: { role: "status" } });
    area.value = typeof context.value === "string" ? context.value : JSON.stringify(context.value ?? null, null, 2);
    area.addEventListener("input", () => {
      const raw = readValue(area);
      if (raw.trim() === "") {
        status.textContent = "";
        set("");
        return;
      }
      try {
        JSON.parse(raw);
        status.textContent = "";
        status.classList.remove("is-invalid");
        set(raw);
      } catch {
        status.textContent = t("invalidJson", "That is not valid JSON.");
        status.classList.add("is-invalid");
      }
    });
    host.append(el("div", { class: "atcf-json", children: [area, status] }));
  });
  registerMount("oembed", (context) => {
    const { host, set } = context;
    const input = control$1("os-text-field", "input", {
      class: "atcf-input",
      attrs: { type: "url", placeholder: "https://" }
    });
    const preview2 = el("div", { class: "atcf-oembed__preview" });
    input.value = String(context.value ?? "");
    const refresh = debounce(() => {
      const url = readValue(input).trim();
      set(url);
      clear(preview2);
      if (!url) {
        return;
      }
      preview2.append(el("a", { text: url, attrs: { href: url, target: "_blank", rel: "noreferrer noopener" } }));
    }, 300);
    input.addEventListener("input", refresh);
    host.append(el("div", { class: "atcf-oembed", children: [input, preview2] }));
    refresh();
  });
  registerMount("computed", (context) => {
    const { host, field, wrapper } = context;
    const settings = field.settings;
    const output = el("output", { class: "atcf-computed__value" });
    const recompute = () => {
      const values = {};
      const scope2 = wrapper.closest(".atcf-fields, .atcf-row__body") ?? document.body;
      scope2.querySelectorAll("[data-atcf-field]").forEach((sibling) => {
        const name = sibling.dataset.atcfName ?? "";
        const key = sibling.dataset.atcfField ?? "";
        const input = sibling.querySelector("input, select, textarea");
        if (!input) {
          return;
        }
        const raw = input.type === "checkbox" ? input.checked ? "1" : "0" : input.value;
        values[name] = raw;
        values[key] = raw;
      });
      const result = calc(String(settings.formula ?? ""), values);
      const decimals = Math.max(0, Math.min(10, Number(settings.decimals ?? 2)));
      output.textContent = result === "" ? "—" : `${settings.prepend ?? ""}${Number(result).toFixed(decimals)}${settings.append ?? ""}`;
    };
    const scope = wrapper.closest(".atcf-fields, .atcf-row__body") ?? document.body;
    scope.addEventListener("input", recompute);
    scope.addEventListener("change", recompute);
    host.append(
      el("div", {
        class: "atcf-computed",
        children: [
          output,
          el("span", {
            class: "atcf-computed__note",
            text: "Worked out from the other fields. The saved value is the server’s own."
          })
        ]
      })
    );
    recompute();
    return () => {
      scope.removeEventListener("input", recompute);
      scope.removeEventListener("change", recompute);
    };
  });
  const SHAPES = {
    // Things you type into.
    text: "text",
    email: "text",
    url: "text",
    password: "text",
    number: "text",
    date_picker: "text",
    date_time_picker: "text",
    time_picker: "text",
    page_link: "text",
    oembed: "text",
    icon: "text",
    textarea: "textarea",
    wysiwyg: "textarea",
    code: "textarea",
    json: "textarea",
    select: "select",
    taxonomy: "select",
    radio: "options",
    checkbox: "options",
    button_group: "options",
    true_false: "toggle",
    range: "range",
    color_picker: "colour",
    image: "media",
    file: "media",
    gallery: "media",
    post_object: "relational",
    relationship: "relational",
    user: "relational",
    link: "relational",
    location: "relational",
    group: "container",
    repeater: "container",
    flexible_content: "container",
    clone: "container",
    table: "container",
    message: "static",
    tab: "static",
    accordion: "static",
    computed: "computed"
  };
  function shapeFor(type) {
    return SHAPES[type] ?? "text";
  }
  function renderFieldPreview(field, type, handlers = {}) {
    const settings = field.settings ?? {};
    const shape = shapeFor(field.type);
    const wrap = el("div", {
      class: `atcf-fields atcfb__preview atcfb__preview--${shape}`
    });
    const body = el("div", {
      class: `atcf-field atcf-field--${field.type}${field.required ? " atcf-field--required" : ""}`,
      style: { "--atcf-width": "100%" }
    });
    if ("static" !== shape && "toggle" !== shape) {
      body.append(
        el("div", {
          class: "atcf-field__header",
          children: [
            el("span", {
              class: "atcf-field__label",
              children: [
                // The handler itself, not an arrow that closes over it.
                // An arrow is always truthy, so wrapping one made every
                // preview editable — including the read-only ones in the
                // preview window, where a `contenteditable` in a pane
                // nothing listens to is a box that swallows typing.
                editable(field.label, "Name this field…", handlers.onLabel),
                field.required ? el("span", { class: "atcf-field__required", text: " *" }) : null
              ]
            })
          ]
        })
      );
    }
    body.append(
      el("div", {
        class: "atcf-field__control",
        children: [control(shape, field, settings, type, handlers)]
      })
    );
    body.append(
      el("p", {
        class: "atcf-field__hint",
        children: [
          editable(field.instructions, "Add a hint…", handlers.onInstructions)
        ]
      })
    );
    wrap.append(body);
    return wrap;
  }
  function editable(value, placeholder2, onInput, onCommit) {
    if (!onInput && !onCommit) {
      return el("span", { text: value });
    }
    const node = el("span", {
      class: "atcfb__editable",
      text: value,
      attrs: {
        contenteditable: "plaintext-only",
        role: "textbox",
        spellcheck: "false",
        "data-placeholder": placeholder2
      }
    });
    node.addEventListener("input", () => onInput?.(node.textContent ?? ""));
    if (onCommit) {
      node.addEventListener("blur", () => onCommit(node.textContent ?? ""));
    }
    node.addEventListener("pointerdown", (event) => event.stopPropagation());
    node.addEventListener("click", (event) => event.stopPropagation());
    node.addEventListener("keydown", (event) => {
      const key = event.key;
      if ("Enter" === key) {
        event.preventDefault();
        node.blur();
      }
      event.stopPropagation();
    });
    node.setText = (next) => {
      if (node.textContent !== next) {
        node.textContent = next;
      }
    };
    return node;
  }
  function control(shape, field, settings, type, handlers) {
    const placeholder2 = () => editable(
      String(settings.placeholder ?? ""),
      "Placeholder…",
      handlers.onSetting && ((value) => handlers.onSetting?.("placeholder", value))
    );
    switch (shape) {
      case "text":
        return box(placeholder2(), "atcf-input");
      case "textarea":
        return box(placeholder2(), "atcf-input atcfb__preview-box--tall");
      case "select":
        return el("div", {
          class: "atcfb__preview-select",
          children: [box(firstChoice$1(settings, handlers), "atcf-input")]
        });
      case "options":
        return options(field, settings, handlers);
      case "toggle":
        return el("span", {
          class: "atcf-switch",
          children: [
            el("span", { class: "atcf-switch__track", attrs: { "aria-hidden": "true" } }),
            el("span", {
              class: "atcf-switch__label",
              children: [
                editable(
                  String(settings.message ?? "") || field.label,
                  "What does this turn on?…",
                  handlers.onLabel
                )
              ]
            })
          ]
        });
      case "range":
        return el("div", { class: "atcfb__preview-range" });
      case "colour":
        return el("div", {
          class: "atcfb__preview-colour",
          style: { background: swatch(settings) }
        });
      case "media":
        return el("div", {
          class: "atcfb__preview-drop",
          text: "gallery" === field.type ? "Drop images here" : "Drop a file here"
        });
      case "relational":
        return box(
          editable(
            "",
            "location" === field.type ? "Search for an address…" : "Search…",
            void 0
          ),
          "atcf-input atcfb__preview-search"
        );
      case "container":
        return el("div", {
          class: "atcfb__preview-rows",
          children: [
            el("div", { class: "atcfb__preview-row" }),
            el("div", { class: "atcfb__preview-row" }),
            el("span", {
              class: "atcfb__preview-add",
              children: [
                editable(
                  String(settings.button_label ?? ""),
                  "Add row",
                  handlers.onSetting && ((value) => handlers.onSetting?.("button_label", value))
                )
              ]
            })
          ]
        });
      case "static":
        return el("div", {
          class: `atcfb__preview-static atcfb__preview-static--${field.type}`,
          children: [
            editable(
              String(settings.message ?? "") || field.label || String(type?.label ?? field.type),
              "message" === field.type ? "Write the note…" : "Name this section…",
              handlers.onLabel
            )
          ]
        });
      case "computed":
        return el("div", {
          class: "atcfb__preview-computed",
          children: [
            el("span", { class: "atcfb__preview-computed-value", text: "—" }),
            el("code", {
              class: "atcfb__preview-formula",
              text: String(settings.formula ?? "no formula yet")
            })
          ]
        });
      default:
        return box(placeholder2(), "atcf-input");
    }
  }
  function box(inside, css) {
    return el("div", { class: `${css} atcfb__preview-box`, children: [inside] });
  }
  function options(field, settings, handlers) {
    const list = Array.isArray(settings.choices) ? settings.choices : [];
    const buttons = "button_group" === field.type;
    const wrap = el("div", {
      class: `atcf-choices atcf-choices--${String(settings.layout ?? "vertical")}${buttons ? " atcf-choices--buttons" : ""}`
    });
    const commit = (next) => handlers.onChoices?.(
      // `||`, not `??`. A new option arrives with an empty string for both,
      // and `??` only catches null — so every added option was named `` and
      // two of them collided on the same value.
      next.map((one, index) => ({
        value: String(one.value || one.label || `option_${index + 1}`),
        label: String(one.label ?? one.value ?? "")
      }))
    );
    list.slice(0, 6).forEach((choice, index) => {
      const row2 = el("span", {
        class: "atcf-choice atcfb__preview-option",
        children: [
          el("span", { class: "atcfb__preview-tick", attrs: { "aria-hidden": "true" } }),
          el("span", {
            class: "atcf-choice__label",
            children: [
              editable(
                String(choice.label ?? choice.value ?? ""),
                `Option ${index + 1}…`,
                handlers.onChoices && ((value) => {
                  const next = list.slice();
                  next[index] = { ...next[index], label: value };
                  commit(next);
                })
              )
            ]
          })
        ]
      });
      if (handlers.onChoices) {
        row2.append(
          el("button", {
            class: "atcfb__preview-remove",
            text: "×",
            attrs: { type: "button", "aria-label": `Remove option ${index + 1}` },
            on: {
              click: (event) => {
                event.stopPropagation();
                commit(list.filter((_, at) => at !== index));
              }
            }
          })
        );
      }
      wrap.append(row2);
    });
    if (list.length > 6) {
      wrap.append(
        el("span", { class: "atcfb__preview-more", text: `and ${list.length - 6} more` })
      );
    }
    if (handlers.onChoices) {
      wrap.append(
        el("button", {
          class: "atcfb__preview-addoption",
          text: list.length ? "Add an option" : "Add the first option",
          attrs: { type: "button" },
          on: {
            click: (event) => {
              event.stopPropagation();
              commit(list.concat([{ value: "", label: "" }]));
            }
          }
        })
      );
    }
    return wrap;
  }
  function firstChoice$1(settings, handlers) {
    const list = Array.isArray(settings.choices) ? settings.choices : [];
    const first = list[0];
    return editable(
      String(first?.label ?? first?.value ?? ""),
      "Add the first option…",
      handlers.onChoices && ((value) => {
        const next = list.length ? list.slice() : [{ value: "", label: "" }];
        next[0] = { ...next[0], label: value };
        handlers.onChoices?.(
          next.map((one, index) => ({
            value: String(one.value || one.label || `option_${index + 1}`),
            label: String(one.label ?? one.value ?? "")
          }))
        );
      })
    );
  }
  function swatch(settings) {
    const value = String(settings.default_value ?? "");
    return /^#[0-9a-f]{6}$/i.test(value) ? value : "#3858e9";
  }
  const WIDTHS = [
    { value: 25, label: "¼", title: "A quarter of the row — four fit side by side" },
    { value: 33, label: "⅓", title: "A third of the row — three fit side by side" },
    { value: 50, label: "½", title: "Half the row — two fit side by side" },
    { value: 66, label: "⅔", title: "Two thirds of the row" },
    { value: 75, label: "¾", title: "Three quarters of the row" },
    { value: 100, label: "Full", title: "The whole row to itself" }
  ];
  function renderWidthPicker(width, onChange) {
    const current = width || 100;
    const wrap = el("div", {
      class: "atcfb__width",
      attrs: { role: onChange ? "radiogroup" : "group", "aria-label": "How wide this field is" }
    });
    wrap.append(el("span", { class: "atcfb__width-legend", text: "Width" }));
    WIDTHS.forEach((option) => {
      const chosen = option.value === current;
      const button2 = el(onChange ? "button" : "span", {
        class: `atcfb__width-option${chosen ? " is-chosen" : ""}`,
        attrs: {
          ...onChange ? { type: "button", role: "radio", "aria-checked": chosen ? "true" : "false" } : {},
          title: option.title
        },
        children: [
          // The bar *is* the explanation. A row-wide track with the field's
          // share filled in says "three of these fit" without the sentence.
          el("span", {
            class: "atcfb__width-bar",
            children: [
              el("span", {
                class: "atcfb__width-fill",
                style: { inlineSize: `${option.value}%` }
              })
            ]
          }),
          el("span", { class: "atcfb__width-label", text: option.label })
        ]
      });
      if (onChange) {
        button2.addEventListener("click", (event) => {
          event.stopPropagation();
          onChange(option.value);
        });
      }
      wrap.append(button2);
    });
    if (!WIDTHS.some((one) => one.value === current)) {
      wrap.append(el("span", { class: "atcfb__width-custom", text: `${current}%` }));
    }
    return wrap;
  }
  function renderCanvas(host, opts) {
    clear(host);
    const list = el("div", { class: "atcfb__cards", attrs: { role: "list" } });
    if (!opts.fields.length) {
      list.append(
        el("div", {
          class: "atcfb__empty",
          children: [
            icon("dashicons-plus-alt2"),
            el("p", { text: "Drag a field from the palette, or press one to add it here." })
          ]
        })
      );
    }
    opts.fields.forEach((field, index) => {
      list.append(card(field, index, opts));
    });
    host.append(list);
  }
  function registerCanvasTarget(host, getOptions) {
    return dragManager().registerDropTarget({
      // Stable, so the shell's registry replaces in place rather than
      // accumulating one dead entry per redraw.
      id: "allterrain-fields/canvas",
      element: host,
      accept: (payload) => payload.type === config().dragTypes.field,
      onEnter: () => host.classList.add("is-drop-target"),
      onLeave: () => host.classList.remove("is-drop-target"),
      onDrop: (session, point) => {
        host.classList.remove("is-drop-target");
        const opts = getOptions();
        const list = host.querySelector(".atcfb__cards") ?? host;
        const data = session.payload.data;
        const index = insertionIndex(list, ".atcfb__card", point.clientY);
        if (data.kind === "new" && data.type) {
          opts.onAdd(data.type, index);
          return;
        }
        if (data.kind === "existing" && data.key && isOwn(list, data.key)) {
          opts.onMove(data.key, index);
          return;
        }
        if (data.field) {
          opts.onDrop(data.field, index);
        }
      }
    });
  }
  function isOwn(list, key) {
    return Boolean(list.querySelector(`[data-atcf-card="${CSS.escape(key)}"]`));
  }
  function card(field, index, opts) {
    const type = opts.types[field.type];
    const selected = opts.selected === field.key;
    const cardId = uid("atcf-card");
    const element = el("div", {
      class: `atcfb__card${selected ? " is-selected" : ""}${field.required ? " is-required" : ""}`,
      attrs: {
        role: "listitem",
        tabindex: "0",
        id: cardId,
        "aria-current": selected ? "true" : "false"
      },
      dataset: { atcfCard: field.key, index: String(index) }
    });
    element.append(
      el("div", {
        class: "atcfb__card-main",
        children: [
          icon(type?.icon ?? "dashicons-editor-code", { class: "atcfb__card-icon" }),
          // The type, and nothing else. The label used to be here *and* in
          // the preview below, which is the same words twice — and put the
          // one thing you rewrite most often in the row you cannot type
          // into. It lives in the preview now, editable where it sits.
          el("div", {
            class: "atcfb__card-text",
            children: [
              el("span", { class: "atcfb__card-type", text: type?.label ?? field.type }),
              // The meta key, editable. It is the string a theme writes in
              // `get_post_meta()`, so it is the one piece of a field a
              // developer changes on purpose — and it was the only text on
              // the card that could not be touched.
              //
              // Corrected on blur rather than per keystroke: typing
              // "Price per" and watching every space become an underscore
              // under the caret is a control that fights you.
              el("code", {
                class: "atcfb__card-name",
                children: [
                  editable(
                    field.name,
                    "meta_key",
                    void 0,
                    opts.onName && ((value) => opts.onName?.(field.key, value))
                  )
                ]
              })
            ]
          }),
          el("div", {
            class: "atcfb__card-actions",
            children: [
              button("Duplicate", {
                class: "atcfb__card-action",
                on: {
                  click: (event) => {
                    event.stopPropagation();
                    opts.onDuplicate(field.key);
                  }
                }
              }),
              button("Delete", {
                class: "atcfb__card-action atcfb__card-action--danger",
                on: {
                  click: (event) => {
                    event.stopPropagation();
                    opts.onRemove(field.key);
                  }
                }
              })
            ]
          })
        ]
      })
    );
    element.append(
      renderFieldPreview(field, type, {
        onLabel: opts.onLabel && ((value) => opts.onLabel?.(field.key, value)),
        onInstructions: opts.onInstructions && ((value) => opts.onInstructions?.(field.key, value)),
        onSetting: opts.onSetting && ((key, value) => opts.onSetting?.(field.key, key, value)),
        onChoices: opts.onChoices && ((choices) => opts.onChoices?.(field.key, choices))
      })
    );
    if (field.conditional?.enabled && field.conditional.rules.length) {
      element.append(conditionChips(field, opts));
    }
    if (field.type === "computed") {
      const names = variables(String(field.settings.formula ?? ""));
      const row2 = el("div", {
        class: "atcfb__card-condition atcfb__card-condition--formula",
        children: [
          el("span", { class: "atcfb__chip atcfb__chip--kind", text: "WORKED OUT FROM" }),
          ...names.length ? names.map((name) => el("span", { class: "atcfb__chip", text: name })) : [el("span", { class: "atcfb__chip atcfb__chip--empty", text: "nothing yet" })]
        ]
      });
      if (opts.onEditFormula) {
        row2.append(
          button("Edit formula", {
            class: "atcfb__card-formula",
            variant: "primary",
            on: {
              click: (event) => {
                event.stopPropagation();
                opts.onEditFormula?.(field.key);
              }
            }
          })
        );
      }
      element.append(row2);
    }
    element.append(
      renderWidthPicker(
        field.wrapper?.width ?? 100,
        opts.onWidth && ((value) => opts.onWidth?.(field.key, value))
      )
    );
    element.addEventListener("click", () => opts.onSelect(field.key));
    element.addEventListener("keydown", (event) => {
      const key = event.key;
      if (key === "Enter" || key === " ") {
        event.preventDefault();
        opts.onSelect(field.key);
        return;
      }
      if (event.altKey && key === "ArrowUp") {
        event.preventDefault();
        opts.onMove(field.key, Math.max(0, index - 1));
        return;
      }
      if (event.altKey && key === "ArrowDown") {
        event.preventDefault();
        opts.onMove(field.key, index + 1);
        return;
      }
      if (key === "Delete" || key === "Backspace") {
        event.preventDefault();
        opts.onRemove(field.key);
      }
    });
    element.addEventListener("pointerdown", (event) => {
      const ghost = el("div", {
        class: "atcf-drag-ghost atcf-drag-ghost--field",
        children: [
          icon(type?.icon ?? "dashicons-editor-code"),
          el("span", { text: field.label || field.name })
        ]
      });
      startDrag(event, {
        payload: buildPayload(
          config().dragTypes.field,
          element,
          // The whole field travels, not just its key. That is what lets a
          // card dropped into a *second builder window* be reconstructed
          // there — the receiving window has never heard of this field and
          // cannot look it up.
          { kind: "existing", key: field.key, type: field.type, field },
          event,
          ghost
        ),
        origin: event,
        onClickOnly: () => opts.onSelect(field.key),
        onCancel: () => void 0
      });
    });
    return element;
  }
  function conditionChips(field, opts) {
    const row2 = el("div", { class: "atcfb__card-condition" });
    row2.append(
      el("span", {
        class: "atcfb__chip atcfb__chip--kind",
        text: field.conditional.action === "hide" ? "HIDDEN WHEN" : "SHOWN WHEN"
      })
    );
    field.conditional.rules.forEach((rule, index) => {
      const controller = opts.fields.find((one) => one.key === rule.field);
      if (index > 0) {
        row2.append(
          el("span", {
            class: "atcfb__chip atcfb__chip--join",
            text: field.conditional.match === "any" ? "or" : "and"
          })
        );
      }
      row2.append(
        el("button", {
          class: `atcfb__chip atcfb__chip--field${controller ? "" : " atcfb__chip--broken"}`,
          attrs: { type: "button" },
          text: controller ? controller.label || controller.name : "a field that has been deleted",
          on: {
            click: (event) => {
              event.stopPropagation();
              if (controller) {
                opts.onSelect(controller.key);
              }
            }
          }
        })
      );
      row2.append(el("span", { class: "atcfb__chip atcfb__chip--op", text: humanOperator(rule.operator) }));
      if (!["empty", "not_empty"].includes(rule.operator)) {
        row2.append(
          el("span", {
            class: "atcfb__chip atcfb__chip--value",
            text: Array.isArray(rule.value) ? rule.value.join(", ") : String(rule.value)
          })
        );
      }
    });
    return row2;
  }
  function humanOperator(operator) {
    const words = {
      is: "is",
      is_not: "is not",
      contains: "contains",
      not_contains: "does not contain",
      starts_with: "starts with",
      ends_with: "ends with",
      greater: "is more than",
      greater_equal: "is at least",
      less: "is less than",
      less_equal: "is at most",
      empty: "is empty",
      not_empty: "has any value",
      in: "is one of",
      not_in: "is none of"
    };
    return words[operator] ?? operator;
  }
  function tokenizeFormula(source, vocabulary) {
    const fields = new Set(vocabulary.fields);
    const functions = new Set(vocabulary.functions.map((one) => one.toLowerCase()));
    const tokens = [];
    let index = 0;
    let pending2 = "";
    const flush = () => {
      if (pending2) {
        tokens.push({ kind: "text", text: pending2, name: "", known: true });
        pending2 = "";
      }
    };
    while (index < source.length) {
      const rest = source.slice(index);
      const field = /^\{([^{}]*)\}/.exec(rest);
      if (field) {
        flush();
        tokens.push({
          kind: "field",
          text: field[0],
          name: field[1],
          known: fields.has(field[1])
        });
        index += field[0].length;
        continue;
      }
      const call2 = /^([A-Za-z_][A-Za-z0-9_]*)(\s*)\(/.exec(rest);
      if (call2) {
        flush();
        tokens.push({
          kind: "function",
          text: call2[1],
          name: call2[1],
          known: functions.has(call2[1].toLowerCase())
        });
        index += call2[1].length;
        continue;
      }
      const number = /^\d+(\.\d+)?/.exec(rest);
      if (number) {
        flush();
        tokens.push({ kind: "number", text: number[0], name: "", known: true });
        index += number[0].length;
        continue;
      }
      if ("+-*/%^".includes(rest[0])) {
        flush();
        tokens.push({ kind: "operator", text: rest[0], name: "", known: true });
        index += 1;
        continue;
      }
      pending2 += rest[0];
      index += 1;
    }
    flush();
    return tokens;
  }
  function unknownNames(tokens) {
    const out = [];
    tokens.forEach((token) => {
      if (token.known || !token.name || out.includes(token.name)) {
        return;
      }
      out.push(token.name);
    });
    return out;
  }
  function bracketsBalance(source) {
    let depth = 0;
    for (const character of source) {
      if ("(" === character) {
        depth += 1;
      } else if (")" === character) {
        depth -= 1;
        if (depth < 0) {
          return false;
        }
      }
    }
    return 0 === depth;
  }
  function renderFormulaEditor(opts) {
    const vocabulary = {
      fields: opts.fields.map((one) => one.name),
      functions: opts.functions
    };
    const box2 = el("div", {
      class: "atcfb__formula",
      attrs: {
        contenteditable: "true",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Formula",
        spellcheck: "false",
        "data-placeholder": "{price} * {quantity}"
      }
    });
    const problems = el("p", { class: "atcfb__formula-problem" });
    const hint = el("p", { class: "atcfb__formula-hint" });
    const explains = (node, text) => {
      const show = () => {
        hint.textContent = text;
      };
      const clear2 = () => {
        hint.textContent = "";
      };
      node.addEventListener("pointerenter", show);
      node.addEventListener("focus", show);
      node.addEventListener("pointerleave", clear2);
      node.addEventListener("blur", clear2);
    };
    let source = opts.value;
    let shape = "";
    const paint = (force = false) => {
      const tokens = tokenizeFormula(source, vocabulary);
      const next = tokens.filter((token) => "field" === token.kind || "function" === token.kind).map((token) => `${token.kind}:${token.name}:${token.known}`).join("|");
      if (!force && next === shape) {
        say(tokens);
        return;
      }
      shape = next;
      const focused = box2.ownerDocument.activeElement === box2;
      const caret = caretOffset(box2);
      box2.replaceChildren(...tokens.map(paintToken));
      if (focused) {
        box2.focus({ preventScroll: true });
      }
      if (caret !== null) {
        setCaret(box2, caret);
      }
      say(tokens);
    };
    const say = (tokens) => {
      const unknown = unknownNames(tokens);
      const notes = [];
      if (unknown.length) {
        notes.push(
          `Nothing here is called ${unknown.map((one) => `“${one}”`).join(", ")}.`
        );
      }
      if (source.trim() && !bracketsBalance(source)) {
        notes.push("The brackets do not close.");
      }
      problems.textContent = notes.join(" ");
      problems.classList.toggle("is-shown", notes.length > 0);
    };
    box2.addEventListener("input", () => {
      source = readText(box2);
      paint();
      opts.onChange(source);
    });
    box2.addEventListener("keydown", (event) => {
      if ("Enter" === event.key) {
        event.preventDefault();
      }
    });
    box2.addEventListener("paste", (event) => {
      const clipboard = event.clipboardData;
      if (!clipboard) {
        return;
      }
      event.preventDefault();
      insertAtCaret(box2, clipboard.getData("text/plain").replace(/\s+/g, " "));
      source = readText(box2);
      lastCaret = caretOffset(box2);
      paint(true);
      opts.onChange(source);
    });
    let lastCaret = null;
    const remember = () => {
      const at = caretOffset(box2);
      if (at !== null) {
        lastCaret = at;
      }
    };
    ["keyup", "mouseup", "input", "select"].forEach((name) => box2.addEventListener(name, remember));
    const insert = (text, caretBack = 0) => {
      const at = lastCaret ?? readText(box2).length;
      const before = readText(box2);
      source = before.slice(0, at) + text + before.slice(at);
      lastCaret = at + text.length - caretBack;
      box2.textContent = source;
      paint(true);
      box2.focus();
      setCaret(box2, lastCaret);
      opts.onChange(source);
    };
    const palette = el("div", { class: "atcfb__formula-palette" });
    if (opts.onExpand) {
      palette.append(
        el("button", {
          class: "atcfb__formula-expand",
          text: "Editor…",
          attrs: { type: "button", title: "Open the full editor, with sample values and the function reference" },
          on: { click: () => opts.onExpand?.(source) }
        })
      );
    }
    if (opts.fields.length) {
      palette.append(el("span", { class: "atcfb__formula-legend", text: "Fields" }));
      opts.fields.forEach((field) => {
        const chip = el("button", {
          class: "atcfb__chip atcfb__chip--field",
          text: field.label || field.name,
          attrs: { type: "button" },
          on: { click: () => insert(`{${field.name}}`) }
        });
        explains(chip, `{${field.name}} — the value of “${field.label || field.name}”`);
        palette.append(chip);
      });
    }
    palette.append(el("span", { class: "atcfb__formula-legend", text: "Functions" }));
    opts.functions.forEach((name) => {
      const chip = el("button", {
        class: "atcfb__chip atcfb__chip--fn",
        text: `${name}()`,
        attrs: { type: "button" },
        // The caret lands **inside** the brackets. A function inserted with
        // the caret after it means every single use is followed by pressing
        // Left, and nobody thanks an editor for that.
        on: { click: () => insert(`${name}()`, 1) }
      });
      explains(chip, FUNCTION_HELP[name] ?? `${name}()`);
      palette.append(chip);
    });
    paint(true);
    const wrap = el("div", { class: "atcfb__formula-wrap", children: [box2, problems, palette, hint] });
    wrap.setFormula = (next) => {
      source = next;
      lastCaret = null;
      box2.textContent = next;
      paint(true);
      opts.onChange(source);
    };
    return wrap;
  }
  const FUNCTION_HELP = {
    min: "min(a, b, …) — the smallest of them",
    max: "max(a, b, …) — the largest of them",
    sum: "sum(a, b, …) — everything added up",
    avg: "avg(a, b, …) — the average",
    median: "median(a, b, …) — the middle one when sorted",
    product: "product(a, b, …) — everything multiplied together",
    round: "round(number, places) — rounded. Leave off places for a whole number",
    floor: "floor(number) — rounded down, always",
    ceil: "ceil(number) — rounded up, always",
    int: "int(number) — the decimals dropped",
    abs: "abs(number) — without the minus sign",
    sign: "sign(number) — 1 up, −1 down, 0 unchanged",
    sqrt: "sqrt(number) — the square root",
    pow: "pow(number, power) — number multiplied by itself, power times",
    mod: "mod(number, divide_by) — the remainder after dividing",
    clamp: "clamp(number, lowest, highest) — kept inside a range",
    pct: "pct(part, whole) — what percentage part is of whole",
    if: "if(test, then, otherwise) — test with > < == != && ||, then one answer or the other"
  };
  function paintToken(token) {
    if ("field" === token.kind || "function" === token.kind) {
      return el("span", {
        class: `atcfb__token atcfb__token--${token.kind}${token.known ? "" : " is-unknown"}`,
        text: token.text,
        attrs: {
          contenteditable: "false",
          title: token.known ? void 0 : `Nothing on this site is called “${token.name}”.`
        }
      });
    }
    return document.createTextNode(token.text);
  }
  function readText(box2) {
    return (box2.textContent ?? "").replace(/ /g, " ");
  }
  function caretOffset(box2) {
    const selection = box2.ownerDocument.getSelection();
    if (!selection || !selection.rangeCount) {
      return null;
    }
    const range = selection.getRangeAt(0);
    if (!box2.contains(range.startContainer)) {
      return null;
    }
    const measure = range.cloneRange();
    measure.selectNodeContents(box2);
    measure.setEnd(range.startContainer, range.startOffset);
    return measure.toString().length;
  }
  function setCaret(box2, offset) {
    const selection = box2.ownerDocument.getSelection();
    if (!selection) {
      return;
    }
    let remaining = offset;
    const range = box2.ownerDocument.createRange();
    for (const child of Array.from(box2.childNodes)) {
      const length = (child.textContent ?? "").length;
      if (remaining > length) {
        remaining -= length;
        continue;
      }
      if (child.nodeType === Node.TEXT_NODE) {
        range.setStart(child, remaining);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      if (0 === remaining) {
        range.setStartBefore(child);
      } else {
        range.setStartAfter(child);
      }
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    range.selectNodeContents(box2);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  function insertAtCaret(box2, text, caretBack = 0) {
    const at = caretOffset(box2) ?? readText(box2).length;
    const before = readText(box2);
    const next = before.slice(0, at) + text + before.slice(at);
    box2.textContent = next;
    setCaret(box2, at + text.length - caretBack);
  }
  const DOCS = {
    min: {
      signature: "min(a, b, …)",
      what: "Gives you the smallest of the numbers you list.",
      params: [{ name: "a, b, …", what: "As many numbers, number fields or repeater columns as you like." }],
      example: { formula: "min({list_price}, {sale_price})", gives: "the lower of the two prices" }
    },
    max: {
      signature: "max(a, b, …)",
      what: "Gives you the largest of the numbers you list.",
      params: [{ name: "a, b, …", what: "As many numbers, number fields or repeater columns as you like." }],
      example: { formula: "max({stock}, 0)", gives: "the stock level, but never below zero" }
    },
    sum: {
      signature: "sum(a, b, …)",
      what: "Adds everything up.",
      params: [
        {
          name: "a, b, …",
          what: "Any mixture of numbers, number fields, and repeater columns — separated by commas. A repeater column is written {repeater.field} and stands for that field in every row."
        }
      ],
      example: { formula: "sum({lines.amount})", gives: "the total of the Amount column across every row" },
      note: "Three at once is fine: sum({subtotal}, {delivery}, {lines.surcharge})."
    },
    avg: {
      signature: "avg(a, b, …)",
      what: "The average — everything added up, divided by how many there were.",
      params: [{ name: "a, b, …", what: "Numbers, number fields or repeater columns." }],
      example: { formula: "avg({reviews.stars})", gives: "the average rating across every review row" }
    },
    count: {
      signature: "count(a, b, …)",
      what: "How many there are — rows in a repeater, or things you listed.",
      params: [{ name: "a, b, …", what: "Usually one repeater column: count({lines.amount}) is the number of rows." }],
      example: { formula: "round(sum({lines.amount}) / count({lines.amount}), 2)", gives: "the average line, worked out the long way" },
      note: "A plain field counts as one. This is how you get “per row” figures that avg() does not give you."
    },
    median: {
      signature: "median(a, b, …)",
      what: "The middle number once they are sorted.",
      params: [{ name: "a, b, …", what: "Numbers, number fields or repeater columns." }],
      example: { formula: "median({price_a}, {price_b}, {price_c})", gives: "250000 for 180000, 250000 and 320000" },
      note: "Use this instead of the average when one very high or very low number would drag the answer somewhere unhelpful."
    },
    product: {
      signature: "product(a, b, …)",
      what: "Multiplies everything together.",
      params: [{ name: "a, b, …", what: "Numbers, number fields or repeater columns." }],
      example: { formula: "product({qty}, {unit_price}, 1.21)", gives: "36.3 for 3 at 10.00 plus 21% tax" }
    },
    round: {
      signature: "round(number, places)",
      what: "Rounds a number.",
      params: [
        { name: "number", what: "What to round." },
        { name: "places", what: "How many decimal places to keep. Leave it off for a whole number." }
      ],
      example: { formula: "round({price} * 1.21, 2)", gives: "121.00 for a price of 100" }
    },
    floor: {
      signature: "floor(number)",
      what: "Rounds down, always — even at .99.",
      params: [{ name: "number", what: "What to round down." }],
      example: { formula: "floor({minutes} / 60)", gives: "2 for 155 minutes — whole hours only" }
    },
    ceil: {
      signature: "ceil(number)",
      what: "Rounds up, always — even at .01. How many boxes you need.",
      params: [{ name: "number", what: "What to round up." }],
      example: { formula: "ceil({items} / 12)", gives: "3 for 25 items in boxes of 12" }
    },
    int: {
      signature: "int(number)",
      what: "Drops the decimals and keeps the whole number.",
      params: [{ name: "number", what: "What to cut down." }],
      example: { formula: "int({total_hours})", gives: "7 for 7.8" },
      note: "Different from floor on negatives: int(−4.9) is −4, floor(−4.9) is −5. int always moves toward zero."
    },
    abs: {
      signature: "abs(number)",
      what: "Throws away the minus sign, so you get the size of a difference without its direction.",
      params: [{ name: "number", what: "The number, positive or negative." }],
      example: { formula: "abs({budget} - {spent})", gives: "50 whether you are 50 over or 50 under" }
    },
    sign: {
      signature: "sign(number)",
      what: "Tells you which way something went: 1 for up, −1 for down, 0 for no change.",
      params: [{ name: "number", what: "Usually a difference between two fields." }],
      example: { formula: "sign({price_now} - {price_was})", gives: "−1 when the price has come down" }
    },
    sqrt: {
      signature: "sqrt(number)",
      what: "The square root — the number that, times itself, gives you this one.",
      params: [{ name: "number", what: "What to take the root of." }],
      example: { formula: "sqrt({area})", gives: "12 for an area of 144 — the side of a square" }
    },
    pow: {
      signature: "pow(number, power)",
      what: "Multiplies a number by itself, a given number of times.",
      params: [
        { name: "number", what: "The number to raise." },
        { name: "power", what: "How many times. 2 squares it, 3 cubes it, 0.5 gives the square root." }
      ],
      example: { formula: "pow({side}, 2)", gives: "25 for a side of 5 — the area of a square" },
      note: "The ^ symbol does exactly the same thing: {side} ^ 2."
    },
    mod: {
      signature: "mod(number, divide_by)",
      what: "The remainder left over after dividing.",
      params: [
        { name: "number", what: "What to divide." },
        { name: "divide_by", what: "What to divide it by." }
      ],
      example: { formula: "mod({position}, 2)", gives: "0 on even positions, 1 on odd ones" },
      note: "The usual reason to want this is “every other one” or “every third one”."
    },
    clamp: {
      signature: "clamp(number, lowest, highest)",
      what: "Keeps a number inside a range — never below the lowest, never above the highest.",
      params: [
        { name: "number", what: "The value to keep in range." },
        { name: "lowest", what: "The smallest it is allowed to be." },
        { name: "highest", what: "The largest it is allowed to be." }
      ],
      example: { formula: "clamp({stock}, 0, 999)", gives: "0 when the stock has gone negative" }
    },
    pct: {
      signature: "pct(part, whole)",
      what: "Works out what percentage the part is of the whole.",
      params: [
        { name: "part", what: "The smaller amount — the bit you are measuring." },
        { name: "whole", what: "The total it is a part of." }
      ],
      example: { formula: "pct({price} - {cost}, {price})", gives: "25 for a price of 120 and a cost of 90" },
      note: "Safe when the whole is zero: you get 0 rather than an error. Writing part / whole * 100 by hand is not."
    },
    if: {
      signature: "if(test, then, otherwise)",
      what: "Asks a question and gives you one of two answers depending on the result.",
      params: [
        {
          name: "test",
          what: "A comparison. Use  >  <  >=  <=  ==  (is equal to) or  !=  (is not equal to). Join two with && for “both” or || for “either”."
        },
        { name: "then", what: "What to use when the test is true." },
        { name: "otherwise", what: "What to use when it is not. This one is not optional." }
      ],
      example: { formula: "if({qty} > 10, {price} * 0.9, {price})", gives: "10% off once somebody orders more than ten" },
      note: "Two tests at once: if({qty} > 10 && {member} == 1, {price} * 0.8, {price})."
    }
  };
  const READS = [
    {
      what: "A number field in this group",
      how: "{price} — write the field’s name in braces. It is the name under the label on the card, not the label."
    },
    {
      what: "A switch",
      how: "{in_stock} — on counts as 1, off as 0. So {price} * {in_stock} is the price, or nothing."
    },
    {
      what: "Another computed field",
      how: "{subtotal} — worked out first, then used. Two computed fields cannot read each other, though."
    },
    {
      what: "A whole repeater column",
      how: "{lines.amount} — the Amount field from every row. Give it to sum(), avg(), min(), max() or count()."
    },
    {
      what: "A field inside a group",
      how: "{address.postcode} — the same dotted form. A group is one row, so it is one value."
    },
    {
      what: "Anything that is not a number",
      how: "Counts as 0 — a date, an image, an empty field. Nothing breaks; the sum is just smaller."
    }
  ];
  const OPERATORS = [
    { symbol: "+  −  *  /", what: "Add, subtract, multiply, divide." },
    { symbol: "( )", what: "Do this bit first. {a} + {b} * 2 is not the same as ({a} + {b}) * 2." },
    { symbol: "^", what: "To the power of. {side} ^ 2 is {side} squared." },
    { symbol: "%", what: "The remainder after dividing. Same as mod()." },
    { symbol: ">  <  >=  <=", what: "Bigger than, smaller than, and the “or equal to” versions. For use inside if()." },
    { symbol: "==  !=", what: "Is equal to, is not equal to. Two equals signs, not one." },
    { symbol: "&&  ||", what: "“And” and “or”, for joining two tests inside if()." }
  ];
  function openFormulaLab(opts) {
    let formula = opts.value;
    const samples = {};
    opts.fields.forEach((field, index) => {
      samples[field.name] = String([100, 4, 25, 12, 3][index % 5]);
    });
    const answer = el("output", { class: "atcfl__answer" });
    const used = el("p", { class: "atcfl__used" });
    const inputs = el("div", { class: "atcfl__samples" });
    const evaluate = () => {
      const named = variables(formula);
      const values = {};
      Object.entries(samples).forEach(([name, raw]) => {
        values[name] = Number(raw) || 0;
      });
      const result = calc(formula, values);
      answer.textContent = "" === result ? "—" : String(result);
      answer.classList.toggle("is-empty", "" === result);
      used.textContent = named.length ? `Using ${named.map((one) => `{${one}}`).join(", ")}` : "This formula reads no fields.";
      Array.from(inputs.children).forEach((child) => {
        const node = child;
        const name = node.dataset.field ?? "";
        node.hidden = !named.includes(name);
      });
      const missing = named.filter((name) => !(name in samples));
      unknown.textContent = missing.length ? `Nothing on this site is called ${missing.map((one) => `“${one}”`).join(", ")}.` : "";
      unknown.classList.toggle("is-shown", missing.length > 0);
    };
    const unknown = el("p", { class: "atcfl__unknown" });
    opts.fields.forEach((field) => {
      const box2 = el("input", {
        class: "atcfl__sample-input",
        attrs: { type: "number", step: "any", value: samples[field.name] }
      });
      box2.addEventListener("input", () => {
        samples[field.name] = box2.value;
        evaluate();
      });
      inputs.append(
        el("label", {
          class: "atcfl__sample",
          dataset: { field: field.name },
          children: [
            el("span", { class: "atcfl__sample-name", text: field.label || field.name }),
            box2
          ]
        })
      );
    });
    const setFormula = (next) => {
      formula = next;
      editor.setFormula?.(next);
      evaluate();
    };
    const editor = renderFormulaEditor({
      value: opts.value,
      fields: opts.fields,
      functions: opts.functions,
      onChange: (next) => {
        formula = next;
        evaluate();
      }
    });
    const reference = el("div", { class: "atcfl__reference" });
    opts.functions.forEach((name) => {
      const doc = DOCS[name];
      if (!doc) {
        reference.append(
          el("div", { class: "atcfl__doc", children: [el("code", { class: "atcfl__doc-sig", text: `${name}()` })] })
        );
        return;
      }
      reference.append(
        el("details", {
          class: "atcfl__doc",
          children: [
            el("summary", {
              class: "atcfl__doc-head",
              children: [
                el("code", { class: "atcfl__doc-sig", text: doc.signature }),
                el("span", { class: "atcfl__doc-what", text: doc.what })
              ]
            }),
            // Every parameter named and explained. A signature alone is
            // only documentation to somebody who already knows what the
            // parameters mean, which is exactly the person who does not
            // need it.
            el("dl", {
              class: "atcfl__doc-params",
              children: doc.params.flatMap((param) => [
                el("dt", { text: param.name }),
                el("dd", { text: param.what })
              ])
            }),
            el("div", {
              class: "atcfl__doc-eg",
              children: [
                el("code", { text: doc.example.formula }),
                el("span", { class: "atcfl__doc-gives", text: `gives ${doc.example.gives}` }),
                el("button", {
                  class: "atcfl__doc-try",
                  text: "Try it",
                  attrs: { type: "button", title: "Put this example in the box above" },
                  on: {
                    click: () => {
                      setFormula(doc.example.formula);
                    }
                  }
                })
              ]
            }),
            doc.note ? el("p", { class: "atcfl__doc-note", text: doc.note }) : null
          ]
        })
      );
    });
    const operators = el("dl", {
      class: "atcfl__operators",
      children: OPERATORS.flatMap((one) => [
        el("dt", { text: one.symbol }),
        el("dd", { text: one.what })
      ])
    });
    const body = el("div", {
      class: "atcfl__body",
      children: [
        el("div", {
          class: "atcfl__work",
          children: [
            editor,
            used,
            unknown,
            el("h3", { class: "atcfl__heading", text: "Try it" }),
            el("p", {
              class: "atcfl__lead",
              text: "Put a value against each field and watch the answer. These are only for trying — nothing here is saved to any post."
            }),
            inputs,
            el("div", {
              class: "atcfl__result",
              children: [el("span", { text: "Answer" }), answer]
            })
          ]
        }),
        el("div", {
          class: "atcfl__manual",
          children: [
            el("h3", { class: "atcfl__heading", text: "What a formula can read" }),
            el("dl", {
              class: "atcfl__reads",
              children: READS.flatMap((one) => [
                el("dt", { text: one.what }),
                el("dd", { text: one.how })
              ])
            }),
            el("h3", { class: "atcfl__heading", text: "The basics" }),
            el("p", {
              class: "atcfl__lead",
              text: "Everything else is ordinary arithmetic. Press any chip above to put a field or a function in."
            }),
            operators,
            el("h3", { class: "atcfl__heading", text: "Functions" }),
            el("p", {
              class: "atcfl__lead",
              text: "Open one to see what each part of it means, and press Try it to load the example."
            }),
            reference
          ]
        })
      ]
    });
    const save = el("button", {
      class: "atcfl__save",
      text: "Use this formula",
      attrs: { type: "button", slot: "footer" },
      on: {
        click: () => {
          opts.onSave(formula);
          close();
        }
      }
    });
    const cancel = el("button", {
      class: "atcfl__cancel",
      text: "Cancel",
      attrs: { type: "button", slot: "footer" },
      on: { click: () => close() }
    });
    const opener = document.activeElement;
    let dialog;
    let onKey = null;
    const close = () => {
      dialog.remove();
      if (onKey) {
        document.removeEventListener("keydown", onKey);
      }
      opener?.focus();
    };
    if (hasComponent("os-modal")) {
      dialog = el("os-modal", {
        class: "atcfl",
        attrs: { open: "", title: "Formula", size: "lg" },
        children: [body, save, cancel]
      });
      dialog.addEventListener("os-modal-cancel", () => close());
    } else {
      onKey = (event) => {
        if ("Escape" === event.key) {
          close();
        }
      };
      document.addEventListener("keydown", onKey);
      dialog = el("div", {
        class: "atcfl atcfl--own",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "Formula editor" },
        children: [
          el("div", { class: "atcfl__scrim", on: { click: () => close() } }),
          el("div", {
            class: "atcfl__panel",
            children: [
              el("div", {
                class: "atcfl__head",
                children: [
                  icon("dashicons-calculator"),
                  el("h2", { text: "Formula" }),
                  el("button", {
                    class: "atcfl__close",
                    text: "×",
                    attrs: { type: "button", "aria-label": "Close" },
                    on: { click: () => close() }
                  })
                ]
              }),
              body,
              el("div", { class: "atcfl__foot", children: [save, cancel] })
            ]
          })
        ]
      });
    }
    document.body.append(dialog);
    evaluate();
    dialog.querySelector(".atcfb__formula")?.focus();
    return dialog;
  }
  const FORMULA_TOPICS = {
    hello: "os.allterrain-fields.formula-hello",
    context: "os.allterrain-fields.formula-context",
    result: "os.allterrain-fields.formula-result"
  };
  function mountFormulaWindow(root) {
    const waiting = root.querySelector("[data-atcflw-waiting]");
    const panes = root.querySelector("[data-atcflw-panes]");
    const work = root.querySelector("[data-atcflw-work]");
    const manual = root.querySelector("[data-atcflw-manual]");
    const foot = root.querySelector("[data-atcflw-foot]");
    if (!panes || !work || !manual || !foot) {
      return;
    }
    whenShellReady(() => {
      const os = shell();
      const id = windowIdOf(root);
      const session = String((id ? os?.getWindowParams?.(id) : void 0)?.session ?? "");
      os?.subscribe?.(FORMULA_TOPICS.context, (payload) => {
        const context = payload;
        if (!context || !Array.isArray(context.fields)) {
          return;
        }
        waiting?.remove();
        panes.hidden = false;
        foot.hidden = false;
        draw({ work, manual, foot, context, os });
      });
      os?.broadcast?.(FORMULA_TOPICS.hello, { session });
    });
  }
  function draw(args) {
    const { work, manual, foot, context, os } = args;
    let formula = context.formula;
    const samples = {};
    context.fields.forEach((field, index) => {
      samples[field.name] = [100, 4, 25, 12, 3][index % 5];
    });
    const answer = el("output", { class: "atcfl__answer" });
    const used = el("p", { class: "atcfl__used" });
    const unknown = el("p", { class: "atcfl__unknown" });
    const inputs = el("div", { class: "atcfl__samples" });
    const evaluate = () => {
      const named = variables(formula);
      const result = calc(formula, samples);
      answer.textContent = "" === result ? "—" : String(result);
      answer.classList.toggle("is-empty", "" === result);
      used.textContent = named.length ? `Using ${named.map((one) => `{${one}}`).join(", ")}` : "This formula reads no fields yet.";
      Array.from(inputs.children).forEach((child) => {
        const node = child;
        node.hidden = !named.includes(node.dataset.field ?? "");
      });
      const missing = named.filter((name) => !(name in samples));
      unknown.textContent = missing.length ? `Nothing in this field group is called ${missing.map((one) => `“${one}”`).join(", ")}.` : "";
      unknown.classList.toggle("is-shown", missing.length > 0);
    };
    context.fields.forEach((field) => {
      const input = numberField(samples[field.name], {}, (value) => {
        samples[field.name] = Number(value) || 0;
        evaluate();
      });
      inputs.append(
        el("div", {
          class: "atcfl__sample",
          dataset: { field: field.name },
          children: [
            el("span", { class: "atcfl__sample-name", text: field.label || field.name }),
            input
          ]
        })
      );
    });
    const editor = renderFormulaEditor({
      value: context.formula,
      fields: context.fields,
      functions: context.functions,
      onChange: (next) => {
        formula = next;
        evaluate();
      }
    });
    const setFormula = (next) => {
      formula = next;
      editor.setFormula?.(next);
      evaluate();
    };
    work.replaceChildren(
      el("h2", { class: "atcflw__title", text: context.label || "Formula" }),
      editor,
      used,
      unknown,
      el("h3", { class: "atcfl__heading", text: "Try it" }),
      el("p", {
        class: "atcfl__lead",
        text: "Put a value against each field and watch the answer. These are only for trying — nothing here is saved to any post."
      }),
      inputs,
      el("div", {
        class: "atcfl__result",
        children: [el("span", { text: "Answer" }), answer]
      })
    );
    manual.replaceChildren(
      el("h3", { class: "atcfl__heading", text: "What a formula can read" }),
      el("dl", {
        class: "atcfl__reads",
        children: READS.flatMap((one) => [
          el("dt", { text: one.what }),
          el("dd", { text: one.how })
        ])
      }),
      el("h3", { class: "atcfl__heading", text: "The basics" }),
      el("p", {
        class: "atcfl__lead",
        text: "Everything else is ordinary arithmetic. Press any chip above to put a field or a function in."
      }),
      el("dl", {
        class: "atcfl__operators",
        children: OPERATORS.flatMap((one) => [
          el("dt", { text: one.symbol }),
          el("dd", { text: one.what })
        ])
      }),
      el("h3", { class: "atcfl__heading", text: "Functions" }),
      el("p", {
        class: "atcfl__lead",
        text: "Open one to see what each part of it means, and press Try it to load the example."
      }),
      renderReference(context.functions, setFormula)
    );
    const status = el("span", { class: "atcflw__status" });
    foot.replaceChildren(
      status,
      el("button", {
        class: "atcfl__save",
        text: "Use this formula",
        attrs: { type: "button" },
        on: {
          click: () => {
            os?.broadcast?.(FORMULA_TOPICS.result, { session: context.session, formula });
            status.textContent = "Sent to the builder.";
            window.setTimeout(() => {
              status.textContent = "";
            }, 2600);
          }
        }
      })
    );
    evaluate();
    work.querySelector(".atcfb__formula")?.focus();
  }
  function renderReference(functions, onTry) {
    const reference = el("div", { class: "atcfl__reference" });
    functions.forEach((name) => {
      const doc = DOCS[name];
      if (!doc) {
        reference.append(
          el("div", {
            class: "atcfl__doc",
            children: [el("code", { class: "atcfl__doc-sig", text: `${name}()` })]
          })
        );
        return;
      }
      reference.append(
        el("details", {
          class: "atcfl__doc",
          children: [
            el("summary", {
              class: "atcfl__doc-head",
              children: [
                el("code", { class: "atcfl__doc-sig", text: doc.signature }),
                el("span", { class: "atcfl__doc-what", text: doc.what })
              ]
            }),
            el("dl", {
              class: "atcfl__doc-params",
              children: doc.params.flatMap((param) => [
                el("dt", { text: param.name }),
                el("dd", { text: param.what })
              ])
            }),
            el("div", {
              class: "atcfl__doc-eg",
              children: [
                el("code", { text: doc.example.formula }),
                el("span", { class: "atcfl__doc-gives", text: `gives ${doc.example.gives}` }),
                el("button", {
                  class: "atcfl__doc-try",
                  text: "Try it",
                  attrs: { type: "button", title: "Put this example in the box above" },
                  on: { click: () => onTry(doc.example.formula) }
                })
              ]
            }),
            doc.note ? el("p", { class: "atcfl__doc-note", text: doc.note }) : null
          ]
        })
      );
    });
    return reference;
  }
  let sessions = 0;
  function openFormulaWindow(request2) {
    const os = shell();
    const windowId = config().formulaWindow;
    if (!os?.openWindow || !os.broadcast || !os.subscribe || !windowId) {
      return false;
    }
    sessions += 1;
    const session = `atcf-${sessions}-${Math.random().toString(36).slice(2, 8)}`;
    const context = {
      session,
      label: request2.label,
      formula: request2.formula,
      fields: request2.fields,
      functions: request2.functions
    };
    const stopHello = os.subscribe(FORMULA_TOPICS.hello, (payload) => {
      const said = payload?.session ?? "";
      if (said && said !== session) {
        return;
      }
      os.broadcast?.(FORMULA_TOPICS.context, context);
    });
    const stopResult = os.subscribe(FORMULA_TOPICS.result, (payload) => {
      const message = payload;
      if (message?.session !== session || typeof message.formula !== "string") {
        return;
      }
      request2.onResult(message.formula);
    });
    teardowns.push(() => {
      stopHello?.();
      stopResult?.();
    });
    while (teardowns.length > MAX_SESSIONS) {
      teardowns.shift()?.();
    }
    os.openWindow(windowId, { source: "allterrain-fields-builder", params: { session } });
    os.broadcast(FORMULA_TOPICS.context, context);
    return true;
  }
  const MAX_SESSIONS = 4;
  const teardowns = [];
  function syncInspector(host, opts) {
    const field = opts.field;
    if (!field) {
      return;
    }
    host.querySelectorAll("[data-atcfb-bind]").forEach((node) => {
      const bind2 = node.dataset.atcfbBind ?? "";
      const setting = bind2.startsWith("setting:") ? bind2.slice(8) : "";
      const value = setting ? field.settings[setting] : field[bind2];
      if (value === void 0 || value === null) {
        return;
      }
      if ("object" === typeof value) {
        const kind = setting ? opts.config.settingControls[setting]?.control : "";
        const fresh = kind ? settingControl(setting, kind, field, opts) : null;
        if (!fresh) {
          return;
        }
        fresh.id = node.id;
        fresh.dataset.atcfbBind = bind2;
        node.replaceWith(fresh);
        return;
      }
      const control2 = node;
      if (control2.value !== String(value)) {
        control2.value = String(value);
      }
    });
  }
  function renderInspector(host, opts) {
    clear(host);
    if (!opts.field) {
      host.append(
        el("div", {
          class: "atcfb__inspector-empty",
          children: [el("p", { text: "Select a field to change it." })]
        })
      );
      return;
    }
    const field = opts.field;
    const type = opts.config.fieldTypes.find((one) => one.type === field.type);
    const supports = type?.supports ?? [];
    host.append(
      el("header", {
        class: "atcfb__inspector-head",
        children: [
          el("h2", { class: "atcfb__inspector-title", text: field.label || field.name }),
          el("p", { class: "atcfb__inspector-type", text: type?.label ?? field.type })
        ]
      })
    );
    const panes = el("div", { class: "atcfb__panes" });
    panes.append(fieldPane(field, opts, supports));
    if (supports.includes("conditional")) {
      panes.append(conditionalPane(field, opts));
    }
    panes.append(advancedPane(field, opts, type?.settings ?? {}));
    host.append(panes);
  }
  function pane(title, open2, children) {
    const details = el("details", { class: "atcfb__pane", attrs: { open: open2 ? true : null } });
    details.append(el("summary", { class: "atcfb__pane-title", text: title }));
    children.forEach((child) => child && details.append(child));
    return details;
  }
  function row(label, node, hint = "", bind2 = "") {
    const id = node.id || uid("atcf-set");
    node.id = id;
    if (bind2) {
      node.dataset.atcfbBind = bind2;
    }
    return el("div", {
      class: "atcfb__row",
      children: [
        el("label", { class: "atcfb__row-label", text: label, attrs: { for: id } }),
        node,
        hint ? el("p", { class: "atcfb__row-hint", text: hint }) : null
      ]
    });
  }
  function fieldPane(field, opts, supports) {
    const rows = [];
    rows.push(
      row(
        "Label",
        textField(field.label, {}, (value) => opts.onChange({ label: value })),
        "What whoever fills this in will read.",
        "label"
      )
    );
    rows.push(
      row(
        "Name",
        textField(field.name, {}, (value) => opts.onChange({ name: value })),
        "The meta key. `get_post_meta( $id, '" + field.name + "', true )` reads it.",
        "name"
      )
    );
    rows.push(
      row(
        "Instructions",
        textArea(field.instructions, { attrs: { rows: 2 } }, (value) => opts.onChange({ instructions: value })),
        "Shown under the field.",
        "instructions"
      )
    );
    if (supports.includes("required")) {
      rows.push(toggle(field.required, "Required", (on) => opts.onChange({ required: on }), { block: true }));
    }
    if (supports.includes("readonly")) {
      rows.push(toggle(field.readonly, "Read only", (on) => opts.onChange({ readonly: on }), { block: true }));
    }
    const controls = opts.config.settingControls;
    const typeSettings = opts.config.fieldTypes.find((one) => one.type === field.type)?.settings ?? {};
    Object.keys(typeSettings).forEach((key) => {
      if (!controls[key]) {
        return;
      }
      const kind = controls[key].control;
      const node = settingControl(key, kind, field, opts);
      if (!node) {
        return;
      }
      rows.push("switch" === kind ? node : row(controls[key].label, node, "", `setting:${key}`));
    });
    return pane("Field", true, rows);
  }
  function settingControl(key, kind, field, opts) {
    const value = field.settings[key];
    const typing = ["text", "textarea", "number", "formula"].includes(kind);
    const change = (next) => opts.onSettingChange(key, next, typing);
    switch (kind) {
      case "text":
        return textField(String(value ?? ""), {}, change);
      case "textarea":
        return textArea(String(value ?? ""), { attrs: { rows: 3 } }, change);
      case "number":
        return numberField(String(value ?? ""), {}, (next) => change(next === "" ? "" : Number(next)));
      case "switch":
        return toggle(Boolean(value), settingLabel(key, opts), (on) => change(on), { block: true });
      case "select":
        return select(String(value ?? ""), selectChoicesFor(key, field, opts.config), change);
      case "choices":
        return choiceEditor(value, change);
      case "post-types":
        return multiSelect(opts.config.postTypes, toStringList(value), change);
      case "taxonomies":
        return multiSelect(opts.config.taxonomies, toStringList(value), change);
      case "taxonomy":
        return select(
          String(value ?? ""),
          Object.entries(opts.config.taxonomies).map(([slug2, label]) => ({ value: slug2, label })),
          change
        );
      case "roles":
        return multiSelect(opts.config.roles, toStringList(value), change);
      case "field-ref":
        return fieldPicker(value, opts, change);
      case "formula":
        return formulaEditor(String(value ?? ""), opts, change);
      case "columns":
        return choiceEditor(value, change);
      default:
        return textField(String(value ?? ""), {}, change);
    }
  }
  function settingLabel(key, opts) {
    return opts.config.settingControls[key]?.label ?? key;
  }
  function selectChoicesFor(key, field, config2) {
    const named = {
      preview_size: config2.imageSizes,
      return_format: returnFormatsFor(field.type),
      layout: { block: "Block", table: "Table", row: "Row", vertical: "Vertical", horizontal: "Horizontal" },
      toolbar: { full: "Full", basic: "Basic", none: "No toolbar" },
      new_lines: { wpautop: "Paragraphs", br: "Line breaks", "": "Leave alone" },
      library: { all: "Everything", uploadedTo: "Uploaded to this post" },
      display: { seamless: "Seamless", group: "As a group" }
    };
    const source = named[key] ?? {};
    return Object.entries(source).map(([value, label]) => ({ value, label }));
  }
  function returnFormatsFor(type) {
    if (["image", "file"].includes(type)) {
      return { array: "Everything about it", url: "Just the URL", id: "Just the ID" };
    }
    if (type === "gallery") {
      return { array: "Everything about each one", url: "URLs", id: "IDs" };
    }
    if (["post_object", "relationship"].includes(type)) {
      return { object: "The post objects", id: "Just the IDs" };
    }
    if (type === "taxonomy") {
      return { object: "The term objects", id: "Just the IDs" };
    }
    if (type === "user") {
      return { array: "Everything about them", id: "Just the IDs" };
    }
    if (type === "link") {
      return { array: "URL, text and target", url: "Just the URL" };
    }
    if (type === "color_picker") {
      return { string: "The hex string", array: "Red, green, blue, alpha" };
    }
    return { value: "The value", label: "The label", both: "Both" };
  }
  function toStringList(value) {
    if (Array.isArray(value)) {
      return value.map(String);
    }
    return value === "" || value === void 0 || value === null ? [] : [String(value)];
  }
  function multiSelect(choices, selected, onChange) {
    const chosen = new Set(selected);
    const box2 = el("div", { class: "atcfb__multiselect", attrs: { role: "group" } });
    Object.entries(choices).forEach(([slug2, label]) => {
      const input = el("input", { attrs: { type: "checkbox", value: slug2 } });
      input.checked = chosen.has(slug2);
      input.addEventListener("change", () => {
        if (input.checked) {
          chosen.add(slug2);
        } else {
          chosen.delete(slug2);
        }
        onChange(Array.from(chosen));
      });
      box2.append(el("label", { class: "atcfb__multiselect-item", children: [input, el("span", { text: label })] }));
    });
    return box2;
  }
  function choiceEditor(value, onChange) {
    let choices = normalizeChoices(value);
    const box2 = el("div", { class: "atcfb__choices" });
    const draw2 = () => {
      clear(box2);
      choices.forEach((choice, index) => {
        const valueInput = el("input", {
          class: "atcfb__choice-value",
          attrs: { type: "text", value: choice.value, "aria-label": "Value", placeholder: "value" }
        });
        const labelInput = el("input", {
          class: "atcfb__choice-label",
          attrs: { type: "text", value: choice.label, "aria-label": "Label", placeholder: "Label" }
        });
        valueInput.addEventListener("change", () => {
          choices[index].value = valueInput.value;
          onChange([...choices]);
        });
        labelInput.addEventListener("change", () => {
          choices[index].label = labelInput.value;
          onChange([...choices]);
        });
        box2.append(
          el("div", {
            class: "atcfb__choice",
            children: [
              valueInput,
              labelInput,
              el("button", {
                class: "atcfb__choice-remove",
                text: "×",
                attrs: { type: "button", "aria-label": `Remove ${choice.label}` },
                on: {
                  click: () => {
                    choices.splice(index, 1);
                    onChange([...choices]);
                    draw2();
                  }
                }
              })
            ]
          })
        );
      });
      box2.append(
        button("Add a choice", {
          class: "atcfb__choices-add",
          on: {
            click: () => {
              choices.push({ value: "", label: "" });
              draw2();
            }
          }
        })
      );
    };
    draw2();
    return box2;
  }
  function fieldPicker(value, opts, onChange) {
    const current = Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
    const choices = [{ value: "", label: "— none —" }].concat(
      opts.fields.filter((one) => one.key !== opts.field?.key).map((one) => ({ value: one.key, label: `${one.label || one.name} (${one.type})` }))
    );
    return select(current, choices, onChange);
  }
  function formulaEditor(value, opts, onChange) {
    const usable = ["number", "range", "computed", "true_false"];
    const fields = opts.fields.filter((one) => one.key !== opts.field?.key && usable.includes(one.type)).map((one) => ({ name: one.name, label: one.label || one.name }));
    opts.fields.forEach((parent) => {
      const subs = parent.settings?.sub_fields ?? [];
      if (!Array.isArray(subs)) {
        return;
      }
      subs.forEach((sub) => {
        if (!usable.includes(sub.type)) {
          return;
        }
        fields.push({
          name: `${parent.name}.${sub.name}`,
          label: `${sub.label || sub.name} · every row`
        });
      });
    });
    const node = renderFormulaEditor({
      value,
      fields,
      functions: opts.config.calcFunctions,
      onChange,
      onExpand: (current) => {
        const put = (next) => node.setFormula?.(next);
        if (!openFormulaWindow({
          label: opts.field?.label || opts.field?.name || "Formula",
          formula: current,
          fields,
          functions: opts.config.calcFunctions,
          onResult: put
        })) {
          openFormulaLab({
            value: current,
            fields,
            functions: opts.config.calcFunctions,
            onSave: put
          });
        }
      }
    });
    return node;
  }
  function conditionalPane(field, opts) {
    const conditional = field.conditional;
    const rows = [];
    rows.push(
      toggle(
        conditional.enabled,
        "Only show this sometimes",
        (on) => opts.onChange({ conditional: { ...conditional, enabled: on } })
      )
    );
    if (conditional.enabled) {
      rows.push(
        row(
          "Then",
          select(
            conditional.action,
            [
              { value: "show", label: "Show this field" },
              { value: "hide", label: "Hide this field" }
            ],
            (value) => opts.onChange({ conditional: { ...conditional, action: value } })
          )
        )
      );
      rows.push(
        row(
          "When",
          select(
            conditional.match,
            [
              { value: "all", label: "All of these are true" },
              { value: "any", label: "Any of these are true" }
            ],
            (value) => opts.onChange({ conditional: { ...conditional, match: value } })
          )
        )
      );
      const list = el("div", { class: "atcfb__rules" });
      conditional.rules.forEach((rule, index) => {
        list.append(ruleRow(rule, index, field, opts));
      });
      list.append(
        button("Add a condition", {
          class: "atcfb__rules-add",
          on: {
            click: () => {
              const first = opts.fields.find((one) => one.key !== field.key);
              opts.onChange({
                conditional: {
                  ...conditional,
                  enabled: true,
                  rules: [...conditional.rules, { field: first?.key ?? "", operator: "is", value: "" }]
                }
              });
            }
          }
        })
      );
      rows.push(list);
    }
    return pane("Conditional", conditional.enabled, rows);
  }
  function ruleRow(rule, index, field, opts) {
    const update = (patch) => {
      const rules = opts.field ? [...opts.field.conditional.rules] : [];
      rules[index] = { ...rules[index], ...patch };
      opts.onChange({ conditional: { ...field.conditional, rules } });
    };
    const fieldChoices = opts.fields.filter((one) => one.key !== field.key).map((one) => ({ value: one.key, label: one.label || one.name }));
    const operatorChoices = Object.entries(opts.config.operators).map(([value, label]) => ({ value, label }));
    const needsValue = !["empty", "not_empty"].includes(rule.operator);
    return el("div", {
      class: "atcfb__rule",
      children: [
        select(rule.field, fieldChoices, (value) => update({ field: value })),
        select(rule.operator, operatorChoices, (value) => update({ operator: value })),
        needsValue ? textField(
          Array.isArray(rule.value) ? rule.value.join(", ") : String(rule.value),
          {},
          (value) => update({ value })
        ) : null,
        el("button", {
          class: "atcfb__rule-remove",
          text: "×",
          attrs: { type: "button", "aria-label": "Remove this condition" },
          on: {
            click: () => {
              const rules = field.conditional.rules.filter((_one, position) => position !== index);
              opts.onChange({ conditional: { ...field.conditional, rules } });
            }
          }
        })
      ]
    });
  }
  function advancedPane(field, opts, typeSettings) {
    const rows = [];
    rows.push(
      row(
        "Width",
        numberField(
          field.wrapper.width,
          { attrs: { min: 10, max: 100, step: 5 } },
          (value) => opts.onChange({ wrapper: { ...field.wrapper, width: Number(value) || 100 } })
        ),
        "Per cent of the column. Two fields at 50 sit side by side."
      )
    );
    rows.push(
      row(
        "CSS class",
        textField(field.wrapper.class, {}, (value) => opts.onChange({ wrapper: { ...field.wrapper, class: value } }))
      )
    );
    rows.push(
      row(
        "Wrapper ID",
        textField(field.wrapper.id, {}, (value) => opts.onChange({ wrapper: { ...field.wrapper, id: value } }))
      )
    );
    Object.keys(typeSettings).forEach((key) => {
      if (opts.config.settingControls[key]) {
        return;
      }
      const raw = field.settings[key];
      const asText = typeof raw === "object" ? JSON.stringify(raw) : String(raw ?? "");
      rows.push(
        row(
          key,
          textField(asText, {}, (value) => {
            try {
              opts.onSettingChange(key, value.startsWith("{") || value.startsWith("[") ? JSON.parse(value) : value);
            } catch {
              opts.onSettingChange(key, value);
            }
          }),
          "This field type declared it and nothing describes how to draw it."
        )
      );
    });
    rows.push(el("p", { class: "atcfb__key", text: `Key: ${field.key}` }));
    return pane("Advanced", false, rows);
  }
  function renderLocation(host, opts) {
    clear(host);
    const clauses = opts.location.length ? opts.location : [];
    if (!clauses.length) {
      host.append(
        el("p", {
          class: "atcfb__location-empty",
          text: "No rules — this group appears everywhere. Add one to narrow it."
        })
      );
    }
    clauses.forEach((clause, clauseIndex) => {
      if (clauseIndex > 0) {
        host.append(el("p", { class: "atcfb__location-or", text: "or" }));
      }
      host.append(renderClause(clause, clauseIndex, opts));
    });
    host.append(
      button(clauses.length ? "Or add another set of rules" : "Add a rule", {
        class: "atcfb__location-add",
        on: {
          click: () => {
            const first = firstParam(opts.config);
            opts.onChange([
              ...opts.location,
              [{ param: first.param, operator: "==", value: firstChoice(first.choices, opts.config) }]
            ]);
          }
        }
      })
    );
  }
  function renderClause(clause, clauseIndex, opts) {
    const box2 = el("div", { class: "atcfb__clause" });
    clause.forEach((rule, ruleIndex) => {
      if (ruleIndex > 0) {
        box2.append(el("span", { class: "atcfb__clause-and", text: "and" }));
      }
      box2.append(renderRule(rule, clauseIndex, ruleIndex, opts));
    });
    box2.append(
      button("And…", {
        class: "atcfb__clause-add",
        on: {
          click: () => {
            const first = firstParam(opts.config);
            const next = opts.location.map(
              (one, index) => index === clauseIndex ? [...one, { param: first.param, operator: "==", value: firstChoice(first.choices, opts.config) }] : one
            );
            opts.onChange(next);
          }
        }
      })
    );
    return box2;
  }
  function renderRule(rule, clauseIndex, ruleIndex, opts) {
    const update = (patch) => {
      const next = opts.location.map(
        (clause, index) => index !== clauseIndex ? clause : clause.map((one, position) => position === ruleIndex ? { ...one, ...patch } : one)
      );
      opts.onChange(next);
    };
    const remove = () => {
      const next = opts.location.map(
        (clause, index) => index !== clauseIndex ? clause : clause.filter((_one, position) => position !== ruleIndex)
      ).filter((clause) => clause.length);
      opts.onChange(next);
    };
    const params = [];
    opts.config.locationParams.forEach((group) => {
      group.params.forEach((param) => params.push({ value: param.param, label: `${group.label}: ${param.label}` }));
    });
    const descriptor = findParam(rule.param, opts.config);
    const choices = descriptor ? opts.config.locationChoices[descriptor.choices] : void 0;
    return el("div", {
      class: "atcfb__rule atcfb__rule--location",
      children: [
        select(rule.param, params, (value) => {
          const next = findParam(value, opts.config);
          update({ param: value, value: firstChoice(next?.choices ?? "", opts.config) });
        }),
        select(
          rule.operator,
          [
            { value: "==", label: "is" },
            { value: "!=", label: "is not" }
          ],
          (value) => update({ operator: value })
        ),
        choices ? select(
          String(rule.value),
          Object.entries(choices).map(([value, label]) => ({ value, label })),
          (value) => update({ value })
        ) : (
          // Parameters whose choices are a whole post table — `post`,
          // `term`, `page_parent` — have no dropdown, because a site with
          // fifty thousand posts cannot ship one. A number box is honest
          // about what it wants, and the Content Model window is where
          // you go to pick one by name.
          textField(String(rule.value), { attrs: { placeholder: "ID" } }, (value) => update({ value }))
        ),
        el("button", {
          class: "atcfb__rule-remove",
          text: "×",
          attrs: { type: "button", "aria-label": "Remove this rule" },
          on: { click: remove }
        })
      ]
    });
  }
  function findParam(param, config2) {
    for (const group of config2.locationParams) {
      const found = group.params.find((one) => one.param === param);
      if (found) {
        return found;
      }
    }
    return void 0;
  }
  function firstParam(config2) {
    return config2.locationParams[0]?.params[0] ?? { param: "post_type", label: "Post type", choices: "post_types" };
  }
  function firstChoice(source, config2) {
    const choices = config2.locationChoices[source];
    return choices ? Object.keys(choices)[0] ?? "" : "";
  }
  const GUTTER = 56;
  function renderLogicMap(canvas, fields) {
    canvas.querySelector(".atcfb__map")?.remove();
    const edges = edgesOf(fields);
    if (!edges.length) {
      return () => void 0;
    }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "atcfb__map");
    svg.setAttribute("aria-hidden", "true");
    canvas.style.position = canvas.style.position || "relative";
    canvas.append(svg);
    const draw2 = () => {
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
      }
      const bounds = canvas.getBoundingClientRect();
      svg.setAttribute("width", String(bounds.width));
      svg.setAttribute("height", String(canvas.scrollHeight));
      svg.setAttribute("viewBox", `0 0 ${bounds.width} ${canvas.scrollHeight}`);
      edges.forEach((edge) => {
        const from = cardOf(canvas, edge.from);
        const to = cardOf(canvas, edge.to);
        if (!from || !to) {
          return;
        }
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        const x1 = GUTTER - 8;
        const y1 = a.top - bounds.top + canvas.scrollTop + a.height / 2;
        const x2 = GUTTER - 8;
        const y2 = b.top - bounds.top + canvas.scrollTop + b.height / 2;
        const bow = Math.min(GUTTER - 18, 12 + Math.abs(y2 - y1) * 0.1);
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x1} ${y1} C ${x1 - bow} ${y1}, ${x2 - bow} ${y2}, ${x2} ${y2}`);
        path.setAttribute("class", `atcfb__edge atcfb__edge--${edge.kind}`);
        path.dataset.from = edge.from;
        path.dataset.to = edge.to;
        svg.append(path);
        if (edge.label && Math.abs(y2 - y1) > 44) {
          const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
          text.setAttribute("class", "atcfb__edge-label");
          text.setAttribute("x", String(GUTTER / 2));
          text.setAttribute("y", String((y1 + y2) / 2));
          text.textContent = shorten(edge.label);
          text.dataset.from = edge.from;
          text.dataset.to = edge.to;
          svg.append(text);
        }
      });
    };
    const highlight = (key) => {
      svg.classList.toggle("is-focused", Boolean(key));
      svg.querySelectorAll("[data-from]").forEach((node) => {
        const touches = !key || node.dataset.from === key || node.dataset.to === key;
        node.classList.toggle("is-dim", !touches);
      });
    };
    const onOver = (event) => {
      const card2 = event.target?.closest("[data-atcf-card]");
      highlight(card2?.dataset.atcfCard ?? null);
    };
    const onOut = (event) => {
      if (!canvas.contains(event.relatedTarget)) {
        highlight(null);
      }
    };
    canvas.addEventListener("pointerover", onOver);
    canvas.addEventListener("pointerout", onOut);
    const observer = new ResizeObserver(draw2);
    observer.observe(canvas);
    canvas.addEventListener("scroll", draw2, { passive: true });
    draw2();
    return () => {
      observer.disconnect();
      canvas.removeEventListener("pointerover", onOver);
      canvas.removeEventListener("pointerout", onOut);
      canvas.removeEventListener("scroll", draw2);
      svg.remove();
    };
  }
  function shorten(label) {
    return label.length > 9 ? `${label.slice(0, 8)}…` : label;
  }
  function edgesOf(fields) {
    const byName = new Map(fields.map((field) => [field.name, field.key]));
    const edges = [];
    fields.forEach((field) => {
      if (field.conditional?.enabled) {
        field.conditional.rules.forEach((rule) => {
          if (!rule.field) {
            return;
          }
          edges.push({
            from: rule.field,
            to: field.key,
            // The answer that triggers it, which is the whole reason the
            // curve is labelled — "shown when Attending" says more than
            // an unlabelled line ever could.
            label: Array.isArray(rule.value) ? rule.value.join(", ") : String(rule.value ?? ""),
            kind: "condition"
          });
        });
      }
      if (field.type === "computed") {
        variables(String(field.settings.formula ?? "")).forEach((name) => {
          const key = byName.get(name);
          if (key) {
            edges.push({ from: key, to: field.key, label: "", kind: "formula" });
          }
        });
      }
    });
    return edges;
  }
  function cardOf(canvas, key) {
    return canvas.querySelector(`[data-atcf-card="${CSS.escape(key)}"]`);
  }
  function renderPalette(host, opts) {
    clear(host);
    const searchId = uid("atcf-palette-search");
    const search2 = el("input", {
      class: "atcfb__palette-search",
      attrs: { type: "search", id: searchId, placeholder: "Search fields", "aria-label": "Search field types" }
    });
    const list = el("div", { class: "atcfb__palette-list" });
    host.append(search2, list);
    const draw2 = (query) => {
      clear(list);
      const needle = query.trim().toLowerCase();
      const matching = opts.types.filter(
        (type) => !needle || type.label.toLowerCase().includes(needle) || type.type.includes(needle) || type.description.toLowerCase().includes(needle)
      );
      if (!matching.length) {
        list.append(el("p", { class: "atcfb__palette-empty", text: "Nothing matched." }));
        return;
      }
      Object.entries(opts.groups).forEach(([slug2, label]) => {
        const inGroup = matching.filter((type) => type.group === slug2);
        if (!inGroup.length) {
          return;
        }
        const section = el("div", { class: "atcfb__palette-group" });
        section.append(el("h3", { class: "atcfb__palette-heading", text: label }));
        inGroup.forEach((type) => section.append(paletteItem(type, opts.onAdd)));
        list.append(section);
      });
      const ungrouped = matching.filter((type) => !(type.group in opts.groups));
      if (ungrouped.length) {
        const section = el("div", { class: "atcfb__palette-group" });
        section.append(el("h3", { class: "atcfb__palette-heading", text: "Other" }));
        ungrouped.forEach((type) => section.append(paletteItem(type, opts.onAdd)));
        list.append(section);
      }
    };
    search2.addEventListener("input", () => draw2(search2.value));
    draw2("");
    return draw2;
  }
  function paletteItem(type, onAdd) {
    const item = el("button", {
      class: "atcfb__palette-item",
      attrs: { type: "button", title: type.description, "data-atcf-palette-type": type.type },
      children: [
        icon(type.icon, { class: "atcfb__palette-icon" }),
        el("span", { class: "atcfb__palette-label", text: type.label })
      ]
    });
    item.addEventListener("pointerdown", (event) => {
      const ghost = el("div", {
        class: "atcf-drag-ghost atcf-drag-ghost--field",
        children: [icon(type.icon), el("span", { text: type.label })]
      });
      startDrag(event, {
        payload: buildPayload(
          config().dragTypes.field,
          item,
          { kind: "new", type: type.type, label: type.label, icon: type.icon },
          event,
          ghost
        ),
        origin: event,
        // A press that never travelled far enough to be a drag is a click,
        // and the click adds the field. Handling it here rather than with a
        // `click` listener is what stops a completed drag *also* adding one.
        onClickOnly: () => onAdd(type),
        onCancel: () => void 0
      });
    });
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onAdd(type);
      }
    });
    return item;
  }
  const GROUP_TYPE = "allterrain-fields/group";
  const PREVIEW_TYPE = "allterrain-fields/preview";
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
  function groupIdentity(group, adminUrl) {
    const related = group.types.filter((type) => type !== "*").slice(0, 12).map((type) => ({
      id: `allterrain-fields/type-${type}`,
      label: type,
      url: `${adminUrl}edit.php?post_type=${encodeURIComponent(type)}`,
      group: "allterrain-fields/types",
      groupLabel: "Appears on",
      icon: "dashicons-admin-post"
    }));
    related.push({
      id: "allterrain-fields/model",
      label: "The content model",
      url: `${adminUrl}admin.php?page=allterrain-fields-model`,
      group: "allterrain-fields",
      groupLabel: "Fields",
      icon: "dashicons-networking"
    });
    return {
      type: GROUP_TYPE,
      id: group.id || group.key,
      label: group.title || "Untitled group",
      related
    };
  }
  function previewIdentity(group) {
    return {
      type: PREVIEW_TYPE,
      id: `preview-${group.id || group.key}`,
      root: { type: GROUP_TYPE, id: group.id || group.key },
      label: `Preview: ${group.title}`
    };
  }
  const BUTTON_ID = "allterrain-fields/preview";
  function registerPreviewButton(source) {
    const os = shell();
    if (!os?.registerTitleBarButton || !config().previewWindow) {
      return () => void 0;
    }
    let registered = false;
    const register = () => {
      try {
        if (!os.registerTitleBarButton) {
          return;
        }
        os.registerTitleBarButton({
          id: BUTTON_ID,
          label: "Preview this field group",
          icon: "dashicons-visibility",
          placement: "right",
          // Just before the shell's own Related button, so the builder's
          // eye lands where every other window's eye is.
          order: 90,
          // Only the builder window. The predicate is called against a live
          // `Window`, and a throw counts as "does not match" — so a shell
          // whose `Window` shape differs simply does not show the button
          // rather than erroring on every repaint.
          match: (win) => {
            const id = win?.id ?? win?.config?.id ?? "";
            return id === "allterrain-fields" || id.startsWith("allterrain-fields#");
          },
          onClick: () => void open(source),
          owner: "allterrain-fields-builder"
        });
        registered = true;
      } catch {
      }
    };
    if (os.ready) {
      os.ready(register);
    } else {
      register();
    }
    return () => {
      if (!registered) {
        return;
      }
      try {
        os.unregisterTitleBarButton?.(BUTTON_ID);
      } catch {
      }
    };
  }
  async function open(source) {
    if (source.isDirty()) {
      await source.save();
    }
    const group = source.current();
    if (!group) {
      return;
    }
    const os = shell();
    const windowId = config().previewWindow;
    if (os?.openWindow && windowId) {
      os.openWindow(windowId, { source: "allterrain-fields-builder" });
    }
    source.render();
  }
  function titleBarWillPreview() {
    return Boolean(shellIsActive() && shell()?.registerTitleBarButton && config().previewWindow);
  }
  function acceptsOf(wrapper) {
    return (wrapper.dataset.atcfAccepts ?? "").split(/\s+/).filter(Boolean);
  }
  function hostOf(wrapper) {
    return wrapper.querySelector(".atcf-mount") ?? wrapper.querySelector(".atcf-field__control");
  }
  function wouldAccept(accepts, entities) {
    if (!accepts.length || !entities.length) {
      return false;
    }
    if (accepts.includes("media") && mediaEntities(entities).length) {
      return true;
    }
    if (accepts.includes("post") && postEntities(entities).length) {
      return true;
    }
    if (accepts.includes("user") && entities.some((one) => one.kind === "user")) {
      return true;
    }
    if (accepts.includes("term") && entities.some((one) => one.kind === "term")) {
      return true;
    }
    return accepts.includes("text");
  }
  function deliver(wrapper, entities) {
    const host = hostOf(wrapper);
    if (!host) {
      return;
    }
    const accepts = acceptsOf(wrapper);
    if (accepts.includes("media")) {
      const media = mediaEntities(entities);
      if (media.length) {
        host.dispatchEvent(
          new CustomEvent("atcf:media-dropped", { detail: { ids: media.map((one) => Number(one.ref)) } })
        );
        flash(wrapper);
        return;
      }
    }
    const usable = accepts.includes("post") ? postEntities(entities) : entities.filter((one) => accepts.includes(one.kind));
    if (usable.length && !accepts.includes("text")) {
      host.dispatchEvent(
        new CustomEvent("atcf:entities-dropped", {
          detail: {
            ids: usable.map((one) => Number(one.ref)).filter(Boolean),
            titles: usable.map((one) => one.title),
            urls: usable.map((one) => String(one.url ?? ""))
          }
        })
      );
      flash(wrapper);
      return;
    }
    if (accepts.includes("text")) {
      const text = entities.map((one) => one.title).filter(Boolean).join(", ");
      const input = wrapper.querySelector('input:not([type="hidden"]), textarea');
      if (input && text) {
        input.value = text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      host.dispatchEvent(new CustomEvent("atcf:text-dropped", { detail: { text } }));
      flash(wrapper);
    }
  }
  function flash(wrapper) {
    wrapper.classList.add("atcf-field--dropped");
    window.setTimeout(() => wrapper.classList.remove("atcf-field--dropped"), 700);
  }
  function registerFieldDropTargets(root = document) {
    const teardowns2 = [];
    const manager = dragManager();
    root.querySelectorAll("[data-atcf-accepts]").forEach((wrapper) => {
      const accepts = acceptsOf(wrapper);
      if (!accepts.length) {
        return;
      }
      teardowns2.push(
        manager.registerDropTarget({
          id: `atcf-drop-${wrapper.dataset.atcfField ?? ""}-${teardowns2.length}`,
          element: wrapper,
          acceptLabel: t("dropHere", "Drop it here"),
          accept: (payload) => {
            const entities = isDesktopPayload(payload) || payload.type === config().dragTypes.value ? entitiesIn(payload) : [];
            return wouldAccept(accepts, entities);
          },
          onEnter: () => wrapper.classList.add("atcf-field--drop-target"),
          onLeave: () => wrapper.classList.remove("atcf-field--drop-target"),
          onDrop: (session) => {
            wrapper.classList.remove("atcf-field--drop-target");
            deliver(wrapper, entitiesIn(session.payload));
          }
        })
      );
    });
    return () => teardowns2.forEach((fn) => fn());
  }
  function listenForCrossFrameDrops() {
    if (window.parent === window) {
      return () => void 0;
    }
    let hovered = null;
    const fieldAt = (x, y) => {
      const element = document.elementFromPoint(x, y);
      return element?.closest("[data-atcf-accepts]") ?? null;
    };
    const clearHover = () => {
      hovered?.classList.remove("atcf-field--drop-target");
      hovered = null;
    };
    const onMessage = (event) => {
      if (event.source !== window.parent) {
        return;
      }
      const data = event.data;
      if (!data?.type || !String(data.type).startsWith("os-drag") && data.type !== "os-drop") {
        return;
      }
      if (data.type === "os-drag-leave") {
        clearHover();
        return;
      }
      const point = data.position ?? { x: 0, y: 0 };
      const entities = entitiesIn({
        type: String(data.payload?.type ?? "shortcut"),
        data: data.payload?.data ?? (data.payload ?? {})
      });
      if (data.type === "os-drag-over") {
        const field = fieldAt(point.x, point.y);
        if (field === hovered) {
          return;
        }
        clearHover();
        if (field && wouldAccept(acceptsOf(field), entities)) {
          hovered = field;
          field.classList.add("atcf-field--drop-target");
          window.parent.postMessage({ type: "os-drag-accept", accepted: true }, "*");
        }
        return;
      }
      if (data.type === "os-drop") {
        const field = fieldAt(point.x, point.y) ?? hovered;
        clearHover();
        if (field && wouldAccept(acceptsOf(field), entities)) {
          deliver(field, entities);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearHover();
    };
  }
  function listenForFileDrops(root = document) {
    const listeners = [];
    root.querySelectorAll('[data-atcf-accepts~="media"]').forEach((wrapper) => {
      const over = (event) => {
        const transfer = event.dataTransfer;
        if (!transfer?.types.includes("Files")) {
          return;
        }
        event.preventDefault();
        wrapper.classList.add("atcf-field--drop-target");
      };
      const leave = () => wrapper.classList.remove("atcf-field--drop-target");
      const drop = async (event) => {
        const transfer = event.dataTransfer;
        if (!transfer?.files.length) {
          return;
        }
        event.preventDefault();
        leave();
        const uploaded = [];
        for (const file of Array.from(transfer.files)) {
          const id = await upload(file);
          if (id) {
            uploaded.push(id);
          }
        }
        if (uploaded.length) {
          hostOf(wrapper)?.dispatchEvent(new CustomEvent("atcf:media-dropped", { detail: { ids: uploaded } }));
          flash(wrapper);
        }
      };
      wrapper.addEventListener("dragover", over);
      wrapper.addEventListener("dragleave", leave);
      wrapper.addEventListener("drop", (event) => void drop(event));
      listeners.push(() => {
        wrapper.removeEventListener("dragover", over);
        wrapper.removeEventListener("dragleave", leave);
      });
    });
    return () => listeners.forEach((fn) => fn());
  }
  async function upload(file) {
    const { wpRestUrl, nonce } = config();
    const body = new FormData();
    body.append("file", file, file.name);
    try {
      const response = await fetch(`${wpRestUrl}media`, {
        method: "POST",
        credentials: "same-origin",
        // No `Content-Type`: the browser has to set it itself so it can add
        // the multipart boundary. Setting it by hand produces a body the
        // server cannot parse, and the error blames the file.
        headers: { "X-WP-Nonce": nonce },
        body
      });
      if (!response.ok) {
        return 0;
      }
      const json = await response.json();
      return Number(json.id ?? 0);
    } catch {
      return 0;
    }
  }
  function dropsAreAvailable() {
    return shellIsActive() || window.parent !== window || "ondragover" in window;
  }
  const DONE = "atcfMounted";
  function boot(root = document) {
    mountAll(root);
    wireLogic(root);
    buildTabs(root);
    buildAccordions(root);
    if (dropsAreAvailable()) {
      registerFieldDropTargets(root);
      listenForFileDrops(root);
    }
    void componentsReady();
  }
  function mountAll(root) {
    root.querySelectorAll(".atcf-mount").forEach((host) => {
      if (host.dataset[DONE] === "1") {
        return;
      }
      const type = host.dataset.atcfMount ?? "";
      const renderer = mountFor(type);
      const wrapper = host.closest("[data-atcf-field]");
      if (!renderer || !wrapper) {
        return;
      }
      const field = parse(host.dataset.atcfFieldJson, null);
      const input = host.parentElement?.querySelector("[data-atcf-fallback]") ?? null;
      if (!field) {
        return;
      }
      host.dataset[DONE] = "1";
      host.textContent = "";
      renderer({
        host,
        field,
        value: parse(host.dataset.atcfValue, null),
        wrapper,
        set: (value) => {
          if (input) {
            input.value = JSON.stringify(value ?? null);
          }
          host.dataset.atcfValue = JSON.stringify(value ?? null);
          wrapper.dispatchEvent(new CustomEvent("atcf:changed", { bubbles: true, detail: { field: field.key, value } }));
        }
      });
    });
  }
  function parse(raw, fallback2) {
    if (!raw) {
      return fallback2;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return fallback2;
    }
  }
  function wireLogic(root) {
    root.querySelectorAll(".atcf-fields").forEach((form) => {
      if (form.dataset[DONE] === "logic") {
        return;
      }
      form.dataset[DONE] = "logic";
      const apply2 = () => applyLogic(form);
      CHANGE_EVENTS.forEach((name) => form.addEventListener(name, apply2));
      form.addEventListener("atcf:changed", apply2);
      apply2();
    });
  }
  function readValues(form) {
    const values = {};
    form.querySelectorAll("[data-atcf-field]").forEach((wrapper) => {
      const key = wrapper.dataset.atcfField ?? "";
      if (!key) {
        return;
      }
      const mount2 = wrapper.querySelector(".atcf-mount");
      if (mount2) {
        values[key] = parse(mount2.dataset.atcfValue, null);
        return;
      }
      const checkboxes = wrapper.querySelectorAll('input[type="checkbox"], input[type="radio"]');
      if (checkboxes.length) {
        const checked = Array.from(checkboxes).filter((one) => one.checked);
        values[key] = checkboxes.length === 1 && checkboxes[0].type === "checkbox" ? checkboxes[0].checked ? "1" : "0" : checked.map((one) => one.value);
        return;
      }
      const select2 = wrapper.querySelector("select");
      if (select2) {
        values[key] = select2.multiple ? Array.from(select2.selectedOptions).map((one) => one.value) : select2.value;
        return;
      }
      const input = wrapper.querySelector('input:not([type="hidden"]), textarea');
      values[key] = input ? input.value : null;
    });
    return values;
  }
  function applyLogic(form) {
    const values = readValues(form);
    form.querySelectorAll("[data-atcf-conditional]").forEach((wrapper) => {
      const conditional = parse(wrapper.dataset.atcfConditional, null);
      if (!conditional) {
        return;
      }
      const shown = visible(conditional, values);
      wrapper.hidden = !shown;
      wrapper.classList.toggle("atcf-field--hidden", !shown);
      wrapper.querySelectorAll("input, select, textarea, button").forEach((control2) => {
        control2.disabled = !shown;
      });
    });
  }
  function buildTabs(root) {
    root.querySelectorAll(".atcf-fields").forEach((form) => {
      const markers = Array.from(form.querySelectorAll(".atcf-field--tab"));
      if (!markers.length || form.dataset.atcfTabs === "1") {
        return;
      }
      form.dataset.atcfTabs = "1";
      const strip = document.createElement("div");
      strip.className = "atcf-tabs";
      strip.setAttribute("role", "tablist");
      const panels = [];
      const buttons = [];
      markers.forEach((marker, index) => {
        const label = marker.querySelector(".atcf-tab-marker")?.textContent ?? `Tab ${index + 1}`;
        const panel = document.createElement("div");
        panel.className = "atcf-tabs__panel";
        panel.setAttribute("role", "tabpanel");
        panel.id = `atcf-tabpanel-${index}-${Math.random().toString(36).slice(2, 8)}`;
        let node = marker.nextElementSibling;
        while (node && !node.classList.contains("atcf-field--tab")) {
          const next = node.nextElementSibling;
          panel.append(node);
          node = next;
        }
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = "atcf-tabs__tab";
        tab.textContent = label;
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", panel.id);
        tab.setAttribute("aria-selected", index === 0 ? "true" : "false");
        tab.tabIndex = index === 0 ? 0 : -1;
        tab.addEventListener("click", () => activate(index));
        tab.addEventListener("keydown", (event) => {
          const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
          if (!step) {
            return;
          }
          event.preventDefault();
          activate((index + step + buttons.length) % buttons.length, true);
        });
        strip.append(tab);
        marker.remove();
        panels.push(panel);
        buttons.push(tab);
      });
      const activate = (index, focus = false) => {
        buttons.forEach((tab, position) => {
          tab.setAttribute("aria-selected", position === index ? "true" : "false");
          tab.tabIndex = position === index ? 0 : -1;
        });
        panels.forEach((panel, position) => {
          panel.hidden = position !== index;
        });
        if (focus) {
          buttons[index].focus();
        }
      };
      form.prepend(strip);
      panels.forEach((panel) => form.append(panel));
      activate(0);
    });
  }
  function buildAccordions(root) {
    root.querySelectorAll(".atcf-field--accordion").forEach((marker) => {
      if (marker.dataset[DONE] === "accordion") {
        return;
      }
      marker.dataset[DONE] = "accordion";
      const inner = marker.querySelector(".atcf-accordion-marker");
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      details.className = "atcf-accordion";
      details.open = inner?.dataset.atcfOpen === "1";
      summary.className = "atcf-accordion__summary";
      summary.textContent = inner?.textContent ?? "";
      details.append(summary);
      let node = marker.nextElementSibling;
      while (node && !node.classList.contains("atcf-field--accordion")) {
        const next = node.nextElementSibling;
        details.append(node);
        node = next;
      }
      marker.replaceWith(details);
    });
  }
  publishRegistry();
  if (typeof document !== "undefined") {
    const start = () => {
      boot();
      if (config().shell.chromeless || window.parent !== window) {
        listenForCrossFrameDrops();
      }
    };
    const begin = async () => {
      if (config().shell.active || config().shell.chromeless) {
        await componentsReady();
      }
      start();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => void begin(), { once: true });
    } else {
      void begin();
    }
    const observer = new MutationObserver((records) => {
      const added = records.some(
        (record) => Array.from(record.addedNodes).some(
          (node) => node instanceof HTMLElement && node.querySelector?.(".atcf-mount, .atcf-fields")
        )
      );
      if (added) {
        boot();
      }
    });
    observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true });
    document.addEventListener("click", (event) => {
      const link = event.target?.closest("[data-atcf-focus]");
      if (!link) {
        return;
      }
      event.preventDefault();
      const key = (link.dataset.atcfFocus ?? "").split("[")[0];
      const wrapper = document.querySelector(`[data-atcf-field="${CSS.escape(key)}"]`);
      wrapper?.scrollIntoView({ behavior: "smooth", block: "center" });
      wrapper?.querySelector("input, select, textarea, button")?.focus();
    });
  }
  class Builder {
    constructor(root) {
      this.config = null;
      this.summaries = [];
      this.group = null;
      this.selected = "";
      this.dirty = false;
      this.tab = "fields";
      this.starters = false;
      this.drawer = "none";
      this.teardowns = [];
      this.canvasTeardowns = [];
      this.scrim = null;
      this.escapes = null;
      this.statusNode = null;
      this.canvasTarget = null;
      this.root = root;
    }
    /** Loads everything and paints. */
    async start() {
      await componentsReady();
      try {
        const [config2, summaries] = await Promise.all([getConfig(), listGroups()]);
        this.config = config2;
        this.summaries = summaries;
      } catch (error) {
        this.fail(error);
        return;
      }
      this.drawChrome();
      this.drawGroups();
      this.drawPalette();
      const wanted2 = Number(windowParam(this.root, "group")) || 0;
      const first = this.summaries.find((one) => wanted2 && one.id === wanted2) ?? this.summaries.find((one) => !one.local);
      if (first) {
        await this.openGroup(first.id);
      } else {
        this.drawCanvas();
        this.drawInspector();
      }
      this.teardowns.push(
        registerPreviewButton({
          current: () => this.group ? { id: this.group.id ?? 0, key: this.group.key, title: this.group.title } : null,
          isDirty: () => this.dirty,
          save: () => this.save(),
          render: () => void this.renderPreview()
        })
      );
    }
    /** Says what went wrong, in the window rather than in the console. */
    fail(error) {
      clear(this.root);
      this.root.append(
        el("div", {
          class: "atcfb__error",
          children: [
            el("h2", { text: "The builder could not start." }),
            el("p", { text: error instanceof Error ? error.message : String(error) })
          ]
        })
      );
    }
    /** The persistent frame: bar, panes, tabs. */
    drawChrome() {
      const bar = this.root.querySelector("[data-atcfb-bar]");
      if (!bar) {
        return;
      }
      clear(bar);
      const title = textField("", { class: "atcfb__title", attrs: { "aria-label": "Field group name" } }, (value) => {
        if (this.group) {
          this.group.title = value;
          this.markDirty();
        }
      });
      const tabs = el("div", { class: "atcfb__tabs", attrs: { role: "tablist" } });
      ["fields", "location", "settings"].forEach((tab) => {
        const label = { fields: "Fields", location: "Where it appears", settings: "Settings" }[tab];
        tabs.append(
          el("button", {
            class: "atcfb__tab",
            text: label,
            attrs: { type: "button", role: "tab", "aria-selected": this.tab === tab ? "true" : "false" },
            dataset: { tab },
            on: {
              click: () => {
                this.tab = tab;
                this.drawChrome();
                this.drawMain();
              }
            }
          })
        );
      });
      const status = el("span", { class: "atcfb__status", attrs: { role: "status" } });
      bar.append(
        title,
        tabs,
        el("div", {
          class: "atcfb__bar-actions",
          children: [
            status,
            // Only visible in a narrow window, where the palette and the
            // inspector are off-canvas. They are always in the DOM so the
            // container query can decide, rather than a resize listener
            // that has to be right about the timing as well as the answer.
            button("Add a field", {
              class: "atcfb__drawer-toggle atcfb__drawer-toggle--palette",
              on: { click: () => this.openDrawer("palette") }
            }),
            button("Field settings", {
              class: "atcfb__drawer-toggle atcfb__drawer-toggle--inspector",
              on: { click: () => this.openDrawer("inspector") }
            }),
            // Not drawn when the shell will put an eye in the title bar —
            // see `titleBarWillPreview()`. This is the fallback for an
            // admin page, not a second copy of the same action.
            titleBarWillPreview() ? null : button("Preview", {
              class: "atcfb__preview",
              on: {
                click: () => void open({
                  current: () => this.group ? { id: this.group.id ?? 0, key: this.group.key, title: this.group.title } : null,
                  isDirty: () => this.dirty,
                  save: () => this.save(),
                  render: () => void this.renderPreview()
                })
              }
            }),
            button("Save", { class: "atcfb__save", on: { click: () => void this.save() } })
          ]
        })
      );
      if (this.group) {
        title.value = this.group.title;
      }
      this.statusNode = status;
      this.updateStatus();
    }
    /**
     * Shows one of the off-canvas panes, or closes whichever is open.
     *
     * A class on the root rather than inline styles, so the container query stays
     * the only thing that decides *whether* the panes are drawers — this decides
     * only which one is out.
     *
     * @param which The pane, or `none` to close.
     */
    openDrawer(which) {
      this.drawer = this.drawer === which ? "none" : which;
      this.root.dataset.atcfbDrawer = this.drawer;
      const body = this.root.querySelector(".atcfb__body") ?? this.root;
      if (!this.scrim) {
        this.scrim = el("button", {
          class: "atcfb__scrim",
          attrs: { type: "button", "aria-label": "Close this panel" },
          on: { click: () => this.openDrawer("none") }
        });
        body.append(this.scrim);
      }
      if ("none" !== this.drawer && !this.escapes) {
        this.escapes = (event) => {
          if ("Escape" === event.key && "none" !== this.drawer) {
            this.openDrawer("none");
          }
        };
        this.root.addEventListener("keydown", this.escapes);
      }
    }
    /** Reflects the dirty flag. */
    updateStatus() {
      if (this.statusNode) {
        this.statusNode.textContent = this.dirty ? "Unsaved changes" : "";
      }
    }
    /** The group list rail. */
    drawGroups() {
      const host = this.root.querySelector("[data-atcfb-groups]");
      if (!host) {
        return;
      }
      clear(host);
      host.append(
        el("div", {
          class: "atcfb__groups-head",
          children: [
            el("h2", { text: "Field groups" }),
            el("div", {
              class: "atcfb__groups-actions",
              children: [
                button("New", { on: { click: () => void this.newGroup() } }),
                // Once a site has groups, the picker is behind an empty
                // state nobody will ever see again — and the templates
                // are the best documentation this plugin has. So there
                // is a way back to them.
                button("Templates", {
                  on: {
                    click: () => {
                      this.starters = true;
                      this.tab = "fields";
                      this.drawMain();
                    }
                  }
                })
              ]
            })
          ]
        })
      );
      const list = el("div", { class: "atcfb__groups-list", attrs: { role: "list" } });
      if (!this.summaries.length) {
        list.append(
          el("p", { class: "atcfb__groups-empty", text: "None yet. Press New to make the first one." })
        );
      }
      this.summaries.forEach((summary) => {
        const active = this.group?.key === summary.key;
        const row2 = el("div", {
          class: `atcfb__group${active ? " is-active" : ""}${summary.active ? "" : " is-off"}`,
          attrs: { role: "listitem" }
        });
        const openIt = el("button", {
          class: "atcfb__group-open",
          attrs: { type: "button", "aria-current": active ? "true" : "false" },
          children: [
            el("span", { class: "atcfb__group-title", text: summary.title }),
            el("span", {
              class: "atcfb__group-meta",
              text: `${summary.fields} field${summary.fields === 1 ? "" : "s"} · ${summary.location}`
            }),
            summary.local ? el("span", { class: "atcfb__group-flag", text: "in code" }) : null,
            summary.block ? el("span", { class: "atcfb__group-flag", text: "block" }) : null
          ],
          on: {
            click: () => {
              if (summary.local) {
                notify("That group is registered in code.", "Edit it where it is declared.", "info");
                return;
              }
              void this.openGroup(summary.id);
            }
          }
        });
        row2.append(openIt);
        if (!summary.local) {
          row2.append(
            el("button", {
              class: "atcfb__group-delete",
              text: "×",
              attrs: { type: "button", "aria-label": `Delete ${summary.title}`, title: `Delete ${summary.title}` },
              on: {
                click: (event) => {
                  event.stopPropagation();
                  void this.deleteGroup(summary.id, summary.title);
                }
              }
            })
          );
        }
        list.append(row2);
      });
      host.append(list);
    }
    /** The palette. */
    drawPalette() {
      const host = this.root.querySelector("[data-atcfb-palette]");
      if (!host || !this.config) {
        return;
      }
      renderPalette(host, {
        types: this.config.fieldTypes,
        groups: this.config.fieldGroups,
        onAdd: (type) => {
          void this.addField(type.type, this.group?.fields.length ?? 0);
          if ("palette" === this.drawer) {
            this.openDrawer("none");
          }
        }
      });
    }
    /** Whichever pane the tab names. */
    drawMain() {
      if (this.tab === "fields") {
        this.drawCanvas();
        this.drawInspector();
        return;
      }
      const canvas = this.root.querySelector("[data-atcfb-canvas]");
      const inspector = this.root.querySelector("[data-atcfb-inspector]");
      if (!canvas || !this.group || !this.config) {
        return;
      }
      clear(canvas);
      if (inspector) {
        clear(inspector);
      }
      if (this.tab === "location") {
        const box2 = el("div", { class: "atcfb__location" });
        canvas.append(
          el("h2", { class: "atcfb__pane-heading", text: "Where this group appears" }),
          box2
        );
        renderLocation(box2, {
          location: this.group.location,
          config: this.config,
          onChange: (location) => {
            if (this.group) {
              this.group.location = location;
              this.markDirty();
              this.drawMain();
            }
          }
        });
        return;
      }
      this.drawSettings(canvas);
    }
    /** The group's own settings. */
    drawSettings(host) {
      if (!this.group) {
        return;
      }
      const settings = this.group.settings;
      const box2 = el("div", { class: "atcfb__settings" });
      const patch = (next) => {
        if (this.group) {
          this.group.settings = { ...this.group.settings, ...next };
          this.markDirty();
        }
      };
      box2.append(
        toggle(settings.active, "Switched on", (on) => patch({ active: on })),
        el("label", {
          class: "atcfb__row",
          children: [
            el("span", { class: "atcfb__row-label", text: "Description" }),
            textField(settings.description, {}, (value) => patch({ description: value }))
          ]
        }),
        el("label", {
          class: "atcfb__row",
          children: [
            el("span", { class: "atcfb__row-label", text: "Order" }),
            textField(
              String(settings.menu_order),
              { attrs: { type: "number" } },
              (value) => patch({ menu_order: Number(value) || 0 })
            )
          ]
        }),
        toggle(settings.show_in_rest, "Expose in the REST API", (on) => patch({ show_in_rest: on }))
      );
      const block = settings.block;
      box2.append(
        el("h3", { class: "atcfb__settings-heading", text: "As a block" }),
        el("p", {
          class: "atcfb__settings-note",
          text: "Turn this on and the group becomes a Gutenberg block whose attributes are its fields."
        }),
        toggle(
          block.enabled,
          "Register a block",
          (on) => patch({
            block: {
              ...block,
              enabled: on,
              // Seeded from the title so the block has a usable name
              // the moment it is switched on. A block registered as
              // `acf/` is a block that never appears in the inserter.
              name: block.name || slug(this.group?.title ?? ""),
              title: block.title || (this.group?.title ?? "")
            }
          })
        )
      );
      if (block.enabled) {
        box2.append(
          el("label", {
            class: "atcfb__row",
            children: [
              el("span", { class: "atcfb__row-label", text: "Block name" }),
              textField(block.name, {}, (value) => patch({ block: { ...block, name: slug(value) } }))
            ]
          }),
          el("label", {
            class: "atcfb__row",
            children: [
              el("span", { class: "atcfb__row-label", text: "Template file" }),
              textField(
                block.template,
                { attrs: { placeholder: "blocks/hero.php" } },
                (value) => patch({ block: { ...block, template: value } })
              )
            ]
          }),
          el("p", {
            class: "atcfb__row-hint",
            text: "A file in your theme. Read its fields with atcf_block_field( 'name' )."
          })
        );
      }
      box2.append(
        el("h3", { class: "atcfb__settings-heading", text: "Danger" }),
        button("Delete this group", {
          class: "atcfb__delete",
          on: { click: () => void this.deleteGroup() }
        })
      );
      host.append(el("h2", { class: "atcfb__pane-heading", text: "Settings" }), box2);
    }
    /**
     * The starter picker.
     *
     * The first screen anybody sees, and the one that has to answer a question the
     * palette cannot: *what is this for*. "Custom fields" is an abstraction with
     * nothing in it until you have seen one, and a newcomer facing forty field
     * types has no way to know that a repeater is how you do ingredients, or that
     * a total can work itself out.
     *
     * So each card says what it *teaches*, not just what it contains. Opening
     * Recipes and reading it is the fastest route to knowing what this plugin
     * does — faster than any tour, because it is the real builder with a real
     * group in it, and every field in it can be changed or thrown away.
     *
     * @param host The canvas pane.
     */
    drawStarters(host) {
      const templates = this.config?.templates ?? [];
      const wrap = el("div", { class: "atcfb__starters" });
      wrap.append(
        el("div", {
          class: "atcfb__starters-head",
          children: [
            icon("dashicons-index-card"),
            el("h2", { text: this.group ? "Start another group" : "No field group yet" }),
            el("p", {
              text: "A field group is the box your fields live in, and where you say which post types get them. Open one of these to see how it is done, or start from nothing."
            })
          ]
        })
      );
      if (templates.length) {
        const cards = el("div", { class: "atcfb__starter-cards" });
        templates.forEach((template) => {
          cards.append(
            el("button", {
              class: "atcfb__starter",
              attrs: { type: "button" },
              children: [
                icon(template.icon),
                el("span", { class: "atcfb__starter-title", text: template.label }),
                el("span", { class: "atcfb__starter-text", text: template.description }),
                el("span", {
                  class: "atcfb__starter-teaches",
                  children: template.teaches.map(
                    (what) => el("span", { class: "atcfb__starter-chip", text: what })
                  )
                }),
                el("span", {
                  class: "atcfb__starter-meta",
                  text: `${template.fields} field${template.fields === 1 ? "" : "s"} · yours to change`
                })
              ],
              on: { click: () => void this.useTemplate(template.slug, template.label) }
            })
          );
        });
        wrap.append(cards);
      }
      wrap.append(
        el("div", {
          class: "atcfb__starters-foot",
          children: [
            button("Start from nothing", {
              class: "atcfb__empty-cta",
              on: { click: () => void this.newGroup() }
            }),
            this.group ? button("Back to “" + this.group.title + "”", {
              on: {
                click: () => {
                  this.starters = false;
                  this.drawMain();
                }
              }
            }) : null
          ]
        })
      );
      host.append(wrap);
    }
    /**
     * Turns a template into a real group and opens it.
     *
     * The group is created server-side rather than assembled here — see
     * `atcf_group_from_template()`. What comes back is an ordinary group with
     * ordinary keys; nothing about it remembers it was a template, which is
     * deliberate. A starter that stayed special would be a starter nobody dared
     * edit.
     *
     * @param slug  Template slug.
     * @param label What to call it in the notice.
     */
    async useTemplate(slug2, label) {
      if (this.dirty && !await confirm("There are unsaved changes. Start a new group anyway?")) {
        return;
      }
      let created;
      try {
        created = await createFromTemplate(slug2);
      } catch (error) {
        notify("That template would not open.", error instanceof Error ? error.message : "", "error");
        return;
      }
      this.summaries = await listGroups();
      this.group = created;
      this.selected = created.fields[0]?.key ?? "";
      this.dirty = false;
      this.starters = false;
      this.tab = "fields";
      this.drawChrome();
      this.drawGroups();
      this.drawMain();
      this.announce();
      notify(`“${label}” is ready.`, "It shows on Posts. Change anything you like — nothing here is fixed.", "success");
    }
    /** The canvas, and the logic map over it. */
    drawCanvas() {
      const host = this.root.querySelector("[data-atcfb-canvas]");
      if (!host || !this.config) {
        return;
      }
      this.canvasTeardowns.splice(0).forEach((fn) => fn());
      if (!this.group || this.starters) {
        clear(host);
        this.drawStarters(host);
        return;
      }
      const types = {};
      this.config.fieldTypes.forEach((type) => {
        types[type.type] = type;
      });
      renderCanvas(host, this.canvasOptions(types));
      if (!this.canvasTarget) {
        this.canvasTarget = registerCanvasTarget(host, () => this.canvasOptions());
        this.teardowns.push(this.canvasTarget);
      }
      this.canvasTeardowns.push(renderLogicMap(host, this.group?.fields ?? []));
    }
    /**
     * What the canvas is showing and what to do about it.
     *
     * Read fresh on every drop rather than captured at registration, because the
     * target outlives every redraw — that is the point of registering it once.
     *
     * @param types The field type index, rebuilt when not supplied.
     * @return The options.
     */
    canvasOptions(types) {
      const index = types ?? {};
      if (!types) {
        (this.config?.fieldTypes ?? []).forEach((type) => {
          index[type.type] = type;
        });
      }
      return {
        fields: this.group?.fields ?? [],
        types: index,
        selected: this.selected,
        onSelect: (key) => {
          this.selected = key;
          this.drawCanvas();
          this.drawInspector();
          if ("palette" === this.drawer) {
            this.openDrawer("inspector");
          }
        },
        // Written straight into the field, and the canvas is **not** redrawn:
        // the caret is inside the element that would be replaced. The
        // inspector is refreshed instead, so the two panes agree.
        onLabel: (key, value) => {
          const field = this.group?.fields.find((one) => one.key === key);
          if (!field) {
            return;
          }
          field.label = value;
          this.markDirty();
          this.syncInspector();
        },
        onInstructions: (key, value) => {
          const field = this.group?.fields.find((one) => one.key === key);
          if (!field) {
            return;
          }
          field.instructions = value;
          this.markDirty();
          this.syncInspector();
        },
        // A setting rewritten in place. Like the label, the canvas is not
        // redrawn: the caret is in the element a redraw replaces.
        onSetting: (key, setting, value) => {
          const field = this.group?.fields.find((one) => one.key === key);
          if (!field) {
            return;
          }
          field.settings = { ...field.settings, [setting]: value };
          this.markDirty();
          this.syncInspector();
        },
        // Choices, on the other hand, change the card's *shape* — a row
        // appears or goes — so this one does redraw. Renaming an option
        // arrives here too and would move the caret, so the redraw is skipped
        // when the list is the same length as the one already drawn.
        onChoices: (key, choices) => {
          const field = this.group?.fields.find((one) => one.key === key);
          if (!field) {
            return;
          }
          const before = Array.isArray(field.settings.choices) ? field.settings.choices.length : 0;
          field.settings = { ...field.settings, choices };
          this.markDirty();
          this.syncInspector();
          if (before !== choices.length) {
            this.drawCanvas();
          }
        },
        // Sanitised and made unique, then redrawn — by blur time the caret has
        // already gone, so a redraw costs nothing and is the only way the
        // corrected key gets on screen.
        onName: (key, value) => {
          this.patchField(key, { name: value });
          this.drawCanvas();
        },
        onWidth: (key, value) => {
          const field = this.group?.fields.find((one) => one.key === key);
          if (!field) {
            return;
          }
          field.wrapper = { ...field.wrapper, width: value };
          this.markDirty();
          this.drawCanvas();
          this.drawInspector();
        },
        onEditFormula: (key) => {
          this.selected = key;
          this.drawCanvas();
          this.drawInspector();
          this.root.querySelector(".atcfb__formula-expand")?.click();
        },
        onMove: (key, position) => this.moveField(key, position),
        onAdd: (type, position) => void this.addField(type, position),
        onDrop: (field, position) => void this.insertField(field, position),
        onRemove: (key) => this.removeField(key),
        onDuplicate: (key) => this.duplicateField(key)
      };
    }
    /** The inspector. */
    /**
     * Pushes a field's values into the inspector's controls **without rebuilding
     * it**.
     *
     * A rebuild collapses every `<details>` somebody opened and throws the scroll
     * position away. That is survivable once; it is not survivable per keystroke,
     * and per keystroke is what editing a label on a card used to cost — the
     * pane jumped back to the top and folded itself shut on every character.
     *
     * The controls say what they edit in `data-atcfb-bind`, so this walks them
     * rather than keeping a list of keys that would be one more thing to forget.
     */
    syncInspector() {
      const host = this.root.querySelector("[data-atcfb-inspector]");
      if (!host || !this.config) {
        return;
      }
      syncInspector(host, this.inspectorOptions());
    }
    /**
     * What the inspector needs, built once so `renderInspector()` and
     * `syncInspector()` cannot be handed different versions of it.
     *
     * @return The options.
     */
    inspectorOptions() {
      return {
        field: this.group?.fields.find((one) => one.key === this.selected) ?? null,
        fields: this.group?.fields ?? [],
        config: this.config,
        onChange: (patch) => this.patchField(this.selected, patch),
        onSettingChange: (key, value, typing) => {
          const field = this.group?.fields.find((one) => one.key === this.selected);
          if (field) {
            this.patchField(
              this.selected,
              { settings: { ...field.settings, [key]: value } },
              { redrawInspector: !typing }
            );
          }
        }
      };
    }
    drawInspector() {
      const host = this.root.querySelector("[data-atcfb-inspector]");
      if (!host || !this.config) {
        return;
      }
      const scroll = host.scrollTop;
      const open2 = new Set(
        Array.from(host.querySelectorAll("details")).filter((one) => one.open).map((one) => one.querySelector("summary")?.textContent ?? "")
      );
      renderInspector(host, this.inspectorOptions());
      host.querySelectorAll("details").forEach((one) => {
        const title = one.querySelector("summary")?.textContent ?? "";
        if (open2.size && open2.has(title)) {
          one.open = true;
        }
      });
      host.scrollTop = scroll;
    }
    /* ---------------------------------------------------------------------- */
    /* Mutations                                                               */
    /* ---------------------------------------------------------------------- */
    markDirty() {
      this.dirty = true;
      this.updateStatus();
    }
    /** Adds a field of a type at an index. */
    async addField(type, index) {
      if (!this.group) {
        await this.newGroup();
      }
      if (!this.group || !this.config) {
        return;
      }
      const definition = this.config.fieldTypes.find((one) => one.type === type);
      const label = definition?.label ?? type;
      const name = this.uniqueName(slug(label));
      const field = {
        key: `field_${uid("").replace(/\D/g, "")}${Math.random().toString(36).slice(2, 8)}`,
        name,
        label,
        type,
        instructions: "",
        required: false,
        readonly: false,
        wrapper: { width: 100, class: "", id: "" },
        conditional: { enabled: false, action: "show", match: "all", rules: [] },
        settings: { ...definition?.settings ?? {} }
      };
      this.group.fields.splice(Math.min(index, this.group.fields.length), 0, field);
      this.selected = field.key;
      this.markDirty();
      this.drawCanvas();
      this.drawInspector();
    }
    /**
     * Inserts a field that came from somewhere else.
     *
     * The key is minted fresh and the name is made unique, because the field is
     * a *copy*: keeping the source's key would make conditional logic in the
     * source group point at a field in this one, and keeping the name would make
     * two fields on the same post write to the same meta row.
     *
     * @param field The field as it arrived.
     * @param index Where to put it.
     */
    async insertField(field, index) {
      if (!this.group) {
        await this.newGroup();
      }
      if (!this.group) {
        return;
      }
      const copy = {
        ...field,
        key: `field_${Math.random().toString(36).slice(2, 15)}`,
        name: this.uniqueName(field.name),
        // A condition that pointed at a field in the source group cannot
        // mean anything here, and leaving it would draw a curve to a card
        // that does not exist. Dropped rather than remapped: there is no
        // correct remapping.
        conditional: { enabled: false, action: "show", match: "all", rules: [] }
      };
      this.group.fields.splice(Math.min(index, this.group.fields.length), 0, copy);
      this.selected = copy.key;
      this.markDirty();
      this.drawCanvas();
      this.drawInspector();
      notify(`“${copy.label}” copied into ${this.group.title}.`, "", "success");
    }
    /** Moves a field to an index. */
    moveField(key, index) {
      if (!this.group) {
        return;
      }
      const from = this.group.fields.findIndex((one) => one.key === key);
      if (from === -1) {
        return;
      }
      const [moved] = this.group.fields.splice(from, 1);
      this.group.fields.splice(Math.max(0, Math.min(index, this.group.fields.length)), 0, moved);
      this.markDirty();
      this.drawCanvas();
    }
    /** Applies a patch to one field. */
    patchField(key, patch, opts = {}) {
      if (!this.group) {
        return;
      }
      const field = this.group.fields.find((one) => one.key === key);
      if (!field) {
        return;
      }
      Object.assign(field, patch);
      if (patch.name !== void 0) {
        field.name = this.uniqueName(slug(patch.name), key);
      }
      this.markDirty();
      this.drawCanvas();
      if (patch.conditional || patch.settings && false !== opts.redrawInspector) {
        this.drawInspector();
      }
    }
    /** Removes a field, and any condition that pointed at it. */
    removeField(key) {
      if (!this.group) {
        return;
      }
      this.group.fields = this.group.fields.filter((one) => one.key !== key);
      this.selected = "";
      this.markDirty();
      this.drawCanvas();
      this.drawInspector();
    }
    /** Duplicates a field. */
    duplicateField(key) {
      const field = this.group?.fields.find((one) => one.key === key);
      if (!field || !this.group) {
        return;
      }
      void this.insertField(field, this.group.fields.findIndex((one) => one.key === key) + 1);
    }
    /** A field name no sibling is using. */
    uniqueName(name, ignore = "") {
      const taken = new Set(
        (this.group?.fields ?? []).filter((one) => one.key !== ignore).map((one) => one.name)
      );
      if (!taken.has(name)) {
        return name || "field";
      }
      let suffix = 2;
      while (taken.has(`${name}_${suffix}`)) {
        suffix += 1;
      }
      return `${name}_${suffix}`;
    }
    /* ---------------------------------------------------------------------- */
    /* Persistence                                                             */
    /* ---------------------------------------------------------------------- */
    /** Opens a group by id. */
    async openGroup(id) {
      if (this.dirty && !await confirm("There are unsaved changes. Open another group anyway?")) {
        return;
      }
      try {
        this.group = await getGroup(id);
        this.selected = this.group.fields[0]?.key ?? "";
        this.dirty = false;
        this.starters = false;
        this.tab = "fields";
      } catch (error) {
        notify("That group would not open.", error instanceof Error ? error.message : "", "error");
        return;
      }
      this.drawChrome();
      this.drawGroups();
      this.drawMain();
      this.announce();
    }
    /** Creates a group. */
    async newGroup() {
      const created = await saveGroup({
        version: 1,
        key: "",
        title: "New field group",
        fields: [],
        location: [],
        settings: {
          active: true,
          description: "",
          position: "normal",
          style: "default",
          label_placement: "top",
          instruction_placement: "label",
          menu_order: 0,
          hide_on_screen: [],
          show_in_rest: true,
          block: {
            enabled: false,
            name: "",
            title: "",
            description: "",
            icon: "block-default",
            category: "widgets",
            keywords: [],
            template: "",
            align: ""
          }
        }
      });
      this.summaries = await listGroups();
      this.group = created;
      this.selected = "";
      this.dirty = false;
      this.starters = false;
      this.drawChrome();
      this.drawGroups();
      this.drawMain();
      this.announce();
      const title = this.root.querySelector(".atcfb__title");
      title?.focus();
      title?.select();
    }
    /** Saves the open group. */
    async save() {
      if (!this.group) {
        return;
      }
      try {
        this.group = await saveGroup(this.group);
        this.dirty = false;
        this.summaries = await listGroups();
        this.drawGroups();
        this.updateStatus();
        this.announce();
        notify("Saved.", "", "success");
        void this.renderPreview(true);
      } catch (error) {
        notify("That would not save.", error instanceof Error ? error.message : "", "error");
      }
    }
    /** Deletes the open group. */
    async deleteGroup(id, title) {
      const target = id ?? this.group?.id ?? 0;
      const name = title ?? this.group?.title ?? "";
      if (!target) {
        return;
      }
      const yes = await confirm(
        `Delete “${name}”? It goes to the trash, and the values already stored on your posts are left exactly where they are — so restoring the group brings everything back.`,
        { title: "Delete this field group?", confirmLabel: "Delete", danger: true }
      );
      if (!yes) {
        return;
      }
      try {
        await deleteGroup(target);
      } catch (error) {
        notify("That group would not delete.", error instanceof Error ? error.message : "", "error");
        return;
      }
      if (this.group?.id === target) {
        this.group = null;
        this.dirty = false;
        this.selected = "";
      }
      this.summaries = await listGroups();
      notify(`“${name}” deleted.`, "Your posts keep their values.", "success");
      this.drawChrome();
      this.drawGroups();
      this.drawMain();
    }
    /** Tells the shell what this window is showing. */
    announce() {
      if (!this.group) {
        setIdentity(this.root, null);
        return;
      }
      const summary = this.summaries.find((one) => one.key === this.group?.key);
      setIdentity(
        this.root,
        groupIdentity(
          {
            id: this.group.id ?? 0,
            key: this.group.key,
            title: this.group.title,
            types: summary?.types ?? []
          },
          this.config?.adminUrl ?? ""
        )
      );
    }
    /**
     * Renders the preview into the preview window, or into a panel without one.
     *
     * @param onlyIfOpen Skip when no preview window is showing, so a save does
     *                   not open one the user never asked for.
     */
    async renderPreview(onlyIfOpen = false) {
      if (!this.group?.id) {
        return;
      }
      const host = document.querySelector("[data-atcfp-body]");
      if (!host) {
        if (onlyIfOpen) {
          return;
        }
        return;
      }
      const titleNode = document.querySelector("[data-atcfp-title]");
      const sampleNode = document.querySelector("[data-atcfp-sample]");
      try {
        const result = await preview(this.group.id);
        clear(host);
        host.innerHTML = result.markup;
        if (titleNode) {
          titleNode.textContent = result.title;
        }
        if (sampleNode) {
          sampleNode.textContent = result.sample ? `Against post #${result.sample}` : "No sample post";
        }
        boot(host);
        const previewRoot = host.closest("[data-atcfp-root]");
        if (previewRoot) {
          setIdentity(previewRoot, previewIdentity({ id: this.group.id, key: this.group.key, title: this.group.title }));
        }
      } catch (error) {
        clear(host);
        host.append(el("p", { class: "atcfp__error", text: error instanceof Error ? error.message : String(error) }));
      }
    }
  }
  function windowParam(element, key) {
    const id = windowIdOf(element);
    const params = id ? shell()?.getWindowParams?.(id) : void 0;
    return params && params[key] !== void 0 ? String(params[key]) : "";
  }
  function slug(value) {
    return value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  }
  const mounted = [];
  function mount(body) {
    const root = body.querySelector("[data-atcfb-root]") ?? body;
    if (root.dataset.atcfbMounted === "1") {
      return;
    }
    root.dataset.atcfbMounted = "1";
    const builder = new Builder(root);
    mounted.push(builder);
    void builder.start();
  }
  const globals = window;
  globals.openStationNativeWindows = globals.openStationNativeWindows ?? {};
  globals.openStationNativeWindows["allterrain-fields"] = (body) => mount(body);
  globals.openStationNativeWindows["allterrain-fields-formula"] = (body) => {
    const root = body.querySelector("[data-atcf-formula-root]") ?? body;
    mountFormulaWindow(root);
  };
  globals.openStationNativeWindows["allterrain-fields-preview"] = (body) => {
    const root = body.querySelector("[data-atcfp-root]") ?? body;
    root.dataset.atcfpMounted = "1";
    mounted.forEach((builder) => void builder.renderPreview());
  };
  if (typeof document !== "undefined") {
    whenShellReady(() => {
      document.querySelectorAll("[data-atcfb-root]").forEach((root) => {
        if (!shellIsActive() || !root.closest(".os-window")) {
          mount(root);
        }
      });
    });
  }
  exports.Builder = Builder;
  exports.icon = icon;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
}({});
