/**
 * What every function means, written for somebody who has never used a
 * spreadsheet in anger.
 *
 * Its own file because two things render it — the formula window and the in-page
 * dialog that stands in for it with no shell — and a reference that existed
 * twice would drift, in the way that a reference nobody notices drifting always
 * does. The tests assert that every registered function has an entry.
 *
 * The writing rules, which matter more here than anywhere else in the plugin:
 *
 * - **Every parameter is named and explained.** A signature is only
 *   documentation to somebody who already knows what the parameters mean.
 *   `if(test, then, otherwise)` says nothing about what may go in `test`, and
 *   that is the entire difficulty of the function.
 * - **Every example is a use, with its answer.** `pct({price} - {cost},
 *   {price})` → *25 for a price of 120 and a cost of 90*. A reference whose
 *   examples are all `f(1, 2)` teaches the syntax and none of the point.
 * - **The gotcha gets its own line.** `int` against `floor` on negatives, `pct`
 *   being safe at zero. These are the things that are not obvious until they
 *   bite.
 */

/** Everything a person needs to use one function. */
export interface FunctionDoc {
	/** How it is written, with the parameters named. */
	signature: string;
	/** What it does, in one sentence, to somebody who has never used a spreadsheet. */
	what: string;
	/** Each parameter, named and explained. */
	params: Array< { name: string; what: string } >;
	/** A use, and what it comes out as. */
	example: { formula: string; gives: string };
	/** The thing that is not obvious until it bites. Optional. */
	note?: string;
}

/**
 * The reference.
 *
 * Written out in full, per parameter, because the previous version was a
 * signature and a sentence — and a signature is only documentation to somebody
 * who already knows what the parameters mean. `if(test, then, otherwise)` tells
 * you nothing about what may go in `test`, which is the entire difficulty of
 * that function and the one place people give up.
 *
 * Every example is a **use** with its answer, not a demonstration:
 * `pct({price} - {cost}, {price})` → `25`, not `pct(1, 2)`. A reference whose
 * examples are all `f(1, 2)` teaches the syntax and none of the point.
 */
