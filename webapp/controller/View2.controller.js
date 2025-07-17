sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageBox"
], function(Controller, MessageBox) {
	"use strict";

	return Controller.extend("shopFloor.controller.View2", {
		onInit: function() {},

		onPlannedOrdersPress: function() {
			this.getOwnerComponent().getRouter().navTo("Dashboard");
		},
		onLogout: function() {
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

			onProductionOrdersPress: function() {
			this.getOwnerComponent().getRouter().navTo("Dashboard2");
		}
	});
});