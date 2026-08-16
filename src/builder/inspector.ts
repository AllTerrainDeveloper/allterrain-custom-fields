/**
 * The inspector — everything about the selected field.
 *
 * Built from the registry, not from a switch statement. A field type declares
 * `settings` as `key => default` in PHP; `atcf_setting_controls()` says how each
 * key is drawn; and this file walks the two together. A plugin that registers a
 * field type with a `min` and a `choices` gets a number box and a choice editor
 * with no code here at all.
 *
 * A setting nothing describes is still offered — as a text box under Advanced —
 * rather than hidden. A setting the store honours and the inspector refuses to
 * show is a setting only somebody reading the source can reach, and this plugin
 * would then have a paid-tier-shaped hole in it for no reason.
 *
 * The three panes are Field, Conditional and Advanced, in that order, because
 * that is the order of how often they are opened.
 */

import { button, clear, el, numberField, select, textArea, textField, toggle, uid } from '../ui';
import { renderFormulaEditor } from './formula-editor';
import { openFormulaLab } from './formula-lab';
import { openFormulaWindow } from './formula-open';
import { normalizeChoices } from '../controls/render';
import type { BuilderConfig, Field, LogicRule } from '../types';

/** What the inspector needs. */
export interface InspectorOptions {
	field: Field | null;
	fields: Field[];
	config: BuilderConfig;
	onChange: ( patch: Partial< Field > ) => void;
	/**
	 * A setting changed.
	 *
	 * `typing` says the change came from a control somebody is **in the middle
	 * of using** — a text box, a number box, the formula editor. The builder
	 * redraws the inspector after a setting change, and redrawing it while
	 * somebody is typing throws away the element they are typing into. Which is
	 * exactly what it was doing.
	 */
	onSettingChange: ( key: string, value: unknown, typing?: boolean ) => void;
}

/**
 * Pushes a field's current values into the controls already on screen.
 *
 * The alternative is `renderInspector()` again, and rebuilding this pane per
 * keystroke closes every section somebody opened and throws the scroll position
 * away. So the canvas calls this instead, and it lives *here* rather than in the
 * builder because knowing how to update a control is the same knowledge as
 * knowing how to build one — split across two files, the two drift, and the
 * symptom is a pane that follows some edits and not others.
 *
 * Which is exactly what happened: the first version only handled strings, so
 * renaming a choice on a card updated the card and left the inspector's own
 * choice editor showing the old options, with nothing to say why.
 *
 * @param host The inspector.
 * @param opts The field and what to do with it.
 */
export function syncInspector( host: HTMLElement, opts: InspectorOptions ): void {
	const field = opts.field;

	if ( ! field ) {
		return;
	}

	host.querySelectorAll< HTMLElement >( '[data-atcfb-bind]' ).forEach( ( node ) => {
		const bind = node.dataset.atcfbBind ?? '';
		const setting = bind.startsWith( 'setting:' ) ? bind.slice( 8 ) : '';

		const value = setting
			? field.settings[ setting ]
			: ( field as unknown as Record< string, unknown > )[ bind ];

		if ( value === undefined || value === null ) {
			return;
		}

		// A control that holds a *structure* — the choice editor, a location
		// builder — cannot take a new value through `.value`. It is rebuilt in
		// place, keeping its id and its bind so the row's label still points at
		// it and the next sync still finds it.
		if ( 'object' === typeof value ) {
			const kind = setting ? opts.config.settingControls[ setting ]?.control : '';
			const fresh = kind ? settingControl( setting, kind, field, opts ) : null;

			if ( ! fresh ) {
				return;
			}

			fresh.id = node.id;
			fresh.dataset.atcfbBind = bind;
			node.replaceWith( fresh );

			return;
		}

		const control = node as HTMLInputElement;

		// Only when it differs, so a control the user is *also* in does not have
		// its caret reset by a value it already holds.
		if ( control.value !== String( value ) ) {
			control.value = String( value );
		}
	} );
}

/**
 * Draws the inspector.
 *
 * @param host What to fill.
 * @param opts The field and what to do with it.
 */
