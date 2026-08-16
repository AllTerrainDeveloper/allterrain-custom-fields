/**
 * The two panes agreeing.
 *
 * Everything on a card is editable, and everything on a card is *also* in the
 * inspector. So every edit has two places to land, and the pane that is not
 * under the caret has to follow the one that is.
 *
 * Getting this wrong is quiet in both directions:
 *
 * - Rebuild the inspector per keystroke and it collapses every open section and
 *   jumps to the top on every character.
 * - Do not update it at all and it shows stale values with nothing to say so —
 *   which is what renaming a choice on a card used to do, because the first
 *   version of the sync handled strings and silently skipped anything that was
 *   an object.
 *
 * These tests run the real `renderInspector()` and the real `syncInspector()`
 * over a real field, because the bug lived in exactly the gap between them.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInspector, syncInspector } from '../../src/builder/inspector';
import type { InspectorOptions } from '../../src/builder/inspector';
import type { BuilderConfig, Field } from '../../src/types';

/** Enough config for the panes the tests touch. */
function config(): BuilderConfig {
	return {
		fieldTypes: [
			{
				type: 'button_group',
				label: 'Button group',
				group: 'choice',
				icon: '',
				settings: { choices: [], default_value: '' },
				supports: [ 'required', 'instructions', 'conditional', 'wrapper' ],
			},
			{
				type: 'text',
				label: 'Text',
				group: 'basic',
				icon: '',
				settings: { placeholder: '' },
				supports: [ 'required', 'instructions', 'conditional', 'wrapper' ],
			},
		],
		fieldGroups: { basic: 'Basic', choice: 'Choice' },
		settingControls: {
			choices: { control: 'choices', label: 'Choices' },
			placeholder: { control: 'text', label: 'Placeholder' },
			default_value: { control: 'text', label: 'Default' },
		},
		operators: {},
		locationParams: [],
		locationChoices: {},
		postTypes: {},
		taxonomies: {},
		roles: {},
		imageSizes: {},
		optionsPages: [],
		calcFunctions: [],
		templates: [],
		adminUrl: '',
	} as unknown as BuilderConfig;
}

/** A field, with only what the inspector reads. */
function field( over: Partial< Field > = {} ): Field {
	return {
		key: 'field_status',
		name: 'status',
		label: 'Status',
		type: 'button_group',
		required: false,
		readonly: false,
		instructions: '',
		settings: {
			choices: [
				{ value: 'for-sale', label: 'For sale' },
				{ value: 'sold', label: 'Sold' },
			],
			default_value: 'for-sale',
		},
		wrapper: { width: 100, class: '', id: '' },
		conditional: { enabled: false, action: 'show', match: 'all', rules: [] },
		...over,
	} as Field;
}

/** A mounted inspector over a field, plus the options to sync it with. */
function mount( one: Field ) {
	const host = document.createElement( 'div' );

	document.body.append( host );

	const opts: InspectorOptions = {
		field: one,
		fields: [ one ],
		config: config(),
		onChange: vi.fn(),
		onSettingChange: vi.fn(),
	};

	renderInspector( host, opts );

	return { host, opts };
}

beforeEach( () => {
	document.body.replaceChildren();
} );

describe( 'the inspector says what it edits', () => {
	it( 'binds the label, the meta key and the instructions', () => {
		const { host } = mount( field() );
		const binds = Array.from( host.querySelectorAll< HTMLElement >( '[data-atcfb-bind]' ) ).map(
			( node ) => node.dataset.atcfbBind
		);

		expect( binds ).toContain( 'label' );
		expect( binds ).toContain( 'name' );
		expect( binds ).toContain( 'instructions' );
	} );

	it( 'namespaces a setting so it cannot collide with a field property', () => {
		// `settings.name` and `field.name` are different things. A flat key space
		// would have a placeholder overwrite a meta key.
		const { host } = mount( field( { type: 'text', settings: { placeholder: 'e.g. 100' } } ) );
		const binds = Array.from( host.querySelectorAll< HTMLElement >( '[data-atcfb-bind]' ) ).map(
			( node ) => node.dataset.atcfbBind
		);

		expect( binds ).toContain( 'setting:placeholder' );
	} );
} );

