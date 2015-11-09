
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

		$rootScope.mongo.ui =
		{
			selectedchange : "0",
			showchangelog : true,
			shardenabled : {},
			changelog : [],
			logwindow : 18,
			errors : [],
			errmsg : [],
			slider : 0
		};

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
				$scope.mongo.shardalyzer.initialize(result.shards, result.tags, result.chunks, result.changelog);
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

	$scope.mongo.ui.shardenabled = {};
	$scope.chartmeta.shardlist = [];

	$scope.chartmeta.labels = {};
	$scope.chartmeta.colors = {};
	$scope.chartmeta.data = {};

	var GRANULARITY_DEFAULT = 200;

	$scope.chartmeta.granularity =
	{
		min : 1,
		max : GRANULARITY_DEFAULT,
		value : GRANULARITY_DEFAULT,
		update : function(shards)
		{
			var granularity = $scope.chartmeta.granularity;
			var maxcand = 0;

			for(var s in shards)
				maxcand = Math.max(maxcand, shards[s].length);

			if(maxcand > granularity.max)
			{
				setTimeout(function() // don't trigger apply()
				{
					// value auto-adjusts upwards to min(max, GRANULARITY_DEFAULT)
					// if user has manually set it to 100% beyond this, also adjust
					granularity.value = (granularity.value == granularity.max ?
						(granularity.value > GRANULARITY_DEFAULT ? maxcand :
							Math.min(maxcand, GRANULARITY_DEFAULT)) : granularity.value);

					granularity.max = maxcand;

				}, 50);
			}
		},
		format : function(value)
		{
			return "Granularity: " +
				(100*(value/$scope.chartmeta.granularity.max)).toFixed(2) + "%";
		}
	};

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

	$scope.shardtags = function(shard)
	{
		var tagtip = JSON.stringify($scope.mongo.shardalyzer.tags[shard], null, 4);

		return tagtip.substring(1, tagtip.length-2);
	}

	// lower (inclusive) to upper (exclusive)
	function addWedge(shard, lower, upper, index)
	{
		if(upper - lower <= 0) return 0;

		var shards = $scope.mongo.shardalyzer.shards;

		$scope.chartmeta.data[shard][index] = 1;

		$scope.chartmeta.colors[shard][index] =
			$scope.mongo.shardalyzer.statuscolors[shards[shard][lower].status];

		if(!$scope.chartmeta.labels[shard][index])
			$scope.chartmeta.labels[shard][index] = [];

		$scope.chartmeta.labels[shard][index][0] = shard;
		$scope.chartmeta.labels[shard][index][1] = lower;
		$scope.chartmeta.labels[shard][index][2] = upper;

		return 1;
	}

	$scope.$watchGroup(['mongo.shardalyzer.position', 'chartmeta.granularity.value'], function(posgran)
	{
		var position = posgran[0], granularity = posgran[1];

		var shards = $scope.mongo.shardalyzer.shards;

		for(var s in shards)
		{
			if(!$scope.chartmeta.data[s])
			{
				$scope.chartmeta.data[s] = [];
				$scope.chartmeta.colors[s] = [];
				$scope.chartmeta.labels[s] = [];
			}

			var inc = Math.max(1, shards[s].length/granularity);
			var seq = 0;

			for(var skip = 0; skip < shards[s].length; skip+=inc)
			{
				var lower = (skip|0);
				var upper = Math.min((skip+inc)|0, shards[s].length);

				// lower (inclusive) to upper (exclusive)
				for(var chunk = lower; chunk < upper; chunk++)
				{
					if(shards[s][chunk].status)
					{
						seq += addWedge(s, lower, chunk, seq);
						seq += addWedge(s, chunk, chunk+1, seq);
						lower = chunk+1;
					}
					else if(chunk == upper-1)
						seq += addWedge(s, lower, upper, seq);
				}
			}

			$scope.chartmeta.labels[s].length = seq;
			$scope.chartmeta.colors[s].length = seq;
			$scope.chartmeta.data[s].length = seq;

			// trigger redraw of empty shard
			if($scope.chartmeta.data[s].length == 0)
				$scope.chartmeta.colors[s][0] = '#EEEEEE';
		}

		if(position == null)
		{
			$scope.chartmeta.options.animateRotate = true;
			$scope.chartmeta.options.animationSteps = 125;

			$scope.chartmeta.data = {};
			$scope.chartmeta.colors = {};
			$scope.chartmeta.labels = {};
		}

		// update granularity max and (possibly) value
		$scope.chartmeta.granularity.update(shards);
	});

	$scope.$watch('mongo.shardalyzer.shards', function(shards)
	{
		$scope.chartmeta.shardlist = Object.keys(shards);
		$scope.mongo.ui.shardenabled = {};

		for(var k in shards)
		{
			$scope.mongo.ui.shardenabled[k] = true;

			$scope.chartmeta.granularity.max =
				Math.max($scope.chartmeta.granularity.max, shards[k].length);
		}
	});

	$scope.chartmeta.toggleedit = function()
	{
		$scope.chartmeta.shardedit = (!$scope.chartmeta.shardedit);
	};

	$scope.chartmeta.enableall = function(enable)
	{
		for(var k in $scope.mongo.ui.shardenabled)
			$scope.mongo.ui.shardenabled[k] = enable;
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
	$scope.mongo.ui.errmsg = [];

	$scope.slidermeta.snap = 1;

	$scope.slidermeta.scale = null;

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
		$scope.mongo.shardalyzer.bttf(position, $scope.mongo.ui.shardenabled);
		$scope.mongo.ui.slider = $scope.mongo.shardalyzer.position;
		updateChangelog($scope.mongo.shardalyzer.position);
	});

	$scope.errorconfig =
	{
		params :
		{
			slow_move_threshold :
			{
				name : "Slow Move Threshold",
				value : 15*(1000*60)
			}
		},

		opts :
		{
			failedmoves :
		 	{
		 		name : "Failed moves",
		 		enabled : true,
		 		error : function(change, params)
		 		{
		 			return change.details.note === "aborted";
		 		},
		 		errmsg : function(change, params)
		 		{
		 			return { type : "danger", msg : change.details.errmsg };
		 		}
		 	},

		 	slowmoves :
		 	{
		 		name : "Slow moves",
		 		enabled : false,
		 		error : function(change, params)
		 		{
		 			if(change.what == "moveChunk.from")
		 			{
		 				var sum = 0;

		 				for(var i = 1; i < 6; i++)
		 				{
		 					var time = change.details["step " + i + " of 6"];

		 					if(time !== undefined)
		 						sum += time;
		 				}

		 				return sum >= params.slow_move_threshold.value;
		 			}

		 			return false;
		 		},
		 		errmsg : function(change, params)
		 		{
		 			var msg = {};

		 			for(var i = 1; i < 6; i++)
	 				{
		 				var step = "step " + i + " of 6";

		 				var time = change.details["step " + i + " of 6"];

		 				if(time !== undefined)
		 					msg[step] = time;
	 				}

	 				return { type : "warning", msg : JSON.stringify(msg) };
		 		}
		 	}
		}
	}

	isError = function(change)
	{
		var erropts = $scope.errorconfig.opts;
		var params = $scope.errorconfig.params;

		var error = false;

		for(var k in erropts)
		{
			if((!error) && erropts[k].enabled)
				error = erropts[k].error(change, params);
		}

		return error;
	};

	errorMsg = function(change)
	{
		var erropts = $scope.errorconfig.opts;
		var params = $scope.errorconfig.params;

		for(var k in erropts)
		{
			if(erropts[k].enabled && erropts[k].error(change, params))
				return erropts[k].errmsg(change, params);
		}

		return undefined;
	};

	setErrorTicks = function()
	{
		$scope.mongo.ui.errors = [];
		$scope.mongo.ui.errmsg = [];

		for(var i in $scope.mongo.shardalyzer.changes)
		{
			var change = $scope.mongo.shardalyzer.changes[i];

			if(isError(change))
			{
				$scope.mongo.ui.errmsg[i] = errorMsg(change);
				$scope.mongo.ui.errors.push(i);
			}
		}

		if($scope.mongo.ui.errors[0] !== 0)
			$scope.mongo.ui.errors.unshift(0);

		if($scope.mongo.ui.errors[$scope.mongo.ui.errors.length-1] !== $scope.slidermeta.max)
			$scope.mongo.ui.errors.push($scope.slidermeta.max);

		// slider doesn't $watch ticks; force it to refresh itself
		$scope.slidermeta.scale = (	$scope.slidermeta.scale == null ? "linear" : null);
	}

	$scope.$watch('mongo.shardalyzer.changes', function(changes)
	{
		$scope.slidermeta.max = $scope.mongo.shardalyzer.changes.length;
		$scope.mongo.ui.slider = 0;

		setErrorTicks();

		updateChangelog(0);
	});

	$scope.$watch('errorconfig', setErrorTicks, true);
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
			updateSlider($scope.mongo.shardalyzer.changes.length - $scope.mongo.ui.slider);
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
			updateSlider(-$scope.mongo.ui.slider);
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