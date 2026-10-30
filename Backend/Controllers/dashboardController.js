const db = require('../db');

const tdStat = async () => {
    const query = `
        SELECT
            COALESCE(SUM(total_amount), 0.00) AS tdRevenue,
            COUNT(order_id) AS tdPaidOrders
        FROM orders
        WHERE DATE(order_time) = CURDATE() 
            AND payment_status = 'paid';
    `;
    const [rows] = await db.query(query);
    return rows[0] || { tdRevenue: 0.00, tdPaidOrders: 0 };
};

const weekStat = async () => {
    const query = `
        SELECT
            COALESCE(SUM(total_amount), 0.00) AS weekRevenue
        FROM orders
        WHERE order_time >= NOW() - INTERVAL 7 DAY
            AND payment_status = 'paid';
    `;
    const [rows] = await db.query(query);
    return rows[0]?.weekRevenue || 0.00;
}

const revenueTrend = async () => {
    const query = `
        SELECT
            DATE(order_time) AS date,
            COALESCE(SUM(total_amount), 0.00) AS revenue
        FROM orders
        WHERE order_time >= NOW() - INTERVAL 7 DAY
            AND payment_status = 'paid'
        GROUP BY DATE(order_time)
        ORDER BY date ASC;
    `;
    const [rows] = await db.query(query);
    return rows;
};

const topItems = async () => {
    const query = `
        SELECT
            m.name AS dishName,
            m.category AS category,
            SUM(oi.quantity) AS totalSold
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        JOIN menu_items m ON oi.item_id = m.item_id
        WHERE o.order_time >= NOW() - INTERVAL 7 DAY
            AND o.payment_status = 'paid'
        GROUP BY m.item_id, m.name, m.category
        ORDER BY totalSold DESC
        LIMIT 4;
    `;
    const [rows] = await db.query(query);
    return rows;
};

const hrOrder = async () => {
    const query = `
        SELECT
            HOUR(order_time) AS hr,
            COUNT(order_id) AS count
        FROM orders
        WHERE DATE(order_time) = CURDATE()
        GROUP BY HOUR(order_time)
        ORDER BY hr ASC;
    `;
    const [rows] = await db.query(query);
    return rows;
};

const dashboardData = async (request, response) => {
    try {
        const managerId = request.user?.user_id || 'Unknown';
        console.info(`[Dashboard] Manager ID: ${managerId} requested dashboard data at ${new Date().toISOString()}`);

        const [
            tdStats,
            weekRevenue,
            revenueTrendData,
            topItemsData,
            hrOrderData
        ] = await Promise.all([
            tdStat(),
            weekStat(),
            revenueTrend(),
            topItems(),
            hrOrder()
        ]);

        const topSellingItem = topItemsData.length > 0 ? topItemsData[0] : null;

        const dashboardResponse = {
            metadata: {
                snapshotDate: new Date().toISOString().split('T')[0],
                generatedAt: new Date()
            },

            summary: {
                tdRevenue: Number(tdStats.tdRevenue),
                tdPaidOrders: Number(tdStats.tdPaidOrders),
                weekRevenue: Number(weekRevenue),
                topSellingItem: topSellingItem ? {
                    dishName: topSellingItem.dishName,
                    category: topSellingItem.category,
                    totalSold: Number(topSellingItem.totalSold)
                } : null
            },

            charts: {
                revenueTrend: revenueTrendData,
                topItems: topItemsData,
                hrOrder: hrOrderData
            }
        };

        return response.status(200).json({
            success: true,
            message: 'Dashboard data retrieved successfully',
            data: dashboardResponse
        });
    } catch (error) {
        console.error(`[Dashboard] Error retrieving dashboard data: ${error.message}`);
        return response.status(500).json({
            success: false,
            message: 'An error occurred while retrieving dashboard data',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    dashboardData,
    tdStat,
    weekStat,
    revenueTrend,
    topItems,
    hrOrder
};
            