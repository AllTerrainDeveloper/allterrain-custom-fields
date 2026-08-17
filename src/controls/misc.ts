/**
 * The remaining controls: colour, icon, location, table, JSON, embed, computed.
 *
 * Two of these deserve a note.
 *
 * **Location** takes an address and coordinates and needs no third-party map
 * key. Every other plugin's map field requires a Google Maps API key, which
 * means a billing account, which means a site that stops working the day
 * somebody's card expires. Geocoding here goes to OpenStreetMap's Nominatim,
 * which needs nothing, and the coordinates can always be typed by hand. A field
 * that stops working when a bill goes unpaid is not a free feature.
 *
 * **Computed** shows its total as you type, using the same evaluator the server
 * runs on save. It never submits that total: the value stored is always the
 * server's own answer, because a number the browser could set is a number
 * anybody with devtools could set — and for a field feeding a price, that is the
 * whole game.
 */

import { button, clear, control, debounce, el, icon, readValue, t } from './helpers';
import { calc } from '../shared/calc';
import { registerMount } from './mount';
import { normalizeChoices } from './render';
import type { MountContext } from './mount';

/* -------------------------------------------------------------------------- */
/* Colour                                                                      */
/* -------------------------------------------------------------------------- */

registerMount( 'color_picker', ( context: MountContext ) => {
	const { host, field, set } = context;
	const settings = field.settings as { palette?: string[] };

	let current = String( context.value ?? '' );

	const swatchRow = el( 'div', { class: 'atcf-color__palette' } );
	const picker = el( 'input', { class: 'atcf-color__input', attrs: { type: 'color' } } ) as HTMLInputElement;
	const text = control( 'os-text-field', 'input', {
		class: 'atcf-color__hex',
		attrs: { type: 'text', placeholder: '#000000', 'aria-label': 'Hex' },
	} );

	const apply = ( value: string ) => {
		current = value;
		( text as HTMLInputElement ).value = value;

		// The native colour input refuses anything but `#rrggbb`, and silently
		// resets itself to black when handed a shorthand or an empty string —
		// which reads as the field discarding the value the moment it renders.
		picker.value = /^#[0-9a-f]{6}$/i.test( value ) ? value : '#000000';

		set( value );
		markSelected();
	};

	const markSelected = () => {
		swatchRow.querySelectorAll< HTMLElement >( '.atcf-color__swatch' ).forEach( ( swatch ) => {
			swatch.setAttribute( 'aria-pressed', swatch.dataset.color === current ? 'true' : 'false' );
		} );
	};

	( settings.palette ?? [ '#1e1e1e', '#f0f0f1', '#3858e9', '#00a32a', '#d63638', '#dba617' ] ).forEach( ( swatch ) => {
		swatchRow.append(
			el( 'button', {
				class: 'atcf-color__swatch',
				attrs: { type: 'button', 'aria-label': swatch, 'aria-pressed': 'false' },
				dataset: { color: swatch },
				style: { backgroundColor: swatch } as Partial< CSSStyleDeclaration >,
				on: { click: () => apply( swatch ) },
			} )
		);
	} );

	picker.addEventListener( 'input', () => apply( picker.value ) );
	text.addEventListener( 'change', () => apply( readValue( text ).trim() ) );

	// A colour dragged from anywhere in the shell — a theme editor's swatch, a
	// picked pixel — arrives as a text payload that happens to be a hex triple.
	host.addEventListener( 'atcf:text-dropped', ( ( event: CustomEvent< { text: string } > ) => {
		const value = event.detail.text.trim();

		if ( /^#?[0-9a-f]{3,8}$/i.test( value ) ) {
			apply( value.startsWith( '#' ) ? value : `#${ value }` );
		}
	} ) as EventListener );

	host.append( el( 'div', { class: 'atcf-color', children: [ picker, text, swatchRow ] } ) );
	apply( current );
} );

