import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function loadNamedFunctionFromSource(filePath, functionName) {
	const source = fs.readFileSync(filePath, 'utf8');
	const signature = `function ${functionName}(`;
	const start = source.indexOf(signature);

	if (start === -1) {
		throw new Error(`Function ${functionName} not found in ${filePath}`);
	}

	const endMarker = 'let userID =';
	const end = source.indexOf(endMarker, start);

	if (end === -1) {
		throw new Error(`Function ${functionName} in ${filePath} does not end before ${endMarker}`);
	}

	return (0, eval)(`(${source.slice(start, end)})`);
}

const pruneEmptyClashGroups = loadNamedFunctionFromSource(
	new URL('../vpn.js', import.meta.url),
	'pruneEmptyClashGroups',
);

test('removes empty flag groups and cleans selector references', () => {
	const input = `proxy-groups:
  - {name: 🚀 节点选择, type: select, proxies: [♻️ 自动选择, 🇨🇳 中国, 🇺🇸 美国, DIRECT]}
  - {name: ♻️ 自动选择, type: url-test, proxies: [🇨🇳 中国, 🇺🇸 美国], url: http://www.gstatic.com/generate_204, interval: 300}
  - {name: 🇨🇳 中国, type: load-balance, proxies: [DIRECT], url: http://www.gstatic.com/generate_204, interval: 300}
  - {name: 🇺🇸 美国, type: load-balance, proxies: [US-1], url: http://www.gstatic.com/generate_204, interval: 300}
proxies:
  - {name: US-1, type: ss, server: example.com, port: 443, cipher: aes-128-gcm, password: pass}`;

	const output = pruneEmptyClashGroups(input);

	assert.equal(output.includes('name: 🇨🇳 中国'), false);
	assert.match(output, /name: 🚀 节点选择/);
	assert.equal(output.includes('🇨🇳 中国, 🇺🇸 美国'), false);
	assert.match(output, /proxies: \[♻️ 自动选择, 🇺🇸 美国, DIRECT\]/);
	assert.match(output, /proxies: \[🇺🇸 美国\]/);
});

test('removes selectors that become empty after group pruning', () => {
	const input = `proxy-groups:
  - {name: ♻️ 自动选择, type: url-test, proxies: [🇨🇳 中国], url: http://www.gstatic.com/generate_204, interval: 300}
  - {name: 🇨🇳 中国, type: load-balance, proxies: [DIRECT], url: http://www.gstatic.com/generate_204, interval: 300}
proxies: []`;

	const output = pruneEmptyClashGroups(input);

	assert.equal(output.includes('name: ♻️ 自动选择'), false);
	assert.equal(output.includes('name: 🇨🇳 中国'), false);
});

test('removes empty block-style groups and cleans parent references', () => {
	const input = `proxy-groups:
  - name: 🚀 节点选择
    type: select
    proxies:
      - ♻️ 自动选择
      - 🇨🇳 中国
      - 🇯🇵 日本
      - DIRECT
  - name: ♻️ 自动选择
    type: url-test
    url: http://www.gstatic.com/generate_204
    interval: 300
    proxies:
      - 🇨🇳 中国
      - 🇯🇵 日本
  - name: 🇨🇳 中国
    type: load-balance
    strategy: consistent-hashing
    url: http://www.gstatic.com/generate_204
    interval: 300
    proxies:
      - DIRECT
  - name: 🇯🇵 日本
    type: load-balance
    strategy: consistent-hashing
    url: http://www.gstatic.com/generate_204
    interval: 300
    proxies:
      - JP-1
proxies:
  - {name: JP-1, type: ss, server: example.com, port: 443, cipher: aes-128-gcm, password: pass}`;

	const output = pruneEmptyClashGroups(input);

	assert.equal(output.includes('name: 🇨🇳 中国'), false);
	assert.match(output, /- name: 🚀 节点选择/);
	assert.match(output, /- name: ♻️ 自动选择/);
	assert.equal(output.includes('      - 🇨🇳 中国'), false);
	assert.match(output, /      - ♻️ 自动选择\n      - 🇯🇵 日本\n      - DIRECT/);
	assert.match(output, /    proxies:\n      - 🇯🇵 日本/);
});
