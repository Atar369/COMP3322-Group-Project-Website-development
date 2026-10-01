const express = require("express");
const router = express.Router();
const bookingController = require("../Controllers/bookingController");

router.get("/tables", bookingController.tables);
router.get("/availability", bookingController.availability);
router.post("/", bookingController.create);
router.get("/user/:user_id", bookingController.listByUser);
router.get("/all", bookingController.listAll);
router.patch("/:id/cancel", bookingController.cancel);

module.exports = router;
