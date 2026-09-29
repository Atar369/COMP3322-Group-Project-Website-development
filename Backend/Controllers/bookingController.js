const db = require("../db")

async function create(request, response) {
  const {user_id, table_id, booking_date, booking_time, party_size, special_request} = request.body;

  if (!user_id || !table_id || !booking_date || !booking_time || !party_size) { //remove checking for special_request as it is optional
    return response.status(400).json({error: "Please fill in all required booking fields."});
  }

  try {
    const checkConflict = `SELECT EXISTS (
      SELECT 1
      FROM bookings
      WHERE table_id = ?
        AND DATE(booking_date) = DATE(?)
        AND TIME_FORMAT(booking_time, '%H:%i') = TIME_FORMAT(?, '%H:%i')
        AND status = 'confirmed'
    ) AS is_booked;`;

    const [rows] = await db.query(checkConflict, [table_id, booking_date, booking_time]);
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
  try {
    const [rows] = await db.query(
      `SELECT t.table_id, t.table_number, t.capacity
       FROM restaurant_tables t
       WHERE t.status = 'available'
         AND t.capacity BETWEEN ? AND ?
         AND NOT EXISTS (
           SELECT 1 FROM bookings b
           WHERE b.table_id = t.table_id AND DATE(b.booking_date) = DATE(?)
             AND TIME_FORMAT(b.booking_time, '%H:%i') = TIME_FORMAT(?, '%H:%i')
             AND b.status = 'confirmed')
       ORDER BY t.table_number`,
      [size, size * 2, date, time]
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

module.exports = {create, tables, availability, listByUser, listAll, cancel};

