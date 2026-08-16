/**
 * The wire shapes.
 *
 * Each interface here is the TypeScript twin of a PHP structure: `FieldGroup`
 * mirrors `atcf_normalize_group()`, `Field` mirrors `atcf_normalize_field()`,
 * `Conditional` mirrors `atcf_normalize_conditional()`. When one changes the
 * other has to, and the PHPUnit suite asserts the PHP side's keys so the pair
 * cannot drift silently.
 */

/** A conditional-logic rule. Joined by field **key**, never by name. */
export interface LogicRule {
	field: string;
	operator: LogicOperator;
	value: string | string[];
}

export type LogicOperator =
	| 'is'
	| 'is_not'
	| 'contains'
	| 'not_contains'
	| 'starts_with'
	| 'ends_with'
	| 'greater'
	| 'greater_equal'
	| 'less'
	| 'less_equal'
	| 'empty'
	| 'not_empty'
	| 'in'
	| 'not_in';

/** A conditional-logic block. The same shape on fields, tabs and accordions. */
export interface Conditional {
	enabled: boolean;
	action: 'show' | 'hide';
	match: 'all' | 'any';
	rules: LogicRule[];
}

/** How a field sits in the column. */
export interface Wrapper {
	width: number;
	class: string;
	id: string;
}

/** One field. */
export interface Field {
	key: string;
	name: string;
	label: string;
	type: string;
	instructions: string;
	required: boolean;
	readonly: boolean;
	wrapper: Wrapper;
	conditional: Conditional;
	settings: Record< string, unknown >;

	/** Present on a flattened field: the container keys above it, outermost first. */
	ancestors?: string[];
}

/** One rule in a location clause. */
export interface LocationRule {
	param: string;
	operator: '==' | '!=';
	value: string | string[];
}

/** A field group's settings. */
export interface GroupSettings {
	active: boolean;
	description: string;
	position: 'normal' | 'side' | 'after_title';
	style: 'default' | 'seamless';
	label_placement: 'top' | 'left';
	instruction_placement: 'label' | 'field';
	menu_order: number;
	hide_on_screen: string[];
	show_in_rest: boolean;
	block: BlockSettings;
}

export interface BlockSettings {
	enabled: boolean;
	name: string;
	title: string;
	description: string;
	icon: string;
	category: string;
	keywords: string[];
	template: string;
	align: string;
}

/** A whole field group. */
export interface FieldGroup {
	version: number;
	key: string;
	title: string;
	fields: Field[];
	/** An OR of ANDs: the group shows when any inner list matches entirely. */
	location: LocationRule[][];
	settings: GroupSettings;
	id?: number;
	status?: string;
	local?: boolean;
}

/** A group as the builder's list shows it. */
export interface GroupSummary {
	id: number;
	key: string;
	title: string;
	fields: number;
	top: number;
	active: boolean;
	local: boolean;
	block: boolean;
	location: string;
	types: string[];
}

/** A field type, as the palette reads it. */
export interface FieldType {
	type: string;
	label: string;
	description: string;
	group: string;
	icon: string;
	value: 'string' | 'number' | 'boolean' | 'ids' | 'array' | 'object' | 'none';
	settings: Record< string, unknown >;
	supports: string[];
	/** Drag payload kinds this type is a drop target for. */
	accepts: string[];
	mount: boolean;
}

/** How the inspector draws one setting. */
export interface SettingControl {
	control: string;
	label: string;
}

/** A location parameter the rule editor offers. */
export interface LocationParam {
	param: string;
	label: string;
	choices: string;
}

export interface LocationParamGroup {
	label: string;
	params: LocationParam[];
}

/** Everything the builder needs, from `/config`. */
export interface BuilderConfig {
	fieldTypes: FieldType[];
	fieldGroups: Record< string, string >;
	settingControls: Record< string, SettingControl >;
	operators: Record< string, string >;
	locationParams: LocationParamGroup[];
	locationChoices: Record< string, Record< string, string > >;
	postTypes: Record< string, string >;
	taxonomies: Record< string, string >;
	roles: Record< string, string >;
	imageSizes: Record< string, string >;
	optionsPages: Array< { slug: string; page_title: string } >;
	calcFunctions: string[];
	templates: StarterTemplate[];
	adminUrl: string;
}

/**
 * A starter template, as the picker draws it.
 *
 * Deliberately without the field definitions. The picker shows three cards; the
 * schema behind them is minted server-side when one is chosen, because the keys
 * have to be fresh and rules rewritten through the same map.
 */
