const db = require("../db")

async function create(request, response) {
  const {user_id, table_id, booking_date, booking_time, party_size, special_request} = request.body;

  if (!user_id || !table_id || !booking_date || !booking_time || !party_size) { //remove checking for special_request as it is optional
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

  try {
    const checkUserDaily = `SELECT EXISTS (
      SELECT 1
      FROM bookings
      WHERE user_id = ?
        AND DATE(booking_date) = DATE(?)
        AND status = 'confirmed'
    ) AS has_booking;`;

    const [userRows] = await db.query(checkUserDaily, [user_id, booking_date]);
    if (userRows[0].has_booking === 1) {
      return response.status(409).json({error: "You can only make one booking per day."});
    }

    const checkConflict = `SELECT EXISTS (
      SELECT 1
      FROM bookings
      WHERE table_id = ?
        AND DATE(booking_date) = DATE(?)
        AND status = 'confirmed'
        AND TIME(?) < ADDTIME(booking_time, '02:00:00')
        AND ADDTIME(?, '02:00:00') > booking_time
    ) AS is_booked;`;

    const [rows] = await db.query(checkConflict, [table_id, booking_date, booking_time, booking_time]);
    const isBooked = rows[0].is_booked;

    if (isBooked === 1) {
      return response.status(409).json({error: "The table is already reserved for this timeslot."});
    }

    const insert = `INSERT INTO bookings (user_id, table_id, booking_date, booking_time, party_size, status, special_request) VALUES (?, ?, ?, ?, ?, "confirmed", ?)`;
    const [result] = await db.query(insert, [user_id, table_id, booking_date, booking_time, party_size, special_request || ""]);
    return response.status(201).json({message: "The table is booked successfully.", bookingId: result.insertId});
    
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return response.status(409).json({error: "The table is already reserved for this timeslot."});
    }
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
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
             AND b.status = 'confirmed'
             AND TIME(?) < ADDTIME(b.booking_time, '02:00:00')
             AND ADDTIME(?, '02:00:00') > b.booking_time
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
      `SELECT booking_id, user_id, table_id, booking_date, booking_time, party_size, status, special_request
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
    const [rows] = await db.query(
      `SELECT b.booking_id, b.user_id, b.table_id, b.booking_date, b.booking_time,
              b.party_size, b.status, b.special_request, t.table_number
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
      `UPDATE bookings SET status = 'cancelled' WHERE booking_id = ? AND status = 'confirmed'`,
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

    if (booking.status !== 'confirmed') {
      return response.status(400).json({error: "Only confirmed bookings can be edited."});
    }

    const user_id = booking.user_id;

    const checkUserDaily = `SELECT EXISTS (
      SELECT 1
      FROM bookings
      WHERE user_id = ?
        AND DATE(booking_date) = DATE(?)
        AND status = 'confirmed'
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
        AND status = 'confirmed'
        AND booking_id != ?
        AND TIME(?) < ADDTIME(booking_time, '02:00:00')
        AND ADDTIME(?, '02:00:00') > booking_time
    ) AS is_booked;`;

    const [conflictRows] = await db.query(checkConflict, [table_id, booking_date, id, booking_time, booking_time]);
    
    if (conflictRows[0].is_booked === 1) {
      return response.status(409).json({error: "The table is already reserved for this timeslot."});
    }

    const update = `
      UPDATE bookings
      SET table_id = ?, booking_date = ?, booking_time = ?, party_size = ?, special_request = ?, pre_order = ?
      WHERE booking_id = ?
      AND status = 'confirmed'`;

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
      return response.status(409).json({error: "The table is already reserved for this timeslot."});
    }
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
  }
}

module.exports = {create, tables, availability, listByUser, listAll, cancel, edit};
