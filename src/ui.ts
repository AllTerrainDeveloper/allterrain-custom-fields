/**
 * DOM helpers, and the one decision that runs through all of them.
 *
 * Every control this plugin builds in JavaScript comes out of `control()`, and
 * `control()` asks one question: **has this `<os-*>` tag actually upgraded?**
 *
 * Not "is the shell installed" and not "did `loadComponents()` resolve". The kit
 * registers a subset of its tags at boot and the rest per bundle, so a tag can
 * be missing after a perfectly successful load — and an `<os-select>` that never
 * upgraded is an inert element with no value, no keyboard behaviour and no way
 * for the user to tell that anything is wrong. Asking the custom element
 * registry is the only question whose answer is the truth.
 *
 * So: try the component, fall back to the platform. Both branches produce an
 * element with a `value`, a `change` event and an accessible name, which is the
 * entire contract the rest of the plugin depends on.
 */

import { hasComponent, loadComponents } from './shell';

/** Which `<os-*>` tags this plugin ever emits. Asked for in one call at boot. */
export const OS_TAGS = [
	'os-button',
	'os-text-field',
	'os-textarea',
	'os-number-field',
	'os-select',
	'os-option',
	'os-multiselect',
	'os-switch',
	'os-checkbox-label',
	'os-segmented',
	'os-segment',
	'os-range-field',
	'os-color-field',
	'os-tag-input',
	'os-chip',
	'os-card',
	'os-icon',
	'os-badge',
	'os-tile',
	'os-panel',
	'os-section',
	'os-row',
	'os-stack',
	'os-cluster',
	'os-grid',
	'os-empty-state',
	'os-spinner',
	'os-notice',
	'os-tabs',
	'os-tab',
	'os-tabpanel',
	'os-table',
	'os-menu',
	'os-menu-item',
	'os-modal',
	'os-flyout',
	'os-field-row',
	'os-avatar',
	'os-save-status',
	'os-relative-time',
	'os-code',
	'os-key',
	'os-progress-bar',
] as const;

/**
 * Asks the shell for the component kit, once.
 *
 * Cached as a promise rather than a boolean, so two bundles booting in the same
 * tab share one fetch instead of racing two.
 *
 * @return Whether the kit arrived.
 */
export function componentsReady(): Promise< boolean > {
	if ( ! pending ) {
		// Raced against a deadline, because callers await this before their first
		// paint. The kit is an *enhancement*: a shell that is slow to serve it, or
		// a `loadComponents()` that never settles, must not be able to leave a
		// window sitting on its loading state forever. After the deadline the
		// caller paints with platform controls, and anything mounted later still
		// gets components if the kit turns up.
		pending = Promise.race( [
			loadComponents( OS_TAGS ),
			new Promise< boolean >( ( resolve ) => window.setTimeout( () => resolve( false ), COMPONENT_TIMEOUT_MS ) ),
		] );
	}

	return pending;
}

/**
 * How long to wait for the component kit before painting without it.
 *
 * Generous rather than tight: inside the shell this is a local request that
 * normally lands in a frame or two, and a deadline short enough to fire on a
 * loaded machine would cost the components for no reason. It is a backstop
 * against never, not a performance budget.
 */
const COMPONENT_TIMEOUT_MS = 2500;

let pending: Promise< boolean > | null = null;

/** Attributes an element can be given, with `class` and `text` as shorthands. */
export interface ElementOptions {
	class?: string;
	text?: string;
	/**
	 * Inline styles.
	 *
	 * Custom properties are allowed and are applied with `setProperty()` — see
	 * `el()`. `Partial< CSSStyleDeclaration >` alone would reject `'--atcf-width'`
	 * at the type level while silently dropping it at runtime, which is the worst
	 * of both.
	 */
	style?: Partial< CSSStyleDeclaration > | Record< string, string >;
	dataset?: Record< string, string >;
	attrs?: Record< string, string | number | boolean | null | undefined >;
	on?: Record< string, ( event: Event ) => void >;
	children?: Array< Node | string | null | undefined >;
}

