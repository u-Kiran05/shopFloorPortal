sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/viz/ui5/data/FlattenedDataset",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/viz/ui5/controls/common/feeds/FeedItem",
	"sap/m/MessageBox"
], function(Controller, FlattenedDataset, JSONModel, MessageToast, FeedItem, MessageBox) {
	"use strict";

	return Controller.extend("shopFloor.controller.Dashboard", {

		onInit: function() {
			this.oModel = this.getOwnerComponent().getModel("sf");
			this.chartModel = new JSONModel({
				results: []
			});
			this.getView().setModel(this.chartModel, "chart");
			this._initCharts();
		},

		_initCharts: function() {
			var chartIds = [
				"ordersByMonthChart", "materialChart", "controllerChart", "statusChart",
				"ordersYearMonthChart", "plannerGroupChart", "qtyTrendChart", "leadTimeChart"
			];

			for (var i = 0; i < chartIds.length; i++) {
				var id = chartIds[i];
				var oVizFrame = this.byId(id);
				if (oVizFrame) {
					oVizFrame.setVizProperties({
						plotArea: {
							dataLabel: {
								visible: true
							}
						},
						legend: {
							visible: true
						},
						title: {
							visible: false
						}
					});
				}
			}
		},

		onApplyFilter: function() {
			var view = this.getView();
			var plant = view.byId("plantId").getValue().trim();
			var year = view.byId("yearPicker").getSelectedKey();
			var month = view.byId("monthPicker").getSelectedKey();

			if (!plant) {
				MessageToast.show("Please enter Plant ID");
				return;
			}

			var filters = [new sap.ui.model.Filter("Plantcode", "EQ", plant)];
			if (year) filters.push(new sap.ui.model.Filter("Startyear", "EQ", year));
			if (month) filters.push(new sap.ui.model.Filter("Startmonth", "EQ", month));

			this.oModel.read("/ZPlannedDetailsSet", {
				filters: filters,
				success: this._onDataLoaded.bind(this),
				error: function(err) {
					MessageToast.show("Failed to load data");
				//	console.error("OData Error:", err);
				}
			});
		},

		_onDataLoaded: function(oData) {
			var results = oData.results || [];
			this.chartModel.setProperty("/results", results);

			var totalOrders = results.length;
			var totalQty = 0;
			var materials = {},
				controllers = {};

			for (var i = 0; i < results.length; i++) {
				var item = results[i];
				totalQty += parseFloat(item.Orderquant) || 0;
				materials[item.Matno] = true;
				controllers[item.Controllerco] = true;
			}

			this.byId("totalOrders").setNumber(String(totalOrders));
			this.byId("totalQty").setNumber(totalQty.toFixed(2));
			this.byId("uniqueMaterials").setNumber(String(Object.keys(materials).length));
			this.byId("uniqueControllers").setNumber(String(Object.keys(controllers).length));

			this._bindCharts(results);
		},
		onLogoutPress: function() {
			sap.m.MessageBox.confirm("Are you sure you want to logout?", {
				onClose: function(oAction) {
					if (oAction === sap.m.MessageBox.Action.OK) {
						this.getOwnerComponent().getRouter().navTo("Login");
					}
				}.bind(this)
			});
		},
onNextPress: function () {
	this.getOwnerComponent().getRouter().navTo("Dashboard2");
},

		_bindCharts: function(data) {
			function groupBy(arr, keyFn) {
				var result = {};
				for (var i = 0; i < arr.length; i++) {
					var key = typeof keyFn === "function" ? keyFn(arr[i]) : arr[i][keyFn];
					if (key) {
						if (!result[key]) result[key] = 0;
						result[key]++;
					}
				}
				return result;
			}

			function groupAndMap(groupObj) {
				var list = [];
				for (var label in groupObj) {
					list.push({
						label: label,
						count: groupObj[label]
					});
				}
				return list;
			}

			var qtyTrend = {};
			var leadTime = {
				"0-2 days": 0,
				"3-5 days": 0,
				"6+ days": 0
			};

			for (var i = 0; i < data.length; i++) {
				var item = data[i];
				var month = item.Startmonth;
				var qty = parseFloat(item.Orderquant || 0);
				qtyTrend[month] = (qtyTrend[month] || 0) + qty;

				if (item.Startdate && item.Enddate) {
					var d1 = new Date(item.Startdate);
					var d2 = new Date(item.Enddate);
					var days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
					if (days <= 2) leadTime["0-2 days"]++;
					else if (days <= 5) leadTime["3-5 days"]++;
					else leadTime["6+ days"]++;
				}
			}

			this._setChartDataset("ordersByMonthChart", groupAndMap(groupBy(data, "Startmonth")), "Month", "Orders");
			this._setChartDataset("materialChart", groupAndMap(groupBy(data, "Matdesc")), "Material", "Count");
			this._setChartDataset("controllerChart", groupAndMap(groupBy(data, "Controllername")), "Controller", "Count");
			this._setChartDataset("statusChart", groupAndMap(groupBy(data, "Statustxt")), "Status", "Count");
			this._setChartDataset("ordersYearMonthChart", groupAndMap(groupBy(data, function(item) {
				return item.Startyear + "-" + item.Startmonth;
			})), "Year-Month", "Orders");
			this._setChartDataset("plannerGroupChart", groupAndMap(groupBy(data, "Groupname")), "Planner Group", "Orders");
			this._setChartDataset("qtyTrendChart", groupAndMap(qtyTrend), "Month", "Quantity");
			this._setChartDataset("leadTimeChart", groupAndMap(leadTime), "Lead Time", "Count");
		},

		_setChartDataset: function(chartId, data, dim, measure) {
			var oVizFrame = this.byId(chartId);
			if (!oVizFrame || !data.length) return;

			if (chartId.indexOf("material") > -1) {
				oVizFrame.setVizType("donut");
			} else if (chartId.indexOf("leadTime") > -1) {
				oVizFrame.setVizType("pie");
			} else if (chartId.indexOf("qtyTrend") > -1) {
				oVizFrame.setVizType("line");
			} else if (chartId.indexOf("ordersYearMonth") > -1) {
				oVizFrame.setVizType("combination");
			} else if (chartId.indexOf("plannerGroup") > -1) {
				oVizFrame.setVizType("heatmap");
			} else if (chartId.indexOf("controller") > -1) {
				oVizFrame.setVizType("stacked_bar");
			} else if (chartId.indexOf("status") > -1) {
				oVizFrame.setVizType("stacked_column");
			} else {
				oVizFrame.setVizType("column");
			}

			oVizFrame.destroyDataset();
			oVizFrame.removeAllFeeds();

			var oDataModel = new JSONModel({
				chartData: data
			});

			var oDataset = new FlattenedDataset({
				dimensions: [{
					name: dim,
					value: "{label}"
				}],
				measures: [{
					name: measure,
					value: "{count}"
				}],
				data: {
					path: "/chartData"
				}
			});

			oVizFrame.setDataset(oDataset);
			oVizFrame.setModel(oDataModel);

			var chartType = oVizFrame.getVizType();
			if (chartType === "pie" || chartType === "donut") {
				oVizFrame.addFeed(new FeedItem({
					uid: "size",
					type: "Measure",
					values: [measure]
				}));
				oVizFrame.addFeed(new FeedItem({
					uid: "color",
					type: "Dimension",
					values: [dim]
				}));
			} else if (chartType === "heatmap") {
				oVizFrame.addFeed(new FeedItem({
					uid: "color",
					type: "Measure",
					values: [measure]
				}));
				oVizFrame.addFeed(new FeedItem({
					uid: "categoryAxis",
					type: "Dimension",
					values: [dim]
				}));
				oVizFrame.addFeed(new FeedItem({
					uid: "valueAxis",
					type: "Dimension",
					values: [dim]
				}));
			} else if (chartType === "combination") {
				oVizFrame.addFeed(new FeedItem({
					uid: "valueAxis",
					type: "Measure",
					values: [measure]
				}));
				oVizFrame.addFeed(new FeedItem({
					uid: "lineAxis",
					type: "Measure",
					values: [measure]
				}));
				oVizFrame.addFeed(new FeedItem({
					uid: "categoryAxis",
					type: "Dimension",
					values: [dim]
				}));
			} else {
				oVizFrame.addFeed(new FeedItem({
					uid: "valueAxis",
					type: "Measure",
					values: [measure]
				}));
				oVizFrame.addFeed(new FeedItem({
					uid: "categoryAxis",
					type: "Dimension",
					values: [dim]
				}));
			}
		}

	});
});