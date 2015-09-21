
var shardalyze = angular.module('shardalyzer-ui', ['chart.js', 'ui.bootstrap', 'ui.bootstrap-slider', 'jsonFormatter', 'angular-growl', 'ngAnimate', 'monospaced.mousewheel', 'ui.sortable', 'frapontillo.bootstrap-switch']).run
(
	function($rootScope)
	{
		$rootScope.mongo = {};

		// initial settings
		$rootScope.mongo.host = "localhost";
		$rootScope.mongo.port = 27017;

		$rootScope.mongo.selectedNS = null;
		$rootScope.mongo.collList = [];
		$rootScope.mongo.nsList = [];

		$rootScope.mongo.ui = {};

		$rootScope.mongo.ui.selectedchange = "0";
		$rootScope.mongo.ui.showchangelog = true;
		$rootScope.mongo.ui.changelog = [];
		$rootScope.mongo.ui.logwindow = 18;
		$rootScope.mongo.ui.errors = [];
		$rootScope.mongo.ui.slider = 0;

		$rootScope.mongo.shardalyzer = Shardalyzer;
	}
);

shardalyze.directive('ngEnter', function ()
{
	return function (scope, element, attrs)
	{
		element.bind("keydown keypress", function (event)
		{
			if(event.which === 13)
			{
				scope.$apply(function ()
				{
					scope.$eval(attrs.ngEnter);
				});
 
				event.preventDefault();
			}
		});
	};
});

shardalyze.config(['growlProvider', function(growlProvider)
{
	growlProvider.globalTimeToLive({success: 5000, error: 5000, warning: 5000, info: 5000});
	growlProvider.globalDisableCountDown(true);
	/*growlProvider.globalReversedOrder(true);*/
	growlProvider.onlyUniqueMessages(true);
}]);

function growlmsg(headline, source, msg)
{
	var message = "<b>" + headline + "</b><br><b>" + source + "</b>";

	if(msg !== undefined)
		message += "<br><i>" + msg + "</i>";

	return message;
}

function pathify(components)
{
	var path = "";

	for(var k in components)
		path += (components[k] + '/');

	return path;
}

shardalyze.controller('serverNsCtrl', [ '$scope', '$http', 'growl', function($scope, $http, growl)
{
	$scope.updateNSList = function()
	{
		$scope.mongo.selectedNS = null;

		var url = '/mongo/namespaces/'
			.concat($scope.mongo.host).concat('/').concat($scope.mongo.port);

		$http
		({
			method: 'GET',
			url: url
		})
		.success
		(
			function(result)
			{
				growl.success(growlmsg("Connected to mongo server",
					$scope.mongo.host + ":" + $scope.mongo.port, "Namespace list loaded"));

				$scope.mongo.nsList = result;
			}
		)
		.error
		(
			function(err)
			{
				growl.error(growlmsg("Failed to get namespace list",
					$scope.mongo.host + ":" + $scope.mongo.port, err.message));

				$scope.mongo.nsList = [];
			}
		);
	};

	$scope.$watch('mongo.selectedNS', function(selected)
	{
		// deinit current shardalyzer
		$scope.mongo.shardalyzer.reset();

		if($scope.mongo.selectedNS == null)
			return;

		var url = '/mongo/metadata/'
			.concat($scope.mongo.host).concat('/')
				.concat($scope.mongo.port).concat('/')
					.concat($scope.mongo.selectedNS);

		$http
		({
			method: 'GET',
			url: url
		})
		.success
		(
			function(result)
			{
				$scope.mongo.shardalyzer.initialize(result.chunks, result.changelog);
			}
		)
		.error
		(
			function(err)
			{
				growl.error(growlmsg("Failed to retrieve data",
					$scope.mongo.host + ":" + $scope.mongo.port + "/" + $scope.mongo.selectedNS, err.message));
			}
		);
	});
}]);