export function renderInspector( host: HTMLElement, opts: InspectorOptions ): void {
	clear( host );

	if ( ! opts.field ) {
		host.append(
			el( 'div', {
				class: 'atcfb__inspector-empty',
				children: [ el( 'p', { text: 'Select a field to change it.' } ) ],
			} )
		);

		return;
	}

	const field = opts.field;
	const type = opts.config.fieldTypes.find( ( one ) => one.type === field.type );
	const supports = type?.supports ?? [];

	host.append(
		el( 'header', {
			class: 'atcfb__inspector-head',
			children: [
				el( 'h2', { class: 'atcfb__inspector-title', text: field.label || field.name } ),
				el( 'p', { class: 'atcfb__inspector-type', text: type?.label ?? field.type } ),
			],
		} )
	);

	const panes = el( 'div', { class: 'atcfb__panes' } );

	panes.append( fieldPane( field, opts, supports ) );

	if ( supports.includes( 'conditional' ) ) {
		panes.append( conditionalPane( field, opts ) );
	}

	panes.append( advancedPane( field, opts, type?.settings ?? {} ) );

	host.append( panes );
}

/** A titled section. */
function pane( title: string, open: boolean, children: Array< Node | null > ): HTMLElement {
	const details = el( 'details', { class: 'atcfb__pane', attrs: { open: open ? true : null } } ) as HTMLDetailsElement;

	details.append( el( 'summary', { class: 'atcfb__pane-title', text: title } ) );
	children.forEach( ( child ) => child && details.append( child ) );

	return details;
}

/** A labelled row. */
function row( label: string, node: HTMLElement, hint = '', bind = '' ): HTMLElement {
	const id = node.id || uid( 'atcf-set' );

	node.id = id;

	// What this control edits, so the canvas can push a value into it without
	// rebuilding the pane. See `syncInspector()` — a rebuild while somebody is
	// typing on a card collapses every open section and throws the scroll
	// position away, which is what editing a label used to do on every keystroke.
	if ( bind ) {
		node.dataset.atcfbBind = bind;
	}

	return el( 'div', {
		class: 'atcfb__row',
		children: [
			el( 'label', { class: 'atcfb__row-label', text: label, attrs: { for: id } } ),
			node,
			hint ? el( 'p', { class: 'atcfb__row-hint', text: hint } ) : null,
		],
	} );
}

/** The Field pane: the settings every type shares, plus its own. */
function fieldPane( field: Field, opts: InspectorOptions, supports: string[] ): HTMLElement {
	const rows: Array< Node | null > = [];

	rows.push(
		row(
			'Label',
			textField( field.label, {}, ( value ) => opts.onChange( { label: value } ) ),
			'What whoever fills this in will read.',
			'label'
		)
	);

	rows.push(
		row(
			'Name',
			textField( field.name, {}, ( value ) => opts.onChange( { name: value } ) ),
			'The meta key. `get_post_meta( $id, \'' + field.name + '\', true )` reads it.',
			'name'
		)
	);

	rows.push(
		row(
			'Instructions',
			textArea( field.instructions, { attrs: { rows: 2 } }, ( value ) => opts.onChange( { instructions: value } ) ),
			'Shown under the field.',
			'instructions'
		)
	);

	if ( supports.includes( 'required' ) ) {
		rows.push( toggle( field.required, 'Required', ( on ) => opts.onChange( { required: on } ), { block: true } ) );
	}

	if ( supports.includes( 'readonly' ) ) {
		rows.push( toggle( field.readonly, 'Read only', ( on ) => opts.onChange( { readonly: on } ), { block: true } ) );
	}

	// The type's own settings, in the order it declared them.
	const controls = opts.config.settingControls;
	const typeSettings = opts.config.fieldTypes.find( ( one ) => one.type === field.type )?.settings ?? {};

	Object.keys( typeSettings ).forEach( ( key ) => {
		if ( ! controls[ key ] ) {
			return;
		}

		const kind = controls[ key ].control;
		const node = settingControl( key, kind, field, opts );

		if ( ! node ) {
			return;
		}

		// A switch labels itself, beside the switch — the same shape as Required
		// and Read only above. Wrapping it in a row would put a second label over
		// the top of it, so half the toggles in the pane read left-to-right and
		// the other half top-to-bottom, which is what this pane used to look like.
		rows.push( 'switch' === kind ? node : row( controls[ key ].label, node, '', `setting:${ key }` ) );
	} );

	return pane( 'Field', true, rows );
}