/**
 * Builds an element.
 *
 * `text` sets `textContent`, never `innerHTML`. That is not a style preference:
 * almost everything this plugin renders is a label somebody typed into a field
 * group, and a helper whose default was `innerHTML` would make every one of
 * those an injection point.
 *
 * @param tag  Tag name.
 * @param opts Everything about it.
 * @return The element.
 */
export function el< K extends keyof HTMLElementTagNameMap >(
	tag: K | string,
	opts: ElementOptions = {}
): HTMLElement {
	const node = document.createElement( tag as string );

	if ( opts.class ) {
		node.className = opts.class;
	}

	if ( opts.text !== undefined ) {
		node.textContent = opts.text;
	}

	// There is deliberately no `html` option. Every call site renders through
	// `text`, and an escape hatch that nobody uses is an escape hatch waiting
	// for the first careless caller — the day somebody needs real markup, they
	// can build it out of elements like everything else here does.

	if ( opts.style ) {
		Object.entries( opts.style ).forEach( ( [ property, value ] ) => {
			if ( value === undefined || value === null ) {
				return;
			}

			// `setProperty` for custom properties, assignment for the rest.
			//
			// `Object.assign( node.style, { '--x': '1' } )` silently does
			// nothing: `CSSStyleDeclaration` has no `--x` property to assign to,
			// so the write lands on the object and never reaches the element.
			// Everything that passed a custom property through here — a field
			// preview's `--atcf-width`, a node's own accent — was quietly having
			// it dropped and falling back to the value's default.
			if ( property.startsWith( '--' ) ) {
				node.style.setProperty( property, String( value ) );

				return;
			}

			( node.style as unknown as Record< string, string > )[ property ] = String( value );
		} );
	}

	if ( opts.dataset ) {
		Object.entries( opts.dataset ).forEach( ( [ key, value ] ) => {
			node.dataset[ key ] = value;
		} );
	}

	if ( opts.attrs ) {
		Object.entries( opts.attrs ).forEach( ( [ key, value ] ) => {
			if ( value === null || value === undefined || value === false ) {
				return;
			}

			node.setAttribute( key, value === true ? '' : String( value ) );
		} );
	}

	if ( opts.on ) {
		Object.entries( opts.on ).forEach( ( [ event, handler ] ) => node.addEventListener( event, handler ) );
	}

	( opts.children ?? [] ).forEach( ( child ) => {
		if ( child === null || child === undefined ) {
			return;
		}

		node.append( child );
	} );

	return node;
}

/**
 * Builds a control, as a component when one has upgraded and as the platform
 * element otherwise.
 *
 * @param tag      The `<os-*>` tag to prefer.
 * @param fallback The plain tag to use instead.
 * @param opts     Everything about it.
 * @return The element.
 */
export function control( tag: string, fallback: string, opts: ElementOptions = {} ): HTMLElement {
	return el( hasComponent( tag ) ? tag : fallback, opts );
}

/** A button, as `<os-button>` or `<button type="button">`. */
export function button( label: string, opts: ButtonOptions = {} ): HTMLElement {
	const { variant, ...rest } = opts;

	const node = control( 'os-button', 'button', {
		...rest,
		text: label,
		attrs: {
			type: 'button',
			// `variant`, not a background painted on from outside.
			//
			// `<os-button>` draws its own surface inside its shadow root, so a
			// `background` set on the host paints *behind* that surface — you get
			// a coloured rectangle with the real button sitting on top of it and
			// the component's own edge showing through. Exactly the double-border
			// mistake in a different property.
			variant: variant ?? null,
			...( rest.attrs ?? {} ),
		},
	} );

	if ( ! hasComponent( 'os-button' ) ) {
		// The admin's own classes, which are the fallback's equivalent of a
		// variant and are already loaded on every screen this renders on.
		node.classList.add( 'button' );

		if ( 'primary' === variant ) {
			node.classList.add( 'button-primary' );
		}

		if ( 'danger' === variant ) {
			node.classList.add( 'button-link-delete' );
		}
	}

	return node;
}

