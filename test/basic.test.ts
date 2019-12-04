import {Server} from 'http';
import {inspect} from 'util';
import {Application} from 'express';
import {close, createApp, listen} from './helpers';
import {graphUrl} from '../src';

const port = 8080;


describe('Basic', () => {
    let app: Application;
    let server: Server;

    beforeAll(async () => {
        app = createApp();

        app.get('/redirect-js.js', (req, res) => {
            res.redirect('js/load-other.js');
        });

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

        expect(tree[pageUrl]).toEqual(expect.objectContaining({
            status: 200,
            size: expect.any(Number),
            children: expect.anything()
        }));

        expect(Object.keys(tree[pageUrl].children).length).toEqual(2);
        expect(tree[pageUrl].children[`${base}/js/basic.js`].status).toEqual(200);
        expect(tree[pageUrl].children[`${base}/assets/small-image.png`].size).toEqual(3785);

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

        expect(tree[pageUrl]).toEqual(expect.objectContaining({
            status: 200,
            size: 168,
            children: expect.anything()
        }));

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

        expect(totalRequests).toEqual(4);

        expect(tree).toHaveRequestChain(
            pageUrl,
            `${base}/redirect-js.js`,
            `${base}/js/load-other.js`,
            `${base}/assets/some-data.json`
        );
    });

});