export interface StarterTemplate {
	slug: string;
	label: string;
	description: string;
	icon: string;
	teaches: string[];
	fields: number;
}

/** The blob PHP prints as `window.allTerrainFields`. */
export interface RuntimeConfig {
	restUrl: string;
	wpRestUrl: string;
	nonce: string;
	adminUrl: string;
	version: string;
	canManage: boolean;
	devMode: boolean;
	locale: string;
	dragTypes: { field: string; group: string; value: string };
	shell: { active: boolean; chromeless: boolean };
	previewWindow?: string;
	/** The formula window's id, when the shell accepted its registration. */
	formulaWindow?: string;
	acceptTypes?: string[];
	window?: string;
	i18n?: Record< string, string >;
}

/** One result from `/search`. */
export interface SearchResult {
	id: number;
	label: string;
	sub: string;
	icon: string;
	status?: string;
	thumbnail?: string;
	editUrl?: string;
}

/** A node in the content model. */
export interface ModelNode {
	id: string;
	kind: 'post_type' | 'taxonomy' | 'user';
	label: string;
	icon: string;
	/** How many objects of this kind exist — 966 posts. */
	count: number;
	/** How many custom fields those objects carry. The number the graph is about. */
	fields: number;
	/** The first few fields, name and type — the body of the class-diagram box. */
	list: Array< { name: string; label: string; type: string; sub: boolean } >;
	/** The field groups that put them there. */
	groups: Array< { id: number; title: string; fields: number } >;
	/** The definition's post id when this plugin registered the type; 0 otherwise. */
	own: number;
}

/** A content type somebody made here. */
export interface ContentType {
	id: number;
	slug: string;
	singular: string;
	plural: string;
	icon: string;
	public: boolean;
	hierarchical: boolean;
	editor: boolean;
	thumbnail: boolean;
	excerpt: boolean;
	archive: boolean;
	taxonomies: string[];
}

/** An edge in the content model — one relational field. */
export interface ModelEdge {
	field: string;
	label: string;
	name: string;
	type: string;
	group: string;
	group_id: number;
	group_title: string;
	from: string[];
	to: string[];
	kind: 'post' | 'taxonomy' | 'user';
	bidirectional: boolean;
	mirror: string;
}

export interface ContentModel {
	nodes: ModelNode[];
	edges: ModelEdge[];
	groups: GroupSummary[];
}

/** What the JSON sync found. */
export interface JsonDiff {
	new: Array< { key: string; title: string; fields: number } >;
	modified: Array< { key: string; id: number; title: string; fields: number } >;
	unsynced: Array< { key: string; id: number; title: string } >;
	dir: string;
	writable: boolean;
}

/* -------------------------------------------------------------------------- */
/* OpenStation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The slice of OpenStation this plugin touches.
 *
 * Declared structurally rather than imported from the `openstation` package,
 * because the shell is *optional* here: importing its types would be harmless,
 * but importing its runtime — which is what `import { … } from 'openstation'`
 * does, since the component barrel registers every tag as a side effect — would
 * bundle the shell's whole component kit into a plugin that must also run on
 * sites where the shell is not installed at all.
 *
 * Everything is optional and every call site null-checks. That is the price of
 * degrading instead of throwing.
 */
export interface ShellApi {
	isActive?: () => boolean;
	ready?: ( cb: () => void ) => void;
	whenReady?: ( cb: () => void ) => void;
	dragManager?: DragManagerApi;
	openWindow?: (
		id: string,
		opts?: { source?: string; params?: Record< string, string | number | boolean > }
	) => boolean;
	openNewWindow?: ( id: string, opts?: { source?: string } ) => boolean;
	registerSystemTile?: ( item: SystemTile ) => void;
	registerNativeUrlRemap?: ( entry: NativeUrlRemap ) => () => void;
	getWindowParams?: ( id: string ) => Record< string, string | number | boolean > | undefined;
	registerTitleBarButton?: ( def: Record< string, unknown > ) => void;
	unregisterTitleBarButton?: ( id: string ) => void;
	loadComponents?: ( tags?: readonly string[] ) => Promise< void >;
	notify?: ( opts: { title?: string; body?: string; type?: string } ) => () => void;
	confirm?: ( opts: {
		title?: string;
		message?: string;
		confirmLabel?: string;
		danger?: boolean;
	} ) => Promise< boolean >;
	fetch?: ( input: string, init?: RequestInit, opts?: { source?: string; silent?: boolean } ) => Promise< Response >;
	broadcast?: < T >( topic: string, payload: T ) => void;
	subscribe?: ( topic: string, cb: ( payload: unknown ) => void ) => () => void;
	getWindowConfig?: < T >( id: string ) => T | undefined;
	windowManager?: {
		open?: ( config: { id: string; baseId?: string; url: string; title: string; icon?: string } ) => unknown;
		getById?: ( id: string ) => unknown;
	};
	relations?: RelationsApi;
	files?: { registerType?: ( def: Record< string, unknown > ) => void };
	iframe?: {
		publish?: ( channel: string, payload?: unknown ) => void;
		subscribe?: ( channel: string, cb: ( payload: unknown ) => void ) => () => void;
	};
}