export const DOCS: Record< string, FunctionDoc > = {
	min: {
		signature: 'min(a, b, …)',
		what: 'Gives you the smallest of the numbers you list.',
		params: [ { name: 'a, b, …', what: 'As many numbers, number fields or repeater columns as you like.' } ],
		example: { formula: 'min({list_price}, {sale_price})', gives: 'the lower of the two prices' },
	},
	max: {
		signature: 'max(a, b, …)',
		what: 'Gives you the largest of the numbers you list.',
		params: [ { name: 'a, b, …', what: 'As many numbers, number fields or repeater columns as you like.' } ],
		example: { formula: 'max({stock}, 0)', gives: 'the stock level, but never below zero' },
	},
	sum: {
		signature: 'sum(a, b, …)',
		what: 'Adds everything up.',
		params: [
			{
				name: 'a, b, …',
				what: 'Any mixture of numbers, number fields, and repeater columns — separated by commas. A repeater column is written {repeater.field} and stands for that field in every row.',
			},
		],
		example: { formula: 'sum({lines.amount})', gives: 'the total of the Amount column across every row' },
		note: 'Three at once is fine: sum({subtotal}, {delivery}, {lines.surcharge}).',
	},
	avg: {
		signature: 'avg(a, b, …)',
		what: 'The average — everything added up, divided by how many there were.',
		params: [ { name: 'a, b, …', what: 'Numbers, number fields or repeater columns.' } ],
		example: { formula: 'avg({reviews.stars})', gives: 'the average rating across every review row' },
	},
	count: {
		signature: 'count(a, b, …)',
		what: 'How many there are — rows in a repeater, or things you listed.',
		params: [ { name: 'a, b, …', what: 'Usually one repeater column: count({lines.amount}) is the number of rows.' } ],
		example: { formula: 'round(sum({lines.amount}) / count({lines.amount}), 2)', gives: 'the average line, worked out the long way' },
		note: 'A plain field counts as one. This is how you get “per row” figures that avg() does not give you.',
	},
	median: {
		signature: 'median(a, b, …)',
		what: 'The middle number once they are sorted.',
		params: [ { name: 'a, b, …', what: 'Numbers, number fields or repeater columns.' } ],
		example: { formula: 'median({price_a}, {price_b}, {price_c})', gives: '250000 for 180000, 250000 and 320000' },
		note: 'Use this instead of the average when one very high or very low number would drag the answer somewhere unhelpful.',
	},
	product: {
		signature: 'product(a, b, …)',
		what: 'Multiplies everything together.',
		params: [ { name: 'a, b, …', what: 'Numbers, number fields or repeater columns.' } ],
		example: { formula: 'product({qty}, {unit_price}, 1.21)', gives: '36.3 for 3 at 10.00 plus 21% tax' },
	},
	round: {
		signature: 'round(number, places)',
		what: 'Rounds a number.',
		params: [
			{ name: 'number', what: 'What to round.' },
			{ name: 'places', what: 'How many decimal places to keep. Leave it off for a whole number.' },
		],
		example: { formula: 'round({price} * 1.21, 2)', gives: '121.00 for a price of 100' },
	},
	floor: {
		signature: 'floor(number)',
		what: 'Rounds down, always — even at .99.',
		params: [ { name: 'number', what: 'What to round down.' } ],
		example: { formula: 'floor({minutes} / 60)', gives: '2 for 155 minutes — whole hours only' },
	},
	ceil: {
		signature: 'ceil(number)',
		what: 'Rounds up, always — even at .01. How many boxes you need.',
		params: [ { name: 'number', what: 'What to round up.' } ],
		example: { formula: 'ceil({items} / 12)', gives: '3 for 25 items in boxes of 12' },
	},
	int: {
		signature: 'int(number)',
		what: 'Drops the decimals and keeps the whole number.',
		params: [ { name: 'number', what: 'What to cut down.' } ],
		example: { formula: 'int({total_hours})', gives: '7 for 7.8' },
		note: 'Different from floor on negatives: int(−4.9) is −4, floor(−4.9) is −5. int always moves toward zero.',
	},
	abs: {
		signature: 'abs(number)',
		what: 'Throws away the minus sign, so you get the size of a difference without its direction.',
		params: [ { name: 'number', what: 'The number, positive or negative.' } ],
		example: { formula: 'abs({budget} - {spent})', gives: '50 whether you are 50 over or 50 under' },
	},
	sign: {
		signature: 'sign(number)',
		what: 'Tells you which way something went: 1 for up, −1 for down, 0 for no change.',
		params: [ { name: 'number', what: 'Usually a difference between two fields.' } ],
		example: { formula: 'sign({price_now} - {price_was})', gives: '−1 when the price has come down' },
	},
	sqrt: {
		signature: 'sqrt(number)',
		what: 'The square root — the number that, times itself, gives you this one.',
		params: [ { name: 'number', what: 'What to take the root of.' } ],
		example: { formula: 'sqrt({area})', gives: '12 for an area of 144 — the side of a square' },
	},
	pow: {
		signature: 'pow(number, power)',
		what: 'Multiplies a number by itself, a given number of times.',
		params: [
			{ name: 'number', what: 'The number to raise.' },
			{ name: 'power', what: 'How many times. 2 squares it, 3 cubes it, 0.5 gives the square root.' },
		],
		example: { formula: 'pow({side}, 2)', gives: '25 for a side of 5 — the area of a square' },
		note: 'The ^ symbol does exactly the same thing: {side} ^ 2.',
	},
	mod: {
		signature: 'mod(number, divide_by)',
		what: 'The remainder left over after dividing.',
		params: [
			{ name: 'number', what: 'What to divide.' },
			{ name: 'divide_by', what: 'What to divide it by.' },
		],
		example: { formula: 'mod({position}, 2)', gives: '0 on even positions, 1 on odd ones' },
		note: 'The usual reason to want this is “every other one” or “every third one”.',
	},
	clamp: {
		signature: 'clamp(number, lowest, highest)',
		what: 'Keeps a number inside a range — never below the lowest, never above the highest.',
		params: [
			{ name: 'number', what: 'The value to keep in range.' },
			{ name: 'lowest', what: 'The smallest it is allowed to be.' },
			{ name: 'highest', what: 'The largest it is allowed to be.' },
		],
		example: { formula: 'clamp({stock}, 0, 999)', gives: '0 when the stock has gone negative' },
	},
	pct: {
		signature: 'pct(part, whole)',
		what: 'Works out what percentage the part is of the whole.',
		params: [
			{ name: 'part', what: 'The smaller amount — the bit you are measuring.' },
			{ name: 'whole', what: 'The total it is a part of.' },
		],
		example: { formula: 'pct({price} - {cost}, {price})', gives: '25 for a price of 120 and a cost of 90' },
		note: 'Safe when the whole is zero: you get 0 rather than an error. Writing part / whole * 100 by hand is not.',
	},
	if: {
		signature: 'if(test, then, otherwise)',
		what: 'Asks a question and gives you one of two answers depending on the result.',
		params: [
			{
				name: 'test',
				what: 'A comparison. Use  >  <  >=  <=  ==  (is equal to) or  !=  (is not equal to). Join two with && for “both” or || for “either”.',
			},
			{ name: 'then', what: 'What to use when the test is true.' },
			{ name: 'otherwise', what: 'What to use when it is not. This one is not optional.' },
		],
		example: { formula: 'if({qty} > 10, {price} * 0.9, {price})', gives: '10% off once somebody orders more than ten' },
		note: 'Two tests at once: if({qty} > 10 && {member} == 1, {price} * 0.8, {price}).',
	},
};

