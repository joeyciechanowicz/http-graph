const util = require('util');
const puppeteer = require('puppeteer');
const treeify = require('treeify');

async function graphUrl(url) {
	const browser = await puppeteer.launch({
		headless: true
	});

	// // ChromeDevTools/devtools-protocol#56
	// // increase CallStackDepth to fix initiator stack issue in chrome
	// const client = await page.target().createCDPSession();
	// await client.send('Debugger.enable');
	// await client.send('Debugger.setAsyncCallStackDepth', { maxDepth: 32 });

	const page = await browser.newPage();
	const client = await page.target().createCDPSession();
	await client.send('Network.enable');

	let count = 0;
	const requests = [];
	let badUrls = [];

	await page.setRequestInterception(true);
	page.on('request', (request) => {
		if (badUrls.indexOf(request.url()) !== -1) {
			requests.push({
				url: request.url(),
				initiator: {
					type: 'parser',
					url: request.frame().url()
				}
			});
		}
		request.continue();
	});

	page.on('response', async (response) => {
		if (response.status() === 200) {
			const buffer = await response.buffer();
			const index = requests.indexOf(response.url());
			if (index !== -1) {
				requests[response.url()].size = buffer.length;
			}
		}
	});

	client.on('Network.requestWillBeSent', (params) => {
		if (params.initiator.type === 'other' && params.request.url !== url) {
			badUrls.push(params.request.url);
		} else {
			requests.push({
				url: params.request.url,
				initiator: params.initiator
			});
		}

		count++;
	});

	await page.goto(url, {
		waitUntil: 'networkidle0'
	});
	await browser.close();

	console.log(count);

	const graph = {
		[url]: {
			children: {}
		}
	};

	const pointers = {};
	pointers[url] = graph[url];

	// Request[0] is our initiating requests
	for (let i = 1; i < requests.length; i++) {
		const request = requests[i];
		if (request.initiator.type === 'script') {
			// We have a JS loaded request
			// we iterate the stack till we can find a child we can attach this request to
			let found = false;
			for (let stackIndex = 0; stackIndex < request.initiator.stack.callFrames.length; stackIndex++) {
				const frame = request.initiator.stack.callFrames[stackIndex];
				if (pointers[frame.url]) {
					if (request.url.startsWith('data:application/font-woff;base64')) {
						pointers[frame.url].children[request.url.substr(0, 'data:application/font-woff;base64'.length + 20)] = {
							size: request.size,
							children: {}
						};
					} else if (request.url.startsWith('data:image/svg+xml;base64')) {
						pointers[frame.url].children[request.url.substr(0, 'data:image/svg+xml;base64,'.length + 20)] = {
							size: request.size,
							children: {}
						};
					} else if (request.url.startsWith('data:image/svg+xml;charset=utf-8')) {
						pointers[frame.url].children[request.url.substr(0, 'data:image/svg+xml;charset=utf-8,'.length + 20)] = {
							size: request.size,
							children: {}
						};
					} else if (request.url.startsWith('data:image/png;base64')) {
						pointers[frame.url].children[request.url.substr(0, 'data:image/png;base64,'.length + 20)] = {
							size: request.size,
							children: {}
						};
					} else if (request.url.startsWith('data:image/svg+xml;charset=utf8')) {
						pointers[frame.url].children[request.url.substr(0, 'data:image/svg+xml;charset=utf8,'.length + 20)] = {
							size: request.size,
							children: {}
						};
					} else {
						pointers[frame.url].children[request.url] = {
							size: request.size,
							children: {}
						};
						pointers[request.url] = pointers[frame.url].children[request.url];
					}

					found = true;
					break;
				}
			}

			if (!found) {
				console.error(`Could not find a parent for script request`, request);
			}
		} else if (request.initiator.type === 'parser') {
			const initiator = request.initiator.url;
			if (!pointers[initiator]) {
				console.error(`Got initiator with no pointer set: ${initiator}`);
				continue;
			}

			pointers[initiator].children[request.url] = {
				size: request.size,
				children: {}
			};
			pointers[request.url] = pointers[initiator].children[request.url];
		} else {
			console.error(`Unsupported initiator type "${request.initiator.type}"`, util.inspect(request));
		}
	}

	console.log("\n\n\n");
	console.log(treeify.asTree(graph, true));
}

module.exports = {
	graphUrl
};