/**
 * A claim on an admin URL, so opening it routes to a native window.
 *
 * Without one, every path that opens `admin.php?page=allterrain-fields` — a dock
 * row, an in-window link, a Related-menu item, a bookmark — opens an *iframe of
 * the admin page*, which then mounts a second builder inside it. Two builders,
 * one of them in a frame, both editing the same group.
 */
export interface NativeUrlRemap {
	id: string;
	nativeWindowId: string;
	matches: ( url: string, parsed: URL ) => boolean;
	params?: ( url: string, parsed: URL ) => Record< string, string | number | boolean >;
}

/** A row in a system tile's hover menu. */
export interface SubmenuRow {
	title: string;
	url: string;
	onSelect?: () => void;
	windowId?: string;
}

export interface SystemTile {
	id: string;
	title: string;
	icon: string;
	order?: number;
	onOpen: () => void;
	isOpen?: () => boolean;
	submenu?: SubmenuRow[];
}

/** The identity record the shell stores per window. */
export interface ContentRef {
	type: string;
	id: number | string;
	root?: { type: string; id: number | string };
	links?: Array< { type: string; id: number | string; rel?: 'references' | 'child' } >;
	label?: string;
	related?: Array< {
		id: string;
		label: string;
		url: string;
		group?: string;
		groupLabel?: string;
		icon?: string;
		count?: number;
	} >;
}

export interface RelationsApi {
	set?: ( windowId: string, ref: ContentRef | null ) => void;
	get?: ( windowId: string ) => ContentRef | undefined;
	related?: ( windowId: string ) => string[];
	subscribe?: ( cb: () => void ) => () => void;
}

/** `wp.os.dragManager`, narrowed to what this plugin uses. */
export interface DragManagerApi {
	start( opts: DragStartOpts ): DragSession | null;
	registerDropTarget( target: DropTarget ): () => void;
	isDragging(): boolean;
	recentlyEndedDrag( withinMs?: number ): boolean;
}

export interface DragPayload {
	type: string;
	source: HTMLElement;
	data: Record< string, unknown >;
	ghost?: {
		element?: HTMLElement;
		offsetX: number;
		offsetY: number;
		hint?: { hidden?: boolean; accept?: string; reject?: string; neutral?: string };
	};
}

export interface DragSession {
	readonly payload: DragPayload;
	isFinished(): boolean;
	cancel( reason?: string ): void;
}

export interface DragStartOpts {
	payload: DragPayload;
	origin: PointerEvent;
	onClickOnly?: () => void;
	onCancel?: ( reason: string ) => void;
	onCommit?: ( target: DropTarget ) => void;
}

export interface DropTarget {
	id: string;
	element: HTMLElement;
	accept( payload: DragPayload ): boolean;
	onEnter?( session: DragSession ): void;
	onLeave?( session: DragSession ): void;
	onDrop( session: DragSession, ev: { clientX: number; clientY: number } ): void | Promise< void >;
	acceptLabel?: string;
}

/**
 * One thing the user dragged, flattened out of whichever shape carried it.
 *
 * The shell has two: `shortcut` is a reference to an entity, which is what a WP
 * Explorer tile emits; `desktop-file` is an existing wallpaper tile being moved.
 * Both reduce to a list of these, which is all the field runtime works in.
 */
export interface DroppedEntity {
	/** File-type slug — `post`, `page`, `attachment`, `user`, plugin-defined. */
	kind: string;
	/** The entity's id, as the source spelled it. */
	ref: string;
	/** Human-readable label, when the source carried one. */
	title: string;
	/** A thumbnail URL, when the source carried one. */
	thumbnail?: string;
}