/* -------------------------------------------------------------------------- */
/* Icon                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A short, curated list rather than all three hundred Dashicons.
 *
 * The full set is a wall nobody scrolls, and the ones people actually reach for
 * in a content model are these. The text box takes any Dashicons class, so the
 * list is a shortcut and not a limit.
 */
const ICONS = [
	'dashicons-admin-post',
	'dashicons-admin-page',
	'dashicons-admin-users',
	'dashicons-admin-home',
	'dashicons-cart',
	'dashicons-star-filled',
	'dashicons-heart',
	'dashicons-flag',
	'dashicons-location',
	'dashicons-calendar-alt',
	'dashicons-clock',
	'dashicons-email',
	'dashicons-phone',
	'dashicons-format-image',
	'dashicons-format-video',
	'dashicons-format-quote',
	'dashicons-tag',
	'dashicons-category',
	'dashicons-book',
	'dashicons-lightbulb',
	'dashicons-chart-bar',
	'dashicons-shield',
	'dashicons-awards',
	'dashicons-groups',
];

registerMount( 'icon', ( context: MountContext ) => {
	const { host, set } = context;

	let current = String( context.value ?? '' );

	const preview = el( 'span', { class: 'atcf-icon__preview' } );
	const grid = el( 'div', { class: 'atcf-icon__grid', attrs: { role: 'radiogroup' } } );
	const text = control( 'os-text-field', 'input', {
		class: 'atcf-icon__slug',
		attrs: { type: 'text', placeholder: 'dashicons-…', 'aria-label': 'Dashicons class' },
	} );

	const apply = ( value: string ) => {
		current = value;
		( text as HTMLInputElement ).value = value;

		clear( preview );

		if ( value ) {
			preview.append( icon( value ) );
		}

		grid.querySelectorAll< HTMLElement >( '.atcf-icon__choice' ).forEach( ( choice ) => {
			choice.setAttribute( 'aria-checked', choice.dataset.icon === value ? 'true' : 'false' );
		} );

		set( value );
	};

	grid.append(
		el( 'button', {
			class: 'atcf-icon__choice',
			attrs: { type: 'button', role: 'radio', 'aria-checked': 'false', 'aria-label': t( 'noIcon', 'No icon' ) },
			dataset: { icon: '' },
			text: '—',
			on: { click: () => apply( '' ) },
		} )
	);

	ICONS.forEach( ( slug ) => {
		grid.append(
			el( 'button', {
				class: 'atcf-icon__choice',
				attrs: { type: 'button', role: 'radio', 'aria-checked': 'false', 'aria-label': slug },
				dataset: { icon: slug },
				children: [ icon( slug ) ],
				on: { click: () => apply( slug ) },
			} )
		);
	} );

	text.addEventListener( 'change', () => apply( readValue( text ).trim() ) );

	host.append( el( 'div', { class: 'atcf-icon', children: [ preview, text, grid ] } ) );
	apply( current );
} );

/* -------------------------------------------------------------------------- */
/* Location                                                                    */
/* -------------------------------------------------------------------------- */

interface LocationValue {
	lat: number;
	lng: number;
	address: string;
	zoom: number;
}

