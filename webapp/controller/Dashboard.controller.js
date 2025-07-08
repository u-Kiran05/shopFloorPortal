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
				"ordersByMonthChart", "materialChart", "controllerChart",
				"statusChart", "qtyTrendChart", "leadTimeChart"
			];

			chartIds.forEach(function(id) {
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
			}, this);
		},

		onApplyFilter: function() {
			var view = this.getView();
			var plant = this.byId("plantSelect").getSelectedKey();
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
				error: function() {
					MessageToast.show("Failed to load data");
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

			results.forEach(function(item) {
				totalQty += parseFloat(item.Orderquant || 0);
				materials[item.Matno] = true;
				controllers[item.Controllerco] = true;
			});

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
						this.getOwnerComponent().getModel("session").setData({});
						this.getOwnerComponent().getRouter().navTo("View1", {}, true);
					}
				}.bind(this)
			});
		},

		onNextPress: function() {
			this.getOwnerComponent().getRouter().navTo("Dashboard2");
		},

		_bindCharts: function(data) {
			var monthNames = {
				"01": "Jan",
				"02": "Feb",
				"03": "Mar",
				"04": "Apr",
				"05": "May",
				"06": "Jun",
				"07": "Jul",
				"08": "Aug",
				"09": "Sep",
				"10": "Oct",
				"11": "Nov",
				"12": "Dec"
			};

			var ordersByMonth = {};
			var qtyTrend = {};
			var leadTime = {
				"0-2 days": 0,
				"3-5 days": 0,
				"6+ days": 0
			};

			function groupBy(arr, keyFn) {
				return arr.reduce(function(result, item) {
					var key = typeof keyFn === "function" ? keyFn(item) : item[keyFn];
					if (key) {
						result[key] = (result[key] || 0) + 1;
					}
					return result;
				}, {});
			}

			function groupAndMap(obj) {
				return Object.keys(obj).map(function(k) {
					return {
						label: k,
						count: obj[k]
					};
				});
			}

			function sortMonths(dataList) {
				var monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
					"Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
				];
				return dataList.sort(function(a, b) {
					return monthOrder.indexOf(a.label) - monthOrder.indexOf(b.label);
				});
			}

			data.forEach(function(item) {
				var monthCode = item.Startmonth;
				monthCode = String(monthCode).padStart(2, "0").slice(-2); // Normalize to 2-digit string
				var label = monthNames[monthCode] || monthCode;

				ordersByMonth[label] = (ordersByMonth[label] || 0) + 1;
				qtyTrend[label] = (qtyTrend[label] || 0) + parseFloat(item.Orderquant || 0);

				if (item.Startdate && item.Enddate) {
					var d1 = new Date(item.Startdate);
					var d2 = new Date(item.Enddate);
					var days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
					if (days <= 2) leadTime["0-2 days"]++;
					else if (days <= 5) leadTime["3-5 days"]++;
					else leadTime["6+ days"]++;
				}
			});

			this._setChartDataset("ordersByMonthChart", sortMonths(groupAndMap(ordersByMonth)), "Month", "Orders");
			this._setChartDataset("materialChart", groupAndMap(groupBy(data, "Matdesc")), "Material", "Count");
			this._setChartDataset("controllerChart", groupAndMap(groupBy(data, "Controllername")), "Controller", "Count");
			this._setChartDataset("statusChart", groupAndMap(groupBy(data, "Statustxt")), "Status", "Count");
			this._setChartDataset("qtyTrendChart", sortMonths(groupAndMap(qtyTrend)), "Month", "Quantity");
			this._setChartDataset("leadTimeChart", groupAndMap(leadTime), "Lead Time", "Count");
		},

		_setChartDataset: function(chartId, data, dim, measure) {
			var oVizFrame = this.byId(chartId);
			if (!oVizFrame || !data.length) return;

			var type = "column";
			if (chartId.includes("material")) type = "donut";
			else if (chartId.includes("leadTime")) type = "pie";
			else if (chartId.includes("qtyTrend")) type = "line";
			else if (chartId.includes("controller")) type = "stacked_bar";
			else if (chartId.includes("status")) type = "stacked_column";

			oVizFrame.setVizType(type);
			oVizFrame.destroyDataset();
			oVizFrame.removeAllFeeds();

			oVizFrame.setModel(new JSONModel({
				chartData: data
			}));

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

			var feeds = (type === "pie" || type === "donut") ? [{
				uid: "size",
				type: "Measure",
				values: [measure]
			}, {
				uid: "color",
				type: "Dimension",
				values: [dim]
			}] : [{
				uid: "valueAxis",
				type: "Measure",
				values: [measure]
			}, {
				uid: "categoryAxis",
				type: "Dimension",
				values: [dim]
			}];

			feeds.forEach(function(feed) {
				oVizFrame.addFeed(new FeedItem(feed));
			});
		}
	});
});