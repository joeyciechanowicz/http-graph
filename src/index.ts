import {readFile, writeFile} from 'fs';
import util from 'util';
import puppeteer from 'puppeteer';
import {CDPSession, Network} from './chrome-devtools-protocol';

type DataLengths = { [requestId: string]: Network.LoadingFinishedParams };
type Responses = { [requestId: string]: Network.ResponseReceivedParams };

export interface TreeNode {
    requestId: string;
    url: string;
    method: string;
    encodedBytes: number;
    type: Network.ResourceType;
    status: number;
    time: number;
    frameId: string;

    children: TreeNode[];
}

export interface Tree {
    root: TreeNode,
    totalNodes: number;
    totalBytes: number;
    /**
     * Array of the frame IDs
     */
    frameIDs: string[];
}

function createNode(params: Network.RequestWillBeSentParams, responseParams: Network.ResponseReceivedParams): TreeNode {
    // TODO: Add Initiator
    // responseParams do not seem to be correct for the request
    return {
        requestId: params.requestId,
        url: params.request.url,
        method: params.request.method,
        type: params.type,
        encodedBytes: responseParams.response.encodedDataLength,
        frameId: params.frameId,
        status: responseParams.response.status,
        time: responseParams.timestamp - responseParams.response.timing.requestTime,
        children: []
    };
}

function convertToTree(requestParams: Network.RequestWillBeSentParams[], responses: Responses): Tree {
    const initialRequest = requestParams[0];

    const tree: TreeNode = createNode(initialRequest, responses[initialRequest.requestId]);
    const frameIds = new Set<string>();
    let totalBytes = tree.encodedBytes;

    const pointers: { [url: string]: TreeNode } = {
        [initialRequest.request.url]: tree
    };

    // Request[0] is our initiating requestParams
    for (let i = 1; i < requestParams.length; i++) {
        const params = requestParams[i];
        frameIds.add(params.frameId);

        if (params.redirectResponse && params.redirectResponse.url) {
            const parent = pointers[params.redirectResponse.url];
            const node = createNode(params, responses[params.requestId]);
            const length = parent.children.push(node);
            pointers[params.request.url] = parent.children[length - 1];
            totalBytes += node.encodedBytes;

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
                    const node = createNode(params, responses[params.requestId]);
                    const length = parent.children.push(node);
                    pointers[params.request.url] = parent.children[length - 1];
                    totalBytes += node.encodedBytes;

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

            const length = parent.children.push(createNode(params, responses[params.requestId]));
            pointers[params.request.url] = parent.children[length - 1];
        } else {
            console.error(`Unsupported initiator type "${params.initiator.type}"`, util.inspect(params));
        }
    }

    return {
        root: tree,
        totalNodes: requestParams.length,
        totalBytes: totalBytes,
        frameIDs: Array.from(frameIds.keys())
    };
}

export function writeTreeToFile(filename: string, tree: Tree): Promise<void> {
    return new Promise((resolve, reject) => {
        writeFile(filename, JSON.stringify(tree), (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

export function renderTemplate(filename: string, tree: Tree, template: string): Promise<void> {
    return new Promise((resolve, reject) => {
        readFile(template, (err, data) => {
            if (err) {
                return reject(err);
            }

            const str = data.toString()
                .replace('$url', tree.root.url)
                .replace('$data', JSON.stringify(tree));

            writeFile(filename, str, (writeErr) => {
                if (writeErr) {
                    return reject(writeErr);
                }
                resolve();
            });
        });
    });
}

export async function graphUrl(url: string): Promise<Tree> {
    const requests: Network.RequestWillBeSentParams[] = [];
    // const dataLengths: DataLengths = {};
    const responses: Responses = {};

    const browser = await puppeteer.launch({
        headless: true
    });

    const page = await browser.newPage();
    const client = await page.target().createCDPSession() as CDPSession;
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', {cacheDisabled: true});
    await client.send('Network.setBypassServiceWorker', {bypass: true});

    // client.on('Network.loadingFinished', (params) => {
    // 	dataLengths[params.requestId] = params;
    // });

    client.on('Network.responseReceived', (params) => {
        responses[params.requestId] = params;
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

    return convertToTree(requests, responses);
}
