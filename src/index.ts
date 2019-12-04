import util from 'util';
import puppeteer from 'puppeteer';

enum RequestType {
	Redirect,
	Request
}

interface Initiator {
	type: string;
}

interface ParserInitiator extends Initiator {
	url: string;
}

interface ScriptInitiator extends Initiator {
	stack: {
		callFrames: any[];
	};
}

interface Request {
	url: string;
	requestId: string;
	initiator: ParserInitiator | ScriptInitiator;
	type: RequestType;
}

interface Redirect extends Request{
	redirectLocation: string;
}

interface ResponseStat {
	status: number;
	size: number;
}

interface BadUrl {
	url: string;
	requestId: string;
}

type AdditionalData = {[key: string]: ResponseStat};

export type Tree = {[url: string]: TreeNode};

interface TreeNode {
	url: string;
	status: number;
	size: number;
	children: {[url: string]: TreeNode};
}

function convertToTree(rootUrl: string, requests: Request[], additionalData: AdditionalData): Tree {
	const tree: Tree = {
		[rootUrl]: {
			...additionalData[rootUrl],
			url: rootUrl,
			children: {}
		}
	};

	const pointers: {[url: string]: TreeNode} = {
		[rootUrl]: tree[rootUrl]
	};
	// pointers[rootUrl] = tree[rootUrl];

	// Request[0] is our initiating requests
	for (let i = 1; i < requests.length; i++) {
		const request = requests[i];
		if (request.initiator.type === 'script') {
			const initiator = request.initiator as ScriptInitiator;
			// We have a JS loaded request
			// we iterate the stack till we can find a child we can attach this request to
			let found = false;
			for (let stackIndex = 0; stackIndex < initiator.stack.callFrames.length; stackIndex++) {
				const frame = initiator.stack.callFrames[stackIndex];
				if (pointers[frame.url]) {
					pointers[frame.url].children[request.url] = {
						...additionalData[request.url],
						url: request.url,
						children: {}
					};
					pointers[request.url] = pointers[frame.url].children[request.url];

					found = true;
					break;
				}
			}

			if (!found) {
				console.error(`Could not find a parent for script request`, request);
			}
		} else if (request.initiator.type === 'parser') {
			const initiator = request.initiator as ParserInitiator;
			if (!pointers[initiator.url]) {
				console.error(`Got initiator with no pointer set: ${initiator}`);
				continue;
			}

			pointers[initiator.url].children[request.url] = {
				...additionalData[request.url],
				url: request.url,
				children: {}
			};
			pointers[request.url] = pointers[initiator.url].children[request.url];
		} else {
			console.error(`Unsupported initiator type "${request.initiator.type}"`, util.inspect(request));
		}
	}

	return tree;
}


export async function graphUrl(url: string): Promise<{tree: Tree, totalRequests: number}> {
	const browser = await puppeteer.launch({
		headless: true
	});

	const page = await browser.newPage();
	const client = await page.target().createCDPSession();
	await client.send('Network.enable');

	let count = 0;
	const requests: Request[] = [];

	const additionalData: AdditionalData = {};
	let badUrls: {[key: string]: BadUrl} = {};

	await page.setRequestInterception(true);

	// Intercept request that didn't have a in
	page.on('request', (request: puppeteer.Request) => {
		if (badUrls[request.url()]) {
			// TODO: Make this not type:any
			requests.push({
				url: request.url(),
				initiator: {
					type: 'parser',
					url: request.frame().url()
				}
			} as any);
		}
		request.continue();
	});

	// Fired when a network response is received
	// Read the response body and record the size
	page.on('response', async (response) => {
		const responseStats = {
			status: response.status(),
			size: -1
		};

		try {
			if (response.ok() && response.status() === 200) {
				const buffer = await response.buffer();
				responseStats.size = buffer.length;
			}
		} catch (e) {
			// If the request was aborted (for some reason) then it has no body, but the status is still
			// 200. don't really understand?!
			// anyway, we swallow the error
		}
		additionalData[response.url()] = responseStats;
	});

	// Fired BEFORE the request is sent
	client.on('Network.requestWillBeSent', (params) => {
		// TODO
		// Look at params.documentURL (that's the frame URL, which tells us if this is iframed requests)
		// If `initiator.type === other` then its quite often an image or font
		if (params.initiator.type === 'other' && params.request.url !== url) {
			if (params.url.indexOf('https://cm.g.doubleclick.net/pixel?google_cm&google_nid=krux_digital&google_hm=') !== -1) {
				var x = 5;
				// TODO: If params.redirectReponse is set, than we can use that as the initator
			}

			badUrls[params.request.url] = {
				url: params.request.url,
				requestId: params.requestId
			};

		} else {
			if (params.redirectResponse) {
				requests.push({
					url: params.request.url,
					requestId: params.requestId,
					initiator: params.initiator,
					type: RequestType.Redirect,
					redirectLocation: params.redirectResponse.url
				} as Redirect);
			} else {
				requests.push({
					url: params.request.url,
					requestId: params.requestId,
					initiator: params.initiator,
					type: RequestType.Request
				});
			}
		}

		count++;
	});

	await page.goto(url, {
		waitUntil: 'networkidle0'
	});

	await browser.close();

	const tree = convertToTree(url, requests, additionalData);

	return {
		tree,
		totalRequests: count
	};
}
