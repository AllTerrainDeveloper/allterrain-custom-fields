/**
 * The mount contract.
 *
 * PHP renders a `<div class="atcf-mount">` with three attributes — the field
 * type, the field definition as JSON, and the current value as JSON — plus a
 * hidden input holding that same value. A mount renderer fills the div with a
 * control and calls `set()` whenever the value changes; `set()` writes JSON back
 * into the hidden input.
 *
 * That indirection is what makes the whole runtime safe to fail. If a mount
 * throws, never runs, or is for a type no bundle registered, the hidden input
 * still holds what was there — so the worst outcome is a field that cannot be
 * *edited* this page load, never one that is silently *emptied* by saving.
 *
 * It is also why there is no per-type `<input name="…">` scattering: one field is
 * one submitted key, whatever shape its value is.
 */

import type { Field } from '../types';

/** What a mount renderer is handed. */
export interface MountContext {
	/** Where to render. Already empty. */
	host: HTMLElement;
	/** The field definition, minus anything the browser has no business seeing. */
	field: Field;
	/** The current value, decoded. */
	value: unknown;
	/** Writes a new value, and tells the rest of the runtime it changed. */
	set: ( value: unknown ) => void;
	/** The wrapper element, for classes and drop targets. */
	wrapper: HTMLElement;
}

/** A mount renderer. Returns a teardown when it has anything to tear down. */
export type MountRenderer = ( context: MountContext ) => ( () => void ) | void;

const renderers = new Map< string, MountRenderer >();

/**
 * Registers a renderer for a field type.
 *
 * Exported and documented, because a plugin registering its own field type in
 * PHP needs somewhere to put the control. It calls this from its own bundle and
 * the runtime picks it up — no privileged path, the same rule the PHP registry
 * follows.
 *
 * @param type     Field type slug.
 * @param renderer What draws it.
 */
export function registerMount( type: string, renderer: MountRenderer ): void {
	renderers.set( type, renderer );
}

/** The renderer for a type, if anything registered one. */
export function mountFor( type: string ): MountRenderer | undefined {
	return renderers.get( type );
}

/** Every type that has a renderer. */
export function registeredMounts(): string[] {
	return Array.from( renderers.keys() );
}

/**
 * Publishes the registry so a third-party bundle can reach it.
 *
 * On `window.allTerrainFields.mounts` rather than as a module export, because a
 * plugin distributed as a zip has no build-time relationship with this one and
 * cannot import from it. A global is the only seam a separate IIFE has.
 */
export function publishRegistry(): void {
	const global = window as unknown as {
		allTerrainFields?: Record< string, unknown >;
	};

	global.allTerrainFields = global.allTerrainFields ?? {};
	global.allTerrainFields.registerMount = registerMount;
}
