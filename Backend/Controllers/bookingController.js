const db = require("../db")
const { isCheckInWindowOpen } = require('../utils/bookingAttendance');

async function markExpiredBookingsNoShow() {
  await db.query(
    `UPDATE bookings
     SET status = 'no_show'
     WHERE status = 'booked'
       AND UTC_TIMESTAMP() >= DATE_SUB(
         DATE_ADD(TIMESTAMP(booking_date, booking_time), INTERVAL 15 MINUTE),
         INTERVAL 8 HOUR
       )`
  );
}

async function create(request, response) {
  const {user_id, booking_date, booking_time, party_size, special_request, pre_order} = request.body;

  if (!user_id || !booking_date || !booking_time || !party_size) {
    return response.status(400).json({error: "Please fill in all required booking fields."});
  }

  const size = Number(party_size);
  if (isNaN(size) || size <= 0) {
    return response.status(400).json({error: "Invalid party size."});
  }

  // Last entry 21:00; orders must be placed before 21:15
  const [hStr, mStr] = booking_time.split(':');
  if (parseInt(hStr, 10) > 21 || (parseInt(hStr, 10) === 21 && parseInt(mStr, 10) > 0)) {
    return response.status(400).json({error: "Last entry is 21:00. No bookings accepted after 21:00."});
  }

  const td = new Date();
  td.setHours(0, 0, 0, 0);
  const tmr = new Date(td);
  tmr.setDate(tmr.getDate() + 1);
  const bookingDate = new Date(booking_date);
  bookingDate.setHours(0, 0, 0, 0);
  if (bookingDate < tmr) {
    return response.status(400).json({error: "Bookings must be made at least one day in advance."});
  }

  const maxCap = size + 2;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const checkUserDaily = `SELECT EXISTS (
      SELECT 1 FROM bookings
      WHERE user_id = ? AND DATE(booking_date) = DATE(?) AND status = 'booked'
    ) AS has_booking;`;
    const [userRows] = await connection.query(checkUserDaily, [user_id, booking_date]);
    if (userRows[0].has_booking === 1) {
      await connection.rollback();
      return response.status(409).json({error: "You can only make one booking per day."});
    }

    // Auto-assign a table with capacity between party_size and party_size+2 that is free
    const [tableRows] = await connection.query(
      `SELECT t.table_id FROM restaurant_tables t
       WHERE t.status = 'available' AND t.capacity BETWEEN ? AND ?
         AND NOT EXISTS (
           SELECT 1 FROM bookings b
           WHERE b.table_id = t.table_id AND DATE(b.booking_date) = DATE(?)
             AND b.status = 'booked'
             AND TIME(?) < ADDTIME(b.booking_time, '01:00:00')
             AND ADDTIME(?, '01:00:00') > b.booking_time
         )
       ORDER BY t.capacity ASC LIMIT 1
       FOR UPDATE`,
      [size, maxCap, booking_date, booking_time, booking_time]
    );

    if (tableRows.length === 0) {
      await connection.rollback();
      return response.status(409).json({error: "No available table for your party size at this time."});
    }
    const table_id = tableRows[0].table_id;

    const insert = `INSERT INTO bookings (user_id, table_id, booking_date, booking_time, party_size, status, special_request, pre_order) VALUES (?, ?, ?, ?, ?, "booked", ?, ?)`;
    const [result] = await connection.query(insert, [user_id, table_id, booking_date, booking_time, size, special_request || "", pre_order ? JSON.stringify(pre_order) : null]);
    
    await connection.commit();
    return response.status(201).json({message: "The table is booked successfully.", bookingId: result.insertId});

  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return response.status(409).json({error: "The table is already booked for this timeslot."});
    }
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
  } finally {
    connection.release();
  }
}

// Add a new function to get all bookings for a specific user
async function tables(request, response) {
  try {
    const [rows] = await db.query(
      "SELECT table_id, table_number, capacity, status FROM restaurant_tables ORDER BY table_number"
    );
    return response.json(rows);
  } catch (error) {
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
  }
}

// Add a new function to check table availability for a specific date, time, and party size
async function availability(request, response) {
  const {date, time, party_size} = request.query;
  const size = Number(party_size);
  if (!date || !time || !size) {
    return response.status(400).json({error: "date, time and party_size are required."});
  }

  const maxCap = size + 2;

  try {
    const [rows] = await db.query(
      `SELECT t.table_id, t.table_number, t.capacity
       FROM restaurant_tables t
       WHERE t.status = 'available'
         AND t.capacity BETWEEN ? AND ?
         AND NOT EXISTS (
           SELECT 1 FROM bookings b
           WHERE b.table_id = t.table_id 
             AND DATE(b.booking_date) = DATE(?)
             AND b.status = 'booked'
             AND TIME(?) < ADDTIME(b.booking_time, '01:00:00')
             AND ADDTIME(?, '01:00:00') > b.booking_time
        )
       ORDER BY t.table_number`,
      [size, maxCap, date, time, time]
    );
    return response.json(rows);
  } catch (error) {
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
  }
}

