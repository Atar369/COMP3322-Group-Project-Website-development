const db = require("../db")

async function create(request, response) {
  const {user_id, table_id, booking_date, booking_time, party_size, special_request} = request.body;

  if (!user_id || !table_id || !booking_date || !booking_time || !party_size || !special_request) {
    return response.status(400).json({error: "Please fill in all required booking fields."});
  }

  try {
    const checkConflict = `SELECT EXISTS (
      SELECT 1
      FROM bookings
      WHERE table_id = ?
        AND booking_date = ?
        AND booking_time = ?
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
    console.error("database error:", error);
    return response.status(500).json({error: "Please try again later."});
  }
}

module.exports = {create: create};