registerMount( 'location', ( context: MountContext ) => {
	const { host, set } = context;
	const stored = ( context.value ?? {} ) as Partial< LocationValue >;

	const value: LocationValue = {
		lat: Number( stored.lat ?? 0 ),
		lng: Number( stored.lng ?? 0 ),
		address: String( stored.address ?? '' ),
		zoom: Number( stored.zoom ?? 12 ),
	};

	const address = control( 'os-text-field', 'input', {
		class: 'atcf-location__address',
		attrs: { type: 'text', placeholder: t( 'address', 'Address' ), 'aria-label': t( 'address', 'Address' ) },
	} );
	const lat = el( 'input', { class: 'atcf-location__lat', attrs: { type: 'number', step: 'any', 'aria-label': t( 'latitude', 'Latitude' ) } } ) as HTMLInputElement;
	const lng = el( 'input', { class: 'atcf-location__lng', attrs: { type: 'number', step: 'any', 'aria-label': t( 'longitude', 'Longitude' ) } } ) as HTMLInputElement;
	const map = el( 'div', { class: 'atcf-location__map' } );
	const status = el( 'p', { class: 'atcf-location__status', attrs: { role: 'status' } } );

	( address as HTMLInputElement ).value = value.address;
	lat.value = value.lat ? String( value.lat ) : '';
	lng.value = value.lng ? String( value.lng ) : '';

	const push = () => {
		set( value.lat || value.lng ? { ...value } : '' );
		drawMap();
	};

	/**
	 * The map is a static OpenStreetMap embed, not a scripted map library.
	 *
	 * A field that shows where a point is does not need pan, zoom, layers and
	 * 140KB of JavaScript, and every one of those is a thing that can fail to
	 * load inside an iframe window. An `<iframe>` at the right coordinates
	 * answers the only question the control is asked: *is that the right place?*
	 */
	const drawMap = () => {
		clear( map );

		if ( ! value.lat && ! value.lng ) {
			map.append( el( 'p', { class: 'atcf-location__empty', text: t( 'empty', 'Nothing here yet.' ) } ) );

			return;
		}

		const span = 0.02;
		const box = [ value.lng - span, value.lat - span, value.lng + span, value.lat + span ].join( ',' );

		map.append(
			el( 'iframe', {
				class: 'atcf-location__frame',
				attrs: {
					src: `https://www.openstreetmap.org/export/embed.html?bbox=${ encodeURIComponent( box ) }&marker=${ value.lat },${ value.lng }`,
					title: value.address || `${ value.lat }, ${ value.lng }`,
					loading: 'lazy',
					referrerpolicy: 'no-referrer',
				},
			} )
		);
	};

	const geocode = debounce( async ( query: string ) => {
		if ( query.trim().length < 3 ) {
			return;
		}

		status.textContent = t( 'searching', 'Searching…' );

		try {
			const response = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${ encodeURIComponent( query ) }`,
				{ headers: { Accept: 'application/json' } }
			);

			const results = ( await response.json() ) as Array< { lat: string; lon: string; display_name: string } >;

			if ( ! results.length ) {
				status.textContent = t( 'noResults', 'Nothing matched.' );

				return;
			}

			value.lat = Number( results[ 0 ].lat );
			value.lng = Number( results[ 0 ].lon );
			lat.value = String( value.lat );
			lng.value = String( value.lng );
			status.textContent = results[ 0 ].display_name;
			push();
		} catch {
			// Offline, or the site blocks outbound requests. The coordinates can
			// still be typed, which is why they are inputs rather than a readout.
			status.textContent = '';
		}
	}, 600 );

	address.addEventListener( 'change', () => {
		value.address = readValue( address );
		push();
	} );

	lat.addEventListener( 'change', () => {
		value.lat = Number( lat.value );
		push();
	} );

	lng.addEventListener( 'change', () => {
		value.lng = Number( lng.value );
		push();
	} );

	host.append(
		el( 'div', {
			class: 'atcf-location',
			children: [
				el( 'div', {
					class: 'atcf-location__row',
					children: [
						address,
						button( t( 'findOnMap', 'Find' ), {
							on: { click: () => geocode( readValue( address ) ) },
						} ),
					],
				} ),
				el( 'div', { class: 'atcf-location__coords', children: [ lat, lng ] } ),
				status,
				map,
			],
		} )
	);

	drawMap();
} );

/* -------------------------------------------------------------------------- */
/* Table                                                                       */
/* -------------------------------------------------------------------------- */

registerMount( 'table', ( context: MountContext ) => {
	const { host, field, set } = context;
	const settings = field.settings as { columns?: unknown; max_items?: number };
	const columns = normalizeChoices( settings.columns );
	const max = Number( settings.max_items ?? 0 );

	let rows: Array< Record< string, string > > = Array.isArray( context.value )
		? ( context.value as Array< Record< string, string > > )
		: [];

	const table = el( 'table', { class: 'atcf-table' } );
	const foot = el( 'div', { class: 'atcf-table__foot' } );

	const commit = () => {
		set( rows.map( ( row ) => ( { ...row } ) ) );
		draw();
	};

	const draw = () => {
		clear( table );
		clear( foot );

		if ( ! columns.length ) {
			table.append( el( 'caption', { text: 'This table has no columns yet.' } ) );

			return;
		}

		const head = el( 'tr' );

		columns.forEach( ( column ) => head.append( el( 'th', { text: column.label, attrs: { scope: 'col' } } ) ) );
		head.append( el( 'th', { class: 'atcf-table__gutter', attrs: { scope: 'col' }, text: '' } ) );
		table.append( el( 'thead', { children: [ head ] } ) );

		const body = el( 'tbody' );

		rows.forEach( ( row, index ) => {
			const tr = el( 'tr' );

			columns.forEach( ( column ) => {
				const input = el( 'input', {
					class: 'atcf-table__cell',
					attrs: { type: 'text', value: String( row[ column.value ] ?? '' ), 'aria-label': column.label },
				} ) as HTMLInputElement;

				input.addEventListener( 'change', () => {
					row[ column.value ] = input.value;
					set( rows.map( ( one ) => ( { ...one } ) ) );
				} );

				tr.append( el( 'td', { children: [ input ] } ) );
			} );

			tr.append(
				el( 'td', {
					children: [
						el( 'button', {
							class: 'atcf-table__remove',
							text: '×',
							attrs: { type: 'button', 'aria-label': t( 'remove', 'Remove' ) },
							on: {
								click: () => {
									rows.splice( index, 1 );
									commit();
								},
							},
						} ),
					],
				} )
			);

			body.append( tr );
		} );

		table.append( body );

		if ( ! max || rows.length < max ) {
			foot.append(
				button( t( 'addRow', 'Add row' ), {
					on: {
						click: () => {
							const row: Record< string, string > = {};

							columns.forEach( ( column ) => {
								row[ column.value ] = '';
							} );

							rows.push( row );
							commit();
						},
					},
				} )
			);
		}
	};

	host.append( table, foot );
	draw();
} );

/* -------------------------------------------------------------------------- */
/* JSON                                                                        */
/* -------------------------------------------------------------------------- */

registerMount( 'json', ( context: MountContext ) => {
	const { host, field, set } = context;
	const settings = field.settings as { rows?: number };

	const area = control( 'os-textarea', 'textarea', {
		class: 'atcf-input atcf-input--code',
		attrs: { rows: Number( settings.rows ?? 8 ), spellcheck: 'false' },
	} );
	const status = el( 'p', { class: 'atcf-json__status', attrs: { role: 'status' } } );

	( area as HTMLTextAreaElement ).value = typeof context.value === 'string' ? context.value : JSON.stringify( context.value ?? null, null, 2 );

	area.addEventListener( 'input', () => {
		const raw = readValue( area );

		if ( raw.trim() === '' ) {
			status.textContent = '';
			set( '' );

			return;
		}

		try {
			JSON.parse( raw );
			status.textContent = '';
			status.classList.remove( 'is-invalid' );
			set( raw );
		} catch {
			// Reported and *not* stored. Storing invalid JSON would put the
			// field in a state where every read of it returns null, which is
			// much harder to notice than a message under the box.
			status.textContent = t( 'invalidJson', 'That is not valid JSON.' );
			status.classList.add( 'is-invalid' );
		}
	} );

	host.append( el( 'div', { class: 'atcf-json', children: [ area, status ] } ) );
} );

/* -------------------------------------------------------------------------- */
/* Embed                                                                       */
/* -------------------------------------------------------------------------- */

registerMount( 'oembed', ( context: MountContext ) => {
	const { host, set } = context;

	const input = control( 'os-text-field', 'input', {
		class: 'atcf-input',
		attrs: { type: 'url', placeholder: 'https://' },
	} );
	const preview = el( 'div', { class: 'atcf-oembed__preview' } );

	( input as HTMLInputElement ).value = String( context.value ?? '' );

	const refresh = debounce( () => {
		const url = readValue( input ).trim();

		set( url );
		clear( preview );

		if ( ! url ) {
			return;
		}

		// A link, not a live embed. Resolving one needs a REST round trip per
		// keystroke, and the field's job here is to confirm the URL is the one
		// you meant — which the URL itself does.
		//
		// Clickable only when it is actually a web URL. The stored value is
		// author-controlled, and a `javascript:` string rendered as a live href
		// on somebody else's edit screen is the classic stored-XSS shape even
		// when modern `target="_blank"` handling defuses it.
		if ( /^https?:\/\//i.test( url ) ) {
			preview.append( el( 'a', { text: url, attrs: { href: url, target: '_blank', rel: 'noreferrer noopener' } } ) );
		} else {
			preview.append( el( 'span', { text: url } ) );
		}
	}, 300 );

	input.addEventListener( 'input', refresh );
	host.append( el( 'div', { class: 'atcf-oembed', children: [ input, preview ] } ) );
	refresh();
} );

/* -------------------------------------------------------------------------- */
/* Computed                                                                    */
/* -------------------------------------------------------------------------- */

registerMount( 'computed', ( context: MountContext ) => {
	const { host, field, wrapper } = context;
	const settings = field.settings as { formula?: string; decimals?: number; prepend?: string; append?: string };

	const output = el( 'output', { class: 'atcf-computed__value' } );

	/**
	 * Recomputes from whatever the surrounding form currently holds.
	 *
	 * Read out of the DOM rather than from a shared value store, because the
	 * fields a formula names may be PHP-rendered inputs on the same screen, and
	 * those have no store — the form *is* the store.
	 */
	const recompute = () => {
		const values: Record< string, unknown > = {};
		const scope = wrapper.closest< HTMLElement >( '.atcf-fields, .atcf-row__body' ) ?? document.body;

		scope.querySelectorAll< HTMLElement >( '[data-atcf-field]' ).forEach( ( sibling ) => {
			const name = sibling.dataset.atcfName ?? '';
			const key = sibling.dataset.atcfField ?? '';
			const input = sibling.querySelector< HTMLInputElement >( 'input, select, textarea' );

			if ( ! input ) {
				return;
			}

			const raw = input.type === 'checkbox' ? ( input.checked ? '1' : '0' ) : input.value;

			values[ name ] = raw;
			values[ key ] = raw;
		} );

		const result = calc( String( settings.formula ?? '' ), values );
		const decimals = Math.max( 0, Math.min( 10, Number( settings.decimals ?? 2 ) ) );

		output.textContent =
			result === ''
				? '—'
				: `${ settings.prepend ?? '' }${ Number( result ).toFixed( decimals ) }${ settings.append ?? '' }`;
	};

	// Listening on the whole surrounding scope rather than on named inputs: the
	// formula's variables can change every time somebody edits the field group,
	// and a listener list built from the formula would go stale the moment a
	// repeater added a row.
	const scope = wrapper.closest< HTMLElement >( '.atcf-fields, .atcf-row__body' ) ?? document.body;

	scope.addEventListener( 'input', recompute );
	scope.addEventListener( 'change', recompute );

	host.append(
		el( 'div', {
			class: 'atcf-computed',
			children: [
				output,
				el( 'span', {
					class: 'atcf-computed__note',
					text: 'Worked out from the other fields. The saved value is the server’s own.',
				} ),
			],
		} )
	);

	recompute();

	return () => {
		scope.removeEventListener( 'input', recompute );
		scope.removeEventListener( 'change', recompute );
	};
} );