/**
 * One setting's control.
 *
 * @param key  The setting key.
 * @param kind Which control to draw.
 * @param field The field.
 * @param opts  The inspector options.
 * @return The element, or null when the kind has no drawing.
 */
function settingControl( key: string, kind: string, field: Field, opts: InspectorOptions ): HTMLElement | null {
	const value = field.settings[ key ];

	// The kinds that hold a caret. A redraw during one of these is a keystroke
	// lost and the focus gone; a redraw after any of the others is what keeps
	// dependent controls honest, and costs nothing because nobody is typing.
	const typing = [ 'text', 'textarea', 'number', 'formula' ].includes( kind );
	const change = ( next: unknown ) => opts.onSettingChange( key, next, typing );

	switch ( kind ) {
		case 'text':
			return textField( String( value ?? '' ), {}, change );

		case 'textarea':
			return textArea( String( value ?? '' ), { attrs: { rows: 3 } }, change );

		case 'number':
			return numberField( String( value ?? '' ), {}, ( next ) => change( next === '' ? '' : Number( next ) ) );

		case 'switch':
			return toggle( Boolean( value ), settingLabel( key, opts ), ( on ) => change( on ), { block: true } );

		case 'select':
			return select( String( value ?? '' ), selectChoicesFor( key, field, opts.config ), change );

		case 'choices':
			return choiceEditor( value, change );

		case 'post-types':
			return multiSelect( opts.config.postTypes, toStringList( value ), change );

		case 'taxonomies':
			return multiSelect( opts.config.taxonomies, toStringList( value ), change );

		case 'taxonomy':
			return select(
				String( value ?? '' ),
				Object.entries( opts.config.taxonomies ).map( ( [ slug, label ] ) => ( { value: slug, label } ) ),
				change
			);

		case 'roles':
			return multiSelect( opts.config.roles, toStringList( value ), change );

		case 'field-ref':
			return fieldPicker( value, opts, change );

		case 'formula':
			return formulaEditor( String( value ?? '' ), opts, change );

		case 'columns':
			return choiceEditor( value, change );

		default:
			return textField( String( value ?? '' ), {}, change );
	}
}

/**
 * What a setting is called.
 *
 * Read from the same registry the row labels come from, so a switch beside its
 * label and a text field under its label are never named differently.
 *
 * @param key  The setting key.
 * @param opts The inspector options.
 * @return The label, or the key when nothing has named it.
 */
function settingLabel( key: string, opts: InspectorOptions ): string {
	return opts.config.settingControls[ key ]?.label ?? key;
}

/** The options a named `select` setting offers. */
function selectChoicesFor( key: string, field: Field, config: BuilderConfig ): Array< { value: string; label: string } > {
	const named: Record< string, Record< string, string > > = {
		preview_size: config.imageSizes,
		return_format: returnFormatsFor( field.type ),
		layout: { block: 'Block', table: 'Table', row: 'Row', vertical: 'Vertical', horizontal: 'Horizontal' },
		toolbar: { full: 'Full', basic: 'Basic', none: 'No toolbar' },
		new_lines: { wpautop: 'Paragraphs', br: 'Line breaks', '': 'Leave alone' },
		library: { all: 'Everything', uploadedTo: 'Uploaded to this post' },
		display: { seamless: 'Seamless', group: 'As a group' },
	};

	const source = named[ key ] ?? {};

	return Object.entries( source ).map( ( [ value, label ] ) => ( { value, label } ) );
}

/** What each type can return to a template. */
function returnFormatsFor( type: string ): Record< string, string > {
	if ( [ 'image', 'file' ].includes( type ) ) {
		return { array: 'Everything about it', url: 'Just the URL', id: 'Just the ID' };
	}

	if ( type === 'gallery' ) {
		return { array: 'Everything about each one', url: 'URLs', id: 'IDs' };
	}

	if ( [ 'post_object', 'relationship' ].includes( type ) ) {
		return { object: 'The post objects', id: 'Just the IDs' };
	}

	if ( type === 'taxonomy' ) {
		return { object: 'The term objects', id: 'Just the IDs' };
	}

	if ( type === 'user' ) {
		return { array: 'Everything about them', id: 'Just the IDs' };
	}

	if ( type === 'link' ) {
		return { array: 'URL, text and target', url: 'Just the URL' };
	}

	if ( type === 'color_picker' ) {
		return { string: 'The hex string', array: 'Red, green, blue, alpha' };
	}

	return { value: 'The value', label: 'The label', both: 'Both' };
}

