/**
 * The formula editor.
 *
 * A box you type a formula into, where every name the engine can resolve draws
 * itself as a chip the moment it is complete, and every name it cannot draws
 * itself as a chip that is visibly wrong.
 *
 * ## Why chips at all
 *
 * The old box was a textarea and a row of buttons that pasted `{name}` into it.
 * The buttons were the only documentation the formula language had, which was
 * the right instinct, but everything after the click was unassisted: nothing on
 * screen distinguished `{floor_area}` from `{floor_aera}`, and the first sign of
 * the typo was an empty column on a post list weeks later. A formula is a small
 * program written in a box a centimetre tall; the least an editor can do is say
 * which of the words in it mean something.
 *
 * ## Typed, not just inserted
 *
 * Auto-conversion matters more than the palette does. Somebody who has used the
 * palette twice starts typing `{pri` and expects it to work — and it does, and
 * the chip appears as they close the brace. Nothing is rewritten, autocompleted
 * or refused: the text stays exactly the characters that were typed, and the
 * chips are only a reading of it. That is what makes the box safe to hold a
 * half-finished thought.
 *
 * ## How the caret survives a redraw
 *
 * The DOM is rebuilt on every keystroke, which would normally throw the caret to
 * the start of the box. It is preserved as a **plain-text offset** — how many
 * characters precede it, counting a chip as its full text — measured before the
 * redraw and restored after. An offset survives a rebuild that a `Range` into
 * discarded nodes cannot.
 *
 * The rebuild is skipped when the token shapes have not changed, which is most
 * keystrokes. Typing inside a chip's name is the case that must *not* skip, and
 * it does not, because the name is part of the shape.
 */

import { el } from '../ui';
import { bracketsBalance, tokenizeFormula, unknownNames } from './formula-tokens';
import type { FormulaToken, FormulaVocabulary } from './formula-tokens';

/** What the editor needs to draw itself. */
export interface FormulaEditorOptions {
	/** The formula as stored. */
	value: string;
	/** Field names the formula may reach, with something readable to call them. */
	fields: Array< { name: string; label: string } >;
	/** Function names the calculator implements. */
	functions: string[];
	/** Called when the formula changes. */
	onChange: ( value: string ) => void;
	/**
	 * Opens the full editor, when there is one to open.
	 *
	 * Passed in rather than imported, so the inline box does not drag the lab —
	 * its reference text, its sample inputs and the calculator — into every
	 * bundle that renders a settings row.
	 */
	onExpand?: ( current: string ) => void;
}

/**
 * Builds the editor.
 *
 * @param opts What to draw and what to do about changes.
 * @return The element.
 */
