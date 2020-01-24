import {Runtime} from 'inspector';
import {EventEmitter} from 'events';

// Docs for CDP
// https://chromedevtools.github.io/devtools-protocol/tot/Network

export namespace Network {
    export type ResourceType =
        'Document'
        | 'Stylesheet'
        | 'Image'
        | 'Media'
        | 'Font'
        | 'Script'
        | 'TextTrack'
        | 'XHR'
        | 'Fetch'
        | 'EventSource'
        | 'WebSocket'
        | 'Manifest'
        | 'SignedExchange'
        | 'Ping'
        | 'CSPViolationReport'
        | 'Other';

    interface Request {
        /**
         * Request URL (without fragment)
         */
        url: string;
        /**
         * Fragment of the requested URL starting with hash, if present
         */
        urlFragment?: string;
        /**
         * HTTP request method
         */
        method: string;
        /**
         * HTTP request headers
         */
        headers: any;
        /**
         * HTTP POST request data
         */
        postData?: string;
        /**
         * True when the request has POST data. Note that postData might still be omitted when this flag is true when the data is too long
         */
        hasPostData?: boolean;
        /**
         * The mixed content type of the request
         */
        mixedContentType?: unknown;
        /**
         * Priority of the resource request at the time request is sent
         */
        initialPriority: 'VeryLow' | 'Low' | 'Medium' | 'High' | 'VeryHigh';
        /**
         * The referrer policy of the request, as defined in https://www.w3.org/TR/referrer-policy/
         */
        referrerPolicy: 'unsafe-url' | 'no-referrer-when-downgrade' | 'no-referrer' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin';
        /**
         * Whether is loaded via link preload
         */
        isLinkPreload?: boolean;
    }

    interface ResourceTiming {
        /**
         * Timing's requestTime is a baseline in seconds, while the other numbers are ticks in milliseconds relatively to this requestTime.
         */
        requestTime: number;

        /**
         * Started resolving proxy.
         */
        proxyStart: number;

        /**
         * Finished resolving proxy.
         */
        proxyEnd: number;

        /**
         * Started DNS address resolve.
         */
        dnsStart: number;

        /**
         * Finished DNS address resolve.
         */
        dnsEnd: number;

        /**
         * Started connecting to the remote host.
         */
        connectStart: number;

        /**
         * Connected to the remote host.
         */
        connectEnd: number;

        /**
         * Started SSL handshake.
         */
        sslStart: number;

        /**
         * Finished SSL handshake.
         */
        sslEnd: number;

        /**
         * Started running ServiceWorker.
         */
        workerStart: number;

        /**
         * Finished Starting ServiceWorker.
         */
        workerReady: number;

        /**
         * Started sending request.
         */
        sendStart: number;

        /**
         * Finished sending request.
         */
        sendEnd: number;

        /**
         * Time the server started pushing request.
         */
        pushStart: number;

        /**
         * Time the server finished pushing request.
         */
        pushEnd: number;

        /**
         * Finished receiving response headers.
         */
        receiveHeadersEnd: number;

    }

    interface Response {
        /**
         * Response URL. This URL can be different from CachedResource.url in case of redirect
         */
        url: string;

        /**
         * HTTP response status code
         */
        status: number;

        /**
         * HTTP response status text
         */
        statusText: string;

        /**
         * HTTP response headers
         */
        headers: any;

        /**
         * HTTP response headers text
         */
        headersText?: string;

        /**
         * Resource mimeType as determined by the browser
         */
        mimeType: string;

        /**
         * Refined HTTP request headers that were actually transmitted over the network
         */
        requestHeaders?: any;

        /**
         * HTTP request headers text
         */
        requestHeadersText?: string;

        /**
         * Specifies whether physical connection was actually reused for this request
         */
        connectionReused: boolean;

        /**
         * Physical connection id that was actually used for this request
         */
        connectionId: number;

        /**
         * Remote IP address
         */
        remoteIPAddress?: string;

        /**
         * Remote port
         */
        remotePort?: number;

        /**
         * Specifies that the request was served from the disk cache
         */
        fromDiskCache?: boolean;

        /**
         * Specifies that the request was served from the ServiceWorker
         */
        fromServiceWorker?: boolean;

        /**
         * Specifies that the request was served from the prefetch cache
         */
        fromPrefetchCache?: boolean;

        /**
         * Total number of bytes received for this request so far
         */
        encodedDataLength: number;

        /**
         * Timing information for the given request
         */
        timing?: Network.ResourceTiming;

        /**
         * Protocol used to fetch this request
         */
        protocol?: string;

        /**
         * Security state of the request resource
         */
        securityState: any;

        /**
         * Security details for the request
         */
        securityDetails?: any;
    }

    export interface Initiator {
        /**
         * Type of this initiator
         */
        type: 'parser' | 'script' | 'preload' | 'SignedExchange' | 'other';

        /**
         * Initiator JavaScript stack trace, set for Script only
         */
        stack?: Runtime.StackTrace;

        /**
         * Initiator URL, set for Parser type or for Script type (when script is importing module) or for SignedExchange type
         */
        url?: string;

        /**
         * Initiator line number, set for Parser type or for Script type (when script is importing module) (0-based)
         */
        lineNumber?: number;
    }

    interface RequestParams {
        /**
         * Request identifier
         */
        requestId: string;
        /**
         * Monotonic time stamp
         */
        timestamp: number;
    }

    interface RequestWillBeSentParams extends RequestParams{
        /**
         *
         */
        loaderId: string;
        documentURL: string;
        request: Network.Request;
        wallTime: number;
        initiator: Initiator;

        redirectResponse?: Response;
        type?: ResourceType;
        frameId?: string;
    }

    interface DataReceivedParams extends RequestParams{
        /**
         * Data chunk length
         */
        dataLength: number;

        /**
         * Actual bytes received (might be less than dataLength for compressed encodings)
         */
        encodedDataLength: number;
    }

    interface LoadingFinishedParams extends RequestParams {
        /**
         * Total number of bytes received for this request
         */
        encodedDataLength: number;
    }

    interface ResponseReceivedParams extends RequestParams {
        /**
         * Loader identifier. Empty string if the request is fetched from worker
         */
        loaderId: string;

        /**
         * Resource type
         */
        type: ResourceType;

        /**
         * Response data
         */
        response: Response;

        /**
         * Frame Identifier
         */
        frameId: string;
    }
}

export interface CDPSession extends EventEmitter {
    /**
     * Detaches session from target. Once detached, session won't emit any events and can't be used
     * to send messages.
     */
    detach(): Promise<void>;

    /**
     * @param method Protocol method name
     * @param params
     */
    send(method: string, params?: object): Promise<object>;

    on(method: 'Network.requestWillBeSent', listener: (params: Network.RequestWillBeSentParams) => void): this;
    on(method: 'Network.dataReceived', listener: (params: Network.DataReceivedParams) => void): this;
    on(method: 'Network.loadingFinished', listener: (params: Network.LoadingFinishedParams) => void): this;
    on(method: 'Network.responseReceived', listener: (params: Network.ResponseReceivedParams) => void): this;
}