/** Coerces a stored list setting into strings. */
function toStringList( value: unknown ): string[] {
	if ( Array.isArray( value ) ) {
		return value.map( String );
	}

	return value === '' || value === undefined || value === null ? [] : [ String( value ) ];
}

/**
 * A multi-select drawn as checkboxes.
 *
 * A `<select multiple>` is the platform's answer and is genuinely bad at this:
 * it needs ctrl-click to add without replacing, it shows four rows of a
 * twenty-item list, and on a touch screen it is close to unusable. Checkboxes
 * are longer and are the control people can actually operate.
 *
 * @param choices  Slug => label.
 * @param selected What is ticked.
 * @param onChange What to do about it.
 * @return The element.
 */
function multiSelect(
	choices: Record< string, string >,
	selected: string[],
	onChange: ( value: string[] ) => void
): HTMLElement {
	const chosen = new Set( selected );
	const box = el( 'div', { class: 'atcfb__multiselect', attrs: { role: 'group' } } );

	Object.entries( choices ).forEach( ( [ slug, label ] ) => {
		const input = el( 'input', { attrs: { type: 'checkbox', value: slug } } ) as HTMLInputElement;

		input.checked = chosen.has( slug );
		input.addEventListener( 'change', () => {
			if ( input.checked ) {
				chosen.add( slug );
			} else {
				chosen.delete( slug );
			}

			onChange( Array.from( chosen ) );
		} );

		box.append( el( 'label', { class: 'atcfb__multiselect-item', children: [ input, el( 'span', { text: label } ) ] } ) );
	} );

	return box;
}

/**
 * The choice editor.
 *
 * One row per choice, with a value and a label. Not a textarea of
 * `value : Label` lines, which is what every plugin in this category ships and
 * which asks people to learn a syntax to type two words.
 *
 * @param value    The stored choices.
 * @param onChange What to do about them.
 * @return The element.
 */
function choiceEditor( value: unknown, onChange: ( value: Array< { value: string; label: string } > ) => void ): HTMLElement {
	let choices = normalizeChoices( value );

	const box = el( 'div', { class: 'atcfb__choices' } );

	const draw = () => {
		clear( box );

		choices.forEach( ( choice, index ) => {
			const valueInput = el( 'input', {
				class: 'atcfb__choice-value',
				attrs: { type: 'text', value: choice.value, 'aria-label': 'Value', placeholder: 'value' },
			} ) as HTMLInputElement;

			const labelInput = el( 'input', {
				class: 'atcfb__choice-label',
				attrs: { type: 'text', value: choice.label, 'aria-label': 'Label', placeholder: 'Label' },
			} ) as HTMLInputElement;

			valueInput.addEventListener( 'change', () => {
				choices[ index ].value = valueInput.value;
				onChange( [ ...choices ] );
			} );

			labelInput.addEventListener( 'change', () => {
				choices[ index ].label = labelInput.value;
				onChange( [ ...choices ] );
			} );

			box.append(
				el( 'div', {
					class: 'atcfb__choice',
					children: [
						valueInput,
						labelInput,
						el( 'button', {
							class: 'atcfb__choice-remove',
							text: '×',
							attrs: { type: 'button', 'aria-label': `Remove ${ choice.label }` },
							on: {
								click: () => {
									choices.splice( index, 1 );
									onChange( [ ...choices ] );
									draw();
								},
							},
						} ),
					],
				} )
			);
		} );

		box.append(
			button( 'Add a choice', {
				class: 'atcfb__choices-add',
				on: {
					click: () => {
						choices.push( { value: '', label: '' } );
						draw();
					},
				},
			} )
		);
	};

	draw();

	return box;
}

