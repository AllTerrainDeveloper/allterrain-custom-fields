var allTerrainFieldsDock = function(exports) {
  "use strict";
  const NEW_TYPE_FLAG = "allterrain-fields/open-new-type";
  const config = window.allTerrainFields;
  const BUILDER = "allterrain-fields";
  const MODEL = "allterrain-fields-model";
  const BULK = "allterrain-fields-bulk";
  const TOOLS = "allterrain-fields-tools";
  function shell() {
    return window.wp?.os ?? null;
  }
  function open(id) {
    shell()?.openWindow?.(id, { source: "dock" });
  }
  function submenuFor(runtime) {
    const rows = [];
    if (!runtime?.canManage) {
      return rows;
    }
    rows.push({ title: "Field groups", url: "", onSelect: () => open(BUILDER), windowId: BUILDER });
    rows.push({ title: "Content model", url: "", onSelect: () => open(MODEL), windowId: MODEL });
    rows.push({ title: "Bulk editor", url: "", onSelect: () => open(BULK), windowId: BULK });
    rows.push({ title: "Import, export and sync", url: "", onSelect: () => open(TOOLS), windowId: TOOLS });
    rows.push({
      title: "New custom post type…",
      url: "",
      onSelect: () => {
        open(MODEL);
        try {
          window.sessionStorage.setItem(NEW_TYPE_FLAG, "1");
        } catch {
        }
        shell()?.broadcast?.("os.allterrain-fields.new-content-type", {});
      },
      windowId: MODEL
    });
    return rows;
  }
  function registerTile() {
    const os = shell();
    if (!os?.registerSystemTile) {
      return;
    }
    const claimed = window;
    if (claimed.atcfDockTile) {
      return;
    }
    claimed.atcfDockTile = true;
    const submenu = submenuFor(config);
    if (!submenu.length) {
      return;
    }
    try {
      os.registerSystemTile({
        id: "allterrain-fields",
        title: "Fields",
        icon: "dashicons-index-card",
        // Ahead of the shell's own trailing cluster, which starts at 10.
        order: 6,
        // The flyout is a hover gesture and never fans out for keyboard or
        // touch, so the tile's own activation has to go somewhere useful:
        // the builder, which is what the tile is named after.
        onOpen: () => open(BUILDER),
        isOpen: () => Boolean(
          os.windowManager?.getById?.(BUILDER) || os.windowManager?.getById?.(MODEL) || os.windowManager?.getById?.(BULK) || os.windowManager?.getById?.(TOOLS)
        ),
        submenu
      });
    } catch {
    }
  }
  function registerUrlRemaps() {
    const os = shell();
    if (!os?.registerNativeUrlRemap) {
      return;
    }
    const pages = [
      ["allterrain-fields", BUILDER],
      ["allterrain-fields-model", MODEL],
      ["allterrain-fields-bulk", BULK],
      ["allterrain-fields-tools", TOOLS]
    ];
    pages.forEach(([page, windowId]) => {
      const entry = {
        id: `allterrain-fields/${page}`,
        nativeWindowId: windowId,
        matches: (_url, parsed) => parsed.pathname.endsWith("/admin.php") && parsed.searchParams.get("page") === page
      };
      if (windowId === BUILDER) {
        entry.params = (_url, parsed) => ({
          group: Number(parsed.searchParams.get("group")) || 0
        });
      }
      try {
        os.registerNativeUrlRemap?.(entry);
      } catch {
      }
    });
  }
  function boot() {
    const os = shell();
    const install = () => {
      registerTile();
      registerUrlRemaps();
    };
    if (os?.ready) {
      os.ready(install);
      return true;
    }
    if (os?.whenReady) {
      os.whenReady(install);
      return true;
    }
    if (os?.registerSystemTile) {
      install();
      return true;
    }
    return false;
  }
  if (!boot()) {
    document.addEventListener("os-init", () => void boot(), { once: true });
  }
  exports.submenuFor = submenuFor;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
}({});
