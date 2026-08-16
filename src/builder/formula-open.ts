/**
 * The builder's half of the formula-window conversation.
 *
 * Small on purpose. It mints a session, opens the window, answers its hello with
 * the context, and listens for the formula coming back — and every one of those
 * four things is scoped to *this* request rather than to the builder, because
 * two builder windows can be open on two field groups and each may have its own
 * formula window.
 *
 * See `formula-window.ts` for the handshake and why the window speaks first.
 */

import { config } from '../api';
import { shell } from '../shell';
import { FORMULA_TOPICS } from './formula-window';
import type { FormulaContext } from './formula-window';

/** What the builder is asking about. */
export interface FormulaRequest {
	/** What the field is called, for the window's heading. */
	label: string;
	/** The formula as it stands. */
	formula: string;
	/** The sibling fields it may reach. */
	fields: Array< { name: string; label: string } >;
	/** The functions the calculator implements. */
	functions: string[];
	/** Called with the formula the window sends back. */
	onResult: ( formula: string ) => void;
}

/** Sessions this builder is currently listening for, so replies stay scoped. */
let sessions = 0;

/**
 * Opens the formula window and wires up the conversation.
 *
 * @param request What to ask about.
 * @return True when a window was opened; false when there is no shell to open
 *         one, so the caller can fall back to the in-page editor.
 */
export function openFormulaWindow( request: FormulaRequest ): boolean {
	const os = shell();
	const windowId = config().formulaWindow;

	if ( ! os?.openWindow || ! os.broadcast || ! os.subscribe || ! windowId ) {
		return false;
	}

	// Not `Math.random()` alone and not a counter alone. A counter collides
	// between two builder windows, which both start at 1; a random number alone
	// is unreadable in a log. Together they are unique and traceable.
	sessions += 1;

	const session = `atcf-${ sessions }-${ Math.random().toString( 36 ).slice( 2, 8 ) }`;

	const context: FormulaContext = {
		session,
		label: request.label,
		formula: request.formula,
		fields: request.fields,
		functions: request.functions,
	};

	// Subscribed *before* opening, because a window that boots quickly can say
	// hello before `openWindow()` has returned.
	const stopHello = os.subscribe( FORMULA_TOPICS.hello, ( payload ) => {
		const said = ( payload as { session?: string } )?.session ?? '';

		// An empty session is answered too. A window that cannot work out which
		// window it is — an older shell that does not stamp the id, a mount
		// outside the usual host — would otherwise sit on "waiting" forever, and
		// there is only ever one formula window, so answering is safe.
		if ( said && said !== session ) {
			return;
		}

		os.broadcast?.( FORMULA_TOPICS.context, context );
	} );

	const stopResult = os.subscribe( FORMULA_TOPICS.result, ( payload ) => {
		const message = payload as { session?: string; formula?: string };

		if ( message?.session !== session || typeof message.formula !== 'string' ) {
			return;
		}

		request.onResult( message.formula );
	} );

	// The window is a singleton, so pressing Editor for a second field replaces
	// what is in it. The previous session's listeners are torn down when its
	// builder next opens one — but a builder that is closed takes them with it,
	// and a stale subscription that only ever matches a token nobody will send
	// again is inert either way.
	teardowns.push( () => {
		stopHello?.();
		stopResult?.();
	} );

	while ( teardowns.length > MAX_SESSIONS ) {
		teardowns.shift()?.();
	}

	os.openWindow( windowId, { source: 'allterrain-fields-builder', params: { session } } );

	// Said again after the open. A window that was *already* open does not boot,
	// so it never says hello — and without this, pressing Editor for a second
	// field would leave the window showing the first one.
	os.broadcast( FORMULA_TOPICS.context, context );

	return true;
}

/** How many sessions' listeners to keep before retiring the oldest. */
const MAX_SESSIONS = 4;

/** Live subscriptions, oldest first. */
const teardowns: Array< () => void > = [];