/** A picker naming another field on the site, for mirrors and clones. */
function fieldPicker( value: unknown, opts: InspectorOptions, onChange: ( value: string ) => void ): HTMLElement {
	const current = Array.isArray( value ) ? String( value[ 0 ] ?? '' ) : String( value ?? '' );
	const choices = [ { value: '', label: '— none —' } ].concat(
		opts.fields
			.filter( ( one ) => one.key !== opts.field?.key )
			.map( ( one ) => ( { value: one.key, label: `${ one.label || one.name } (${ one.type })` } ) )
	);

	return select( current, choices, onChange );
}

/**
 * The formula editor.
 *
 * The whole thing lives in `formula-editor.ts` — it is a tokenising
 * `contenteditable` with a caret to preserve, which is more than belongs in a
 * file about drawing settings rows.
 *
 * The field list is filtered to what a formula can actually do arithmetic with.
 * Offering `{featured_image}` as something to multiply is not generosity, it is
 * a list somebody has to read past every time.
 *
 * @param value    The formula.
 * @param opts     The inspector options.
 * @param onChange What to do about it.
 * @return The element.
 */
function formulaEditor( value: string, opts: InspectorOptions, onChange: ( value: string ) => void ): HTMLElement {
	const usable = [ 'number', 'range', 'computed', 'true_false' ];

	const fields = opts.fields
		.filter( ( one ) => one.key !== opts.field?.key && usable.includes( one.type ) )
		.map( ( one ) => ( { name: one.name, label: one.label || one.name } ) );

	// The repeater and group columns, which are the answer to "what can sum
	// sum?" and were not offered anywhere. A column is written `{lines.amount}`
	// and stands for that field in every row.
	opts.fields.forEach( ( parent ) => {
		const subs = ( parent.settings?.sub_fields ?? [] ) as Field[];

		if ( ! Array.isArray( subs ) ) {
			return;
		}

		subs.forEach( ( sub ) => {
			if ( ! usable.includes( sub.type ) ) {
				return;
			}

			fields.push( {
				name: `${ parent.name }.${ sub.name }`,
				label: `${ sub.label || sub.name } · every row`,
			} );
		} );
	} );

	const node = renderFormulaEditor( {
		value,
		fields,
		functions: opts.config.calcFunctions,
		onChange,
		onExpand: ( current ) => {
			const put = ( next: string ) =>
				( node as unknown as { setFormula?: ( value: string ) => void } ).setFormula?.( next );

			// A window when the shell can give us one, a dialog when it cannot.
			// The window is the better answer for a reason a modal cannot match:
			// the builder stays open beside it, so you can look at the field you
			// are writing the formula *for* while you write it.
			if ( ! openFormulaWindow( {
				label: opts.field?.label || opts.field?.name || 'Formula',
				formula: current,
				fields,
				functions: opts.config.calcFunctions,
				onResult: put,
			} ) ) {
				openFormulaLab( {
					value: current,
					fields,
					functions: opts.config.calcFunctions,
					onSave: put,
				} );
			}
		},
	} );

	return node;
}

/** The Conditional pane. */
function conditionalPane( field: Field, opts: InspectorOptions ): HTMLElement {
	const conditional = field.conditional;
	const rows: Array< Node | null > = [];

	rows.push(
		toggle( conditional.enabled, 'Only show this sometimes', ( on ) =>
			opts.onChange( { conditional: { ...conditional, enabled: on } } )
		)
	);

	if ( conditional.enabled ) {
		rows.push(
			row(
				'Then',
				select(
					conditional.action,
					[
						{ value: 'show', label: 'Show this field' },
						{ value: 'hide', label: 'Hide this field' },
					],
					( value ) => opts.onChange( { conditional: { ...conditional, action: value as 'show' | 'hide' } } )
				)
			)
		);

		rows.push(
			row(
				'When',
				select(
					conditional.match,
					[
						{ value: 'all', label: 'All of these are true' },
						{ value: 'any', label: 'Any of these are true' },
					],
					( value ) => opts.onChange( { conditional: { ...conditional, match: value as 'all' | 'any' } } )
				)
			)
		);

		const list = el( 'div', { class: 'atcfb__rules' } );

		conditional.rules.forEach( ( rule, index ) => {
			list.append( ruleRow( rule, index, field, opts ) );
		} );

		list.append(
			button( 'Add a condition', {
				class: 'atcfb__rules-add',
				on: {
					click: () => {
						const first = opts.fields.find( ( one ) => one.key !== field.key );

						opts.onChange( {
							conditional: {
								...conditional,
								enabled: true,
								rules: [ ...conditional.rules, { field: first?.key ?? '', operator: 'is', value: '' } ],
							},
						} );
					},
				},
			} )
		);

		rows.push( list );
	}

	return pane( 'Conditional', conditional.enabled, rows );
}