export function renderFormulaEditor( opts: FormulaEditorOptions ): HTMLElement {
	const vocabulary: FormulaVocabulary = {
		fields: opts.fields.map( ( one ) => one.name ),
		functions: opts.functions,
	};

	const box = el( 'div', {
		class: 'atcfb__formula',
		attrs: {
			contenteditable: 'true',
			role: 'textbox',
			'aria-multiline': 'true',
			'aria-label': 'Formula',
			spellcheck: 'false',
			'data-placeholder': '{price} * {quantity}',
		},
	} );

	const problems = el( 'p', { class: 'atcfb__formula-problem' } );

	/**
	 * What the chip under the pointer means.
	 *
	 * A `title` attribute was doing this job and doing it badly: it waits a
	 * second, it is invisible on a touch screen, and it cannot be read by
	 * somebody tabbing through the palette. The same sentence in the panel
	 * appears at once, on hover *and* on focus, and stays put long enough to
	 * read.
	 */
	const hint = el( 'p', { class: 'atcfb__formula-hint' } );

	/** Shows a line while a chip is pointed at or focused, and clears it after. */
	const explains = ( node: HTMLElement, text: string ) => {
		const show = () => {
			hint.textContent = text;
		};
		const clear = () => {
			hint.textContent = '';
		};

		node.addEventListener( 'pointerenter', show );
		node.addEventListener( 'focus', show );
		node.addEventListener( 'pointerleave', clear );
		node.addEventListener( 'blur', clear );
	};

	let source = opts.value;
	let shape = '';

	/**
	 * Redraws the chips, keeping the caret where the characters put it.
	 *
	 * The rebuild is the expensive, disruptive act — it throws away the node the
	 * caret is in — so the whole design is about doing it as rarely as possible.
	 *
	 * The signature compared here counts **only the names**: which fields and
	 * functions appear, in what order, and whether the engine knows them. Typing
	 * `2`, a space or a `*` cannot change that, so ordinary typing never rebuilds
	 * and the browser's own caret is left alone. It rebuilds when a `{name}`
	 * closes, when a name gains or loses its bracket, or when a chip is deleted —
	 * a handful of moments in writing a formula rather than one per keystroke.
	 *
	 * This replaced a signature over *every* token, which changed on nearly every
	 * keystroke because formulas are dense in numbers and operators. The symptom
	 * was the box losing focus as you typed.
	 *
	 * @param force Rebuild even when the names are unchanged.
	 */
	const paint = ( force = false ) => {
		const tokens = tokenizeFormula( source, vocabulary );
		const next = tokens
			.filter( ( token ) => 'field' === token.kind || 'function' === token.kind )
			.map( ( token ) => `${ token.kind }:${ token.name }:${ token.known }` )
			.join( '|' );

		if ( ! force && next === shape ) {
			say( tokens );

			return;
		}

		shape = next;

		const focused = box.ownerDocument.activeElement === box;
		const caret = caretOffset( box );

		box.replaceChildren( ...tokens.map( paintToken ) );

		// Focus first, then the range. Removing the node the caret sits in can
		// blur the box, and a Range set on an unfocused element is a caret
		// nobody can type at — which looked, from the outside, exactly like
		// every keystroke stealing the focus away.
		if ( focused ) {
			box.focus( { preventScroll: true } );
		}

		if ( caret !== null ) {
			setCaret( box, caret );
		}

		say( tokens );
	};

	/** Says in words what the red chips only say in colour. */
	const say = ( tokens: FormulaToken[] ) => {
		const unknown = unknownNames( tokens );
		const notes: string[] = [];

		if ( unknown.length ) {
			notes.push(
				`Nothing here is called ${ unknown.map( ( one ) => `“${ one }”` ).join( ', ' ) }.`
			);
		}

		if ( source.trim() && ! bracketsBalance( source ) ) {
			notes.push( 'The brackets do not close.' );
		}

		problems.textContent = notes.join( ' ' );
		problems.classList.toggle( 'is-shown', notes.length > 0 );
	};

	// `beforeinput` rather than `keydown`: it fires for pastes, drops,
	// autocorrect and dictation as well as for typing, which is every route by
	// which characters get into a `contenteditable`. Reading the text back in
	// `input` afterwards means it does not matter which route was taken.
	box.addEventListener( 'input', () => {
		source = readText( box );
		paint();
		opts.onChange( source );
	} );

	// Enter would insert a `<div>` or a `<br>` and a formula has no lines.
	box.addEventListener( 'keydown', ( event ) => {
		if ( 'Enter' === ( event as KeyboardEvent ).key ) {
			event.preventDefault();
		}
	} );

	// Plain text only. A paste from a spreadsheet otherwise arrives as a table.
	box.addEventListener( 'paste', ( event ) => {
		const clipboard = ( event as ClipboardEvent ).clipboardData;

		if ( ! clipboard ) {
			return;
		}

		event.preventDefault();
		insertAtCaret( box, clipboard.getData( 'text/plain' ).replace( /\s+/g, ' ' ) );
		source = readText( box );
		lastCaret = caretOffset( box );
		paint( true );
		opts.onChange( source );
	} );

	/**
	 * Where the caret was the last time somebody actually put it somewhere.
	 *
	 * Null until they have. That distinction is the whole reason this variable
	 * exists: focusing a `contenteditable` that has never been focused places the
	 * caret at position **zero**, so a palette chip pressed against a box with a
	 * formula already in it would insert at the *start* — turning `2 * ` into
	 * `{price}2 * `. Remembering the real caret, and falling back to the end
	 * rather than to the beginning, is what makes the palette behave the way
	 * everybody expects a palette to behave.
	 */
	let lastCaret: number | null = null;

	const remember = () => {
		const at = caretOffset( box );

		if ( at !== null ) {
			lastCaret = at;
		}
	};

	[ 'keyup', 'mouseup', 'input', 'select' ].forEach( ( name ) => box.addEventListener( name, remember ) );

	/** Puts a token in at the caret, the way the palette does. */
	const insert = ( text: string, caretBack = 0 ) => {
		const at = lastCaret ?? readText( box ).length;
		const before = readText( box );

		source = before.slice( 0, at ) + text + before.slice( at );
		lastCaret = at + text.length - caretBack;

		box.textContent = source;
		paint( true );
		box.focus();
		setCaret( box, lastCaret );
		opts.onChange( source );
	};

	const palette = el( 'div', { class: 'atcfb__formula-palette' } );

	// The way out to the full editor. An addition, not a replacement: most
	// formulas are `{a} * {b}` and belong here beside the rest of the field's
	// settings, and opening a dialog to type six characters is a worse
	// experience rather than a better one. The dialog is for the formula
	// somebody is still working out.
	if ( opts.onExpand ) {
		palette.append(
			el( 'button', {
				class: 'atcfb__formula-expand',
				text: 'Editor…',
				attrs: { type: 'button', title: 'Open the full editor, with sample values and the function reference' },
				on: { click: () => opts.onExpand?.( source ) },
			} )
		);
	}

	if ( opts.fields.length ) {
		palette.append( el( 'span', { class: 'atcfb__formula-legend', text: 'Fields' } ) );

		opts.fields.forEach( ( field ) => {
			const chip = el( 'button', {
				class: 'atcfb__chip atcfb__chip--field',
				text: field.label || field.name,
				attrs: { type: 'button' },
				on: { click: () => insert( `{${ field.name }}` ) },
			} );

			// The meta key, which is what actually goes in the formula and is
			// routinely not what the field is called on screen.
			explains( chip, `{${ field.name }} — the value of “${ field.label || field.name }”` );
			palette.append( chip );
		} );
	}

	palette.append( el( 'span', { class: 'atcfb__formula-legend', text: 'Functions' } ) );

	opts.functions.forEach( ( name ) => {
		const chip = el( 'button', {
			class: 'atcfb__chip atcfb__chip--fn',
			text: `${ name }()`,
			attrs: { type: 'button' },
			// The caret lands **inside** the brackets. A function inserted with
			// the caret after it means every single use is followed by pressing
			// Left, and nobody thanks an editor for that.
			on: { click: () => insert( `${ name }()`, 1 ) },
		} );

		explains( chip, FUNCTION_HELP[ name ] ?? `${ name }()` );
		palette.append( chip );
	} );

	paint( true );

	const wrap = el( 'div', { class: 'atcfb__formula-wrap', children: [ box, problems, palette, hint ] } );

	// How the lab hands its result back. A property on the element rather than a
	// returned object, because every other control in the inspector is just an
	// element and `row()` expects one.
	( wrap as unknown as { setFormula: ( next: string ) => void } ).setFormula = ( next: string ) => {
		source = next;
		lastCaret = null;
		box.textContent = next;
		paint( true );
		opts.onChange( source );
	};

	return wrap;
}

