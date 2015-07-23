
var shardvis = angular.module('shard-vis', ["tc.chartjs"]).run
(
	function($rootScope)
	{
		$rootScope.mongo = {};

		// initial settings
		$rootScope.mongo.host = "localhost";
		$rootScope.mongo.port = 27017;

		$rootScope.mongo.shardalyzer = Shardalyzer;
	}
);

shardvis.controller
(
	'dbList',
	function ($scope, $http)
	{
		$scope.mongo.selectedDB = null;
		$scope.mongo.dbList = [];

		var updateDBList = function(selected)
		{
			var url = '/mongo/dbs/'
				.concat($scope.mongo.host).concat('/').concat($scope.mongo.port);

			$http
			({
				method: 'GET',
				url: url
			})
			.success
			(
				function (result)
				{
					$scope.mongo.dbList = result;
				}
			);
		};

		$scope.$watch('mongo.host', updateDBList);
		$scope.$watch('mongo.port', updateDBList);
	}
);

shardvis.controller
(
	'collList',
	function ($scope, $http)
	{
		$scope.mongo.selectedColl = null;
		$scope.mongo.collList = [];

		$scope.$watch('mongo.selectedDB', function(selected)
		{
			var url =
				'/mongo/collections/'
					.concat($scope.mongo.host).concat('/')
						.concat($scope.mongo.port).concat('/').concat(selected);

			$http
			({
				method: 'GET',
				url: url
			})
			.success
			(
				function (result)
				{
					$scope.mongo.collList = result;
				}
			);
		});

		$scope.$watch('mongo.selectedColl', function(selected)
		{
			var url =
				'/mongo/metadata/'
					.concat($scope.mongo.host).concat('/')
						.concat($scope.mongo.port).concat('/')
							.concat($scope.mongo.selectedDB).concat('/')
								.concat($scope.mongo.selectedColl);

			$http
			({
				method: 'GET',
				url: url
			})
			.success
			(
				function (result)
				{
					$scope.mongo.metadata = result;
					$scope.mongo.shardalyzer.initialize(result.chunks, result.changelog);
				}
			);
		});
	}
);

shardvis.controller("showChart", function ($scope)
{
	console.log('chart handler');

	$scope.chartmeta = {};

	$scope.$watch('mongo.shardalyzer.shards["shard01"]', function(chunks)
	{
		$scope.chartmeta.data = [];

		for(var k in chunks)
		{
			var entry =
			{
				value: 1,
				color: '#FDB45C',
				highlight: '#FFC870',
				label: s(chunks[k])
			};

			$scope.chartmeta.data.push(entry);
		}
	});

	// Chart.js Options
    $scope.chartmeta.options =  {

      // Sets the chart to be responsive
      responsive: true,

      //Boolean - Whether we should show a stroke on each segment
      segmentShowStroke : true,

      //String - The colour of each segment stroke
      segmentStrokeColor : '#fff',

      //Number - The width of each segment stroke
      segmentStrokeWidth : 2,

      //Number - The percentage of the chart that we cut out of the middle
      percentageInnerCutout : 75, // This is 0 for Pie charts

      //Number - Amount of animation steps
      animationSteps : 250,

      //String - Animation easing effect
      animationEasing : 'easeOutQuint',

      //Boolean - Whether we animate the rotation of the Doughnut
      animateRotate : true,

      //Boolean - Whether we animate scaling the Doughnut from the centre
      animateScale : false,

      //String - A legend template
      legendTemplate : '<ul class="tc-chart-js-legend"><% for (var i=0; i<segments.length; i++){%><li><span style="background-color:<%=segments[i].fillColor%>"></span><%if(segments[i].label){%><%=segments[i].label%><%}%></li><%}%></ul>'
    };
});
