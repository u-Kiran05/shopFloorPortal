sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/viz/ui5/data/FlattenedDataset",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/viz/ui5/controls/common/feeds/FeedItem",
	"sap/m/MessageBox"
], function(Controller, FlattenedDataset, JSONModel, MessageToast, FeedItem, MessageBox) {
	"use strict";

	return Controller.extend("shopFloor.controller.Dashboard2", {

		onInit: function() {
			this.oModel = this.getOwnerComponent().getModel("sf");
			this.chartModel = new JSONModel({ results: [] });
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
			sap.m.MessageToast.show("You have been logged out.");
		},

		_initCharts: function() {
			var chartIds = ["qtyProdTrendChart", "categoryChart"];
			for (var i = 0; i < chartIds.length; i++) {
				var oVizFrame = this.byId(chartIds[i]);
				if (oVizFrame) {
					oVizFrame.setVizProperties({
						plotArea: {
							dataLabel: { visible: true }
						},
						legend: { visible: true },
						title: { visible: false }
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

			var filters = [new sap.ui.model.Filter("PlantCode", "EQ", plant)];
			if (year) filters.push(new sap.ui.model.Filter("Endyear", "EQ", year));
			if (month) filters.push(new sap.ui.model.Filter("Endmonth", "EQ", month));

			this.oModel.read("/ZProductionDetailsSet", {
				filters: filters,
				success: this._onDataLoaded.bind(this),
				error: function() {
					MessageToast.show("Failed to load production data");
				}
			});
		},

		onFilterChange: function() {
			this.onApplyFilter();
		},

		_onDataLoaded: function(oData) {
			var results = oData.results || [];
			this.chartModel.setProperty("/results", results);

			var matSet = {}, plantSet = {}, compSet = {};
			for (var i = 0; i < results.length; i++) {
				var r = results[i];
				if (r.Material_No) matSet[r.Material_No] = true;
				if (r.Plant_Code) plantSet[r.Plant_Code] = true;
				if (r.Company_Code) compSet[r.Company_Code] = true;
			}

			this.byId("totalOrdersProd").setNumber(String(results.length));
			this.byId("uniqueMaterialsProd").setNumber(String(Object.keys(matSet).length));
			this.byId("plantCountProd").setNumber(String(Object.keys(plantSet).length));
			this.byId("companyCountProd").setNumber(String(Object.keys(compSet).length));

			this._bindCharts(results);
		},

		_bindCharts: function(data) {
			var monthNames = {
				"01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
				"05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
				"09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec"
			};

			var qtyTrend = {};
			for (var j = 0; j < data.length; j++) {
				var item = data[j];
				var month = item.Startmonth;
				var label = monthNames[month] || month;
				var qty = parseFloat(item.Orderquantity || 0);
				if (label !== "") {
					qtyTrend[label] = (qtyTrend[label] || 0) + qty;
				}
			}

			this._setChartDataset("qtyProdTrendChart", this._groupAndMap(qtyTrend), "Month", "Quantity");
			this._setChartDataset("categoryChart", this._groupAndMap(this._groupBy(data, "Ordercategory")), "Category", "Count");
		},

		_groupBy: function(arr, keyFn) {
			var result = {};
			for (var i = 0; i < arr.length; i++) {
				var key = typeof keyFn === "function" ? keyFn(arr[i]) : arr[i][keyFn];
				if (key !== undefined && key !== null && key !== "") {
					key = String(key);
					if (!result[key]) result[key] = 0;
					result[key]++;
				}
			}
			return result;
		},

		_groupAndMap: function(groupObj) {
			var list = [];
			for (var label in groupObj) {
				list.push({ label: label, count: groupObj[label] });
			}
			return list;
		},

		_setChartDataset: function(chartId, data, dim, measure) {
			var oViz = this.byId(chartId);
			if (!oViz || !data || data.length === 0) return;

			var typeMap = {
				"qtyProdTrendChart": "line",
				"categoryChart": "column"
			};

			try {
				var type = typeMap[chartId] || "column";
				oViz.setVizType(type);
				oViz.destroyDataset();
				oViz.removeAllFeeds();

				var oDataset = new FlattenedDataset({
					dimensions: [{ name: dim, value: "{label}" }],
					measures: [{ name: measure, value: "{count}" }],
					data: { path: "/chartData" }
				});

				var oModel = new JSONModel({ chartData: data });
				oViz.setDataset(oDataset);
				oViz.setModel(oModel);

				var feeds = [{
					uid: "valueAxis",
					type: "Measure",
					values: [measure]
				}, {
					uid: "categoryAxis",
					type: "Dimension",
					values: [dim]
				}];

				for (var i = 0; i < feeds.length; i++) {
					oViz.addFeed(new FeedItem(feeds[i]));
				}
			} catch (e) {
				console.error("Chart error in " + chartId + ":", e);
			}
		}
	});
});