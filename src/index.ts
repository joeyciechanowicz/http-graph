import {readFile, writeFile} from 'fs';
import util from 'util';
import puppeteer from 'puppeteer';
import {CDPSession, Network} from './chrome-devtools-protocol';

type DataLengths = { [requestId: string]: Network.LoadingFinishedParams };

export interface TreeNode {
	requestId: string;
	url: string;
	method: string;
	encodedBytes: number;
	type: Network.ResourceType;
	// params: Network.RequestWillBeSentParams;
	frameId: string;

    children: TreeNode[];
}

function createNode(params: Network.RequestWillBeSentParams, size: Network.LoadingFinishedParams): TreeNode {
	return {
		requestId: params.requestId,
		url: params.request.url,
		method: params.request.method,
		type: params.type,
		encodedBytes: size?.encodedDataLength,
		frameId: params.frameId,
		// params,
		children: []
	};
}

function convertToTree(requestParams: Network.RequestWillBeSentParams[], additionalData: DataLengths): TreeNode {
	const initialRequest = requestParams[0];

    const tree: TreeNode = createNode(initialRequest, additionalData[initialRequest.requestId]);

    const pointers: { [url: string]: TreeNode } = {
		[initialRequest.request.url]: tree
    };

    // Request[0] is our initiating requestParams
    for (let i = 1; i < requestParams.length; i++) {
        const params = requestParams[i];

        if (params.redirectResponse && params.redirectResponse.url) {
			const parent = pointers[params.redirectResponse.url];
			const length = parent.children.push(createNode(params, additionalData[params.requestId]));
			pointers[params.request.url] = parent.children[length - 1];

        	continue;
		}

        if (params.initiator.type === 'script') {
            const initiator = params.initiator as Network.Initiator;
            // We have a JS loaded request
            // we iterate the stack till we can find a child we can attach this request to
            let found = false;
            for (let stackIndex = 0; stackIndex < initiator.stack.callFrames.length; stackIndex++) {
                const frame = initiator.stack.callFrames[stackIndex];
                if (pointers[frame.url]) {
                	const parent = pointers[frame.url];
					const length = parent.children.push(createNode(params, additionalData[params.requestId]));
                    pointers[params.request.url] = parent.children[length - 1];

                    found = true;
                    break;
                }
            }

            if (!found) {
                console.error(`Could not find a parent for script request`, params);
            }
        } else if (params.initiator.type === 'parser') {
            const initiator = params.initiator as Network.Initiator;

			const parent = pointers[initiator.url];
			if (!parent) {
                console.error(`Got initiator with no pointer set: ${initiator}`);
                continue;
            }

            const length = parent.children.push(createNode(params, additionalData[params.requestId]));
            pointers[params.request.url] = parent.children[length - 1];
        } else {
            console.error(`Unsupported initiator type "${params.initiator.type}"`, util.inspect(params));
        }
    }

    return tree;
}

export function prettyPrintTree(filename: string, tree: TreeNode): Promise<void> {
	return new Promise((resolve, reject) => {
		readFile(__dirname + '/graph-template.html', (err, data) => {
			if (err) {
				return reject(err);
			}

			const str = data.toString()
				.replace('$url', tree.url)
				.replace('$data', JSON.stringify(tree));

			writeFile(filename, str, (writeErr) => {
				if (err) {
					return reject(writeErr);
				}
				resolve();
			});
		});
	});
}


export async function graphUrl(url: string): Promise<{ tree: TreeNode, totalRequests: number }> {
    const requests: Network.RequestWillBeSentParams[] = [];
    const dataLengths: DataLengths = {};

    const browser = await puppeteer.launch({
        headless: true
    });

    const page = await browser.newPage();
    const client = await page.target().createCDPSession() as CDPSession;
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', {cacheDisabled: true});
    await client.send('Network.setBypassServiceWorker', {bypass: true});

	client.on('Network.loadingFinished', (params) => {
		dataLengths[params.requestId] = params;
	});

    // Fired BEFORE (some) of the requests are sent
    client.on('Network.requestWillBeSent', (params: Network.RequestWillBeSentParams) => {
        switch (params.type) {
			case 'Stylesheet':
				break;
			case 'Image':
				break;
			case 'Media':
				break;
			case 'Font':
				break;
			case 'Script':
				break;
			case 'TextTrack':
				break;
			case 'XHR':
				break;
			case 'Fetch':
				break;
			case 'EventSource':
				break;
			case 'WebSocket':
				break;
			case 'Manifest':
				break;
			case 'SignedExchange':
				break;
			case 'Ping':
				break;
			case 'CSPViolationReport':
				break;

			case 'Document': {
				break;
			}

			case 'Other': {
				break;
			}
			default: {
				throw new TypeError(`Unhandled request type ${params.type}`);
			}
        }

		requests.push(params);
    });

    await page.goto(url, {
        waitUntil: 'networkidle0'
    });

    await browser.close();

    const tree = convertToTree(requests, dataLengths);

    return {
        tree,
        totalRequests: requests.length
    };
}