shardalyze.controller("updateCharts", function($scope)
{
	$scope.chartmeta = {};

	$scope.chartmeta.colclasses = ["col-md-1", "col-md-2", "col-md-3", "col-md-4", "col-md-6", "col-md-12"];
	$scope.chartmeta.currentcol = 3;

	$scope.chartmeta.shardedit = false;

	$scope.chartmeta.shardenabled = {};
	$scope.chartmeta.shardlist = [];

	$scope.scaleCharts = function(event, delta, deltaX, deltaY)
	{
		if(!event.originalEvent.shiftKey)
			return;

		var newcol = $scope.chartmeta.currentcol + delta;

		if(newcol >= 0 && newcol < $scope.chartmeta.colclasses.length)
		{
			$scope.chartmeta.currentcol = newcol;
			event.preventDefault();

			// fire resize event; simplest way to redraw charts
			window.dispatchEvent(new Event('resize'));
		}
	};

	$scope.$watch('mongo.shardalyzer.position', function(position)
	{
		$scope.chartmeta.data = {};
		$scope.chartmeta.colors = {};

		var shards = $scope.mongo.shardalyzer.shards;

		for(var s in shards)
		{
			$scope.chartmeta.data[s] = [];
			$scope.chartmeta.colors[s] = [];

			for(var chunk = 0; chunk < shards[s].length; chunk++)
			{
				$scope.chartmeta.data[s][chunk] = 1;

				$scope.chartmeta.colors[s][chunk] =
					$scope.mongo.shardalyzer.statuscolors[shards[s][chunk].status];
			}

			if($scope.chartmeta.data[s].length == 0)
			{
				$scope.chartmeta.data[s][0] = 1;
				$scope.chartmeta.colors[s][0] = '#EEEEEE';
			}
		}

		if(position == null)
		{
			$scope.chartmeta.options.animateRotate = true;
			$scope.chartmeta.options.animationSteps = 125;
		}
	});

	$scope.$watch('mongo.shardalyzer.shards', function(shards)
	{
		$scope.chartmeta.shardlist = Object.keys(shards);
		$scope.chartmeta.shardenabled = {};

		for(var k in shards)
			$scope.chartmeta.shardenabled[k] = true;
	});

	$scope.chartmeta.toggleedit = function()
	{
		$scope.chartmeta.shardedit = (!$scope.chartmeta.shardedit);
	};

	$scope.chartmeta.enableall = function(enable)
	{
		for(var k in $scope.chartmeta.shardenabled)
			$scope.chartmeta.shardenabled[k] = enable;
	}

	$scope.chartmeta.sortopts =
	{
		tolerance : "pointer",
		opacity : 0.25,
		revert : true,
		distance : 25
	};

	// Chart.js Options
	$scope.chartmeta.options =
	{
		responsive: true,

		segmentShowStroke : true,
		segmentStrokeColor : '#fff',
		segmentStrokeWidth : 0.25,

		percentageInnerCutout : 75, // This is 0 for Pie charts

		animationEasing : 'easeOutQuint',
		animationSteps : 125,
		animateRotate : true,
		animateScale : false,

		legendTemplate : '',

		tooltipTemplate : function(label)
		{
			return label.label;
		},

		// disable animation after initial loading
		onAnimationComplete : function()
		{
			$scope.chartmeta.options.animateRotate = false;
			$scope.chartmeta.options.animationSteps = 1;
		}
	};
});