describe( 'syncing from the card', () => {
	it( 'follows a label rewritten on the card', () => {
		const one = field();
		const { host, opts } = mount( one );

		one.label = 'Listing status';
		syncInspector( host, opts );

		const control = host.querySelector< HTMLInputElement >( '[data-atcfb-bind="label"]' );

		expect( control?.value ).toBe( 'Listing status' );
	} );

	it( 'follows a renamed choice, which is an object and used to be skipped', () => {
		// The reported bug. `typeof choices === 'object'`, and the first version
		// of the sync returned early on anything that was not a string — so the
		// card showed the new name and the inspector went on showing the old one.
		const one = field();
		const { host, opts } = mount( one );

		one.settings = {
			...one.settings,
			choices: [
				{ value: 'for-sale', label: 'For sale' },
				{ value: 'sold', label: 'Under offer' },
			],
		};

		syncInspector( host, opts );

		const values = Array.from(
			host.querySelectorAll< HTMLInputElement >( '.atcfb__choice-label' )
		).map( ( node ) => node.value );

		expect( values ).toEqual( [ 'For sale', 'Under offer' ] );
	} );

	it( 'follows a choice added on the card', () => {
		const one = field();
		const { host, opts } = mount( one );

		one.settings = {
			...one.settings,
			choices: [
				...( one.settings.choices as Array< { value: string; label: string } > ),
				{ value: 'under-offer', label: 'Under offer' },
			],
		};

		syncInspector( host, opts );

		expect( host.querySelectorAll( '.atcfb__choice-label' ) ).toHaveLength( 3 );
	} );

	it( 'follows a choice removed on the card', () => {
		const one = field();
		const { host, opts } = mount( one );

		one.settings = { ...one.settings, choices: [ { value: 'sold', label: 'Sold' } ] };
		syncInspector( host, opts );

		expect( host.querySelectorAll( '.atcfb__choice-label' ) ).toHaveLength( 1 );
	} );

	it( 'keeps the rebuilt control findable by the next sync', () => {
		// A structural control is replaced, not written into. If the replacement
		// lost its bind the pane would follow exactly one edit and then stop —
		// which is worse than never following, because it looks like it works.
		const one = field();
		const { host, opts } = mount( one );

		one.settings = { ...one.settings, choices: [ { value: 'a', label: 'A' } ] };
		syncInspector( host, opts );

		one.settings = { ...one.settings, choices: [ { value: 'a', label: 'A' }, { value: 'b', label: 'B' } ] };
		syncInspector( host, opts );

		expect( host.querySelectorAll( '.atcfb__choice-label' ) ).toHaveLength( 2 );
	} );

	it( 'keeps the row label pointing at the control it names', () => {
		// The replacement inherits the id, so the `<label for>` above it still
		// works — an accessible name that silently detaches is the kind of
		// regression nothing visual would show.
		const one = field();
		const { host, opts } = mount( one );

		const before = host.querySelector< HTMLElement >( '[data-atcfb-bind="setting:choices"]' )?.id;

		one.settings = { ...one.settings, choices: [ { value: 'a', label: 'A' } ] };
		syncInspector( host, opts );

		const after = host.querySelector< HTMLElement >( '[data-atcfb-bind="setting:choices"]' )?.id;

		expect( after ).toBe( before );
		expect( after ).toBeTruthy();
	} );

	it( 'leaves a control alone when its value has not moved', () => {
		// A control the user is *also* typing in must not have its caret reset by
		// a value it already holds.
		const one = field();
		const { host, opts } = mount( one );

		const control = host.querySelector< HTMLInputElement >( '[data-atcfb-bind="label"]' ) as HTMLInputElement;
		const written = vi.fn();

		Object.defineProperty( control, 'value', {
			get: () => 'Status',
			set: written,
			configurable: true,
		} );

		syncInspector( host, opts );

		expect( written ).not.toHaveBeenCalled();
	} );

	it( 'does nothing at all when no field is selected', () => {
		const { host, opts } = mount( field() );

		expect( () => syncInspector( host, { ...opts, field: null } ) ).not.toThrow();
	} );
} );
