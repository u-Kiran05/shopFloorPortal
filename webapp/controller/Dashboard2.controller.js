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

		onBackPress: function() {
			sap.ui.core.UIComponent.getRouterFor(this).navTo("Dashboard");
		},

		onLogoutPress: function() {
			var oSessionModel = this.getOwnerComponent().getModel("session");
			if (oSessionModel) {
				oSessionModel.setData({});
			}
			sap.ui.core.UIComponent.getRouterFor(this).navTo("View1", {}, true);
			MessageToast.show("You have been logged out.");
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
							visible: false
						}
					});
				}
			}
		},

		onApplyFilter: function() {
			var plant = this.byId("plantId").getValue().trim();
			var year = this.byId("yearPicker").getSelectedKey();
			var month = this.byId("monthPicker").getSelectedKey();

			if (!plant) {
				MessageToast.show("Please enter Plant ID");
				return;
			}

			var filters = [
				new sap.ui.model.Filter("PlantCode", "EQ", plant)
			];

			if (year) {
				filters.push(new sap.ui.model.Filter("Endyear", "EQ", year));
			}
			if (month) {
				filters.push(new sap.ui.model.Filter("Endmonth", "EQ", month));
			}

			console.log("📤 Filter Parameters:", {
				Plant: plant,
				Year: year,
				Month: month,
				ODataFilters: filters
			});

			this.oModel.read("/ZProductionDetailsSet", {
				filters: filters,
				success: function(oData) {
					console.log("✅ Raw OData Results:", oData.results || []);

					var filteredResults = oData.results || [];

					// If you want to do additional client-side filtering by date, do it here.
					// Example: filter by Startdate's year/month if not already done in OData

					console.log("✅ Final Filtered Results Sent to _onDataLoaded:", filteredResults);
					this._onDataLoaded({
						results: filteredResults
					});
				}.bind(this),

				error: function(oError) {
					console.error("❌ Failed to fetch data from ZProductionDetailsSet", oError);
					MessageToast.show("Failed to load production data.");
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
				if (r.Material_No) matSet[r.Material_No] = true;
				if (r.Plant_Code) plantSet[r.Plant_Code] = true;
				if (r.Company_Code) compSet[r.Company_Code] = true;
			}

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
				var label = monthNames[item.Startmonth] || item.Startmonth;
				var qty = parseFloat(item.Orderquantity || 0);
				if (label) {
					if (!qtyTrend[label]) {
						qtyTrend[label] = 0;
					}
					qtyTrend[label] += qty;
				}
			}

			var categoryCount = {};
			for (var j = 0; j < data.length; j++) {
				var cat = data[j].Ordercategory || "Unknown";
				if (!categoryCount[cat]) {
					categoryCount[cat] = 0;
				}
				categoryCount[cat]++;
			}

			this._setChartDataset("qtyProdTrendChart", this._groupMap(qtyTrend), "Month", "Quantity", "line");
			this._setChartDataset("categoryChart", this._groupMap(categoryCount), "Category", "Count", "column");
		},

		_groupMap: function(groupObj) {
			var list = [];
			for (var key in groupObj) {
				if (groupObj.hasOwnProperty(key)) {
					list.push({
						label: key,
						count: groupObj[key]
					});
				}
			}
			return list;
		},

		_setChartDataset: function(chartId, data, dim, measure, chartType) {
			var oViz = this.byId(chartId);
			if (!oViz || !data || data.length === 0) {
				return;
			}

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