/**
 * The location editor — where a field group appears.
 *
 * The structure is an **OR of ANDs**: a list of clauses, each a list of rules,
 * and the group shows when any one clause matches entirely. That is the shape of
 * the sentence people actually say — *"on Products, and also on Pages using the
 * landing template"* — and it is why the UI reads as blocks separated by the
 * word **or**, with rules inside a block separated by **and**.
 *
 * Drawing it as one flat list with a match-all/match-any toggle, which is the
 * other common shape, cannot express that sentence at all.
 *
 * Both dropdowns come from the server: `locationParams` says what can be tested
 * and which choice list answers it, `locationChoices` holds the lists. A plugin
 * that adds a location parameter appears here with no code in this file — the
 * same no-privileged-path rule the field registry follows.
 */

import { button, clear, el, select, textField } from '../ui';
import type { BuilderConfig, LocationRule } from '../types';

/** What the editor needs. */
export interface LocationOptions {
	location: LocationRule[][];
	config: BuilderConfig;
	onChange: ( location: LocationRule[][] ) => void;
}

/**
 * Draws the location editor.
 *
 * @param host What to fill.
 * @param opts The rules and what to do with them.
 */
export function renderLocation( host: HTMLElement, opts: LocationOptions ): void {
	clear( host );

	const clauses = opts.location.length ? opts.location : [];

	if ( ! clauses.length ) {
		host.append(
			el( 'p', {
				class: 'atcfb__location-empty',
				text: 'No rules — this group appears everywhere. Add one to narrow it.',
			} )
		);
	}

	clauses.forEach( ( clause, clauseIndex ) => {
		if ( clauseIndex > 0 ) {
			host.append( el( 'p', { class: 'atcfb__location-or', text: 'or' } ) );
		}

		host.append( renderClause( clause, clauseIndex, opts ) );
	} );

	host.append(
		button( clauses.length ? 'Or add another set of rules' : 'Add a rule', {
			class: 'atcfb__location-add',
			on: {
				click: () => {
					const first = firstParam( opts.config );

					opts.onChange( [
						...opts.location,
						[ { param: first.param, operator: '==', value: firstChoice( first.choices, opts.config ) } ],
					] );
				},
			},
		} )
	);
}

/** One AND clause. */
function renderClause( clause: LocationRule[], clauseIndex: number, opts: LocationOptions ): HTMLElement {
	const box = el( 'div', { class: 'atcfb__clause' } );

	clause.forEach( ( rule, ruleIndex ) => {
		if ( ruleIndex > 0 ) {
			box.append( el( 'span', { class: 'atcfb__clause-and', text: 'and' } ) );
		}

		box.append( renderRule( rule, clauseIndex, ruleIndex, opts ) );
	} );

	box.append(
		button( 'And…', {
			class: 'atcfb__clause-add',
			on: {
				click: () => {
					const first = firstParam( opts.config );
					const next = opts.location.map( ( one, index ) =>
						index === clauseIndex
							? [ ...one, { param: first.param, operator: '==' as const, value: firstChoice( first.choices, opts.config ) } ]
							: one
					);

					opts.onChange( next );
				},
			},
		} )
	);

	return box;
}

/** One rule: parameter, operator, value. */
function renderRule( rule: LocationRule, clauseIndex: number, ruleIndex: number, opts: LocationOptions ): HTMLElement {
	const update = ( patch: Partial< LocationRule > ) => {
		const next = opts.location.map( ( clause, index ) =>
			index !== clauseIndex
				? clause
				: clause.map( ( one, position ) => ( position === ruleIndex ? { ...one, ...patch } : one ) )
		);

		opts.onChange( next );
	};

	const remove = () => {
		const next = opts.location
			.map( ( clause, index ) =>
				index !== clauseIndex ? clause : clause.filter( ( _one, position ) => position !== ruleIndex )
			)
			// A clause with no rules left is removed entirely rather than kept as
			// an empty block. An empty AND matches everything, so leaving it
			// would silently widen the group to the whole site.
			.filter( ( clause ) => clause.length );

		opts.onChange( next );
	};

	const params: Array< { value: string; label: string } > = [];

	opts.config.locationParams.forEach( ( group ) => {
		group.params.forEach( ( param ) => params.push( { value: param.param, label: `${ group.label }: ${ param.label }` } ) );
	} );

	const descriptor = findParam( rule.param, opts.config );
	const choices = descriptor ? opts.config.locationChoices[ descriptor.choices ] : undefined;

	return el( 'div', {
		class: 'atcfb__rule atcfb__rule--location',
		children: [
			select( rule.param, params, ( value ) => {
				const next = findParam( value, opts.config );

				// The value is reset when the parameter changes, because a value
				// from the old list is meaningless against the new one — a rule
				// reading "Taxonomy is product" after switching from Post type is
				// a rule that matches nothing and looks like it should.
				update( { param: value, value: firstChoice( next?.choices ?? '', opts.config ) } );
			} ),
			select(
				rule.operator,
				[
					{ value: '==', label: 'is' },
					{ value: '!=', label: 'is not' },
				],
				( value ) => update( { operator: value as '==' | '!=' } )
			),
			choices
				? select(
						String( rule.value ),
						Object.entries( choices ).map( ( [ value, label ] ) => ( { value, label } ) ),
						( value ) => update( { value } )
				  )
				: // Parameters whose choices are a whole post table — `post`,
				  // `term`, `page_parent` — have no dropdown, because a site with
				  // fifty thousand posts cannot ship one. A number box is honest
				  // about what it wants, and the Content Model window is where
				  // you go to pick one by name.
				  textField( String( rule.value ), { attrs: { placeholder: 'ID' } }, ( value ) => update( { value } ) ),
			el( 'button', {
				class: 'atcfb__rule-remove',
				text: '×',
				attrs: { type: 'button', 'aria-label': 'Remove this rule' },
				on: { click: remove },
			} ),
		],
	} );
}

/** The descriptor for a parameter slug. */
function findParam( param: string, config: BuilderConfig ) {
	for ( const group of config.locationParams ) {
		const found = group.params.find( ( one ) => one.param === param );

		if ( found ) {
			return found;
		}
	}

	return undefined;
}

/** The first parameter offered, for a freshly added rule. */
function firstParam( config: BuilderConfig ) {
	return config.locationParams[ 0 ]?.params[ 0 ] ?? { param: 'post_type', label: 'Post type', choices: 'post_types' };
}

/** The first value in a choice list, for a freshly added rule. */
function firstChoice( source: string, config: BuilderConfig ): string {
	const choices = config.locationChoices[ source ];

	return choices ? Object.keys( choices )[ 0 ] ?? '' : '';
}
