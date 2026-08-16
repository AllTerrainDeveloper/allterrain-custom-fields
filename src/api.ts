/**
 * The REST client.
 *
 * Routed through `wp.os.fetch()` when there is a shell, because that is what
 * pulses the activity dot in the window's title bar — a save that takes two
 * seconds should say so somewhere, and the shell already has the place to say
 * it. Without a shell it is a plain `fetch` with the same headers.
 *
 * Errors are thrown, never returned as a falsy value. A caller that forgets to
 * check a returned `null` writes the failure into the UI as an empty list, which
 * looks exactly like success with no data.
 */

import { shell } from './shell';
import type {
	BuilderConfig,
	ContentModel,
	ContentType,
	FieldGroup,
	GroupSummary,
	JsonDiff,
	RuntimeConfig,
	SearchResult,
} from './types';

/** The runtime blob PHP printed. */
export function config(): RuntimeConfig {
	const global = ( window as unknown as { allTerrainFields?: RuntimeConfig } ).allTerrainFields;

	if ( global ) {
		return global;
	}

	// A window opened lazily gets its config through the shell rather than
	// through a script tag, because the lazy path never runs
	// `wp_print_scripts()`. Reading both is what makes a window work whether it
	// was opened at boot or half an hour into a session.
	const fromWindow = shell()?.getWindowConfig?.< RuntimeConfig >( 'allterrain-fields' );

	return (
		fromWindow ?? {
			restUrl: '',
			wpRestUrl: '',
			nonce: '',
			adminUrl: '',
			version: '0',
			canManage: false,
			devMode: false,
			locale: 'en_US',
			dragTypes: {
				field: 'allterrain-fields/field',
				group: 'allterrain-fields/group',
				value: 'allterrain-fields/value',
			},
			shell: { active: false, chromeless: false },
		}
	);
}

/** A translated string, falling back to the key's own default. */
export function t( key: string, fallback: string ): string {
	const strings = ( window as unknown as { allTerrainFieldsL10n?: Record< string, string > } ).allTerrainFieldsL10n;

	return strings?.[ key ] ?? config().i18n?.[ key ] ?? fallback;
}

/** An error carrying the server's own message, so the UI can show it verbatim. */
export class ApiError extends Error {
	public readonly status: number;
	public readonly code: string;

	public constructor( message: string, status: number, code: string ) {
		super( message );

		this.name = 'ApiError';
		this.status = status;
		this.code = code;
	}
}

/**
 * One request.
 *
 * @param path   Route path under this plugin's namespace, e.g. `groups/12`.
 * @param init   Fetch options.
 * @param source A label for the shell's activity indicator.
 * @return The decoded body.
 */
async function request< T >( path: string, init: RequestInit = {}, source = 'allterrain-fields' ): Promise< T > {
	const { restUrl, nonce } = config();
	const url = path.startsWith( 'http' ) ? path : restUrl + path;

	const options: RequestInit = {
		credentials: 'same-origin',
		...init,
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': nonce,
			...( init.headers ?? {} ),
		},
	};

	const os = shell();
	const response = os?.fetch ? await os.fetch( url, options, { source } ) : await fetch( url, options );

	if ( response.status === 204 ) {
		return undefined as unknown as T;
	}

	const body = await response.json().catch( () => null );

	if ( ! response.ok ) {
		// The server's message, not a generic one. "You are not allowed to
		// change the site's field groups" tells somebody what to do next;
		// "Request failed (403)" tells them to file a bug.
		const message =
			( body as { message?: string } | null )?.message ??
			`The server refused that (${ response.status }).`;

		throw new ApiError( message, response.status, ( body as { code?: string } | null )?.code ?? 'unknown' );
	}

	return body as T;
}

/** Everything the builder needs to draw itself. */
export function getConfig(): Promise< BuilderConfig > {
	return request< BuilderConfig >( 'config' );
}

/** The field groups, as summaries. */
export function listGroups(): Promise< GroupSummary[] > {
	return request< GroupSummary[] >( 'groups' );
}

/** One group in full. */
export function getGroup( id: number ): Promise< FieldGroup > {
	return request< FieldGroup >( `groups/${ id }` );
}

