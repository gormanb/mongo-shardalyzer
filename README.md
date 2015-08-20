shardalyzer
===========

Visualisation and analysis tool for MongoDB sharded clusters, written as a Bootcamp project using the MEAN stack. Visualise a cluster's current topology, roll back the view to any point in its history, step through the splitting and migration of chunks, or jump directly to points in time where errors occurred. Also includes a builtin query interface for performing find() or aggregate() on any collection in the config database.

Setup
-----

Run setup.sh; this will attempt to find your package manager (yum, apt-get, brew or port) in order to install node, npm, and then the project dependencies. Note that, depending on your OS, this may prompt for your sudo password.

To install manually, first install npm and then run the following from the project directory:

	npm install
	./node_modules/bower/bin/bower install

Operation
---------

From the project directory, start the Express server with:

	node mongo-shardalyzer.js

Then open localhost:3000 in your browser. Click the Menu icon in the top-left to set server connection options, then select a namespace to pull data from the mongod/s.

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