// Add a new function to get all bookings for a specific user (manager view)
async function listByUser(request, response) {
  const { user_id } = request.params;
  try {
    const [rows] = await db.query(
      `SELECT booking_id, user_id, table_id, booking_date, booking_time, party_size, status, special_request, pre_order, served_at
       FROM bookings WHERE user_id = ? ORDER BY booking_date DESC, booking_time DESC`,
      [user_id]
    );
    return response.json(rows);
  } catch (error) {
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
  }
}

// Add a new function to get all bookings 
async function listAll(request, response) {
  try {
    await markExpiredBookingsNoShow();
    const [rows] = await db.query(
      `SELECT b.booking_id, b.user_id, b.table_id, b.booking_date, b.booking_time,
              b.party_size, b.status, b.special_request, b.pre_order, b.served_at, t.table_number
       FROM bookings b
       JOIN restaurant_tables t ON t.table_id = b.table_id
       ORDER BY b.booking_date DESC, b.booking_time DESC`
    );
    return response.json(rows);
  } catch (error) {
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
  }
}

// Add a new function to cancel a booking 
async function cancel(request, response) {
  const { id } = request.params;
  try {
    const [result] = await db.query(
      `UPDATE bookings SET status = 'cancelled' WHERE booking_id = ? AND status = 'booked'`,
      [id]
    );
    if (result.affectedRows === 0) {
      return response.status(404).json({error: "Booking not found or already inactive."});
    }
    return response.json({message: "Booking cancelled."});
  } catch (error) {
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
  }
}

// Add a new function to edit a booking
async function edit(request, response) {
  const {id} = request.params;
  const {table_id, booking_date, booking_time, party_size, special_request, pre_order} = request.body;

  if (!table_id || !booking_date || !booking_time || !party_size) {
    return response.status(400).json({error: "Please fill in all required booking fields."});
  }

  const td = new Date();
  td.setHours(0, 0, 0, 0);

  const tmr = new Date(td);
  tmr.setDate(tmr.getDate() + 1);

  const bookingDate = new Date(booking_date);
  bookingDate.setHours(0, 0, 0, 0);

  if (bookingDate < tmr) {
    return response.status(400).json({error: "Bookings must be made at least one day in advance."});
  }

  const size = Number(party_size);
  if (isNaN(size) || size <= 0) {
    return response.status(400).json({error: "Invalid party size."});
  }

  try {
    const [existingRows] = await db.query(
      `SELECT booking_id, user_id, status FROM bookings WHERE booking_id = ?`,
      [id]
    );

    if (existingRows.length === 0) {
      return response.status(404).json({error: "Booking not found."});
    }

    const booking = existingRows[0];

    if (booking.status !== 'booked') {
      return response.status(400).json({error: "Only active bookings can be edited."});
    }

    const user_id = booking.user_id;

    const checkUserDaily = `SELECT EXISTS (
      SELECT 1
      FROM bookings
      WHERE user_id = ?
        AND DATE(booking_date) = DATE(?)
        AND status = 'booked'
        AND booking_id != ?
    ) AS has_booking;`;

    const [userRows] = await db.query(checkUserDaily, [user_id, booking_date, id]);
    if (userRows[0].has_booking === 1) {
      return response.status(409).json({error: "You can only make one booking per day."});
    }

    const [tableRows] = await db.query(
      `SELECT capacity, status FROM restaurant_tables WHERE table_id = ?`,
      [table_id]
    );

    if (tableRows.length === 0) {
      return response.status(404).json({error: "Selected table not found."});
    }

    const tar = tableRows[0];

    if (tar.status !== 'available') {
      return response.status(400).json({error: "Selected table is not available."});
    }

    const maxCap = size + 2;

    if (tar.capacity < size || tar.capacity > maxCap) {
      return response.status(400).json({error: "The selected table does not match the party size requirements."});
    }

    const checkConflict = `SELECT EXISTS (
      SELECT 1
      FROM bookings
      WHERE table_id = ?
        AND DATE(booking_date) = DATE(?)
        AND status = 'booked'
        AND booking_id != ?
        AND TIME(?) < ADDTIME(booking_time, '01:00:00')
        AND ADDTIME(?, '01:00:00') > booking_time
    ) AS is_booked;`;

    const [conflictRows] = await db.query(checkConflict, [table_id, booking_date, id, booking_time, booking_time]);
    
    if (conflictRows[0].is_booked === 1) {
      return response.status(409).json({error: "The table is already booked for this timeslot."});
    }

    const update = `
      UPDATE bookings
      SET table_id = ?, booking_date = ?, booking_time = ?, party_size = ?, special_request = ?, pre_order = ?
      WHERE booking_id = ?
      AND status = 'booked'`;

    const [result] = await db.query(update, [
      table_id,
      booking_date,
      booking_time,
      party_size,
      special_request !== undefined ? special_request : "",
      pre_order ? JSON.stringify(pre_order) : null,
      id
    ]);

    if (result.affectedRows === 0) {
      return response.status(404).json({error: "Failed to edit the booking."});
    }

    return response.json({message: "Booking updated successfully."});
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return response.status(409).json({error: "The table is already booked for this timeslot."});
    }
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
  }
}

