(function() {
  "use strict";
  function shell() {
    return window.wp?.os ?? null;
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
  function icon(slug, opts = {}) {
    if (hasComponent("os-icon")) {
      return el("os-icon", { ...opts, attrs: { icon: slug, ...opts.attrs ?? {} } });
    }
    return el("span", {
      ...opts,
      class: `dashicons ${slug} ${opts.class ?? ""}`.trim(),
      attrs: { "aria-hidden": "true", ...opts.attrs ?? {} }
    });
  }
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
  function search(params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== "" && value !== void 0 && value !== null) {
        query.set(key, String(value));
      }
    });
    return request(`search?${query.toString()}`);
  }
  const renderers = /* @__PURE__ */ new Map();
  function registerMount(type, renderer) {
    renderers.set(type, renderer);
  }
  function mountFor(type) {
    return renderers.get(type);
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
    const draw = async () => {
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
      const preview = isImage && attachment.thumbnail ? el("img", {
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
            preview,
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
                      void draw();
                    }
                  }
                })
              ]
            })
          ]
        })
      );
      makeDraggable(preview, attachment);
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
        void draw();
      }
    };
    host.addEventListener("atcf:media-dropped", (event) => {
      const [first] = event.detail.ids;
      if (first) {
        current = first;
        set(current);
        void draw();
      }
    });
    void draw();
  }
  registerMount("gallery", (context) => {
    const { host, field, set } = context;
    const settings = field.settings;
    const max = Number(settings.max_items ?? 0);
    let ids = Array.isArray(context.value) ? context.value.map(Number).filter(Boolean) : [];
    const commit = () => {
      set(ids);
      void draw();
    };
    const draw = async () => {
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
    void draw();
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
  const SHAPES = {
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
  Object.keys(SHAPES).forEach((type) => registerMount(type, (context) => relational(context, SHAPES[type])));
  function relational(context, shape) {
    const { host, field, set } = context;
    const multiple = shape.multiple(context);
    const max = shape.max(context);
    let chosen = toIds(context.value);
    let records = /* @__PURE__ */ new Map();
    let open = false;
    const listId = uid("atcf-rel");
    const commit = () => {
      set(multiple ? chosen : chosen[0] ?? 0);
      drawChips();
    };
    const root = el("div", { class: `atcf-rel atcf-rel--${shape.kind}` });
    const chips = el("div", { class: "atcf-rel__chips", attrs: { role: "list" } });
    const searchBox = control("os-text-field", "input", {
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
      open = false;
      results.setAttribute("hidden", "");
      searchBox.setAttribute("aria-expanded", "false");
      searchBox.value = "";
    };
    const openResults = () => {
      open = true;
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
      if (!open) {
        run(readValue(searchBox));
      }
    });
    searchBox.addEventListener("keydown", (event) => {
      const key = event.key;
      if (key === "Escape" && open) {
        event.stopPropagation();
        closeResults();
        return;
      }
      if (key === "ArrowDown" && open) {
        event.preventDefault();
        results.querySelector(".atcf-rel__result")?.focus();
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (open && !root.contains(event.target)) {
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
    const urlInput = control("os-text-field", "input", {
      class: "atcf-link__url",
      attrs: { type: "url", placeholder: "https://", "aria-label": "URL" }
    });
    const titleInput = control("os-text-field", "input", {
      class: "atcf-link__title",
      attrs: { type: "text", placeholder: t("add", "Add"), "aria-label": "Link text" }
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
        const input = control("os-text-field", "input", {
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
        const input = control("os-textarea", "textarea", {
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
        const input = control(
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
            children: [input, el("span", { class: "atcf-switch__label", text: String(settings.message ?? "") })]
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
    return parse(host.closest(".atcf-mount")?.dataset.atcfSubs, []);
  }
  function layoutsOf(host) {
    return parse(host.closest(".atcf-mount")?.dataset.atcfSubs, []);
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
  registerMount("repeater", (context) => repeater(context, subsOf(context.host)));
  registerMount("group", (context) => single(context, subsOf(context.host)));
  registerMount("clone", (context) => single(context, subsOf(context.host)));
  registerMount("flexible_content", (context) => flexible(context, layoutsOf(context.host)));
  function single(context, subs) {
    const values = context.value ?? {};
    const box = el("div", { class: "atcf-group" });
    const rendered = [];
    subs.forEach((sub) => {
      const field = renderField(sub, values[sub.key], (value) => {
        values[sub.key] = value;
        context.set({ ...values });
        relayout();
      });
      rendered.push(field);
      box.append(field.element);
    });
    const relayout = () => rendered.forEach((one) => one.applyLogic(values));
    context.host.append(box);
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
    const teardowns = [];
    const commit = () => {
      context.set(rows.map((row) => ({ ...row })));
      draw();
    };
    const blankRow = () => {
      const row = {};
      subs.forEach((sub) => {
        row[sub.key] = sub.settings.default_value ?? "";
      });
      return row;
    };
    const move = (from, to) => {
      if (to < 0 || to >= rows.length || from === to) {
        return;
      }
      const [moved] = rows.splice(from, 1);
      rows.splice(to, 0, moved);
      commit();
    };
    const draw = () => {
      teardowns.splice(0).forEach((fn) => fn());
      clear(list);
      clear(foot);
      rows.forEach((row, index) => {
        list.append(drawRow(row, index));
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
    const drawRow = (row, index) => {
      const rowId = uid("atcf-row");
      const body = el("div", { class: "atcf-row__body" });
      const rendered = [];
      subs.forEach((sub) => {
        const field = renderField(sub, row[sub.key], (value) => {
          row[sub.key] = value;
          context.set(rows.map((one) => ({ ...one })));
          rendered.forEach((one) => one.applyLogic(row));
        });
        rendered.push(field);
        body.append(field.element);
      });
      rendered.forEach((one) => one.applyLogic(row));
      teardowns.push(() => rendered.forEach((one) => one.destroy()));
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
            { kind: "repeater-row", field: context.field.key, index, row: { ...row } },
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
    draw();
    return () => teardowns.splice(0).forEach((fn) => fn());
  }
  function flexible(context, layouts) {
    const settings = context.field.settings;
    const max = Number(settings.max_items ?? 0);
    let rows = Array.isArray(context.value) ? context.value : [];
    const list = el("div", { class: "atcf-rows atcf-rows--flexible" });
    const foot = el("div", { class: "atcf-rows__foot" });
    const teardowns = [];
    const layoutFor = (name) => layouts.find((one) => one.name === name);
    const commit = () => {
      context.set(rows.map((row) => ({ ...row })));
      draw();
    };
    const draw = () => {
      teardowns.splice(0).forEach((fn) => fn());
      clear(list);
      clear(foot);
      rows.forEach((row, index) => {
        const layout = layoutFor(String(row.acf_fc_layout ?? ""));
        if (!layout) {
          list.append(
            el("div", {
              class: "atcf-row atcf-row--orphan",
              children: [
                el("p", { text: `${String(row.acf_fc_layout ?? "?")} — this block no longer exists` }),
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
          const field = renderField(sub, row[sub.key], (value) => {
            row[sub.key] = value;
            context.set(rows.map((one) => ({ ...one })));
            rendered.forEach((one) => one.applyLogic(row));
          });
          rendered.push(field);
          body.append(field.element);
        });
        rendered.forEach((one) => one.applyLogic(row));
        teardowns.push(() => rendered.forEach((one) => one.destroy()));
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
        const used = rows.filter((row) => row.acf_fc_layout === layout.name).length;
        menu.append(
          button(layout.label, {
            class: "atcf-layouts__add",
            attrs: { disabled: layout.max > 0 && used >= layout.max ? true : null },
            on: {
              click: () => {
                const row = { acf_fc_layout: layout.name };
                layout.sub_fields.forEach((sub) => {
                  row[sub.key] = sub.settings.default_value ?? "";
                });
                rows.push(row);
                commit();
              }
            }
          })
        );
      });
      foot.append(el("p", { class: "atcf-layouts__label", text: t("chooseLayout", "Choose a block") }), menu);
    };
    context.host.append(list, foot);
    draw();
    return () => teardowns.splice(0).forEach((fn) => fn());
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
  registerMount("color_picker", (context) => {
    const { host, field, set } = context;
    const settings = field.settings;
    let current = String(context.value ?? "");
    const swatchRow = el("div", { class: "atcf-color__palette" });
    const picker = el("input", { class: "atcf-color__input", attrs: { type: "color" } });
    const text = control("os-text-field", "input", {
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
      swatchRow.querySelectorAll(".atcf-color__swatch").forEach((swatch) => {
        swatch.setAttribute("aria-pressed", swatch.dataset.color === current ? "true" : "false");
      });
    };
    (settings.palette ?? ["#1e1e1e", "#f0f0f1", "#3858e9", "#00a32a", "#d63638", "#dba617"]).forEach((swatch) => {
      swatchRow.append(
        el("button", {
          class: "atcf-color__swatch",
          attrs: { type: "button", "aria-label": swatch, "aria-pressed": "false" },
          dataset: { color: swatch },
          style: { backgroundColor: swatch },
          on: { click: () => apply2(swatch) }
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
    const preview = el("span", { class: "atcf-icon__preview" });
    const grid = el("div", { class: "atcf-icon__grid", attrs: { role: "radiogroup" } });
    const text = control("os-text-field", "input", {
      class: "atcf-icon__slug",
      attrs: { type: "text", placeholder: "dashicons-…", "aria-label": "Dashicons class" }
    });
    const apply2 = (value) => {
      current = value;
      text.value = value;
      clear(preview);
      if (value) {
        preview.append(icon(value));
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
    ICONS.forEach((slug) => {
      grid.append(
        el("button", {
          class: "atcf-icon__choice",
          attrs: { type: "button", role: "radio", "aria-checked": "false", "aria-label": slug },
          dataset: { icon: slug },
          children: [icon(slug)],
          on: { click: () => apply2(slug) }
        })
      );
    });
    text.addEventListener("change", () => apply2(readValue(text).trim()));
    host.append(el("div", { class: "atcf-icon", children: [preview, text, grid] }));
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
    const address = control("os-text-field", "input", {
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
      const box = [value.lng - span, value.lat - span, value.lng + span, value.lat + span].join(",");
      map.append(
        el("iframe", {
          class: "atcf-location__frame",
          attrs: {
            src: `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(box)}&marker=${value.lat},${value.lng}`,
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
      set(rows.map((row) => ({ ...row })));
      draw();
    };
    const draw = () => {
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
      rows.forEach((row, index) => {
        const tr = el("tr");
        columns.forEach((column) => {
          const input = el("input", {
            class: "atcf-table__cell",
            attrs: { type: "text", value: String(row[column.value] ?? ""), "aria-label": column.label }
          });
          input.addEventListener("change", () => {
            row[column.value] = input.value;
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
                const row = {};
                columns.forEach((column) => {
                  row[column.value] = "";
                });
                rows.push(row);
                commit();
              }
            }
          })
        );
      }
    };
    host.append(table, foot);
    draw();
  });
  registerMount("json", (context) => {
    const { host, field, set } = context;
    const settings = field.settings;
    const area = control("os-textarea", "textarea", {
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
    const input = control("os-text-field", "input", {
      class: "atcf-input",
      attrs: { type: "url", placeholder: "https://" }
    });
    const preview = el("div", { class: "atcf-oembed__preview" });
    input.value = String(context.value ?? "");
    const refresh = debounce(() => {
      const url = readValue(input).trim();
      set(url);
      clear(preview);
      if (!url) {
        return;
      }
      preview.append(el("a", { text: url, attrs: { href: url, target: "_blank", rel: "noreferrer noopener" } }));
    }, 300);
    input.addEventListener("input", refresh);
    host.append(el("div", { class: "atcf-oembed", children: [input, preview] }));
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
  class Inspector {
    constructor(root) {
      this.ref = null;
      this.token = 0;
      this.root = root;
    }
    /** Starts watching for focus changes. */
    start() {
      void componentsReady();
      this.draw(null);
      document.addEventListener("os-window-focused", (event) => {
        const id = event.detail?.windowId;
        if (id) {
          void this.follow(id);
        }
      });
      document.addEventListener("os-window-content-changed", (event) => {
        const id = event.detail?.windowId;
        if (id) {
          void this.follow(id);
        }
      });
    }
    /** Points the inspector at whatever a window is showing. */
    async follow(windowId) {
      const identity = shell()?.relations?.get?.(windowId);
      const ref = refOf(identity);
      if (!ref) {
        this.ref = null;
        this.draw(null);
        return;
      }
      if (this.ref && this.ref.type === ref.type && this.ref.id === ref.id) {
        return;
      }
      this.ref = ref;
      const mine = ++this.token;
      try {
        const { restUrl, nonce } = config();
        const response = await fetch(`${restUrl}object?type=${encodeURIComponent(ref.type)}&id=${encodeURIComponent(String(ref.id))}`, {
          credentials: "same-origin",
          headers: { "X-WP-Nonce": nonce }
        });
        if (mine !== this.token) {
          return;
        }
        if (!response.ok) {
          this.draw(null);
          return;
        }
        this.draw(await response.json());
      } catch {
        if (mine === this.token) {
          this.draw(null);
        }
      }
    }
    /** Paints. */
    draw(data) {
      clear(this.root);
      if (!data) {
        this.root.append(
          el("div", {
            class: "atcfw__empty",
            children: [
              icon("dashicons-index-card"),
              el("p", { text: "Focus a window showing a post, a term or a person and its fields appear here." })
            ]
          })
        );
        return;
      }
      if (!data.fields.length) {
        this.root.append(
          el("div", {
            class: "atcfw__empty",
            children: [
              el("p", { text: `“${data.label}” has no custom fields.` })
            ]
          })
        );
        return;
      }
      this.root.append(el("h2", { class: "atcfw__title", text: data.label }));
      const list = el("div", { class: "atcfw__fields atcf-fields" });
      data.fields.forEach((field) => {
        const rendered = renderField(field, data.values[field.key], (value) => void this.write(field, value));
        list.append(rendered.element);
      });
      this.root.append(list);
    }
    /** Writes one field. */
    async write(field, value) {
      if (!this.ref) {
        return;
      }
      try {
        const { restUrl, nonce } = config();
        const response = await fetch(`${restUrl}object`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-WP-Nonce": nonce },
          body: JSON.stringify({ ...this.ref, field: field.key, value })
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          notify("That would not save.", body?.message ?? "", "error");
          return;
        }
        shell()?.broadcast?.("os.allterrain-fields.changed", {
          source: "field-inspector",
          action: "updated",
          ids: [this.ref.id],
          field: field.key
        });
      } catch (error) {
        notify("That would not save.", error instanceof Error ? error.message : "", "error");
      }
    }
  }
  function refOf(identity) {
    if (!identity) {
      return null;
    }
    const type = String(identity.type);
    if (["post", "page", "media"].includes(type)) {
      return { type: "post", id: Number(identity.id) };
    }
    if (type === "user") {
      return { type: "user", id: Number(identity.id) };
    }
    if (type === "term" || type.startsWith("term/")) {
      return { type: "term", id: Number(identity.id) };
    }
    return null;
  }
  const globals = window;
  globals.openStationWidgets = globals.openStationWidgets ?? {};
  globals.openStationWidgets["allterrain-fields/inspector"] = (body) => {
    if (body.dataset.atcfwMounted === "1") {
      return;
    }
    body.dataset.atcfwMounted = "1";
    body.classList.add("atcfw");
    new Inspector(body).start();
  };
})();
