
var shardvis = angular.module('shard-vis', []).run
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

/*
angular.module("shard-vis", ["chart.js"]).controller("RadarCtrl", function ($scope, $http)
{
	$scope.labels =[];
	$scope.data = [];

	$http
	({
		method: 'GET',
		url: 'http://localhost:3000/mongo/metadata/localhost/27017/bootcamp/twitter'
	}).success
	(
		function (result)
		{
			for(entry in result['shard01'])
			{
				$scope.data.push(1);
				$scope.labels.push(entry);
			}
		}
	);
});
*/