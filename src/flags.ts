/**
 * Small constants two bundles share.
 *
 * This file exists to have **no side effects**, and that is its whole job.
 *
 * `NEW_TYPE_FLAG` lived in `dock.ts`, which registers the dock tile at module
 * load. Importing one constant from it therefore pulled the entire dock into the
 * Content Model bundle — so opening that window registered the tile a *second*
 * time and the dock showed two Fields apps side by side.
 *
 * Nothing here may import anything that runs at load, and nothing here may run
 * at load itself. A constant is cheap to share; a module is not.
 */

/**
 * Where "open the new-post-type form" is left for a window that has not booted.
 *
 * `sessionStorage` rather than a broadcast alone, because opening the Content
 * Model for the first time and telling it something are two different moments —
 * a broadcast reaches a window that is already there, and this reaches one that
 * is still starting.
 */
export const NEW_TYPE_FLAG = 'allterrain-fields/open-new-type';
