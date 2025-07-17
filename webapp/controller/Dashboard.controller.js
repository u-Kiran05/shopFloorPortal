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
				results: [],
				currentPage: 1,
				pageSize: 10,
				totalPages: 1,
				pagedResults: []
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
							visible: true
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

			var totalOrders = results.length;
			var totalQty = 0;
			var materials = {},
				controllers = {};

			results.forEach(function(item) {
				totalQty += parseFloat(item.Orderquant || 0);
				materials[item.Matno] = true;
				controllers[item.Controllerco] = true;
			});

			var pageSize = 10;
			var currentPage = 1;
			var totalPages = Math.ceil(results.length / pageSize);

			this.chartModel.setData({
				results: results,
				currentPage: currentPage,
				pageSize: pageSize,
				totalPages: totalPages,
				pagedResults: results.slice(0, pageSize),
				totalOrders: totalOrders,
				totalQty: totalQty.toFixed(2),
				uniqueMaterials: Object.keys(materials).length,
				uniqueControllers: Object.keys(controllers).length
			});

			this._bindCharts(results);
		},

		_updatePagedResults: function() {
			var model = this.chartModel;
			var all = model.getProperty("/results");
			var page = model.getProperty("/currentPage");
			var size = model.getProperty("/pageSize");

			var start = (page - 1) * size;
			var end = start + size;
			model.setProperty("/pagedResults", all.slice(start, end));
		},

		onNextPage: function() {
			var model = this.chartModel;
			var page = model.getProperty("/currentPage");
			var total = model.getProperty("/totalPages");

			if (page < total) {
				model.setProperty("/currentPage", page + 1);
				this._updatePagedResults();
			}
		},

		onPrevPage: function() {
			var model = this.chartModel;
			var page = model.getProperty("/currentPage");

			if (page > 1) {
				model.setProperty("/currentPage", page - 1);
				this._updatePagedResults();
			}
		},

		onLogoutPress: function() {
			sap.m.MessageBox.confirm("Are you sure you want to logout?", {
				title: "Confirm Logout",
				icon: sap.m.MessageBox.Icon.QUESTION,
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				emphasizedAction: sap.m.MessageBox.Action.YES,
				onClose: function(oAction) {
					if (oAction === sap.m.MessageBox.Action.YES) {
						sap.ui.core.UIComponent.getRouterFor(this).navTo("View1");
					}
				}.bind(this)
			});
		},

		onBack: function() {
			this.getOwnerComponent().getRouter().navTo("View2");
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

			var ordersByMonth = {},
				qtyTrend = {},
				leadTime = {
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
				var monthCode = String(item.Startmonth || "").padStart(2, "0");
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

			var chartTitles = {
				"ordersByMonthChart": "Planned Orders by Month",
				"materialChart": "Orders by Material",
				"controllerChart": "Orders by Controller",
				"statusChart": "Status Distribution",
				"qtyTrendChart": "Quantity Trend",
				"leadTimeChart": "Lead Time Analysis"
			};

			oVizFrame.setVizType(type);
			oVizFrame.destroyDataset();
			oVizFrame.removeAllFeeds();
			oVizFrame.setModel(new JSONModel({
				chartData: data
			}));

			oVizFrame.setDataset(new FlattenedDataset({
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
			}));

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
					visible: true,
					text: chartTitles[chartId] || (dim + " vs " + measure)
				}
			});
		}

	});
});