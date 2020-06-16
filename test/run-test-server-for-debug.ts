// import {createApp, listen} from './helpers';
(global as typeof global & { expect: {extend: () => void}}).expect = {
	extend: () => {
	}
};

import {createApp, listen} from './helpers';

const app = createApp();

listen(9090, app)
	.then((err) => console.log('Listening on http://localhost:9090'))
	.catch(console.trace);
