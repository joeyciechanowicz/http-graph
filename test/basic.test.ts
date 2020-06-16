import {Server} from 'http';
import {inspect} from 'util';
import {Application} from 'express';
import {close, createApp, listen} from './helpers';
import {graphUrl, writeTreeToFile} from '../src';

const port = 8080;

describe('Basic', () => {
    let app: Application;
    let server: Server;

    beforeAll(async () => {
        app = createApp();
        server = await listen(port, app);
    });

    afterAll(async () => {
        await close(server);
    });

    test('Maps basic requests', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/basic.html`;
        const tree = await graphUrl(pageUrl);

        // console.log(inspect(tree, false, null, true));

        expect(tree.totalRequests).toEqual(3);
        expect(tree.root).toBeDefined();
        expect(tree.root.children.length).toEqual(2);

        expect(tree.root).toHaveRequestChain(
            [200, pageUrl],
            [200, `${base}/js/basic.js`],
        );

        expect(tree.root).toHaveRequestChain(
            [200, pageUrl],
            [200, `${base}/assets/small-image.png`],
        );

        expect(tree.totalBytes).toEqual(4954);
    });

    test('Maps requests from an iframe', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/iframe.html`;
        const {root, totalRequests} = await graphUrl(pageUrl);

        // console.log(inspect(root, false, null, true));

        expect(totalRequests).toEqual(4);

        expect(root).toBeDefined();

        expect(root).toHaveRequestChain(
            [200, pageUrl],
            [200, `${base}/basic.html`],
            [200, `${base}/js/basic.js`],
        );

        expect(root).toHaveRequestChain(
            [200, pageUrl],
            [200, `${base}/basic.html`],
            [200, `${base}/assets/small-image.png`],
        );
    });


    test('Maps requests loaded from js', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/load-using-js.html`;
        const {root, totalRequests} = await graphUrl(pageUrl);

        // console.log(inspect(root, false, null, true));

        expect(totalRequests).toEqual(4);

        expect(root).toHaveRequestChain(
            [200, pageUrl],
            [200, `${base}/js/load-other.js`],
            [200, `${base}/assets/some-data-small.json`],
        );

	    expect(root).toHaveRequestChain(
		    [200, pageUrl],
		    [200, `${base}/js/load-other.js`],
		    [200, `${base}/assets/some-data-large.json`],
	    );
    });

    test('Maps basic redirects', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/redirect-basic.html`;
        const {root, totalRequests} = await graphUrl(pageUrl);

        expect(totalRequests).toEqual(4);

        expect(root).toHaveRequestChain(
            [200, pageUrl],
            [302, `${base}/redirect-basic-1`],
            [302, `${base}/redirect-basic-2`],
            [304, `${base}/js/basic.js`],
        );

    }, 5000000);

    test('Maps requests that use redirects', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/redirect-asset.html`;
        const {root, totalRequests} = await graphUrl(pageUrl);

        // console.log(inspect(root, false, null, true));

        expect(totalRequests).toEqual(7);

        expect(root).toHaveRequestChain(
            [200, pageUrl],
            [302, `${base}/redirect-js`],
            [302, `${base}/redirect-two`],
            [200, `${base}/js/load-other.js`],
            [200, `${base}/assets/some-data.json`],
        );

	    expect(root).toHaveRequestChain(
		    [200, pageUrl],
		    [302, `${base}/redirect-js`],
		    [302, `${base}/redirect-two`],
		    [200, `${base}/js/load-other.js`],
		    [200, `${base}/assets/some-large.json`],
	    );
    }, 5000000);

    test('Maps requests that use redirects inside an iframe', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/iframe-with-redirects.html`;
        const tree = await graphUrl(pageUrl);

        // console.log(inspect(tree, false, null, true));

        expect(tree.totalRequests).toEqual(8);

        expect(tree.root).toHaveRequestChain(
            [200, pageUrl],
            [304, `${base}/redirect-asset.html`],
            [302, `${base}/redirect-js`],
            [302, `${base}/redirect-two`],
            [200, `${base}/js/load-script.js`],
            [200, `${base}/js/load-other.js`],
            [200,`${base}/assets/some-data-small.json`]
        );
        expect(tree.root).toHaveRequestChain(
            [200, pageUrl],
            [304, `${base}/redirect-asset.html`],
            [302, `${base}/redirect-js`],
            [302, `${base}/redirect-two`],
            [200, `${base}/js/load-script.js`],
            [200, `${base}/js/load-other.js`],
            [200, `${base}/assets/some-data-large.json`],
        );
    }, 5000000);

    test.skip('Real page', async () => {
        const tree = await graphUrl('https://www.nature.com/articles/s41598-018-27650-4');

        // console.log(inspect(tree, false, null, true));

        // prettyPrintTree('nature.com', tree);
    }, 5000000);

});