/**
 * A line about each function, for the box that has no room for a manual.
 *
 * Signature *and* sentence, because a signature alone is only documentation to
 * somebody who already knows what the parameters mean. `if(test, then,
 * otherwise)` says nothing about what may go in `test`, which is the whole
 * difficulty of that function — so the line says.
 *
 * The full reference, with each parameter explained and a worked example, is in
 * the Editor dialog. This is what fits under a 220px sidebar.
 */
const FUNCTION_HELP: Record< string, string > = {
	min: 'min(a, b, …) — the smallest of them',
	max: 'max(a, b, …) — the largest of them',
	sum: 'sum(a, b, …) — everything added up',
	avg: 'avg(a, b, …) — the average',
	median: 'median(a, b, …) — the middle one when sorted',
	product: 'product(a, b, …) — everything multiplied together',
	round: 'round(number, places) — rounded. Leave off places for a whole number',
	floor: 'floor(number) — rounded down, always',
	ceil: 'ceil(number) — rounded up, always',
	int: 'int(number) — the decimals dropped',
	abs: 'abs(number) — without the minus sign',
	sign: 'sign(number) — 1 up, −1 down, 0 unchanged',
	sqrt: 'sqrt(number) — the square root',
	pow: 'pow(number, power) — number multiplied by itself, power times',
	mod: 'mod(number, divide_by) — the remainder after dividing',
	clamp: 'clamp(number, lowest, highest) — kept inside a range',
	pct: 'pct(part, whole) — what percentage part is of whole',
	if: 'if(test, then, otherwise) — test with > < == != && ||, then one answer or the other',
};

