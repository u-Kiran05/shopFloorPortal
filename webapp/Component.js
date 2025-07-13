sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"shopFloor/model/models"
], function(UIComponent, Device, models) {
	"use strict";

	return UIComponent.extend("shopFloor.Component", {

		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function() {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);
			var oModel = this.getModel();
			oModel.setUseBatch(false); // simplify for now
			oModel.setHeaders({
				"X-Requested-With": "XMLHttpRequest",
				"X-CSRF-Token": "Fetch"

			});
			// set the device model
			this.setModel(models.createDeviceModel(), "device");
			var oSessionModel = new sap.ui.model.json.JSONModel({
				EmpId: ""
			});
			this.setModel(oSessionModel, "session");

			// Initialize router
			this.getRouter().initialize();

		}
	});
});