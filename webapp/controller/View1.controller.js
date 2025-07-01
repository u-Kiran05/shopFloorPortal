sap.ui.define([
	"sap/ui/core/mvc/Controller"
], function(Controller) {

	"use strict";

return Controller.extend("shopFloor.controller.View1", {
		onLoginPress: function () {
			var oView = this.getView();
			var empId = oView.byId("userIdInput").getValue().trim();
			var password = oView.byId("passwordInput").getValue().trim();
			var oMsgStrip = oView.byId("msgStrip");

			// Validate input
			if (!empId || !password) {
				oMsgStrip.setVisible(true);
				oMsgStrip.setText("Please enter both User ID and Password.");
				oMsgStrip.setType("Warning");
				return;
			}

			// Ensure EmpId is 8 characters
			var paddedEmpId = empId.padStart(8, '0');

			// Get the default OData model
			var oModel = this.getOwnerComponent().getModel();

			// Create (POST) login request
			oModel.create("/ZEmpLoginSet", {
				EmpId: paddedEmpId,
				Password: password
			}, 
			
			{
				success: function (oData) {
					if (oData.Status === "Y") {
						oMsgStrip.setVisible(false);
						sap.ui.core.UIComponent.getRouterFor(this).navTo("Dashboard");
					} else {
						oMsgStrip.setVisible(true);
						oMsgStrip.setText("Invalid credentials.");
						oMsgStrip.setType("Error");
					}
				}.bind(this),

				error: function (oError) {
					oMsgStrip.setVisible(true);
					oMsgStrip.setText("Login failed. Server error.");
					oMsgStrip.setType("Error");

					// Add debug console output for developer
					oMsgStrip.setText("OData Login Erro: " + oError);
					

					if (oError && oError.responseText) {
						try {
							var parsed = JSON.parse(oError.responseText);
							oMsgStrip.setText("Error: " + parsed.error.message.value);
						} catch (e) {
						oMsgStrip.setText("Raw error: " + oError.responseText);
						}
					}
				}
			});
		}
	});
});