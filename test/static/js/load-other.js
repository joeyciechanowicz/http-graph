fetch(`/assets/some-data-large.json`)
	.then(x => x.json())
	.then(data => {
		console.log(data);
		return fetch('/assets/some-data-small.json');
	})
	.then(x => x.json())
	.then(data => {
		console.log(data);
	});
