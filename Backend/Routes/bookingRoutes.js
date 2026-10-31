const express = require("express");
const router = express.Router();
const bookingController = require("../Controllers/bookingController");

const { protect, managerOnly } = require("../Middleware/authMiddleware");

router.get("/tables", bookingController.tables);
router.get("/availability", bookingController.availability);
router.get("/menu", bookingController.menu);
router.post("/", bookingController.create);
router.get("/user/:user_id", bookingController.listByUser);

router.get("/all", protect, managerOnly, bookingController.listAll);
router.patch("/:id/cancel", protect, bookingController.cancel);
router.patch("/:id/arrive", protect, managerOnly, bookingController.arrive);
router.patch("/:id/finish", protect, managerOnly, bookingController.finishBooking);
router.patch("/:id/pay", protect, managerOnly, bookingController.payBooking);
router.patch("/:id", protect, bookingController.edit);

module.exports = router;
