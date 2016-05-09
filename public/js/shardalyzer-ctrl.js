
var shardalyze = angular.module('shardalyzer-ui', ['chart.js', 'ui.bootstrap', 'ui.bootstrap-slider', 'jsonFormatter', 'angular-growl', 'ngAnimate', 'monospaced.mousewheel', 'ui.sortable', 'frapontillo.bootstrap-switch', 'ui.checkbox', 'ui.select', 'file-model']).run
(
	function($rootScope)
	{
		$rootScope.mongo = {};

		// initial settings
		$rootScope.mongo.configdb = "config";
		$rootScope.mongo.host = "localhost";
		$rootScope.mongo.port = 27017;

		$rootScope.mongo.auth =
		{
			methods:
			{
				"No Authentication" : null,
				MongoDB : "DEFAULT",
				x509 : "MONGODB-X509",
				Kerberos : "GSSAPI",
				LDAP : "PLAIN"
			},
			config:
			{
				authmech : null,
				username : null,
				password : null,
				authsrc : "admin",
				pemdata : null,
				pempwd : null,
				pem : null
			}
		};

		$rootScope.mongo.selectedNS = null;
		$rootScope.mongo.collList = [];
		$rootScope.mongo.nsList = [];

		$rootScope.mongo.ui =
		{
			selectedchange : "0",
			showmigrations : false,
			showchangelog : true,
			shardenabled : {},
			changelog : [],
			logwindow : 18,
			heatmap : true,
			errorsummary : {},
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
	var message = "<h4><b>" + headline +
		"</b></h4><h5><b>" + source + "</b></h5>";

	if(msg !== undefined)
		message += "<i>" + msg + "</i>";

	return message;
}

function pathify(components)
{
	var path = "";

	for(var k in components)
		path += (components[k] + '/');

	return path;
}

// shallow array compare convenience function
function arrayEquals(arr1, arr2)
{
	if(!arr1 || !arr2 || (arr1.length !== arr2.length))
		return false;

	for(var i = 0; i < arr1.length; i++)
	{
		if(arr2[i] !== arr1[i])
			return false;
	}

	return true;
}

// update changelog to reflect given timestep
var updateChangelog = function($scope, position)
{
	var changes = $scope.mongo.shardalyzer.changes;
	var window = $scope.mongo.ui.logwindow;
	var offset = Math.floor(window / 2);

	var start = Math.max(Math.min(position, changes.length-offset)-offset, 0);
	var end = Math.max(Math.min(position+offset, changes.length), window);

	$scope.mongo.ui.selectedchange = Math.min(position-start, end-start-1).toString();
	$scope.mongo.ui.changelog.length = 0;

	for(var k = 0; k < (end-start); k++)
	{
		if(changes[start + k] !== undefined)
			$scope.mongo.ui.changelog[k] = changes[start + k];
	}
}

shardalyze.controller('serverNsCtrl', [ '$scope', '$http', 'growl', function($scope, $http, growl)
{
	$scope.opts = { advanced : false };

	$scope.updateNSList = function()
	{
		$scope.mongo.selectedNS = null;

		var url = '/mongo/namespaces/' + $scope.mongo.host +
			'/' + $scope.mongo.port + '/' + $scope.mongo.configdb;

		$http
		({
			params: $scope.mongo.auth.config,
			method: 'GET',
			url: url
		})
		.success
		(
			function(result)
			{
				growl.success(growlmsg("Connected to mongo server",
					$scope.mongo.host + ":" + $scope.mongo.port, "Sharded namespace list loaded"));

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

		var url = '/mongo/metadata/' +
			$scope.mongo.host + '/' + $scope.mongo.port + '/' +
				$scope.mongo.configdb + '/' + $scope.mongo.selectedNS;

		$http
		({
			params: $scope.mongo.auth.config,
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

	$scope.$watch('mongo.auth.config.pem', function(pem)
	{
		if(pem)
		{
			try
			{
				var reader = new FileReader();

				reader.onload = function(filedata)
				{
					growl.success(growlmsg("Loaded PEM file", pem.name, "PEM file contents loaded."));
					$scope.mongo.auth.config.pemdata = filedata.target.result;
				};

				reader.readAsText($scope.mongo.auth.config.pem);
			}
			catch(err)
			{
				growl.error(growlmsg("Failed to load PEM file: ", pem.name, err.message));
				$scope.mongo.auth.config.pemdata = null;
			}
		}
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

	$scope.chartmeta.highlights = {};
	$scope.chartmeta.colors = {};

	$scope.chartmeta.labels = {};
	$scope.chartmeta.data = {};

	$scope.chartmeta.options = {};

	var	shardheatlow = hexToRgb(statuscolors[STATUS_SPLIT_DEST].substr(1)),
		shardheathigh = hexToRgb("FF7518"); // orange

	var chunkheatlow = [174,198,207], chunkheathigh = [192,75,75];

	var DS_CHUNKS = 0, DS_SPLITS = 1;

	var GRANULARITY_DEFAULT = 200;

	$scope.chartmeta.granularity =
	{
		min : 1,
		max : GRANULARITY_DEFAULT,
		value : GRANULARITY_DEFAULT,
		reset : function(shards)
		{
			var granularity = $scope.chartmeta.granularity;

			granularity.value = GRANULARITY_DEFAULT;
			granularity.max = GRANULARITY_DEFAULT;

			granularity.update(shards);
		},
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
		// !event implies manual call from button click
		if(event && event.originalEvent.shiftKey)
			event.preventDefault();
		else if(event) return;

		var newcol = $scope.chartmeta.currentcol + delta;

		if(newcol >= 0 && newcol < $scope.chartmeta.colclasses.length)
		{
			$scope.chartmeta.currentcol = newcol;

			// fire resize event; simplest way to redraw charts
			window.dispatchEvent(new Event('resize'));
		}
	};

	$scope.chunkClick = function(points, event)
	{
		// label[0][1][2] = shard, startindex, endindex
		var numChunks = points[0]._model.label[2] - points[0]._model.label[1];
		var label = points[0]._model.label;

		if(numChunks == 1 && event.altKey)
		{
			$scope.mongo.shardalyzer.watchChunk
				($scope.mongo.shardalyzer.shards[label[0]][label[1]].min);
		}
		else if(numChunks > 1 && !(event.altKey || event.shiftKey || event.ctrlKey))
		{
			$scope.chartmeta.options[label[0]].animation.animateRotate = true;
			$scope.chartmeta.options[label[0]].animation.duration = 1000;
			generateChart(label[0], label[1], label[2]);
		}

		$scope.$apply();
	}

	$scope.chunkHover = function(points, event)
	{
		shardSegmentTooltipRaw(points[0], event);
	}

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

		$scope.chartmeta.data[shard][DS_CHUNKS][index] = 1;

		// status color takes prio if currently involved in an operation
		$scope.chartmeta.colors[shard][DS_CHUNKS][index] =
			$scope.mongo.shardalyzer.statuscolors[shards[shard][lower].status];

		// set watch color if watched and not involved in operation
		if(!shards[shard][lower].status && shards[shard][lower].watched)
			$scope.chartmeta.colors[shard][DS_CHUNKS][index] = shards[shard][lower].watched;
		else if(!shards[shard][lower].status && $scope.mongo.ui.heatmap)
		{
			var chunkheat = 0;

			for(var i = 0; i < upper - lower; i++)
				chunkheat = Math.max($scope.mongo.shardalyzer.shards[shard][lower+i].splits || 0, chunkheat);

			chunkheat /= ($scope.mongo.shardalyzer.splitcount.totalsplits || 1);

			$scope.chartmeta.colors[shard][DS_CHUNKS][index] = gradient(chunkheatlow, chunkheathigh, chunkheat);
		}

		// set hover highlight color
		$scope.chartmeta.highlights[shard][DS_CHUNKS][index] =
			rgba(hexToRgb($scope.chartmeta.colors[shard][DS_CHUNKS][index].substr(1)), 0.8);

		if(!$scope.chartmeta.labels[shard][index])
			$scope.chartmeta.labels[shard][index] = [];

		$scope.chartmeta.labels[shard][index][0] = shard;
		$scope.chartmeta.labels[shard][index][1] = lower;
		$scope.chartmeta.labels[shard][index][2] = upper;

		return 1;
	}

	$scope.$watchGroup(['mongo.shardalyzer.position', 'chartmeta.granularity.value'], generateCharts);
	$scope.$watch('mongo.shardalyzer.watched', generateCharts, true);

	function generateCharts(posgran)
	{
		var position = $scope.mongo.shardalyzer.position;
		var shards = $scope.mongo.shardalyzer.shards;

		for(var s in shards)
		{
			if(!$scope.chartmeta.data[s])
			{
				$scope.chartmeta.options[s] = $scope.chartmeta.newopts(s);

				$scope.chartmeta.highlights[s] = [[],['rgba(0,0,0,0)','rgba(0,0,0,0)']];
				$scope.chartmeta.colors[s] = [[],['rgba(0,0,0,0)','rgba(0,0,0,0)']];

				$scope.chartmeta.labels[s] = [];

				$scope.chartmeta.data[s] = [[],[]]; // chunk data, shard heat indicator
			}

			generateChart(s);
		}

		if(position == null)
		{
			$scope.chartmeta.highlights = {};
			$scope.chartmeta.colors = {};

			$scope.chartmeta.labels = {};
			$scope.chartmeta.data = {};

			$scope.chartmeta.options = {};
		}

		// update granularity max and (possibly) value
		$scope.chartmeta.granularity.update(shards);
	};

	// start (inclusive) to end (exclusive)
	function generateChart(shardname, start, end)
	{
		var shard = $scope.mongo.shardalyzer.shards[shardname];
		var granularity = $scope.chartmeta.granularity.value;

		var splitcount = $scope.mongo.shardalyzer.splitcount;

		end = (end || shard.length);
		start = (start || 0);

		var length = (end-start);

		var inc = Math.max(1, length/granularity);
		var seq = 0;

		for(var skip = start; skip < end; skip+=inc)
		{
			var lower = (skip|0);
			var upper = Math.min((skip+inc)|0, end);

			// lower (inclusive) to upper (exclusive)
			for(var chunk = lower; chunk < upper; chunk++)
			{
				if(shard[chunk].status || shard[chunk].watched)
				{
					seq += addWedge(shardname, lower, chunk, seq);
					seq += addWedge(shardname, chunk, chunk+1, seq);
					lower = chunk+1;
				}
				else if(chunk == upper-1)
					seq += addWedge(shardname, lower, upper, seq);
			}
		}

		$scope.chartmeta.highlights[shardname][DS_CHUNKS].length = seq;
		$scope.chartmeta.colors[shardname][DS_CHUNKS].length = seq;
		$scope.chartmeta.data[shardname][DS_CHUNKS].length = seq;
		$scope.chartmeta.labels[shardname].length = seq;

		// percentage of total splits that happened on this shard
		var shardheat = splitcount[shardname] / (splitcount.totalsplits || 1);

		// render internal donut dataset to indicate shard heat, i.e. percentage split rate
		//$scope.chartmeta.options[shardname].cutoutPercentage = 25 + (50 * (1.0-shardheat));
		$scope.chartmeta.data[shardname][DS_SPLITS][1] = splitcount.totalsplits-splitcount[shardname];
		$scope.chartmeta.data[shardname][DS_SPLITS][0] = splitcount[shardname];

		var shardgrad = gradient(shardheatlow, shardheathigh, shardheat);

		$scope.chartmeta.highlights[shardname][DS_SPLITS][0] = rgba(hexToRgb(shardgrad.substr(1)), 0.8);
		$scope.chartmeta.colors[shardname][DS_SPLITS][0] = shardgrad;

		// trigger redraw of empty shard
		if($scope.chartmeta.data[shardname][DS_CHUNKS].length == 0)
			$scope.chartmeta.colors[shardname][DS_CHUNKS][0] = '#EEEEEE';		
	}

	$scope.$watch('mongo.shardalyzer.shards', function(shards)
	{
		$scope.chartmeta.shardlist = Object.keys(shards);
		$scope.mongo.ui.shardenabled = {};

		for(var k in shards)
			$scope.mongo.ui.shardenabled[k] = true;

		$scope.chartmeta.granularity.reset(shards);
	});

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
	$scope.chartmeta.newopts = function(shardname)
	{
		return {
			responsive: true,

			elements :
			{
				arc :
				{
					borderColor : '#fff',
					borderWidth : 0.25
				}
			},

			cutoutPercentage : 50, // This is 0 for Pie charts

			tooltips : { enabled : false },
			legend : { display : false },
			hover : { mode : 'single' },

			animation :
			{
				easing : 'easeOutQuart',
				animateRotate : true,
				animateScale : false,
				duration : 1000,

				// disable animation after initial loading
				onComplete : function()
				{
					$scope.chartmeta.options[shardname].animation.animateRotate = false;
					$scope.chartmeta.options[shardname].animation.animateScale = false;
					$scope.chartmeta.options[shardname].animation.duration = 0;
				}
			}
		}
	};
});

shardalyze.controller("migrateCtrl", function($scope)
{
	var scolors = $scope.mongo.shardalyzer.statuscolors;

	var colormap =
	{
		F1 : "#AEC6CF",
	 	F2 : '#DCDCDC',
		F3 : scolors[STATUS_START_SOURCE],
		F4 : scolors[STATUS_TO_SOURCE],
		F5 : scolors[STATUS_COMMIT],
		F6 : scolors[STATUS_FROM_SUCCESS],

		"Total" : scolors[STATUS_FROM_FAILURE],
		"Data Size" : '#000000'
	};

	$scope.chartmeta =
	{
		bars:
		{
			labels : [],
			data : [],

			colors:
			[
			 	colormap["F1"],	colormap["F2"],
			 	colormap["F3"],	colormap["F4"],
			 	colormap["F5"],	colormap["F6"],
			 ],

			series:
			{
				"moveChunk.from": ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'],
				"moveChunk.to": ['T1', 'T2', 'T3', 'T4', 'T5']
			}
		},
		graph:
		{
			labels : [],
			data : [],

			from : null,
			to : null,

			series : [], // generated dynamically based on current settings
			colors : [],

			yAxes:
			{
				mig_time:
				{
					id : "mig_time",
					type : "linear",
					stacked : false,
					scaleLabel : { labelString : "Time (ms)", display : false },
				},
				mig_data:
				{
					id : "mig_data",
					type : "linear",
					position : "right",
					scaleLabel : { labelString : "Data Size (MB)", display : true },
					display : false
				}
			}
		}
	};

	$scope.chartmeta.bars.options =
	{
		legend : { display : false },
		maintainAspectRatio : false,
		responsive : true
	}

	$scope.chartmeta.graph.options =
	{
		elements : { point : { radius : 0, hitRadius : 4 }, line : { borderJoinStyle : 'bevel' } },
		title : { padding : 0, position : "bottom", display : true },
		tooltips : { enabled : false, mode : 'label' },
		scaleShowVerticalLines: false,
		maintainAspectRatio : false,
		pointHitDetectionRadius : 0,
		//bezierCurve : false,
		responsive : true,
		scales:
		{
			xAxes : [ { display : false } ],
			yAxes : [ $scope.chartmeta.graph.yAxes.mig_time, $scope.chartmeta.graph.yAxes.mig_data ]
		}
	}

	function filterMigration(moveFrom)
	{
		return (!$scope.chartmeta.graph.from || moveFrom.details.from == $scope.chartmeta.graph.from)
			&& (!$scope.chartmeta.graph.to || moveFrom.details.to == $scope.chartmeta.graph.to);
	}

	function generateGraphMeta()
	{
		var series = $scope.chartmeta.graph.series = [];
		var colors = $scope.chartmeta.graph.colors = [];

		if($scope.chartmeta.graph.yAxes.mig_data.display)
			series.push('Data Size');

		for(var i = 1; i <= 6; i++)
			series.push('F' + i);

		if(!$scope.chartmeta.graph.yAxes.mig_time.stacked)
			series.push('Total')

		var datasets = {};

		for(var s in series)
		{
			var ds = series[s];

			datasets[ds] =
			{
				data : [],
				tension : 0,
				borderWidth : 2,
				fill :  (ds == "Data Size" ? false : $scope.chartmeta.graph.yAxes.mig_time.stacked),
				yAxisID : (ds == "Data Size" ? "mig_data" : "mig_time")
			}

			colors.push(colormap[ds]);
		}

		return datasets;
	}

	function updateGraph()
	{
		$scope.chartmeta.graph.data = [];
		$scope.chartmeta.graph.labels = [];

		// don't show Time (ms) label if MB scale is disabled
		$scope.chartmeta.graph.yAxes.mig_time.scaleLabel.display =
			$scope.chartmeta.graph.yAxes.mig_data.display;

		// set series & build template datasets based on current settings
		var datasets = generateGraphMeta();

		var migrations = $scope.mongo.shardalyzer.migrations;
		var changes = $scope.mongo.shardalyzer.changes;

		if(!changes || !migrations) return;

		for(var i = 0; i < changes.length; i++)
		{
			var r = changes.length - (i+1);

			for(var m in datasets)
				datasets[m].data[r] = NaN;

			if(i in migrations)
			{
				var moveCommit = migrations[i][OP_COMMIT];
				var moveFrom = migrations[i][OP_FROM];

				if(filterMigration(moveFrom))
				{
					var steptimes = migratesteps(moveFrom);

					for(var j in steptimes)
						datasets["F" + j].data[r] = steptimes[j];

					// Total is not shown if graph is stacked
					if(!$scope.chartmeta.graph.yAxes.mig_time.stacked)
						datasets["Total"].data[r] = migrations[i][MIGRATE_TIME];

					// amount of data transferred (optional)
					if($scope.chartmeta.graph.yAxes.mig_data.display)
						datasets["Data Size"].data[r] = moveCommit.details.clonedBytes/(1024.0*1024.0);
				}
			}

			$scope.chartmeta.graph.labels[r] = $scope.mongo.shardalyzer.changes[i].time;
		}

		// finalise datasets
		for(var ds in datasets)
			$scope.chartmeta.graph.data.push(datasets[ds]);
	};

	$scope.$watchGroup(['chartmeta.graph.from', 'chartmeta.graph.to', 'chartmeta.graph.yAxes.mig_time.stacked', 'chartmeta.graph.yAxes.mig_data.display'], updateGraph);
	$scope.$watch('mongo.shardalyzer.changes', function(changes) { $scope.mongo.ui.showmigrations = false; updateGraph(); } )

	function updateBars(pos, op)
	{
		$scope.chartmeta.bars.data = [];
		op = (op || OP_FROM);

		var migrations = $scope.mongo.shardalyzer.migrations;
		var steps = (op == OP_FROM ? 6 : 5);

		if((pos == 0 || pos) && migrations && pos in migrations)
		{
			var steptimes = migratesteps(migrations[pos][op]);

			for(var i in steptimes)
				$scope.chartmeta.bars.data.push(steptimes[i]);
		}
		else
		{
			for(var i = 0; i <= steps; i++)
				$scope.chartmeta.bars.data.push(NaN);
		}

		$scope.chartmeta.bars.labels = $scope.chartmeta.bars.series[op];
	}

	// update bars view when slider position changes
	$scope.$watch('mongo.ui.slider', function(pos) { updateBars(pos, OP_FROM); });

	$scope.migrateBarClick = function(points, event)
	{
		var point = closestToMid(points);

		if(point._model.label == "F4")
		{
			updateBars($scope.mongo.ui.slider, OP_TO);
			$scope.$apply();
		}
	}

	$scope.migrateClick = function(points, event)
	{
		var point = closestToMid(points);

		if(point)
		{
			$scope.mongo.ui.slider = (point._xScale.ticks.length-1 - point._index);
			$scope.$apply();
		}
	}

	var lastPoint = null;

	$scope.migrateHover = function(points, event)
	{
		var point = closestToMid(points);

		if(!point || !lastPoint ||  (point._index !== lastPoint._index))
		{
			migrateGraphTooltipRaw(point, $scope.chartmeta.graph.data, event);
			lastPoint = point;
		}
	}

	function closestToMid(points)
	{
		if(points.length == 0)
			return null;
		else
			return points[Math.floor(points.length/2)];
	}
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
		var changes = $scope.mongo.shardalyzer.changes;

		value = Math.max(Math.min(value, changes.length-1), 0);

		return (changes[value] ? changes[value].time : value);
	};

	$scope.$watch('mongo.ui.slider', function(position)
	{
		$scope.mongo.shardalyzer.bttf(position, $scope.mongo.ui.shardenabled);
		$scope.mongo.ui.slider = $scope.mongo.shardalyzer.position;
		updateChangelog($scope, $scope.mongo.shardalyzer.position);
	});

	$scope.errorconfig =
	{
		params :
		{
			slow_move_units :
			{
				name : undefined,
				type : "select",
				options :
				{
					"days" : 24*(1000*60*60),
					"hours" : (1000*60*60),
					"minutes" : (1000*60),
					"seconds" : 1000,
					"milliseconds" : 1
				},
				value : (1000*60)
			},
			slow_move_threshold :
			{
				name : "Slow Move Threshold",
				type : "number",
				value : 15
			}
		},

		opts :
		{
			failedmoves :
		 	{
		 		name : "Failed moves",
		 		severity : "danger",
		 		enabled : true,
		 		errors : function(shardalyzer, params)
		 		{
		 			var errors = [];

		 			for(var f in shardalyzer.failures)
		 				errors[f] = { type : "danger", msg : shardalyzer.failures[f][OP_FROM].details.errmsg };

		 			return errors;
		 		},
		 		summarise : function(shardalyzer, params)
		 		{
		 			var summary = {};

		 			for(var f in shardalyzer.failures)
		 			{
		 				var failFrom = shardalyzer.failures[f][OP_FROM];

		 				var key = failFrom.details.from + " - " + failFrom.details.to;

		 				summary[key] = (summary[key] || 0) + 1;
		 			}

		 			return summary;
		 		}
		 	},

		 	slowmoves :
		 	{
		 		name : "Slow moves",
		 		severity : "warning",
		 		enabled : false,
		 		errors : function(shardalyzer, params)
		 		{
		 			var threshold = params.slow_move_threshold.value * params.slow_move_units.value;
		 			var errors = [];

		 			for(var m in shardalyzer.migrations)
		 			{
		 				if(shardalyzer.migrations[m][MIGRATE_TIME] >= threshold)
		 				{
		 					var moveFrom = shardalyzer.migrations[m][OP_FROM];
		 					var steps = migratesteps(moveFrom);
		 					var msg = {};

		 					errors[m] = { type : "warning" };

		 					for(var s in steps)
		 						msg["step " + s + " of 6"] = steps[s];

		 					errors[m].msg = JSON.stringify(msg);
		 				}
		 			}

		 			return errors;
		 		},
		 		summarise : function(shardalyzer, params)
		 		{
		 			var threshold = params.slow_move_threshold.value * params.slow_move_units.value;
		 			var summary = {};

		 			for(var s in shardalyzer.migrations)
		 			{
		 				var moveTime = shardalyzer.migrations[s][MIGRATE_TIME];
		 				var moveFrom = shardalyzer.migrations[s][OP_FROM];

		 				if(moveTime < threshold)
		 					continue;

		 				var key = moveFrom.details.from + " - " + moveFrom.details.to;

		 				summary[key] = (summary[key] || 0) + 1;
		 			}

		 			return summary;
		 		}
		 	}
		}
	}

	buildErrorSummary = function()
	{
		var summary = $scope.mongo.ui.errorsummary = {};
		var shardalyzer = $scope.mongo.shardalyzer;

		var erropts = $scope.errorconfig.opts;
		var params = $scope.errorconfig.params;

		for(var k in erropts)
		{
			if(erropts[k].enabled)
				summary[erropts[k].name] = erropts[k].summarise(shardalyzer, params);
		}
	}

	setErrorTicks = function()
	{	
		var shardalyzer = $scope.mongo.shardalyzer;
		var errmsg = $scope.mongo.ui.errmsg = [];

		var erropts = $scope.errorconfig.opts;
		var params = $scope.errorconfig.params;

		for(var k in erropts)
		{
			if(erropts[k].enabled)
			{
				merge(errmsg, erropts[k].errors(shardalyzer, params),
					function(oldVal, newVal){ return (newVal.type == "danger"); });
			}
		}

		// obtain array of indices of each error
		$scope.mongo.ui.errors = Object.keys(errmsg);

		if($scope.mongo.ui.errors[0] !== 0)
			$scope.mongo.ui.errors.unshift(0);

		if($scope.mongo.ui.errors[$scope.mongo.ui.errors.length-1] !== $scope.slidermeta.max)
			$scope.mongo.ui.errors.push($scope.slidermeta.max);

		// slider doesn't $watch ticks; force it to refresh itself
		$scope.slidermeta.scale = (	$scope.slidermeta.scale == null ? "linear" : null);
	}

	updateErrors = function()
	{
		buildErrorSummary();
		setErrorTicks();
	}

	$scope.$watch('mongo.shardalyzer.changes', function(changes)
	{
		$scope.slidermeta.max = $scope.mongo.shardalyzer.changes.length;
		$scope.mongo.ui.slider = 0;

		updateErrors();

		updateChangelog($scope, 0);
	});

	$scope.$watch('errorconfig', updateErrors, true);
});

shardalyze.controller("playControl", ['$scope', '$interval', 'growl', function($scope, $interval, growl)
{
	$scope.searchbar = {};
	$scope.searchbar.search = null;

	$scope.watchbox = {};
	$scope.watchbox.watch = null;

	var updateSlider = function(offset, filter)
	{
		var newpos = $scope.mongo.ui.slider + offset;

		if(newpos >= 0 && newpos <= $scope.mongo.shardalyzer.changes.length)
		{
			$scope.mongo.shardalyzer.bttf(newpos, $scope.mongo.ui.shardenabled, null, filter);
			$scope.mongo.ui.slider = $scope.mongo.shardalyzer.position;
		}
	}

	$scope.$watch('searchbar.search', function(change)
	{
		var pos = $scope.mongo.shardalyzer.changes.indexOf(change);

		if(pos >= 0)
			updateSlider(pos - $scope.mongo.ui.slider);
	});

	$scope.watchbox.watchChunk = function(shardkey)
	{
		try
		{
			var skey = RJSON.parse(shardkey);
		}
		catch(err)
		{
			growl.error(growlmsg("Invalid Shardkey", "The document you entered is not valid JSON", err.message));
			return;
		}

		for(var c in $scope.mongo.shardalyzer.chunks)
		{
			var chunk = $scope.mongo.shardalyzer.chunks[c];
			break;
		}

		if(!chunk || !arrayEquals(Object.keys(chunk.min), Object.keys(skey)))
		{
			growl.error(growlmsg("Invalid Shardkey", "The document does not match the shard key",
				"Please enter a valid shard key, or Alt-Click a chunk to add it to the watch list"));
		}
		else
			$scope.mongo.shardalyzer.watchChunk(skey);
	};

	$scope.watchbox.unwatchChunk = function(shardkey)
	{
		$scope.mongo.shardalyzer.unwatchChunk(shardkey);
	}

	$scope.watchbox.prev = function(shardkey)
	{
		var position = $scope.mongo.ui.slider;

		$scope.mongo.shardalyzer.bttf(position+1, $scope.mongo.ui.shardenabled, { [shardkey] : true });
		$scope.mongo.ui.slider = $scope.mongo.shardalyzer.position;
	}

	$scope.watchbox.next = function(shardkey)
	{
		var position = $scope.mongo.ui.slider;

		$scope.mongo.shardalyzer.bttf(position-1, $scope.mongo.ui.shardenabled, { [shardkey] : true });
		$scope.mongo.ui.slider = $scope.mongo.shardalyzer.position;
	}

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
			this.cancel();
			updateSlider(-1, $scope.mongo.ui.errors);
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
			this.cancel();
			updateSlider(1, $scope.mongo.ui.errors);
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
		var url = '/mongo/query/' + $scope.mongo.host + '/' + $scope.mongo.port + '/' +
			$scope.mongo.configdb + '/' + $scope.query.selectedColl + '/' + $scope.query.query;

		$http
		({
			params: $scope.mongo.auth.config,
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
				growl.error(growlmsg("Failed to run query", $scope.mongo.host + ":" +
					$scope.mongo.port + "/" + $scope.mongo.configdb + "/" + $scope.query.selectedColl, err.message));
			}
		);
	};

	// watch for changes to nsList (i.e. server changed), also grab collections
	// obviously will be mostly the same but may only have subset of collections
	$scope.$watch('mongo.nsList', function(list)
	{
		if($scope.mongo.nsList.length === 0)
			return;

		var url = '/mongo/collections/' + $scope.mongo.host +
			'/' + $scope.mongo.port + '/' + $scope.mongo.configdb;

		$http
		({
			params: $scope.mongo.auth.config,
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