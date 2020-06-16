import {writeFile} from 'fs';
import puppeteer from 'puppeteer';
import {CDPSession, Network} from './chrome-devtools-protocol';

type DataLengths = { [requestId: string]: Network.LoadingFinishedParams };
type Responses = { [requestId: string]: Network.ResponseReceivedParams };
type Redirects = { [url: string]: Network.Response };

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
    totalRequests: number;
    totalBytes: number;
    /**
     * Array of the frame IDs
     */
    frameIDs: string[];
}

class ErrorWithPayload<T> extends Error {
    constructor(message: string, public readonly payload: T) {
        super(message);
    }
}

function createNode(params: Network.RequestWillBeSentParams, responseParams: Network.ResponseReceivedParams): TreeNode {
    // TODO: Add Initiator
    // responseParams do not seem to be correct for the request

    // this is the size of the http request
    let size = responseParams.response.encodedDataLength;
    if (responseParams.response.headers['Content-Length']) {
        // we have content so need to add the size of it to the size of our HTTP request
        size += parseInt(responseParams.response.headers['Content-Length']);
    }

    return {
        requestId: params.requestId,
        url: params.request.url,
        method: params.request.method,
        type: params.type,
        encodedBytes: size,
        frameId: params.frameId,
        status: responseParams.response.status,
        time: responseParams.timestamp - responseParams.response.timing.requestTime,
        children: []
    };
}

function convertToTree(requestParams: Network.RequestWillBeSentParams[], responses: Responses, redirects: Redirects): Tree {
    const initialRequest = requestParams[0];

    const tree: TreeNode = createNode(initialRequest, responses[initialRequest.requestId]);
    const frameIds = new Set<string>();
    let totalBytes = tree.encodedBytes;

    const pointers: { [url: string]: TreeNode } = {
        [initialRequest.request.url]: tree
    };

    function getParent(initiator: Network.Initiator): TreeNode {
        switch (initiator.type) {
            case 'parser': {
                return pointers[initiator.url];
            }
            case 'script': {
                // We have a JS loaded request
                // we iterate the stack till we can find a child we can attach this request to
                for (let stackIndex = 0; stackIndex < initiator.stack.callFrames.length; stackIndex++) {
                    const frame = initiator.stack.callFrames[stackIndex];
                    if (pointers[frame.url]) {
                        return pointers[frame.url];
                    }
                }
            }
        }

        throw new ErrorWithPayload('Could not locate a parent for initiator', initiator);
    }

    function addResponseToTree(params: Network.RequestWillBeSentParams, response: Network.ResponseReceivedParams) {
        const parent = getParent(params.initiator as Network.Initiator);

        const node = createNode(params, responses[params.requestId]);
        const length = parent.children.push(node);
        pointers[params.request.url] = parent.children[length - 1];
        totalBytes += node.encodedBytes;
    }

    function addRedirectToTree(params: Network.RequestWillBeSentParams, redirect: Network.Response) {

    }

    // Request[0] is our initiating requestParams
    for (let i = 1; i < requestParams.length; i++) {
        const params = requestParams[i];
        frameIds.add(params.frameId);

        if (redirects[params.request.url]) {
            addRedirectToTree(params, redirects[params.requestId]);
            continue;
        }

        if (responses[params.requestId]) {
            addResponseToTree(params, responses[params.requestId]);
            continue;
        }

        throw new ErrorWithPayload('No response or redirect for request', params);

        //
        //
        // if (params.redirectResponse && params.redirectResponse.url) {
        //     const parent = pointers[params.redirectResponse.url];
        //     const node = createNode(params, responses[params.requestId]);
        //     const length = parent.children.push(node);
        //     pointers[params.request.url] = parent.children[length - 1];
        //     totalBytes += node.encodedBytes;
        //
        //     continue;
        // }
        //
        // if (params.initiator.type === 'script') {
        //     const initiator = params.initiator as Network.Initiator;
        //     // We have a JS loaded request
        //     // we iterate the stack till we can find a child we can attach this request to
        //     let found = false;
        //     for (let stackIndex = 0; stackIndex < initiator.stack.callFrames.length; stackIndex++) {
        //         const frame = initiator.stack.callFrames[stackIndex];
        //         if (pointers[frame.url]) {
        //             const parent = pointers[frame.url];
        //             const node = createNode(params, responses[params.requestId]);
        //             const length = parent.children.push(node);
        //             pointers[params.request.url] = parent.children[length - 1];
        //             totalBytes += node.encodedBytes;
        //
        //             found = true;
        //             break;
        //         }
        //     }
        //
        //     if (!found) {
        //         console.error(`Could not find a parent for script request`, params);
        //     }
        // } else if (params.initiator.type === 'parser') {
        //     const initiator = params.initiator as Network.Initiator;
        //
        //     const parent = pointers[initiator.url];
        //     if (!parent) {
        //         console.error(`Got initiator with no pointer set: ${initiator}`);
        //         continue;
        //     }
        //
        //     const node = createNode(params, responses[params.requestId]);
        //     const length = parent.children.push(node);
        //     pointers[params.request.url] = parent.children[length - 1];
        //     totalBytes += node.encodedBytes;
        // } else {
        //     console.error(`Unsupported initiator type "${params.initiator.type}"`, util.inspect(params));
        // }

    }

    return {
        root: tree,
        totalRequests: requestParams.length,
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

export async function graphUrl(url: string): Promise<Tree> {
    const requests: Network.RequestWillBeSentParams[] = [];
    // const dataLengths: DataLengths = {};
    const responses: Responses = {};

    const redirects: Redirects = {};

    const browser = await puppeteer.launch({
        headless: true
    });

    const page = await browser.newPage();
    const client = await page.target().createCDPSession() as CDPSession;

    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', {cacheDisabled: true});
    await client.send('Network.setBypassServiceWorker', {bypass: true});

    // Fired when a response is received from the server. We don't receive response for redirects
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

        if (params.redirectResponse) {
            // we'll emit a fake responseReceived event
            redirects[params.redirectResponse.url] = params.redirectResponse;
            client.emit('Network.responseReceived', {
                requestId: 'asd'
            } as Network.ResponseReceivedParams);
        }
    });

    await page.goto(url, {
        waitUntil: 'networkidle0'
    });

    await browser.close();

    return convertToTree(requests, responses, redirects);
}
