fetch(`/assets/some-data.json`)
	.then(x => x.json())
	.then(data => {
		console.log(data);
	});
