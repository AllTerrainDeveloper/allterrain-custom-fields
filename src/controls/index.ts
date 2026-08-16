/**
 * The field runtime.
 *
 * Loaded on every admin screen that has a field on it — the post editor, a term
 * screen, a user profile, an options page — and on the same screens *inside* an
 * OpenStation window, where it also installs the cross-frame drop bridge.
 *
 * It does five things, in this order, and the order matters:
 *
 * 1. **Asks for the component kit**, once, so `<os-*>` tags upgrade before
 *    anything draws with them — and waits for it only inside the shell, where it
 *    is a local fetch. On a plain admin screen it does not wait at all: every
 *    control has a working plain-HTML form, and a post editor that blocked on a
 *    kit which is not installed would be a post editor that never renders.
 * 2. **Mounts the controls** PHP left mount points for.
 * 3. **Wires conditional logic** across the whole form, evaluated with the same
 *    engine the server uses on save.
 * 4. **Turns tab and accordion markers into tabs and accordions.** PHP emits
 *    them as flat markers rather than as nesting, because a tab is a *separator*
 *    — the fields after it belong to it until the next one — and a renderer that
 *    nested them would have to look ahead through conditionally hidden fields.
 * 5. **Registers the drop targets.**
 *
 * Everything is idempotent and re-runnable, because the block editor re-renders
 * its metabox area after a save and the whole form arrives again.
 */

import './media';
import './relational';
import './repeater';
import './misc';

import { CHANGE_EVENTS, componentsReady } from '../ui';
import { config } from '../api';
import { mountFor, publishRegistry } from './mount';
import { visible } from '../shared/logic';
import { dropsAreAvailable, listenForCrossFrameDrops, listenForFileDrops, registerFieldDropTargets } from './drops';
import type { Conditional, Field } from '../types';
import type { LogicValues } from '../shared/logic';

/** Marks a node as already handled, so a second pass skips it. */
const DONE = 'atcfMounted';

/** Boots the runtime against a root, twice if the components arrive later. */
export function boot( root: ParentNode = document ): void {
	mountAll( root );
	wireLogic( root );
	buildTabs( root );
	buildAccordions( root );

	if ( dropsAreAvailable() ) {
		registerFieldDropTargets( root );
		listenForFileDrops( root );
	}

	// Kept for the case where the kit arrives after a plain-admin boot: controls
	// already built stay as they are — swapping one the user may have typed into
	// would lose the keystroke — but anything mounted from here on, a repeater
	// row or a metabox the block editor re-rendered, gets the component.
	void componentsReady();
}

/**
 * Fills in every mount point.
 *
 * @param root Where to look.
 */
function mountAll( root: ParentNode ): void {
	root.querySelectorAll< HTMLElement >( '.atcf-mount' ).forEach( ( host ) => {
		if ( host.dataset[ DONE ] === '1' ) {
			return;
		}

		const type = host.dataset.atcfMount ?? '';
		const renderer = mountFor( type );
		const wrapper = host.closest< HTMLElement >( '[data-atcf-field]' );

		if ( ! renderer || ! wrapper ) {
			return;
		}

		const field = parse< Field | null >( host.dataset.atcfFieldJson, null );
		const input = host.parentElement?.querySelector< HTMLInputElement >( '[data-atcf-fallback]' ) ?? null;

		if ( ! field ) {
			return;
		}

		host.dataset[ DONE ] = '1';

		// Everything inside the mount is replaced, including the `<noscript>`.
		// The hidden input is a sibling, not a child, precisely so this cannot
		// remove it — the input is what submits, and a control that deleted its
		// own submission on mount would blank the field on the next save.
		host.textContent = '';

		renderer( {
			host,
			field,
			value: parse< unknown >( host.dataset.atcfValue, null ),
			wrapper,
			set: ( value ) => {
				if ( input ) {
					input.value = JSON.stringify( value ?? null );
				}

				host.dataset.atcfValue = JSON.stringify( value ?? null );

				// Bubbles, so the form-wide logic pass and any computed field
				// beside it recalculate. A control that only wrote its own hidden
				// input would leave a condition depending on it permanently
				// looking at the value the page loaded with.
				wrapper.dispatchEvent( new CustomEvent( 'atcf:changed', { bubbles: true, detail: { field: field.key, value } } ) );
			},
		} );
	} );
}

