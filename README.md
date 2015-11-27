shardalyzer
===========

Visualisation and analysis tool for MongoDB sharded clusters. Visualise a cluster's current topology, roll back the view to any point in its history, step through the splitting and migration of chunks, or jump directly to points in time where errors occurred. Also includes a builtin query interface for performing `find()` or `aggregate()` on any collection in the config database.

Demo
-----

[![MongoDB Shardalyzer](http://img.youtube.com/vi/HOmRfV1JQg8/0.jpg)](https://www.youtube.com/watch?v=HOmRfV1JQg8 "MongoDB Shardalyzer")

Setup
-----

Run the setup script from the project directory:

`./setup.sh`

This will attempt to find your package manager (`yum`, `apt-get`, `brew` or `port`) in order to install `node`, `npm`, and then the project dependencies. Note that, depending on your OS, this may prompt for your `sudo` password.

To install manually, first install `npm` and then run the following from the project directory:

	npm install
	./node_modules/bower/bin/bower install

Operation
---------

From the project directory, start the Express server with:

	./start.sh

Or, run it manually using either of the following:

	node mongo-shardalyzer.js
	npm start

Then open `localhost:3000` in your browser. Click the Menu icon in the top-left to set server connection options, hit Return, and select a namespace to visualise.

Shardalyzer can pull data from a standalone `mongod` containing a config dump, directly from a config server, or via a `mongos`.

ToDo
-----
- Cleanup and refactoring, especially the CSS
- More visualisations!
  - e.g. diagram of chunk ancestor tree
- More data!
  - e.g. display points when cluster is eligible for balancing round (chunk diff > X etc)
  - locking dynamics
- More options!
  - Tag a chunk and track it through changes
  - Customise #shards per row, etc.
  - Zoom in/out on shards
- Test with huge clusters
  - Pagination/progressive loading?