/**
 * What a formula can read.
 *
 * The question everybody asks first and the reference had no place to answer:
 * *what can `sum` sum?* A list of functions describes what each one does with
 * its arguments and says nothing about what may be an argument — which is the
 * part that is not guessable.
 */
export const READS: Array< { what: string; how: string } > = [
	{
		what: 'A number field in this group',
		how: '{price} — write the field’s name in braces. It is the name under the label on the card, not the label.',
	},
	{
		what: 'A switch',
		how: '{in_stock} — on counts as 1, off as 0. So {price} * {in_stock} is the price, or nothing.',
	},
	{
		what: 'Another computed field',
		how: '{subtotal} — worked out first, then used. Two computed fields cannot read each other, though.',
	},
	{
		what: 'A whole repeater column',
		how: '{lines.amount} — the Amount field from every row. Give it to sum(), avg(), min(), max() or count().',
	},
	{
		what: 'A field inside a group',
		how: '{address.postcode} — the same dotted form. A group is one row, so it is one value.',
	},
	{
		what: 'Anything that is not a number',
		how: 'Counts as 0 — a date, an image, an empty field. Nothing breaks; the sum is just smaller.',
	},
];

/** Operators, which no function list would ever mention and everybody needs. */
export const OPERATORS: Array< { symbol: string; what: string } > = [
	{ symbol: '+  −  *  /', what: 'Add, subtract, multiply, divide.' },
	{ symbol: '( )', what: 'Do this bit first. {a} + {b} * 2 is not the same as ({a} + {b}) * 2.' },
	{ symbol: '^', what: 'To the power of. {side} ^ 2 is {side} squared.' },
	{ symbol: '%', what: 'The remainder after dividing. Same as mod().' },
	{ symbol: '>  <  >=  <=', what: 'Bigger than, smaller than, and the “or equal to” versions. For use inside if().' },
	{ symbol: '==  !=', what: 'Is equal to, is not equal to. Two equals signs, not one.' },
	{ symbol: '&&  ||', what: '“And” and “or”, for joining two tests inside if().' },
];
