var allTerrainFieldsDock = function(exports) {
  "use strict";
  const NEW_TYPE_FLAG = "allterrain-fields/open-new-type";
  const config = window.allTerrainFields;
  const BUILDER = "allterrain-fields";
  const TAB_MAIN = "main";
  const TAB_MODEL = "model";
  const TAB_BULK = "bulk";
  const TAB_TOOLS = "tools";
  function shell() {
    return window.wp?.os ?? null;
  }
  function activate(value, tries = 40) {
    const win = shell()?.windowManager?.getById?.(BUILDER);
    if (win?.activateTab) {
      win.activateTab(value);
      return;
    }
    if (tries > 0) {
      window.setTimeout(() => activate(value, tries - 1), 50);
    }
  }
  function open(value) {
    shell()?.openWindow?.(BUILDER, { source: "dock", params: { tab: value } });
    activate(value);
  }
  function submenuFor(runtime) {
    const rows = [];
    if (!runtime?.canManage) {
      return rows;
    }
    rows.push({ title: "Field groups", url: "", onSelect: () => open(TAB_MAIN), windowId: BUILDER });
    rows.push({ title: "Content model", url: "", onSelect: () => open(TAB_MODEL), windowId: BUILDER });
    rows.push({ title: "Bulk editor", url: "", onSelect: () => open(TAB_BULK), windowId: BUILDER });
    rows.push({ title: "Import, export and sync", url: "", onSelect: () => open(TAB_TOOLS), windowId: BUILDER });
    rows.push({
      title: "New custom post type…",
      url: "",
      onSelect: () => {
        open(TAB_MODEL);
        try {
          window.sessionStorage.setItem(NEW_TYPE_FLAG, "1");
        } catch {
        }
        shell()?.broadcast?.("os.allterrain-fields.new-content-type", {});
      },
      windowId: BUILDER
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
        title: "AllTerrain Custom Fields",
        icon: "dashicons-index-card",
        // Ahead of the shell's own trailing cluster, which starts at 10.
        order: 6,
        // The flyout is a hover gesture and never fans out for keyboard or
        // touch, so the tile's own activation has to go somewhere useful:
        // the builder, which is what the tile is named after.
        onOpen: () => open(TAB_MAIN),
        isOpen: () => Boolean(os.windowManager?.getById?.(BUILDER)),
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
      ["allterrain-fields", TAB_MAIN],
      ["allterrain-fields-model", TAB_MODEL],
      ["allterrain-fields-bulk", TAB_BULK],
      ["allterrain-fields-tools", TAB_TOOLS]
    ];
    pages.forEach(([page, tab]) => {
      const entry = {
        id: `allterrain-fields/${page}`,
        nativeWindowId: BUILDER,
        matches: (_url, parsed) => parsed.pathname.endsWith("/admin.php") && parsed.searchParams.get("page") === page
      };
      if (tab === TAB_MAIN) {
        entry.params = (_url, parsed) => ({
          tab,
          group: Number(parsed.searchParams.get("group")) || 0
        });
      } else {
        entry.params = () => ({ tab });
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
