sap.ui.define([
	"sap/ui/core/mvc/Controller"
], function(Controller) {

	"use strict";

	return Controller.extend("shopFloor.controller.View1", {
		onLoginPress: function() {
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

			var paddedEmpId = empId.padStart(8, '0');
			var oModel = this.getOwnerComponent().getModel();

			// Step 1: Fetch CSRF token
			oModel.setHeaders({ "X-CSRF-Token": "Fetch" });
			oModel.read("/ZEmpLoginSet", {
				success: function(data, response) {
					var csrfToken = response.headers["x-csrf-token"];
					if (csrfToken) {
						oModel.setHeaders({
							"X-CSRF-Token": csrfToken,
							"Content-Type": "application/json"
						});
					}

					// Step 2: Perform login (POST)
					oModel.create("/ZEmpLoginSet", {
						EmpId: paddedEmpId,
						Password: password
					}, {
						success: function(oData) {
							if (oData.Status === "Y") {
								oMsgStrip.setVisible(false);
								sap.ui.core.UIComponent.getRouterFor(this).navTo("View2");
							} else {
								oMsgStrip.setVisible(true);
								oMsgStrip.setText("Invalid credentials.");
								oMsgStrip.setType("Error");
							}
						}.bind(this),
						error: function(oError) {
							oMsgStrip.setVisible(true);
							oMsgStrip.setType("Error");

							if (oError && oError.responseText) {
								try {
									var parsed = JSON.parse(oError.responseText);
									oMsgStrip.setText("Error: " + parsed.error.message.value);
								} catch (e) {
									oMsgStrip.setText("Raw error: " + oError.responseText);
								}
							} else {
								oMsgStrip.setText("Login failed. Server error.");
							}
						}
					});
				}.bind(this),

				error: function(oError) {
					oMsgStrip.setVisible(true);
					oMsgStrip.setType("Error");
					oMsgStrip.setText("Failed to fetch CSRF token. Please try again.");
					console.error("CSRF token fetch failed:", oError);
				}
			});
		}
	});
});
