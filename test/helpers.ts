import http from 'http';
import path from 'path';
import express from 'express';
import {inspect} from "util";

import {TreeNode} from '../src';

export function createApp(): express.Application {
    const app = express();

    app.use(express.static(path.resolve(__dirname, './static')));

    return app;
}

export function listen(port: number, app: express.Application): Promise<http.Server> {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, error => {
            if (error) {
                return reject(error);
            }

            resolve(server);
        });
    });
}

export function close(server: http.Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close(error => {
            if (error) {
                return reject(error);
            }

            resolve();
        })
    });
}

type StatusUrl = [number, string];

declare global {
    namespace jest {
        interface Matchers<R, T> {
            toHaveRequestChain(...urls: StatusUrl[]): R;
        }
    }
}

expect.extend({
    toHaveRequestChain(tree: TreeNode, ...urls: StatusUrl[]) {
        if (this.isNot) {
            throw new Error('toHaveRequestChain does not support .not');
        }

        let pointer = tree;
        if (!pointer) {
            return {
                message: () => `The tree doesn't contain the first URL ${urls[0][0]} - ${urls[0][1]}`,
                pass: false
            };
        }

        for (let i = 1; i < urls.length; i++) {
            const url = urls[i];

            const child = pointer.children.find((value => value.url === url[1] && value.status === url[0]));

            if (!child) {
                return {
                    message: () => `No request "${url[0]} - ${url[1]}" exists on node ${inspect(pointer, false, 2, true)}\n` +
                        `Expected     : ${this.utils.printExpected(urls)}\n` +
                        `Got as far as: ${this.utils.printReceived(urls.slice(0, i))}`,
                    pass: false
                };
            }

            pointer = child;
        }

        return {
            message: () => '',
            pass: true
        };
    },
});