/** A button, and how loud it should be. */
export interface ButtonOptions extends ElementOptions {
	/**
	 * Visual weight.
	 *
	 * `primary` for the single attention-grabbing action on a surface. `holo` is
	 * the Holomesh fill and is reserved for a hero call to action — nothing in
	 * this plugin has earned one.
	 */
	variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link' | 'holo';
}

/** An icon, as `<os-icon>` or a `<span class="dashicons">`. */
export function icon( slug: string, opts: ElementOptions = {} ): HTMLElement {
	if ( hasComponent( 'os-icon' ) ) {
		// The component's attribute is `name`, and it tolerates the full
		// `dashicons-foo` slug as well as the bare suffix.
		return el( 'os-icon', { ...opts, attrs: { name: slug, ...( opts.attrs ?? {} ) } } );
	}

	return el( 'span', {
		...opts,
		class: `dashicons ${ slug } ${ opts.class ?? '' }`.trim(),
		attrs: { 'aria-hidden': 'true', ...( opts.attrs ?? {} ) },
	} );
}

/**
 * Binds one handler to every name a control might announce a change under.
 *
 * The `<os-*>` kit does not emit `change`, and finding that out cost more than
 * it should have. Two separate reasons a native listener misses:
 *
 * 1. **The kit uses its own names.** `<os-switch>` emits `os-switch-change`,
 *    `<os-select>` emits `os-pick`, the text controls emit `os-input-change` and
 *    `os-input-commit`. Nothing emits `change`.
 * 2. **`change` does not leave a shadow root.** Even where a component wraps a
 *    real `<input>`, the native `change` event is `composed: false` by spec, so
 *    it stops at the shadow boundary and never reaches us. `input` *is*
 *    composed, which is the only reason the text fields ever worked — by luck,
 *    through a hole that `change` does not have.
 *
 * So every control listens for the kit's name, the native name, or both, and
 * this de-duplicates: `os-input-change` and `input` can both fire for one
 * keystroke, and a handler that runs twice per character means two state updates
 * and two redraws for every letter typed.
 *
 * @param node   The control.
 * @param names  Event names to bind.
 * @param read   Reads the control's current value.
 * @param handle Called once per genuine change.
 */
function onChangeOf< T >(
	node: HTMLElement,
	names: string[],
	read: () => T,
	handle: ( value: T, event: Event ) => void
): void {
	// Seeded with what the control is showing right now, not with a "nothing
	// yet" sentinel. Several kit components announce on open as well as on pick,
	// and a sentinel would let that first announcement through as a change —
	// which marks a group dirty the moment somebody looks at a dropdown.
	let last = read();

	const fire = ( event: Event ) => {
		const value = read();

		if ( value === last ) {
			return;
		}

		last = value;
		handle( value, event );
	};

	names.forEach( ( name ) => node.addEventListener( name, fire ) );
}

/**
 * What a text-like control announces a change under.
 *
 * `os-input-change` per keystroke, `os-input-commit` on blur or Enter, and the
 * two native names for the plain `<input>` this file falls back to with no shell.
 */
const TEXT_EVENTS = [ 'os-input-change', 'os-input-commit', 'input', 'change' ];

/**
 * Every name any control in this plugin announces a change under.
 *
 * Exported because two other places need the same list and had the same bug: the
 * field runtime's `bind()`, and the edit screen's one delegated listener that
 * re-runs conditional logic. A field that shows and hides according to a
 * `<os-select>` would simply never move.
 */
export const CHANGE_EVENTS = [
	'os-input-change',
	'os-input-commit',
	'os-switch-change',
	'os-checkbox-change',
	'os-pick',
	'os-range-change',
	'os-color-change',
	'os-tag-add',
	'os-tag-remove',
	'input',
	'change',
];

/**
 * A single-line text control.
 *
 * The `value` property is set rather than the attribute, on both branches. An
 * `<input value="…">` attribute is the *default* value, so setting it after the
 * user has typed changes nothing on screen — which is the bug that makes a
 * control appear to ignore every programmatic update.
 *
 * @param value   Its current value.
 * @param opts    Everything else.
 * @param onInput Called on every keystroke.
 * @return The element.
 */
