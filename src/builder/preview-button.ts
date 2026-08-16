/**
 * The eye in the title bar.
 *
 * OpenStation has a convention for this: a window that has something to show
 * carries a **Preview** button — an eye, on the right of the title bar, just
 * before Related — and pressing it opens that thing *as its own window*, paired
 * with the editor rather than replacing it. The shell does this for post and
 * page edit screens.
 *
 * A field group is the same shape of thing, so it wears the same affordance
 * rather than inventing a different one. What it has to show is not a front-end
 * page: it is **the edit screen it is about to create** — the group's fields
 * rendered by the real renderer, against a real post, with the real controls.
 *
 * Pairing beats a modal for a reason that only shows up once you use it: the
 * builder stays open and usable beside the preview. You can widen a field, watch
 * the preview reflow, drag another in, and watch again — where a modal makes you
 * close it, change one thing, and open it again.
 *
 * All of it degrades. Without a shell there is no title bar to put a button in,
 * so `register()` returns a teardown that does nothing and the builder's own
 * Preview button renders the same thing in a panel beside the canvas.
 */

import { config } from '../api';
import { shell, shellIsActive } from '../shell';

/** The id the button is registered under. */
const BUTTON_ID = 'allterrain-fields/preview';

/** What the builder tells this module about the group currently open. */
export interface PreviewSource {
	/** The group being edited, or null when none is. */
	current(): { id: number; key: string; title: string } | null;
	/** True when there are unsaved changes, so the button can save first. */
	isDirty(): boolean;
	/** Saves, so the preview shows what is on screen rather than what was stored. */
	save(): Promise< void >;
	/** Renders the preview into the preview window. */
	render(): void;
}

/**
 * Adds the eye to the builder window's title bar.
 *
 * @param source What the builder is showing.
 * @return A teardown. Safe with no shell — it registers nothing.
 */
export function registerPreviewButton( source: PreviewSource ): () => void {
	const os = shell();

	if ( ! os?.registerTitleBarButton || ! config().previewWindow ) {
		return () => undefined;
	}

	let registered = false;

	const register = () => {
		try {
			if ( ! os.registerTitleBarButton ) {
				return;
			}

			os.registerTitleBarButton( {
				id: BUTTON_ID,
				label: 'Preview this field group',
				icon: 'dashicons-visibility',
				placement: 'right',
				// Just before the shell's own Related button, so the builder's
				// eye lands where every other window's eye is.
				order: 90,
				// Only the builder window. The predicate is called against a live
				// `Window`, and a throw counts as "does not match" — so a shell
				// whose `Window` shape differs simply does not show the button
				// rather than erroring on every repaint.
				match: ( win: { id?: string; config?: { id?: string } } ) => {
					const id = win?.id ?? win?.config?.id ?? '';

					return id === 'allterrain-fields' || id.startsWith( 'allterrain-fields#' );
				},
				onClick: () => void open( source ),
				owner: 'allterrain-fields-builder',
			} );

			registered = true;
		} catch {
			// `registerTitleBarButton` throws on a shell whose validation differs
			// from the one this was written against. A missing button is a
			// missing convenience, not a broken builder.
		}
	};

	if ( os.ready ) {
		os.ready( register );
	} else {
		register();
	}

	return () => {
		if ( ! registered ) {
			return;
		}

		try {
			os.unregisterTitleBarButton?.( BUTTON_ID );
		} catch {
			// Documented as idempotent; a shell that disagrees is not worth
			// taking the teardown down over.
		}
	};
}

/**
 * Opens — or refreshes — the paired preview window.
 *
 * Unsaved work is saved first. The preview renders the *stored* group through
 * the real server-side renderer, so previewing without saving would quietly show
 * the last saved version and look like the builder had lost the edit.
 *
 * @param source What the builder is showing.
 */
export async function open( source: PreviewSource ): Promise< void > {
	if ( source.isDirty() ) {
		await source.save();
	}

	const group = source.current();

	if ( ! group ) {
		return;
	}

	const os = shell();
	const windowId = config().previewWindow;

	if ( os?.openWindow && windowId ) {
		os.openWindow( windowId, { source: 'allterrain-fields-builder' } );
	}

	// Rendered after the open rather than before, and again on every subsequent
	// press: the window is a singleton, so pressing the eye with a different
	// group open has to replace what is in it rather than opening a second one.
	source.render();
}

/**
 * Whether the shell will give this window an eye in its title bar.
 *
 * Asked by the builder before it draws its own Preview button. The eye is the
 * shell's convention for previewing and the toolbar button is the fallback for
 * an admin page that has no title bar to put one in — with both present the
 * window offers the same action twice, six pixels apart.
 *
 * A capability check rather than a flag set by `registerPreviewButton()`,
 * because the toolbar is drawn before the shell is ready and a flag would be
 * false the first time and true after, which is a Preview button that appears
 * and then vanishes.
 *
 * @return True when the title bar will carry the eye.
 */
export function titleBarWillPreview(): boolean {
	return Boolean( shellIsActive() && shell()?.registerTitleBarButton && config().previewWindow );
}