shardalyze.controller("sliderControl", function($scope)
{
	$scope.slidermeta = {};

	$scope.slidermeta.min = 0;
	$scope.slidermeta.max = 0;

	$scope.mongo.ui.errors = [];
	$scope.slidermeta.snap = 1;

	$scope.slidermeta.formatter = function(value)
	{
		if($scope.mongo.shardalyzer.changes[value] !== undefined)
			return $scope.mongo.shardalyzer.changes[value].time;
		else
			return value;
	};

	var updateChangelog = function(position)
	{
		var changes = $scope.mongo.shardalyzer.changes;
		var window = $scope.mongo.ui.logwindow;
		var offset = Math.floor(window / 2);

		var start = Math.max(Math.min(position, changes.length-offset)-offset, 0);
		var end = Math.max(Math.min(position+offset, changes.length), window);

		$scope.mongo.ui.selectedchange = (position - start).toString();
		$scope.mongo.ui.changelog.length = 0;

		for(var k = 0; k < (end-start); k++)
		{
			if(changes[start + k] !== undefined)
				$scope.mongo.ui.changelog[k] = changes[start + k];
		}
	}

	$scope.$watch('mongo.ui.slider', function(position)
	{
		$scope.mongo.shardalyzer.bttf(position);
		updateChangelog(position);

	});

	$scope.$watch('mongo.shardalyzer.changes.length', function(length)
	{
		$scope.slidermeta.max = $scope.mongo.shardalyzer.changes.length;
		$scope.mongo.ui.slider = 0;

		$scope.mongo.ui.errors = [];
		$scope.slidermeta.ticklabels = [];

		for(var i in $scope.mongo.shardalyzer.changes)
		{
			var change = $scope.mongo.shardalyzer.changes[i];

			if(change.details.note === "aborted")
			{
				$scope.mongo.ui.errors.push(i);
				$scope.slidermeta.ticklabels.push(i);
			}
		}

		if($scope.mongo.ui.errors[0] !== 0)
		{
			$scope.slidermeta.ticklabels.unshift("");
			$scope.mongo.ui.errors.unshift(0);
		}

		if($scope.mongo.ui.errors[$scope.mongo.ui.errors.length-1] !== $scope.slidermeta.max)
		{
			$scope.mongo.ui.errors.push($scope.slidermeta.max);
			$scope.slidermeta.ticklabels.push("");
		}

		updateChangelog(0);
	});
});

shardalyze.controller("playControl", ['$scope', '$interval', function($scope, $interval)
{
	$scope.searchbar = {};
	$scope.searchbar.search = null;

	var updateSlider = function(offset)
	{
		var newpos = $scope.mongo.ui.slider + offset;

		if(newpos >= 0 && newpos <= $scope.mongo.shardalyzer.changes.length)
			$scope.mongo.ui.slider = newpos;
	}

	$scope.$watch('searchbar.search', function(change)
	{
		var pos = $scope.mongo.shardalyzer.changes.indexOf(change);

		if(pos >= 0)
			updateSlider(pos - $scope.mongo.ui.slider);
	});

	$scope.playctrl =
	{
		playing : 0,
		promise : null,

		cancel : function()
		{
			$interval.cancel(this.promise);
			this.promise = null;
			this.playing = 0;
		},

		play : function(dir)
		{
			if(this.playing == dir)
			{
				// already playing in this direction, so pause and return
				this.cancel();
				return;
			}
			else if(this.playing !== 0) // playing in opposite direction, so cancel
				this.cancel();

			this.promise = $interval(updateSlider, 100, 0, true, dir);
			this.playing = dir;
		},

		start : function()
		{
			this.cancel();
			updateSlider(-$scope.mongo.ui.slider);
		},

		forwardError : function()
		{
			var pos = $scope.mongo.ui.errors.filter(function(value) { return value < $scope.mongo.ui.slider; });

			if(pos.length > 0)
			{
				pos = pos[pos.length-1];
				updateSlider(-($scope.mongo.ui.slider - pos));
			}
		},

		fastforward : function()
		{
			this.play(-1);
		},

		forward : function()
		{
			this.cancel();
			updateSlider(-1);
		},

		back : function()
		{
			this.cancel();
			updateSlider(1);
		},

		rewind : function()
		{
			this.play(1);
		},

		backError : function()
		{
			var pos = $scope.mongo.ui.errors.filter(function(value) { return value > $scope.mongo.ui.slider; });

			if(pos.length > 0)
			{
				pos = pos[0];
				updateSlider(pos - $scope.mongo.ui.slider);
			}
		},

		end : function()
		{
			this.cancel();
			updateSlider($scope.mongo.shardalyzer.changes.length - $scope.mongo.ui.slider)
		}
	}
}]);