/** One condition row. */
function ruleRow( rule: LogicRule, index: number, field: Field, opts: InspectorOptions ): HTMLElement {
	const update = ( patch: Partial< LogicRule > ) => {
		const rules = opts.field ? [ ...opts.field.conditional.rules ] : [];

		rules[ index ] = { ...rules[ index ], ...patch };

		opts.onChange( { conditional: { ...field.conditional, rules } } );
	};

	const fieldChoices = opts.fields
		.filter( ( one ) => one.key !== field.key )
		.map( ( one ) => ( { value: one.key, label: one.label || one.name } ) );

	const operatorChoices = Object.entries( opts.config.operators ).map( ( [ value, label ] ) => ( { value, label } ) );
	const needsValue = ! [ 'empty', 'not_empty' ].includes( rule.operator );

	return el( 'div', {
		class: 'atcfb__rule',
		children: [
			select( rule.field, fieldChoices, ( value ) => update( { field: value } ) ),
			select( rule.operator, operatorChoices, ( value ) => update( { operator: value as LogicRule[ 'operator' ] } ) ),
			needsValue
				? textField( Array.isArray( rule.value ) ? rule.value.join( ', ' ) : String( rule.value ), {}, ( value ) =>
						update( { value } )
				  )
				: null,
			el( 'button', {
				class: 'atcfb__rule-remove',
				text: '×',
				attrs: { type: 'button', 'aria-label': 'Remove this condition' },
				on: {
					click: () => {
						const rules = field.conditional.rules.filter( ( _one, position ) => position !== index );

						opts.onChange( { conditional: { ...field.conditional, rules } } );
					},
				},
			} ),
		],
	} );
}

/** The Advanced pane: width, classes, and any setting nothing else described. */
function advancedPane( field: Field, opts: InspectorOptions, typeSettings: Record< string, unknown > ): HTMLElement {
	const rows: Array< Node | null > = [];

	rows.push(
		row(
			'Width',
			numberField( field.wrapper.width, { attrs: { min: 10, max: 100, step: 5 } }, ( value ) =>
				opts.onChange( { wrapper: { ...field.wrapper, width: Number( value ) || 100 } } )
			),
			'Per cent of the column. Two fields at 50 sit side by side.'
		)
	);

	rows.push(
		row(
			'CSS class',
			textField( field.wrapper.class, {}, ( value ) => opts.onChange( { wrapper: { ...field.wrapper, class: value } } ) )
		)
	);

	rows.push(
		row(
			'Wrapper ID',
			textField( field.wrapper.id, {}, ( value ) => opts.onChange( { wrapper: { ...field.wrapper, id: value } } ) )
		)
	);

	// Settings the type declared that no control descriptor covers. Offered as
	// raw text rather than hidden: a setting the store honours and the inspector
	// refuses to show is one only somebody reading the source can reach.
	Object.keys( typeSettings ).forEach( ( key ) => {
		if ( opts.config.settingControls[ key ] ) {
			return;
		}

		const raw = field.settings[ key ];
		const asText = typeof raw === 'object' ? JSON.stringify( raw ) : String( raw ?? '' );

		rows.push(
			row(
				key,
				textField( asText, {}, ( value ) => {
					try {
						opts.onSettingChange( key, value.startsWith( '{' ) || value.startsWith( '[' ) ? JSON.parse( value ) : value );
					} catch {
						opts.onSettingChange( key, value );
					}
				} ),
				'This field type declared it and nothing describes how to draw it.'
			)
		);
	} );

	rows.push( el( 'p', { class: 'atcfb__key', text: `Key: ${ field.key }` } ) );

	return pane( 'Advanced', false, rows );
}