/** Decodes a data attribute, tolerating anything. */
function parse< T >( raw: string | undefined, fallback: T ): T {
	if ( ! raw ) {
		return fallback;
	}

	try {
		return JSON.parse( raw ) as T;
	} catch {
		return fallback;
	}
}

/* -------------------------------------------------------------------------- */
/* Conditional logic                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Wires every conditional field on a form.
 *
 * One listener on the form root rather than one per dependency. A rules-driven
 * listener list has to be rebuilt whenever a repeater adds a row or a field
 * group is edited, and the version that is not rebuilt is the one where a
 * condition stops firing — which nobody notices, because the field simply stays
 * where it was.
 *
 * @param root Where to look.
 */
function wireLogic( root: ParentNode ): void {
	root.querySelectorAll< HTMLElement >( '.atcf-fields' ).forEach( ( form ) => {
		if ( form.dataset[ DONE ] === 'logic' ) {
			return;
		}

		form.dataset[ DONE ] = 'logic';

		const apply = () => applyLogic( form );

		// Every name, not just the native two. The `<os-*>` events bubble and are
		// composed, so they reach this one delegated listener — but only if it is
		// listening for them, and it was not. A field conditional on an
		// `<os-select>` never showed or hid.
		CHANGE_EVENTS.forEach( ( name ) => form.addEventListener( name, apply ) );
		form.addEventListener( 'atcf:changed', apply );

		apply();
	} );
}

/**
 * Reads every field's current value out of a form.
 *
 * Out of the DOM rather than from a store, because the values come from three
 * different places — PHP-rendered inputs, JS-mounted controls, and hidden JSON
 * blobs — and the DOM is the only thing all three agree on.
 *
 * @param form The `.atcf-fields` container.
 * @return Field key => value.
 */
export function readValues( form: HTMLElement ): LogicValues {
	const values: LogicValues = {};

	form.querySelectorAll< HTMLElement >( '[data-atcf-field]' ).forEach( ( wrapper ) => {
		const key = wrapper.dataset.atcfField ?? '';

		if ( ! key ) {
			return;
		}

		const mount = wrapper.querySelector< HTMLElement >( '.atcf-mount' );

		if ( mount ) {
			values[ key ] = parse< unknown >( mount.dataset.atcfValue, null ) as never;

			return;
		}

		const checkboxes = wrapper.querySelectorAll< HTMLInputElement >( 'input[type="checkbox"], input[type="radio"]' );

		if ( checkboxes.length ) {
			const checked = Array.from( checkboxes ).filter( ( one ) => one.checked );

			// A single checkbox is a switch and reports `1`/`0`; a group of them
			// reports the list. Reporting `['1']` for a switch would make every
			// `is 1` rule fail, because a rule compares against a scalar.
			values[ key ] =
				checkboxes.length === 1 && checkboxes[ 0 ].type === 'checkbox'
					? checkboxes[ 0 ].checked
						? '1'
						: '0'
					: checked.map( ( one ) => one.value );

			return;
		}

		const select = wrapper.querySelector< HTMLSelectElement >( 'select' );

		if ( select ) {
			values[ key ] = select.multiple
				? Array.from( select.selectedOptions ).map( ( one ) => one.value )
				: select.value;

			return;
		}

		const input = wrapper.querySelector< HTMLInputElement | HTMLTextAreaElement >( 'input:not([type="hidden"]), textarea' );

		values[ key ] = input ? input.value : null;
	} );

	return values;
}

/**
 * Shows or hides every conditional field in a form.
 *
 * @param form The `.atcf-fields` container.
 */
