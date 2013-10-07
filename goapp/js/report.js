// Copyright 2013 Martin Schnabel. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

define(["angular", "conn"], function(goapp) {

var errorPattern = /^((\/(?:[^\/\s]+\/)+)?(\S+\.go))\:(\d+)\:(?:(\d+)\:)?(.*)[\n]?$/;
var filePathsPattern = /(\/([^\/\s]+\/)+(\S+\.go))\:(\d+)(?:\:(\d+))?\:/g;
var fileNamesPattern = /\n[\s]*((\S+\.go)\:(\d+)(?:\:\d+)?\:)/g;

function prepare(report, markers) {
	report.Res = report.Test.Result || report.Src.Result;
	report.Status = report.Res.Errmsg != null ? "fail" : "ok";
	// collect file names
	var i, files = [], markermap = {};
	if (report.Src && report.Src.Info) {
		files = files.concat(report.Src.Info.Files);
	}
	if (report.Test && report.Test.Info) {
		files = files.concat(report.Test.Info.Files);
	}
	for (i=0; i < files.length; i++) {
		markermap[report.Dir+"/"+files[i].Name] = [];
	}
	if (report.Res.Errmsg && report.Res.Output) {
		// parse error markers
		var lines = report.Res.Output;
		for (i=0; i < lines.length; i++) {
			var match = lines[i].match(errorPattern);
			if (!match) {
				continue;
			}
			var path = match[2] ? match[1] : report.Dir +"/"+ match[3];
			if (markermap[path] === undefined) {
				continue;
			}
			markermap[path].push({
				row: parseInt(match[4], 10) - 1,
				column: match[5] ? parseInt(match[5], 10)-1 : -1,
				text: match[6].trim(),
				type: "error",
			});
		}
	}
	for (i in markermap) {
		markers[i] = markermap[i];
	}
	// add html links to file paths to the output
	if (report.Res.Output) {
		var text = report.Res.Output.join("");
		text = text.replace(filePathsPattern, '<a href="#/file$1#L$4">$2$3:$4</a>');
		text = text.replace(fileNamesPattern, '\n<a href="#/file' + report.Dir + '/$2#L$3">$1</a>');
		report.Text = text.replace(/(^(#.*|\S)\n|\n#[^\n]*)/g, "");
	}
}

angular.module("goapp.report", ["goapp.conn"])
.config(function($routeProvider) {
	$routeProvider.when("/report", {
		controller: "TabCtrl",
		template: '<div id="report" report></div>',
	}).otherwise({
		redirectTo: "/report",
	});
})
.run(function($rootScope) {
	var tab = $rootScope.tabs.get("/report");
	var r = $rootScope.reports = {map:{}, list:[]};
	var m = $rootScope.markers = {};
	function add(reports) {
		if (!reports) {
			return;
		}
		var i, id, old, report;
		for (i=0; i < reports.length; i++) {
			report = reports[i];
			prepare(report, m);
			old = r.map[report.Id];
			report.ShowDetail = old ? old.ShowDetail : false;
			r.map[report.Id] = report;
		}
		r.list.length = 0;
		tab.error = false;
		for (id in r.map) {
			report = r.map[id];
			tab.error = tab.error || report.Res.Errmsg != null;
			r.list.push(report);
		}
		$rootScope.$digest();
	}
	$rootScope.$on("conn.msg", function(e, msg) {
		if (msg.Head == "report") {
			add(msg.Data);
		}
	});
})
.filter("reportIcon", function() {
	return function(detail) { return detail ? "icon-minus" : "icon-plus" };
})
.directive("report", function() {
	return {
		restrict: "AE",
		replace: true,
		template: [
			'<ul><li class="report report-{{r.Status}}" ng-repeat="r in reports.list | orderBy:\'Path\'">',
			'<span class="status">{{r.Status|uppercase}} <i ng-show="r.Text" ng-click="r.ShowDetail = !r.ShowDetail" class="{{ r.ShowDetail|reportIcon }}"></i></span>',
			'<span>{{r.Res.Mode}}</span> <a ng-href="#/file{{ r.Dir }}">{{r.Path}}</a> {{r.Res.Errmsg}}',
			'<pre ng-show="r.Text && r.ShowDetail" ng-bind-html-unsafe="r.Text"></pre>',
			'</li></ul>',
		].join(""),
	};
});
});
