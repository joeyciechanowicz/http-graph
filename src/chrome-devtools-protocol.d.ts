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
        timestamp: string;
    }

    interface RequestWillBeSentParams extends RequestParams{
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
}
