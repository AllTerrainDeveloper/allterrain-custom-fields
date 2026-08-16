/**
 * The formula window's conversation with the builder.
 *
 * The drawing is covered by the editor's own tests; what is tested here is the
 * handshake, because every one of its failure modes is silent. A window that
 * misses the context sits on "Waiting for the field group…" forever with nothing
 * in any console. A result addressed to the wrong session lands in the wrong
 * builder and overwrites a formula somebody was in the middle of. Neither throws.
 *
 * The shell is stubbed rather than mocked at the module boundary, so the messages
 * are the real ones: a topic string, a payload, and whatever subscribers happen
 * to be listening — which is exactly the surface the bug would live in.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FORMULA_TOPICS, mountFormulaWindow } from '../../src/builder/formula-window';

/** A stand-in for the shell's message bus and window registry. */
function stubShell( params: Record< string, string > = {} ) {
	const subscribers: Record< string, Array< ( payload: unknown ) => void > > = {};
	const sent: Array< { topic: string; payload: unknown } > = [];

	const os = {
		isActive: () => true,
		ready: ( cb: () => void ) => cb(),
		whenReady: ( cb: () => void ) => cb(),
		getWindowParams: () => params,
		openWindow: vi.fn( () => true ),
		broadcast: ( topic: string, payload: unknown ) => {
			sent.push( { topic, payload } );
			( subscribers[ topic ] ?? [] ).forEach( ( cb ) => cb( payload ) );
		},
		subscribe: ( topic: string, cb: ( payload: unknown ) => void ) => {
			subscribers[ topic ] = subscribers[ topic ] ?? [];
			subscribers[ topic ].push( cb );

			return () => {
				subscribers[ topic ] = subscribers[ topic ].filter( ( one ) => one !== cb );
			};
		},
	};

	( window as unknown as { wp?: { os?: unknown } } ).wp = { os };

	return { os, sent, subscribers };
}

/**
 * The markup `atcf_formula_template()` prints, inside a window host.
 *
 * The host matters: `windowIdOf()` walks up to `.os-window` to learn which
 * window it is in, and that is how the session reaches the hello.
 */
function windowBody(): HTMLElement {
	const host = document.createElement( 'div' );

	host.className = 'os-window';
	host.setAttribute( 'data-window-id', 'allterrain-fields-formula' );

	const root = document.createElement( 'div' );

	root.className = 'atcfb atcflw';
	root.setAttribute( 'data-atcf-formula-root', '' );
	root.innerHTML = `
		<div class="atcflw__waiting" data-atcflw-waiting><p>Waiting for the field group…</p></div>
		<div class="atcflw__panes" data-atcflw-panes hidden>
			<div class="atcflw__work" data-atcflw-work></div>
			<div class="atcflw__manual" data-atcflw-manual></div>
		</div>
		<div class="atcflw__foot" data-atcflw-foot hidden></div>
	`;

	host.append( root );
	document.body.append( host );

	return root;
}

/** A context a builder would send. */
function context( over: Partial< Record< string, unknown > > = {} ) {
	return {
		session: 'atcf-1-abc',
		label: 'Price per m²',
		formula: '{price} / {area}',
		fields: [
			{ name: 'price', label: 'Price' },
			{ name: 'area', label: 'Floor area' },
		],
		functions: [ 'round', 'if' ],
		...over,
	};
}

beforeEach( () => {
	document.body.replaceChildren();
	delete ( window as unknown as { wp?: unknown } ).wp;
} );