shardalyze.controller("changelogControl", function($scope)
{
	// nothing to do at present
});

shardalyze.controller("queryCtrl", [ '$scope', '$http', 'growl', function($scope, $http, growl)
{
	$scope.query = {};

	$scope.query.result = null;
	$scope.query.query = null;

	$scope.query.selectedColl = null;

	$scope.query.andre_aggregrassi = {};

	$scope.query.andre_aggregrassi["Number of changelog operations"] = "[{ $group : { _id : { what : '$what', note : '$details.note' }, total : { $sum : 1 } } }]";
	$scope.query.andre_aggregrassi["Number of changelog operations by hour"] = "[{ $project : { day : { $dayOfYear : '$time' }, time : { $hour : '$time' }, what : '$what', note : '$details.note' } }, { $group : { _id : { day : '$day', time : '$time', what : '$what', note : '$note' }, count : { $sum : 1 } } }, { $sort : { '_id.day' : 1, '_id.time' : 1 } }]";
	$scope.query.andre_aggregrassi["Number of changelog operations by hour that are not aborted"] = "[{ $match : { 'details.note' : { $ne : 'aborted' } } }, { $project : { day : { $dayOfYear : '$time' }, time : { $hour : '$time' }, what : '$what' } }, { $group : { _id : { day : '$day', time : '$time', what : '$what' }, count : { $sum : 1 } } }, { $sort : { '_id.day' : 1, '_id.time' : 1 } }]";
	$scope.query.andre_aggregrassi["Nmber of changelog operations by namespace"] = "[{ $group : { _id : { what : '$what', ns : '$ns', note : '$details.note' }, total : { $sum : 1 } } }, { $sort : { '_id.ns' : 1, '_id.what' : 1 } }]";
	$scope.query.andre_aggregrassi["Number of splits, migration attempts, successes and failures by namespace"] = "[{ $group: {_id:'$ns', splits:{$sum:{$cond:[{$eq:['$what','split']},1,0]}}, migrationAttempts:{$sum:{$cond:[{$eq:['$what','moveChunk.from']},1,0]}}, migrationFailures:{$sum:{$cond:[ {$eq:['$details.note','aborted' ]} ,1,0]}}, migrations:{$sum:{$cond:[{$eq:['$what','moveChunk.commit']},1,0]}} } }]";

	$scope.query.andreAgg = null;

	$scope.query.submit = function()
	{
		var url = '/mongo/query/'
			.concat($scope.mongo.host).concat('/').concat($scope.mongo.port)
				.concat('/config/').concat($scope.query.selectedColl).concat('/').concat($scope.query.query);

		$http
		({
			method: 'GET',
			url: url
		})
		.success
		(
			function(result)
			{
				$scope.query.result = JSON.stringify(result, null, 2);
			}
		)
		.error
		(
			function(err)
			{
				growl.error(growlmsg("Query failed", $scope.mongo.host + ":" +
					$scope.mongo.port + "/config/" + $scope.query.selectedColl, err.message));
			}
		);
	};

	// watch for changes to nsList (i.e. server changed), also grab collections
	// obviously will be mostly the same but may only have subset of collections
	$scope.$watch('mongo.nsList', function(list)
	{
		if($scope.mongo.nsList.length === 0)
			return;

		var url = '/mongo/collections/'
			.concat($scope.mongo.host).concat('/')
				.concat($scope.mongo.port).concat('/config');

		$http
		({
			method: 'GET',
			url: url
		})
		.success
		(
			function(result)
			{
				$scope.mongo.collList = result;
			}
		)
		.error
		(
			function(err)
			{
				growl.error(growlmsg("Failed to retrieve collections list",
					$scope.mongo.host + ":" + $scope.mongo.port, err.message));
			}
		);
	});

	$scope.$watch('query.andreAgg', function(andre)
	{
		$scope.query.selectedColl = 'changelog';
		$scope.query.query = andre;

		if(andre !== null)
			$scope.query.submit();
	});
}]);