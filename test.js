import test from 'ava';
import delay from 'delay';
import inRange from 'in-range';
import timeSpan from 'time-span';
import randomInt from 'random-int';
import m from '.';

test('concurrency: 1', async t => {
	const input = [
		[10, 300],
		[20, 200],
		[30, 100]
	];

	const end = timeSpan();
	const limit = m(1);
	const mapper = ([val, ms]) => limit(() => delay(ms).then(() => val));

	t.deepEqual(await Promise.all(input.map(mapper)), [10, 20, 30]);
	t.true(inRange(end(), 590, 650));
});

test('concurrency: 4', async t => {
	const concurrency = 5;
	let running = 0;

	const limit = m(concurrency);

	const input = Array.from({length: 100}, () => limit(async () => {
		running++;
		t.true(running <= concurrency);
		await delay(randomInt(30, 200));
		running--;
	}));

	await Promise.all(input);
});

test('non-promise returning function', async t => {
	await t.notThrowsAsync(async () => {
		const limit = m(1);
		await limit(() => null);
	});
});

test('continues after sync throw', async t => {
	const limit = m(1);
	let ran = false;

	const promises = [
		limit(() => {
			throw new Error('err');
		}),
		limit(() => {
			ran = true;
		})
	];

	await Promise.all(promises).catch(() => {});

	t.is(ran, true);
});

test('accepts additional arguments', async t => {
	const limit = m(1);
	const symbol = Symbol('test');

	await limit(a => t.is(a, symbol), symbol);
});

test('does not ignore errors', async t => {
	const limit = m(1);
	const error = new Error('🦄');

	const promises = [
		limit(async () => {
			await delay(30);
		}),
		limit(async () => {
			await delay(80);
			throw error;
		}),
		limit(async () => {
			await delay(50);
		})
	];

	await t.throwsAsync(Promise.all(promises), {is: error});
});

test('test values of activeCount and pendingCount', async t => {
	const limit = m(5);
	t.is(limit.activeCount, 0);
	t.is(limit.pendingCount, 0);

	const runningPromise1 = limit(() => delay(1000));
	t.is(limit.activeCount, 1);
	t.is(limit.pendingCount, 0);

	await runningPromise1;
	t.is(limit.activeCount, 0);
	t.is(limit.pendingCount, 0);

	const immediatePromises = Array.from({length: 5}, () => limit(() => delay(1000)));
	const delayedPromises = Array.from({length: 3}, () => limit(() => delay(1000)));

	t.is(limit.activeCount, 5);
	t.is(limit.pendingCount, 3);

	await Promise.all(immediatePromises);
	t.is(limit.activeCount, 3);
	t.is(limit.pendingCount, 0);

	await Promise.all(delayedPromises);

	t.is(limit.activeCount, 0);
	t.is(limit.pendingCount, 0);
});
