const {graphUrl} = require('./src');

graphUrl('https://link.springer.com/book/10.1007/978-981-13-8479-0')
	.then(x => {
	})
	.catch(error => {
		console.error('Error', error)
	});