export function applyLogic( form: HTMLElement ): void {
	const values = readValues( form );

	form.querySelectorAll< HTMLElement >( '[data-atcf-conditional]' ).forEach( ( wrapper ) => {
		const conditional = parse< Conditional | null >( wrapper.dataset.atcfConditional, null );

		if ( ! conditional ) {
			return;
		}

		const shown = visible( conditional, values );

		wrapper.hidden = ! shown;
		wrapper.classList.toggle( 'atcf-field--hidden', ! shown );

		// Disabled as well as hidden, and this is not belt-and-braces. A
		// `required` control that is merely invisible still blocks the browser's
		// own form validation, and the user is told to fill in a field they
		// cannot see or reach — which is the exact bug the server-side twin of
		// this engine exists to prevent, arriving from the other direction.
		wrapper.querySelectorAll< HTMLInputElement >( 'input, select, textarea, button' ).forEach( ( control ) => {
			control.disabled = ! shown;
		} );
	} );
}

/* -------------------------------------------------------------------------- */
/* Tabs and accordions                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Turns flat tab markers into a tab strip with panels.
 *
 * Real `role="tablist"` semantics with arrow-key navigation, because a tab strip
 * that is a row of buttons is a tab strip a screen reader announces as a row of
 * buttons.
 *
 * @param root Where to look.
 */
function buildTabs( root: ParentNode ): void {
	root.querySelectorAll< HTMLElement >( '.atcf-fields' ).forEach( ( form ) => {
		const markers = Array.from( form.querySelectorAll< HTMLElement >( '.atcf-field--tab' ) );

		if ( ! markers.length || form.dataset.atcfTabs === '1' ) {
			return;
		}

		form.dataset.atcfTabs = '1';

		const strip = document.createElement( 'div' );

		strip.className = 'atcf-tabs';
		strip.setAttribute( 'role', 'tablist' );

		const panels: HTMLElement[] = [];
		const buttons: HTMLButtonElement[] = [];

		markers.forEach( ( marker, index ) => {
			const label = marker.querySelector< HTMLElement >( '.atcf-tab-marker' )?.textContent ?? `Tab ${ index + 1 }`;
			const panel = document.createElement( 'div' );

			panel.className = 'atcf-tabs__panel';
			panel.setAttribute( 'role', 'tabpanel' );
			panel.id = `atcf-tabpanel-${ index }-${ Math.random().toString( 36 ).slice( 2, 8 ) }`;

			// Everything between this marker and the next belongs to this tab.
			let node = marker.nextElementSibling;

			while ( node && ! node.classList.contains( 'atcf-field--tab' ) ) {
				const next = node.nextElementSibling;

				panel.append( node );
				node = next;
			}

			const tab = document.createElement( 'button' );

			tab.type = 'button';
			tab.className = 'atcf-tabs__tab';
			tab.textContent = label;
			tab.setAttribute( 'role', 'tab' );
			tab.setAttribute( 'aria-controls', panel.id );
			tab.setAttribute( 'aria-selected', index === 0 ? 'true' : 'false' );
			tab.tabIndex = index === 0 ? 0 : -1;

			tab.addEventListener( 'click', () => activate( index ) );
			tab.addEventListener( 'keydown', ( event ) => {
				const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

				if ( ! step ) {
					return;
				}

				event.preventDefault();
				activate( ( index + step + buttons.length ) % buttons.length, true );
			} );

			strip.append( tab );
			marker.remove();
			panels.push( panel );
			buttons.push( tab );
		} );

		const activate = ( index: number, focus = false ) => {
			buttons.forEach( ( tab, position ) => {
				tab.setAttribute( 'aria-selected', position === index ? 'true' : 'false' );
				tab.tabIndex = position === index ? 0 : -1;
			} );

			panels.forEach( ( panel, position ) => {
				panel.hidden = position !== index;
			} );

			if ( focus ) {
				buttons[ index ].focus();
			}
		};

		form.prepend( strip );
		panels.forEach( ( panel ) => form.append( panel ) );
		activate( 0 );
	} );
}

