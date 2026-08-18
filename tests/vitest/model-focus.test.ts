/**
 * The focused content model: which nodes a field group is tied to.
 *
 * A builder window's Related menu opens the Content Model "for THIS group" —
 * the graph filtered to the types that carry the group and the types its
 * relational fields point at. This is the filter.
 */

import { describe, expect, it } from 'vitest';

import { nodesTiedToGroup } from '../../src/model/index';
import type { ContentModel, ModelEdge, ModelNode } from '../../src/types';

function node( id: string, groups: number[] = [] ): ModelNode {
	return {
		id,
		kind: 'post_type',
		label: id,
		icon: '',
		count: 0,
		fields: groups.length,
		list: [],
		groups: groups.map( ( gid ) => ( { id: gid, title: `g${ gid }`, fields: 1 } ) ),
		own: 0,
	};
}

function edge( group_id: number, from: string[], to: string[], kind = 'post' ): ModelEdge {
	return { field: 'f', label: 'f', name: 'f', type: 'post', group: `g${ group_id }`, group_id, from, to, kind } as unknown as ModelEdge;
}

describe( 'nodesTiedToGroup', () => {
	const data: ContentModel = {
		nodes: [ node( 'post', [ 7 ] ), node( 'page' ), node( 'product', [ 3 ] ), node( 'user_node' ) ],
		edges: [ edge( 7, [ 'post' ], [ 'page' ] ), edge( 3, [ 'product' ], [ 'post' ] ) ],
		groups: [],
	};

	it( 'keeps the types that carry the group and what its fields point at', () => {
		expect( nodesTiedToGroup( data, 7 ).map( ( one ) => one.id ) ).toEqual( [ 'post', 'page' ] );
	} );

	it( 'does not leak another group into the answer', () => {
		expect( nodesTiedToGroup( data, 3 ).map( ( one ) => one.id ) ).toEqual( [ 'post', 'product' ] );
	} );

	it( 'resolves user-kind edges onto the people node', () => {
		const withUser: ContentModel = {
			nodes: [ node( 'post', [ 5 ] ), node( 'user' ) ],
			edges: [ edge( 5, [ 'post' ], [], 'user' ) ],
			groups: [],
		};

		expect( nodesTiedToGroup( withUser, 5 ).map( ( one ) => one.id ) ).toEqual( [ 'post', 'user' ] );
	} );

	it( 'answers nothing for a group the model has never seen', () => {
		expect( nodesTiedToGroup( data, 99 ) ).toEqual( [] );
	} );
} );