export function textField(
	value: string,
	opts: ElementOptions = {},
	onInput?: ( value: string, event: Event ) => void
): HTMLElement {
	const node = control( 'os-text-field', 'input', {
		...opts,
		attrs: { type: 'text', ...( opts.attrs ?? {} ) },
	} );

	( node as HTMLInputElement ).value = value;

	if ( onInput ) {
		onChangeOf( node, TEXT_EVENTS, () => readValue( node ), onInput );
	}

	return node;
}

/** A multi-line text control. */
export function textArea(
	value: string,
	opts: ElementOptions = {},
	onInput?: ( value: string, event: Event ) => void
): HTMLElement {
	const node = control( 'os-textarea', 'textarea', opts );

	( node as HTMLTextAreaElement ).value = value;

	if ( onInput ) {
		onChangeOf( node, TEXT_EVENTS, () => readValue( node ), onInput );
	}

	return node;
}

/** A numeric control. */
export function numberField(
	value: string | number,
	opts: ElementOptions = {},
	onInput?: ( value: string ) => void
): HTMLElement {
	const node = control( 'os-number-field', 'input', {
		...opts,
		attrs: { type: 'number', ...( opts.attrs ?? {} ) },
	} );

	( node as HTMLInputElement ).value = String( value ?? '' );

	if ( onInput ) {
		onChangeOf( node, TEXT_EVENTS, () => readValue( node ), ( value ) => onInput( value ) );
	}

	return node;
}

/** An on/off control. */
export function toggle(
	on: boolean,
	label: string,
	onChange: ( on: boolean ) => void,
	opts: ToggleOptions = {}
): HTMLElement {
	if ( hasComponent( 'os-switch' ) ) {
		// `label` as an attribute, not as a `<span>` beside it. The component
		// renders its own label, associates it with the button inside its shadow
		// root, and takes the click — which is three things this file used to do
		// by hand, less well: the hand-rolled version's text was not a label, so
		// clicking it did nothing until a `click` forwarder was bolted on.
		const node = el( 'os-switch', {
			attrs: {
				label,
				tone: opts.tone ?? SWITCH_TONE,
				size: opts.size ?? null,
				block: opts.block ? '' : null,
				description: opts.description ?? null,
			},
		} );

		// The `checked` **attribute**, set at construction, not a property set
		// afterwards. `<os-switch>` reads the attribute, and the property that
		// reflects into it is installed on the instance when the element
		// upgrades — so a property written before that moment lands as an
		// ordinary own property, is skipped by the accessor installer, and never
		// reaches the attribute. The switch then renders in the off position
		// whatever it was given, which is exactly what it was doing.
		if ( on ) {
			node.setAttribute( 'checked', '' );
		}

		onChangeOf(
			node,
			[ 'os-switch-change', 'change' ],
			() => node.hasAttribute( 'checked' ),
			( checked ) => onChange( checked )
		);

		return node;
	}

	const input = el( 'input', { attrs: { type: 'checkbox' } } ) as HTMLInputElement;

	input.checked = on;
	input.addEventListener( 'change', () => onChange( input.checked ) );

	return el( 'label', {
		class: 'atcf-toggle',
		children: [ input, el( 'span', { class: 'atcf-toggle__label', text: label } ) ],
	} );
}

