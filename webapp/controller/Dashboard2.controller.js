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
			this.chartModel = new JSONModel({
				results: []
			});
			this.getView().setModel(this.chartModel, "chart");
			this._initCharts();
		},

		_initCharts: function() {
			var chartIds = [
				"orderTypeChart", "materialProdChart", "plantProdChart", "companyProdChart",
				"qtyProdTrendChart", "statusProdChart", "categoryChart", "controllerProdChart"
			];

			for (var i = 0; i < chartIds.length; i++) {
				var oVizFrame = this.byId(chartIds[i]);
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

		_onDataLoaded: function(oData) {
			var results = oData.results || [];
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

			this.byId("totalOrdersProd").setNumber(String(results.length));
			this.byId("uniqueMaterialsProd").setNumber(String(Object.keys(matSet).length));
			this.byId("plantCountProd").setNumber(String(Object.keys(plantSet).length));
			this.byId("companyCountProd").setNumber(String(Object.keys(compSet).length));

			this._bindCharts(results);
		},

		_bindCharts: function(data) {
			function groupBy(arr, keyFn) {
				var result = {};
				for (var i = 0; i < arr.length; i++) {
					var key = typeof keyFn === "function" ? keyFn(arr[i]) : arr[i][keyFn];
					if (key !== undefined && key !== null && key !== "") {
						key = String(key); // ensure it's a string
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

			//console.log("Sample record:", data[0]);

			// Log check for each field
			// Sample record
			//console.log("Sample record:", data[0]);

			// Replace arrow functions with ES5 function syntax
			//console.log("Order_Type_Code values:", data.map(function(d) { return d.Order_Type_Code; }));
			//console.log("Material_Desc values:", data.map(function(d) { return d.Material_Desc; }));
			//console.log("Plant_Name values:", data.map(function(d) { return d.Plant_Name; }));
			//console.log("Companyname values:", data.map(function(d) { return d.Companyname; }));
			//console.log("Order_Type_Text values:", data.map(function(d) { return d.Order_Type_Text; }));
			//console.log("Mrpcontrollername values:", data.map(function(d) { return d.Mrpcontrollername; }));

			var qtyTrend = {};
			for (var j = 0; j < data.length; j++) {
				var item = data[j];
				var month = item.Startmonth;
				var qty = parseFloat(item.Orderquantity || 0);
				if (month !== "") {
					qtyTrend[String(month)] = (qtyTrend[month] || 0) + qty;
				}
			}

			this._setChartDataset("orderTypeChart", groupAndMap(groupBy(data, "Order_Type_Code")), "Type", "Count");
			this._setChartDataset("materialProdChart", groupAndMap(groupBy(data, "Material_Desc")), "Material", "Count");
			this._setChartDataset("plantProdChart", groupAndMap(groupBy(data, "Plant_Name")), "Plant", "Count");
			this._setChartDataset("companyProdChart", groupAndMap(groupBy(data, "Companyname")), "Company", "Count");
			this._setChartDataset("qtyProdTrendChart", groupAndMap(qtyTrend), "Month", "Quantity");
			this._setChartDataset("statusProdChart", groupAndMap(groupBy(data, "Order_Type_Text")), "Status", "Count");
			this._setChartDataset("categoryChart", groupAndMap(groupBy(data, "Ordercategory")), "Category", "Count");
			this._setChartDataset("controllerProdChart", groupAndMap(groupBy(data, "Mrpcontrollername")), "Controller", "Count");
		},

		_setChartDataset: function(chartId, data, dim, measure) {
			var oViz = this.byId(chartId);
			if (!oViz) {
				//console.warn("Chart ID not found:", chartId);
				return;
			}

			if (!data || data.length === 0) {
				//console.warn("No data for chart:", chartId);
				return;
			}

			//	console.log("Rendering chart:", chartId);
			//console.log("Dimension:", dim, "Measure:", measure);
			//console.log("Chart Data:", data);

			var typeMap = {
				"orderTypeChart": "pie",
				"materialProdChart": "donut",
				"plantProdChart": "column",
				"companyProdChart": "stacked_column",
				"qtyProdTrendChart": "line",
				"statusProdChart": "heatmap",
				"categoryChart": "column",
				"controllerProdChart": "stacked_bar"
			};

			try {
				var type = typeMap[chartId] || "column";
				oViz.setVizType(type);
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

				var feeds = this._getFeedsForType(type, dim, measure);
				//	console.log("Feed config for", chartId, ":", feeds);
				for (var i = 0; i < feeds.length; i++) {
					oViz.addFeed(new FeedItem(feeds[i]));
				}
			} catch (e) {
				//console.error("Chart error in " + chartId + ":", e);
			}
		},

		_getFeedsForType: function(type, dim, measure) {
			if (type === "pie" || type === "donut") {
				return [{
					uid: "size",
					type: "Measure",
					values: [measure]
				}, {
					uid: "color",
					type: "Dimension",
					values: [dim]
				}];
			} else if (type === "heatmap") {
				return [{
					uid: "color",
					type: "Measure",
					values: [measure]
				}, {
					uid: "categoryAxis",
					type: "Dimension",
					values: [dim]
				}, {
					uid: "valueAxis",
					type: "Dimension",
					values: [dim]
				}];
			} else if (type === "line") {
				return [{
					uid: "valueAxis",
					type: "Measure",
					values: [measure]
				}, {
					uid: "categoryAxis",
					type: "Dimension",
					values: [dim]
				}];
			} else {
				return [{
					uid: "valueAxis",
					type: "Measure",
					values: [measure]
				}, {
					uid: "categoryAxis",
					type: "Dimension",
					values: [dim]
				}];
			}
		}
	});
});