sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/viz/ui5/data/FlattenedDataset",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/viz/ui5/controls/common/feeds/FeedItem"
], function(Controller, FlattenedDataset, JSONModel, MessageToast, FeedItem) {
	"use strict";

	return Controller.extend("shopFloor.controller.Dashboard2", {

		onInit: function() {
			this.oModel = this.getOwnerComponent().getModel("sf");
			this.chartModel = new JSONModel({
				results: [],
				total: "0",
				uniqueMaterials: "0",
				plants: "0",
				companies: "0"
			});
			this.getView().setModel(this.chartModel, "chart");
			this._initCharts();
		},
		onNextPage: function() {
			var model = this.getView().getModel("chart");
			var page = model.getProperty("/currentPage");
			var total = model.getProperty("/totalPages");

			if (page < total) {
				model.setProperty("/currentPage", page + 1);
				this._updatePagedResults();
			}
		},
		onPrevPage: function() {
			var model = this.getView().getModel("chart");
			var page = model.getProperty("/currentPage");

			if (page > 1) {
				model.setProperty("/currentPage", page - 1);
				this._updatePagedResults();
			}
		},
		_updatePagedResults: function() {
			var model = this.getView().getModel("chart");
			var all = model.getProperty("/results");
			var page = model.getProperty("/currentPage");
			var size = model.getProperty("/pageSize");

			var start = (page - 1) * size;
			var end = start + size;
			model.setProperty("/pagedResults", all.slice(start, end));
		},
		onBack: function() {
			this.getOwnerComponent().getRouter().navTo("View2");
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

		_initCharts: function() {
			var chartIds = ["qtyProdTrendChart", "categoryChart"];
			for (var i = 0; i < chartIds.length; i++) {
				var oViz = this.byId(chartIds[i]);
				if (oViz) {
					oViz.setVizProperties({
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
			}
		},

		onApplyFilter: function() {
			var plant = this.byId("plantSelect").getSelectedKey();
			var year = this.byId("yearPicker").getSelectedKey();
			var month = this.byId("monthPicker").getSelectedKey();

			if (!plant) {
				sap.m.MessageToast.show("Please select a Plant ID");
				return;
			}

			var filters = [new sap.ui.model.Filter("PlantCode", "EQ", plant)];

			if (year) {
				filters.push(new sap.ui.model.Filter("Startyear", "EQ", year));
			}
			if (month) {
				filters.push(new sap.ui.model.Filter("Startmonth", "EQ", month));
			}

			var that = this;
			this.oModel.read("/ZProductionDetailsSet", {
				filters: filters,
				success: function(oData) {
					var results = oData.results || [];
					if (results.length === 0) {
						sap.m.MessageToast.show("No production data found for the selected filters.");
					}
					that._onDataLoaded({
						results: results
					});
				},
				error: function() {
					sap.m.MessageToast.show("Error fetching production data.");
				}
			});
		},

		_onDataLoaded: function(oData) {
			var results = oData.results || [];

			if (results.length === 0) {
				this.chartModel.setProperty("/results", []);
				this.chartModel.setProperty("/total", "0");
				this.chartModel.setProperty("/uniqueMaterials", "0");
				this.chartModel.setProperty("/plants", "0");
				this.chartModel.setProperty("/companies", "0");
				this._clearCharts();
				MessageToast.show("No data found for the selected filters.");
				return;
			}

			this.chartModel.setProperty("/results", results);

			var matSet = {},
				plantSet = {},
				compSet = {};
			for (var i = 0; i < results.length; i++) {
				var r = results[i];
				if (r.Material_No) {
					matSet[r.Material_No] = true;
				}
				if (r.Plant_Code) {
					plantSet[r.Plant_Code] = true;
				}
				if (r.Company_Code) {
					compSet[r.Company_Code] = true;
				}
			}
			this.chartModel.setProperty("/currentPage", 1);
			this.chartModel.setProperty("/pageSize", 10);
			this.chartModel.setProperty("/totalPages", Math.ceil(results.length / 10));
			this._updatePagedResults();

			this.chartModel.setProperty("/total", String(results.length));
			this.chartModel.setProperty("/uniqueMaterials", String(Object.keys(matSet).length));
			this.chartModel.setProperty("/plants", String(Object.keys(plantSet).length));
			this.chartModel.setProperty("/companies", String(Object.keys(compSet).length));

			this._bindCharts(results);
		},

		_clearCharts: function() {
			var chartIds = ["qtyProdTrendChart", "categoryChart"];
			for (var i = 0; i < chartIds.length; i++) {
				var oViz = this.byId(chartIds[i]);
				if (oViz) {
					oViz.destroyDataset();
					oViz.removeAllFeeds();
					oViz.setModel(new JSONModel({
						chartData: []
					}));
					oViz.rerender();
				}
			}
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

			var qtyTrend = {};
			for (var i = 0; i < data.length; i++) {
				var item = data[i];
				var m = item.Startmonth;
				if (m && m.length > 2) {
					m = m.slice(-2); // Get last 2 chars (i.e., 0006 -> 06)
				}
				var label = monthNames[m] || m;
				var qty = parseFloat(item.Orderquantity || 0);
				if (label) {
					if (!qtyTrend[label]) {
						qtyTrend[label] = 0;
					}
					qtyTrend[label] += qty;
				}
			}

			var categoryLabels = {
				"10": "Standard",
				"30": "Rush"
			};
			var categoryCount = {};
			for (var j = 0; j < data.length; j++) {
				var rawCat = data[j].Ordercategory || "Unknown";
				var cat = categoryLabels[rawCat] || rawCat;
				if (!categoryCount[cat]) {
					categoryCount[cat] = 0;
				}
				categoryCount[cat]++;
			}

			this._setChartDataset("qtyProdTrendChart", this._groupMap(qtyTrend, "month"), "Month", "Quantity", "line");
			this._setChartDataset("categoryChart", this._groupMap(categoryCount), "Category", "Count", "column");
		},

		_groupMap: function(groupObj, type) {
			var list = [];
			for (var key in groupObj) {
				if (groupObj.hasOwnProperty(key)) {
					list.push({
						label: key,
						count: groupObj[key]
					});
				}
			}

			if (type === "month") {
				var monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
				list.sort(function(a, b) {
					return monthOrder.indexOf(a.label) - monthOrder.indexOf(b.label);
				});
			}

			return list;
		},

		_setChartDataset: function(chartId, data, dim, measure, chartType) {
			var oViz = this.byId(chartId);
			if (!oViz || !data || data.length === 0) return;

			try {
				oViz.setVizType(chartType);
				oViz.destroyDataset();
				oViz.removeAllFeeds();

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

				var oModel = new JSONModel({
					chartData: data
				});
				oViz.setDataset(oDataset);
				oViz.setModel(oModel);

				oViz.setVizProperties({
					title: {
						visible: true,
						text: (chartType === "line") ? "Quantity Trend by Month" :
							(chartType === "column") ? "Order Category Distribution" : "Chart"
					},
					legend: {
						visible: true
					},
					plotArea: {
						dataLabel: {
							visible: true
						},
						margin: {
							bottom: 0,
							top: 20,
							left: 20,
							right: 20
						}
					}
				});

				oViz.addFeed(new FeedItem({
					uid: "valueAxis",
					type: "Measure",
					values: [measure]
				}));
				oViz.addFeed(new FeedItem({
					uid: "categoryAxis",
					type: "Dimension",
					values: [dim]
				}));
			} catch (e) {
				jQuery.sap.log.error("Chart error in " + chartId + ":", e);
			}
		}

	});
});