/** Creates or updates a group. */
export function saveGroup( group: FieldGroup ): Promise< FieldGroup > {
	const path = group.id ? `groups/${ group.id }` : 'groups';

	return request< FieldGroup >( path, { method: 'POST', body: JSON.stringify( group ) }, 'field-group-save' );
}

/**
 * Creates a real group from a starter template.
 *
 * The slug goes up and a saved group comes back — the browser never assembles
 * the fields, because the keys and the conditional rules that point at them have
 * to be minted together or two groups made from one template end up wired into
 * each other.
 */
export function createFromTemplate( slug: string ): Promise< FieldGroup > {
	return request< FieldGroup >( `templates/${ encodeURIComponent( slug ) }`, { method: 'POST' }, 'field-group-save' );
}

/** Trashes a group. Its values are left alone. */
export function deleteGroup( id: number ): Promise< { deleted: boolean } > {
	return request< { deleted: boolean } >( `groups/${ id }`, { method: 'DELETE' } );
}

/**
 * Makes a new custom post type — a new kind of content this site can hold.
 *
 * The slug, the seventeen labels and the twenty other `register_post_type()`
 * arguments are all worked out server-side from two words. See
 * `atcf_content_type_args()`.
 */
export function createContentType( type: Partial< ContentType > ): Promise< ContentType > {
	return request< ContentType >( 'content-types', { method: 'POST', body: JSON.stringify( type ) } );
}

/** Removes a content type. Whatever was stored in it stays where it is. */
export function deleteContentType( id: number ): Promise< { deleted: boolean } > {
	return request< { deleted: boolean } >( `content-types/${ id }`, { method: 'DELETE' } );
}

/** The site's content model. */
export function getModel(): Promise< ContentModel > {
	return request< ContentModel >( 'model' );
}

/** Searches posts, terms or users for a relational control. */
export function search( params: Record< string, string | number > ): Promise< { results: SearchResult[] } > {
	const query = new URLSearchParams();

	Object.entries( params ).forEach( ( [ key, value ] ) => {
		if ( value !== '' && value !== undefined && value !== null ) {
			query.set( key, String( value ) );
		}
	} );

	return request< { results: SearchResult[] } >( `search?${ query.toString() }` );
}

/** The bulk editor's rows. */
export function readValues( params: Record< string, string | number > ): Promise< {
	columns: Array< { key: string; name: string; label: string; type: string; settings: Record< string, unknown > } >;
	rows: Array< {
		id: number;
		title: string;
		status: string;
		editUrl: string;
		canEdit: boolean;
		values: Record< string, unknown >;
	} >;
	total: number;
	pages: number;
	postType: string;
	postTypes: string[];
} > {
	const query = new URLSearchParams();

	Object.entries( params ).forEach( ( [ key, value ] ) => query.set( key, String( value ) ) );

	return request( `values?${ query.toString() }` );
}

/** Writes many values at once. */
export function writeValues(
	writes: Array< { id: number; field: string; value: unknown } >
): Promise< { written: number; refused: number[] } > {
	return request( 'values', { method: 'POST', body: JSON.stringify( { writes } ) }, 'field-values-save' );
}

/** Exports groups as JSON. */
export function exportGroups( ids: number[] = [] ): Promise< FieldGroup[] > {
	const query = ids.length ? `?ids=${ ids.join( ',' ) }` : '';

	return request< FieldGroup[] >( `export${ query }` );
}

/** Imports groups from JSON. */
export function importGroups(
	groups: unknown[]
): Promise< { imported: Array< { id: number; key: string; title: string; updated: boolean } > } > {
	return request( 'import', { method: 'POST', body: JSON.stringify( { groups } ) }, 'field-group-import' );
}

/** The rendered preview of a group's edit screen. */
export function preview( id: number, post = 0 ): Promise< { title: string; markup: string; sample: number } > {
	return request( `preview/${ id }?post=${ post }` );
}

/** What differs between the JSON files and the database. */
export function jsonDiff(): Promise< JsonDiff > {
	return request< JsonDiff >( 'sync' );
}

/** Imports the groups on disk. */
export function jsonSync( keys: string[] = [] ): Promise< { imported: Array< { key: string; title: string } > } > {
	return request( 'sync', { method: 'POST', body: JSON.stringify( { keys } ) }, 'field-group-sync' );
}