/**
 * Turns accordion markers into `<details>` elements.
 *
 * The platform's own disclosure widget, which is keyboard-complete, announces
 * its state, and is searchable by the browser's find-in-page in every current
 * engine. A scripted one has to reimplement all three.
 *
 * @param root Where to look.
 */
function buildAccordions( root: ParentNode ): void {
	root.querySelectorAll< HTMLElement >( '.atcf-field--accordion' ).forEach( ( marker ) => {
		if ( marker.dataset[ DONE ] === 'accordion' ) {
			return;
		}

		marker.dataset[ DONE ] = 'accordion';

		const inner = marker.querySelector< HTMLElement >( '.atcf-accordion-marker' );
		const details = document.createElement( 'details' );
		const summary = document.createElement( 'summary' );

		details.className = 'atcf-accordion';
		details.open = inner?.dataset.atcfOpen === '1';
		summary.className = 'atcf-accordion__summary';
		summary.textContent = inner?.textContent ?? '';
		details.append( summary );

		let node = marker.nextElementSibling;

		while ( node && ! node.classList.contains( 'atcf-field--accordion' ) ) {
			const next = node.nextElementSibling;

			details.append( node );
			node = next;
		}

		marker.replaceWith( details );
	} );
}

/* -------------------------------------------------------------------------- */
/* Boot                                                                        */
/* -------------------------------------------------------------------------- */

publishRegistry();

if ( typeof document !== 'undefined' ) {
	const start = () => {
		boot();

		if ( config().shell.chromeless || window.parent !== window ) {
			listenForCrossFrameDrops();
		}
	};

	/**
	 * Inside the shell, wait for the component kit; outside it, paint now.
	 *
	 * The trade is different here from the windows'. A window is opened
	 * deliberately and a frame's wait is invisible; a post editor is already
	 * slow and every field on it has a working plain-HTML form, so blocking the
	 * mount on a fetch that may not be needed is the wrong side of the trade.
	 *
	 * Inside a shell window the kit is local and warm, and painting plain
	 * controls first would mean either leaving them plain or swapping a control
	 * the user may already have typed into.
	 */
	const begin = async () => {
		if ( config().shell.active || config().shell.chromeless ) {
			await componentsReady();
		}

		start();
	};

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', () => void begin(), { once: true } );
	} else {
		void begin();
	}

	// The block editor replaces its metabox area wholesale after a save, and
	// everything mounted into it goes with it. Re-running against the new DOM is
	// cheaper and far more reliable than trying to preserve the old one — every
	// mount is idempotent and skips what it has already done.
	const observer = new MutationObserver( ( records ) => {
		const added = records.some( ( record ) =>
			Array.from( record.addedNodes ).some(
				( node ) => node instanceof HTMLElement && node.querySelector?.( '.atcf-mount, .atcf-fields' )
			)
		);

		if ( added ) {
			boot();
		}
	} );

	observer.observe( document.body ?? document.documentElement, { childList: true, subtree: true } );

	// Clicking a validation error in the notice jumps to the field it names,
	// which on a forty-field screen is the difference between a message and an
	// instruction.
	document.addEventListener( 'click', ( event ) => {
		const link = ( event.target as HTMLElement | null )?.closest< HTMLElement >( '[data-atcf-focus]' );

		if ( ! link ) {
			return;
		}

		event.preventDefault();

		const key = ( link.dataset.atcfFocus ?? '' ).split( '[' )[ 0 ];
		const wrapper = document.querySelector< HTMLElement >( `[data-atcf-field="${ CSS.escape( key ) }"]` );

		wrapper?.scrollIntoView( { behavior: 'smooth', block: 'center' } );
		wrapper?.querySelector< HTMLElement >( 'input, select, textarea, button' )?.focus();
	} );
}
