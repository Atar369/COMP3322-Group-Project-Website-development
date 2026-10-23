const express = require("express");
const router = express.Router();
const bookingController = require("../Controllers/bookingController");

router.get("/tables", bookingController.tables);
router.get("/availability", bookingController.availability);
router.get("/menu", bookingController.menu);
router.post("/", bookingController.create);
router.get("/user/:user_id", bookingController.listByUser);
router.get("/all", bookingController.listAll);
router.patch("/:id/cancel", bookingController.cancel);
router.patch("/:id/arrive", bookingController.arrive);
router.patch("/:id/finish", bookingController.finishBooking);
router.patch("/:id/pay", bookingController.payBooking);
router.patch("/:id", bookingController.edit);

module.exports = router;