describe( 'the formula window', () => {
	it( 'says hello with the session it was opened with', () => {
		const { sent } = stubShell( { session: 'atcf-1-abc' } );

		mountFormulaWindow( windowBody() );

		const hello = sent.find( ( one ) => one.topic === FORMULA_TOPICS.hello );

		expect( hello ).toBeTruthy();
		expect( ( hello?.payload as { session: string } ).session ).toBe( 'atcf-1-abc' );
	} );

	it( 'listens before it speaks', () => {
		// The half of the handshake that matters. If the hello went out before
		// the context subscription existed, a builder that replied
		// synchronously — which the bus does — would be answering into nothing,
		// and the window would wait forever.
		const { subscribers, sent } = stubShell( { session: 'atcf-1-abc' } );
		const root = windowBody();

		subscribers[ FORMULA_TOPICS.hello ] = [
			() => {
				( window as unknown as { wp: { os: { broadcast: ( t: string, p: unknown ) => void } } } ).wp.os.broadcast(
					FORMULA_TOPICS.context,
					context()
				);
			},
		];

		mountFormulaWindow( root );

		expect( sent.some( ( one ) => one.topic === FORMULA_TOPICS.context ) ).toBe( true );
		expect( root.querySelector< HTMLElement >( '[data-atcflw-panes]' )?.hidden ).toBe( false );
	} );

	it( 'draws the field it was told about', () => {
		const { os } = stubShell( { session: 'atcf-1-abc' } );
		const root = windowBody();

		mountFormulaWindow( root );
		os.broadcast( FORMULA_TOPICS.context, context() );

		expect( root.querySelector( '.atcflw__title' )?.textContent ).toBe( 'Price per m²' );
		expect( root.querySelector( '.atcfb__formula' )?.textContent ).toBe( '{price} / {area}' );
	} );

	it( 'stops waiting once it has been answered', () => {
		const { os } = stubShell();
		const root = windowBody();

		mountFormulaWindow( root );

		expect( root.querySelector( '[data-atcflw-waiting]' ) ).toBeTruthy();

		os.broadcast( FORMULA_TOPICS.context, context() );

		expect( root.querySelector( '[data-atcflw-waiting]' ) ).toBe( null );
		expect( root.querySelector< HTMLElement >( '[data-atcflw-foot]' )?.hidden ).toBe( false );
	} );

	it( 'computes with the shared engine', () => {
		const { os } = stubShell();
		const root = windowBody();

		mountFormulaWindow( root );
		os.broadcast( FORMULA_TOPICS.context, context() );

		// Samples start at 100 and 4 — so {price} / {area} is 25.
		expect( root.querySelector( '.atcfl__answer' )?.textContent ).toBe( '25' );
	} );

	it( 'sends the formula back quoting the session that asked', () => {
		const { os, sent } = stubShell();
		const root = windowBody();

		mountFormulaWindow( root );
		os.broadcast( FORMULA_TOPICS.context, context( { session: 'atcf-7-zzz' } ) );

		root.querySelector< HTMLElement >( '.atcfl__save' )?.click();

		const result = sent.find( ( one ) => one.topic === FORMULA_TOPICS.result );

		expect( result?.payload ).toEqual( { session: 'atcf-7-zzz', formula: '{price} / {area}' } );
	} );

	it( 'stays open after sending, and says so', () => {
		// Closing on save would be the modal's behaviour, and the whole reason
		// this is a window is that it can stay open while you do the next field.
		// A button that does nothing visible is a button people press twice.
		const { os } = stubShell();
		const root = windowBody();

		mountFormulaWindow( root );
		os.broadcast( FORMULA_TOPICS.context, context() );

		root.querySelector< HTMLElement >( '.atcfl__save' )?.click();

		expect( root.isConnected ).toBe( true );
		expect( root.querySelector( '.atcflw__status' )?.textContent ).toBe( 'Sent to the builder.' );
	} );

	it( 'redraws for a second field without being reopened', () => {
		// The window is a singleton. Pressing Editor on another field sends a new
		// context with a *new* session — a window that only ever accepted the
		// token it was born with would go on showing the first field forever.
		const { os, sent } = stubShell( { session: 'atcf-1-abc' } );
		const root = windowBody();

		mountFormulaWindow( root );
		os.broadcast( FORMULA_TOPICS.context, context() );

		os.broadcast(
			FORMULA_TOPICS.context,
			context( {
				session: 'atcf-2-def',
				label: 'Total time',
				formula: '{prep} + {cook}',
				fields: [
					{ name: 'prep', label: 'Prep' },
					{ name: 'cook', label: 'Cook' },
				],
			} )
		);

		expect( root.querySelector( '.atcflw__title' )?.textContent ).toBe( 'Total time' );

		root.querySelector< HTMLElement >( '.atcfl__save' )?.click();

		// And the reply goes to whichever builder asked most recently.
		const result = sent.filter( ( one ) => one.topic === FORMULA_TOPICS.result ).pop();

		expect( ( result?.payload as { session: string } ).session ).toBe( 'atcf-2-def' );
	} );

	it( 'ignores a message that is not a context', () => {
		const { os } = stubShell();
		const root = windowBody();

		mountFormulaWindow( root );
		os.broadcast( FORMULA_TOPICS.context, { session: 'x' } );

		expect( root.querySelector( '[data-atcflw-waiting]' ) ).toBeTruthy();
	} );

	it( 'only offers a sample box for the fields the formula reads', () => {
		const { os } = stubShell();
		const root = windowBody();

		mountFormulaWindow( root );
		os.broadcast( FORMULA_TOPICS.context, context( { formula: '{price} * 2' } ) );

		const rows = Array.from( root.querySelectorAll< HTMLElement >( '.atcfl__sample' ) );

		expect( rows.find( ( row ) => row.dataset.field === 'price' )?.hidden ).toBe( false );
		expect( rows.find( ( row ) => row.dataset.field === 'area' )?.hidden ).toBe( true );
	} );

	it( 'does nothing at all without the markup it expects', () => {
		stubShell();

		const bare = document.createElement( 'div' );

		document.body.append( bare );

		expect( () => mountFormulaWindow( bare ) ).not.toThrow();
	} );
} );
