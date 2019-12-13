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
        const {root, totalNodes} = await graphUrl(pageUrl);

        // console.log(inspect(tree, false, null, true));

        expect(totalNodes).toEqual(3);

        expect(root).toBeDefined();

        expect(root.children.length).toEqual(2);
        expect(root.children[0].encodedBytes).toEqual(4064);

        expect(root).toHaveRequestChain(
            pageUrl,
            `${base}/js/basic.js`
        );

        expect(root).toHaveRequestChain(
            pageUrl,
            `${base}/assets/small-image.png`
        );
    });

    test('Maps requests from an iframe', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/iframe.html`;
        const {root, totalNodes} = await graphUrl(pageUrl);

        // console.log(inspect(tree, false, null, true));

        expect(totalNodes).toEqual(4);

        expect(root).toBeDefined();

        expect(root).toHaveRequestChain(
            pageUrl,
            `${base}/basic.html`,
            `${base}/js/basic.js`
        );

        expect(root).toHaveRequestChain(
            pageUrl,
            `${base}/basic.html`,
            `${base}/assets/small-image.png`
        );
    });


    test('Maps requests loaded from js', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/load-using-js.html`;
        const {root, totalNodes} = await graphUrl(pageUrl);

        // console.log(inspect(tree, false, null, true));

        expect(totalNodes).toEqual(3);

        expect(root).toHaveRequestChain(
            pageUrl,
            `${base}/js/load-other.js`,
            `${base}/assets/some-data.json`
        );
    });

    test('Maps requests that use redirects', async () => {
        const base = `http://localhost:${port}`;
        const pageUrl = `${base}/redirect-asset.html`;
        const {root, totalNodes} = await graphUrl(pageUrl);

        // console.log(inspect(tree, false, null, true));

        expect(totalNodes).toEqual(6);

        expect(root).toHaveRequestChain(
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
        const tree = await graphUrl(pageUrl);

        // console.log(inspect(tree, false, null, true));

        expect(tree.totalNodes).toEqual(8);

        await prettyPrintTree('test.html', tree);

        expect(tree.root).toHaveRequestChain(
            pageUrl,
            `${base}/redirect-asset.html`,
            `${base}/redirect-js`,
            `${base}/redirect-two`,
            `${base}/js/load-script.js`,
            `${base}/js/load-other.js`,
            `${base}/assets/some-data-small.json`
        );
        expect(tree.root).toHaveRequestChain(
            pageUrl,
            `${base}/redirect-asset.html`,
            `${base}/redirect-js`,
            `${base}/redirect-two`,
            `${base}/js/load-script.js`,
            `${base}/js/load-other.js`,
            `${base}/assets/some-data-large.json`
        );
    }, 5000000);

    test('Real page', async () => {
        const tree = await graphUrl('https://www.nature.com/articles/s41598-018-27650-4');

        // console.log(inspect(tree, false, null, true));

        prettyPrintTree('nature.com', tree);
    }, 5000000);

});