async function arrive(request, response) {
  const { id } = request.params;
  try {
    const [bookings] = await db.query(
      `SELECT booking_date, booking_time, status
       FROM bookings WHERE booking_id = ?`,
      [id]
    );
    if (!bookings.length) {
      return response.status(404).json({error: "Booking not found."});
    }
    if (bookings[0].status !== 'booked') {
      return response.status(409).json({error: "Booking is no longer awaiting check-in."});
    }
    if (!isCheckInWindowOpen(bookings[0].booking_date, bookings[0].booking_time)) {
      await markExpiredBookingsNoShow();
      return response.status(409).json({error: "Check-in is available only from the booked time until 15 minutes after."});
    }

    const [result] = await db.query(
      `UPDATE bookings SET status = 'serving', served_at = UTC_TIMESTAMP()
       WHERE booking_id = ? AND status = 'booked'
         AND UTC_TIMESTAMP() >= DATE_SUB(TIMESTAMP(booking_date, booking_time), INTERVAL 8 HOUR)
         AND UTC_TIMESTAMP() < DATE_SUB(
           DATE_ADD(TIMESTAMP(booking_date, booking_time), INTERVAL 15 MINUTE),
           INTERVAL 8 HOUR
         )`,
      [id]
    );
    if (result.affectedRows === 0) {
      await markExpiredBookingsNoShow();
      return response.status(409).json({error: "Check-in is available only during the 15 minutes after the booked time."});
    }
    return response.json({message: "Booking marked as serving."});
  } catch (error) {
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
  }
}

async function menu(request, response) {
  try {
    const [rows] = await db.query(
      "SELECT item_id, name, description, category, price, image_url, is_available FROM menu_items ORDER BY category, name"
    );
    return response.json(rows);
  } catch (error) {
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
  }
}

async function finishBooking(request, response) {
  const { id } = request.params;
  try {
    const [result] = await db.query(
      `UPDATE bookings SET status = 'finished' WHERE booking_id = ? AND status = 'serving'`,
      [id]
    );
    if (result.affectedRows === 0) {
      return response.status(404).json({error: "Booking not found or not in serving status."});
    }
    return response.json({message: "Booking marked as finished. Manager notified for payment."});
  } catch (error) {
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
  }
}

async function payBooking(request, response) {
  const { id } = request.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [bookings] = await connection.query(
      `SELECT table_id FROM bookings WHERE booking_id = ? AND status = 'finished' FOR UPDATE`,
      [id]
    );
    if (bookings.length === 0) {
      await connection.rollback();
      return response.status(404).json({error: "Booking not found or not in finished status."});
    }
    const table_id = bookings[0].table_id;
    await connection.query(
      `UPDATE orders
       SET payment_status = 'paid'
       WHERE payment_status = 'unpaid'
         AND (table_id = ? OR booking_id IN (
           SELECT booking_id FROM bookings WHERE table_id = ?
         ))`,
      [table_id, table_id]
    );
    await connection.query(
      `UPDATE bookings SET status = 'paid' WHERE table_id = ? AND status = 'finished'`,
      [table_id]
    );
    await connection.commit();
    return response.json({message: "Booking marked as paid."});
  } catch (error) {
    await connection.rollback();
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
  } finally {
    connection.release();
  }
}

module.exports = {create, tables, availability, listByUser, listAll, cancel, edit, menu, arrive, finishBooking, payBooking, markExpiredBookingsNoShow};