/**
 * Draws one token.
 *
 * Chips are `contenteditable="false"` so the caret steps over them whole. A chip
 * whose name could be half-deleted by a stray Backspace is a chip that turns
 * into red text under the pointer, which is the opposite of reassuring — and the
 * name is still editable, by deleting the chip and typing again.
 *
 * @param token The token.
 * @return The node.
 */
function paintToken( token: FormulaToken ): Node {
	if ( 'field' === token.kind || 'function' === token.kind ) {
		return el( 'span', {
			class: `atcfb__token atcfb__token--${ token.kind }${ token.known ? '' : ' is-unknown' }`,
			text: token.text,
			attrs: {
				contenteditable: 'false',
				title: token.known
					? undefined
					: `Nothing on this site is called “${ token.name }”.`,
			},
		} );
	}

	// Numbers and operators stay as plain text. Wrapping them in spans to colour
	// them was a real temptation and a real mistake: it made the DOM change shape
	// on every keystroke, which meant a rebuild on every keystroke, which meant
	// the caret being torn out and put back sixty times a minute. Syntax colour
	// on a `2` is not worth a box that fights the person typing in it.
	return document.createTextNode( token.text );
}

/**
 * The formula as characters, whatever nodes it is currently made of.
 *
 * `textContent` and not `innerText`: `innerText` is layout-aware and collapses
 * runs of spaces, so `{a}  +  {b}` would silently lose the spacing the author
 * typed and the box would fight anybody who likes their formulas spaced out.
 *
 * @param box The editor.
 * @return The formula.
 */
function readText( box: HTMLElement ): string {
	return ( box.textContent ?? '' ).replace( / /g, ' ' );
}

/**
 * How many characters precede the caret.
 *
 * The unit that survives a rebuild. A `Range` points at nodes, and every node in
 * this box is discarded and replaced on redraw; an offset is just a number.
 *
 * @param box The editor.
 * @return The offset, or null when the caret is not in this box.
 */
function caretOffset( box: HTMLElement ): number | null {
	const selection = box.ownerDocument.getSelection();

	if ( ! selection || ! selection.rangeCount ) {
		return null;
	}

	const range = selection.getRangeAt( 0 );

	if ( ! box.contains( range.startContainer ) ) {
		return null;
	}

	const measure = range.cloneRange();

	measure.selectNodeContents( box );
	measure.setEnd( range.startContainer, range.startOffset );

	return measure.toString().length;
}

/**
 * Puts the caret that many characters in.
 *
 * @param box    The editor.
 * @param offset How many characters should precede it.
 */
function setCaret( box: HTMLElement, offset: number ): void {
	const selection = box.ownerDocument.getSelection();

	if ( ! selection ) {
		return;
	}

	let remaining = offset;
	const range = box.ownerDocument.createRange();

	// A chip is a single stop, not a run of positions: its text node lives
	// inside a `contenteditable="false"` span, and placing the caret in there
	// gives a caret the user can see and cannot type at. So a chip is consumed
	// whole and the caret lands after it.
	for ( const child of Array.from( box.childNodes ) ) {
		const length = ( child.textContent ?? '' ).length;

		if ( remaining > length ) {
			remaining -= length;

			continue;
		}

		if ( child.nodeType === Node.TEXT_NODE ) {
			range.setStart( child, remaining );
			range.collapse( true );
			selection.removeAllRanges();
			selection.addRange( range );

			return;
		}

		// Landing inside a chip: before it when the offset is at its very start,
		// after it otherwise.
		if ( 0 === remaining ) {
			range.setStartBefore( child );
		} else {
			range.setStartAfter( child );
		}

		range.collapse( true );
		selection.removeAllRanges();
		selection.addRange( range );

		return;
	}

	range.selectNodeContents( box );
	range.collapse( false );
	selection.removeAllRanges();
	selection.addRange( range );
}

/**
 * Types text in at the caret, or at the end when there is no caret.
 *
 * @param box       The editor.
 * @param text      What to insert.
 * @param caretBack How many characters to step back afterwards, so a function
 *                  can leave the caret inside its own brackets.
 */
function insertAtCaret( box: HTMLElement, text: string, caretBack = 0 ): void {
	const at = caretOffset( box ) ?? readText( box ).length;
	const before = readText( box );
	const next = before.slice( 0, at ) + text + before.slice( at );

	box.textContent = next;
	setCaret( box, at + text.length - caretBack );
}
