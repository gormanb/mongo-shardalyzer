#!/bin/bash

if [[ ! -z $(which yum) ]]; then
	sudo yum install epel-release
	sudo yum install nodejs npm --enablerepo=epel
elif [[ ! -z $(which apt-get) ]]; then
	sudo apt-get install nodejs-legacy npm
elif [[ ! -z $(which brew) ]]; then
	brew install node
elif [[ ! -z $(which port) ]]; then
	port install nodejs npm
elif [[ -z $(which npm) ]]; then
	echo "Can't find or install node.js npm; exiting..."
	exit 1;
fi

npm install
./node_modules/bower/bin/bower install

cd bower_components
patch -f --fuzz=0 -r - -p1 < ../seiyria-bootstrap-slider.patch > /dev/null 2>&1
