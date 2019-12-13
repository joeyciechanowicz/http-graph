import {Server} from 'http';
import {inspect} from 'util';
import {Application} from 'express';
import {close, createApp, listen} from './helpers';
import {graphUrl, prettyPrintTree} from '../src';

const port = 8080;

describe('Basic', () => {
    let app: Application;
    let server: Server;

    beforeAll(async () => {
        app = createApp();

        app.get('/redirect-js', (req, res) => res.redirect('/redirect-two'));
        app.get('/redirect-two', (req, res) => res.redirect('js/load-script.js'));

        server = await listen(port, app);
    });

    afterAll(async () => {
        await close(server);
    });

    test('Maps basic requests', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/basic.html`;
        const {totalRequests, tree} = await graphUrl(pageUrl);

        // console.log(inspect(tree, false, null, true));

        expect(totalRequests).toEqual(3);

        expect(tree[pageUrl]).toBeDefined();

        expect(Object.keys(tree[pageUrl].children).length).toEqual(2);
        expect(tree[pageUrl].children[`${base}/assets/small-image.png`].encodedBytes).toEqual(4064);

        expect(tree).toHaveRequestChain(
            pageUrl,
            `${base}/js/basic.js`
        );

        expect(tree).toHaveRequestChain(
            pageUrl,
            `${base}/assets/small-image.png`
        );
    });

    test('Maps requests from an iframe', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/iframe.html`;
        const {totalRequests, tree} = await graphUrl(pageUrl);

        // console.log(inspect(tree, false, null, true));

        expect(totalRequests).toEqual(4);

        expect(tree[pageUrl]).toBeDefined();

        expect(tree).toHaveRequestChain(
            pageUrl,
            `${base}/basic.html`,
            `${base}/js/basic.js`
        );

        expect(tree).toHaveRequestChain(
            pageUrl,
            `${base}/basic.html`,
            `${base}/assets/small-image.png`
        );
    });


    test('Maps requests loaded from js', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/load-using-js.html`;
        const {totalRequests, tree} = await graphUrl(pageUrl);

        // console.log(inspect(tree, false, null, true));

        expect(totalRequests).toEqual(3);

        expect(tree).toHaveRequestChain(
            pageUrl,
            `${base}/js/load-other.js`,
            `${base}/assets/some-data.json`
        );
    });

    test('Maps requests that use redirects', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/redirect-asset.html`;
        const {totalRequests, tree} = await graphUrl(pageUrl);

        // console.log(inspect(tree, false, null, true));

        expect(totalRequests).toEqual(6);

        expect(tree).toHaveRequestChain(
            pageUrl,
            `${base}/redirect-js`,
            `${base}/redirect-two`,
            `${base}/js/load-other.js`,
            `${base}/assets/some-data.json`
        );
    }, 5000000);

    test('Maps requests that use redirects inside an iframe', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/iframe-with-redirects.html`;
        const {totalRequests, tree} = await graphUrl(pageUrl);

        // console.log(inspect(tree, false, null, true));

        expect(totalRequests).toEqual(7);

        await prettyPrintTree('test.html', tree);

        expect(tree).toHaveRequestChain(
            pageUrl,
            `${base}/redirect-js`,
            `${base}/js/load-other.js`,
            `${base}/assets/some-data.json`
        );
    }, 5000000);

    test('Real page', async () => {
        const {totalRequests, tree} = await graphUrl('https://www.nature.com/articles/s41598-018-27650-4');

        // console.log(inspect(tree, false, null, true));

        prettyPrintTree('nature.com', tree);
    }, 5000000);

});