/**
 * What an "on" switch is painted in, everywhere in this plugin.
 *
 * `<os-switch>` offers four tones and the kit's default is `holo` — the
 * Holomesh, OpenStation's iridescent brand fill. That default is right and this
 * plugin is the case it is not right for, twice over.
 *
 * First, loudness. The kit is explicit that the holographic state is *a moment*,
 * spent on the one control speaking for the brand, and it names the exception:
 * "a dozen switches in one settings list". A field inspector is nothing but
 * switches. Twelve identity moments on one screen is no identity moment at all.
 *
 * Second, hue. The obvious next step, `tone="accent"`, reads
 * `--os-ui-accent` — and OpenStation's accent is `#f252fc`, a magenta. It is a
 * fine accent and it is the wrong colour for a switch, because a switch is not
 * accented, it is *on*, and the colour every operating system has taught people
 * to read as on is green.
 *
 * So: `success`. Slightly a stretch semantically — nothing has succeeded — but a
 * switch's on state is the one place where the colour carries more meaning than
 * the token's name does. Any single call can override it, and `danger` is worth
 * reaching for on a destructive toggle.
 */
const SWITCH_TONE = 'success';

/** How a switch should look, for the cases where the default is wrong. */
export interface ToggleOptions {
	/**
	 * What the on state paints.
	 *
	 * `accent` here rather than the kit's `holo` default — see {@link toggle}.
	 * `danger` is worth reaching for on a destructive toggle.
	 */
	tone?: 'holo' | 'accent' | 'danger' | 'success';
	/** Track height. Everything else in the control derives from it. */
	size?: 'sm' | 'md' | 'lg';
	/** A full-width settings row: label hard left, switch hard right. */
	block?: boolean;
	/** A second line under the label — the sentence explaining what off means. */
	description?: string;
}

/** A dropdown. */
export function select(
	value: string,
	choices: Array< { value: string; label: string } >,
	onChange: ( value: string ) => void,
	opts: ElementOptions = {}
): HTMLElement {
	if ( hasComponent( 'os-select' ) ) {
		const node = el( 'os-select', opts );

		choices.forEach( ( choice ) => {
			node.append( el( 'os-option', { text: choice.label, attrs: { value: choice.value } } ) );
		} );

		( node as unknown as { value: string } ).value = value;

		// `os-pick`, not `change`. A select that silently discards every choice
		// somebody makes is the quietest possible failure: the menu opens, the
		// option highlights, the control shows the new value, and nothing is
		// saved.
		onChangeOf(
			node,
			[ 'os-pick', 'change' ],
			() => String( ( node as unknown as { value: string } ).value ?? '' ),
			( picked ) => onChange( picked )
		);

		return node;
	}

	const node = el( 'select', opts ) as HTMLSelectElement;

	choices.forEach( ( choice ) => {
		const option = el( 'option', { text: choice.label, attrs: { value: choice.value } } ) as HTMLOptionElement;

		node.append( option );
	} );

	node.value = value;
	node.addEventListener( 'change', () => onChange( node.value ) );

	return node;
}

/**
 * Reads a control's value, whichever branch built it.
 *
 * @param node The control.
 * @return Its value as a string.
 */
export function readValue( node: HTMLElement ): string {
	const value = ( node as unknown as { value?: unknown } ).value;

	return value === undefined || value === null ? '' : String( value );
}

/** Empties an element. */
export function clear( node: HTMLElement ): void {
	while ( node.firstChild ) {
		node.removeChild( node.firstChild );
	}
}

/**
 * Debounces a function.
 *
 * @param fn    What to call.
 * @param delay How long to wait.
 * @return The debounced function, with a `cancel`.
 */
export function debounce< A extends unknown[] >(
	fn: ( ...args: A ) => void,
	delay = 250
): ( ( ...args: A ) => void ) & { cancel: () => void } {
	let timer = 0;

	const wrapped = ( ...args: A ) => {
		window.clearTimeout( timer );
		timer = window.setTimeout( () => fn( ...args ), delay );
	};

	wrapped.cancel = () => window.clearTimeout( timer );

	return wrapped;
}

/**
 * An id nothing else on the page is using.
 *
 * A counter rather than a random string, because these end up in `for` and
 * `aria-describedby` attributes that are compared in tests and read in devtools,
 * and `atcf-7` is findable where `atcf-x8f2q` is not.
 *
 * @param prefix A readable prefix.
 * @return The id.
 */
export function uid( prefix = 'atcf' ): string {
	counter += 1;

	return `${ prefix }-${ counter }`;
}

let counter = 0;
